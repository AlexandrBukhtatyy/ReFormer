import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
} from './index';

describe('Breadcrumb (base, compound presentational)', () => {
  it('каждая часть несёт собственный data-slot', () => {
    const html = renderToStaticMarkup(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Главная</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbEllipsis />
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Текущая</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
    expect(html).toContain('data-slot="breadcrumb"');
    expect(html).toContain('data-slot="breadcrumb-list"');
    expect(html).toContain('data-slot="breadcrumb-item"');
    expect(html).toContain('data-slot="breadcrumb-link"');
    expect(html).toContain('data-slot="breadcrumb-separator"');
    expect(html).toContain('data-slot="breadcrumb-ellipsis"');
    expect(html).toContain('data-slot="breadcrumb-page"');
  });

  it('Breadcrumb — <nav> с aria-label="breadcrumb"', () => {
    const html = renderToStaticMarkup(<Breadcrumb>X</Breadcrumb>);
    expect(html).toMatch(/^<nav/);
    expect(html).toContain('aria-label="breadcrumb"');
    expect(html).toContain('>X</nav>');
  });

  it('BreadcrumbList — <ol> с базовыми стилями', () => {
    const html = renderToStaticMarkup(<BreadcrumbList>X</BreadcrumbList>);
    expect(html).toMatch(/^<ol/);
    expect(html).toContain('flex-wrap');
    expect(html).toContain('text-muted-foreground');
  });

  it('BreadcrumbItem — <li>', () => {
    const html = renderToStaticMarkup(<BreadcrumbItem>X</BreadcrumbItem>);
    expect(html).toMatch(/^<li/);
    expect(html).toContain('inline-flex');
  });

  it('BreadcrumbLink — <a> по умолчанию, прокидывает href', () => {
    const html = renderToStaticMarkup(<BreadcrumbLink href="/settings">Настройки</BreadcrumbLink>);
    expect(html).toMatch(/^<a/);
    expect(html).toContain('href="/settings"');
    expect(html).toContain('hover:text-foreground');
    expect(html).toContain('>Настройки</a>');
  });

  it('BreadcrumbLink с asChild рендерит переданный элемент (Slot)', () => {
    const html = renderToStaticMarkup(
      <BreadcrumbLink asChild>
        <a href="/profile">Профиль</a>
      </BreadcrumbLink>
    );
    // Slot схлопывает обёртку в <a> потомка, перенося data-slot и className
    expect(html).toMatch(/^<a/);
    expect(html).toContain('href="/profile"');
    expect(html).toContain('data-slot="breadcrumb-link"');
    expect(html).toContain('>Профиль</a>');
  });

  it('BreadcrumbPage — <span> с role="link" и aria-current="page"', () => {
    const html = renderToStaticMarkup(<BreadcrumbPage>Текущая</BreadcrumbPage>);
    expect(html).toMatch(/^<span/);
    expect(html).toContain('role="link"');
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('>Текущая</span>');
  });

  it('BreadcrumbSeparator — <li> с дефолтной иконкой ChevronRight (svg)', () => {
    const html = renderToStaticMarkup(<BreadcrumbSeparator />);
    expect(html).toMatch(/^<li/);
    expect(html).toContain('role="presentation"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('<svg');
    expect(html).toContain('lucide-chevron-right');
  });

  it('BreadcrumbSeparator принимает кастомный разделитель через children', () => {
    const html = renderToStaticMarkup(<BreadcrumbSeparator>/</BreadcrumbSeparator>);
    expect(html).toContain('/</li>');
    expect(html).not.toContain('<svg');
  });

  it('BreadcrumbEllipsis — <span> с иконкой и sr-only подписью', () => {
    const html = renderToStaticMarkup(<BreadcrumbEllipsis />);
    expect(html).toMatch(/^<span/);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('<svg');
    expect(html).toContain('sr-only');
    expect(html).toContain('More');
  });

  it('className мёржится (tailwind-merge, caller wins)', () => {
    const html = renderToStaticMarkup(<BreadcrumbList className="text-red-500">X</BreadcrumbList>);
    expect(html).toContain('text-red-500');
    expect(html).not.toContain('text-muted-foreground');
  });

  it('прокидывает произвольные props (напр. id, data-*)', () => {
    const html = renderToStaticMarkup(
      <Breadcrumb id="bc1" data-testid="breadcrumb-x">
        X
      </Breadcrumb>
    );
    expect(html).toContain('id="bc1"');
    expect(html).toContain('data-testid="breadcrumb-x"');
  });
});
