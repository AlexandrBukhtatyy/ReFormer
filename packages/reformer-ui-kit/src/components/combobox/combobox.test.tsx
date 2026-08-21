import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Combobox } from './variants/base/combobox-base';
import { ComboboxField, ComboboxBaseField, ComboboxMulti, ComboboxMultiField } from './index';

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

  it('creatable: значение вне options показывается в триггере как введённое', () => {
    // Пункт «Создать «…»» рендерится в Popover-портале (в SSR отсутствует) — проверяем триггер:
    // созданное значение, которого нет в options, показывается как собственный label.
    const html = renderToStaticMarkup(<Combobox value="Своё значение" options={OPTS} creatable />);
    expect(html).toContain('Своё значение');
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

const MANY = [
  { value: 'a', label: 'Альфа' },
  { value: 'b', label: 'Бета' },
  { value: 'c', label: 'Гамма' },
  { value: 'd', label: 'Дельта' },
];

// Как и у одиночного варианта: список живёт в Portal и в SSR отсутствует — проверяем триггер.
// Поведение списка (чекбоксы, потолок, «Создать») закрывается e2e.
describe('ComboboxMulti (вариант multi)', () => {
  it('пустой выбор показывает placeholder', () => {
    const html = renderToStaticMarkup(
      <ComboboxMulti value={[]} options={MANY} placeholder="Выберите теги" />
    );
    expect(html).toContain('Выберите теги');
    expect(html).not.toContain('data-slot="combobox-multi-chip"');
  });

  it('выбранные значения показываются чипами с ЛЕЙБЛАМИ, а не value', () => {
    const html = renderToStaticMarkup(<ComboboxMulti value={['a', 'c']} options={MANY} />);
    expect(html.match(/data-slot="combobox-multi-chip"/g) ?? []).toHaveLength(2);
    expect(html).toContain('Альфа');
    expect(html).toContain('Гамма');
  });

  it('значение вне options (creatable) показывается чипом как есть', () => {
    const html = renderToStaticMarkup(<ComboboxMulti value={['своё']} options={MANY} />);
    expect(html).toContain('своё');
  });

  it('сверх summaryThreshold чипы схлопываются в сводку', () => {
    const html = renderToStaticMarkup(
      <ComboboxMulti value={['a', 'b', 'c', 'd']} options={MANY} summaryThreshold={3} />
    );
    expect(html).toContain('data-slot="combobox-multi-summary"');
    expect(html).toContain('Выбрано: 4');
    expect(html).not.toContain('data-slot="combobox-multi-chip"');
  });

  it('ровно summaryThreshold значений ещё показываются чипами', () => {
    const html = renderToStaticMarkup(
      <ComboboxMulti value={['a', 'b', 'c']} options={MANY} summaryThreshold={3} />
    );
    expect(html.match(/data-slot="combobox-multi-chip"/g) ?? []).toHaveLength(3);
    expect(html).not.toContain('data-slot="combobox-multi-summary"');
  });

  it('clearable даёт крестик сброса только при непустом выборе', () => {
    const empty = renderToStaticMarkup(<ComboboxMulti value={[]} options={MANY} clearable />);
    const filled = renderToStaticMarkup(<ComboboxMulti value={['a']} options={MANY} clearable />);
    expect(empty).not.toContain('aria-label="Clear selection"');
    expect(filled).toContain('aria-label="Clear selection"');
  });

  it('триггер несёт role=combobox и data-testid', () => {
    const html = renderToStaticMarkup(
      <ComboboxMulti value={[]} options={MANY} data-testid="input-tags" />
    );
    expect(html).toContain('role="combobox"');
    expect(html).toContain('data-testid="input-tags"');
  });
});

describe('ComboboxMultiField (field-версия, значение string[] | null)', () => {
  it('null из формы не роняет рендер — адаптер разворачивает его в []', () => {
    const html = renderToStaticMarkup(
      <ComboboxMultiField value={null} options={MANY} placeholder="Пусто" />
    );
    expect(html).toContain('Пусто');
  });

  it('массив из формы доезжает до контрола', () => {
    const html = renderToStaticMarkup(<ComboboxMultiField value={['b']} options={MANY} />);
    expect(html).toContain('Бета');
  });

  it('control (renderer-путь) не протекает в DOM', () => {
    const html = renderToStaticMarkup(
      <ComboboxMultiField value={null} options={MANY} control={{} as never} />
    );
    expect(html).not.toContain('control=');
  });
});
