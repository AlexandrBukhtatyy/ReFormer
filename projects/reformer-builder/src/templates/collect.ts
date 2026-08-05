/**
 * Сборка шаблона из набора файлов проекта: пути делаются относительными общего каталога, имя
 * формы-источника заменяется плейсхолдерами (и в содержимом, и в именах файлов).
 *
 * Чистый слой — читает файлы не здесь, а `io/template-repo`; сюда приходит уже прочитанный текст.
 *
 * @module reformer-builder/templates/collect
 */

import { tokenize } from './placeholders';
import type { TemplateFile } from './types';

/** Прочитанный файл проекта: путь от корня проекта + текст. */
export interface SourceFile {
  path: string;
  content: string;
}

/** Расширения, которые считаем текстовыми (остальное в шаблон не берём — читаем как текст). */
const TEXT_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.jsonc',
  '.css',
  '.scss',
  '.less',
  '.html',
  '.md',
  '.mdx',
  '.txt',
  '.yml',
  '.yaml',
  '.svg',
  '.graphql',
  '.env',
];

/** Можно ли взять файл в шаблон (бинарные — картинки/шрифты — пропускаем). */
export function isTextFile(path: string): boolean {
  const name = path.slice(path.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return true; // без расширения (Dockerfile, LICENSE) — считаем текстом
  return TEXT_EXTENSIONS.includes(name.slice(dot).toLowerCase());
}

/** Каталог пути (пустой — файл в корне). */
function dirOf(path: string): string {
  const i = path.lastIndexOf('/');
  return i === -1 ? '' : path.slice(0, i);
}

/**
 * Общий каталог набора путей: `['a/b/model.ts', 'a/b/ui/x.ts']` → `a/b`, разные ветки → ближайший
 * общий предок, файлы в корне → пустая строка.
 */
export function commonDirPrefix(paths: string[]): string {
  if (!paths.length) return '';
  let common: string[] | null = null;
  for (const p of paths) {
    const segs = dirOf(p).split('/').filter(Boolean);
    if (common === null) {
      common = segs;
      continue;
    }
    let i = 0;
    while (i < common.length && i < segs.length && common[i] === segs[i]) i++;
    common = common.slice(0, i);
  }
  return (common ?? []).join('/');
}

/**
 * Имя, предлагаемое как базовое для плейсхолдеров: последний сегмент общего каталога, иначе —
 * имя единственного файла без расширения. Пустая строка означает «токенизировать нечем».
 */
export function suggestBaseName(paths: string[]): string {
  const prefix = commonDirPrefix(paths);
  if (prefix) return prefix.slice(prefix.lastIndexOf('/') + 1);
  const first = paths[0];
  if (!first) return '';
  const name = first.slice(first.lastIndexOf('/') + 1);
  const dot = name.indexOf('.');
  return dot === -1 ? name : name.slice(0, dot);
}

/**
 * Файлы шаблона из прочитанных файлов проекта: путь — относительно общего каталога и с
 * плейсхолдерами, содержимое — токенизировано. Порядок сохраняется, дубли путей отбрасываются.
 */
export function buildTemplateFiles(files: SourceFile[], baseName: string): TemplateFile[] {
  const prefix = commonDirPrefix(files.map((f) => f.path));
  const cut = prefix ? prefix.length + 1 : 0;
  const seen = new Set<string>();
  const out: TemplateFile[] = [];
  for (const f of files) {
    const path = tokenize(f.path.slice(cut), baseName);
    if (!path || seen.has(path)) continue;
    seen.add(path);
    out.push({ path, content: tokenize(f.content, baseName) });
  }
  return out;
}

/**
 * Slug шаблона — имя папки в `.reformer/templates/` и ключ локального хранилища. В отличие от
 * написаний имени формы, не разбирается на слова, а лишь чистится под файловую систему, поэтому
 * кириллица («кредитная-форма») сохраняется как есть.
 */
export function templateSlug(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');
  return slug || 'template';
}
