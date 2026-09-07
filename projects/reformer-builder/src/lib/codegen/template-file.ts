/**
 * Файл цели генерации: заголовок и тело шаблона в одном `.eta`.
 *
 * ## Формат
 *
 * ```
 * ---
 * { "id": "user.registry", "overrides": "codegen.registry", "path": "registry.ts",
 *   "cls": "derived", "order": 40, "title": "Реестр компонентов (наш)" }
 * ---
 * // registry.ts — …
 * ```
 *
 * ## Почему `---` и JSON, а не что-то ещё
 *
 * **Не YAML** — парсера в репозитории нет, а тащить его ради шести полей значит отдать
 * пользователю ещё один язык, в котором можно ошибиться отступом.
 *
 * **Не комментарий Eta.** `<%#` кажется естественным, но у Eta префикса `#` не зарегистрировано
 * (`parse` знает `''`, `'='` и `'~'`), поэтому `<%# …` разберётся как ВЫПОЛНЕНИЕ с телом `# …`,
 * то есть синтаксическая ошибка JS. Заголовок обязан лежать ВНЕ грамматики движка, и срез
 * до второго `---` — самое дешёвое, что это обеспечивает.
 *
 * ## Разбор строгий, а не терпимый
 *
 * Соседний `parseManifest` шаблонов проекта на битом JSON возвращает `{}` — там это уместно:
 * шаблон без манифеста всё равно рабочий, имя берётся из каталога. Здесь наоборот: цель без
 * `path` печатать некуда, а цель, молча выпавшая из списка, неотличима от «мой файл не
 * подхватился» — и человек будет искать причину в шаблоне, которого никто не читал.
 *
 * @module lib/codegen/template-file
 */

import type { FileClass } from './types';

/** Заголовок файла цели. */
export interface TargetFileMeta {
  /** Уникален в точке расширения. Совпадение с чужим — отказ реестра, а не тихая замена. */
  readonly id: string;
  /** Имя файла относительно каталога модуля. */
  readonly path: string;
  /** `derived` перезаписывается всегда, `user` пишется один раз. */
  readonly cls: FileClass;
  /** Порядок среди целей; у встроенных кратен десяти. */
  readonly order?: number;
  /** Подпись в панели. У пользовательского файла словаря нет, поэтому текстом, а не ключом. */
  readonly title?: string;
  /** `user`-файл, выводимый из правил: перезаписывается, если его не правили. */
  readonly regenerable?: boolean;
  /** Идентификатор цели, которую этот файл ЗАМЕНЯЕТ. */
  readonly overrides?: string;
  /** Выражение на JS над видом: `it.wizard !== null`. Без него цель применяется всегда. */
  readonly applies?: string;
}

export type TargetFileResult =
  | { readonly ok: true; readonly meta: TargetFileMeta; readonly body: string }
  | { readonly ok: false; readonly message: string };

const FENCE = '---';

function fail(message: string): TargetFileResult {
  return { ok: false, message };
}

/** Строка непустая после обрезки — иначе `undefined`. */
function optionalString(value: unknown, field: string): string | undefined | Error {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.trim() === '') {
    return new Error(`«${field}» должно быть непустой строкой`);
  }
  return value.trim();
}

export function parseTargetFile(text: string): TargetFileResult {
  // BOM: редакторы Windows ставят его молча, и файл переставал начинаться с `---`.
  const normalized = text.replace(/^\uFEFF/, '');
  if (!normalized.startsWith(`${FENCE}\n`) && !normalized.startsWith(`${FENCE}\r\n`)) {
    return fail('файл должен начинаться со строки `---` и заголовка за ней');
  }

  const afterOpen = normalized.indexOf('\n') + 1;
  const closeAt = normalized.indexOf(`\n${FENCE}`, afterOpen);
  if (closeAt < 0) return fail('заголовок не закрыт строкой `---`');

  const header = normalized.slice(afterOpen, closeAt);
  const bodyStart = normalized.indexOf('\n', closeAt + 1);
  const body = bodyStart < 0 ? '' : normalized.slice(bodyStart + 1);

  let raw: unknown;
  try {
    raw = JSON.parse(header);
  } catch (error) {
    return fail(`заголовок не разбирается как JSON: ${(error as Error).message}`);
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return fail('заголовок должен быть объектом JSON');
  }

  const record = raw as Record<string, unknown>;

  const id = optionalString(record.id, 'id');
  if (id instanceof Error) return fail(id.message);
  if (id === undefined) return fail('в заголовке нет «id»');

  const path = optionalString(record.path, 'path');
  if (path instanceof Error) return fail(path.message);
  if (path === undefined) return fail('в заголовке нет «path»');

  const cls = record.cls;
  if (cls !== 'derived' && cls !== 'user') {
    return fail('«cls» должно быть «derived» или «user»');
  }

  const order = record.order;
  if (order !== undefined && (typeof order !== 'number' || !Number.isFinite(order))) {
    return fail('«order» должно быть числом');
  }

  const regenerable = record.regenerable;
  if (regenerable !== undefined && typeof regenerable !== 'boolean') {
    return fail('«regenerable» должно быть true или false');
  }

  for (const field of ['title', 'overrides', 'applies'] as const) {
    const value = optionalString(record[field], field);
    if (value instanceof Error) return fail(value.message);
  }

  return {
    ok: true,
    body,
    meta: {
      id,
      path,
      cls,
      ...(order === undefined ? {} : { order }),
      ...(regenerable === undefined ? {} : { regenerable }),
      ...(typeof record.title === 'string' ? { title: record.title.trim() } : {}),
      ...(typeof record.overrides === 'string' ? { overrides: record.overrides.trim() } : {}),
      ...(typeof record.applies === 'string' ? { applies: record.applies.trim() } : {}),
    },
  };
}

/**
 * Собрать файл цели обратно — для выгрузки встроенного шаблона в проект.
 *
 * Заголовок печатается по одному полю на строку: человек будет его ПРАВИТЬ, а однострочный
 * JSON правится хуже всего.
 */
export function formatTargetFile(meta: TargetFileMeta, body: string): string {
  const entries: [string, unknown][] = [
    ['id', meta.id],
    ...(meta.overrides === undefined
      ? []
      : ([['overrides', meta.overrides]] as [string, unknown][])),
    ['path', meta.path],
    ['cls', meta.cls],
    ...(meta.order === undefined ? [] : ([['order', meta.order]] as [string, unknown][])),
    ...(meta.regenerable === undefined
      ? []
      : ([['regenerable', meta.regenerable]] as [string, unknown][])),
    ...(meta.title === undefined ? [] : ([['title', meta.title]] as [string, unknown][])),
    ...(meta.applies === undefined ? [] : ([['applies', meta.applies]] as [string, unknown][])),
  ];
  const header = entries
    .map(([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)}`)
    .join(',\n');
  return `${FENCE}\n{\n${header}\n}\n${FENCE}\n${body}`;
}
