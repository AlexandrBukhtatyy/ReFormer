import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SelectAsync } from './variants/async/select-async';
import { SelectField, SelectAsyncField, SelectMulti, SelectMultiField } from './index';

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

const MANY = [
  { value: 'a', label: 'Альфа' },
  { value: 'b', label: 'Бета' },
  { value: 'c', label: 'Гамма' },
  { value: 'd', label: 'Дельта' },
];

// Список живёт в Portal (PopoverContent) и в SSR отсутствует — проверяем триггер.
// Listbox, клавиатуру и догрузку страниц закрывает e2e.
describe('SelectMulti (вариант multi)', () => {
  it('пустой выбор показывает placeholder', () => {
    const html = renderToStaticMarkup(
      <SelectMulti value={[]} options={MANY} placeholder="Выберите города" />
    );
    expect(html).toContain('Выберите города');
    expect(html).not.toContain('data-slot="select-multi-chip"');
  });

  it('триггер — combobox с aria-haspopup=listbox (Radix Select тут не используется)', () => {
    const html = renderToStaticMarkup(<SelectMulti value={[]} options={MANY} />);
    expect(html).toContain('role="combobox"');
    expect(html).toContain('aria-haspopup="listbox"');
    expect(html).toContain('data-slot="popover-trigger"');
    expect(html).not.toContain('data-slot="select-trigger"');
  });

  it('выбранные значения показываются чипами с лейблами', () => {
    const html = renderToStaticMarkup(<SelectMulti value={['a', 'c']} options={MANY} />);
    expect(html.match(/data-slot="select-multi-chip"/g) ?? []).toHaveLength(2);
    expect(html).toContain('Альфа');
    expect(html).toContain('Гамма');
  });

  it('лейбл выбранного значения ВНЕ options берётся из selectedOptions', () => {
    const html = renderToStaticMarkup(
      <SelectMulti
        value={['z']}
        options={MANY}
        selectedOptions={[{ value: 'z', label: 'Загруженный ранее' }]}
      />
    );
    expect(html).toContain('Загруженный ранее');
    expect(html).not.toContain('>z<');
  });

  it('без справочника лейблов чип показывает сырой value (документированный фолбэк)', () => {
    const html = renderToStaticMarkup(<SelectMulti value={['z']} options={MANY} />);
    expect(html).toContain('z');
  });

  it('сверх summaryThreshold чипы схлопываются в сводку', () => {
    const html = renderToStaticMarkup(
      <SelectMulti value={['a', 'b', 'c', 'd']} options={MANY} summaryThreshold={3} />
    );
    expect(html).toContain('data-slot="select-multi-summary"');
    expect(html).toContain('Выбрано: 4');
  });

  it('clearable даёт крестик сброса только при непустом выборе', () => {
    const empty = renderToStaticMarkup(<SelectMulti value={[]} options={MANY} clearable />);
    const filled = renderToStaticMarkup(<SelectMulti value={['a']} options={MANY} clearable />);
    expect(empty).not.toContain('aria-label="Clear selection"');
    expect(filled).toContain('aria-label="Clear selection"');
  });

  it('data-testid уходит на триггер', () => {
    const html = renderToStaticMarkup(
      <SelectMulti value={[]} options={MANY} data-testid="input-cities" />
    );
    expect(html).toContain('data-testid="input-cities"');
  });
});

describe('SelectMultiField (field-версия, значение string[] | null)', () => {
  it('null из формы не роняет рендер — адаптер разворачивает его в []', () => {
    const html = renderToStaticMarkup(
      <SelectMultiField value={null} options={MANY} placeholder="Пусто" />
    );
    expect(html).toContain('Пусто');
  });

  it('массив из формы доезжает до контрола', () => {
    const html = renderToStaticMarkup(<SelectMultiField value={['b']} options={MANY} />);
    expect(html).toContain('Бета');
  });

  it('control (renderer-путь) не протекает в DOM', () => {
    const html = renderToStaticMarkup(
      <SelectMultiField value={null} options={MANY} control={{} as never} />
    );
    expect(html).not.toContain('control=');
  });
});
