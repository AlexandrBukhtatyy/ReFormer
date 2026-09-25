/**
 * Форма целиком — из корневой схемы и файлов её шагов.
 *
 * Схема визарда, разбитая по шагам, держит в корне ссылки `{ "$ref": "./steps/<шаг>/form.schema.json" }`.
 * Печатать модуль по одному корню нельзя: шаги в нём — ссылки, раскладка не увидела бы визарда,
 * а «Сгенерировать в папку» затёрло бы разбитый корень тем, что поняло. Поэтому генерация
 * собирает форму из частей и передаёт кодогену, какой шаг из какого файла (`origins`), — и тот
 * печатает её той же структуры.
 *
 * Часть читается из открытого документа, если он есть: там текст, который человек видит сейчас.
 *
 * @module plugins/reformer/codegen/pipeline/source
 */

import {
  joinFormSchema,
  stepRefsOf,
  type StepOrigins,
} from '@reformer/builder-stack-reformer/form-model';
import { normalizeStepRef, type JsonFormSchema } from '@reformer/renderer-json';
import type { ResourceId } from '@reformer/builder-plugin-api';
import type { CodegenDocument, CodegenHost } from '../host';

/** Форма для генерации. */
export interface FormSource {
  readonly schema: JsonFormSchema;
  /** Шаги, пришедшие из своих файлов; нет — форма лежит одним файлом. */
  readonly origins?: StepOrigins;
}

/** Файлы шагов не собрались в форму: нет файла, не разбирается или не похож на шаг. */
export class StepPartsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StepPartsError';
  }
}

/**
 * Собрать форму из корня `schema` (файл `schemaId`) и файлов шагов рядом с ним.
 *
 * Схема без ссылок возвращается как есть — простая форма и визард одним файлом.
 *
 * @throws {@link StepPartsError} если часть не читается или не собирается.
 */
export async function loadFormSource(
  host: Pick<CodegenHost, 'documentOf' | 'readText' | 'parentOf' | 'resolve'>,
  schemaId: ResourceId,
  schema: JsonFormSchema
): Promise<FormSource> {
  const refs = stepRefsOf(schema);
  if (refs.length === 0) return { schema };

  const dir = host.parentOf(schemaId);
  const parts = new Map<string, unknown>();
  for (const ref of refs) {
    const id = host.resolve(dir, ...normalizeStepRef(ref).split('/'));
    const text = host.documentOf(id)?.getText() ?? (await host.readText(id).catch(() => null));
    if (text === null) throw new StepPartsError(`нет файла шага «${ref}»`);
    try {
      parts.set(ref, JSON.parse(text) as unknown);
    } catch (error) {
      throw new StepPartsError(`файл шага «${ref}» не разбирается: ${messageOf(error)}`);
    }
  }

  try {
    const joined = joinFormSchema(schema, parts);
    return { schema: joined.schema, origins: joined.origins };
  } catch (error) {
    throw new StepPartsError(messageOf(error));
  }
}

/**
 * Форма открытого документа. Составной документ уже собран, и его раскладку знает он сам —
 * перечитывать файлы шагов незачем, а по собранной модели ссылок не найти вовсе: без этой ветки
 * генерация напечатала бы разбитую форму одним файлом и затёрла бы корень.
 *
 * @throws {@link StepPartsError} как {@link loadFormSource}.
 */
export async function formSourceOf(
  host: Pick<CodegenHost, 'documentOf' | 'readText' | 'parentOf' | 'resolve'>,
  document: CodegenDocument,
  schema: JsonFormSchema
): Promise<FormSource> {
  const composition = document.composition?.();
  if (composition === undefined) return loadFormSource(host, document.id, schema);
  const { layout } = composition;
  return layout instanceof Map ? { schema, origins: layout as StepOrigins } : { schema };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
