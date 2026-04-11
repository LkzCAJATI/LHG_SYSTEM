import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Budget, Receipt, Sale, ServiceOrder } from '../types';
import { format } from 'date-fns';

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatCPF = (cpf: string | undefined): string => {
  if (!cpf) return '';
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return cpf;
  return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
};

const formatPhone = (phone: string | undefined): string => {
  if (!phone) return '';
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 11) {
    return clean.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  } else if (clean.length === 10) {
    return clean.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  }
  return phone;
};

const FIXED_BUDGET_RULES = `REGRAS DE ORCAMENTO / CONSERTO
- Este orçamento possui validade de até 7 dias após a data de emissão.
- O serviço será iniciado somente após aprovação do orçamento e pagamento de entrada mínima de 50% do valor total.
- Serviços técnicos realizados não poderão ser desfeitos.
- Cancelamentos após o início do serviço poderão gerar cobrança proporcional ao trabalho executado.
- Em caso de peças ou produtos encomendados, o valor da entrada não é reembolsável em caso de desistência.
- O aparelho permanecerá retido até a quitação total do valor do serviço.
- Após a conclusão do serviço, o cliente terá prazo máximo de 30 dias para retirada do aparelho.
- Após esse prazo poderá ser cobrada taxa de armazenamento.
- Após 90 dias sem retirada e sem contato, o aparelho poderá ser considerado abandonado para ressarcimento dos custos do serviço.
- Garantia de 3 meses para defeitos relacionados exclusivamente ao serviço realizado.
- A garantia não cobre mau uso, quedas, oxidação, violação do aparelho ou problemas não relacionados ao serviço executado.
- A loja não se responsabiliza por dados não salvos no aparelho.
- Serviços serão realizados somente mediante solicitação, autorização, pagamento e retirada por pessoa maior de 18 anos.
- O aparelho será entregue somente ao titular do orçamento mediante quitação total do serviço.`;

const FIXED_PAYMENT_RULES = `REGRAS DE PAGAMENTO
- Aceitamos: PIX, dinheiro, cartões de crédito/débito.
- Parcelamentos no cartão sob consulta, podendo incluir acréscimos de taxas.`;

const FIXED_SERVICE_AUTH = `AUTORIZACAO DE SERVICO
Declaro que li e concordo com todos os termos deste orçamento para realização dos serviços ou reparos.`;

/**
 * Abre o PDF para impressão. Preferimos `window.open` (usuário vê o PDF e o diálogo de impressão)
 * porque em Electron/Chromium recentes o PDF em iframe oculto muitas vezes não dispara load nem
 * aceita `contentWindow.print()` — parecia que "não fazia nada".
 * Iframe fica só como fallback se o popup for bloqueado.
 */
const openJsPdfForPrint = (doc: jsPDF) => {
  doc.autoPrint();
  const url = doc.output('bloburl') as string;
  if (typeof window === 'undefined') return;

  const schedulePrintOnWindow = (target: Window) => {
    const runPrint = () => {
      try {
        target.focus();
        target.print();
      } catch {
        /* ignore */
      }
    };
    try {
      target.addEventListener('load', () => setTimeout(runPrint, 400), { once: true });
    } catch {
      /* ignore */
    }
    setTimeout(runPrint, 500);
    setTimeout(runPrint, 2000);
  };

  const popup = window.open(url, '_blank');
  if (popup) {
    schedulePrintOnWindow(popup);
    return;
  }

  const iframe = document.createElement('iframe');
  iframe.setAttribute('title', 'Cupom PDF');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText =
    'position:fixed;left:-9999px;top:0;width:4px;height:4px;border:0;opacity:0;pointer-events:none;';
  iframe.src = url;
  document.body.appendChild(iframe);
  let printed = false;
  const finish = () => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
    iframe.remove();
  };
  const printNow = () => {
    if (printed) return;
    printed = true;
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      /* ignore */
    }
    setTimeout(finish, 2500);
  };
  iframe.onload = () => setTimeout(printNow, 400);
  setTimeout(printNow, 6000);

  if (!window.lhgSystem) {
    setTimeout(() => {
      if (printed) return;
      alert(
        'Não foi possível abrir a janela de impressão. Permita pop-ups para este site e tente de novo.'
      );
    }, 7500);
  }
};

const THERMAL_PAYMENT_LABELS: Record<string, string> = {
  cash: 'DINHEIRO',
  pix: 'PIX',
  card: 'CARTAO',
  mixed: 'MISTO',
  installment: 'PARCELADO'
};

/**
 * Cupom para impressora térmica: evita PDF estreito no Chrome/Electron (muitos drivers
 * imprimem em branco ou alimentam bobina sem parar). HTML + @page em mm costuma respeitar melhor a bobina.
 */
const printThermalCouponHtml = (sale: Sale, settings: any) => {
  const widthMm = settings?.receiptWidth === 58 ? 58 : 80;
  const contentMaxMm = widthMm === 58 ? 48 : 72;
  const paymentLabel =
    THERMAL_PAYMENT_LABELS[sale.paymentMethod] || String(sale.paymentMethod || '').toUpperCase();
  const systemName = escapeHtml(String(settings?.systemName || 'LHG SYSTEM').toUpperCase());

  const logoRaw =
    typeof settings?.logo === 'string' && settings.logo.startsWith('data:image/')
      ? settings.logo.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      : '';
  const logoBlock = logoRaw ? `<img class="logo" src="${logoRaw}" alt="" />` : '';

  /**
   * Altura total da página em mm (área de pintura). Se subestimar, o Chrome gera **2+ páginas**
   * (segunda muitas vezes quase vazia) e a fila mostra "Páginas: 2" — bobina avança à toa.
   * Cada item = 2 linhas na tabela (~12mm); cabeçalho/rodapé e margens precisam folga.
   */
  const pageHeightMm = Math.min(
    900,
    Math.ceil(
      38 +
        (logoBlock ? 22 : 0) +
        sale.items.length * 12 +
        (sale.change && sale.change > 0 ? 6 : 0) +
        28 +
        18
    )
  );

  const itemsHtml = sale.items
    .map((item) => {
      const itemName = `${item.name}`.toUpperCase();
      const lineName = itemName.length > 22 ? `${itemName.slice(0, 22)}...` : itemName;
      const left = `${item.quantity} x ${item.unitPrice.toFixed(2)}`;
      const right = item.totalPrice.toFixed(2);
      return `<tr><td colspan="2" style="padding:0;font-weight:700;">${escapeHtml(lineName)}</td></tr><tr><td style="padding:0 0 3px 0;">${escapeHtml(left)}</td><td style="padding:0 0 3px 0;text-align:right;">${escapeHtml(right)}</td></tr>`;
    })
    .join('');

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Cupom</title><style>
@page{size:${widthMm}mm ${pageHeightMm}mm;margin:0}
*,*:before,*:after{box-sizing:border-box}
html{height:auto!important;min-height:0!important;margin:0}
body{margin:0;padding:3mm 2mm;height:auto!important;min-height:0!important;max-width:${contentMaxMm}mm;font-family:"Courier New",Courier,ui-monospace,monospace;font-size:11px;line-height:1.25;color:#000;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.ticket{page-break-inside:avoid;page-break-after:avoid;break-inside:avoid}
table.items{page-break-inside:avoid;break-inside:avoid}
table.items tr{page-break-inside:avoid;break-inside:avoid}
.c{text-align:center}.b{font-weight:700}
table.items{width:100%;border-collapse:collapse;margin:4px 0}
.sep{border:0;border-top:1px solid #000;margin:4px 0;height:0}
img.logo{display:block;margin:0 auto 4px;max-width:22mm;max-height:22mm;object-fit:contain}
.tiny{font-size:8px;line-height:1.2}
</style></head><body>
<div class="ticket">
${logoBlock}
<div class="c b">${systemName}</div>
<div>Data: ${escapeHtml(format(new Date(sale.createdAt), 'dd/MM/yyyy HH:mm'))}</div>
<div>Venda: ${escapeHtml(sale.id.substring(0, 8).toUpperCase())}</div>
<div>Operador: ${escapeHtml(String(sale.userName ?? ''))}</div>
<div class="sep"></div>
<table class="items">${itemsHtml}</table>
<div class="sep"></div>
<table class="items" style="font-weight:700"><tr><td>TOTAL</td><td style="text-align:right">R$ ${escapeHtml(sale.total.toFixed(2))}</td></tr></table>
<div>Pagamento: ${escapeHtml(paymentLabel)}</div>
${
  sale.change && sale.change > 0
    ? `<div>Troco: R$ ${escapeHtml(sale.change.toFixed(2))}</div>`
    : ''
}
<div class="sep"></div>
<div class="c tiny">NAO E DOCUMENTO FISCAL</div>
<div class="c tiny">Obrigado pela preferencia!</div>
</div>
</body></html>`;

  const w = window.open('', '_blank');
  if (!w) {
    alert('Não foi possível abrir a janela de impressão. Permita pop-ups e tente de novo.');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();

  const runPrint = () => {
    try {
      w.focus();
      w.print();
    } catch {
      /* ignore */
    }
  };
  setTimeout(runPrint, 150);
  setTimeout(runPrint, 600);
};

/** No app Electron (Windows), tenta ESC/POS RAW primeiro; HTML só como contingência. */
const printThermalCoupon = async (sale: Sale, settings: any) => {
  const useEsc = settings?.thermalEscPos !== false;
  if (typeof window !== 'undefined' && window.lhgSystem?.printEscPos && useEsc) {
    const res = await window.lhgSystem.printEscPos({
      mode: 'coupon',
      sale,
      settings,
      printerName: (settings?.thermalPrinterName || '').trim()
    });
    if (res?.ok) {
      return;
    }
    const msg = res?.error || 'erro desconhecido';
    console.warn('ESC/POS:', msg);
    alert(
      `Impressão direta (ESC/POS) falhou:\n${msg}\n\n` +
        'Confira o nome exato da fila em Configurações → Impressão (ou deixe vazio para usar a impressora padrão do Windows).\n\n' +
        'Tentando impressão pela janela do navegador (pode sair em branco na térmica).'
    );
  }
  printThermalCouponHtml(sale, settings);
};

// Helper: Substituir placeholders nos modelos
const replacePlaceholders = (text: string, data: any) => {
  if (text == null) return '';
  let result = String(text);
  if (!data || typeof data !== 'object') return result;
  Object.keys(data).forEach(key => {
    const value = data[key] ?? '';
    try {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    } catch {
      /* ignora chaves com caracteres especiais no RegExp */
    }
  });
  return result;
};

/** Modelos mínimos se configuração estiver vazia ou corrompida no disco. */
const FALLBACK_SALE_CONTRACT_TEMPLATE = `CONTRATO DE COMPRA E VENDA

VENDEDOR: {{LOJA}}
CLIENTE: {{CLIENTE}} — CPF: {{CPF}}

OBJETO: {{OBJETO}}
VALOR TOTAL: {{VALOR_TOTAL}}
FORMA DE PAGAMENTO: {{FORMA_PAGAMENTO}}
GARANTIA: {{GARANTIA}}
INADIMPLêNCIA / MULTA: {{INADIMPLENCIA}}

Data: {{DATA}}`;

const FALLBACK_REPAIR_CONTRACT_TEMPLATE = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS

CONTRATANTE: {{CLIENTE}} — CPF: {{CPF}}
PRESTADOR: {{LOJA}}

CLÁUSULA 1 – DO OBJETO
Prestação de serviços técnicos de reparo/manutenção referente a: {{OBJETO}}.

CLÁUSULA 2 – DO VALOR
Valor total: {{VALOR_TOTAL}}.

CLÁUSULA 3 – DA FORMA DE PAGAMENTO
{{FORMA_PAGAMENTO}}

CLÁUSULA 4 – DA GARANTIA
{{GARANTIA}}

CLÁUSULA 5 – DA INADIMPLêNCIA / MULTA
{{INADIMPLENCIA}}

Data: {{DATA}}`;

function triggerJsPdfDownload(doc: jsPDF, fileName: string) {
  try {
    doc.save(fileName);
    return;
  } catch {
    /* continua */
  }
  try {
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2500);
    return;
  } catch {
    /* continua */
  }
  window.open(doc.output('bloburl'), '_blank');
}

// Helper: Desenhar Cabeçalho Padrão
const drawHeader = (doc: jsPDF, settings: any) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  
  if (settings.logo) {
    try {
      const logo = String(settings.logo);
      let fmt: 'PNG' | 'JPEG' | 'WEBP' = 'PNG';
      if (/data:image\/jpe?g/i.test(logo)) fmt = 'JPEG';
      else if (/data:image\/webp/i.test(logo)) fmt = 'WEBP';
      else if (/data:image\/png/i.test(logo)) fmt = 'PNG';
      doc.addImage(logo, fmt, 15, 10, 25, 25);
    } catch {
      doc.setFontSize(22);
      doc.text('LHG', 18, 25);
    }
  } else {
    doc.setFontSize(22);
    doc.text('LHG', 18, 25);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(107, 33, 168); // Roxo
  doc.text(settings.systemName || 'LAN HOUSE GAMER', 45, 20);
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  const companyInfo = [
    'Endereco: Av. dos Trabalhadores, 58 - Centro - CAJATI/SP',
    'Telefone: (13) 99684-5716  CNPJ: 59.521.108/0001-66'
  ];
  doc.text(companyInfo, 45, 26);

  doc.setLineWidth(1.5);
  doc.setDrawColor(190, 24, 110); // Rosa escuro (igual foto)
  doc.line(0, 38, pageWidth, 38);
};

export const generateOSPDF = async (os: ServiceOrder, settings: any, action: 'download' | 'print' = 'download', returnBuffer = false) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  drawHeader(doc, settings);

  // Título
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text(`ORDEM DE SERVIÇO Nº   ${os.externalId || os.id.substring(0, 8)}`, 40, 48);
  doc.text(`Data:    ${format(new Date(os.createdAt), 'dd/MM/yyyy')}`, pageWidth - 15, 48, { align: 'right' });

  // Dados do Cliente
  doc.setFillColor(107, 33, 168);
  doc.rect(15, 55, pageWidth - 30, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text('DADOS DO CLIENTE', 18, 61);

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nome: ____________________________________________________________________________`, 15, 72);
  doc.text(`${os.customerName}`, 30, 71);
  doc.text(`CPF: __________________________________   Telefone: _____________________________________`, 15, 80);
  doc.text(`${formatCPF(os.customerCPF)}`, 28, 79);
  doc.text(`${formatPhone(os.customerPhone)}`, 115, 79);
  doc.text(`Declaro ser maior de 18 anos. ( ${os.isOver18 ? 'x' : ' '} ) Sim`, 15, 88);

  // Dados do Aparelho
  doc.setFillColor(107, 33, 168);
  doc.rect(15, 95, pageWidth - 30, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.text('DADOS DO APARELHO', 18, 101);

  doc.setTextColor(0, 0, 0);
  const deviceCheck = (type: string) => os.deviceType === type ? '( x )' : '(   )';
  doc.text(`Tipo: ${deviceCheck('pc')} PC  ${deviceCheck('notebook')} Notebook  ${deviceCheck('console')} Console  ${deviceCheck('celular')} Celular`, 15, 110);
  doc.text(`Marca/Modelo: ____________________________________________________________________`, 15, 118);
  doc.text(`${os.deviceBrandModel}`, 45, 117);
  doc.text(`Nº de Série: _________________________________________________________________________`, 15, 126);
  doc.text(`${os.serialNumber}`, 38, 125);
  doc.text(`Estado físico (riscos, trincos, acessórios):`, 15, 134);
  doc.setDrawColor(200, 200, 200);
  doc.rect(15, 137, pageWidth - 30, 20);
  doc.setFontSize(8);
  doc.text(doc.splitTextToSize(os.physicalState, pageWidth - 40), 18, 142);

  doc.setFontSize(10);
  doc.text(`Relato do cliente sobre o problema:`, 15, 164);
  doc.rect(15, 167, pageWidth - 30, 15);
  doc.setFontSize(8);
  doc.text(doc.splitTextToSize(os.customerComplaint || '', pageWidth - 40), 18, 172);

  // Serviços
  doc.setFontSize(10);
  doc.setFillColor(107, 33, 168);
  doc.rect(15, 188, pageWidth - 30, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.text('SERVIÇOS', 18, 194);

  doc.setTextColor(0, 0, 0);
  const baseServices = ['Diagnóstico para identificar o problema', 'Formatação', 'Limpeza completa', 'Troca de pasta térmica', 'Atualização de drivers', 'Troca de peças'];
  let currentY = 203;
  
  // Renderiza serviços base
  baseServices.forEach(s => {
    const checked = os.selectedServices.includes(s) ? '( x )' : '(   )';
    doc.text(`${checked} ${s}`, 15, currentY);
    currentY += 8;
  });

  // Renderiza serviço extra se existir
  const extraServices = os.selectedServices.filter(s => !baseServices.includes(s));
  extraServices.forEach(s => {
    doc.text(`( x ) ${s}`, 15, currentY);
    currentY += 8;
  });

  // Assinaturas
  doc.line(15, 270, 90, 270);
  doc.text('Assinatura do Cliente', 52.5, 275, { align: 'center' });
  doc.line(pageWidth - 90, 270, pageWidth - 15, 270);
  doc.text('Assinatura da Loja', pageWidth - 52.5, 275, { align: 'center' });

  const fileName = `OS_${os.externalId || os.id.substring(0,6)}.pdf`;
  
  if (returnBuffer) {
    return doc.output('arraybuffer');
  }

  if (action === 'print') {
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
  } else {
    doc.save(fileName);
  }
};

export const generateBudgetPDF = async (budget: Budget, settings: any, action: 'download' | 'print' = 'download', returnBuffer = false) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  // Header
  drawHeader(doc, settings);

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text('ORÇAMENTO E APROVAÇÃO DE SERVIÇO OU MONTAGEM', pageWidth / 2, 48, { align: 'center' });

  // Budget metadata
  doc.setFontSize(10);
  doc.text(`ORDEM DE SERVIÇO Nº   ${budget.externalId || ''}`, 15, 60);
  doc.text(`Data Orçamento:   ${format(new Date(budget.createdAt), 'dd/MM/yyyy')}`, pageWidth - 15, 60, { align: 'right' });

  // ----- Dados do Cliente -----
  doc.setFillColor(107, 33, 168);
  doc.rect(15, 68, pageWidth - 30, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text('DADOS DO CLIENTE', 18, 74);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Nome: ${budget.customerName || '____________________'}`, 15, 84);
  doc.text(`CPF: ${formatCPF(budget.customerCPF) || '____________________'}`, 15, 92);
  doc.text(`Telefone: ${formatPhone(budget.customerPhone) || '____________________'}`, 15, 100);

  // ----- Tabela de Itens -----
  const formatItemDiscount = (i: any) => {
    const type = i?.discountType || 'value';
    const raw = Number(i?.discountValue) || 0;
    if (raw <= 0) return '-';
    if (type === 'percent') return `${Math.min(100, raw).toFixed(2)}%`;
    return `R$ ${raw.toFixed(2)}`;
  };

  autoTable(doc, {
    startY: 110,
    head: [['Descrição', 'Unit', 'Qtd', 'Desc', 'Total']],
    body: budget.items.map(i => [
      i.description,
      `R$ ${i.unitPrice.toFixed(2)}`,
      String(i.quantity),
      formatItemDiscount(i),
      `R$ ${i.totalPrice.toFixed(2)}`
    ]),
    theme: 'grid',
    headStyles: { fillColor: [107, 33, 168] },
    styles: { halign: 'center', fontSize: 9 },
    columnStyles: {
      0: { halign: 'left', cellWidth: 82 },
      1: { cellWidth: 26 },
      2: { cellWidth: 14 },
      3: { cellWidth: 22 },
      4: { cellWidth: 26 },
    }
  });

  // Total amount box
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFillColor(107, 33, 168);
  doc.rect(pageWidth - 75, finalY - 5, 60, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text(`TOTAL:   R$ ${budget.total.toFixed(2)}`, pageWidth - 45, finalY + 1.5, { align: 'center' });

  // --- A partir daqui, este PDF deve caber em 1 página ---
  // Em vez de quebrar página, reduzimos fonte/linha e, em último caso,
  // truncamos regras para manter as assinaturas sempre na primeira página.
  let currentY = finalY + 16;
  const signaturesReserve = 28; // espaço mínimo para assinaturas + data
  const bottomMargin = 14;

  const maxYBeforeSignatures = pageHeight - bottomMargin - signaturesReserve;
  const clampTextBlockToPage = (
    rawText: string,
    fontSize: number,
    lineHeight: number
  ) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(rawText || '', pageWidth - (margin * 2));
    const availableHeight = Math.max(0, maxYBeforeSignatures - currentY);
    const maxLines = Math.max(0, Math.floor(availableHeight / lineHeight));

    if (lines.length <= maxLines) {
      return { lines, used: lines.length };
    }

    // Trunca e adiciona marcador de continuação
    const keep = Math.max(0, maxLines - 1);
    const trimmed = lines.slice(0, keep);
    if (maxLines > 0) trimmed.push('(continua...)');
    return { lines: trimmed, used: trimmed.length };
  };

  const renderTextBlockAdaptive = (text: string) => {
    // Tenta caber com tamanhos progressivamente menores.
    const attempts = [
      { fontSize: 8, lineHeight: 3.5 },
      { fontSize: 7, lineHeight: 3.2 },
      { fontSize: 6.5, lineHeight: 3.0 },
      { fontSize: 6, lineHeight: 2.8 },
    ];

    for (const a of attempts) {
      const { lines } = clampTextBlockToPage(text, a.fontSize, a.lineHeight);
      // Se não truncou (ou seja, coube), renderiza e retorna.
      // Heurística: se o último item não é o marcador, coube.
      const endedWithMarker = lines[lines.length - 1] === '(continua...)';
      if (!endedWithMarker) {
        doc.text(lines, margin, currentY);
        currentY += (lines.length * a.lineHeight) + 4;
        return;
      }
    }

    // Último recurso: renderiza truncado no menor tamanho
    const last = attempts[attempts.length - 1];
    const { lines } = clampTextBlockToPage(text, last.fontSize, last.lineHeight);
    doc.text(lines, margin, currentY);
    currentY += (lines.length * last.lineHeight) + 4;
  };

  // ----- Regras de Orçamento -----
  doc.setTextColor(0, 0, 0);
  const budgetRulesText = FIXED_BUDGET_RULES || 'Sem regras cadastradas.';
  renderTextBlockAdaptive(budgetRulesText);

  // ----- Regras de Pagamento -----
  const paymentRulesText = FIXED_PAYMENT_RULES || 'Sem regras de pagamento cadastradas.';
  renderTextBlockAdaptive(paymentRulesText);

  // ----- Autorização de serviço -----
  renderTextBlockAdaptive(FIXED_SERVICE_AUTH || '');

  // ----- Assinaturas -----
  // Força assinaturas no rodapé da primeira página
  const signatureY = Math.min(Math.max(currentY + 4, pageHeight - bottomMargin - 18), pageHeight - bottomMargin - 18);
  doc.line(margin, signatureY, 90, signatureY);
  doc.text('Assinatura do Cliente', 52.5, signatureY + 5, { align: 'center' });
  doc.line(pageWidth - 90, signatureY, pageWidth - margin, signatureY);
  doc.text('Assinatura da Loja', pageWidth - 52.5, signatureY + 5, { align: 'center' });
  doc.text(`Data da assinatura: ____/____/________`, margin, signatureY + 12);

  // Save / Print
  const fileName = `Orcamento_${budget.externalId || budget.id.substring(0, 6)}.pdf`;
  
  if (returnBuffer) {
    return doc.output('arraybuffer');
  }
  
  if (action === 'print') {
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
  } else {
    doc.save(fileName);
  }
};
export const generateContractPDF = async (
  os: ServiceOrder,
  settings: any,
  action: 'download' | 'print' = 'download',
  returnBufferOrDataOverrides: boolean | Record<string, string> = false
) => {
  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    
    drawHeader(doc, settings);

    const contract = os.contract;
    const dataOverrides =
      typeof returnBufferOrDataOverrides === 'object' && returnBufferOrDataOverrides !== null
        ? returnBufferOrDataOverrides
        : {};
    const returnBuffer = typeof returnBufferOrDataOverrides === 'boolean'
      ? returnBufferOrDataOverrides
      : false;
    const normalizedAction: 'download' | 'print' = action === 'print' ? 'print' : 'download';
    const isVenda = contract?.type === 'venda';
    const saleRaw = settings.saleContractTemplate;
    const repairRaw = settings.repairContractTemplate;
    const salePick = typeof saleRaw === 'string' && saleRaw.trim() ? saleRaw : FALLBACK_SALE_CONTRACT_TEMPLATE;
    const repairPick =
      typeof repairRaw === 'string' && repairRaw.trim() ? repairRaw : FALLBACK_REPAIR_CONTRACT_TEMPLATE;
    const template = isVenda ? salePick : repairPick;

    const data = {
      LOJA: settings.systemName || 'LAN HOUSE GAMER',
      CLIENTE: os.customerName || '____________________',
      CPF: formatCPF(os.customerCPF) || '____________________',
      OBJETO: contract?.objectDescription || os.deviceBrandModel || 'Prestação de Serviços',
      VALOR_TOTAL: `R$ ${(contract?.totalValue || os.paymentSummary?.total || 0).toFixed(2)}`,
      FORMA_PAGAMENTO: contract?.paymentTerms || 'A combinar',
      GARANTIA: contract?.warrantyTerms || '',
      INADIMPLENCIA: contract?.defaultTerms?.inadimplencia || '',
      DATA: format(new Date(), 'dd/MM/yyyy'),
    };
    const mergedData = { ...data, ...dataOverrides };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  const title = isVenda ? 'CONTRATO DE COMPRA E VENDA' : 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS';
  doc.text(title, pageWidth / 2, 48, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

    let textToRender = replacePlaceholders(template, mergedData);
    if (contract) {
      if (contract.paymentTerms) {
        textToRender = textToRender.replace(/\{\{FORMA_PAGAMENTO\}\}/g, contract.paymentTerms);
      }
      if (contract.warrantyTerms) {
        textToRender = textToRender.replace(/\{\{GARANTIA\}\}/g, contract.warrantyTerms);
      }
      const inad = contract.defaultTerms?.inadimplencia;
      if (inad) {
        textToRender = textToRender.replace(/\{\{INADIMPLENCIA\}\}/g, inad);
      }
    }

    const splitText = doc.splitTextToSize(textToRender, pageWidth - (margin * 2));
    let currentY = 58;

    const fitContractOnPage = (fontSize: number, lineHeight: number) => {
      doc.setFontSize(fontSize);
      const reserveForSignatures = 46;
      const maxTextHeight = pageHeight - reserveForSignatures - currentY;
      const neededTextHeight = splitText.length * lineHeight;
      return { lineHeight, fits: neededTextHeight <= maxTextHeight };
    };

    let lineHeight = 5;
    let fit = fitContractOnPage(10, 5);
    if (!fit.fits) {
      fit = fitContractOnPage(9, 4.5);
      lineHeight = 4.5;
    }
    if (!fit.fits) {
      fit = fitContractOnPage(8, 4);
      lineHeight = 4;
    }

    splitText.forEach((line: string) => {
      if (currentY > pageHeight - 40) {
        doc.addPage();
        currentY = 20;
      }
      doc.text(line, margin, currentY);
      currentY += lineHeight;
    });

    if (currentY > pageHeight - 60) {
      doc.addPage();
      currentY = 40;
    } else {
      currentY = pageHeight - 40;
    }

    doc.line(margin, currentY, 90, currentY);
    doc.text('RESPONSÁVEL / LOJA', 55, currentY + 5, { align: 'center' });
    doc.line(pageWidth - 90, currentY, pageWidth - margin, currentY);
    doc.text('CLIENTE / COMPRADOR', pageWidth - 55, currentY + 5, { align: 'center' });

    if (returnBuffer) {
      return doc.output('arraybuffer');
    }

    if (normalizedAction === 'print') {
      doc.autoPrint();
      window.open(doc.output('bloburl'), '_blank');
      return;
    }

    const fileName = `Contrato_${os.externalId || os.id.substring(0, 6)}.pdf`;
    triggerJsPdfDownload(doc, fileName);
  } catch (e) {
    console.error('Falha ao gerar contrato PDF:', e);
    alert('Falha ao gerar o PDF do contrato. Tente novamente (ou verifique o bloqueio de pop-up).');
  }
};

export const generatePDVCouponPDF = async (sale: Sale, settings: any, action: 'download' | 'print' = 'print') => {
  /** Térmica: ESC/POS RAW no Electron; senão HTML (@page mm). */
  if (action === 'print' && settings?.printerType !== 'a4') {
    await printThermalCoupon(sale, settings);
    return;
  }

  const width = settings?.receiptWidth === 58 ? 58 : 80;
  const itemLines = Math.max(1, sale.items.length);
  const hasLogo = Boolean(settings?.logo);
  /**
   * PDF para download ou quando a impressora está configurada como A4 no sistema.
   * Uma única página com altura próxima do conteúdo (bobina).
   */
  const dynamicHeight = Math.max(
    width + 40,
    52 + (itemLines * 9) + (sale.change && sale.change > 0 ? 6 : 0) + (hasLogo ? 16 : 0)
  );
  const doc = new jsPDF({
    unit: 'mm',
    format: [width, dynamicHeight],
    orientation: 'portrait'
  });
  const right = width - 4;
  let y = 6;

  const paymentMap: Record<string, string> = {
    cash: 'DINHEIRO',
    pix: 'PIX',
    card: 'CARTAO',
    mixed: 'MISTO',
    installment: 'PARCELADO'
  };

  if (hasLogo) {
    try {
      doc.addImage(settings.logo, 'PNG', 4, 3, 10, 10);
      doc.setFont('courier', 'bold');
      doc.setFontSize(9);
      doc.text((settings?.systemName || 'LHG SYSTEM').toUpperCase(), width / 2 + 2, y, { align: 'center' });
      y += 9;
    } catch {
      doc.setFont('courier', 'bold');
      doc.setFontSize(10);
      doc.text((settings?.systemName || 'LHG SYSTEM').toUpperCase(), width / 2, y, { align: 'center' });
      y += 5;
    }
  } else {
    doc.setFont('courier', 'bold');
    doc.setFontSize(10);
    doc.text((settings?.systemName || 'LHG SYSTEM').toUpperCase(), width / 2, y, { align: 'center' });
    y += 5;
  }

  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  doc.text(`Data: ${format(new Date(sale.createdAt), 'dd/MM/yyyy HH:mm')}`, 4, y);
  y += 4;
  doc.text(`Venda: ${sale.id.substring(0, 8).toUpperCase()}`, 4, y);
  y += 4;
  doc.text(`Operador: ${String(sale.userName ?? '')}`, 4, y);
  y += 4;
  doc.line(4, y, right, y);
  y += 4;

  sale.items.forEach((item) => {
    const itemName = `${item.name}`.toUpperCase();
    const lineName = itemName.length > 22 ? `${itemName.slice(0, 22)}...` : itemName;
    doc.text(lineName, 4, y);
    y += 3.5;
    doc.text(`${item.quantity} x ${item.unitPrice.toFixed(2)}`, 4, y);
    doc.text(item.totalPrice.toFixed(2), right, y, { align: 'right' });
    y += 4.5;
  });

  doc.line(4, y, right, y);
  y += 4;
  doc.setFont('courier', 'bold');
  doc.text('TOTAL', 4, y);
  doc.text(`R$ ${sale.total.toFixed(2)}`, right, y, { align: 'right' });
  y += 4;

  doc.setFont('courier', 'normal');
  const paymentLabel = paymentMap[sale.paymentMethod] || sale.paymentMethod.toUpperCase();
  doc.text(`Pagamento: ${paymentLabel}`, 4, y);
  y += 4;

  if (sale.change && sale.change > 0) {
    doc.text(`Troco: R$ ${sale.change.toFixed(2)}`, 4, y);
    y += 4;
  }

  doc.line(4, y, right, y);
  y += 4;
  doc.setFontSize(6);
  doc.text('NAO E DOCUMENTO FISCAL', width / 2, y, { align: 'center' });
  y += 3;
  doc.text('Obrigado pela preferencia!', width / 2, y, { align: 'center' });

  const fileName = `Cupom_${sale.id.substring(0, 6)}.pdf`;
  if (action === 'print') {
    openJsPdfForPrint(doc);
  } else {
    doc.save(fileName);
  }
};

export const generateReceiptPDF = async (sale: Sale, settings: any, action: 'download' | 'print' = 'print', returnBuffer = false) => {
  const doc = new jsPDF({ orientation: 'landscape', format: 'a5' });
  
  // Linha divisória vertical
  doc.setLineDashPattern([2, 1], 0);
  doc.line(70, 0, 70, doc.internal.pageSize.getHeight());
  doc.setLineDashPattern([], 0);

  // Parte Esquerda (Recibo de Entrada)
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Recibo de Entrada', 35, 15, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Cliente: ${sale.customerName || 'Avulso'}`, 10, 25);
  doc.text(`Valor: R$ ${sale.total.toFixed(2)}`, 10, 35);
  doc.text(`Serviço: ${sale.items[0]?.name.substring(0,25)}...`, 10, 45);
  doc.line(10, 70, 60, 70);
  doc.text('Ass. Funcionário', 35, 75, { align: 'center' });
  doc.line(10, 90, 60, 90);
  doc.text('Ass. Cliente', 35, 95, { align: 'center' });

  // Parte Direita (Recibo Principal)
  if (settings.logo) doc.addImage(settings.logo, 'PNG', 75, 5, 20, 20);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(settings.systemName || 'LAN HOUSE GAMER', 100, 15);
  doc.setFontSize(7);
  doc.text('CNPJ: 59.521.108/0001-66', 100, 20);
  
  doc.setFontSize(10);
  doc.text(`Recebi de ____________________________ portador do CPF _________________`, 75, 40);
  doc.text(`${sale.customerName || ''}`, 95, 39);
  doc.text(`a importância de R$ ${sale.total.toFixed(2)} referente a ${sale.items[0]?.name}`, 75, 50);
  
  doc.text('Forma de pagamento:', 120, 70);
  doc.text(`( ${sale.paymentMethod === 'pix' ? 'x' : ' '} ) Pix  ( ${sale.paymentMethod === 'cash' ? 'x' : ' '} ) Dinheiro  ( ${sale.paymentMethod === 'card' ? 'x' : ' '} ) Cartão`, 120, 75, { align: 'center' });

  const fileName = `Recibo_${sale.id.substring(0,6)}.pdf`;
  
  if (returnBuffer) {
    return doc.output('arraybuffer');
  }
  
  if (action === 'print') {
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
  } else {
    doc.save(fileName);
  }
};

import JSZip from 'jszip';

export const downloadFullOSZip = async (
  os: ServiceOrder,
  settings: any,
  budget?: Budget,
  saleMock?: Sale
) => {
  const zip = new JSZip();

  // 1. PDF da OS principal
  const osPdfBuffer = await generateOSPDF(os, settings, 'download', true);
  zip.file(`OS-${os.externalId || os.id.substring(0,6)}.pdf`, osPdfBuffer as ArrayBuffer);

  // 2. Orçamento (se existir na call)
  if (budget) {
    const budgetPdfBuffer = await generateBudgetPDF(budget, settings, 'download', true);
    zip.file(`Orcamento-${budget.externalId || budget.id.substring(0,6)}.pdf`, budgetPdfBuffer as ArrayBuffer);
  }

  // 3. Contrato
  if (os.contract) {
    const contractPdfBuffer = await generateContractPDF(os, settings, 'download', true);
    zip.file(`Contrato-${os.externalId || os.id.substring(0,6)}.pdf`, contractPdfBuffer as ArrayBuffer);
  }

  // 4. Recibo de Pagamento (se já tiver recebimentos)
  if (saleMock && os.paymentSummary && os.paymentSummary.paid > 0) {
    const receiptPdfBuffer = await generateReceiptPDF(saleMock, settings, 'download', true);
    zip.file(`Recibo-${os.externalId || os.id.substring(0,6)}.pdf`, receiptPdfBuffer as ArrayBuffer);
  }

  // 5. Todos os Anexos Salvos via API docs
  if (os.attachmentsByCategory && typeof window !== 'undefined' && window.lhgSystem?.docs?.read) {
    for (const [category, arr] of Object.entries(os.attachmentsByCategory)) {
      for (const att of arr) {
         try {
           const res = await window.lhgSystem.docs.read(att.filename);
           if (res.ok && res.data) {
              const safeCat = String(category).toLowerCase();
              zip.file(`Anexos/${safeCat}/${att.originalName}`, res.data);
           }
         } catch (e) {
           console.error("Falha ao ler anexo no zip:", att.filename, e);
         }
      }
    }
  }

  // 6. Gerar e baixar o ZIP
  const content = await zip.generateAsync({ type: "blob" });
  const url = window.URL.createObjectURL(content);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Pacote_Completo_OS_${os.externalId || os.id.substring(0,6)}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};

export const generateInstallmentBookletPDF = async (sale: Sale, settings: any) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  if (!sale.installments) return;

  sale.installments.forEach((inst, index) => {
    if (index > 0 && index % 3 === 0) doc.addPage();
    
    const yOffset = (index % 3) * 90;
    
    // Borda do canhoto
    doc.setDrawColor(200, 200, 200);
    doc.rect(10, 10 + yOffset, 60, 80);
    
    // Borda do recibo
    doc.rect(75, 10 + yOffset, pageWidth - 85, 80);
    
    // Conteúdo Canhoto
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(`PARCELA ${inst.number}/${sale.installments!.length}`, 15, 20 + yOffset);
    doc.setFont('helvetica', 'normal');
    doc.text(`Venc: ${format(new Date(inst.dueDate), 'dd/MM/yyyy')}`, 15, 30 + yOffset);
    doc.text(`Valor: R$ ${inst.amount.toFixed(2)}`, 15, 40 + yOffset);
    doc.text(`Venda: ${sale.id.substring(0,8)}`, 15, 50 + yOffset);
    
    // Conteúdo Principal
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(settings.systemName || 'LAN HOUSE GAMER', 80, 22 + yOffset);
    doc.setFontSize(8);
    doc.text(`RECIBO DE PAGAMENTO - PARCELA ${inst.number}`, 80, 28 + yOffset);
    
    doc.setFont('helvetica', 'normal');
    doc.text(`Recebemos de: ${sale.customerName || '____________________________________'}`, 80, 40 + yOffset);
    doc.text(`A importância de: R$ ${inst.amount.toFixed(2)}`, 80, 50 + yOffset);
    doc.text(`Referente a parcela ${inst.number} da venda #${sale.id.substring(0,8)}`, 80, 60 + yOffset);
    doc.text(`Vencimento: ${format(new Date(inst.dueDate), 'dd/MM/yyyy')}`, 80, 70 + yOffset);
    
    doc.line(80, 85 + yOffset, 140, 85 + yOffset);
    doc.text('Assinatura do Recebedor', 110, 88 + yOffset, { align: 'center' });
    
    doc.setFontSize(6);
    doc.text('Não rasurar. Este recibo é a garantia de sua quitação.', 110, 5 + yOffset, { align: 'center' });
  });

  doc.save(`Carne_${sale.id.substring(0,6)}.pdf`);
};

export const generateServiceReceiptPDF = async (receipt: Receipt, settings: any, action: 'download' | 'print' = 'print') => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  drawHeader(doc, settings);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(`RECIBO ${receipt.receiptNumber}`, pageWidth / 2, 48, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Data: ${format(new Date(receipt.issuedAt), 'dd/MM/yyyy HH:mm')}`, 15, 60);
  doc.text(`OS: ${receipt.osId}`, 15, 66);
  doc.text(`Cliente: ${receipt.customerName}`, 15, 74);
  doc.text(`CPF: ${formatCPF(receipt.customerCPF) || '---'}`, 15, 80);
  doc.text(`Valor: R$ ${receipt.amount.toFixed(2)}`, 15, 88);
  doc.text(`Valor por extenso: ${receipt.amountInWords}`, 15, 94);
  doc.text(`Forma de pagamento: ${receipt.paymentMethod.toUpperCase()}`, 15, 102);
  if (receipt.installmentLabel) {
    doc.text(`Parcela: ${receipt.installmentLabel}`, 15, 108);
  }
  doc.text(receipt.description, 15, 118);
  doc.line(15, 250, 90, 250);
  doc.text('Assinatura do recebedor', 52, 255, { align: 'center' });
  doc.line(pageWidth - 90, 250, pageWidth - 15, 250);
  doc.text('Assinatura do cliente', pageWidth - 52, 255, { align: 'center' });
  const fileName = `Recibo_OS_${receipt.receiptNumber}.pdf`;
  if (action === 'print') {
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
  } else {
    doc.save(fileName);
  }
};
