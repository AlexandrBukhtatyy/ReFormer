import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  Attachment,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentContent,
  AttachmentTitle,
  AttachmentDescription,
  AttachmentActions,
  AttachmentAction,
  AttachmentTrigger,
  attachmentVariants,
  attachmentMediaVariants,
} from './index';

// Attachment — презентационный AI-примитив (div/span/Button), Portal нет → всё в SSR доступно.
describe('Attachment (base)', () => {
  it('рендерит корень с data-slot и дефолтными data-state/size/orientation', () => {
    const html = renderToStaticMarkup(<Attachment>файл</Attachment>);
    expect(html).toContain('data-slot="attachment"');
    expect(html).toContain('data-state="done"');
    expect(html).toContain('data-size="default"');
    expect(html).toContain('data-orientation="horizontal"');
    expect(html).toContain('>файл</div>');
  });

  it('прокидывает state/size/orientation в data-атрибуты', () => {
    const html = renderToStaticMarkup(
      <Attachment state="error" size="xs" orientation="vertical" />
    );
    expect(html).toContain('data-state="error"');
    expect(html).toContain('data-size="xs"');
    expect(html).toContain('data-orientation="vertical"');
  });

  it('AttachmentMedia несёт data-slot и data-variant (image)', () => {
    const html = renderToStaticMarkup(
      <AttachmentMedia variant="image">
        <img src="/x.png" alt="" />
      </AttachmentMedia>
    );
    expect(html).toContain('data-slot="attachment-media"');
    expect(html).toContain('data-variant="image"');
    expect(html).toContain('<img');
  });

  it('AttachmentContent / Title / Description рендерят свои data-slot', () => {
    const html = renderToStaticMarkup(
      <AttachmentContent>
        <AttachmentTitle>report.pdf</AttachmentTitle>
        <AttachmentDescription>1.2 МБ</AttachmentDescription>
      </AttachmentContent>
    );
    expect(html).toContain('data-slot="attachment-content"');
    expect(html).toContain('data-slot="attachment-title"');
    expect(html).toContain('data-slot="attachment-description"');
    expect(html).toContain('report.pdf');
    expect(html).toContain('1.2 МБ');
  });

  it('AttachmentAction — Button (ghost, icon-xs по умолчанию) с data-slot', () => {
    const html = renderToStaticMarkup(
      <AttachmentActions>
        <AttachmentAction aria-label="Удалить">×</AttachmentAction>
      </AttachmentActions>
    );
    expect(html).toContain('data-slot="attachment-actions"');
    expect(html).toContain('data-slot="attachment-action"');
    expect(html).toContain('data-variant="ghost"');
    expect(html).toContain('data-size="icon-xs"');
    expect(html).toContain('<button');
    expect(html).toContain('aria-label="Удалить"');
  });

  it('AttachmentTrigger — <button type=button> по умолчанию', () => {
    const html = renderToStaticMarkup(<AttachmentTrigger>открыть</AttachmentTrigger>);
    expect(html).toContain('data-slot="attachment-trigger"');
    expect(html).toContain('<button');
    expect(html).toContain('type="button"');
  });

  it('AttachmentTrigger asChild — рендерит дочерний <a> вместо <button>', () => {
    const html = renderToStaticMarkup(
      <AttachmentTrigger asChild>
        <a href="/file">Скачать</a>
      </AttachmentTrigger>
    );
    expect(html).toContain('data-slot="attachment-trigger"');
    expect(html).toContain('<a');
    expect(html).toContain('href="/file"');
    expect(html).not.toContain('<button');
  });

  it('AttachmentGroup несёт data-slot и оборачивает вложенные Attachment', () => {
    const html = renderToStaticMarkup(
      <AttachmentGroup>
        <Attachment />
        <Attachment />
      </AttachmentGroup>
    );
    expect(html).toContain('data-slot="attachment-group"');
    expect((html.match(/data-slot="attachment"/g) ?? []).length).toBe(2);
  });

  it('прокидывает произвольные props (data-testid) на корень', () => {
    const html = renderToStaticMarkup(<Attachment data-testid="att-1" />);
    expect(html).toContain('data-testid="att-1"');
  });

  it('className мёржится (tailwind-merge, caller wins)', () => {
    const html = renderToStaticMarkup(<Attachment className="bg-red-500" />);
    expect(html).toContain('bg-red-500');
  });

  it('cva-хелперы экспортируются и генерируют классы', () => {
    expect(attachmentVariants({ size: 'sm', orientation: 'vertical' })).toContain('flex-col');
    expect(attachmentMediaVariants({ variant: 'image' })).toContain('opacity-60');
  });

  it('все под-компоненты экспортируются', () => {
    for (const cmp of [
      Attachment,
      AttachmentGroup,
      AttachmentMedia,
      AttachmentContent,
      AttachmentTitle,
      AttachmentDescription,
      AttachmentActions,
      AttachmentAction,
      AttachmentTrigger,
    ]) {
      expect(typeof cmp).toBe('function');
    }
  });
});
