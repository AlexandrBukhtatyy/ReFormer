/**
 * Печать `Form.tsx` из документа RJSF: `@rjsf/core` с валидатором `@rjsf/validator-ajv8`.
 *
 * Печать идёт через `@reformer/builder-toolkit` — тот же настроенный Eta и тот же маркер
 * происхождения, что у кодогена ReFormer и демо-стека `plain`. Схема и uiSchema попадают в код
 * ЛИТЕРАЛОМ JSON: подпись с кавычкой или фигурной скобкой не должна ломать напечатанный файл.
 *
 * Тема кита в напечатанный модуль пока не входит: форма рисуется стандартной темой RJSF.
 *
 * @module plugins/rjsf/core/print-form
 */

import { renderTemplate, withMarker } from '@reformer/builder-toolkit';
import FORM_TEMPLATE from './templates/form.tsx.eta?raw';
import { displayOrder } from './ops';
import type { RjsfFieldSchema, RjsfForm } from './schema';

export interface PrintFormOptions {
  /** Имя компонента. По умолчанию `Form`. */
  readonly componentName?: string;
}

/** Имя компонента — идентификатор с заглавной буквы; всё прочее вычищается. */
function componentNameOf(raw: string): string {
  const cleaned = raw.replace(/[^A-Za-z0-9_$]/g, '');
  const name = cleaned === '' || /^[0-9]/.test(cleaned) ? `Form${cleaned}` : cleaned;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Тип значения поля в TypeScript: вариантам `enum` — объединение литералов. */
function tsTypeOf(field: RjsfFieldSchema): string {
  if (Array.isArray(field.enum) && field.enum.length > 0) {
    return field.enum.map((value) => JSON.stringify(value)).join(' | ');
  }
  switch (field.type) {
    case 'boolean':
      return 'boolean';
    case 'number':
    case 'integer':
      return 'number';
    default:
      return 'string';
  }
}

export function printFormModule(form: RjsfForm, options: PrintFormOptions = {}): string {
  const required = new Set(form.schema.required ?? []);
  const view = {
    name: componentNameOf(options.componentName ?? 'Form'),
    schema: JSON.stringify(form.schema, null, 2),
    uiSchema: JSON.stringify(form.uiSchema ?? {}, null, 2),
    fields: displayOrder(form).map((name) => ({
      key: JSON.stringify(name),
      optional: !required.has(name),
      tsType: tsTypeOf(form.schema.properties[name]!),
    })),
  };
  return withMarker(renderTemplate('rjsf-form', FORM_TEMPLATE, view));
}
