const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const packageJsonPath = path.resolve(__dirname, "..", "package.json");
const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

const current = String(pkg.buildVersion || "1.0.0.1");
const parts = current.split(".").map((part) => Number(part));

if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0)) {
  throw new Error(`buildVersion invalida: "${current}". Use formato X.Y.Z.N`);
}

parts[3] += 1;
pkg.buildVersion = parts.join(".");
// Keep semantic app version moving forward for installer/update comparison.
pkg.version = `${parts[0]}.${parts[1]}.${parts[3]}`;
fs.writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");

const publish = process.argv.includes("--publish");
const env = { ...process.env, BUILD_VERSION: pkg.buildVersion };

console.log(`buildVersion atualizada para ${pkg.buildVersion}`);
console.log(`version semver atualizada para ${pkg.version}`);

const viteResult = spawnSync("npx", ["vite", "build"], {
  stdio: "inherit",
  env,
  shell: true
});

if (viteResult.status !== 0) {
  process.exit(viteResult.status || 1);
}

const ebArgs = ["electron-builder", "--win"];
if (publish) {
  ebArgs.push("--publish", "always");
}

const ebResult = spawnSync("npx", ebArgs, {
  stdio: "inherit",
  env,
  shell: true
});

process.exit(ebResult.status || 0);
