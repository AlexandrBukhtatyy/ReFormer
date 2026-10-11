/**
 * Чистые операции над файлами шаблона: сборка шаблона из файлов проекта и подготовка файлов
 * новой формы.
 *
 * Ни рабочей области, ни хранилищ: сюда приходит уже прочитанный текст, отсюда уходит текст,
 * который кто-то другой запишет.
 *
 * @module plugins/reformer/templates/content/files
 */

import {
  ensureSchema,
  isFormSchema,
  isFormStepSchema,
  joinFormSchema,
  migrateNodeFormat,
  stepRefsOf,
  type StepOrigins,
} from '../../../core/form-model';
import type { JsonFormSchema } from '@reformer/renderer-json';
import type { FormTemplate, TemplateFile } from '../contract';
import { LEGACY_SCHEMA_FILE, SCHEMA_DIR, SCHEMA_FILE, type KitView } from '../../../core/codegen';
import { isGenerated, withMarker } from '@reformer/builder-toolkit';
import { materialize, tokenize } from '../render/placeholders';
import { buildTemplateView, renderTemplateFile } from '../render/render';

/** Чем дополняется подстановка, когда шаблон её просит. */
export interface MaterializeOptions {
  /** Активный кит: без него шаблон не увидит вида формы, даже неся схему. */
  readonly kit?: KitView | null;
}

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
 * Текст после подстановки — с тем же происхождением, что было у него до неё.
 *
 * Маркер происхождения (`// @reformer-generated <хэш>`) считается от ТЕЛА файла, а подстановка
 * имени тело меняет: файл, только что напечатанный кодогеном, после неё выглядел бы «правленным
 * руками», и билдер отказался бы перегенерировать его из правил формы. Поэтому у нетронутого
 * сгенерированного файла маркер выставляется заново. Файл без маркера и файл, который человек
 * правил, остаются как есть: первый — написан руками, у второго хэш и не должен сходиться.
 *
 * @param before - Текст до подстановки: по нему решается, был ли файл нетронутым выводом кодогена.
 * @param after - Тот же текст после подстановки.
 */
export function keepOrigin(before: string, after: string): string {
  return isGenerated(before) ? withMarker(after) : after;
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
    out.push({ path, content: keepOrigin(file.content, tokenize(file.content, baseName)) });
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

/**
 * Отобранные файлы шаблона с подставленным именем формы — и в содержимом, и в пути.
 *
 * Два способа подстановки, и выбирает между ними САМ ШАБЛОН (`engine`), а не вызывающий:
 * иначе один и тот же шаблон применялся бы по-разному из панели и из контекстного меню.
 *
 * С движком функция может БРОСИТЬ — чего у токенной подстановки не могло быть никогда.
 * Это новый класс отказа, и он обязан быть назван вызывающему, а не проглочен: шаблон,
 * молча отдавший половину файлов, хуже шаблона, который честно не применился.
 *
 * Схема и файлы шагов выходят отсюда формата 2, каким бы ни был шаблон
 * ({@link upgradeSchemaFiles}), — по той же причине в одном месте: применений два, а дверь одна.
 */
export function materializeFiles(
  template: FormTemplate,
  picked: Iterable<string>,
  formName: string,
  options: MaterializeOptions = {}
): TemplateFile[] {
  const keep = resolvePicked(picked, template.requires);
  const files = template.files.filter((f) => keep.has(f.path));

  if (template.engine !== 'eta') {
    return upgradeSchemaFiles(
      files.map((f) => ({
        ...f,
        path: materialize(f.path, formName),
        content: keepOrigin(f.content, materialize(f.content, formName)),
      }))
    );
  }

  const view = buildTemplateView(template, formName, { kit: options.kit ?? null });
  return upgradeSchemaFiles(files.map((f) => renderTemplateFile(template, f, view)));
}

/**
 * Файлы схемы прежнего формата — в формат 2; остальные файлы возвращаются теми же объектами.
 *
 * Шаблон из каталога проекта — снимок файлов, и схема в нём могла быть написана до формата 2:
 * привязка в `value` / `array`, шаги визарда в `componentProps.steps`. Форма же, созданная по
 * шаблону, — новый документ билдера, а на диск документ уходит форматом 2 (`normalize` ядра).
 * Запиши мы схему как есть, свежесозданная форма оказалась бы прежнего формата рядом с модулем,
 * вид которого собран уже по переведённой схеме ({@link formSchemaFileOf}).
 *
 * Переводятся и корневая схема, и файлы шагов — каждый сам по себе: у файла шага нет ни `root`,
 * ни `format`, и перевод документа до него не дотягивается.
 *
 * Текст файла формата 2 НЕ трогается вовсе: перевод отдаёт такой документ той же ссылкой, и
 * перепечатывать его незачем — пропали бы отступы и порядок, которыми файл написал человек.
 * Переведённый файл печатается так же, как схему печатает кодоген (два пробела, перевод строки).
 *
 * Работает по ГОТОВЫМ файлам, после подстановки: у шаблона на движке схема до отрисовки может
 * вовсе не быть JSON.
 */
function upgradeSchemaFiles(files: readonly TemplateFile[]): TemplateFile[] {
  return files.map((file) => {
    if (!file.path.endsWith('.json')) return file;
    let parsed: unknown;
    try {
      parsed = JSON.parse(file.content);
    } catch {
      // Не JSON — не схема: файл уходит как есть.
      return file;
    }
    const next = upgraded(parsed);
    return next === parsed ? file : { ...file, content: `${JSON.stringify(next, null, 2)}\n` };
  });
}

/** Значение формата 2; не схема и не шаг либо уже формат 2 — та же ссылка. */
function upgraded(parsed: unknown): unknown {
  if (isFormSchema(parsed)) return ensureSchema(parsed);
  if (isFormStepSchema(parsed)) {
    const node = migrateNodeFormat(parsed.node);
    return node === parsed.node ? parsed : { ...parsed, node };
  }
  return parsed;
}

/** Канонические имена документа формы: новое первым, затем прежнее. */
const CANONICAL_SCHEMA_NAMES: readonly string[] = [SCHEMA_FILE, LEGACY_SCHEMA_FILE];

/**
 * Ранг файла в поиске схемы — меньше значит раньше:
 *
 * 1. документ модуля в папке ролей — `schema/form.schema.json` (затем прежнее имя);
 * 2. документ в корне шаблона — `form.schema.json` (затем прежнее имя): так лежит схема у
 *    шаблона, снятого с формы прежней плоской раскладки;
 * 3. прочие файлы корня;
 * 4. вложенные.
 *
 * Порядок, а не фильтр: в пользовательском шаблоне схема может называться как угодно
 * (`__FormName__.schema.json`), и её надо найти. Но у визарда по шагам есть и под-схемы шагов
 * (`schema/steps/<шаг>/form.schema.json`) — открыть после генерации нужно корневую, а не первую
 * попавшуюся по порядку набора.
 */
function schemaRank(path: string): number {
  const segments = path.split('/');
  const canonical = CANONICAL_SCHEMA_NAMES.indexOf(segments[segments.length - 1] ?? '');
  const names = CANONICAL_SCHEMA_NAMES.length;
  if (segments.length === 2 && segments[0] === SCHEMA_DIR && canonical !== -1) return canonical;
  if (segments.length === 1) return canonical === -1 ? names * 2 : names + canonical;
  return names * 2 + 1;
}

/**
 * Какой из файлов открыть после генерации: `.json`, распознанный как схема формы, — документ
 * модуля первым (см. {@link schemaRank}), дальше в порядке набора.
 * `null` — в наборе схемы нет, и тогда после генерации ничего не открывается.
 */
export function formSchemaFileOf(files: readonly TemplateFile[]): {
  readonly file: TemplateFile;
  readonly schema: JsonFormSchema;
  /** Шаги, вынесенные в свои файлы шаблона; нет — схема одним файлом. */
  readonly origins?: StepOrigins;
} | null {
  // Сортировка устойчива: при равном ранге порядок набора сохраняется.
  const ordered = [...files].sort((a, b) => schemaRank(a.path) - schemaRank(b.path));
  for (const file of ordered) {
    if (!file.path.endsWith('.json')) continue;
    try {
      const parsed: unknown = JSON.parse(file.content);
      // Проба узнаёт документ ЛЮБОГО формата, а дальше значение уходит схемой — в вид шаблона
      // и в раскладку модуля. Поэтому сначала перевод: без него у прежнего документа не
      // нашлись бы ни привязки полей (`model`), ни ссылки на файлы шагов (`children` визарда).
      if (isFormSchema(parsed)) {
        return { file, ...composed(files, file.path, ensureSchema(parsed)) };
      }
    } catch {
      /* не JSON — не схема */
    }
  }
  return null;
}

/** Путь файла шаблона по ссылке из файла `from`: `./` и `../` разрешаются, наружу — `null`. */
function resolveInside(from: string, ref: string): string | null {
  const segments = from.split('/').slice(0, -1);
  for (const segment of ref.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      if (segments.length === 0) return null;
      segments.pop();
    } else {
      segments.push(segment);
    }
  }
  return segments.join('/');
}

/**
 * Схема визарда, разбитого по шагам, — собранной: вид шаблона и раскладка модуля видят шаги
 * узлами, а не ссылками. Файла шага нет среди файлов шаблона — схема остаётся как есть.
 *
 * Схема приходит уже формата 2: ссылки на файлы шагов ищутся в `children` визарда, и у
 * непереведённого документа их бы не нашлось. Файлы шагов прежнего формата переводит сама
 * сборка (`joinFormSchema`).
 */
function composed(
  files: readonly TemplateFile[],
  path: string,
  schema: JsonFormSchema
): { readonly schema: JsonFormSchema; readonly origins?: StepOrigins } {
  const refs = stepRefsOf(schema);
  if (refs.length === 0) return { schema };
  const parts = new Map<string, unknown>();
  for (const ref of refs) {
    const target = resolveInside(path, ref);
    const file = target === null ? undefined : files.find((f) => f.path === target);
    if (file === undefined) return { schema };
    try {
      parts.set(ref, JSON.parse(file.content) as unknown);
    } catch {
      return { schema };
    }
  }
  try {
    return joinFormSchema(schema, parts);
  } catch {
    return { schema };
  }
}
