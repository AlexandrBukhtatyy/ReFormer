/**
 * Проверка: в собранных браузерных бандлах нет node-глобалей.
 *
 * `process.env.NODE_ENV` — самый частый способ отличить dev от prod, и в приложении со сборщиком
 * он работает: бандлер его подставляет. Но пакет, загруженный как ГОЛЫЙ ESM (import map,
 * web-component, Module Federation без прогона через define) получает `ReferenceError:
 * process is not defined` — то есть падает не там, где ошибка, и не с тем сообщением.
 *
 * Проверка узкая намеренно: она смотрит только те пакеты, которые обязаны работать без сборщика.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Пакеты и каталоги, обязанные работать без Node.
 *
 * `@reformer/form-registry` — потому что его грузят голым ESM (import map, web-component,
 * Module Federation), где `process` не определён.
 *
 * `@reformer/mcp` проверяется НЕ целиком, а двумя частями — `dist/core` и `dist/platform/browser`:
 * сервер запускается под Node и
 * node-глобали в `platform/cli` законны. Смысл гейта в том, что ядро знаний обязано собираться
 * в браузер, а «обязано» без проверки живёт ровно до следующего удобного `readFileSync`.
 */
const TARGETS = [
  { name: '@reformer/form-registry', dir: 'packages/reformer-form-registry/dist' },
  { name: '@reformer/mcp (core)', dir: 'packages/reformer-mcp/dist/core' },
  { name: '@reformer/mcp (platform/browser)', dir: 'packages/reformer-mcp/dist/platform/browser' },
];

/** Что ищем. Строки в комментариях не в счёт — комментарии вырезаются заранее. */
const FORBIDDEN = [
  { re: /\bprocess\s*\.\s*env\b/, what: 'process.env' },
  { re: /\bprocess\s*\.\s*(cwd|platform|version)\b/, what: 'process.*' },
  { re: /\b__dirname\b/, what: '__dirname' },
  { re: /\brequire\s*\(/, what: 'require()' },
];

const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

let failed = false;

for (const { name, dir } of TARGETS) {
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

process.exit(failed ? 1 : 0);
