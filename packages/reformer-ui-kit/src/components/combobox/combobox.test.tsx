import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Combobox } from './variants/base/combobox-base';
import { ComboboxField, ComboboxBaseField } from './index';

const OPTS = [
  { value: 'a', label: 'Первый' },
  { value: 'b', label: 'Второй' },
];

// Popover рендерит контент (Command со списком) в Portal — в SSR он отсутствует.
// Триггер (PopoverTrigger asChild → Button) — анкор, рендерится inline: тестируем его.
describe('Combobox (вариант base)', () => {
  it('рендерит триггер-кнопку с role=combobox', () => {
    const html = renderToStaticMarkup(<Combobox value={null} options={OPTS} />);
    // PopoverTrigger asChild сливает свой data-slot="popover-trigger" на Button (Radix Slot).
    expect(html).toContain('data-slot="popover-trigger"');
    expect(html).toContain('role="combobox"');
  });

  it('placeholder показывается при пустом value', () => {
    const html = renderToStaticMarkup(
      <Combobox value={null} options={OPTS} placeholder="Выберите вариант" />
    );
    expect(html).toContain('Выберите вариант');
  });

  it('label выбранной опции показывается в триггере', () => {
    const html = renderToStaticMarkup(<Combobox value="b" options={OPTS} placeholder="Выбор" />);
    expect(html).toContain('Второй');
    expect(html).not.toContain('Выбор');
  });

  it('прокидывает id/aria-* на триггер (seam-контракт поля)', () => {
    const html = renderToStaticMarkup(
      <Combobox value="a" options={OPTS} id="control-x" aria-labelledby="label-x" aria-invalid />
    );
    expect(html).toContain('id="control-x"');
    expect(html).toContain('aria-labelledby="label-x"');
    expect(html).toContain('aria-invalid="true"');
  });

  it('clearable + value → кнопка очистки', () => {
    const html = renderToStaticMarkup(<Combobox value="a" options={OPTS} clearable />);
    expect(html).toContain('aria-label="Clear selection"');
  });

  it('без value кнопка очистки не показывается', () => {
    const html = renderToStaticMarkup(<Combobox value={null} options={OPTS} clearable />);
    expect(html).not.toContain('aria-label="Clear selection"');
  });
});

describe('ComboboxField (base, comboboxAdapter)', () => {
  it('value → label выбранной опции в триггере', () => {
    const html = renderToStaticMarkup(<ComboboxField value="a" options={OPTS} />);
    expect(html).toContain('data-slot="popover-trigger"');
    expect(html).toContain('Первый');
  });

  it('strip control: renderer-путь не течёт в DOM', () => {
    const html = renderToStaticMarkup(
      <ComboboxField value={null} options={OPTS} control={{ id: 1 } as never} />
    );
    expect(html).not.toContain('[object Object]');
  });

  it('прокидывает id на триггер (seam-контракт поля)', () => {
    const html = renderToStaticMarkup(
      <ComboboxField value={null} options={OPTS} id="control-cb" />
    );
    expect(html).toContain('id="control-cb"');
  });
});

describe('ComboboxField алиас', () => {
  it('ComboboxField === ComboboxBaseField (дефолтный для форм вариант)', () => {
    expect(ComboboxField).toBe(ComboboxBaseField);
  });
});
