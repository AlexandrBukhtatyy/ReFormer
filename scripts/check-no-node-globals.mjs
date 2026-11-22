/**
 * Проверка: в собранных браузерных бандлах нет node-глобалей.
 *
 * `process.env.NODE_ENV` — самый частый способ отличить dev от prod, и в приложении со сборщиком
 * он работает: бандлер его подставляет. Но пакет, загруженный как ГОЛЫЙ ESM (import map,
 * web-component, Module Federation без прогона через define) получает `ReferenceError:
 * process is not defined` — то есть падает не там, где ошибка, и не с тем сообщением.
 *
 * Проверка узкая намеренно: она смотрит только те пакеты, которые обязаны работать без сборщика.
 *
 * Модуль же отдаёт саму проверку (`checkNoNodeGlobals`) другим наборам каталогов.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * Пакеты и каталоги, обязанные работать без Node.
 *
 * `@reformer/form-registry` — потому что его грузят голым ESM (import map, web-component,
 * Module Federation), где `process` не определён.
 *
 * `@reformer/form-intent` — потому что печать правил вкладывается в плагины билдера, а они
 * исполняются в браузере.
 *
 * `@reformer/mcp` — клиент MCP, он запускается под Node, и проверяется только его `dist/contract`:
 * контракт протокола и типы рабочей области обязаны оставаться чистыми — их импортирует сторона
 * сервиса, в том числе собранная в браузер.
 */
const TARGETS = [
  { name: '@reformer/form-registry', dir: 'packages/reformer-form-registry/dist' },
  { name: '@reformer/form-intent', dir: 'packages/reformer-form-intent/dist' },
  { name: '@reformer/mcp (contract)', dir: 'packages/reformer-mcp/dist/contract' },
];

/** Что ищем. Строки в комментариях не в счёт — комментарии вырезаются заранее. */
const FORBIDDEN = [
  { re: /\bprocess\s*\.\s*env\b/, what: 'process.env' },
  { re: /\bprocess\s*\.\s*(cwd|platform|version)\b/, what: 'process.*' },
  { re: /\b__dirname\b/, what: '__dirname' },
  { re: /\brequire\s*\(/, what: 'require()' },
];

const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/**
 * Проверить каталоги собранных бандлов. `dir` — относительно `base` или абсолютный.
 *
 * @returns {boolean} есть ли node-глобали хоть в одном каталоге
 */
export function checkNoNodeGlobals(targets, base = process.cwd()) {
  let failed = false;
  for (const { name, dir: target } of targets) {
    const dir = resolve(base, target);
    if (!existsSync(dir)) {
      console.log(`⏭  ${name}: dist/ нет, пропуск (соберите пакет)`);
      continue;
    }
    // Обход рекурсивный: у ядра MCP вложенные каталоги (core/docs, core/index, core/tools),
    // и плоский readdirSync проверял бы один верхний уровень, молча пропуская всё остальное.
    const files = [];
    const walk = (d) => {
      for (const e of readdirSync(d)) {
        const p = join(d, e);
        if (statSync(p).isDirectory()) walk(p);
        else if (e.endsWith('.js')) files.push(p);
      }
    };
    walk(dir);

    const hits = [];
    for (const f of files) {
      const code = stripComments(readFileSync(f, 'utf8'));
      for (const { re, what } of FORBIDDEN) {
        if (re.test(code)) hits.push(`${relative(dir, f).split('\\').join('/')}: ${what}`);
      }
    }
    if (hits.length) {
      failed = true;
      console.error(`✗ ${name}: node-глобали в браузерном бандле:`);
      hits.forEach((h) => console.error(`    ${h}`));
      console.error(
        `    В голом ESM это даёт ReferenceError. Замените на рантайм-флаг (см. setRuntimeStrict).`
      );
    } else {
      console.log(`✓ ${name}: ${files.length} файлов dist/ без node-глобалей`);
    }
  }
  return failed;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const repoRoot = resolve(fileURLToPath(import.meta.url), '..', '..');
  process.exit(checkNoNodeGlobals(TARGETS, repoRoot) ? 1 : 0);
}
