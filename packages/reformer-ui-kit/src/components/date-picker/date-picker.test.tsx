import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DatePicker, DatePickerField, DatePickerBaseField } from './index';

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

describe('DatePickerField (single-date, dateAdapter)', () => {
  it('value: Date → выбранная дата в подписи кнопки', () => {
    const html = renderToStaticMarkup(
      <DatePickerField value={new Date(2024, 0, 15)} dateFormat="dd.MM.yyyy" />
    );
    expect(html).toContain('15.01.2024');
  });

  it('value=null → placeholder (ничего не выбрано)', () => {
    const html = renderToStaticMarkup(<DatePickerField value={null} placeholder="Нет даты" />);
    expect(html).toContain('Нет даты');
    expect(html).toContain('data-empty="true"');
  });

  it('strip control: renderer-путь не течёт в DOM', () => {
    const html = renderToStaticMarkup(
      <DatePickerField value={null} control={{ id: 1 } as never} />
    );
    expect(html).not.toContain('[object Object]');
  });

  it('прокидывает id на кнопку-триггер (seam-контракт поля)', () => {
    const html = renderToStaticMarkup(<DatePickerField value={null} id="control-dp" />);
    expect(html).toContain('id="control-dp"');
  });
});

describe('DatePickerField алиас', () => {
  it('DatePickerField === DatePickerBaseField (дефолтный для форм вариант)', () => {
    expect(DatePickerField).toBe(DatePickerBaseField);
  });
});
