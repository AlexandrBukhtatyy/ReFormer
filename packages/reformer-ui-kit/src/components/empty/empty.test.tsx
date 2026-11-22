import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
  emptyMediaVariants,
} from './index';

describe('Empty (base, compound presentational)', () => {
  it('каждая часть несёт собственный data-slot', () => {
    const html = renderToStaticMarkup(
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <svg aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>Пусто</EmptyTitle>
          <EmptyDescription>Здесь пока ничего нет.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>Действие</EmptyContent>
      </Empty>
    );
    expect(html).toContain('data-slot="empty"');
    expect(html).toContain('data-slot="empty-header"');
    expect(html).toContain('data-slot="empty-icon"');
    expect(html).toContain('data-slot="empty-title"');
    expect(html).toContain('data-slot="empty-description"');
    expect(html).toContain('data-slot="empty-content"');
  });

  it('Empty — <div> с пунктирной рамкой и центрированием', () => {
    const html = renderToStaticMarkup(<Empty>X</Empty>);
    expect(html).toMatch(/^<div/);
    expect(html).toContain('border-dashed');
    expect(html).toContain('items-center');
    expect(html).toContain('justify-center');
    expect(html).toContain('>X</div>');
  });

  it('EmptyMedia: дефолтный variant — transparent, data-variant="default"', () => {
    const html = renderToStaticMarkup(<EmptyMedia>M</EmptyMedia>);
    expect(html).toContain('data-variant="default"');
    expect(html).toContain('bg-transparent');
  });

  it('EmptyMedia variant="icon" — muted-бокс с data-variant="icon"', () => {
    const html = renderToStaticMarkup(<EmptyMedia variant="icon">M</EmptyMedia>);
    expect(html).toContain('data-variant="icon"');
    expect(html).toContain('bg-muted');
    expect(html).toContain('rounded-lg');
  });

  it('emptyMediaVariants экспортируется и генерирует классы', () => {
    const cls = emptyMediaVariants({ variant: 'icon' });
    expect(cls).toContain('bg-muted');
    expect(cls).toContain('size-10');
  });

  it('EmptyTitle рендерит текст и medium-шрифт', () => {
    const html = renderToStaticMarkup(<EmptyTitle>Нет данных</EmptyTitle>);
    expect(html).toContain('font-medium');
    expect(html).toContain('>Нет данных</div>');
  });

  it('EmptyDescription стилизует вложенные ссылки', () => {
    const html = renderToStaticMarkup(
      <EmptyDescription>
        Попробуйте <a href="/x">обновить</a>.
      </EmptyDescription>
    );
    expect(html).toContain('data-slot="empty-description"');
    expect(html).toContain('underline-offset-4');
    expect(html).toContain('<a href="/x">обновить</a>');
  });

  it('className мёржится (tailwind-merge, caller wins)', () => {
    const html = renderToStaticMarkup(<Empty className="border-solid">X</Empty>);
    expect(html).toContain('border-solid');
    expect(html).not.toContain('border-dashed');
  });

  it('прокидывает произвольные div-props (напр. id, data-*)', () => {
    const html = renderToStaticMarkup(
      <Empty id="e1" data-testid="empty-x">
        X
      </Empty>
    );
    expect(html).toContain('id="e1"');
    expect(html).toContain('data-testid="empty-x"');
  });
});
