import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Calendar, CalendarField, CalendarBaseField } from './index';

// react-day-picker рендерит грид inline (без Portal) — в SSR доступна вся статика месяца.
describe('Calendar (base, pure shadcn DayPicker)', () => {
  it('рендерит грид месяца (data-slot=calendar + role=grid)', () => {
    const html = renderToStaticMarkup(<Calendar mode="single" />);
    expect(html).toContain('data-slot="calendar"');
    expect(html).toContain('role="grid"');
  });

  it('рендерит кнопки навигации месяца (rdp-button_previous/next)', () => {
    const html = renderToStaticMarkup(<Calendar mode="single" />);
    expect(html).toContain('rdp-button_previous');
    expect(html).toContain('rdp-button_next');
  });

  it('рендерит день-кнопки (CalendarDayButton → data-day)', () => {
    const html = renderToStaticMarkup(<Calendar mode="single" />);
    expect(html).toContain('data-day=');
  });
});

describe('CalendarField (single-date, dateAdapter)', () => {
  it('value: Date → выбранный день (data-selected-single=true)', () => {
    const html = renderToStaticMarkup(<CalendarField value={new Date()} />);
    expect(html).toContain('data-slot="calendar"');
    expect(html).toContain('data-selected-single="true"');
  });

  it('value=null → нет выбранного дня', () => {
    const html = renderToStaticMarkup(<CalendarField value={null} />);
    expect(html).not.toContain('data-selected-single="true"');
  });

  it('strip control: renderer-путь не течёт в DOM', () => {
    const html = renderToStaticMarkup(<CalendarField value={null} control={{ id: 1 } as never} />);
    expect(html).not.toContain('[object Object]');
  });

  it('прокидывает id на корневой элемент (seam-контракт поля)', () => {
    const html = renderToStaticMarkup(<CalendarField value={null} id="control-cal" />);
    expect(html).toContain('id="control-cal"');
  });
});

describe('CalendarField алиас', () => {
  it('CalendarField === CalendarBaseField (дефолтный для форм вариант)', () => {
    expect(CalendarField).toBe(CalendarBaseField);
  });
});
