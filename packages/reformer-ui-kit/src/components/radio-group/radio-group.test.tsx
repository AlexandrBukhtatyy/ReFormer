import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RadioGroup, RadioGroupItem, RadioGroupField } from './index';

const LOAN = [
  { value: 'consumer', label: 'Потребительский' },
  { value: 'mortgage', label: 'Ипотека' },
];

describe('RadioGroup (base, pure shadcn)', () => {
  it('контейнер рендерит role=radiogroup + data-slot', () => {
    const html = renderToStaticMarkup(
      <RadioGroup>
        <RadioGroupItem value="a" />
      </RadioGroup>
    );
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('data-slot="radio-group"');
  });

  it('Item рендерит role=radio + data-slot', () => {
    const html = renderToStaticMarkup(
      <RadioGroup>
        <RadioGroupItem value="a" />
      </RadioGroup>
    );
    expect(html).toContain('role="radio"');
    expect(html).toContain('data-slot="radio-group-item"');
  });
});

describe('RadioGroupField (вариант base, рендерит options)', () => {
  it('рендерит по одному Item на опцию + подписи', () => {
    const html = renderToStaticMarkup(<RadioGroupField value={null} options={LOAN} />);
    const radios = html.match(/role="radio"/g) ?? [];
    expect(radios).toHaveLength(2);
    expect(html).toContain('Потребительский');
    expect(html).toContain('Ипотека');
  });

  it('per-option data-testid = input-<field>-<value>', () => {
    const html = renderToStaticMarkup(
      <RadioGroupField value={null} options={LOAN} data-testid="input-loanType" />
    );
    expect(html).toContain('data-testid="input-loanType-consumer"');
    expect(html).toContain('data-testid="input-loanType-mortgage"');
  });

  it('value → выбран только соответствующий Item', () => {
    const html = renderToStaticMarkup(<RadioGroupField value="mortgage" options={LOAN} />);
    // из двух опций ровно одна остаётся unchecked (consumer), значит mortgage — единственный checked
    const unchecked = html.match(/data-state="unchecked"/g) ?? [];
    expect(unchecked).toHaveLength(1);
    expect(html).toContain('data-state="checked"');
  });

  it('value=null → ничего не выбрано (нет checked)', () => {
    const html = renderToStaticMarkup(<RadioGroupField value={null} options={LOAN} />);
    expect(html).not.toContain('data-state="checked"');
  });

  it('strip control: renderer-путь не течёт в DOM', () => {
    const html = renderToStaticMarkup(
      <RadioGroupField value="consumer" options={LOAN} control={{ id: 1 } as never} />
    );
    expect(html).not.toContain('[object Object]');
  });

  it('прокидывает id/aria-* на контейнер (seam-контракт)', () => {
    const html = renderToStaticMarkup(
      <RadioGroupField
        value="consumer"
        options={LOAN}
        id="control-x"
        aria-labelledby="label-x"
        aria-invalid
      />
    );
    expect(html).toContain('id="control-x"');
    expect(html).toContain('aria-labelledby="label-x"');
  });
});
