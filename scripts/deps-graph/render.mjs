/**
 * DOT → SVG → HTML.
 *
 * SVG рисует Graphviz, собранный в WebAssembly (`@hpcc-js/wasm-graphviz`): системный
 * Graphviz не нужен ни разработчику, ни CI. HTML — страница dependency-cruiser'а
 * (`depcruise-wrap-stream-in-html`): наведение подсвечивает связи узла, правый клик
 * закрепляет подсветку, Esc снимает.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Graphviz } from '@hpcc-js/wasm-graphviz';

let graphviz = null;

/** @param {string} dot */
export async function renderSvg(dot) {
  graphviz ??= await Graphviz.load();
  try {
    return graphviz.dot(dot, 'svg');
  } catch (error) {
    // Слияние рёбер у dot на графах с кластерами изредка падает — тогда рисуем без него.
    if (!dot.includes('concentrate="true"')) throw error;
    return graphviz.dot(dot.replace('concentrate="true", ', ''), 'svg');
  }
}

/** Точка входа пакета — `src/main/index.mjs`, бинарники лежат в `bin/` его корня. */
function wrapperBin() {
  const main = fileURLToPath(import.meta.resolve('dependency-cruiser'));
  return path.resolve(path.dirname(main), '../../bin/wrap-stream-in-html.mjs');
}

const escapeHtml = (s) =>
  String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

/**
 * @param {string} svg
 * @param {string} title заголовок вкладки браузера
 */
export function wrapInHtml(svg, title) {
  const run = spawnSync(process.execPath, [wrapperBin()], {
    input: svg,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 1024,
  });
  if (run.status !== 0) {
    throw new Error(`depcruise-wrap-stream-in-html: ${run.stderr || run.error?.message}`);
  }
  return run.stdout
    .replace('<html lang="en"', '<html lang="ru"')
    .replace('<title>dependency graph</title>', `<title>${escapeHtml(title)}</title>`);
}

/**
 * Пишет `<base>.dot`, `<base>.svg` и `<base>.html` в каталог `dir`.
 *
 * @returns {Promise<string>} путь к HTML
 */
export async function writeGraph(dir, base, dot, title) {
  fs.mkdirSync(dir, { recursive: true });
  const svg = await renderSvg(dot);
  const html = path.join(dir, `${base}.html`);
  fs.writeFileSync(path.join(dir, `${base}.dot`), dot);
  fs.writeFileSync(path.join(dir, `${base}.svg`), svg);
  fs.writeFileSync(html, wrapInHtml(svg, title));
  return html;
}
