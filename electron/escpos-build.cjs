const iconv = require("iconv-lite");

const INIT = Buffer.from([0x1b, 0x40]);
const ALIGN_LEFT = Buffer.from([0x1b, 0x61, 0x00]);
const ALIGN_CENTER = Buffer.from([0x1b, 0x61, 0x01]);
const BOLD_ON = Buffer.from([0x1b, 0x45, 0x01]);
const BOLD_OFF = Buffer.from([0x1b, 0x45, 0x00]);
const CUT_FULL = Buffer.from([0x1d, 0x56, 0x00]);

const PAYMENT = {
  cash: "DINHEIRO",
  pix: "PIX",
  card: "CARTAO",
  mixed: "MISTO",
  installment: "PARCELADO"
};

function concat(buffers) {
  return Buffer.concat(buffers);
}

function line(text) {
  return Buffer.concat([iconv.encode(text + "\n", "cp850")]);
}

function colsForWidth(receiptWidth) {
  return receiptWidth === 58 ? 32 : 42;
}

function padCenter(str, width) {
  const t = str.length > width ? str.slice(0, width) : str;
  const pad = Math.max(0, width - t.length);
  const left = Math.floor(pad / 2);
  return " ".repeat(left) + t + " ".repeat(pad - left);
}

function padLR(left, right, width) {
  const L = left.length;
  const R = right.length;
  if (L + R + 1 > width) {
    const maxL = Math.max(1, width - R - 1);
    return `${left.slice(0, maxL)} ${right}`;
  }
  return left + " ".repeat(width - L - R) + right;
}

function dashLine(width) {
  return "-".repeat(width);
}

function fmtDate(iso) {
  const x = new Date(iso);
  if (Number.isNaN(x.getTime())) return "";
  const dd = String(x.getDate()).padStart(2, "0");
  const mm = String(x.getMonth() + 1).padStart(2, "0");
  const yy = x.getFullYear();
  const hh = String(x.getHours()).padStart(2, "0");
  const mi = String(x.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yy} ${hh}:${mi}`;
}

function parseDataUrlToBuffer(dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string") return null;
  const trimmed = dataUrl.trim();
  const comma = trimmed.indexOf(",");
  if (comma < 0) return null;
  const header = trimmed.slice(0, comma);
  const body = trimmed.slice(comma + 1);
  if (!/^data:image\//i.test(header)) return null;
  if (/;base64/i.test(header)) {
    try {
      const buf = Buffer.from(body.replace(/\s/g, ""), "base64");
      return buf.length ? buf : null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Bitmap raster ESC/POS (GS v 0) — compatível com a maioria das térmicas 58/80mm.
 */
async function logoToEscPosRaster(settings) {
  const raw = parseDataUrlToBuffer(settings && settings.logo);
  if (!raw) return null;
  let Jimp;
  try {
    Jimp = require("jimp");
  } catch {
    return null;
  }
  try {
    const image = await new Promise((resolve, reject) => {
      Jimp.read(raw, (err, img) => (err ? reject(err) : resolve(img)));
    });
    const rw = settings && settings.receiptWidth === 58 ? 58 : 80;
    const maxW = rw === 58 ? 384 : 576;
    const maxH = 120;
    image.scaleToFit(maxW, maxH);
    image.greyscale();
    image.contrast(0.12);
    const w = image.bitmap.width;
    const h = image.bitmap.height;
    if (w < 1 || h < 1) return null;
    const widthBytes = Math.ceil(w / 8);
    const rows = Buffer.allocUnsafe(widthBytes * h);
    let offset = 0;
    for (let y = 0; y < h; y++) {
      for (let xb = 0; xb < widthBytes; xb++) {
        let byte = 0;
        for (let bit = 0; bit < 8; bit++) {
          const x = xb * 8 + bit;
          if (x < w) {
            const rgba = Jimp.intToRGBA(image.getPixelColor(x, y));
            const a = rgba.a / 255;
            /** Transparência + pre-multiplied escuro virava “quadrado preto”; mesclar no branco. */
            const r = Math.round(rgba.r * a + 255 * (1 - a));
            const g = Math.round(rgba.g * a + 255 * (1 - a));
            const b = Math.round(rgba.b * a + 255 * (1 - a));
            const lum = (r + g + b) / 3;
            if (lum < 140) byte |= 1 << (7 - bit);
          }
        }
        rows[offset++] = byte;
      }
    }
    const xL = widthBytes & 0xff;
    const xH = (widthBytes >> 8) & 0xff;
    const yL = h & 0xff;
    const yH = (h >> 8) & 0xff;
    const header = Buffer.from([0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH]);
    return Buffer.concat([header, rows]);
  } catch {
    return null;
  }
}

async function prependLogoParts(settings, parts) {
  const raster = await logoToEscPosRaster(settings);
  if (raster) {
    parts.push(ALIGN_CENTER, raster);
  }
}

async function buildSaleCoupon(sale, settings) {
  const w = settings && settings.receiptWidth === 58 ? 58 : 80;
  const cols = colsForWidth(w);
  const name = String((settings && settings.systemName) || "LHG SYSTEM").toUpperCase();
  const pm = sale.paymentMethod;
  const payment = PAYMENT[pm] || String(pm || "").toUpperCase();

  const parts = [INIT, ALIGN_LEFT];
  await prependLogoParts(settings, parts);

  parts.push(ALIGN_CENTER, BOLD_ON, line(padCenter(name, cols)), BOLD_OFF, ALIGN_LEFT);

  parts.push(
    line(`Data: ${fmtDate(sale.createdAt)}`),
    line(`Venda: ${String(sale.id).substring(0, 8).toUpperCase()}`),
    line(`Operador: ${String(sale.userName ?? "")}`),
    line(dashLine(cols))
  );

  const items = Array.isArray(sale.items) ? sale.items : [];
  for (const item of items) {
    const itemName = `${item.name}`.toUpperCase();
    const lineName = itemName.length > cols ? `${itemName.slice(0, cols - 3)}...` : itemName;
    parts.push(BOLD_ON, line(lineName), BOLD_OFF);
    const left = `${item.quantity} x ${Number(item.unitPrice).toFixed(2)}`;
    const right = Number(item.totalPrice).toFixed(2);
    parts.push(line(padLR(left, right, cols)));
  }

  parts.push(line(dashLine(cols)));
  parts.push(BOLD_ON, line(padLR("TOTAL", `R$ ${Number(sale.total).toFixed(2)}`, cols)), BOLD_OFF);
  parts.push(line(`Pagamento: ${payment}`));
  if (sale.change && Number(sale.change) > 0) {
    parts.push(line(`Troco: R$ ${Number(sale.change).toFixed(2)}`));
  }
  parts.push(line(dashLine(cols)));
  parts.push(ALIGN_CENTER, line("NAO E DOCUMENTO FISCAL"));
  parts.push(line("Obrigado pela preferencia!"));
  parts.push(ALIGN_LEFT);
  parts.push(Buffer.from([0x1b, 0x64, 0x04]));
  parts.push(CUT_FULL);

  return concat(parts);
}

async function buildTestReceipt(settings) {
  const w = settings && settings.receiptWidth === 58 ? 58 : 80;
  const cols = colsForWidth(w);
  const name = String((settings && settings.systemName) || "LHG SYSTEM").toUpperCase();
  const parts = [INIT, ALIGN_LEFT];
  await prependLogoParts(settings, parts);
  parts.push(
    ALIGN_CENTER,
    BOLD_ON,
    line(padCenter(name, cols)),
    BOLD_OFF,
    line(""),
    line("TESTE ESC/POS"),
    line("Impressao direta RAW"),
    line(""),
    ALIGN_LEFT,
    line(dashLine(cols)),
    Buffer.from([0x1b, 0x64, 0x03]),
    CUT_FULL
  );
  return concat(parts);
}

module.exports = { buildSaleCoupon, buildTestReceipt };
