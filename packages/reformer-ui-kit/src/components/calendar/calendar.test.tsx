import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Calendar, CalendarSingle } from './index';
import { Bound } from '@/test-utils/bound';
import type * as React from 'react';
import { I18nProvider } from '@reformer/core/react';
import { ru } from '../../locale/ru';

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

describe('CalendarSingle (single-date, dateAdapter)', () => {
  it('value: Date → выбранный день (data-selected-single=true)', () => {
    const html = renderToStaticMarkup(<Bound component={CalendarSingle} value={new Date()} />);
    expect(html).toContain('data-slot="calendar"');
    expect(html).toContain('data-selected-single="true"');
  });

  it('value=null → нет выбранного дня', () => {
    const html = renderToStaticMarkup(<Bound component={CalendarSingle} value={null} />);
    expect(html).not.toContain('data-selected-single="true"');
  });

  it('прокидывает id на корневой элемент (seam-контракт поля)', () => {
    const html = renderToStaticMarkup(
      <Bound component={CalendarSingle} value={null} id="control-cal" />
    );
    expect(html).toContain('id="control-cal"');
  });
});

describe('CalendarSingle алиас', () => {
  it('CalendarSingle === CalendarSingle (дефолтный для форм вариант)', () => {
    expect(CalendarSingle).toBe(CalendarSingle);
  });
});

describe('Calendar — подписи по локали [ReFormer-f29b.6]', () => {
  const month = new Date(2024, 0, 15);
  const inRu = (node: React.ReactNode) =>
    renderToStaticMarkup(<I18nProvider locale={ru}>{node}</I18nProvider>);

  it('без провайдера — английский месяц и подписи навигации из словаря', () => {
    const html = renderToStaticMarkup(<Calendar mode="single" defaultMonth={month} />);
    expect(html).toContain('January 2024');
    expect(html).toContain('aria-label="Go to the previous month"');
  });

  it('русская локаль — месяц и дни недели через Intl, неделя с понедельника', () => {
    const html = inRu(<Calendar mode="single" defaultMonth={month} />);
    expect(html).toContain('январь 2024');
    expect(html).toContain('aria-label="Предыдущий месяц"');
    // Первая колонка — понедельник: ru.weekStartsOn = 1.
    const weekdays = [...html.matchAll(/aria-label="([^"]+)"[^>]*class="[^"]*rdp-weekday/g)].map(
      (match) => match[1]
    );
    expect(weekdays[0]).toBe('понедельник');
  });

  it('свои formatters и weekStartsOn главнее локали', () => {
    const html = inRu(
      <Calendar
        mode="single"
        defaultMonth={month}
        weekStartsOn={0}
        formatters={{ formatCaption: () => 'свой заголовок' }}
      />
    );
    expect(html).toContain('свой заголовок');
    const weekdays = [...html.matchAll(/aria-label="([^"]+)"[^>]*class="[^"]*rdp-weekday/g)].map(
      (match) => match[1]
    );
    expect(weekdays[0]).toBe('воскресенье');
  });
});
