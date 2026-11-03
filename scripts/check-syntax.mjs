// Comprobación de sintaxis (sin instalar nada, solo Node, que ya trae
// GitHub Actions) para pillar un error de escritura ANTES de que llegue a
// producción: el fallo típico de tocar un archivo a mano y dejar una
// llave o una coma de más/menos.
//
// Revisa: el <script> propio de CADA página .html, common.js, ui.js y
// todas las funciones de api/.
//
// Para correrlo en local: node scripts/check-syntax.mjs
// GitHub Actions lo corre solo en cada push (ver .github/workflows/check.yml).

import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

function checkSource(label, code, type = "module") {
  try {
    execFileSync("node", [`--input-type=${type}`, "--check"], { input: code, stdio: ["pipe", "inherit", "inherit"] });
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

// Scripts de página: se comprueban como "commonjs" (script clásico del
// navegador, no módulo) y concatenados detrás de common.js + ui.js, igual
// que los ejecuta el navegador — así también salta si una página redeclara
// una constante global que ya existe en los archivos compartidos.
const shared = readFileSync("common.js", "utf8") + "\n" + readFileSync("ui.js", "utf8");
checkSource("common.js + ui.js", shared, "commonjs");
for (const file of readdirSync(".").filter((f) => f.endsWith(".html")).sort()) {
  const html = readFileSync(file, "utf8");
  const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");
  if (inline.trim()) checkSource(file, shared + "\n" + inline, "commonjs");
}
for (const file of collectJsFiles("api")) {
  checkSource(file, readFileSync(file, "utf8"));
}
