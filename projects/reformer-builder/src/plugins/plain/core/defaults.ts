/**
 * Начальные значения формы и заготовка новой схемы.
 *
 * @module plugins/plain/core/defaults
 */

import { PLAIN_SCHEMA_ID, type PlainField, type PlainForm, type PlainValues } from './schema';

/** Пустое значение поля по его виду. */
export function emptyValueOf(field: PlainField): string | number | boolean | null {
  switch (field.type) {
    case 'checkbox':
      return false;
    case 'number':
      return null;
    case 'select':
      return field.options?.[0] ?? '';
    default:
      return '';
  }
}

/**
 * Значения по каждому полю. Сохранённые значения кладутся поверх — но только для полей,
 * которые в схеме ЕСТЬ: значение удалённого поля не должно воскресать в новой форме.
 */
export function initialValues(
  form: PlainForm,
  kept?: Readonly<Record<string, unknown>>
): PlainValues {
  const values: Record<string, string | number | boolean | null> = {};
  for (const field of form.fields) {
    const previous = kept?.[field.name];
    values[field.name] =
      previous === undefined ? emptyValueOf(field) : (previous as string | number | boolean | null);
  }
  return values;
}

/** Заготовка новой формы: контакт из трёх полей — по одному каждого частого вида. */
export function sampleForm(): PlainForm {
  return {
    $schema: PLAIN_SCHEMA_ID,
    title: 'Контакт',
    fields: [
      { name: 'name', label: 'Имя', type: 'text' },
      { name: 'age', label: 'Возраст', type: 'number' },
      { name: 'channel', label: 'Как связаться', type: 'select', options: ['email', 'телефон'] },
      { name: 'agree', label: 'Согласен на обработку данных', type: 'checkbox' },
    ],
  };
}
