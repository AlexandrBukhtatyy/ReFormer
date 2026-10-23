/**
 * Документ формы ReFormer среди файлов шаблона: какой файл — схема формы, как собрать её шаги и как
 * привести схему и шаги к формату 2.
 *
 * Чистые функции над готовыми файлами: хозяин шаблонов зовёт их через стек (`documentOf`,
 * `upgrade`, `view`) и сам ни схемы, ни шагов не разбирает.
 *
 * @module plugins/reformer/templates/stack/document
 */

import type { FormTemplateFile } from '@reformer/builder-plugin-api';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { LEGACY_SCHEMA_FILE, SCHEMA_DIR, SCHEMA_FILE } from '../../../core/codegen';
import {
  ensureSchema,
  isFormSchema,
  isFormStepSchema,
  joinFormSchema,
  migrateNodeFormat,
  stepRefsOf,
  type StepOrigins,
} from '../../../core/form-model';

/** Документ формы, найденный в наборе файлов шаблона. */
export interface FormDocument {
  readonly file: FormTemplateFile;
  /** Схема формата 2 — собранная, если шаги лежат своими файлами. */
  readonly schema: JsonFormSchema;
  /** Шаги, вынесенные в свои файлы шаблона; нет — схема одним файлом. */
  readonly origins?: StepOrigins;
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
 * Документ формы в наборе: `.json`, распознанный как схема формы, — документ модуля первым (см.
 * {@link schemaRank}), дальше в порядке набора. `null` — в наборе схемы нет.
 */
export function formDocumentOf(files: readonly FormTemplateFile[]): FormDocument | null {
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
  files: readonly FormTemplateFile[],
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

/**
 * Файлы схемы прежнего формата — в формат 2; остальные файлы возвращаются теми же объектами.
 *
 * Шаблон из каталога проекта — снимок файлов, и схема в нём могла быть написана до формата 2:
 * привязка в `value` / `array`, шаги визарда в `componentProps.steps`. Форма же, созданная по
 * шаблону, — новый документ билдера, а на диск документ уходит форматом 2 (`normalize` ядра).
 * Запиши мы схему как есть, свежесозданная форма оказалась бы прежнего формата рядом с модулем,
 * вид которого собран уже по переведённой схеме ({@link formDocumentOf}).
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
export function upgradeFormFiles(files: readonly FormTemplateFile[]): FormTemplateFile[] {
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
