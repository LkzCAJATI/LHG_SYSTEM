const fs = require("fs");
const path = require("path");

const packageJsonPath = path.resolve(__dirname, "..", "package.json");
const raw = fs.readFileSync(packageJsonPath, "utf8");
const pkg = JSON.parse(raw);

const current = String(pkg.buildVersion || "1.0.0.1");
const parts = current.split(".").map((part) => Number(part));

if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0)) {
  throw new Error(`buildVersion invalida: "${current}". Use formato X.Y.Z.N`);
}

parts[3] += 1;
pkg.buildVersion = parts.join(".");

fs.writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
console.log(`buildVersion atualizada para ${pkg.buildVersion}`);
