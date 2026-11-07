// Convierte cada docs/diagramas/*.d2 en un SVG al lado, con el mismo nombre.
// Los SVG se versionan: GitHub los muestra dentro del Markdown y el PDF los
// toma de ahí. Uso: pnpm --filter @plomada/docs diagramas [nombre ...]

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { D2 } from "@terrastruct/d2";

const carpeta = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "diagramas",
);
const ESTILO = "estilo.d2";

async function main(): Promise<void> {
  const pedidos = process.argv.slice(2);
  const archivos = (await readdir(carpeta))
    .filter((f) => f.endsWith(".d2") && f !== ESTILO)
    .filter(
      (f) => pedidos.length === 0 || pedidos.includes(f.replace(/\.d2$/, "")),
    );

  const estilo = await readFile(join(carpeta, ESTILO), "utf8");
  const d2 = new D2();
  let fallos = 0;

  for (const archivo of archivos) {
    const fuente = await readFile(join(carpeta, archivo), "utf8");
    try {
      const resultado = await d2.compile({
        fs: { [archivo]: fuente, [ESTILO]: estilo },
        inputPath: archivo,
        options: { layout: "elk", themeID: 0, pad: 16 },
      });
      const svg = await d2.render(resultado.diagram, {
        ...resultado.renderOptions,
        pad: 16,
        scale: 1,
        salt: archivo.replace(/\.d2$/, ""),
      });
      await writeFile(join(carpeta, archivo.replace(/\.d2$/, ".svg")), svg);
      console.log(`ok     ${archivo}`);
    } catch (error) {
      fallos++;
      console.error(`error  ${archivo}\n${String(error)}`);
    }
  }

  // El compilador de D2 deja un worker vivo; sin salir explícitamente el
  // proceso no termina nunca.
  process.exit(fallos === 0 ? 0 : 1);
}

void main();
