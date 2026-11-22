/**
 * Чем документ без `format: 2` оказался: прежним форматом формы или вовсе не документом формы.
 *
 * Прежде любой объект без `format` назывался «прежним форматом» с советом `migrateJsonSchema`. Под
 * это попадала и JSON Schema данных (`$schema` draft-07, `properties`, `type`): совет вёл в тупик —
 * переводить там нечего, у такого документа нет дерева узлов. Модель переписывала его под ложный
 * диагноз раз за разом (ReFormer-11oe.21). Прежний формат узнаётся по корню `root` — дереву узлов;
 * без него это не документ формы.
 *
 * Внутренний модуль: его тексты читают `validateFormSchema` и `convertJsonSchema`.
 *
 * @module reformer/renderer-json/document-shape
 */

/** Что не так с документом: прежний формат, не документ формы, либо `null` — пусть судит мета-схема. */
export type DocumentShapeProblem = 'previous-format' | 'not-a-form' | null;

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Документ без `format`: с корнем `root` — прежний формат, без него — не документ формы. Не-объект и
 * объект с полем `format` (любым значением) — `null`: их называет мета-схема.
 */
export function documentShapeProblem(schema: unknown): DocumentShapeProblem {
  if (!isObject(schema) || 'format' in schema) return null;
  return isObject(schema.root) ? 'previous-format' : 'not-a-form';
}

/** Похож на JSON Schema данных: ключи `properties` / `type` или `$schema` с json-schema.org. */
function looksLikeDataSchema(schema: Record<string, unknown>): boolean {
  const meta = schema.$schema;
  return (
    'properties' in schema ||
    'type' in schema ||
    (typeof meta === 'string' && meta.includes('json-schema.org'))
  );
}

/** Каким бывает документ формы — одна строка для обоих текстов. */
const FORM_DOCUMENT_SHAPE =
  'a form document is { "format": 2, "root": { … } } — a tree of nodes with "component" and ' +
  '"children"';

/** Текст «не документ формы»; для JSON Schema данных — с пояснением, что это другой документ. */
export function notAFormText(schema: unknown): string {
  const data =
    isObject(schema) && looksLikeDataSchema(schema)
      ? '. This looks like a JSON Schema of the data ("properties", "type"): the form layout is a ' +
        'separate document, the shape of the data comes from the form model'
      : '';
  return `not a form document: ${FORM_DOCUMENT_SHAPE}${data}.`;
}
