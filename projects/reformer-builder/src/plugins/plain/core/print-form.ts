/**
 * Печать `Form.tsx` из схемы демо-стека: нативные `<input>`, `<select>` и React без библиотек.
 *
 * Печать идёт через `@reformer/builder-toolkit` — тот же настроенный Eta и тот же маркер
 * происхождения, что у кодогена стека ReFormer. Это и есть довод за toolkit: печатник нужен
 * двум стекам, а формат схемы у них общего нет ни в чём.
 *
 * Всё, что приходит из схемы, попадает в код ЛИТЕРАЛОМ JSON (`JSON.stringify`): подпись
 * «Имя {x}» или имя поля с кавычкой не должны ломать напечатанный файл.
 *
 * @module plugins/plain/core/print-form
 */

import { renderTemplate, withMarker } from '@reformer/builder-toolkit';
import FORM_TEMPLATE from './templates/form.tsx.eta?raw';
import { emptyValueOf } from './defaults';
import type { PlainField, PlainForm } from './schema';

const TS_TYPE: Record<PlainField['type'], string> = {
  text: 'string',
  number: 'number | null',
  checkbox: 'boolean',
  select: 'string',
};

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

export function printFormModule(form: PlainForm, options: PrintFormOptions = {}): string {
  const view = {
    name: componentNameOf(options.componentName ?? 'Form'),
    title: form.title !== undefined && form.title !== '' ? JSON.stringify(form.title) : null,
    fields: form.fields.map((field) => ({
      type: field.type,
      key: JSON.stringify(field.name),
      label: JSON.stringify(field.label),
      tsType: TS_TYPE[field.type],
      initial: JSON.stringify(emptyValueOf(field)),
      options: (field.options ?? []).map((option) => JSON.stringify(option)),
    })),
  };
  return withMarker(renderTemplate('plain-form', FORM_TEMPLATE, view));
}
