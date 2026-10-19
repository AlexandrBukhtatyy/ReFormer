/**
 * Форма из файлов: корень плюс файлы шагов разбитого визарда — то, что проверяет гейт записи.
 *
 * Модель правит файлы по одному, а валидна или нет ФОРМА: шаг сам по себе не знает ни соседей,
 * ни корня, а корень без шагов — скелет со ссылками. Поэтому гейт проверяет форму, собранную с
 * подставленной записью, и тем же правилом, что кодоген (`codegen/src/pipeline/source.ts`):
 * ссылки корня относительны каталога корневого документа, файлы шагов разбираются как JSON и
 * склеиваются `joinFormSchema`.
 *
 * @module plugins/reformer/ai/files/compose
 */

import { normalizeStepRef, type JsonFormSchema } from '@reformer/renderer-json';
import { joinFormSchema, stepRefsOf } from '../../../core/form-model';
import { schemaDirOf } from '../../../core/codegen/layout';
import { parseSchemaText } from '../model/schema-text';

/** Собранная форма либо причина, по которой она не собралась. */
export type ComposedForm =
  | {
      readonly ok: true;
      readonly schema: JsonFormSchema;
      /** Файлы шагов, на которые ссылается корень, — пути от корня модуля. */
      readonly stepFiles: readonly string[];
    }
  | { readonly ok: false; readonly error: string };

/** Чтение файла модуля по пути от его корня; `null` — файла нет. */
export type ReadModuleFile = (rel: string) => Promise<string | null>;

/**
 * Собрать форму из файлов модуля.
 *
 * @param read - Чтение файла; гейт подставляет в него будущий текст записываемого файла.
 * @param schemaPath - Путь документа формы от корня модуля.
 */
export async function composeForm(read: ReadModuleFile, schemaPath: string): Promise<ComposedForm> {
  const rootText = await read(schemaPath);
  if (rootText === null) return { ok: false, error: `the form document ${schemaPath} is missing` };

  let root: JsonFormSchema;
  try {
    root = parseSchemaText(rootText);
  } catch (error) {
    return { ok: false, error: `${schemaPath}: ${jsonError(rootText, error)}` };
  }

  const refs = stepRefsOf(root);
  if (refs.length === 0) return { ok: true, schema: root, stepFiles: [] };

  const dir = schemaDirOf(schemaPath);
  const parts = new Map<string, unknown>();
  const stepFiles: string[] = [];
  for (const ref of refs) {
    const rel = `${dir}${normalizeStepRef(ref)}`;
    const text = await read(rel);
    if (text === null) {
      return {
        ok: false,
        error: `${schemaPath} references "${ref}", but ${rel} does not exist — create the step file first`,
      };
    }
    try {
      parts.set(ref, JSON.parse(text) as unknown);
    } catch (error) {
      return { ok: false, error: `${rel}: ${jsonError(text, error)}` };
    }
    stepFiles.push(rel);
  }

  try {
    return { ok: true, schema: joinFormSchema(root, parts).schema, stepFiles };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Ошибка разбора JSON со строкой и столбцом.
 *
 * Движки называют место по-разному: одни сразу строкой и столбцом, другие только смещением
 * (`at position 123`), а V8 на «неожиданном символе» не называет места вовсе — только начало
 * текста. Модели нужна строка: она правит по строкам, а `read_file` их и нумерует. Поэтому
 * место переводится в строку и столбец здесь, а где движок его не назвал — находится
 * ({@link errorOffset}).
 */
export function jsonError(text: string, error: unknown): string {
  // Начало текста, которое V8 цитирует в сообщении, место ошибки не называет и только шумит.
  const message = (error instanceof Error ? error.message : String(error)).replace(
    /, ".*" is not valid JSON$/s,
    ''
  );
  if (/line \d+ column \d+/.test(message)) return message;
  const at = /position (\d+)/.exec(message);
  const offset = at === null ? errorOffset(text) : Number(at[1]);
  const before = text.slice(0, offset);
  const line = before.split('\n').length;
  const column = before.length - before.lastIndexOf('\n');
  return `${message} (line ${line} column ${column})`;
}

/**
 * Смещение первого символа, на котором разбор JSON ломается.
 *
 * Префикс текста до места ошибки — это JSON, который просто не дописан: разбор такого префикса
 * падает НА ЕГО КОНЦЕ («unexpected end» либо позиция, равная длине префикса: «Unterminated string
 * at position 5» у пятисимвольного префикса). Префикс, включающий место ошибки, падает раньше
 * своего конца, и так для любого более длинного. Свойство монотонно, поэтому самый длинный
 * «недописанный» префикс находится бинарным поиском — десяток разборов даже на большой форме.
 */
function errorOffset(text: string): number {
  const unfinished = (length: number): boolean => {
    try {
      JSON.parse(text.slice(0, length));
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/end of (JSON )?input|unexpected end/i.test(message)) return true;
      const at = /position (\d+)/.exec(message);
      return at !== null && Number(at[1]) >= length;
    }
  };
  let low = 0;
  let high = text.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (unfinished(middle)) low = middle;
    else high = middle - 1;
  }
  return low;
}
