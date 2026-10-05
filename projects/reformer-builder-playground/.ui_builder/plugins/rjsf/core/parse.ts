/**
 * Разбор и печать документа RJSF.
 *
 * Две проверки разной цены, как у других доменов. {@link looksLikeRjsfForm} — дешёвая проба по
 * тексту: её зовут на каждое открытие файла. {@link parseRjsfForm} — полный разбор с отказом,
 * который называет, что не так: из него платформа делает состояние расхождения.
 *
 * Разбор не переписывает документ: неизвестные ключи JSON Schema и uiSchema проходят как есть,
 * порядок ключей сохраняется. Печать — `JSON.stringify` разобранного, поэтому круг
 * «разбор → печать» не теряет ничего, кроме форматирования.
 *
 * @module plugins/rjsf/core/parse
 */

import {
  RJSF_FIELD_TYPES,
  RJSF_SCHEMA_ID,
  type RjsfFieldSchema,
  type RjsfFieldType,
  type RjsfForm,
  type RjsfObjectSchema,
  type RjsfUiSchema,
} from './schema';

/** Проба по тексту: «похоже ли на документ домена RJSF». Без разбора JSON. */
export function looksLikeRjsfForm(text: string): boolean {
  return /"\$schema"\s*:\s*"rjsf-form\/1"/.test(text);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isFieldType(value: unknown): value is RjsfFieldType {
  return typeof value === 'string' && (RJSF_FIELD_TYPES as readonly string[]).includes(value);
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function parseField(name: string, value: unknown): RjsfFieldSchema {
  const at = `schema.properties.${name}`;
  if (!isRecord(value)) throw new Error(`${at}: ожидался объект`);
  if (value.type === 'object' || value.type === 'array') {
    throw new Error(`${at}.type: вложенные объекты и массивы редактор пока не ведёт`);
  }
  if (!isFieldType(value.type)) {
    throw new Error(`${at}.type: одно из ${RJSF_FIELD_TYPES.join(', ')}`);
  }
  if (value.title !== undefined && typeof value.title !== 'string') {
    throw new Error(`${at}.title: ожидалась строка`);
  }
  if (value.description !== undefined && typeof value.description !== 'string') {
    throw new Error(`${at}.description: ожидалась строка`);
  }
  if (
    value.enum !== undefined &&
    (!Array.isArray(value.enum) ||
      !value.enum.every((item) => typeof item === 'string' || typeof item === 'number'))
  ) {
    throw new Error(`${at}.enum: ожидался список строк или чисел`);
  }
  return value as RjsfFieldSchema;
}

function parseObjectSchema(value: unknown): RjsfObjectSchema {
  if (!isRecord(value)) throw new Error('schema: ожидался объект');
  if (value.type !== 'object') throw new Error('schema.type: корень формы — «object»');
  if (value.title !== undefined && typeof value.title !== 'string') {
    throw new Error('schema.title: ожидалась строка');
  }
  if (value.required !== undefined && !isStringList(value.required)) {
    throw new Error('schema.required: ожидался список строк');
  }
  if (!isRecord(value.properties)) throw new Error('schema.properties: ожидался объект');
  for (const [name, field] of Object.entries(value.properties)) parseField(name, field);
  return value as RjsfObjectSchema;
}

function parseUiSchema(value: unknown): RjsfUiSchema {
  if (!isRecord(value)) throw new Error('uiSchema: ожидался объект');
  if (value['ui:order'] !== undefined && !isStringList(value['ui:order'])) {
    throw new Error('uiSchema.ui:order: ожидался список строк');
  }
  return value as RjsfUiSchema;
}

function toRjsfForm(value: unknown): RjsfForm {
  if (!isRecord(value)) throw new Error('ожидался объект');
  if (value.$schema !== RJSF_SCHEMA_ID) throw new Error(`$schema: ожидалось «${RJSF_SCHEMA_ID}»`);
  parseObjectSchema(value.schema);
  if (value.uiSchema !== undefined) parseUiSchema(value.uiSchema);
  // Проверено всё, что ведёт редактор; остальное — JSON Schema и uiSchema как есть.
  return value as unknown as RjsfForm;
}

/** Документ ли это домена — по уже разобранному значению. */
export function isRjsfForm(value: unknown): value is RjsfForm {
  try {
    toRjsfForm(value);
    return true;
  } catch {
    return false;
  }
}

/** @throws если текст не JSON или не документ домена — с тем, что именно не так. */
export function parseRjsfForm(text: string): RjsfForm {
  return toRjsfForm(JSON.parse(text) as unknown);
}

/** Печать: два пробела отступа и перевод строки в конце — как у остальных JSON проекта. */
export function printRjsfForm(form: RjsfForm): string {
  return JSON.stringify(form, null, 2) + '\n';
}
