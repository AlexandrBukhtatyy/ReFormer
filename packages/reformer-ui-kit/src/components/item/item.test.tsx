import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  Item,
  ItemGroup,
  ItemSeparator,
  ItemMedia,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
  ItemHeader,
  ItemFooter,
} from './index';

describe('Item (base, compound presentational)', () => {
  it('каждая часть несёт собственный data-slot', () => {
    const html = renderToStaticMarkup(
      <ItemGroup>
        <Item>
          <ItemHeader>Шапка</ItemHeader>
          <ItemMedia>M</ItemMedia>
          <ItemContent>
            <ItemTitle>Заголовок</ItemTitle>
            <ItemDescription>Описание</ItemDescription>
          </ItemContent>
          <ItemActions>Действия</ItemActions>
          <ItemFooter>Подвал</ItemFooter>
        </Item>
        <ItemSeparator />
      </ItemGroup>
    );
    expect(html).toContain('data-slot="item-group"');
    expect(html).toContain('data-slot="item"');
    expect(html).toContain('data-slot="item-header"');
    expect(html).toContain('data-slot="item-media"');
    expect(html).toContain('data-slot="item-content"');
    expect(html).toContain('data-slot="item-title"');
    expect(html).toContain('data-slot="item-description"');
    expect(html).toContain('data-slot="item-actions"');
    expect(html).toContain('data-slot="item-footer"');
    expect(html).toContain('data-slot="item-separator"');
  });

  it('Item — <div> с дефолтными data-variant / data-size и базовыми стилями', () => {
    const html = renderToStaticMarkup(<Item>X</Item>);
    expect(html).toMatch(/^<div/);
    expect(html).toContain('data-variant="default"');
    expect(html).toContain('data-size="default"');
    expect(html).toContain('rounded-md');
    expect(html).toContain('bg-transparent');
    expect(html).toContain('>X</div>');
  });

  it('variant / size пробрасываются в data-атрибуты и классы (cva)', () => {
    const html = renderToStaticMarkup(
      <Item variant="outline" size="sm">
        X
      </Item>
    );
    expect(html).toContain('data-variant="outline"');
    expect(html).toContain('data-size="sm"');
    expect(html).toContain('border-border');
    expect(html).toContain('px-4');
  });

  it('className мёржится (tailwind-merge, caller wins)', () => {
    const html = renderToStaticMarkup(<Item className="bg-red-500">X</Item>);
    expect(html).toContain('bg-red-500');
    expect(html).not.toContain('bg-transparent');
  });

  it('прокидывает произвольные div-props (id, data-*)', () => {
    const html = renderToStaticMarkup(
      <Item id="i1" data-testid="item-x">
        X
      </Item>
    );
    expect(html).toContain('id="i1"');
    expect(html).toContain('data-testid="item-x"');
  });

  it('asChild рендерит дочерний элемент (Slot) с data-slot="item"', () => {
    const html = renderToStaticMarkup(
      <Item asChild>
        <a href="/x">Ссылка</a>
      </Item>
    );
    expect(html).toMatch(/^<a/);
    expect(html).toContain('href="/x"');
    expect(html).toContain('data-slot="item"');
    expect(html).toContain('>Ссылка</a>');
  });

  it('ItemGroup — контейнер с role="list"', () => {
    const html = renderToStaticMarkup(<ItemGroup>X</ItemGroup>);
    expect(html).toContain('role="list"');
    expect(html).toContain('data-slot="item-group"');
  });

  it('ItemMedia — variant пробрасывается в data-variant', () => {
    const html = renderToStaticMarkup(<ItemMedia variant="icon">M</ItemMedia>);
    expect(html).toContain('data-variant="icon"');
    expect(html).toContain('bg-muted');
  });

  it('ItemDescription рендерится как <p> (muted-foreground)', () => {
    const html = renderToStaticMarkup(<ItemDescription>Текст</ItemDescription>);
    expect(html).toMatch(/^<p/);
    expect(html).toContain('text-muted-foreground');
    expect(html).toContain('>Текст</p>');
  });

  it('ItemTitle рендерит текст и полужирный шрифт', () => {
    const html = renderToStaticMarkup(<ItemTitle>Тариф</ItemTitle>);
    expect(html).toContain('font-medium');
    expect(html).toContain('>Тариф</div>');
  });
});
