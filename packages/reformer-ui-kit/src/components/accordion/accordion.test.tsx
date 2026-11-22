import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from './index';

// Accordion — compound поверх Radix Accordion (не form-control). Content рендерится инлайн
// (без Portal), но Radix монтирует его только у раскрытого item — поэтому для проверки
// content-части открываем item через defaultValue.

describe('Accordion (base, compound over Radix)', () => {
  it('Root / Item / Trigger несут собственный data-slot', () => {
    const html = renderToStaticMarkup(
      <Accordion type="single" collapsible>
        <AccordionItem value="a">
          <AccordionTrigger>Вопрос</AccordionTrigger>
          <AccordionContent>Ответ</AccordionContent>
        </AccordionItem>
      </Accordion>
    );
    expect(html).toContain('data-slot="accordion"');
    expect(html).toContain('data-slot="accordion-item"');
    expect(html).toContain('data-slot="accordion-trigger"');
  });

  it('раскрытый item (defaultValue) рендерит content с data-slot', () => {
    const html = renderToStaticMarkup(
      <Accordion type="single" defaultValue="a" collapsible>
        <AccordionItem value="a">
          <AccordionTrigger>Вопрос</AccordionTrigger>
          <AccordionContent>Ответ</AccordionContent>
        </AccordionItem>
      </Accordion>
    );
    expect(html).toContain('data-slot="accordion-content"');
    expect(html).toContain('Ответ');
  });

  it('Trigger — <button> с ролью-триггером и aria-expanded', () => {
    const html = renderToStaticMarkup(
      <Accordion type="single" collapsible>
        <AccordionItem value="a">
          <AccordionTrigger>Заголовок</AccordionTrigger>
          <AccordionContent>x</AccordionContent>
        </AccordionItem>
      </Accordion>
    );
    // Radix Header оборачивает Trigger-<button>
    expect(html).toMatch(/<button[^>]*data-slot="accordion-trigger"/);
    expect(html).toContain('aria-expanded');
    expect(html).toContain('>Заголовок');
  });

  it('заголовок секции — h3 по умолчанию (как в Radix), с data-state и классом flex', () => {
    const html = renderToStaticMarkup(
      <Accordion type="single">
        <AccordionItem value="a">
          <AccordionTrigger>Вопрос</AccordionTrigger>
        </AccordionItem>
      </Accordion>
    );
    expect(html).toMatch(/<h3[^>]*data-state="closed"[^>]*class="flex"[^>]*><button/);
  });

  it('headingLevel у Accordion задаёт уровень всех секций; у Trigger — переопределяет свою', () => {
    const html = renderToStaticMarkup(
      <Accordion type="multiple" headingLevel={2}>
        <AccordionItem value="a">
          <AccordionTrigger>Первая</AccordionTrigger>
        </AccordionItem>
        <AccordionItem value="b">
          <AccordionTrigger headingLevel={4}>Вторая</AccordionTrigger>
        </AccordionItem>
      </Accordion>
    );
    expect(html).toMatch(/<h2[^>]*><button[^>]*>Первая/);
    expect(html).toMatch(/<h4[^>]*><button[^>]*>Вторая/);
    expect(html).not.toContain('<h3');
  });

  it('Trigger содержит chevron-иконку (svg)', () => {
    const html = renderToStaticMarkup(
      <Accordion type="single" collapsible>
        <AccordionItem value="a">
          <AccordionTrigger>Заголовок</AccordionTrigger>
          <AccordionContent>x</AccordionContent>
        </AccordionItem>
      </Accordion>
    );
    expect(html).toContain('<svg');
    expect(html).toContain('lucide-chevron-down');
  });

  it('className мёржится на item (tailwind-merge, caller wins)', () => {
    const html = renderToStaticMarkup(
      <Accordion type="single" collapsible>
        <AccordionItem value="a" className="border-b-0">
          <AccordionTrigger>t</AccordionTrigger>
          <AccordionContent>c</AccordionContent>
        </AccordionItem>
      </Accordion>
    );
    expect(html).toContain('border-b-0');
  });

  it('прокидывает произвольные props (напр. data-testid) на Item', () => {
    const html = renderToStaticMarkup(
      <Accordion type="single" collapsible>
        <AccordionItem value="a" data-testid="faq-1">
          <AccordionTrigger>t</AccordionTrigger>
          <AccordionContent>c</AccordionContent>
        </AccordionItem>
      </Accordion>
    );
    expect(html).toContain('data-testid="faq-1"');
  });

  it('поддерживает type="multiple" (несколько раскрытых секций)', () => {
    const html = renderToStaticMarkup(
      <Accordion type="multiple" defaultValue={['a', 'b']}>
        <AccordionItem value="a">
          <AccordionTrigger>A</AccordionTrigger>
          <AccordionContent>Content A</AccordionContent>
        </AccordionItem>
        <AccordionItem value="b">
          <AccordionTrigger>B</AccordionTrigger>
          <AccordionContent>Content B</AccordionContent>
        </AccordionItem>
      </Accordion>
    );
    expect(html).toContain('Content A');
    expect(html).toContain('Content B');
  });
});
