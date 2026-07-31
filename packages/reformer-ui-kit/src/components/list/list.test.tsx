/**
 * Unit-тесты ui-kit List — обёртка display-списка для renderer-json.
 *
 * Рендер через renderToStaticMarkup (в пакете нет DOM-окружения). Проверяем: рендерит children,
 * мержит className, маппит testId → data-testid и НЕ протекает инъектированными рендерером пропсами
 * (array/item/initialValue/fieldWrapper) в DOM.
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { List } from './variants/base/list';

describe('List', () => {
  it('рендерит children в контейнере role="list"', () => {
    const html = renderToStaticMarkup(
      <List>
        <span>a</span>
        <span>b</span>
      </List>
    );
    expect(html).toContain('role="list"');
    expect(html).toContain('<span>a</span>');
    expect(html).toContain('<span>b</span>');
  });

  it('мержит className поверх дефолтного space-y-2 и маппит testId', () => {
    const html = renderToStaticMarkup(<List className="mt-4" testId="alerts" />);
    expect(html).toContain('space-y-2');
    expect(html).toContain('mt-4');
    expect(html).toContain('data-testid="alerts"');
  });

  it('не протекает инъектированными рендерером пропсами в DOM', () => {
    const html = renderToStaticMarkup(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <List
        array={{}}
        item={() => null}
        initialValue={() => ({})}
        fieldWrapper={(() => null) as any}
      />
    );
    expect(html).not.toContain('array');
    expect(html).not.toContain('item');
    expect(html).not.toContain('fieldWrapper');
    expect(html).not.toContain('initialValue');
  });
});
