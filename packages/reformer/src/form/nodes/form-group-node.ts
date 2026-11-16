/**
 * FormGroupNode — реализация группы полей; лицо группы для прикладного кода — её прокси
 * ({@link FormGroup}): члены {@link FormNode} плюс ноды полей по именам.
 *
 * @internal
 * @module form/nodes/form-group-node
 */

import { computed, type ReadonlySignal, type Signal } from '@preact/signals-core';
import type { ValidationIssue } from '../types/contracts';
import type { FormGroup, FormNode } from '../types/nodes';
import { createAggregateSignals } from '../aggregate-signals';
import { buildFormProxy } from '../form-proxy-builder';
import { isDerived } from '../../model/derived-registry';
import { NODE_KIND, rawNode, type InternalFormNode } from './node-kind';
import { createAvailability, createIssues, createPending } from './state';
import { isLazyLeaf, type LazyLeaf } from './lazy-leaf';

/** Ребёнок группы: готовая нода либо ленивый лист (нода поля создаётся при первом обращении). */
export type GroupChild = InternalFormNode | LazyLeaf;

/** Нода ребёнка; ленивый лист её создаёт. */
const nodeOf = (child: GroupChild): InternalFormNode => (isLazyLeaf(child) ? child.node : child);

export class FormGroupNode<T> implements InternalFormNode<T> {
  readonly [NODE_KIND] = 'group' as const;

  readonly value: ReadonlySignal<T>;
  readonly valid: ReadonlySignal<boolean>;
  readonly invalid: ReadonlySignal<boolean>;
  readonly pending: ReadonlySignal<boolean>;
  readonly disabled: ReadonlySignal<boolean>;
  readonly touched: ReadonlySignal<boolean>;
  readonly dirty: ReadonlySignal<boolean>;
  readonly issues: ReadonlySignal<readonly ValidationIssue[]>;
  readonly ownIssues: ReadonlySignal<readonly ValidationIssue[]>;

  /** Дети по именам полей данных: ноды и ленивые листья. */
  private readonly children: ReadonlyMap<string, GroupChild>;
  /** Ноды всех детей — для сводных сигналов; создаются при первом их вычислении. */
  private allNodes: readonly InternalFormNode[] | undefined;
  /** Замечания самой группы (ответ сервера на форму целиком). */
  private readonly own = createIssues();
  private readonly availability = createAvailability();
  /** Ожидание async-правила на ручке самой группы. */
  private readonly ownPending = createPending();
  /**
   * Лист → его записываемый сигнал модели: по нему `setValue` узнаёт цели `compute` (их
   * помечает `markDerived`), а не по computed-обёртке `value` ноды.
   */
  private readonly leafSignals = new WeakMap<InternalFormNode, Signal<unknown>>();
  private behaviorCleanup: (() => void) | undefined;
  /** Что сделать перед сбросом — у корня сборки: вернуть живую проверку в тихую фазу. */
  private beforeReset: (() => void) | undefined;
  private face: FormGroup<T> | undefined;
  /** Поля-массивы модели без ноды (схема их не привязала) — о них предупреждает прокси. */
  private readonly unbound: ReadonlySet<string>;

  /**
   * @param children - Дети по именам полей данных: готовые ноды либо ленивые листья. Вид ребёнка
   *   задан нодой: по именам и значениям группа ничего не угадывает.
   * @param unbound - Имена полей-массивов модели, для которых сборка ноду не построила.
   */
  constructor(children: Iterable<readonly [string, GroupChild]>, unbound: Iterable<string> = []) {
    this.children = new Map(children);
    this.unbound = new Set(unbound);

    this.value = computed(() => {
      const result: Record<string, unknown> = {};
      // Значение ленивого листа — из сигнала модели: ноду ради чтения не строим.
      this.children.forEach((child, key) => {
        result[key] = isLazyLeaf(child) ? child.signal.value : child.value.value;
      });
      return result as T;
    });
    const { disabled } = this.availability;
    const aggregate = createAggregateSignals({
      // Сводное состояние читает каждого ребёнка: при первом вычислении строятся все ноды.
      getChildren: () => (this.allNodes ??= [...this.children.values()].map(nodeOf)),
      ownIssues: this.own.list,
      ownPending: computed(() => !disabled.value && this.ownPending.active.value),
      disabled,
    });
    this.valid = aggregate.valid;
    this.invalid = aggregate.invalid;
    this.pending = aggregate.pending;
    this.touched = aggregate.touched;
    this.dirty = aggregate.dirty;
    this.issues = aggregate.issues;
    this.ownIssues = this.own.list;
    this.disabled = this.availability.disabled;
  }

  /** Ребёнок по имени поля — нода либо ленивый лист, без создания ноды. @internal */
  childAt(key: string): GroupChild | undefined {
    return this.children.get(key);
  }

  /** Лицо группы: прокси с нодами полей. Строится один раз. */
  get proxy(): FormGroup<T> {
    this.face ??= buildFormProxy<T>(this, this.children, this.unbound);
    return this.face;
  }

  getValue(): T {
    const result: Record<string, unknown> = {};
    this.children.forEach((child, key) => {
      result[key] = isLazyLeaf(child) ? child.signal.peek() : child.getValue();
    });
    return result as T;
  }

  /** Записываемый источник значения ребёнка: сигнал модели листа либо `value` ноды. */
  private sourceOf(child: GroupChild): Signal<unknown> | ReadonlySignal<unknown> {
    if (isLazyLeaf(child)) return child.signal;
    return this.leafSignals.get(child) ?? child.value;
  }

  /** Записать значения полей; цели `compute` пропускаются — ими владеет поведение. */
  setValue(value: T): void {
    // Не объект (`null` на месте вложенной группы `{…} | null`) — группа остаётся прежней, как
    // при `model.patch`: обход ключей не начинается, частичной записи нет.
    if (value === null || typeof value !== 'object') return;
    for (const [key, fieldValue] of Object.entries(value as Record<string, unknown>)) {
      const child = this.children.get(key);
      if (!child) continue;
      if (isDerived(this.sourceOf(child) as Signal<unknown>)) continue;
      (nodeOf(child) as FormNode<unknown>).setValue(fieldValue);
    }
  }

  /**
   * Сбросить группу: замечания группы и всех полей, `touched`, `dirty` и значения. Без аргумента —
   * к точке отсчёта модели, той же, к которой возвращает `model.reset()` (значения создания модели
   * либо последнего `captureInitial()`), — и форма после сброса не изменена.
   * Цели `compute` значения не получают, как и в `setValue`: ими владеет поведение.
   *
   * Корень сборки `createForm` сначала возвращает живую проверку в исходную фазу — до записи
   * значений: иначе каждая запись разбудила бы прогон `afterFirstSubmit` по сброшенной форме.
   */
  reset(value?: T): void {
    this.beforeReset?.();
    this.own.clear();
    this.children.forEach((child, key) => {
      const next = isDerived(this.sourceOf(child) as Signal<unknown>)
        ? undefined
        : (value as Record<string, unknown> | undefined)?.[key];
      nodeOf(child).reset(next);
    });
  }

  /** Сброс всех полей группы к значениям создания, у целей `compute` тоже. @internal */
  resetToCreation(): void {
    this.own.clear();
    this.children.forEach((child) => rawNode(nodeOf(child)).resetToCreation());
  }

  markAsTouched(): void {
    this.children.forEach((child) => nodeOf(child).markAsTouched());
  }

  /** Лист без ноды и так не тронут. */
  markAsUntouched(): void {
    this.children.forEach((child) => {
      const node = isLazyLeaf(child) ? child.peek() : child;
      node?.markAsUntouched();
    });
  }

  disable(): void {
    this.availability.setDisabled(true);
    // Как у поля: выключенная нода замечаний не держит.
    this.own.clear();
    this.children.forEach((child) => nodeOf(child).disable());
  }

  /** Включить группу и детей; поля с блокировкой из схемы (`disabled: true`) остаются выключенными. */
  enable(): void {
    this.availability.setDisabled(false);
    // Лист без ноды не выключен: выключение строит ноду.
    this.children.forEach((child) => {
      const node = isLazyLeaf(child) ? child.peek() : child;
      if (node) rawNode(node).enableFromParent();
    });
  }

  /** Каскад от контейнера — то же, что `enable()`: своей блокировки из схемы у группы нет. @internal */
  enableFromParent(): void {
    this.enable();
  }

  setIssues(issues: readonly ValidationIssue[]): void {
    this.own.set(issues);
  }

  clearIssues(): void {
    this.own.clear();
    this.children.forEach((child) => {
      const node = isLazyLeaf(child) ? child.peek() : child;
      node?.clearIssues();
    });
  }

  /** Своё ожидание async-правила на ручке группы; ожидание детей агрегат добавит сам. @internal */
  setPending(pending: boolean): void {
    this.ownPending.mark(pending);
  }

  /** Прикрепить cleanup поведения формы (`createForm({ behavior })`). @internal */
  attachBehaviorCleanup(cleanup: () => void): void {
    this.behaviorCleanup = cleanup;
  }

  /** Действие перед сбросом группы — его задаёт сборка своему корню. @internal */
  attachResetHook(hook: () => void): void {
    this.beforeReset = hook;
  }

  /** Связать лист с его сигналом модели для `setValue`. @internal */
  registerLeafSignal(node: InternalFormNode, source: Signal<unknown>): void {
    this.leafSignals.set(node, source);
  }

  /** Снять поведение и подписки всех детей. @internal */
  dispose(): void {
    this.behaviorCleanup?.();
    this.behaviorCleanup = undefined;
    this.children.forEach((child) => {
      const node = isLazyLeaf(child) ? child.peek() : child;
      node?.dispose();
    });
  }
}
