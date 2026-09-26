/**
 * Проверка документа RJSF: то, что разбор пропускает, но форма из этого не выйдет или выйдет не той.
 *
 * Разбор отвечает «это документ домена»; проверка — «RJSF его нарисует так, как задумано». Часть
 * находок — отказы самого RJSF: неполный `ui:order` без `'*'` он не рисует вовсе, а обязательное
 * поле, которого нет, молча не проверяет.
 *
 * @module plugins/rjsf/core/check
 */

import { displayOrder } from './ops';
import type { RjsfForm } from './schema';

export type RjsfProblemCode =
  | 'empty-name'
  | 'required-unknown'
  | 'order-unknown'
  | 'order-missing'
  | 'enum-empty'
  | 'widget-unknown';

export interface RjsfProblem {
  readonly code: RjsfProblemCode;
  readonly severity: 'error' | 'warning';
  /** Поле, о котором находка; нет — о форме целиком. */
  readonly field?: string;
  readonly params: Readonly<Record<string, string | number>>;
}

/**
 * Короткие имена виджетов, которые RJSF понимает в `ui:widget` сам (`"ui:widget": "textarea"`).
 * Полные имена реестра (`TextareaWidget`) и виджеты кита приходят параметром проверки.
 */
export const RJSF_WIDGET_ALIASES: readonly string[] = Object.freeze([
  'text',
  'password',
  'email',
  'hostname',
  'ipv4',
  'ipv6',
  'uri',
  'data-url',
  'radio',
  'select',
  'textarea',
  'hidden',
  'date',
  'datetime',
  'date-time',
  'alt-date',
  'alt-datetime',
  'time',
  'color',
  'file',
  'checkbox',
  'checkboxes',
  'updown',
  'range',
]);

/** Имена виджетов реестра RJSF по умолчанию. */
export const RJSF_STANDARD_WIDGETS: readonly string[] = Object.freeze([
  'AltDateTimeWidget',
  'AltDateWidget',
  'CheckboxWidget',
  'CheckboxesWidget',
  'ColorWidget',
  'DateTimeWidget',
  'DateWidget',
  'EmailWidget',
  'FileWidget',
  'HiddenWidget',
  'PasswordWidget',
  'RadioWidget',
  'RangeWidget',
  'SelectWidget',
  'TextWidget',
  'TextareaWidget',
  'TimeWidget',
  'UpDownWidget',
  'URLWidget',
]);

export interface RjsfCheckOptions {
  /**
   * Имена виджетов, доступных форме сейчас: реестр RJSF и полевые компоненты активного кита.
   * Не задан — `ui:widget` не проверяется: без знания о ките каждое его имя было бы ложной находкой.
   */
  readonly widgets?: ReadonlySet<string>;
}

export function checkRjsfForm(
  form: RjsfForm,
  options: RjsfCheckOptions = {}
): readonly RjsfProblem[] {
  const problems: RjsfProblem[] = [];
  const names = Object.keys(form.schema.properties);
  const known = new Set(names);

  for (const name of names) {
    if (name.trim() === '') {
      problems.push({ code: 'empty-name', severity: 'error', field: name, params: {} });
    }
    const field = form.schema.properties[name]!;
    if (Array.isArray(field.enum) && field.enum.length === 0) {
      problems.push({ code: 'enum-empty', severity: 'warning', field: name, params: { name } });
    }
  }

  for (const name of form.schema.required ?? []) {
    if (!known.has(name)) {
      problems.push({ code: 'required-unknown', severity: 'error', params: { name } });
    }
  }

  const order = form.uiSchema?.['ui:order'];
  if (order !== undefined) {
    for (const name of order) {
      if (name !== '*' && !known.has(name)) {
        problems.push({ code: 'order-unknown', severity: 'error', params: { name } });
      }
    }
    if (!order.includes('*')) {
      for (const name of displayOrder(form)) {
        if (!order.includes(name)) {
          problems.push({
            code: 'order-missing',
            severity: 'error',
            field: name,
            params: { name },
          });
        }
      }
    }
  }

  const widgets = options.widgets;
  if (widgets !== undefined) {
    for (const name of names) {
      const ui = form.uiSchema?.[name];
      const widget =
        ui !== null && typeof ui === 'object'
          ? (ui as Record<string, unknown>)['ui:widget']
          : undefined;
      if (typeof widget !== 'string') continue;
      if (RJSF_WIDGET_ALIASES.includes(widget) || widgets.has(widget)) continue;
      problems.push({
        code: 'widget-unknown',
        severity: 'warning',
        field: name,
        params: { name, widget },
      });
    }
  }
  return problems;
}
