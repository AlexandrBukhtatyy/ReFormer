/**
 * Свойства компилятора схемы (fast-check) на случайных деревьях над фиксированной моделью.
 *
 * Генератор строит описание дерева — контейнеры, поля, подформы, массивы под-форм, текст из
 * строк, чисел и сигналов, пустые места — с селекторами из маленького пула, чтобы повторы были
 * частыми; описание превращается в авторское дерево с настоящими ручками модели.
 *
 * 1. **Повтор `selector`.** Компиляция падает тогда и только тогда, когда селектор повторился в
 *    одной области, и сообщение называет область, селектор и пути обоих узлов — первого повтора в
 *    порядке, в каком идёт компилятор. Одинаковые селекторы в разных областях (корень, подформа,
 *    строки) повтором не считаются. Строки компилируются при первом `row()` — повтор в схеме
 *    строки всплывает там, с областью строки.
 * 2. **Уникальные идентификаторы.** В каждой области — корень, подформы, строки — у каждого узла
 *    свой `id`: индекс `nodes` области содержит ровно узлы её обхода, каждый под своим `id`.
 * 3. **Детерминизм.** Две компиляции одного дерева дают одинаковое `describeCompiled`.
 *
 * Пул селекторов не пересекается с позиционными путями: селектор вида `#/1` вытесняет соседа из
 * индекса — это отдельный дефект ([ReFormer-mn6p], `tests/core/utils/compile-schema.test.ts`).
 *
 * Воспроизведение упавшего случая: `FC_SEED=<seed> FC_NUM_RUNS=1000 npx vitest run <файл>`.
 */

import fc from 'fast-check';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InputStub, SectionStub } from '../../test-utils/stubs';
import { describeCompiled } from '../../test-utils/compiled-snapshot';
import { propertyParams } from '../../test-utils/property';
import { compileSchema } from '../../../src/form/schema/compile';
import { rowKeyOf } from '../../../src/form/schema/row-key';
import type { CompiledNode, CompiledSchema } from '../../../src/form/schema/compiled';
import { createModel, type FormModel } from '../../../src/model/index';
import type { FormSchemaNode } from '../../../src/form/types/schema-node';

// ── Модель и формы её областей ──────────────────────────────────────────────────────────────

interface Address {
  city: string;
  street: string;
}
interface Phone {
  number: string;
  kind: string;
  address: Address;
}
interface Shape {
  title: string;
  count: number;
  agree: boolean;
  tags: string[];
  home: Address;
  work: Address;
  phones: Phone[];
}

const blankAddress = (): Address => ({ city: '', street: '' });

const createShape = () =>
  createModel<Shape>({
    title: '',
    count: 0,
    agree: false,
    tags: [],
    home: blankAddress(),
    work: blankAddress(),
    phones: [
      { number: '1', kind: 'mobile', address: blankAddress() },
      { number: '2', kind: 'home', address: blankAddress() },
    ],
  });

/** Что можно привязать в области: ручки значений, группы для `part`, массивы для `item`. */
interface ScopeShape {
  readonly leaves: readonly string[];
  readonly groups: Readonly<Record<string, ScopeShape>>;
  readonly arrays: Readonly<Record<string, ScopeShape>>;
}

const ADDRESS: ScopeShape = { leaves: ['city', 'street'], groups: {}, arrays: {} };
const PHONE: ScopeShape = {
  leaves: ['number', 'kind', 'address.city'],
  groups: { address: ADDRESS },
  arrays: {},
};
const ROOT: ScopeShape = {
  leaves: ['title', 'count', 'agree', 'tags', 'home.city'],
  groups: { home: ADDRESS, work: ADDRESS },
  arrays: { phones: PHONE },
};

// ── Описание дерева и генератор ─────────────────────────────────────────────────────────────

type GenNode =
  | {
      readonly kind: 'container';
      readonly selector?: string;
      readonly component: boolean;
      readonly children: readonly GenChild[];
    }
  | {
      readonly kind: 'field';
      readonly selector?: string;
      readonly leaf: string;
      readonly disabled: boolean;
    }
  | {
      readonly kind: 'part';
      readonly selector?: string;
      readonly group: string;
      readonly content: GenNode;
    }
  | {
      readonly kind: 'array';
      readonly selector?: string;
      readonly array: string;
      readonly item: GenNode;
    };

type GenChild =
  | GenNode
  | { readonly kind: 'text'; readonly value: string | number }
  | { readonly kind: 'signal'; readonly leaf: string }
  | { readonly kind: 'empty'; readonly value: null | undefined | boolean };

const isNode = (child: GenChild): child is GenNode =>
  child.kind !== 'text' && child.kind !== 'signal' && child.kind !== 'empty';

/** Маленький пул: повторы частые. Позиционных путей (`#/…`) в нём нет — см. шапку. */
const SELECTORS = ['a', 'b', 'c', 'step', 'row'] as const;
const selectorArb = fc.option(fc.constantFrom(...SELECTORS), { nil: undefined, freq: 2 });

const textArb = (shape: ScopeShape): fc.Arbitrary<GenChild> =>
  fc.oneof(
    fc.record({
      kind: fc.constant('text' as const),
      value: fc.oneof(fc.string({ maxLength: 3 }), fc.integer({ min: -9, max: 99 })),
    }),
    fc.record({ kind: fc.constant('signal' as const), leaf: fc.constantFrom(...shape.leaves) }),
    fc.record({
      kind: fc.constant('empty' as const),
      value: fc.constantFrom(null, undefined, false, true),
    })
  );

const fieldArb = (shape: ScopeShape): fc.Arbitrary<GenNode> =>
  fc.record({
    kind: fc.constant('field' as const),
    selector: selectorArb,
    leaf: fc.constantFrom(...shape.leaves),
    disabled: fc.boolean(),
  });

const containerArb = (shape: ScopeShape, depth: number, minLength = 0): fc.Arbitrary<GenNode> =>
  fc.record({
    kind: fc.constant('container' as const),
    selector: selectorArb,
    component: fc.boolean(),
    children: fc.array(
      fc.oneof(
        { arbitrary: nodeArb(shape, depth - 1), weight: 3 },
        { arbitrary: textArb(shape), weight: 1 }
      ),
      { minLength, maxLength: 4 }
    ),
  });

/** Узел области глубиной до `depth`: на дне — только поля. */
function nodeArb(shape: ScopeShape, depth: number): fc.Arbitrary<GenNode> {
  if (depth <= 0) return fieldArb(shape);
  const parts = Object.entries(shape.groups).map(([group, sub]) =>
    fc.record({
      kind: fc.constant('part' as const),
      selector: selectorArb,
      group: fc.constant(group),
      content: nodeArb(sub, depth - 1),
    })
  );
  const arrays = Object.entries(shape.arrays).map(([array, sub]) =>
    fc.record({
      kind: fc.constant('array' as const),
      selector: selectorArb,
      array: fc.constant(array),
      item: nodeArb(sub, depth - 1),
    })
  );
  return fc.oneof(
    { arbitrary: fieldArb(shape), weight: 3 },
    { arbitrary: containerArb(shape, depth), weight: 3 },
    ...[...parts, ...arrays].map((arbitrary) => ({
      arbitrary: arbitrary as fc.Arbitrary<GenNode>,
      weight: 1,
    }))
  );
}

/** Корень сборки — контейнер с детьми. */
const rootArb = containerArb(ROOT, 3, 1);

// ── Описание → авторское дерево ──────────────────────────────────────────────────────────────

/** Авторский узел → его описание: по `source` узла компиляции находим, из чего он собран. */
const descriptions = new WeakMap<object, GenNode>();

/** Ручка по пути от модели области: `'home.city'` → `model.$.home.city`. */
const handleAt = (model: FormModel<unknown>, path: string): unknown =>
  path
    .split('.')
    .reduce<unknown>((handle, key) => (handle as Record<string, unknown>)[key], model.$);

function build(node: GenNode, model: FormModel<unknown>): FormSchemaNode {
  const base = node.selector !== undefined ? { selector: node.selector } : {};
  let built: Record<string, unknown>;
  switch (node.kind) {
    case 'field':
      built = {
        ...base,
        model: handleAt(model, node.leaf),
        component: InputStub,
        ...(node.disabled ? { disabled: true } : {}),
      };
      break;
    case 'part':
      built = {
        ...base,
        model: handleAt(model, node.group),
        part: (sub: FormModel<unknown>) => build(node.content, sub),
      };
      break;
    case 'array':
      built = {
        ...base,
        model: handleAt(model, node.array),
        item: (row: FormModel<unknown>) => build(node.item, row),
      };
      break;
    case 'container':
      built = {
        ...base,
        ...(node.component ? { component: SectionStub } : {}),
        children: node.children.map((child) => buildChild(child, model)),
      };
      break;
  }
  descriptions.set(built, node);
  return built as FormSchemaNode;
}

function buildChild(child: GenChild, model: FormModel<unknown>): unknown {
  switch (child.kind) {
    case 'text':
    case 'empty':
      return child.value;
    case 'signal':
      return handleAt(model, child.leaf);
    default:
      return build(child, model);
  }
}

// ── Эталон: повтор selector по областям ─────────────────────────────────────────────────────

interface Duplicate {
  readonly scope: string;
  readonly selector: string;
  readonly first: string;
  readonly second: string;
}

/**
 * Первый повтор selector при компиляции области — в порядке компилятора: свой selector узла
 * раньше детей, подформа компилируется на месте (своя область), строки — по требованию.
 */
function firstDuplicate(root: GenNode, scope: string): Duplicate | undefined {
  const seen = new Map<string, string>();
  const visit = (node: GenNode, path: string): Duplicate | undefined => {
    if (node.selector !== undefined) {
      const first = seen.get(node.selector);
      if (first !== undefined) return { scope, selector: node.selector, first, second: path };
      seen.set(node.selector, path);
    }
    if (node.kind === 'part') return firstDuplicate(node.content, `${scope}/${node.group}`);
    if (node.kind !== 'container') return undefined;
    for (const [index, child] of node.children.entries()) {
      const found = isNode(child) ? visit(child, `${path}/${index}`) : undefined;
      if (found) return found;
    }
    return undefined;
  };
  return visit(root, '#');
}

/** Обход описания: каждый ребёнок с признаком «лежит в корневой области». */
function walkDescription(root: GenNode, visit: (child: GenChild, inRoot: boolean) => void): void {
  const walk = (child: GenChild, inRoot: boolean): void => {
    visit(child, inRoot);
    if (!isNode(child)) return;
    if (child.kind === 'container') for (const next of child.children) walk(next, inRoot);
    if (child.kind === 'part') walk(child.content, false);
    if (child.kind === 'array') walk(child.item, false);
  };
  walk(root, true);
}

/** Описание без повторов: повторный selector в области снимается. */
function withoutDuplicates(root: GenNode): GenNode {
  const seen = new Set<string>();
  const visit = (node: GenNode): GenNode => {
    const keep = node.selector !== undefined && !seen.has(node.selector);
    if (keep) seen.add(node.selector!);
    const base = { ...node, selector: keep ? node.selector : undefined } as GenNode;
    switch (base.kind) {
      case 'container':
        return {
          ...base,
          children: base.children.map((child) => (isNode(child) ? visit(child) : child)),
        };
      case 'part':
        return { ...base, content: withoutDuplicates(base.content) };
      case 'array':
        return { ...base, item: withoutDuplicates(base.item) };
      default:
        return base;
    }
  };
  return visit(root);
}

// ── Обход компиляции ────────────────────────────────────────────────────────────────────────

/** Узлы одной области: контейнеры и их дети, без содержимого подформ и строк. */
function scopeNodes(schema: CompiledSchema): CompiledNode[] {
  const out: CompiledNode[] = [];
  const walk = (node: CompiledNode): void => {
    out.push(node);
    if (node.kind !== 'container') return;
    for (const child of node.children) if (child.kind !== 'text') walk(child);
  };
  walk(schema.root);
  return out;
}

/** Под-модели строк массива по порядку. */
const rowModelsOf = (node: Extract<CompiledNode, { kind: 'array' }>): object[] =>
  Array.from({ length: node.control.length }, (_, index) => node.control.at(index) as object);

/**
 * Компиляция области сверяется с эталоном: повтор — исключение с точным текстом, иначе — схема.
 * Удачная схема проверяется дальше вглубь: подформы (уже скомпилированы) и строки (`row()`).
 */
function checkScope(compile: () => CompiledSchema, root: GenNode, scope: string): void {
  const expected = firstDuplicate(root, scope);
  if (expected) {
    expect(compile).toThrow(
      `в области «${expected.scope}» селектор «${expected.selector}» повторяется — узлы ` +
        `${expected.first} и ${expected.second}.`
    );
    return;
  }
  checkNested(compile());
}

function checkNested(schema: CompiledSchema): void {
  for (const node of scopeNodes(schema)) {
    if (node.kind === 'part') checkNested(node.content);
    if (node.kind !== 'array') continue;
    const array = descriptions.get(node.source) as Extract<GenNode, { kind: 'array' }>;
    for (const row of rowModelsOf(node)) {
      checkScope(() => node.row(row), array.item, `${node.scope}/${array.array}[${rowKeyOf(row)}]`);
    }
  }
}

/** Все области компиляции: корень, подформы, строки. */
function allScopes(schema: CompiledSchema): CompiledSchema[] {
  const out = [schema];
  for (const node of scopeNodes(schema)) {
    if (node.kind === 'part') out.push(...allScopes(node.content));
    if (node.kind === 'array') {
      for (const row of rowModelsOf(node)) out.push(...allScopes(node.row(row)));
    }
  }
  return out;
}

// ── Свойства ────────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  // Дерево может привязать одну ручку дважды — предупреждения к свойствам не относятся.
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('compileSchema — свойства на случайных деревьях', () => {
  it('генератор порождает повторы в одной области и одинаковые селекторы в разных', () => {
    const trees = fc.sample(rootArb, { numRuns: 300, seed: 4 });
    const inOneScope = trees.filter((tree) => firstDuplicate(tree, '#') !== undefined);
    const kinds = new Set<string>();
    for (const tree of trees) walkDescription(tree, (child) => kinds.add(child.kind));
    // Селектор и в корневой области, и во вложенной — после снятия повторов внутри областей.
    const acrossScopes = trees.filter((tree) => {
      const top = new Set<string>();
      const nested: string[] = [];
      walkDescription(withoutDuplicates(tree), (child, inRoot) => {
        if (!isNode(child) || child.selector === undefined) return;
        if (inRoot) top.add(child.selector);
        else nested.push(child.selector);
      });
      return nested.some((selector) => top.has(selector));
    });

    expect(inOneScope.length).toBeGreaterThan(30);
    expect(trees.length - inOneScope.length).toBeGreaterThan(30);
    expect(acrossScopes.length).toBeGreaterThan(10);
    expect([...kinds].sort()).toEqual([
      'array',
      'container',
      'empty',
      'field',
      'part',
      'signal',
      'text',
    ]);
  });

  it('повтор selector в области — исключение с областью и путями обоих узлов; в разных — нет', () => {
    fc.assert(
      fc.property(rootArb, (root) => {
        const model = createShape();
        const tree = build(root, model as FormModel<unknown>);
        checkScope(() => compileSchema(tree, model), root, '#');
      }),
      propertyParams(200)
    );
  });

  it('в каждой области у каждого узла свой id, и индекс `nodes` — ровно узлы области', () => {
    fc.assert(
      fc.property(rootArb.map(withoutDuplicates), (root) => {
        const model = createShape();
        const compiled = compileSchema(build(root, model as FormModel<unknown>), model);

        for (const scope of allScopes(compiled)) {
          const nodes = scopeNodes(scope);
          expect(new Set(nodes.map((node) => node.id)).size).toBe(nodes.length);
          expect(scope.nodes.size).toBe(nodes.length);
          for (const node of nodes) {
            expect(scope.nodes.get(node.id)).toBe(node);
            expect(node.scope).toBe(scope.scope);
          }
        }
      }),
      propertyParams(200)
    );
  });

  it('две компиляции одного дерева описываются одинаково', () => {
    fc.assert(
      fc.property(rootArb.map(withoutDuplicates), (root) => {
        const model = createShape();
        const tree = build(root, model as FormModel<unknown>);

        expect(describeCompiled(compileSchema(tree, model))).toEqual(
          describeCompiled(compileSchema(tree, model))
        );
      }),
      propertyParams(200)
    );
  });
});
