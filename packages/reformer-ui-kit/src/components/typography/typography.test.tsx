import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  TypographyH1,
  TypographyH2,
  TypographyH3,
  TypographyH4,
  TypographyP,
  TypographyBlockquote,
  TypographyList,
  TypographyInlineCode,
  TypographyLead,
  TypographyLarge,
  TypographySmall,
  TypographyMuted,
} from './index';

// Каждый компонент: правильный тег + data-slot + ключевой класс.
const cases: Array<{
  name: string;
  html: string;
  tag: string;
  slot: string;
  cls: string;
}> = [
  {
    name: 'TypographyH1',
    html: renderToStaticMarkup(<TypographyH1>Heading</TypographyH1>),
    tag: 'h1',
    slot: 'typography-h1',
    cls: 'text-4xl',
  },
  {
    name: 'TypographyH2',
    html: renderToStaticMarkup(<TypographyH2>Heading</TypographyH2>),
    tag: 'h2',
    slot: 'typography-h2',
    cls: 'text-3xl',
  },
  {
    name: 'TypographyH3',
    html: renderToStaticMarkup(<TypographyH3>Heading</TypographyH3>),
    tag: 'h3',
    slot: 'typography-h3',
    cls: 'text-2xl',
  },
  {
    name: 'TypographyH4',
    html: renderToStaticMarkup(<TypographyH4>Heading</TypographyH4>),
    tag: 'h4',
    slot: 'typography-h4',
    cls: 'text-xl',
  },
  {
    name: 'TypographyP',
    html: renderToStaticMarkup(<TypographyP>Para</TypographyP>),
    tag: 'p',
    slot: 'typography-p',
    cls: 'leading-7',
  },
  {
    name: 'TypographyBlockquote',
    html: renderToStaticMarkup(<TypographyBlockquote>Quote</TypographyBlockquote>),
    tag: 'blockquote',
    slot: 'typography-blockquote',
    cls: 'border-l-2',
  },
  {
    name: 'TypographyList',
    html: renderToStaticMarkup(
      <TypographyList>
        <li>Item</li>
      </TypographyList>
    ),
    tag: 'ul',
    slot: 'typography-list',
    cls: 'list-disc',
  },
  {
    name: 'TypographyInlineCode',
    html: renderToStaticMarkup(<TypographyInlineCode>code</TypographyInlineCode>),
    tag: 'code',
    slot: 'typography-inline-code',
    cls: 'font-mono',
  },
  {
    name: 'TypographyLead',
    html: renderToStaticMarkup(<TypographyLead>Lead</TypographyLead>),
    tag: 'p',
    slot: 'typography-lead',
    cls: 'text-xl',
  },
  {
    name: 'TypographyLarge',
    html: renderToStaticMarkup(<TypographyLarge>Large</TypographyLarge>),
    tag: 'div',
    slot: 'typography-large',
    cls: 'text-lg',
  },
  {
    name: 'TypographySmall',
    html: renderToStaticMarkup(<TypographySmall>Small</TypographySmall>),
    tag: 'small',
    slot: 'typography-small',
    cls: 'font-medium',
  },
  {
    name: 'TypographyMuted',
    html: renderToStaticMarkup(<TypographyMuted>Muted</TypographyMuted>),
    tag: 'p',
    slot: 'typography-muted',
    cls: 'text-muted-foreground',
  },
];

describe('Typography (base)', () => {
  for (const c of cases) {
    it(`${c.name} рендерит <${c.tag}> с data-slot="${c.slot}" и классом ${c.cls}`, () => {
      expect(c.html).toContain(`<${c.tag}`);
      expect(c.html).toContain(`data-slot="${c.slot}"`);
      expect(c.html).toContain(c.cls);
    });
  }

  it('className мёржится (tailwind-merge, класс вызывающего перекрывает)', () => {
    const html = renderToStaticMarkup(<TypographyP className="mt-0">X</TypographyP>);
    expect(html).toContain('mt-0');
  });

  it('прокидывает произвольные props тега (напр. id на заголовке)', () => {
    const html = renderToStaticMarkup(<TypographyH2 id="section">Раздел</TypographyH2>);
    expect(html).toContain('id="section"');
    expect(html).toContain('>Раздел</h2>');
  });

  it('TypographyList рендерит вложенные <li>', () => {
    const html = renderToStaticMarkup(
      <TypographyList>
        <li>Первый</li>
        <li>Второй</li>
      </TypographyList>
    );
    expect(html).toContain('<li>Первый</li>');
    expect(html).toContain('<li>Второй</li>');
  });
});
