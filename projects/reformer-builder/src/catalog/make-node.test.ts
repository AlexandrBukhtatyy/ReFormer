import { describe, expect, it } from 'vitest';
import { parseOperator, type JsonNode } from '@reformer/renderer-json';
import { COMPOUND_TEMPLATES, makeNodeFor, leafComponentNode, partNode } from './make-node';
import { getCatalog } from './index';

describe('makeNodeFor — листовые компоненты', () => {
  it('Icon — без children и без space-y-4 (лист)', () => {
    const node = makeNodeFor('Icon', 'container') as unknown as Record<string, unknown>;
    expect(node.component).toBe('$component(Icon)');
    expect('children' in node).toBe(false);
    expect(node.componentProps).toEqual({});
  });

  it('прочие leaf-компоненты — тоже без children', () => {
    for (const name of ['Separator', 'Spinner', 'Skeleton', 'Progress']) {
      const node = makeNodeFor(name, 'container') as unknown as Record<string, unknown>;
      expect('children' in node).toBe(false);
    }
  });

  it('обычный контейнер (Box) — с пустым children', () => {
    const node = makeNodeFor('Box', 'container') as unknown as Record<string, unknown>;
    expect(node.children).toEqual([]);
  });

  it('$html(br) — void-тег без children; $html(div) — контейнер с children', () => {
    const br = makeNodeFor('$html(br)', 'container') as unknown as Record<string, unknown>;
    expect('children' in br).toBe(false);
    const div = makeNodeFor('$html(div)', 'container') as unknown as Record<string, unknown>;
    expect(div.children).toEqual([]);
  });

  it('leafComponentNode', () => {
    expect(leafComponentNode('Icon')).toEqual({
      component: '$component(Icon)',
      componentProps: {},
    });
  });
});

/** Все `$component`-имена дерева (корень + потомки) — для проверки шаблонов против каталога. */
function componentNames(node: JsonNode): string[] {
  const self = parseOperator((node as { component?: unknown }).component);
  const children = ((node as { children?: JsonNode[] }).children ?? []).flatMap(componentNames);
  return self?.op === 'component' ? [self.arg, ...children] : children;
}

describe('makeNodeFor — compound-компоненты', () => {
  it('Alert собирается из частей, а не из голого текста (grid-cols-[0_1fr] его рассыпает)', () => {
    const node = makeNodeFor('Alert', 'container') as unknown as Record<string, unknown>;
    expect('text' in node).toBe(false);
    expect(componentNames(node as unknown as JsonNode)).toEqual([
      'Alert',
      'AlertTitle',
      'AlertDescription',
    ]);
    // `space-y-4` контейнера тут вреден — у Alert собственный gap-y.
    expect('componentProps' in node).toBe(false);
  });

  it('каждый шаблон состоит из имён, которые есть в каталоге', () => {
    const known = new Set(getCatalog().map((e) => e.name));
    for (const [name, make] of Object.entries(COMPOUND_TEMPLATES)) {
      for (const used of componentNames(make())) {
        expect(known, `${name}: неизвестное имя ${used}`).toContain(used);
      }
    }
  });

  it('корень шаблона — сам компонент, и части принадлежат ему', () => {
    const parentByName = new Map(getCatalog().map((e) => [e.name, e.compoundParent]));
    for (const [name, make] of Object.entries(COMPOUND_TEMPLATES)) {
      const [root, ...parts] = componentNames(make());
      expect(root).toBe(name);
      for (const part of parts) {
        expect(parentByName.get(part), `${name}: ${part} — не его часть`).toBe(name);
      }
    }
  });

  it('Radix-части получают обязательный value сразу (иначе компонент не работает)', () => {
    const tabs = COMPOUND_TEMPLATES.Tabs() as unknown as {
      componentProps: Record<string, unknown>;
      children: Array<{ component: string; componentProps?: Record<string, unknown> }>;
    };
    expect(tabs.componentProps.defaultValue).toBe('tab-1');
    const contents = tabs.children.filter((c) => c.component === '$component(TabsContent)');
    expect(contents.map((c) => c.componentProps?.value)).toEqual(['tab-1', 'tab-2']);
  });

  it('часть, брошенная отдельно, идёт без className-обёртки контейнера', () => {
    const title = makeNodeFor('AlertTitle', 'container', 'Alert') as unknown as Record<
      string,
      unknown
    >;
    expect(title.component).toBe('$component(AlertTitle)');
    expect('componentProps' in title).toBe(false);
    // Текстовой части кладём заготовку, структурной — пустой children.
    expect(title.text).toBe('Текст');
    expect(partNode('CardContent')).toEqual({ component: '$component(CardContent)', children: [] });
  });
});
