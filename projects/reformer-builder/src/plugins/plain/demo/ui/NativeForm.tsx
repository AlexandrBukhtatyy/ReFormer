/**
 * Форма демо-стека нативными элементами — то, что монтирует поверхность `plain.native`.
 *
 * @module plugins/plain/demo/ui/NativeForm
 */

import { useEffect, useState, type ReactElement } from 'react';
import {
  initialValues,
  isPlainForm,
  type PlainField,
  type PlainForm,
  type PlainValues,
} from '@/plugins/plain/core';
import type { PreviewContext } from '@reformer/builder-plugin-api';

type Translate = (key: string, params?: Record<string, unknown>) => string;

function formOf(ctx: PreviewContext): PlainForm | null {
  const model = ctx.schema();
  return isPlainForm(model) ? model : null;
}

const FIELD_CLASS = 'w-full rounded border border-input bg-background px-2 py-1 text-sm';

function NativeField(props: {
  field: PlainField;
  value: PlainValues[string];
  onChange: (value: PlainValues[string]) => void;
}): ReactElement {
  const { field, value, onChange } = props;
  const id = `plain-${field.name}`;
  if (field.type === 'checkbox') {
    return (
      <label className="flex items-center gap-2 text-sm" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          data-testid={`plain-input-${field.name}`}
          checked={value === true}
          onChange={(event) => onChange(event.target.checked)}
        />
        {field.label}
      </label>
    );
  }
  return (
    <label className="flex flex-col gap-1 text-sm" htmlFor={id}>
      <span className="font-medium">{field.label}</span>
      {field.type === 'select' ? (
        <select
          id={id}
          className={FIELD_CLASS}
          data-testid={`plain-input-${field.name}`}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
        >
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          className={FIELD_CLASS}
          data-testid={`plain-input-${field.name}`}
          type={field.type === 'number' ? 'number' : 'text'}
          value={value === null || value === undefined ? '' : String(value)}
          onChange={(event) =>
            onChange(
              field.type === 'number'
                ? event.target.value === ''
                  ? null
                  : Number(event.target.value)
                : event.target.value
            )
          }
        />
      )}
    </label>
  );
}

export function NativeForm({ ctx, t }: { ctx: PreviewContext; t: Translate }): ReactElement {
  const [form, setForm] = useState<PlainForm | null>(() => formOf(ctx));
  const [values, setValues] = useState<PlainValues>(() =>
    form === null ? {} : initialValues(form, ctx.values())
  );

  useEffect(() => {
    const subscription = ctx.onDidChangeSchema(() => {
      const next = formOf(ctx);
      setForm(next);
      // Значения полей, которых больше нет, отпадают; новые поля получают пустое значение.
      if (next !== null) setValues((previous) => initialValues(next, previous));
    });
    return () => {
      subscription.dispose();
    };
  }, [ctx]);

  if (form === null) {
    return <p className="p-4 text-sm text-muted-foreground">{t('surface.invalid')}</p>;
  }

  return (
    <form
      className="flex flex-col gap-3 p-4"
      data-testid="plain-form"
      onSubmit={(event) => {
        event.preventDefault();
      }}
    >
      {form.title !== undefined && <h2 className="text-base font-semibold">{form.title}</h2>}
      {form.fields.map((field) => (
        <NativeField
          key={field.name}
          field={field}
          value={values[field.name] ?? null}
          onChange={(value) => {
            setValues((previous) => {
              const next = { ...previous, [field.name]: value };
              ctx.keepValues(next);
              return next;
            });
          }}
        />
      ))}
    </form>
  );
}
