/**
 * `build_form` на настоящих китах проекта-образца: пример его грамматики обязан собираться на
 * каждом ките, а не только на встроенном каталоге тестов ассистента.
 *
 * Тест в композиции, потому что сверяет два плагина: инструмент ассистента и каталог кита HexaUI.
 * Плагину чужой плагин не виден — это держит линтер.
 *
 * @module plugins/reformer/integration/assistant-build-form-kits.test
 */

import { describe, expect, it } from 'vitest';
import { DOCUMENT_GRAMMAR_EXAMPLE, type LayoutNode } from '@reformer/mcp/intent';
import { validateFormSchema } from '@reformer/renderer-json/validate';
import hexaCatalog from '../../kit-hexa-ui/catalog.json';
import { projectCatalog } from '../core/catalog';
import { collectModelPaths, emptyRules, emptySchema } from '../core/form-model';
import { builtinCatalog } from '../core/testing';
import { buildFormTool } from '../ai/src/tools/build-form';
import { BUILD_FORM_STEPS_EXAMPLE, buildFormGrammar } from '../ai/src/tools/build-form/grammar';
import { arrayName } from '../ai/src/model/catalog-digest';

/**
 * Образец грамматики без массивов — для кита без компонента массива: грамматика такого кита массивов
 * не показывает. Уходят и записи о строках — правило строки и связь, читающая массив.
 */
function withoutArrays(intent: typeof DOCUMENT_GRAMMAR_EXAMPLE) {
  const names = new Set(intent.arrays.map((a) => a.name));
  const reads = (expr: string | undefined) => [...names].some((n) => expr?.includes(`model.${n}`));
  const root = intent.layoutRoot as { children: LayoutNode[] };
  return {
    ...intent,
    arrays: [],
    layoutRoot: {
      ...intent.layoutRoot,
      children: root.children.filter((c) => typeof c === 'string' || c.kind !== 'array'),
    },
    validation: intent.validation.filter((rule) => !('each' in rule)),
    behavior: intent.behavior.filter((link) => !reads(link.expr)),
  };
}

/**
 * Образец с контейнерами, подогнанными под кит: у контейнера остаются только свойства его строгой
 * схемы. `Section` HexaUI заголовка не держит (только `className`), а образец MCP написан под
 * `@reformer/ui-kit`. Ничего не снято — тот же объект.
 */
function fitContainers(
  intent: ReturnType<typeof withoutArrays> | typeof DOCUMENT_GRAMMAR_EXAMPLE,
  entries: readonly { name: string; propsSchema?: unknown }[]
) {
  let changed = false;
  const fit = (node: LayoutNode): LayoutNode => {
    if (typeof node === 'string' || node.kind !== 'container') return node;
    const schema = entries.find((entry) => entry.name === node.component)?.propsSchema as
      | { additionalProperties?: boolean; properties?: Record<string, unknown> }
      | undefined;
    const children = node.children.map(fit);
    if (node.componentProps === undefined || schema?.additionalProperties !== false) {
      return { ...node, children };
    }
    const props = Object.fromEntries(
      Object.entries(node.componentProps).filter(([key]) => key in (schema.properties ?? {}))
    );
    if (Object.keys(props).length < Object.keys(node.componentProps).length) changed = true;
    return { ...node, componentProps: props, children };
  };
  const layoutRoot = fit(intent.layoutRoot as LayoutNode);
  return changed ? { ...intent, layoutRoot } : intent;
}

const KITS = [
  { name: 'встроенный кит', entries: builtinCatalog().entries },
  { name: 'HexaUI', entries: projectCatalog(hexaCatalog as never).entries },
];

describe.each(KITS)('build_form: $name', ({ entries }) => {
  const build = (intent: unknown, parent?: string, draft = emptySchema(), rules = emptyRules()) =>
    buildFormTool.run({ intent, ...(parent === undefined ? {} : { parent }) } as never, {
      draft,
      base: emptySchema(),
      rules,
      catalog: entries,
      validateForm: validateFormSchema,
    });

  it('пример грамматики MCP собирается', async () => {
    // Без массива в ките грамматика его не показывает — и пример собирается без него.
    const intent =
      arrayName(entries) === undefined
        ? withoutArrays(DOCUMENT_GRAMMAR_EXAMPLE)
        : DOCUMENT_GRAMMAR_EXAMPLE;
    const fitted = fitContainers(intent, entries);
    if (fitted !== intent) {
      // Свойство, которого у контейнера кита нет, — отказ до вставки с тем, что у него есть.
      const refused = await build(intent);
      expect(refused.schema).toBeUndefined();
      expect(refused.text).toContain('component-props');
    }
    const out = await build(fitted);
    expect(out.error?.code, out.text).toBeUndefined();
    expect(collectModelPaths(out.schema!)).toEqual(
      expect.arrayContaining(['loanType', 'total', 'residenceAddress.city'])
    );
    expect(out.text).not.toContain('Not applied');
  });

  it('пример шагов собирается визардом кита, а поля ложатся в шаг по адресу из ответа', async () => {
    const steps = await build(BUILD_FORM_STEPS_EXAMPLE);
    expect(steps.error?.code, steps.text).toBeUndefined();
    const ref = /"Client" (\S+);/.exec(steps.text)?.[1];
    expect(ref).toBeDefined();
    // Поля без справочника: выбор со ссылкой на необъявленный справочник — отказ C3.
    const filled = await build(
      { fields: DOCUMENT_GRAMMAR_EXAMPLE.fields.slice(1, 3) },
      ref,
      steps.schema!,
      steps.rules!
    );
    expect(filled.error?.code, filled.text).toBeUndefined();
    expect(collectModelPaths(filled.schema!)).toEqual(['price', 'quantity']);
  });

  it('грамматика называет только поля этого кита', () => {
    const grammar = buildFormGrammar(entries);
    expect(grammar).toContain('Input');
    expect(grammar.includes('## arrays')).toBe(arrayName(entries) !== undefined);
  });
});
