/**
 * Правки схемы демо-стека — операциями, которые платформа кладёт в историю.
 *
 * Словарь операций принадлежит стеку, а не платформе: платформа видит `{ type, params }`
 * и знает о них ровно одно — что у каждой есть обратная. Операции чистые: схема не мутируется,
 * нетронутые поля остаются теми же объектами.
 *
 * Адрес поля — его ИМЯ, а не номер: номер сдвигается при каждой вставке, и отмена по номеру
 * снимала бы не то поле.
 *
 * @module plugins/plain/core/ops
 */

import type { PlainField, PlainForm } from './schema';

export type PlainOp =
  | {
      readonly type: 'add-field';
      readonly params: { readonly field: PlainField; readonly index?: number };
    }
  | { readonly type: 'remove-field'; readonly params: { readonly name: string } }
  | {
      readonly type: 'rename-field';
      readonly params: { readonly name: string; readonly to: string };
    };

export interface PlainApplyResult {
  readonly model: PlainForm;
  readonly inverse: PlainOp;
}

function indexOf(form: PlainForm, name: string): number {
  const index = form.fields.findIndex((field) => field.name === name);
  if (index < 0) throw new Error(`поля «${name}» нет`);
  return index;
}

function withFields(form: PlainForm, fields: readonly PlainField[]): PlainForm {
  return { ...form, fields };
}

/** @throws если цель операции исчезла или тип операции незнаком. */
export function applyPlainOp(form: PlainForm, op: PlainOp): PlainApplyResult {
  switch (op.type) {
    case 'add-field': {
      const { field } = op.params;
      if (form.fields.some((existing) => existing.name === field.name)) {
        throw new Error(`поле «${field.name}» уже есть`);
      }
      const index = Math.min(op.params.index ?? form.fields.length, form.fields.length);
      const fields = [...form.fields.slice(0, index), field, ...form.fields.slice(index)];
      return {
        model: withFields(form, fields),
        inverse: { type: 'remove-field', params: { name: field.name } },
      };
    }
    case 'remove-field': {
      const index = indexOf(form, op.params.name);
      const field = form.fields[index]!;
      return {
        model: withFields(
          form,
          form.fields.filter((_, i) => i !== index)
        ),
        inverse: { type: 'add-field', params: { field, index } },
      };
    }
    case 'rename-field': {
      const { name, to } = op.params;
      const index = indexOf(form, name);
      if (name !== to && form.fields.some((existing) => existing.name === to)) {
        throw new Error(`поле «${to}» уже есть`);
      }
      const fields = form.fields.map((field, i) => (i === index ? { ...field, name: to } : field));
      return {
        model: withFields(form, fields),
        inverse: { type: 'rename-field', params: { name: to, to: name } },
      };
    }
    default: {
      const unknown: { readonly type: string } = op;
      throw new Error(`операция «${unknown.type}» стеку plain неизвестна`);
    }
  }
}

/** Свободное имя для нового поля: `field1`, `field2`, … */
export function nextFieldName(form: PlainForm, base = 'field'): string {
  const taken = new Set(form.fields.map((field) => field.name));
  for (let n = 1; ; n += 1) {
    const candidate = `${base}${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}
