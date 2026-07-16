import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from './index';

// Pagination — inline презентационный набор (без Portal): все части рендерятся в SSR.
function renderPagination() {
  return renderToStaticMarkup(
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious href="#prev" />
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="#1">1</PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="#2" isActive>
            2
          </PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationEllipsis />
        </PaginationItem>
        <PaginationItem>
          <PaginationNext href="#next" />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

describe('Pagination (base)', () => {
  it('каждая часть несёт собственный data-slot', () => {
    const html = renderPagination();
    expect(html).toContain('data-slot="pagination"');
    expect(html).toContain('data-slot="pagination-content"');
    expect(html).toContain('data-slot="pagination-item"');
    expect(html).toContain('data-slot="pagination-link"');
    expect(html).toContain('data-slot="pagination-ellipsis"');
  });

  it('root — <nav> с role="navigation" и aria-label="pagination"', () => {
    const html = renderPagination();
    expect(html).toContain('<nav');
    expect(html).toContain('role="navigation"');
    expect(html).toContain('aria-label="pagination"');
  });

  it('активная ссылка помечена aria-current="page" и data-active, стиль outline', () => {
    const html = renderToStaticMarkup(
      <PaginationLink href="#2" isActive>
        2
      </PaginationLink>
    );
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('data-active="true"');
    // buttonVariants variant="outline" → border
    expect(html).toContain('border');
  });

  it('неактивная ссылка — без aria-current, стиль ghost', () => {
    const html = renderToStaticMarkup(<PaginationLink href="#1">1</PaginationLink>);
    expect(html).not.toContain('aria-current');
    expect(html).toContain('hover:bg-accent');
  });

  it('PaginationPrevious — aria-label и подпись Previous', () => {
    const html = renderToStaticMarkup(<PaginationPrevious href="#prev" />);
    expect(html).toContain('aria-label="Go to previous page"');
    expect(html).toContain('Previous');
  });

  it('PaginationNext — aria-label и подпись Next', () => {
    const html = renderToStaticMarkup(<PaginationNext href="#next" />);
    expect(html).toContain('aria-label="Go to next page"');
    expect(html).toContain('Next');
  });

  it('PaginationEllipsis — aria-hidden и sr-only подпись', () => {
    const html = renderToStaticMarkup(<PaginationEllipsis />);
    expect(html).toContain('aria-hidden');
    expect(html).toContain('More pages');
    expect(html).toContain('sr-only');
  });

  it('className мёржится (tailwind-merge, caller wins)', () => {
    const html = renderToStaticMarkup(
      <Pagination className="mt-8">
        <PaginationContent />
      </Pagination>
    );
    expect(html).toContain('mt-8');
  });

  it('прокидывает произвольные props (напр. data-testid, href) на ссылку', () => {
    const html = renderToStaticMarkup(
      <PaginationLink href="/page/3" data-testid="pagination-3">
        3
      </PaginationLink>
    );
    expect(html).toContain('data-testid="pagination-3"');
    expect(html).toContain('href="/page/3"');
  });
});
