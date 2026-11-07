import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Protege dos reglas de AGENTS.md y de la nota 010: un módulo solo importa la
// interfaz pública (index.ts) de otro, y la raíz de composición solo cablea.
const RAIZ = path.resolve(__dirname);
const MODULOS = path.join(RAIZ, "modules");

function archivosTs(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const ruta = path.join(dir, e.name);
    if (e.isDirectory()) return archivosTs(ruta);
    return e.name.endsWith(".ts") && !e.name.endsWith(".test.ts") ? [ruta] : [];
  });
}

describe("arquitectura", () => {
  it("ningún módulo importa archivos internos de otro módulo", () => {
    const violaciones: string[] = [];
    for (const modulo of fs.readdirSync(MODULOS)) {
      for (const archivo of archivosTs(path.join(MODULOS, modulo))) {
        const importes = fs.readFileSync(archivo, "utf-8").matchAll(/from\s+"(\.[^"]*)"/g);
        for (const [, relativa] of importes) {
          const destino = path.resolve(path.dirname(archivo), relativa);
          const partes = path.relative(MODULOS, destino).split(path.sep);
          const [otro, ...resto] = partes;
          const esOtroModulo = !partes[0].startsWith("..") && otro !== modulo;
          const esIndice = resto.length === 0 || (resto.length === 1 && resto[0] === "index");
          if (esOtroModulo && !esIndice) {
            violaciones.push(`${path.relative(RAIZ, archivo)} importa ${relativa}`);
          }
        }
      }
    }
    expect(violaciones).toEqual([]);
  });

  it("composition-root.ts no contiene SQL", () => {
    const texto = fs.readFileSync(path.join(RAIZ, "composition-root.ts"), "utf-8");
    expect(texto).not.toMatch(/\b(SELECT|INSERT|UPDATE|DELETE|JOIN)\b|\bFROM\s/);
  });
});
