/**
 * Скомпилированная схема заявки на кредит целиком — снимок и инварианты компиляции.
 *
 * Компиляцию (`compileSchema`) читают сборка формы, рендереры и инструменты: вид узла,
 * идентификаторы, области подформ и строк, индексы полей и массивов. Снимок описывает её для
 * настоящей формы со всеми видами узлов (`describeCompiled` из `test-utils/compiled-snapshot`):
 * корень визарда, три подформы, массивы в корне, в подформе и в строке, строка созаёмщика со своей
 * подформой и строкой телефона, строка по шаблону узла схемы. Ключи строк нормализованы — снимок не
 * зависит от порядка тестов (`--sequence.shuffle`). Рядом — то, что снимок держит неявно:
 * - описание одинаково у двух сборок и у повторной компиляции того же дерева;
 * - после `move` / `swap` ключ области едет со строкой, пути ручек — с индексом, а скомпилированная
 *   строка остаётся тем же объектом;
 * - `schemaSubtree`: билдер строки и подформы вызывается один раз на под-модель, сколько бы раз
 *   дерево ни компилировали и ни описывали;
 * - вид привязки каждого узла глазами `isModelContainerSignal` / `isValueSignal`.
 * Отдельные утверждения о компиляции заявки — `bundle-assembly.test.ts` (BA-08…BA-12).
 *
 * Обновление снимка — `npx vitest run -u tests/integration/compiled-schema.snapshot.test.ts`.
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
  describeCompiled,
  type DescribedNode,
  type DescribedSchema,
} from '../test-utils/compiled-snapshot';
import { disposeForm } from '../test-utils/dispose-form';
import {
  compileSchema,
  createForm,
  isModelContainerSignal,
  isValueSignal,
  schemaSubtree,
  type CompiledArrayNode,
  type CompiledChild,
  type CompiledPartNode,
  type CompiledSchema,
  type FormBundle,
  type FormModel,
  type FormSchemaNode,
  type SchemaNodeId,
} from '../../src/index';
import { isSignal } from '../../src/signals';
import { addCoBorrower, fillEmploymentStep } from './fixtures/loan-application/actions';
import { createLoanServer } from './fixtures/loan-application/api';
import { createLoanBehavior } from './fixtures/loan-application/behavior';
import { createLoanForm, type LoanForm } from './fixtures/loan-application/create-loan-form';
import { createLoanFlow } from './fixtures/loan-application/flow';
import { createLoanModel, type LoanApplication } from './fixtures/loan-application/model';
import { loanSchema } from './fixtures/loan-application/schema';
import { createLoanRules } from './fixtures/loan-application/validation';

// ─── Сборки теста ─────────────────────────────────────────────────────────────────────────

/** Формы текущего теста: после теста их поведение снимается. */
const assembled: object[] = [];

function build(): LoanForm {
  const built = createLoanForm();
  assembled.push(built.bundle.form);
  return built;
}

afterEach(() => {
  for (const form of assembled.splice(0)) disposeForm(form);
});

/**
 * Строки всех видов: созаёмщик (подформа адреса и строка телефона внутри), прежнее место работы
 * (массив внутри подформы занятости) и рекомендатель (шаблон строки — `initialValue` узла).
 */
function addRows(bundle: FormBundle<LoanApplication>): void {
  addCoBorrower(bundle.model, { livesWithApplicant: false });
  fillEmploymentStep(bundle.model);
  bundle.form.references.push();
}

/** Скомпилированное дерево корня сборки. */
function treeOf(bundle: FormBundle<LoanApplication>): CompiledSchema {
  const tree = bundle.render.tree;
  if (tree === undefined) throw new Error('у сборки заявки нет скомпилированной схемы');
  return tree;
}

/** Массив под-форм по ручке модели — из индекса области. */
function arrayNodeOf(compiled: CompiledSchema, handle: object): CompiledArrayNode {
  const array = compiled.arrays.get(handle);
  if (array === undefined) throw new Error(`в области «${compiled.scope}» нет массива`);
  return array;
}

// ─── Обход описаний и компиляций ──────────────────────────────────────────────────────────

/** Области описания по порядку обхода: корень, подформы и строки. */
function describedScopes(schema: DescribedSchema): string[] {
  const scopes = [schema.scope];
  const walk = (node: DescribedNode): void => {
    if (node.kind === 'part') scopes.push(...describedScopes(node.content as DescribedSchema));
    if (node.kind === 'array') {
      for (const row of node.rows as DescribedSchema[]) scopes.push(...describedScopes(row));
    }
    if (node.kind === 'container') (node.children as DescribedNode[]).forEach(walk);
  };
  walk(schema.root);
  return scopes;
}

/** Области строк массива созаёмщиков в описании корня. */
function coBorrowerScopes(schema: DescribedSchema): string[] {
  return describedScopes(schema).filter((scope) => /^#\/coBorrowers\[row#\d+\]$/.test(scope));
}

/** Описание без ключей строк: остаётся то, что зависит от позиции, — пути, ручки, узлы. */
const withoutRowKeys = (schema: DescribedSchema): unknown =>
  JSON.parse(JSON.stringify(schema).replace(/\[row#\d+\]/g, '[row#?]'));

/** Каждая область компиляции один раз: корень, подформы, строки — через `row()`. */
function forEachScope(compiled: CompiledSchema, visit: (scope: CompiledSchema) => void): void {
  visit(compiled);
  const walk = (child: CompiledChild): void => {
    if (child.kind === 'container') child.children.forEach(walk);
    if (child.kind === 'part') forEachScope(child.content, visit);
    if (child.kind === 'array') {
      for (let index = 0; index < child.control.length; index++) {
        forEachScope(child.row(child.control.at(index) as object), visit);
      }
    }
  };
  walk(compiled.root);
}

// ─── Снимок ───────────────────────────────────────────────────────────────────────────────

describe('compileSchema — снимок заявки на кредит', () => {
  it('CS-01: заявка целиком — корень, подформы, строка созаёмщика после row(), строка в подформе, строка по шаблону схемы', () => {
    const { bundle } = build();
    addRows(bundle);

    const described = describeCompiled(treeOf(bundle));

    expect(describedScopes(described)).toEqual([
      '#',
      '#/registrationAddress',
      '#/residenceAddress',
      '#/employment',
      '#/employment/previousJobs[row#2]',
      '#/coBorrowers[row#0]',
      '#/coBorrowers[row#0]/address',
      '#/coBorrowers[row#0]/phones[row#1]',
      '#/references[row#3]',
    ]);
    expect(described).toMatchSnapshot();
  });

  it('CS-02: описание одинаково у двух сборок и у повторной компиляции того же дерева', () => {
    const first = build();
    addRows(first.bundle);
    const described = describeCompiled(treeOf(first.bundle));
    // Ключи строк — глобальный счётчик: строки посторонней формы сдвигают его, как соседние тесты.
    addCoBorrower(build().bundle.model);
    const second = build();
    addRows(second.bundle);
    const { model } = second.bundle;

    expect(describeCompiled(treeOf(second.bundle))).toEqual(described);
    expect(describeCompiled(compileSchema(treeOf(second.bundle).root.source, model))).toEqual(
      described
    );
    expect(describeCompiled(compileSchema(loanSchema(model), model))).toEqual(described);
  });

  it('CS-03: move и swap — ключ области едет со строкой, пути ручек — с индексом, строка не перекомпилируется', () => {
    const { bundle } = build();
    const { model, form } = bundle;
    for (let index = 0; index < 3; index++) addCoBorrower(model);
    const tree = treeOf(bundle);
    const coBorrowers = arrayNodeOf(tree, model.$.coBorrowers);
    const [first, second, third] = [0, 1, 2].map((index) => model.coBorrowers.at(index));
    const compiled = new Map([first, second, third].map((row) => [row, coBorrowers.row(row)]));
    const before = describeCompiled(tree);
    const [keyOfFirst, keyOfSecond, keyOfThird] = coBorrowerScopes(before);

    model.coBorrowers.swap(0, 2);
    const swapped = describeCompiled(tree);

    expect(coBorrowerScopes(swapped)).toEqual([keyOfThird, keyOfSecond, keyOfFirst]);
    expect(withoutRowKeys(swapped)).toEqual(withoutRowKeys(before));
    for (let index = 0; index < 3; index++) {
      const row = model.coBorrowers.at(index);
      expect(coBorrowers.row(row)).toBe(compiled.get(row));
      // Область строки и `keyAt` — один источник ключа.
      expect(coBorrowers.row(row).scope).toBe(`#/coBorrowers[${form.coBorrowers.keyAt(index)}]`);
    }

    form.coBorrowers.move(0, 2);
    expect(coBorrowerScopes(describeCompiled(tree))).toEqual([keyOfSecond, keyOfFirst, keyOfThird]);

    model.coBorrowers.move(1, 0);
    expect(describeCompiled(tree)).toEqual(before);
  });
});

// ─── schemaSubtree ────────────────────────────────────────────────────────────────────────

/** Узел автора, которого можно коснуться: не текст, не сигнал, не пустое место. */
const isAuthoredNode = (child: unknown): child is FormSchemaNode =>
  typeof child === 'object' && child !== null && !isSignal(child);

/**
 * Дерево с подсчётом вызовов билдеров строк (`item`) и подформ (`part`) — по `selector` узла.
 * Обёртка одна на узел: как и исходный билдер, она — ключ `schemaSubtree`.
 */
function countingSchema(): {
  readonly schema: (model: FormModel<LoanApplication>) => FormSchemaNode;
  readonly calls: Map<string, number>;
} {
  const calls = new Map<string, number>();
  const instrument = (node: FormSchemaNode): FormSchemaNode => {
    const source = node as unknown as Record<string, unknown>;
    const copy: Record<string, unknown> = { ...source };
    for (const key of ['item', 'part'] as const) {
      const builder = source[key];
      if (typeof builder !== 'function') continue;
      const label = `${String(source.selector)} · ${key}`;
      copy[key] = (subModel: object): FormSchemaNode => {
        calls.set(label, (calls.get(label) ?? 0) + 1);
        return instrument((builder as (model: object) => FormSchemaNode)(subModel));
      };
    }
    if (Array.isArray(source.children)) {
      copy.children = source.children.map((child: unknown) =>
        isAuthoredNode(child) ? instrument(child) : child
      );
    }
    return copy as unknown as FormSchemaNode;
  };
  return { schema: (model) => instrument(loanSchema(model)), calls };
}

describe('schemaSubtree — одна компиляция строки на под-модель', () => {
  it('CS-04: билдер строки и подформы вызывается один раз на под-модель — при сборке, row(), описании и повторной компиляции', () => {
    const counting = countingSchema();
    const server = createLoanServer();
    const rules = createLoanRules(server.api);
    const bundle = createForm<LoanApplication>({
      model: createLoanModel(),
      schema: counting.schema,
      behavior: createLoanBehavior(server.api, rules),
      validation: { extras: rules.crossStep },
      flow: createLoanFlow(rules),
    });
    assembled.push(bundle.form);
    const { model } = bundle;
    addRows(bundle);
    addCoBorrower(model);
    const tree = treeOf(bundle);
    const calls = (): Record<string, number> => Object.fromEntries([...counting.calls].sort());
    const afterAssembly = calls();

    describeCompiled(tree);
    describeCompiled(tree);
    describeCompiled(compileSchema(tree.root.source, model));
    model.coBorrowers.swap(0, 1);
    model.coBorrowers.move(1, 0);

    expect(afterAssembly).toEqual({
      'co-borrower-address · part': 2,
      'co-borrower-phones · item': 2,
      'co-borrowers-list · item': 2,
      'employment-form · part': 1,
      'previous-jobs · item': 1,
      'references · item': 1,
      'registration-address · part': 1,
      'residence-address · part': 1,
    });
    expect(calls()).toEqual(afterAssembly);

    // Новая строка — новая под-модель: её билдеры вызываются, остальные — нет.
    model.coBorrowers.removeAt(0);
    addCoBorrower(model);
    expect(calls()).toEqual({
      ...afterAssembly,
      'co-borrower-address · part': 3,
      'co-borrower-phones · item': 3,
      'co-borrowers-list · item': 3,
    });
  });

  it('CS-05: рендерер и любая компиляция получают то же поддерево строки и подформы, что сборка', () => {
    const { bundle } = build();
    const { model } = bundle;
    addRows(bundle);
    const tree = treeOf(bundle);
    const coBorrowers = arrayNodeOf(tree, model.$.coBorrowers);
    const row = model.coBorrowers.at(0);
    const residence = tree.nodes.get('residence-address' as SchemaNodeId) as CompiledPartNode;
    const recompiled = compileSchema(loanSchema(model), model);
    const item = (coBorrowers.source as { item: (row: object) => FormSchemaNode }).item;

    // Одна компиляция строки на массив: повторный row() — тот же объект.
    expect(coBorrowers.row(row)).toBe(coBorrowers.row(row));
    // Рендерер строит строку тем же вызовом — и получает узлы, из которых скомпилирована строка.
    expect(schemaSubtree(item, row)).toBe(coBorrowers.row(row).root.source);
    // Новое дерево той же модели: свои узлы корня, но билдеры — те же функции, и поддеревья строк
    // и подформ берутся из памяти, а не строятся заново.
    expect(recompiled.root.source).not.toBe(tree.root.source);
    expect(arrayNodeOf(recompiled, model.$.coBorrowers).row(row).root.source).toBe(
      coBorrowers.row(row).root.source
    );
    expect(arrayNodeOf(recompiled, model.$.coBorrowers).row(row)).not.toBe(coBorrowers.row(row));
    expect(
      (recompiled.nodes.get('residence-address' as SchemaNodeId) as CompiledPartNode).content.root
        .source
    ).toBe(residence.content.root.source);
  });
});

// ─── Вид привязок ─────────────────────────────────────────────────────────────────────────

/** Вид привязки глазами двух предикатов модели. */
function bindingOf(value: unknown): string {
  const container = isModelContainerSignal(value);
  const handle = isValueSignal(value);
  if (container && handle) return 'контейнер и значение';
  if (container) return 'контейнер';
  if (handle) return 'значение';
  return 'не ручка';
}

describe('isModelContainerSignal / isValueSignal — вид привязок узлов заявки', () => {
  it('CS-06: каждый узел схемы — привязка своего вида: поле — ручка значения, массив — и то и другое, подформа — контейнер', () => {
    const { bundle } = build();
    addRows(bundle);
    const tree = treeOf(bundle);
    const seen = new Map<string, Set<string>>();
    const note = (what: string, value: unknown): void => {
      seen.set(what, (seen.get(what) ?? new Set()).add(bindingOf(value)));
    };

    forEachScope(tree, (scope) => {
      for (const node of scope.nodes.values()) {
        if (node.kind === 'field') note('поле: ручка', node.handle);
        if (node.kind === 'array') note('массив под-форм: ручка', node.handle);
        if (node.kind === 'part') {
          note('подформа: ручка', node.handle);
          note('подформа: под-модель', node.model);
        }
        if (node.kind === 'container') {
          for (const child of node.children) {
            if (child.kind !== 'text') continue;
            for (const part of child.parts) if (isSignal(part)) note('текст: сигнал', part);
          }
        }
      }
      for (const handle of scope.fields.keys()) note('индекс fields', handle);
      for (const handle of scope.arrays.keys()) note('индекс arrays', handle);
    });

    expect(Object.fromEntries([...seen].map(([what, kinds]) => [what, [...kinds].sort()]))).toEqual(
      {
        // Поле над массивом целиком (мультивыбор) — ручка-контейнер, к которой привязано значение.
        'поле: ручка': ['значение', 'контейнер и значение'],
        'массив под-форм: ручка': ['контейнер и значение'],
        'подформа: ручка': ['контейнер'],
        'подформа: под-модель': ['не ручка'],
        'текст: сигнал': ['значение'],
        'индекс fields': ['значение', 'контейнер и значение'],
        'индекс arrays': ['контейнер и значение'],
      }
    );
  });

  it('CS-07: привязки заявки по видам значений модели', () => {
    const { bundle } = build();
    const { model } = bundle;
    const tree = treeOf(bundle);
    const estimate = tree.nodes.get('loan-estimate' as SchemaNodeId);
    const [, rate, , payment] =
      estimate?.kind === 'container' && estimate.children[0].kind === 'text'
        ? estimate.children[0].parts
        : [];

    expect({
      'лист — сумма кредита': bindingOf(model.$.loan.amount),
      'лист из null — документы': bindingOf(model.$.documents),
      'массив целиком — интересы': bindingOf(model.$.interests),
      'массив под-форм — созаёмщики': bindingOf(model.$.coBorrowers),
      'группа — адрес регистрации': bindingOf(model.$.registrationAddress),
      'корень модели': bindingOf(model.$),
      'под-модель группы': bindingOf(model.registrationAddress),
      'фасад массива': bindingOf(model.coBorrowers),
      'текст: ручка ставки': bindingOf(rate),
      'текст: computed платежа': bindingOf(payment),
    }).toEqual({
      'лист — сумма кредита': 'значение',
      'лист из null — документы': 'значение',
      'массив целиком — интересы': 'контейнер и значение',
      'массив под-форм — созаёмщики': 'контейнер и значение',
      'группа — адрес регистрации': 'контейнер',
      'корень модели': 'контейнер',
      'под-модель группы': 'не ручка',
      'фасад массива': 'не ручка',
      'текст: ручка ставки': 'значение',
      'текст: computed платежа': 'значение',
    });
    // Компилятор различает вид узла по тем же предикатам: поле, массив под-форм, подформа.
    expect(tree.fields.get(model.$.interests)?.kind).toBe('field');
    expect(tree.arrays.get(model.$.coBorrowers)?.kind).toBe('array');
    expect(tree.nodes.get('registration-address' as SchemaNodeId)?.kind).toBe('part');
  });
});
