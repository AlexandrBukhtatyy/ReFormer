import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from './index';

// Collapsible — compound поверх Radix Collapsible (не form-control). Content монтируется
// только у раскрытого блока (Radix Presence), поэтому для проверки content-части
// открываем блок через defaultOpen.

describe('Collapsible (base, compound over Radix)', () => {
  it('Root / Trigger несут собственный data-slot', () => {
    const html = renderToStaticMarkup(
      <Collapsible>
        <CollapsibleTrigger>Показать</CollapsibleTrigger>
        <CollapsibleContent>Детали</CollapsibleContent>
      </Collapsible>
    );
    expect(html).toContain('data-slot="collapsible"');
    expect(html).toContain('data-slot="collapsible-trigger"');
  });

  it('раскрытый блок (defaultOpen) рендерит content с data-slot', () => {
    const html = renderToStaticMarkup(
      <Collapsible defaultOpen>
        <CollapsibleTrigger>Показать</CollapsibleTrigger>
        <CollapsibleContent>Детали</CollapsibleContent>
      </Collapsible>
    );
    expect(html).toContain('data-slot="collapsible-content"');
    expect(html).toContain('Детали');
  });

  it('Trigger — <button> с data-slot и aria-expanded', () => {
    const html = renderToStaticMarkup(
      <Collapsible>
        <CollapsibleTrigger>Заголовок</CollapsibleTrigger>
        <CollapsibleContent>x</CollapsibleContent>
      </Collapsible>
    );
    expect(html).toMatch(/<button[^>]*data-slot="collapsible-trigger"/);
    expect(html).toContain('aria-expanded');
    expect(html).toContain('>Заголовок');
  });

  it('data-state отражает открытое/закрытое состояние', () => {
    const closed = renderToStaticMarkup(
      <Collapsible>
        <CollapsibleTrigger>t</CollapsibleTrigger>
        <CollapsibleContent>c</CollapsibleContent>
      </Collapsible>
    );
    expect(closed).toContain('data-state="closed"');

    const open = renderToStaticMarkup(
      <Collapsible defaultOpen>
        <CollapsibleTrigger>t</CollapsibleTrigger>
        <CollapsibleContent>c</CollapsibleContent>
      </Collapsible>
    );
    expect(open).toContain('data-state="open"');
  });

  it('прокидывает произвольные props (напр. data-testid) на Root', () => {
    const html = renderToStaticMarkup(
      <Collapsible data-testid="faq-block">
        <CollapsibleTrigger>t</CollapsibleTrigger>
        <CollapsibleContent>c</CollapsibleContent>
      </Collapsible>
    );
    expect(html).toContain('data-testid="faq-block"');
  });

  it('disabled прокидывается на Trigger (data-disabled)', () => {
    const html = renderToStaticMarkup(
      <Collapsible disabled>
        <CollapsibleTrigger>t</CollapsibleTrigger>
        <CollapsibleContent>c</CollapsibleContent>
      </Collapsible>
    );
    expect(html).toContain('data-disabled');
  });
});
