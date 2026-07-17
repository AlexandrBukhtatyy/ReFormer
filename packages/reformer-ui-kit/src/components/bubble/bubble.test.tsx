import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BubbleGroup, Bubble, BubbleContent, BubbleReactions } from './index';

// Bubble — compound-набор презентационных div'ов (+ Slot-полиморфизм у BubbleContent),
// не form-control. Portal нет — всё рендерится инлайн, поэтому SSR-разметку можно проверять
// напрямую (renderToStaticMarkup + regex).

describe('Bubble (base, compound)', () => {
  it('BubbleGroup рендерит <div> со своим data-slot', () => {
    const html = renderToStaticMarkup(<BubbleGroup>x</BubbleGroup>);
    expect(html).toContain('data-slot="bubble-group"');
    expect(html).toMatch(/<div[^>]*data-slot="bubble-group"/);
  });

  it('Bubble рендерит <div> с data-slot и дефолтными data-variant/data-align', () => {
    const html = renderToStaticMarkup(
      <Bubble>
        <BubbleContent>Привет</BubbleContent>
      </Bubble>
    );
    expect(html).toContain('data-slot="bubble"');
    expect(html).toContain('data-variant="default"');
    expect(html).toContain('data-align="start"');
    expect(html).toContain('data-slot="bubble-content"');
    expect(html).toContain('>Привет');
  });

  it('Bubble прокидывает variant в data-атрибут', () => {
    const html = renderToStaticMarkup(<Bubble variant="destructive">x</Bubble>);
    expect(html).toContain('data-variant="destructive"');
  });

  it('Bubble прокидывает align="end" в data-атрибут', () => {
    const html = renderToStaticMarkup(<Bubble align="end">x</Bubble>);
    expect(html).toContain('data-align="end"');
  });

  it('variant/align не протекают как «сырые» html-атрибуты', () => {
    const html = renderToStaticMarkup(
      <Bubble variant="secondary" align="end">
        x
      </Bubble>
    );
    // оба потреблены компонентом и выражены только через data-*
    expect(html).not.toMatch(/\salign="end"/);
    expect(html).not.toMatch(/\svariant="secondary"/);
  });

  it('BubbleContent asChild рендерит дочерний элемент вместо <div>, сохраняя data-slot', () => {
    const html = renderToStaticMarkup(
      <Bubble>
        <BubbleContent asChild>
          <button type="button">Отправить</button>
        </BubbleContent>
      </Bubble>
    );
    expect(html).toContain('<button');
    expect(html).toContain('data-slot="bubble-content"');
    expect(html).toContain('>Отправить');
  });

  it('BubbleReactions рендерит <div> с data-slot и дефолтными data-side/data-align', () => {
    const html = renderToStaticMarkup(<BubbleReactions>👍</BubbleReactions>);
    expect(html).toContain('data-slot="bubble-reactions"');
    expect(html).toContain('data-side="bottom"');
    expect(html).toContain('data-align="end"');
  });

  it('BubbleReactions прокидывает side/align в data-атрибуты', () => {
    const html = renderToStaticMarkup(
      <BubbleReactions side="top" align="start">
        ❤️
      </BubbleReactions>
    );
    expect(html).toContain('data-side="top"');
    expect(html).toContain('data-align="start"');
  });

  it('className мёржится на Bubble (tailwind-merge, caller wins)', () => {
    const html = renderToStaticMarkup(<Bubble className="bg-red-500">x</Bubble>);
    expect(html).toContain('bg-red-500');
  });

  it('прокидывает произвольные props (напр. data-testid) на Bubble', () => {
    const html = renderToStaticMarkup(<Bubble data-testid="msg-1">x</Bubble>);
    expect(html).toContain('data-testid="msg-1"');
  });
});
