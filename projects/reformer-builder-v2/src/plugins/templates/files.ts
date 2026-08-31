/**
 * Чистые операции над файлами шаблона: сборка шаблона из файлов проекта и подготовка файлов
 * новой формы.
 *
 * Ни рабочей области, ни хранилищ: сюда приходит уже прочитанный текст, отсюда уходит текст,
 * который кто-то другой запишет.
 *
 * @module plugins/templates/files
 */

import { isFormSchema } from '@/lib/form-model/normalize';
import type { JsonFormSchema } from '@reformer/renderer-json';
import type { FormTemplate, TemplateFile } from './contract';
import { materialize, tokenize } from './placeholders';

/** Прочитанный файл проекта: путь от корня проекта и текст. */
export interface SourceFile {
  readonly path: string;
  readonly content: string;
}

/** Расширения, которые считаем текстовыми: остальное в шаблон не берём. */
const TEXT_EXTENSIONS: readonly string[] = [
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

/** Можно ли взять файл в шаблон: бинарные (картинки, шрифты) пропускаем. */
export function isTextFile(path: string): boolean {
  const name = path.slice(path.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  // Без расширения (`Dockerfile`, `LICENSE`) — считаем текстом.
  if (dot <= 0) return true;
  return TEXT_EXTENSIONS.includes(name.slice(dot).toLowerCase());
}

/** Каталог пути; пустая строка — файл в корне. */
function dirOf(path: string): string {
  const i = path.lastIndexOf('/');
  return i === -1 ? '' : path.slice(0, i);
}

/**
 * Общий каталог набора путей: `['a/b/model.ts', 'a/b/ui/x.ts']` → `a/b`, разные ветки —
 * ближайший общий предок, файлы в корне — пустая строка.
 */
export function commonDirPrefix(paths: readonly string[]): string {
  if (paths.length === 0) return '';
  let common: string[] | null = null;
  for (const p of paths) {
    const segments = dirOf(p).split('/').filter(Boolean);
    if (common === null) {
      common = segments;
      continue;
    }
    let i = 0;
    while (i < common.length && i < segments.length && common[i] === segments[i]) i += 1;
    common = common.slice(0, i);
  }
  return (common ?? []).join('/');
}

/**
 * Имя, предлагаемое базовым для плейсхолдеров: последний сегмент общего каталога, иначе — имя
 * единственного файла без расширения. Пустая строка означает «токенизировать нечем».
 */
export function suggestBaseName(paths: readonly string[]): string {
  const prefix = commonDirPrefix(paths);
  if (prefix !== '') return prefix.slice(prefix.lastIndexOf('/') + 1);
  const first = paths[0];
  if (first === undefined) return '';
  const name = first.slice(first.lastIndexOf('/') + 1);
  const dot = name.indexOf('.');
  return dot === -1 ? name : name.slice(0, dot);
}

/**
 * Файлы шаблона из прочитанных файлов проекта: путь — относительно общего каталога и
 * с плейсхолдерами, содержимое — токенизировано. Порядок сохраняется, дубли отбрасываются.
 */
export function buildTemplateFiles(files: readonly SourceFile[], baseName: string): TemplateFile[] {
  const prefix = commonDirPrefix(files.map((f) => f.path));
  const cut = prefix === '' ? 0 : prefix.length + 1;
  const seen = new Set<string>();
  const out: TemplateFile[] = [];
  for (const file of files) {
    const path = tokenize(file.path.slice(cut), baseName);
    if (path === '' || seen.has(path)) continue;
    seen.add(path);
    out.push({ path, content: tokenize(file.content, baseName) });
  }
  return out;
}

/**
 * Slug шаблона — имя каталога и ключ локального хранилища. В отличие от написаний имени формы
 * не разбирается на слова, а лишь чистится под файловую систему, поэтому кириллица сохраняется.
 */
export function templateSlug(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');
  return slug === '' ? 'template' : slug;
}

/**
 * Раскрыть выбор файлов по зависимостям шаблона, транзитивно: отметили точку входа — в набор
 * попадут модель, реестр и остальное, без чего страница не соберётся.
 */
export function resolvePicked(
  picked: Iterable<string>,
  requires: Readonly<Record<string, readonly string[]>> | undefined
): Set<string> {
  const out = new Set(picked);
  if (requires === undefined) return out;
  const queue = [...out];
  while (queue.length > 0) {
    const path = queue.pop() as string;
    for (const dep of requires[path] ?? []) {
      if (out.has(dep)) continue;
      out.add(dep);
      queue.push(dep);
    }
  }
  return out;
}

/** Отобранные файлы шаблона с подставленным именем формы — и в содержимом, и в пути. */
export function materializeFiles(
  template: FormTemplate,
  picked: Iterable<string>,
  formName: string
): TemplateFile[] {
  const keep = resolvePicked(picked, template.requires);
  return template.files
    .filter((f) => keep.has(f.path))
    .map((f) => ({
      ...f,
      path: materialize(f.path, formName),
      content: materialize(f.content, formName),
    }));
}

/**
 * Какой из файлов открыть после генерации: первый `.json`, распознанный как схема формы.
 * `null` — в наборе схемы нет, и тогда после генерации ничего не открывается.
 */
export function formSchemaFileOf(
  files: readonly TemplateFile[]
): { readonly file: TemplateFile; readonly schema: JsonFormSchema } | null {
  for (const file of files) {
    if (!file.path.endsWith('.json')) continue;
    try {
      const parsed: unknown = JSON.parse(file.content);
      if (isFormSchema(parsed)) return { file, schema: parsed };
    } catch {
      /* не JSON — не схема */
    }
  }
  return null;
}
