import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DatePicker } from './index';
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
