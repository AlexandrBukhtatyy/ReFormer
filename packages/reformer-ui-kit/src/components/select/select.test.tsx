import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SelectAsync } from './variants/async/select-async';
import { SelectField, SelectAsyncField } from './index';

const OPTS = [
  { value: 'a', label: 'A' },
  { value: 'b', label: 'B' },
];

// Radix Select рендерит Content в Portal — в SSR он отсутствует; проверяем триггер и обёртку.
describe('SelectAsync (вариант async)', () => {
  it('рендерит триггер с data-slot=select-trigger', () => {
    const html = renderToStaticMarkup(
      <SelectAsync value={null} options={OPTS} placeholder="Выбор" />
    );
    expect(html).toContain('data-slot="select-trigger"');
  });

  it('placeholder показывается при пустом value', () => {
    const html = renderToStaticMarkup(
      <SelectAsync value={null} options={OPTS} placeholder="Выберите вариант" />
    );
    expect(html).toContain('Выберите вариант');
  });

  it('прокидывает id/aria-* на триггер (seam-контракт поля)', () => {
    const html = renderToStaticMarkup(
      <SelectAsync value="a" options={OPTS} id="control-x" aria-labelledby="label-x" aria-invalid />
    );
    expect(html).toContain('id="control-x"');
    expect(html).toContain('aria-labelledby="label-x"');
  });

  it('clearable + value → кнопка очистки', () => {
    const html = renderToStaticMarkup(<SelectAsync value="a" options={OPTS} clearable />);
    expect(html).toContain('aria-label="Clear selection"');
  });

  it('без value кнопка очистки не показывается', () => {
    const html = renderToStaticMarkup(<SelectAsync value={null} options={OPTS} clearable />);
    expect(html).not.toContain('aria-label="Clear selection"');
  });
});

describe('SelectField алиас', () => {
  it('SelectField === SelectAsyncField (дефолтный для форм вариант)', () => {
    expect(SelectField).toBe(SelectAsyncField);
  });
});
