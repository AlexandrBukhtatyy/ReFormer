import { describe, expect, it } from 'vitest';
import type { JsonNode } from '@reformer/renderer-json';
import {
  COMPOUND_TEMPLATES,
  compoundTemplatesFor,
  containerNode,
  makeNodeFor,
  leafComponentNode,
  partNode,
  templateComponentNames as componentNames,
  type CompoundRecord,
} from './make-node';
import { builtinEntries } from './__fixtures__/builtin-catalog';

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
    const known = new Set(builtinEntries().map((e) => e.name));
    for (const [name, make] of Object.entries(COMPOUND_TEMPLATES)) {
      for (const used of componentNames(make())) {
        expect(known, `${name}: неизвестное имя ${used}`).toContain(used);
      }
    }
  });

  it('корень шаблона — сам компонент, и части принадлежат ему', () => {
    const parentByName = new Map(builtinEntries().map((e) => [e.name, e.compoundParent]));
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
    // Текстовой части кладём заготовку текста в children, структурной — пустой children.
    expect(title.children).toEqual(['Текст']);
    expect(partNode('CardContent')).toEqual({ component: '$component(CardContent)', children: [] });
  });

  it('обход имён шаблона: текстовые дети имён не дают', () => {
    expect(componentNames(COMPOUND_TEMPLATES.Tabs())).toEqual([
      'Tabs',
      'TabsList',
      'TabsTrigger',
      'TabsTrigger',
      'TabsContent',
      'TabsContent',
    ]);
  });
});

describe('compoundTemplatesFor — шаблоны по частям кита', () => {
  /** Корень и части compound'а глазами каталога. */
  const compound = (root: string, parts: readonly string[]): CompoundRecord[] => [
    { name: root },
    ...parts.map((name) => ({ name, compoundParent: root })),
  ];

  it('у встроенного кита есть части каждого шаблона — набор не сужается', () => {
    expect(Object.keys(compoundTemplatesFor(builtinEntries()))).toEqual(
      Object.keys(COMPOUND_TEMPLATES)
    );
  });

  it('кит без CardHeader: шаблона Card нет, Card вставляется контейнером без частей', () => {
    // Как у HexaUI: корень `Card` есть, а частей, из которых собран шаблон ui-kit, нет.
    const records = compound('Card', ['CardTitle', 'CardDescription', 'CardContent', 'CardFooter']);
    const compoundTemplates = compoundTemplatesFor(records);
    expect(compoundTemplates).not.toHaveProperty('Card');
    const node = makeNodeFor('Card', 'container', undefined, { compoundTemplates });
    expect(node).toEqual(containerNode('Card'));
    expect(componentNames(node)).toEqual(['Card']);
  });

  it('корень без частей вовсе (Alert у кита с одной записью) — тоже контейнер', () => {
    const compoundTemplates = compoundTemplatesFor([{ name: 'Alert' }]);
    expect(compoundTemplates).toEqual({});
    expect(makeNodeFor('Alert', 'container', undefined, { compoundTemplates })).toEqual(
      containerNode('Alert')
    );
  });

  it('все части на месте — шаблон остаётся тем же самым', () => {
    const compoundTemplates = compoundTemplatesFor(
      compound('Alert', ['AlertTitle', 'AlertDescription'])
    );
    expect(Object.keys(compoundTemplates)).toEqual(['Alert']);
    expect(makeNodeFor('Alert', 'container', undefined, { compoundTemplates })).toEqual(
      COMPOUND_TEMPLATES.Alert()
    );
  });

  it('одноимённая запись, не объявленная частью корня, частью не считается', () => {
    // `AlertTitle` у кита есть, но как самостоятельный компонент: раскладки шаблона он не обещает.
    const records: CompoundRecord[] = [
      { name: 'Alert' },
      { name: 'AlertTitle' },
      { name: 'AlertDescription', compoundParent: 'Alert' },
    ];
    expect(compoundTemplatesFor(records)).toEqual({});
  });

  it('части без корня шаблон не дают: корня нет в каталоге — нечего и вставлять', () => {
    expect(
      compoundTemplatesFor(compound('Alert', ['AlertTitle', 'AlertDescription']).slice(1))
    ).toEqual({});
  });

  it('без кита действуют все встроенные шаблоны (ИИ, вызовы makeNodeFor без кита)', () => {
    expect(componentNames(makeNodeFor('Card', 'container'))).toContain('CardHeader');
    expect(componentNames(makeNodeFor('Card', 'container', undefined, {}))).toContain('CardHeader');
  });
});
