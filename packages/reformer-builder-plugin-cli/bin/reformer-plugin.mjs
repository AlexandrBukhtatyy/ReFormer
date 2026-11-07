#!/usr/bin/env node
/**
 * `reformer-plugin` — то, на что npm ставит ссылку в `node_modules/.bin`.
 *
 * Файл закоммичен, а не собирается в `dist`, и это несущее. npm связывает бинарники при
 * установке и молча пропускает те, чьего файла ещё нет. В монорепо `dist` появляется ПОСЛЕ
 * установки (`npm ci`, затем сборка CLI), поэтому ссылка на `dist/cli.js` не создавалась вовсе:
 * `reformer-plugin` не находился ни в CI, ни на свежем клоне — `plugin:build` кита HexaUI падал
 * с «not found». Опубликованному пакету это безразлично (в тарболе `dist` уже есть), но точка
 * входа одна для обоих.
 *
 * Запуск тот же, что у прямого вызова `dist/cli.js`: `runCli` с процессом. Сама точка входа
 * `dist/cli.js` при импорте ничего не запускает — её `isMain` сверяет путь запущенного файла.
 */
import { runCli } from '../dist/cli.js';

process.exitCode = await runCli(process.argv.slice(2), {
  out: (line) => process.stdout.write(`${line}\n`),
  err: (line) => process.stderr.write(`${line}\n`),
  cwd: process.cwd(),
});
