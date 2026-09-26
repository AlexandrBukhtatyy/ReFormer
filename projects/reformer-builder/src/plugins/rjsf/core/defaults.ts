/**
 * Начальные значения формы и заготовки документа и поля.
 *
 * @module plugins/rjsf/core/defaults
 */

import {
  RJSF_SCHEMA_ID,
  type RjsfFieldSchema,
  type RjsfFieldType,
  type RjsfForm,
  type RjsfValues,
} from './schema';

/**
 * Значения по полям формы. Сохранённые кладутся поверх `default` схемы — но только для полей,
 * которые в форме ЕСТЬ: значение удалённого поля не должно воскресать. Поле без значения и без
 * `default` в результат не попадает: так RJSF отличает «не заполнено» от пустой строки.
 */
export function initialValues(form: RjsfForm, kept?: RjsfValues): RjsfValues {
  const values: Record<string, unknown> = {};
  for (const [name, field] of Object.entries(form.schema.properties)) {
    const previous = kept?.[name];
    if (previous !== undefined) values[name] = previous;
    else if (field.default !== undefined) values[name] = field.default;
  }
  return values;
}

/** Схема нового поля: тип и подпись по имени — остальное человек выберет в инспекторе. */
export function newField(name: string, type: RjsfFieldType = 'string'): RjsfFieldSchema {
  return { type, title: name };
}

/** Заготовка новой формы: контакт — по полю каждого частого вида. */
export function sampleForm(): RjsfForm {
  return {
    $schema: RJSF_SCHEMA_ID,
    schema: {
      type: 'object',
      title: 'Контакт',
      required: ['name'],
      properties: {
        name: { type: 'string', title: 'Имя' },
        age: { type: 'integer', title: 'Возраст', minimum: 0 },
        channel: { type: 'string', title: 'Как связаться', enum: ['email', 'телефон'] },
        agree: { type: 'boolean', title: 'Согласен на обработку данных' },
      },
    },
    uiSchema: { name: { 'ui:placeholder': 'Как к вам обращаться' } },
  };
}
