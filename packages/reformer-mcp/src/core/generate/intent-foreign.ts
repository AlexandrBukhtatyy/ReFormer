/**
 * Чужие форматы intent, которые малая модель пишет по привычке, — в канон, с предупреждением.
 *
 * Корпус записанных прогонов qwen3.5:4b (ReFormer-f2fs.1): из 39 первых записей `form.intent.json`
 * судья не принял ни одной. Чаще всего модель:
 *
 * - пишет JSON Schema вместо полей: `schema: { type, properties, required }` — формат, которого в
 *   обучении больше всего (21 запись);
 * - добавляет метаключи корня: `version`, `$schema`, `grammar`, пустой `components` (13 + 4 + 8);
 * - пишет шаги мастера списком в `wizard` вместо `steps` (7 первых записей из 39).
 *
 * Смысл формы здесь восстановим без догадок, поэтому это поправка, а не отказ (как у Vercel:
 * детерминированный автофикс типовой ошибки модели). Догадок нет: чего нельзя прочитать однозначно,
 * то остаётся читателю intent и его ошибкам.
 *
 * @module reformer-mcp/core/generate/intent-foreign
 */

import type { IntentWarning, IntentWarningCode } from './form-intent.js';

type Json = Record<string, unknown>;

const isRecord = (value: unknown): value is Json =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** Метаключи корня: смысла формы в них нет. */
const META_KEYS = ['$schema', '$id', 'version', 'grammar', 'description'] as const;

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/** Литерал регулярного выражения из строки шаблона. */
export function regexLiteral(pattern: string): string {
  return /^\/.*\/[a-z]*$/.test(pattern) ? pattern : `/${pattern.replace(/\//g, '\\/')}/`;
}

/** Поле и правила из свойства JSON Schema. */
function fromProperty(
  name: string,
  prop: Json,
  required: boolean
): { field: Json; rules: string[] } {
  const format = typeof prop.format === 'string' ? prop.format : '';
  const schemaType = typeof prop.type === 'string' ? prop.type : 'string';
  const type =
    format === 'date' || format === 'date-time'
      ? 'date'
      : schemaType === 'integer' || schemaType === 'number'
        ? 'number'
        : schemaType === 'boolean'
          ? 'boolean'
          : 'string';
  const field: Json = { name, type };
  const label = prop.title ?? prop.label ?? prop.description;
  if (typeof label === 'string') field.label = label;
  if (Array.isArray(prop.enum) && prop.enum.length > 0) {
    field.component = 'Select';
    field.componentProps = {
      options: prop.enum.map((value) => ({ value, label: String(value) })),
    };
  }
  const rules: string[] = [];
  if (required || prop.required === true) rules.push('required()');
  if (format === 'email') rules.push('email()');
  if (schemaType === 'integer') rules.push('integer()');
  for (const [key, rule] of [
    ['minLength', 'minLength'],
    ['maxLength', 'maxLength'],
    ['minimum', 'min'],
    ['maximum', 'max'],
  ] as const) {
    if (typeof prop[key] === 'number') rules.push(`${rule}(${prop[key]})`);
  }
  if (typeof prop.pattern === 'string') rules.push(`pattern(${regexLiteral(prop.pattern)})`);
  return { field, rules };
}

/** Поля и правила из JSON Schema объекта; вложенный объект — группа с путями `a.b`. */
function fromSchema(schema: Json, prefix: string, fields: Json[], validation: Json[]): void {
  const properties = isRecord(schema.properties) ? schema.properties : {};
  const required = new Set(
    Array.isArray(schema.required) ? schema.required.filter((r) => typeof r === 'string') : []
  );
  for (const [key, value] of Object.entries(properties)) {
    if (!isRecord(value) || !IDENTIFIER.test(key)) continue;
    const name = prefix ? `${prefix}.${key}` : key;
    if (value.type === 'object' && isRecord(value.properties)) {
      fromSchema(value, name, fields, validation);
      continue;
    }
    if (value.type === 'array') continue;
    const { field, rules } = fromProperty(name, value, required.has(key));
    fields.push(field);
    if (rules.length > 0) validation.push({ target: name, rules });
  }
}

export interface ForeignResult {
  readonly source: Json;
  readonly notes: IntentWarning[];
}

/** Привести чужие форматы корня intent к канону. Источник не меняется. */
export function liftForeign(input: Json): ForeignResult {
  const source: Json = { ...input };
  const notes: IntentWarning[] = [];
  const note = (code: IntentWarningCode, message: string) => notes.push({ code, message });

  const meta = META_KEYS.filter((key) => key in source);
  if (isRecord(source.components) && Object.keys(source.components).length === 0) {
    meta.push('components' as (typeof META_KEYS)[number]);
  }
  if (meta.length > 0) {
    for (const key of meta) delete source[key];
    note('meta-dropped', `Keys ${meta.map((k) => `\`${k}\``).join(', ')} carry no form — dropped.`);
  }

  // Шаги списком в `wizard`: тот же список, что сокращение `steps`.
  if (Array.isArray(source.wizard) && source.steps === undefined) {
    source.steps = source.wizard;
    delete source.wizard;
    note('wizard-as-list', 'The steps were a list in `wizard` — read as `steps`.');
  }

  // JSON Schema вместо полей: `schema: { properties }` либо сам корень `{ type: "object", properties }`.
  if (source.fields === undefined) {
    const holder =
      isRecord(source.schema) && isRecord(source.schema.properties)
        ? 'schema'
        : isRecord(source.properties)
          ? 'root'
          : null;
    if (holder) {
      const schema = holder === 'schema' ? (source.schema as Json) : source;
      const fields: Json[] = [];
      const validation: Json[] = [];
      fromSchema(schema, '', fields, validation);
      if (fields.length > 0) {
        if (holder === 'schema') delete source.schema;
        else
          for (const key of ['type', 'properties', 'required', 'additionalProperties'])
            delete source[key];
        source.fields = fields;
        const rows = Array.isArray(source.validation) ? source.validation : [];
        source.validation = [...rows, ...validation];
        if (typeof schema.title === 'string' && source.formName === undefined) {
          source.formName = schema.title;
        }
        note(
          'json-schema-lifted',
          `A JSON Schema stood in place of fields — read ${fields.length} fields and ${validation.length} rules from its properties. Write intent records next time: form_build {"grammar":"base"}.`
        );
      }
    }
  }
  // `intent` в корне: имя формы и порядок полей рядом со схемой — или обёртка всего intent.
  const wrapped = source.intent;
  if (typeof wrapped === 'string' || isRecord(wrapped)) {
    delete source.intent;
    const name = typeof wrapped === 'string' ? wrapped : (wrapped.name ?? wrapped.formName);
    if (typeof name === 'string' && source.formName === undefined) source.formName = name;
    if (isRecord(wrapped) && source.fields === undefined && Array.isArray(wrapped.fields)) {
      // Обёртка: весь intent внутри `intent`.
      for (const [key, value] of Object.entries(wrapped)) {
        if (key !== 'name' && source[key] === undefined) source[key] = value;
      }
    } else if (isRecord(wrapped) && Array.isArray(wrapped.fields) && Array.isArray(source.fields)) {
      // Список имён — порядок полей.
      const order = wrapped.fields.filter((f): f is string => typeof f === 'string');
      const rank = (field: unknown) => {
        const at = isRecord(field) ? order.indexOf(String(field.name)) : -1;
        return at < 0 ? order.length : at;
      };
      source.fields = [...(source.fields as unknown[])].sort((a, b) => rank(a) - rank(b));
    }
    note(
      'meta-dropped',
      'The key `intent` held the form name and field order — read, then dropped.'
    );
  }

  // Схема рядом с готовыми полями — копия того же: поля уже есть.
  if (source.schema !== undefined && source.fields !== undefined) {
    delete source.schema;
    note('meta-dropped', 'A `schema` next to `fields` — the fields are read, the schema dropped.');
  }

  // Ограничения прямо на поле: `pattern`, `minLength`, `maxLength` — правила, а не свойства.
  if (Array.isArray(source.fields)) {
    const lifted: Json[] = [];
    source.fields = (source.fields as unknown[]).map((field) => {
      if (!isRecord(field) || typeof field.name !== 'string') return field;
      const rules: string[] = [];
      const rest: Json = { ...field };
      for (const key of ['minLength', 'maxLength'] as const) {
        if (typeof field[key] === 'number') {
          rules.push(`${key}(${field[key]})`);
          delete rest[key];
        }
      }
      if (typeof field.pattern === 'string') {
        rules.push(`pattern(${regexLiteral(field.pattern)})`);
        delete rest.pattern;
      }
      if (rules.length > 0) lifted.push({ target: field.name, rules });
      return rest;
    });
    if (lifted.length > 0) {
      source.validation = [
        ...(Array.isArray(source.validation) ? source.validation : []),
        ...lifted,
      ];
      note(
        'value-coerced',
        `Checks written on fields (${lifted.map((row) => row.target).join(', ')}) — read as validation rows.`
      );
    }
  }
  return { source, notes };
}
