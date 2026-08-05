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
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** Пакеты, обязанные работать без сборщика. */
const TARGETS = [{ name: '@reformer/form-registry', dir: 'packages/reformer-form-registry/dist' }];

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
  const files = readdirSync(dir).filter((f) => f.endsWith('.js'));
  const hits = [];
  for (const f of files) {
    const code = stripComments(readFileSync(join(dir, f), 'utf8'));
    for (const { re, what } of FORBIDDEN) {
      if (re.test(code)) hits.push(`${f}: ${what}`);
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
