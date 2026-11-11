/**
 * Сборка модуля формы для калибровки — тем же путём, что у агента (с 7.0 он один): intent в
 * `<каталог>/form.intent.json`, затем `form_build`, затем файлы модуля читаются с диска.
 *
 * Ответ `form_build` — текст диагностики (структурированного содержимого у инструмента нет), так что
 * калибровка читает его так же, как агент: первая строка — ✓ или ✗, пункты — строки «- …».
 */

import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { typecheckFiles } from '../../lib/typecheck.mjs';

export const INTENT_FILE = 'form.intent.json';

/** Чистый каталог формы с intent внутри — вход `form_build`. */
export function prepareFormDirectory(dir, intent) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, INTENT_FILE), `${JSON.stringify(intent, null, 2)}\n`);
}

/**
 * Ответ `form_build` → статус, ошибки и предупреждения.
 *
 * @returns {{ status: 'ok'|'fail'|'unknown', errors: string[], warnings: string[],
 *   typesChecked: boolean }}
 */
export function parseFormBuild(text) {
  const t = String(text);
  const status = t.startsWith('✓ form_build')
    ? 'ok'
    : t.startsWith('✗ form_build')
      ? 'fail'
      : 'unknown';
  const bullets = (part) =>
    part
      .split('\n')
      .filter((line) => /^- /.test(line))
      .map((line) => line.slice(2).trim());
  // Неудача: заголовок и пункты сразу под ним. Успех: пункты — предупреждения после их счётчика.
  const warningsAt = t.search(/^Warnings: \d+\./m);
  return {
    status,
    errors: status === 'fail' ? bullets(t) : [],
    warnings: status === 'ok' && warningsAt >= 0 ? bullets(t.slice(warningsAt)) : [],
    typesChecked: /^Types checked/m.test(t),
  };
}

/** Файлы модуля на диске: пути от каталога формы и содержимое. */
export function readModule(dir) {
  const out = [];
  const walk = (current) => {
    for (const name of readdirSync(current).sort()) {
      const full = path.join(current, name);
      if (statSync(full).isDirectory()) walk(full);
      else
        out.push({
          path: path.relative(dir, full).split(path.sep).join('/'),
          content: readFileSync(full, 'utf8'),
        });
    }
  };
  walk(dir);
  return out;
}

/**
 * Проверка типов модуля с настоящими типами `@reformer/*` — независимо от проверки самого
 * `form_build`, чтобы её ложное «ошибок нет» было видно.
 *
 * @returns {{ file: string, line: number|null, message: string }[]}
 */
export function typecheck(dir, files) {
  return typecheckFiles(
    dir,
    files.filter((f) => /\.tsx?$/.test(f.path)).map((f) => path.join(dir, f.path))
  );
}
