/**
 * HTML-узлы RenderSchema: `component` строкой-тегом + текстовое содержимое (`text`), в том числе
 * реактивное (сигналы модели).
 *
 * Рендер проверяется через `renderToStaticMarkup` — тот же приём, что в тестах `@reformer/ui-kit`
 * (DOM-окружения в пакетах нет). Живую перерисовку по сигналу SSR не покажет, поэтому реактивность
 * проверяется как «рендер читает текущее значение сигнала» + отдельно склейка частей.
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { signal } from '@reformer/core/signals';
import { FormRenderer } from '../src/core/form-renderer';
import { isContainerRenderNode, isHtmlTagRenderNode, VOID_HTML_TAGS } from '../src/core/utils';
import type { RenderNode } from '../src/core/types';

/* eslint-disable @typescript-eslint/no-explicit-any */

const render = (node: RenderNode<any>): string =>
  renderToStaticMarkup(<FormRenderer render={() => node} />);

describe('HTML-узлы — type guards', () => {
  it('строка-тег распознаётся как контейнер', () => {
    expect(isContainerRenderNode({ component: 'div' } as any)).toBe(true);
    expect(isHtmlTagRenderNode({ component: 'div' } as any)).toBe(true);
  });

  it('React-компонент — контейнер, но не html-тег', () => {
    const Comp = (): null => null;
    expect(isContainerRenderNode({ component: Comp } as any)).toBe(true);
    expect(isHtmlTagRenderNode({ component: Comp } as any)).toBe(false);
  });

  it('пустая строка компонентом не считается', () => {
    expect(isContainerRenderNode({ component: '' } as any)).toBe(false);
  });

  it('void-теги перечислены', () => {
    expect(VOID_HTML_TAGS.has('hr')).toBe(true);
    expect(VOID_HTML_TAGS.has('br')).toBe(true);
    expect(VOID_HTML_TAGS.has('div')).toBe(false);
  });
});

describe('HTML-узлы — рендер', () => {
  it('рендерит нативный тег с DOM-атрибутами', () => {
    const html = render({
      component: 'div',
      componentProps: { className: 'p-4 bg-blue-50', id: 'notice' },
    } as any);
    expect(html).toContain('<div');
    expect(html).toContain('class="p-4 bg-blue-50"');
    expect(html).toContain('id="notice"');
  });

  it('рендерит статический текст узла', () => {
    const html = render({ component: 'h3', text: 'Итого' } as any);
    expect(html).toBe('<h3>Итого</h3>');
  });

  it('склеивает массив частей текста без разделителя', () => {
    const html = render({ component: 'p', text: ['Платёж: ', 30000, ' ₽'] } as any);
    expect(html).toBe('<p>Платёж: 30000 ₽</p>');
  });

  it('читает значение сигнала в тексте', () => {
    const monthlyPayment = signal(42500);
    const html = render({
      component: 'p',
      text: ['Платёж: ', monthlyPayment, ' ₽'],
    } as any);
    expect(html).toBe('<p>Платёж: 42500 ₽</p>');
  });

  it('отражает изменение сигнала в следующем рендере', () => {
    const name = signal('Иван');
    const node = { component: 'span', text: name } as any;
    expect(render(node)).toBe('<span>Иван</span>');
    name.value = 'Пётр';
    expect(render(node)).toBe('<span>Пётр</span>');
  });

  it('null/undefined в сигнале дают пустой текст, а не строку "null"', () => {
    const empty = signal<string | null>(null);
    const html = render({ component: 'span', text: ['Имя: ', empty] } as any);
    expect(html).toBe('<span>Имя: </span>');
  });

  it('text рендерится перед children — inline-разметка без обёрток', () => {
    const html = render({
      component: 'p',
      text: 'Внимание! ',
      children: [{ component: 'b', text: 'платёж высокий' }],
    } as any);
    expect(html).toBe('<p>Внимание! <b>платёж высокий</b></p>');
  });

  it('вкладывает html-теги и компоненты друг в друга', () => {
    const Card = ({ children }: any): any => <section data-slot="card">{children}</section>;
    const html = render({
      component: 'div',
      children: [{ component: Card, children: [{ component: 'h4', text: 'Заголовок' }] }],
    } as any);
    expect(html).toBe('<div><section data-slot="card"><h4>Заголовок</h4></section></div>');
  });

  it('void-тег рендерится без содержимого (React не должен бросить)', () => {
    const html = render({
      component: 'div',
      children: [{ component: 'hr', componentProps: { className: 'my-4' } }],
    } as any);
    expect(html).toBe('<div><hr class="my-4"/></div>');
  });

  it('selector не утекает в DOM-атрибуты html-тега', () => {
    const html = render({ component: 'div', selector: 'notice', text: 'x' } as any);
    expect(html).toBe('<div>x</div>');
    expect(html).not.toContain('selector');
  });
});
