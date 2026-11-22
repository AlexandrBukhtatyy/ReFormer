import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DatePicker, DatePickerMulti, DatePickerRange } from './index';
import { dateRangeStep } from './variants/range/date-picker-range';
import { sortDates } from './variants/multi/date-picker-multi';
import { Bound } from '@/test-utils/bound';
import type * as React from 'react';
import { I18nProvider } from '@reformer/core/react';
import { ru } from '../../locale/ru';

// Popover по умолчанию закрыт → Calendar в Portal PopoverContent в SSR не рендерится.
// Тестируем статику кнопки-триггера (вне Portal): подпись даты/плейсхолдер + data-slot.
describe('DatePicker (base, рецепт Popover + Calendar)', () => {
  it('рендерит кнопку-триггер (data-slot=date-picker-trigger)', () => {
    const html = renderToStaticMarkup(<DatePicker />);
    expect(html).toContain('data-slot="date-picker-trigger"');
  });

  it('без даты показывает placeholder и data-empty', () => {
    const html = renderToStaticMarkup(<DatePicker placeholder="Выберите дату" />);
    expect(html).toContain('Выберите дату');
    expect(html).toContain('data-empty="true"');
  });

  it('с датой показывает её в заданном формате (date-fns)', () => {
    const html = renderToStaticMarkup(
      <DatePicker value={new Date(2024, 0, 15)} dateFormat="dd.MM.yyyy" />
    );
    expect(html).toContain('15.01.2024');
    expect(html).not.toContain('data-empty="true"');
  });
});

describe('DatePicker (single-date, dateAdapter)', () => {
  it('value: Date → выбранная дата в подписи кнопки', () => {
    const html = renderToStaticMarkup(
      <Bound component={DatePicker} value={new Date(2024, 0, 15)} dateFormat="dd.MM.yyyy" />
    );
    expect(html).toContain('15.01.2024');
  });

  it('value=null → placeholder (ничего не выбрано)', () => {
    const html = renderToStaticMarkup(
      <Bound component={DatePicker} value={null} placeholder="Нет даты" />
    );
    expect(html).toContain('Нет даты');
    expect(html).toContain('data-empty="true"');
  });

  it('прокидывает id на кнопку-триггер (seam-контракт поля)', () => {
    const html = renderToStaticMarkup(
      <Bound component={DatePicker} value={null} id="control-dp" />
    );
    expect(html).toContain('id="control-dp"');
  });
});

describe('DatePicker алиас', () => {
  it('DatePicker === DatePicker (дефолтный для форм вариант)', () => {
    expect(DatePicker).toBe(DatePicker);
  });
});

describe('DatePicker — дата и подсказка по локали [ReFormer-f29b.6]', () => {
  const day = new Date(2024, 0, 15);

  it('без формата и провайдера — по-английски через Intl, подсказка из словаря', () => {
    expect(renderToStaticMarkup(<DatePicker value={day} />)).toContain('January 15, 2024');
    expect(renderToStaticMarkup(<DatePicker />)).toContain('Pick a date');
  });

  it('русская локаль — дата по правилам языка и русская подсказка', () => {
    const inRu = (node: React.ReactNode) =>
      renderToStaticMarkup(<I18nProvider locale={ru}>{node}</I18nProvider>);
    expect(inRu(<DatePicker value={day} />)).toContain('15 января 2024');
    expect(inRu(<DatePicker />)).toContain('Выберите дату');
  });

  it('формат из локали — токены date-fns, проп главнее', () => {
    const withFormat = { ...ru, dateFormat: 'dd.MM.yyyy' };
    const html = (node: React.ReactNode) =>
      renderToStaticMarkup(<I18nProvider locale={withFormat}>{node}</I18nProvider>);
    expect(html(<DatePicker value={day} />)).toContain('15.01.2024');
    expect(html(<DatePicker value={day} dateFormat="yyyy-MM-dd" />)).toContain('2024-01-15');
  });
});

describe('DatePickerRange — период [from, to]', () => {
  const from = new Date(2024, 0, 15);
  const to = new Date(2024, 0, 20);

  it('без периода — подсказка из словаря и data-empty', () => {
    const html = renderToStaticMarkup(<DatePickerRange />);
    expect(html).toContain('data-slot="date-picker-trigger"');
    expect(html).toContain('data-mode="range"');
    expect(html).toContain('Pick a date range');
    expect(html).toContain('data-empty="true"');
  });

  it('период — две даты через тире, однодневный — одной датой', () => {
    const range = renderToStaticMarkup(
      <DatePickerRange value={[from, to]} dateFormat="dd.MM.yyyy" />
    );
    expect(range).toContain('15.01.2024 – 20.01.2024');
    expect(range).not.toContain('data-empty="true"');
    const day = renderToStaticMarkup(
      <DatePickerRange value={[from, from]} dateFormat="dd.MM.yyyy" />
    );
    expect(day).toContain('15.01.2024');
    expect(day).not.toContain('–');
  });

  it('в форме: кортеж → подпись, null и [] → подсказка', () => {
    expect(
      renderToStaticMarkup(
        <Bound component={DatePickerRange} value={[from, to]} dateFormat="dd.MM.yyyy" />
      )
    ).toContain('15.01.2024 – 20.01.2024');
    for (const empty of [null, []]) {
      const html = renderToStaticMarkup(
        <Bound component={DatePickerRange} value={empty} placeholder="Нет периода" />
      );
      expect(html).toContain('Нет периода');
      expect(html).toContain('data-empty="true"');
    }
  });

  it('русская локаль — даты по правилам языка и русская подсказка', () => {
    const inRu = (node: React.ReactNode) =>
      renderToStaticMarkup(<I18nProvider locale={ru}>{node}</I18nProvider>);
    expect(inRu(<DatePickerRange value={[from, to]} />)).toContain(
      '15 января 2024 г. – 20 января 2024 г.'
    );
    expect(inRu(<DatePickerRange />)).toContain('Выберите период');
  });

  it('clearable: крестик сброса только при выбранном периоде и не в disabled', () => {
    const props = { clearable: true, 'data-testid': 'period' };
    expect(renderToStaticMarkup(<DatePickerRange {...props} value={[from, to]} />)).toContain(
      'data-testid="period-clear"'
    );
    expect(renderToStaticMarkup(<DatePickerRange {...props} />)).not.toContain('period-clear');
    expect(
      renderToStaticMarkup(<DatePickerRange {...props} value={[from, to]} disabled />)
    ).not.toContain('period-clear');
  });

  it('прокидывает id на кнопку-триггер (seam-контракт поля)', () => {
    const html = renderToStaticMarkup(
      <Bound component={DatePickerRange} value={null} id="control-period" />
    );
    expect(html).toContain('id="control-period"');
  });
});

describe('dateRangeStep — разбор клика по календарю периода', () => {
  const from = new Date(2024, 0, 15);
  const to = new Date(2024, 0, 20);

  it('выбрано только начало — черновик, в форму не уходит', () => {
    expect(dateRangeStep({ from, to: undefined })).toEqual({ kind: 'draft', from });
  });

  it('оба конца — полный период', () => {
    expect(dateRangeStep({ from, to })).toEqual({ kind: 'commit', value: [from, to] });
  });

  it('сброс однодневного периода — undefined', () => {
    expect(dateRangeStep(undefined)).toEqual({ kind: 'commit', value: undefined });
  });
});

describe('DatePickerMulti — несколько дат', () => {
  const a = new Date(2024, 0, 15);
  const b = new Date(2024, 0, 18);
  const c = new Date(2024, 0, 20);
  const d = new Date(2024, 0, 25);

  it('без дат — подсказка из словаря и data-empty', () => {
    const html = renderToStaticMarkup(<DatePickerMulti />);
    expect(html).toContain('data-mode="multiple"');
    expect(html).toContain('Pick dates');
    expect(html).toContain('data-empty="true"');
  });

  it('до порога — даты через запятую, сверх порога — сводка с числом', () => {
    const fmt = { dateFormat: 'dd.MM' };
    expect(renderToStaticMarkup(<DatePickerMulti {...fmt} value={[a, b, c]} />)).toContain(
      '15.01, 18.01, 20.01'
    );
    expect(renderToStaticMarkup(<DatePickerMulti {...fmt} value={[a, b, c, d]} />)).toContain(
      'Dates selected: 4'
    );
    expect(
      renderToStaticMarkup(<DatePickerMulti {...fmt} value={[a, b]} summaryThreshold={1} />)
    ).toContain('Dates selected: 2');
  });

  it('без формата — короткий стиль Intl (medium)', () => {
    const inRu = renderToStaticMarkup(
      <I18nProvider locale={ru}>
        <DatePickerMulti value={[a]} />
      </I18nProvider>
    );
    expect(inRu).toContain('15 янв. 2024 г.');
  });

  it('в форме: null → подсказка, массив дат → подпись', () => {
    expect(
      renderToStaticMarkup(<Bound component={DatePickerMulti} value={null} placeholder="Пусто" />)
    ).toContain('Пусто');
    expect(
      renderToStaticMarkup(
        <Bound component={DatePickerMulti} value={[a]} dateFormat="dd.MM.yyyy" />
      )
    ).toContain('15.01.2024');
  });

  it('sortDates — по возрастанию, новый массив', () => {
    const clicked = [c, a, b];
    const sorted = sortDates(clicked);
    expect(sorted).toEqual([a, b, c]);
    expect(sorted).not.toBe(clicked);
    expect(clicked).toEqual([c, a, b]);
  });
});
