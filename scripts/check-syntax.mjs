// Comprobación de sintaxis (sin instalar nada, solo Node, que ya trae
// GitHub Actions) para pillar un error de escritura ANTES de subir
// index.html o cualquier api/*.js — el fallo típico de tocar el
// archivo a mano y dejar una llave o una coma de más/menos.
//
// Para correrlo en tu Mac (si alguna vez instalas Node): node scripts/check-syntax.mjs
// GitHub Actions lo corre solo en cada push (ver .github/workflows/check.yml).

import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

function checkSource(label, code) {
  try {
    execFileSync("node", ["--input-type=module", "--check"], {
      input: code,
      stdio: ["pipe", "inherit", "inherit"],
    });
    console.log(`OK    ${label}`);
  } catch {
    console.error(`FALLO ${label}`);
    process.exitCode = 1;
  }
}

function collectJsFiles(dir) {
  let files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files = files.concat(collectJsFiles(full));
    else if (entry.name.endsWith(".js")) files.push(full);
  }
  return files;
}

const html = readFileSync("index.html", "utf8");
const match = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
if (!match) {
  console.error("No se encontró el <script> principal en index.html (¿se movió o se borró?).");
  process.exitCode = 1;
} else {
  checkSource("index.html (<script>)", match[1]);
}

for (const file of collectJsFiles("api")) {
  checkSource(file, readFileSync(file, "utf8"));
}
