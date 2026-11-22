import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants } from './index';

// Tabs — inline compound (без Portal): все части рендерятся в SSR. defaultValue делает
// один триггер/контент активным.
function renderTabs(props?: { variant?: 'default' | 'line' }) {
  return renderToStaticMarkup(
    <Tabs defaultValue="account">
      <TabsList variant={props?.variant}>
        <TabsTrigger value="account">Аккаунт</TabsTrigger>
        <TabsTrigger value="password">Пароль</TabsTrigger>
      </TabsList>
      <TabsContent value="account">Данные аккаунта</TabsContent>
      <TabsContent value="password">Смена пароля</TabsContent>
    </Tabs>
  );
}

describe('Tabs (base, compound)', () => {
  it('каждая часть несёт собственный data-slot', () => {
    const html = renderTabs();
    expect(html).toContain('data-slot="tabs"');
    expect(html).toContain('data-slot="tabs-list"');
    expect(html).toContain('data-slot="tabs-trigger"');
    expect(html).toContain('data-slot="tabs-content"');
  });

  it('несёт ARIA-роли Radix Tabs (tablist / tab / tabpanel)', () => {
    const html = renderTabs();
    expect(html).toContain('role="tablist"');
    expect(html).toContain('role="tab"');
    expect(html).toContain('role="tabpanel"');
  });

  it('активный триггер помечен data-state="active" (по defaultValue)', () => {
    const html = renderTabs();
    expect(html).toContain('data-state="active"');
    expect(html).toContain('>Аккаунт</button>');
  });

  it('Tabs root несёт data-orientation="horizontal" по умолчанию', () => {
    const html = renderTabs();
    expect(html).toContain('data-orientation="horizontal"');
  });

  it('TabsList variant="line" проставляет data-variant="line"', () => {
    const html = renderTabs({ variant: 'line' });
    expect(html).toContain('data-variant="line"');
  });

  it('TabsList по умолчанию data-variant="default"', () => {
    const html = renderTabs();
    expect(html).toContain('data-variant="default"');
  });

  it('tabsListVariants экспортируется и генерирует классы', () => {
    const cls = tabsListVariants({ variant: 'line' });
    expect(cls).toContain('bg-transparent');
    expect(cls).toContain('inline-flex');
  });

  it('className мёржится на TabsContent (tailwind-merge, caller wins)', () => {
    const html = renderToStaticMarkup(
      <Tabs defaultValue="a">
        <TabsContent value="a" className="p-8">
          X
        </TabsContent>
      </Tabs>
    );
    expect(html).toContain('p-8');
  });

  it('прокидывает произвольные props (напр. data-testid) на триггер', () => {
    const html = renderToStaticMarkup(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a" data-testid="tabs-a">
            A
          </TabsTrigger>
        </TabsList>
      </Tabs>
    );
    expect(html).toContain('data-testid="tabs-a"');
  });
});
