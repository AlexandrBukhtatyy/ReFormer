import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createModel, createForm } from '@reformer/core';
import { FormField } from './form-field';
import { Input } from '@/components/input';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Минимальный value-based контрол (Input портируется в волне 1). SSR-тест: события не вызываются. */
const TestInput = (props: Record<string, unknown>) => {
  // labelTooltip срезает обёртка поля (FormField.Control → bindFieldProps); здесь — для надёжности.
  const {
    value,
    onChange: _onChange,
    onBlur: _onBlur,
    labelTooltip: _labelTooltip,
    ...rest
  } = props;
  return <input {...(rest as any)} value={(value as string) ?? ''} readOnly />;
};

function buildField(componentProps: Record<string, unknown>, component: any = TestInput) {
  const model = createModel<{ email: string }>({ email: '' });
  const schema = { children: [{ value: model.$.email, component, componentProps }] };
  const form = createForm<{ email: string }>({ model, schema });
  return form.email as any;
}

describe('FormField — выключенное поле', () => {
  it('ставит data-disabled="true" на Field — по нему гаснет подпись (group-data-[disabled=true])', () => {
    const control = buildField({ label: 'Email', testId: 'email' });
    control.disable();
    const html = renderToStaticMarkup(<FormField control={control} />);
    expect(html).toMatch(/<div[^>]*data-slot="field"[^>]*data-disabled="true"/);
    expect(html).toContain('group-data-[disabled=true]/field:opacity-50');
  });

  it('у включённого поля атрибута нет — DOM прежний', () => {
    const html = renderToStaticMarkup(
      <FormField control={buildField({ label: 'Email', testId: 'email' })} />
    );
    expect(html).not.toContain('data-disabled');
  });
});

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

  describe('labelTooltip — иконка (i) после подписи', () => {
    const tooltipField = (extra: Record<string, unknown> = {}) =>
      buildField({ label: 'Email', testId: 'email', labelTooltip: 'Нужен для чеков', ...extra });

    it('рендерит ряд подписи с иконкой label-tooltip-<id>', () => {
      const html = renderToStaticMarkup(<FormField control={tooltipField()} />);
      expect(html).toContain('data-slot="field-label-row"');
      expect(html).toContain('data-testid="label-tooltip-email"');
      expect(html).toContain('aria-label="Подсказка: Email"');
    });

    it('иконка стоит СНАРУЖИ <label>: внутри него клик активировал бы контрол', () => {
      const html = renderToStaticMarkup(<FormField control={tooltipField()} />);
      const label = html.match(/<label[\s\S]*?<\/label>/)?.[0] ?? '';
      expect(label).toContain('Email');
      expect(label).not.toContain('info-hint');
      expect(html.indexOf('</label>')).toBeLessThan(html.indexOf('data-slot="info-hint"'));
    });

    it('aria-describedby контрола ссылается на скрытый дубль текста подсказки', () => {
      const html = renderToStaticMarkup(<FormField control={tooltipField()} />);
      const hintId = html.match(/<span id="([^"]*)" hidden="">Нужен для чеков<\/span>/)?.[1];
      expect(hintId).toBeTruthy();
      expect(html.match(/<input[^>]*aria-describedby="([^"]*)"/)?.[1]).toBe(hintId);
    });

    it('вместе с description: сначала id подсказки, затем id описания', () => {
      const html = renderToStaticMarkup(
        <FormField control={tooltipField({ description: 'Не передаём третьим лицам' })} />
      );
      const hintId = html.match(/<span id="([^"]*)" hidden="">/)?.[1];
      const descId = html.match(/<p[^>]*\sid="([^"]*)"[^>]*data-slot="field-description"/)?.[1];
      expect(html.match(/<input[^>]*aria-describedby="([^"]*)"/)?.[1]).toBe(`${hintId} ${descId}`);
    });

    it('проп не течёт в DOM контрола кита (срезает обёртка поля)', () => {
      const control = buildField(
        { label: 'Email', testId: 'email', labelTooltip: 'Нужен для чеков' },
        Input
      );
      const html = renderToStaticMarkup(<FormField control={control} />);
      expect(html.match(/<input[^>]*>/)?.[0].toLowerCase()).not.toContain('labeltooltip');
    });

    it('без labelTooltip (и с пустой строкой) DOM прежний: ни ряда, ни иконки', () => {
      const plain = renderToStaticMarkup(
        <FormField control={buildField({ label: 'Email', testId: 'email' })} />
      );
      const empty = renderToStaticMarkup(
        <FormField control={buildField({ label: 'Email', testId: 'email', labelTooltip: '' })} />
      );
      for (const html of [plain, empty]) {
        expect(html).not.toContain('field-label-row');
        expect(html).not.toContain('info-hint');
        expect(html).not.toContain('aria-describedby');
      }
    });

    it('inline-label контрол: иконка встаёт справа от контрола (field-control-row)', () => {
      const Inline = Object.assign(
        (p: Record<string, unknown>) => {
          const { labelTooltip: _lt, label: _l, ...rest } = p;
          return <input {...(rest as any)} />;
        },
        { reformerLayout: 'inline-label' }
      );
      const html = renderToStaticMarkup(
        <FormField
          control={buildField(
            { label: 'Согласен', testId: 'agree', labelTooltip: 'Оферта' },
            Inline
          )}
        />
      );
      expect(html).toContain('data-slot="field-control-row"');
      expect(html).not.toContain('field-label-row');
      expect(html.indexOf('<input')).toBeLessThan(
        html.indexOf('data-testid="label-tooltip-agree"')
      );
    });
  });

  it('testId падает на componentProps.testId для input-<id>', () => {
    const html = renderToStaticMarkup(
      <FormField control={buildField({ label: 'X', testId: 'custom' })} />
    );
    expect(html).toContain('data-testid="input-custom"');
  });
});
