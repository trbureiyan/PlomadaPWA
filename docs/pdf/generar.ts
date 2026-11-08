// Genera docs/pdf/salida/plomada-arquitectura.pdf a partir de docs/arquitectura.md.
//
// Pasos: 1) arma el Markdown final (quita lo marcado como solo-repositorio e
// incluye las notas de decisión y el glosario), 2) lo convierte a HTML con la
// hoja de estilos del documento, 3) imprime con Chromium dos veces: la primera
// para saber en qué página cae cada título y la segunda con el índice ya
// numerado, y 4) antepone la portada, que va sin número de página.
//
// Uso: pnpm --filter @plomada/docs pdf

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { Marked, type Tokens } from "marked";
import { chromium, type Browser } from "playwright-core";
import { PDFDocument } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const aqui = dirname(fileURLToPath(import.meta.url));
const docs = resolve(aqui, "..");
const salida = join(aqui, "salida");
const require = createRequire(import.meta.url);

// Datos de la portada. Se editan aquí y en ningún otro lugar.
const PORTADA = {
  institucion: "Universidad Surcolombiana",
  unidad: "Facultad de Ingeniería · Programa de Ingeniería de Software",
  tipo: "Documento de arquitectura de software (SAD)",
  titulo: "Plomada",
  subtitulo:
    "Programación semanal, jornada y evidencia fotográfica para el mantenimiento locativo de conjuntos cerrados",
  curso: "Ingeniería de Software Orientada a Objetos",
  docente: "Eduardo Martínez Vidal",
  estudiantes: [
    "Brayan Toro Bustos",
    "Juan Camilo Mora Castañeda",
    "Pablo Trujillo Artunduaga",
  ],
  lugar: "Neiva",
  estado: "1.0",
};

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

// ---------------------------------------------------------------- Markdown

async function armarMarkdown(): Promise<string> {
  let md = await readFile(join(docs, "arquitectura.md"), "utf8");

  md = md.replace(/<!-- pdf:omitir -->[\s\S]*?<!-- \/pdf:omitir -->\n?/g, "");
  md = md.replace("<!-- pdf:incluir decisiones -->", await notasDeDecision());
  md = md.replace("<!-- pdf:incluir glosario -->", await glosario());
  // El título del archivo es para GitHub; en el PDF lo reemplaza la portada.
  md = md.replace(/^# .*\n/, "");
  return md;
}

async function notasDeDecision(): Promise<string> {
  const carpeta = join(docs, "decisiones");
  const notas = (await readdir(carpeta))
    .filter((f) => /^\d{3}-.*\.md$/.test(f))
    .sort();
  const partes: string[] = [];
  for (const nota of notas) {
    let texto = await readFile(join(carpeta, nota), "utf8");
    texto = texto
      .replace(/^# (.*)$/m, "### $1")
      .replace(/^## (.*)$/gm, "#### $1")
      .replace(/^Responsable: .*$/m, (linea) => `<p class="meta">${linea}</p>`);
    partes.push(enlacesComoTexto(texto));
  }
  return partes.join("\n\n");
}

async function glosario(): Promise<string> {
  let texto = await readFile(join(docs, "glosario.md"), "utf8");
  texto = texto
    .replace(/^## (.*)$/gm, "### $1")
    .replace(/^# Glosario$/m, "## Anexo B. Glosario");
  return enlacesComoTexto(texto);
}

// En papel un enlace a otro archivo del repositorio no sirve; queda el texto.
function enlacesComoTexto(md: string): string {
  return md.replace(/\[([^\]]+)\]\((?!https?:)[^)]+\)/g, "$1");
}

// ---------------------------------------------------------------- HTML

interface Titulo {
  nivel: number;
  texto: string;
  id: string;
}

function slug(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function aHtml(md: string): { cuerpo: string; titulos: Titulo[] } {
  const titulos: Titulo[] = [];
  let figura = 0;
  const marked = new Marked({ gfm: true });

  marked.use({
    renderer: {
      heading(
        this: { parser: { parseInline(t: Tokens.Generic[]): string } },
        token: Tokens.Heading,
      ) {
        const html = this.parser.parseInline(token.tokens);
        const texto = token.text.replace(/`/g, "");
        if (token.depth > 3)
          return `<h${token.depth}>${html}</h${token.depth}>\n`;
        const id = `t${titulos.length}-${slug(texto)}`;
        titulos.push({ nivel: token.depth, texto, id });
        // La marca invisible permite encontrar en el PDF la página del título.
        const marca = `<span class="marca">QQ${titulos.length - 1}QQ</span>`;
        return `<h${token.depth} id="${id}">${marca}${html}</h${token.depth}>\n`;
      },
      image(token: Tokens.Image) {
        figura++;
        const src = pathToFileURL(join(docs, token.href)).href;
        return (
          `<figure><img src="${src}" alt="${token.text}">` +
          `<figcaption>Figura ${figura}. ${token.text}</figcaption></figure>`
        );
      },
      blockquote(
        this: { parser: { parse(t: Tokens.Generic[]): string } },
        token: Tokens.Blockquote,
      ) {
        return `<aside class="pendiente">${this.parser.parse(token.tokens)}</aside>\n`;
      },
    },
  });

  let cuerpo = marked.parse(md, { async: false });
  // Una figura sola en su párrafo no debe quedar envuelta en <p>.
  cuerpo = cuerpo.replace(/<p>(<figure>[\s\S]*?<\/figure>)<\/p>/g, "$1");
  // Las fichas de dos columnas (escenarios) llevan su propio estilo.
  cuerpo = cuerpo.replace(
    /<table>\n<thead>\n<tr>\n<th>(Parte|Campo)<\/th>/g,
    '<table class="ficha">\n<thead>\n<tr>\n<th>$1</th>',
  );
  return { cuerpo, titulos };
}

function fuente(paquete: string, archivo: string): string {
  const ruta = require.resolve(`${paquete}/files/${archivo}`);
  return pathToFileURL(ruta).href;
}

function hojaDeEstilos(): string {
  const caras = [
    [
      "Serif",
      "@fontsource/source-serif-4",
      "source-serif-4-latin-400-normal.woff2",
      400,
      "normal",
    ],
    [
      "Serif",
      "@fontsource/source-serif-4",
      "source-serif-4-latin-400-italic.woff2",
      400,
      "italic",
    ],
    [
      "Serif",
      "@fontsource/source-serif-4",
      "source-serif-4-latin-600-normal.woff2",
      600,
      "normal",
    ],
    [
      "Serif",
      "@fontsource/source-serif-4",
      "source-serif-4-latin-700-normal.woff2",
      700,
      "normal",
    ],
    [
      "Sans",
      "@fontsource/source-sans-3",
      "source-sans-3-latin-400-normal.woff2",
      400,
      "normal",
    ],
    [
      "Sans",
      "@fontsource/source-sans-3",
      "source-sans-3-latin-600-normal.woff2",
      600,
      "normal",
    ],
    [
      "Sans",
      "@fontsource/source-sans-3",
      "source-sans-3-latin-700-normal.woff2",
      700,
      "normal",
    ],
    [
      "Mono",
      "@fontsource/source-code-pro",
      "source-code-pro-latin-400-normal.woff2",
      400,
      "normal",
    ],
  ] as const;
  const fontFaces = caras
    .map(
      ([familia, paquete, archivo, peso, estilo]) =>
        `@font-face{font-family:"Plomada ${familia}";src:url("${fuente(paquete, archivo)}") format("woff2");font-weight:${peso};font-style:${estilo};}`,
    )
    .join("\n");
  return `${fontFaces}\n${ESTILOS}`;
}

const ESTILOS = /* css */ `
:root {
  --tinta: #1f2933;
  --tenue: #52606d;
  --acento: #1f3a5f;
  --linea: #d9e2ec;
  --fondo: #f5f7fa;
}
@page { size: Letter; margin: 24mm 22mm 22mm 22mm; }
* { box-sizing: border-box; }
html { font-family: "Plomada Serif", Georgia, serif; font-size: 10.4pt; color: var(--tinta); }
body { margin: 0; line-height: 1.5; }
p, li { orphans: 3; widows: 3; }
p { margin: 0 0 0.7em; }
strong { font-weight: 600; }
code { font-family: "Plomada Mono", monospace; font-size: 0.86em; background: var(--fondo); padding: 0.05em 0.3em; border-radius: 3px; }
h1, h2, h3, h4 { font-family: "Plomada Sans", sans-serif; color: var(--acento); line-height: 1.25; break-after: avoid; position: relative; }
h2 { font-size: 19pt; font-weight: 600; margin: 0 0 0.9em; padding-bottom: 0.35em; border-bottom: 1px solid var(--acento); break-before: page; }
h3 { font-size: 12.5pt; font-weight: 600; margin: 1.5em 0 0.5em; }
h4 { font-size: 10.6pt; font-weight: 600; margin: 1.1em 0 0.35em; color: var(--tinta); }
.marca { position: absolute; left: 0; top: 0; font-size: 2px; color: #fff; }
ol, ul { padding-left: 1.4em; margin: 0 0 0.8em; }
li { margin-bottom: 0.25em; }

table { width: 100%; border-collapse: collapse; margin: 0.4em 0 1.1em; font-family: "Plomada Sans", sans-serif; font-size: 8.9pt; line-height: 1.35; }
thead { display: table-header-group; }
tr { break-inside: avoid; }
th { text-align: left; font-weight: 600; color: var(--acento); background: var(--fondo); border-bottom: 1px solid var(--acento); padding: 5px 7px; vertical-align: bottom; }
td { border-bottom: 1px solid var(--linea); padding: 5px 7px; vertical-align: top; }
td code, th code { font-size: 0.92em; }
table.ficha { break-inside: avoid; }
table.ficha thead { display: none; }
table.ficha td:first-child { width: 27%; font-weight: 600; color: var(--tenue); }
p:has(+ table.ficha) { break-after: avoid; margin-bottom: 0.3em; }

figure { margin: 1em 0 1.3em; text-align: center; break-inside: avoid; }
figure img { display: block; width: 100%; height: auto; max-height: 196mm; object-fit: contain; }
figcaption { font-family: "Plomada Sans", sans-serif; font-size: 8.8pt; color: var(--tenue); margin-top: 0.5em; }

aside.pendiente { border-left: 3px solid #b8a76a; background: #fffdf5; padding: 0.7em 1em; margin: 0.6em 0 1.2em; font-size: 9.8pt; }
aside.pendiente p:last-child { margin-bottom: 0; }
p.meta { font-family: "Plomada Sans", sans-serif; font-size: 8.8pt; color: var(--tenue); }

/* Índice */
.indice h2 { break-before: auto; }
.indice ol { list-style: none; padding: 0; margin: 0; font-family: "Plomada Sans", sans-serif; }
.indice li { display: flex; align-items: baseline; gap: 6px; margin: 0; padding: 3px 0; }
.indice li.n2 { font-weight: 600; color: var(--acento); margin-top: 7px; }
.indice li.n3 { padding-left: 1.4em; font-size: 9.6pt; color: var(--tinta); }
.indice .relleno { flex: 1; border-bottom: 1px dotted #bcccdc; transform: translateY(-3px); }
.indice .pagina { min-width: 2.2em; text-align: right; font-variant-numeric: tabular-nums; }

/* Portada */
.portada { height: 100vh; display: flex; flex-direction: column; font-family: "Plomada Sans", sans-serif; }
.portada .institucion { font-size: 12pt; font-weight: 600; color: var(--acento); letter-spacing: 0.02em; }
.portada .unidad { font-size: 10pt; color: var(--tenue); margin-top: 2px; }
.portada .centro { margin-top: 62mm; }
.portada .tipo { font-size: 10.5pt; text-transform: uppercase; letter-spacing: 0.14em; color: var(--tenue); }
.portada .titulo { font-family: "Plomada Serif", serif; font-size: 46pt; font-weight: 600; color: var(--acento); margin: 6mm 0 4mm; line-height: 1; }
.portada .subtitulo { font-family: "Plomada Serif", serif; font-size: 14pt; line-height: 1.4; color: var(--tinta); max-width: 135mm; }
.portada .regla { width: 28mm; height: 2px; background: var(--acento); margin: 10mm 0 0; }
.portada .datos { margin-top: auto; display: grid; grid-template-columns: 34mm 1fr; row-gap: 3.2mm; font-size: 10pt; }
.portada .datos dt { color: var(--tenue); }
.portada .datos dd { margin: 0; color: var(--tinta); }
`;

function documentoHtml(contenido: string): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Plomada · Documento de arquitectura</title><style>${hojaDeEstilos()}</style></head><body>${contenido}</body></html>`;
}

function portadaHtml(fecha: string): string {
  const p = PORTADA;
  return `<section class="portada">
  <div class="institucion">${p.institucion}</div>
  <div class="unidad">${p.unidad}</div>
  <div class="centro">
    <div class="tipo">${p.tipo}</div>
    <div class="titulo">${p.titulo}</div>
    <div class="subtitulo">${p.subtitulo}</div>
    <div class="regla"></div>
  </div>
  <dl class="datos">
    <dt>Curso</dt><dd>${p.curso}</dd>
    <dt>Docente</dt><dd>${p.docente}</dd>
    <dt>Estudiantes</dt><dd>${p.estudiantes.join("<br>")}</dd>
    <dt>Lugar y fecha</dt><dd>${p.lugar}, ${fecha}</dd>
    <dt>Versión</dt><dd>${p.estado}</dd>
  </dl>
</section>`;
}

function indiceHtml(titulos: Titulo[], paginas: Map<number, number>): string {
  const filas = titulos
    .map((t, i) => {
      const pagina = paginas.get(i);
      return `<li class="n${t.nivel}"><span>${escapar(t.texto)}</span><span class="relleno"></span><span class="pagina">${pagina ?? "00"}</span></li>`;
    })
    .join("\n");
  return `<section class="indice"><h2>Contenido</h2><ol>${filas}</ol></section>`;
}

function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ---------------------------------------------------------------- PDF

const PIE = `
<style>
.pie{width:100%;font-family:"Helvetica Neue",Arial,sans-serif;font-size:7.5pt;color:#7b8794;padding:0 22mm;display:flex;justify-content:space-between;}
</style>
<div class="pie"><span>Plomada · Documento de arquitectura de software</span><span class="pageNumber"></span></div>`;

async function abrirNavegador(): Promise<Browser> {
  // En la máquina de cada integrante sirve el Chrome o el Edge ya instalado;
  // así nadie tiene que descargar un navegador solo para generar el PDF.
  const intentos: Array<() => Promise<Browser>> = [
    () => chromium.launch(),
    () => chromium.launch({ channel: "chrome" }),
    () => chromium.launch({ channel: "msedge" }),
  ];
  for (const intento of intentos) {
    try {
      return await intento();
    } catch {
      // se prueba el siguiente
    }
  }
  throw new Error(
    "No se encontró Chromium, Chrome ni Edge para generar el PDF.",
  );
}

async function imprimir(
  navegador: Browser,
  html: string,
  nombre: string,
  conPie: boolean,
): Promise<Uint8Array> {
  const archivo = join(salida, `${nombre}.html`);
  await writeFile(archivo, html);
  const pagina = await navegador.newPage();
  await pagina.goto(pathToFileURL(archivo).href, { waitUntil: "load" });
  await pagina.evaluate(() => document.fonts.ready);
  const pdf = await pagina.pdf({
    format: "Letter",
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: conPie,
    headerTemplate: "<span></span>",
    footerTemplate: conPie ? PIE : "<span></span>",
  });
  await pagina.close();
  return pdf;
}

async function paginasDeTitulos(pdf: Uint8Array): Promise<Map<number, number>> {
  const documento = await getDocument({ data: new Uint8Array(pdf) }).promise;
  const paginas = new Map<number, number>();
  for (let n = 1; n <= documento.numPages; n++) {
    const contenido = await (await documento.getPage(n)).getTextContent();
    const texto = contenido.items
      .map((item) => ("str" in item ? item.str : ""))
      .join("");
    for (const encontrado of texto.matchAll(/QQ(\d+)QQ/g)) {
      const indice = Number(encontrado[1]);
      if (!paginas.has(indice)) paginas.set(indice, n);
    }
  }
  return paginas;
}

async function main(): Promise<void> {
  await mkdir(salida, { recursive: true });
  const ahora = new Date();
  const fecha = `${MESES[ahora.getMonth()]} de ${ahora.getFullYear()}`;

  const { cuerpo, titulos } = aHtml(await armarMarkdown());
  const navegador = await abrirNavegador();
  try {
    // Primera pasada: índice con números provisionales del mismo ancho.
    const borrador = await imprimir(
      navegador,
      documentoHtml(indiceHtml(titulos, new Map()) + cuerpo),
      "cuerpo",
      true,
    );
    const paginas = await paginasDeTitulos(borrador);
    const faltan = titulos
      .filter((_, i) => !paginas.has(i))
      .map((t) => t.texto);
    if (faltan.length > 0)
      console.warn(`Títulos sin página encontrada: ${faltan.join(", ")}`);

    // Segunda pasada: mismas páginas, índice ya numerado.
    const cuerpoPdf = await imprimir(
      navegador,
      documentoHtml(indiceHtml(titulos, paginas) + cuerpo),
      "cuerpo",
      true,
    );
    const portadaPdf = await imprimir(
      navegador,
      documentoHtml(portadaHtml(fecha)),
      "portada",
      false,
    );

    const final = await PDFDocument.create();
    for (const parte of [portadaPdf, cuerpoPdf]) {
      const origen = await PDFDocument.load(parte);
      const copias = await final.copyPages(origen, origen.getPageIndices());
      copias.forEach((p) => final.addPage(p));
    }
    final.setTitle("Plomada · Documento de arquitectura de software");
    final.setAuthor(PORTADA.estudiantes.join(", "));
    final.setSubject(PORTADA.curso);
    final.setLanguage("es-CO");

    const destino = join(salida, "plomada-arquitectura.pdf");
    await writeFile(destino, await final.save());
    console.log(`PDF generado: ${destino} (${final.getPageCount()} páginas)`);
  } finally {
    await navegador.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
