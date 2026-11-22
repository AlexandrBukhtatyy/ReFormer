/**
 * Чистые операции над файлами шаблона: сборка шаблона из файлов проекта и подготовка файлов
 * новой формы.
 *
 * Ни рабочей области, ни хранилищ: сюда приходит уже прочитанный текст, отсюда уходит текст,
 * который кто-то другой запишет.
 *
 * @module plugins/forms/templates/content/files
 */

import type { TemplateStack } from '@reformer/builder-plugin-api';
import { keepOrigin } from '@reformer/builder-toolkit';
import type { FormTemplate, TemplateFile } from '../contract';
import { materialize, tokenize } from '../render/placeholders';
import { buildTemplateView, renderTemplateFile } from '../render/render';
import { moduleTokensOf, templateStackOf } from './stacks';

/** Чем дополняется подстановка. */
export interface MaterializeOptions {
  /**
   * Стеки шаблонов: токены имён модуля, вид формы для шаблона на движке и перевод документа в
   * текущий формат — у стека шаблона. Без них подставляются только написания имени.
   */
  readonly stacks?: readonly TemplateStack[];
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
 * Файлы шаблона из прочитанных файлов проекта: путь — относительно общего каталога и
 * с плейсхолдерами, содержимое — токенизировано. Порядок сохраняется, дубли отбрасываются.
 *
 * Происхождение переживает токенизацию (`keepOrigin`): нетронутый вывод генератора остаётся
 * сгенерированным и в шаблоне — иначе после подстановки его не перегенерировали бы из правил.
 *
 * @param reserved - Токены модуля у стеков: базовое имя, совпавшее с их словами, не токенизируется.
 */
export function buildTemplateFiles(
  files: readonly SourceFile[],
  baseName: string,
  reserved: readonly string[] = []
): TemplateFile[] {
  const prefix = commonDirPrefix(files.map((f) => f.path));
  const cut = prefix === '' ? 0 : prefix.length + 1;
  const seen = new Set<string>();
  const out: TemplateFile[] = [];
  for (const file of files) {
    const path = tokenize(file.path.slice(cut), baseName, reserved);
    if (path === '' || seen.has(path)) continue;
    seen.add(path);
    out.push({
      path,
      content: keepOrigin(file.content, tokenize(file.content, baseName, reserved)),
    });
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
 * Документ формы выходит отсюда в текущем формате стека, каким бы ни был шаблон
 * (`TemplateStack.upgrade`: шаблон проекта — снимок файлов, и схема в нём могла быть написана до
 * формата 2), — по той же причине в одном месте: применений два, а дверь одна.
 *
 * Это ПОДСТАНОВКА: шаблон, который печатается, раскладывается под имя через {@link applyTemplate}
 * — та зовёт подстановку ради отбора и путей, а текст берёт у печати.
 */
export function materializeFiles(
  template: FormTemplate,
  picked: Iterable<string>,
  formName: string,
  options: MaterializeOptions = {}
): TemplateFile[] {
  const stacks = options.stacks ?? [];
  const keep = resolvePicked(picked, template.requires);
  const files = template.files.filter((f) => keep.has(f.path));

  if (template.engine !== 'eta') {
    const tokens = moduleTokensOf(stacks, template.files, formName);
    return upgraded(
      stacks,
      files.map((f) => ({
        ...f,
        path: materialize(f.path, formName, tokens),
        content: keepOrigin(f.content, materialize(f.content, formName, tokens)),
      }))
    );
  }

  const view = buildTemplateView(template, formName, { stacks });
  return upgraded(
    stacks,
    files.map((f) => renderTemplateFile(template, f, view))
  );
}

/**
 * Готовые файлы — в текущем формате стека, которому они принадлежат; ничьи — как есть.
 *
 * Стек выбирается по ГОТОВЫМ файлам: у шаблона на движке документ до отрисовки может вовсе не быть
 * разбираемым.
 */
function upgraded(stacks: readonly TemplateStack[], files: TemplateFile[]): TemplateFile[] {
  const stack = templateStackOf(stacks, files);
  return stack?.upgrade === undefined ? files : [...stack.upgrade(files)];
}

/**
 * Файлы новой формы по шаблону — тем способом, каким шаблон раскладывается под имя.
 *
 * Шаблон из файлов (снимок каталога, шаблон на движке) раскладывается подстановкой —
 * {@link materializeFiles}. Шаблон, который ПЕЧАТАЕТСЯ ({@link FormTemplate.print} — встроенные),
 * печатается под имя формы заново: текст модуля уложен под ширину строки, а она зависит от имён
 * модуля, так что подстановка даёт верные имена в неверной раскладке — модуль собирается, но не
 * проходит форматтер проекта.
 *
 * Отбор и пути остаются за шаблоном: набор файлов — отмеченное с добором зависимостей, путь —
 * подстановка в путь шаблона. Из напечатанного берётся только текст — по совпадению пути, и
 * берётся как есть, вместе с маркером происхождения, который поставил кодоген. Файл без пары
 * (фикстура — её кодоген не печатает) остаётся подстановочным.
 *
 * Печатник пропал или отказал (плагин генерации выгружен, кит не доехал) — форма создаётся
 * подстановкой: имена в ней верны, раскладку поправит форматтер. Отказ назван в консоли, а не
 * проглочен, но создание формы он не отменяет.
 */
export async function applyTemplate(
  template: FormTemplate,
  picked: Iterable<string>,
  formName: string,
  options: MaterializeOptions = {}
): Promise<TemplateFile[]> {
  const files = materializeFiles(template, picked, formName, options);
  if (template.print === undefined) return files;

  let printed: readonly TemplateFile[];
  try {
    printed = await template.print(formName);
  } catch (error) {
    console.warn(
      `[templates] шаблон «${template.id}» под имя «${formName}» не напечатался — подстановка`,
      error
    );
    return files;
  }
  const texts = new Map(printed.map((file) => [file.path, file.content]));
  return files.map((file) => {
    const text = (file.scope ?? 'form') === 'form' ? texts.get(file.path) : undefined;
    return text === undefined ? file : { ...file, content: text };
  });
}
