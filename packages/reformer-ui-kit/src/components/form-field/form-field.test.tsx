import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createModel, createForm } from '@reformer/core';
import { FormField } from './form-field';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Минимальный value-based контрол (Input портируется в волне 1). SSR-тест: события не вызываются. */
const TestInput = (props: Record<string, unknown>) => {
  const { value, onChange: _onChange, onBlur: _onBlur, ...rest } = props;
  return <input {...(rest as any)} value={(value as string) ?? ''} readOnly />;
};

function buildField(componentProps: Record<string, unknown>, component: any = TestInput) {
  const model = createModel<{ email: string }>({ email: '' });
  const schema = { children: [{ value: model.$.email, component, componentProps }] };
  const form = createForm<{ email: string }>({ model, schema });
  return form.email as any;
}

describe('FormField — shadcn Field поверх @reformer/cdk', () => {
  it('рендерит shadcn Field wrapper (role=group, data-slot=field) + data-testid=field-<id>', () => {
    const html = renderToStaticMarkup(
      <FormField control={buildField({ label: 'Email', testId: 'email' })} />
    );
    expect(html).toContain('data-slot="field"');
    expect(html).toContain('role="group"');
    expect(html).toContain('data-testid="field-email"');
  });

  it('a11y-инвариант: label.htmlFor === control.id', () => {
    const html = renderToStaticMarkup(
      <FormField control={buildField({ label: 'Email', testId: 'email' })} />
    );
    // Точечно: id именно на <input>, for именно на <label> (naive attr() взял бы id у первого узла).
    const inputId = html.match(/<input[^>]*\sid="([^"]*)"/)?.[1];
    const labelFor = html.match(/<label[^>]*\sfor="([^"]*)"/)?.[1];
    expect(inputId).toBeTruthy();
    expect(labelFor).toBe(inputId);
  });

  it('рендерит подпись из componentProps.label + data-testid=label-<id>', () => {
    const html = renderToStaticMarkup(
      <FormField control={buildField({ label: 'Email', testId: 'email' })} />
    );
    expect(html).toContain('data-testid="label-email"');
    expect(html).toContain('Email');
  });

  it('data-slot=field-label / field-content — визуальные слоты shadcn', () => {
    const html = renderToStaticMarkup(
      <FormField control={buildField({ label: 'Email', testId: 'email' })} />
    );
    expect(html).toContain('data-slot="field-label"');
    expect(html).toContain('data-slot="field-content"');
  });

  it('inline-label маркер (reformerLayout) подавляет верхнюю подпись', () => {
    const Inline = Object.assign((p: Record<string, unknown>) => <input {...(p as any)} />, {
      reformerLayout: 'inline-label',
    });
    const html = renderToStaticMarkup(
      <FormField control={buildField({ label: 'Согласен', testId: 'agree' }, Inline)} />
    );
    expect(html).not.toContain('data-testid="label-agree"');
  });

  it('testId падает на componentProps.testId для input-<id>', () => {
    const html = renderToStaticMarkup(
      <FormField control={buildField({ label: 'X', testId: 'custom' })} />
    );
    expect(html).toContain('data-testid="input-custom"');
  });
});
