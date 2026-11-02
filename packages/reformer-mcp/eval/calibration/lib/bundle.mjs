/**
 * Разбор ответов `plan_form` и `generate_form` и проверка типов собранного бандла.
 *
 * Оба инструмента отвечают одним markdown-текстом (структурированного содержимого у них нет), так
 * что калибровка читает его так же, как агент: intent — из блока ```json у `plan_form`, файлы — из
 * секций `### \`путь\`` у `generate_form` (`src/core/tools/generate-form.ts`).
 */

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { typecheckFiles } from '../../lib/typecheck.mjs';

/** intent из ответа `plan_form`; `null`, если блока нет или он не разбирается. */
export function extractIntent(text) {
  const m = String(text).match(/```json\n([\s\S]*?)\n```/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

/** Секция `## <заголовок>` до следующей `## `. */
function section(text, heading) {
  const start = text.search(new RegExp(`^## ${heading}`, 'm'));
  if (start < 0) return '';
  const rest = text.slice(start + 3);
  const end = rest.search(/^## /m);
  return end < 0 ? rest : rest.slice(0, end);
}

/**
 * Ответ `generate_form` → статус проверки, ошибки, предупреждения, файлы и образец сборки.
 *
 * @returns {{ status: 'ok'|'fail'|'unknown', errors: string[], warnings: string[],
 *   intentProblems: string[], files: {path:string, lang:string, content:string}[],
 *   indexSample: string|null }}
 */
export function parseGenerateForm(text) {
  const t = String(text);
  const status = /^✅/m.test(t) ? 'ok' : /^❌/m.test(t) ? 'fail' : 'unknown';
  const bullets = (s) =>
    s
      .split('\n')
      .filter((l) => /^\s*[-*] /.test(l))
      .map((l) => l.replace(/^\s*[-*] /, '').trim());
  const errors = bullets(section(t, 'Errors'));
  const warnings = bullets(section(t, 'Warnings'));
  const intentProblems = bullets(section(t, 'Intent'));

  const files = [];
  const filesPart = section(t, 'Files');
  const re = /^### `(.+?)`\n```(\w*)\n([\s\S]*?)\n```/gm;
  let m;
  while ((m = re.exec(filesPart))) files.push({ path: m[1], lang: m[2], content: `${m[3]}\n` });

  const assembly = section(t, 'Сборка');
  const sample = assembly.match(/```tsx\n([\s\S]*?)\n```/);
  return {
    status,
    errors,
    warnings,
    intentProblems,
    files,
    indexSample: sample ? `${sample[1]}\n` : null,
  };
}

/** Записать файлы бандла (и образец `index.tsx`, если он есть) в каталог. */
export function writeBundle(dir, parsed) {
  rmSync(dir, { recursive: true, force: true });
  for (const f of parsed.files) {
    const target = path.join(dir, f.path);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, f.content);
  }
  if (parsed.indexSample) writeFileSync(path.join(dir, 'index.tsx'), parsed.indexSample);
}

/**
 * Проверка типов бандла с настоящими типами `@reformer/*`.
 *
 * @returns {{ file: string, line: number|null, message: string }[]}
 */
export function typecheck(dir, parsed) {
  return typecheckFiles(dir, [
    ...parsed.files.filter((f) => /\.tsx?$/.test(f.path)).map((f) => path.join(dir, f.path)),
    ...(parsed.indexSample ? [path.join(dir, 'index.tsx')] : []),
  ]);
}
