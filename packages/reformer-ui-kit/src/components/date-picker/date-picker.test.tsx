import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DatePicker } from './index';
import { Bound } from '@/test-utils/bound';

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
