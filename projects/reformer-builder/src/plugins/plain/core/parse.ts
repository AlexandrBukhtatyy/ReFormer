/**
 * Разбор и печать схемы демо-стека.
 *
 * Две проверки разной цены. {@link looksLikePlainForm} — дешёвая проба по тексту: её зовут
 * на каждое открытие файла, для каждого кандидата, и полный разбор там был бы расточительством.
 * {@link parsePlainForm} — полный разбор с отказом, который называет, что не так: из него
 * платформа делает состояние расхождения, и сообщение попадает человеку.
 *
 * @module plugins/plain/core/parse
 */

import {
  PLAIN_FIELD_TYPES,
  PLAIN_SCHEMA_ID,
  type PlainField,
  type PlainFieldType,
  type PlainForm,
} from './schema';

/** Проба по тексту: «похоже ли на схему этого стека». Без разбора JSON. */
export function looksLikePlainForm(text: string): boolean {
  return /"\$schema"\s*:\s*"plain-form\/1"/.test(text);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isFieldType(value: unknown): value is PlainFieldType {
  return typeof value === 'string' && (PLAIN_FIELD_TYPES as readonly string[]).includes(value);
}

function parseField(value: unknown, index: number): PlainField {
  if (!isRecord(value)) throw new Error(`fields[${index}]: ожидался объект`);
  const { name, label, type, options } = value;
  if (typeof name !== 'string') throw new Error(`fields[${index}].name: ожидалась строка`);
  if (typeof label !== 'string') throw new Error(`fields[${index}].label: ожидалась строка`);
  if (!isFieldType(type)) {
    throw new Error(`fields[${index}].type: одно из ${PLAIN_FIELD_TYPES.join(', ')}`);
  }
  if (options !== undefined) {
    if (!Array.isArray(options) || !options.every((option) => typeof option === 'string')) {
      throw new Error(`fields[${index}].options: ожидался список строк`);
    }
    return { name, label, type, options: options as string[] };
  }
  return { name, label, type };
}

/** Схема ли это стека — по уже разобранному значению. */
export function isPlainForm(value: unknown): value is PlainForm {
  try {
    toPlainForm(value);
    return true;
  } catch {
    return false;
  }
}

function toPlainForm(value: unknown): PlainForm {
  if (!isRecord(value)) throw new Error('ожидался объект');
  if (value.$schema !== PLAIN_SCHEMA_ID) throw new Error(`$schema: ожидалось «${PLAIN_SCHEMA_ID}»`);
  if (!Array.isArray(value.fields)) throw new Error('fields: ожидался список');
  if (value.title !== undefined && typeof value.title !== 'string') {
    throw new Error('title: ожидалась строка');
  }
  const fields = value.fields.map(parseField);
  return {
    $schema: PLAIN_SCHEMA_ID,
    ...(value.title !== undefined ? { title: value.title } : {}),
    fields,
  };
}

/** @throws если текст не JSON или не схема стека — с тем, что именно не так. */
export function parsePlainForm(text: string): PlainForm {
  return toPlainForm(JSON.parse(text) as unknown);
}

/** Печать: два пробела отступа и перевод строки в конце — как у остальных JSON проекта. */
export function printPlainForm(form: PlainForm): string {
  return JSON.stringify(form, null, 2) + '\n';
}
