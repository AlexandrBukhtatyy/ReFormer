import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RadioGroup, type RadioGroupProps } from './radio-group';

const OPTIONS = [
  { value: 'consumer', label: 'Потребительский' },
  { value: 'mortgage', label: 'Ипотека' },
  { value: 'auto', label: 'Авто' },
];

const render = (props: Partial<RadioGroupProps> = {}) =>
  renderToStaticMarkup(
    createElement(RadioGroup, { options: OPTIONS, ...props } as RadioGroupProps)
  );

// Открывающий тег контейнера (до первого `>`) — на нём должны сидеть role и aria-*.
const openTag = (html: string) => html.slice(0, html.indexOf('>') + 1);

const inputNames = (html: string) =>
  [...html.matchAll(/<input\b[^>]*\sname="([^"]*)"/g)].map((m) => m[1]);

describe('RadioGroup — семантика группы (a11y)', () => {
  it('контейнер помечен role="radiogroup"', () => {
    const html = render({ value: 'consumer' });
    expect(openTag(html)).toContain('role="radiogroup"');
  });

  it('все radio разделяют один общий name (нативный одиночный выбор + стрелки)', () => {
    const html = render({ id: 'loanType', value: 'consumer' });
    const names = inputNames(html);
    expect(names).toHaveLength(OPTIONS.length);
    // единый name => одна нативная группа
    expect(new Set(names).size).toBe(1);
    // в реальном пути FormField пробрасывает id как имя группы
    expect(names[0]).toBe('loanType');
  });

  it('name выводится из data-testid, если id не задан', () => {
    const html = render({ 'data-testid': 'loan-type', value: 'consumer' });
    const names = inputNames(html);
    expect(new Set(names).size).toBe(1);
    expect(names[0]).toBe('loan-type');
  });

  it('без id/testid всё равно проставляется единый непустой name', () => {
    const html = render({ value: 'consumer' });
    const names = inputNames(html);
    expect(names).toHaveLength(OPTIONS.length);
    expect(new Set(names).size).toBe(1);
    expect(names[0]).not.toBe('');
  });

  it('aria-* от FormField попадают на контейнер-radiogroup, а не теряются', () => {
    const html = render({
      id: 'loanType-control',
      'aria-labelledby': 'loanType-label',
      'aria-invalid': true,
      'aria-describedby': 'loanType-error',
      value: 'consumer',
    } as Partial<RadioGroupProps>);
    const tag = openTag(html);
    expect(tag).toContain('role="radiogroup"');
    expect(tag).toContain('id="loanType-control"');
    expect(tag).toContain('aria-labelledby="loanType-label"');
    expect(tag).toContain('aria-invalid="true"');
    expect(tag).toContain('aria-describedby="loanType-error"');
  });

  it('явный name имеет приоритет над id', () => {
    const html = render({ id: 'ctl-id', name: 'group-name', value: 'consumer' });
    expect(inputNames(html).every((n) => n === 'group-name')).toBe(true);
  });
});
