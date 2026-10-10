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
import { NODE_KIND, type InternalFormNode } from './node-kind';
import { createAvailability, createIssues, createPending } from './state';

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

  /** Сырые ноды детей по именам полей данных. */
  private readonly children: ReadonlyMap<string, InternalFormNode>;
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
  private face: FormGroup<T> | undefined;

  /**
   * @param children - Готовые ноды детей по именам полей данных. Вид ребёнка задан нодой: по
   *   именам и значениям группа ничего не угадывает.
   */
  constructor(children: Iterable<readonly [string, InternalFormNode]>) {
    this.children = new Map(children);
    const nodes = [...this.children.values()];

    this.value = computed(() => {
      const result: Record<string, unknown> = {};
      this.children.forEach((child, key) => {
        result[key] = child.value.value;
      });
      return result as T;
    });
    const { disabled } = this.availability;
    const aggregate = createAggregateSignals({
      getChildren: () => nodes,
      ownIssues: this.own.list,
      ownPending: computed(() => !disabled.value && this.ownPending.active.value),
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

  /** Лицо группы: прокси с нодами полей. Строится один раз. */
  get proxy(): FormGroup<T> {
    this.face ??= buildFormProxy<T>(this, this.children);
    return this.face;
  }

  getValue(): T {
    const result: Record<string, unknown> = {};
    this.children.forEach((child, key) => {
      result[key] = child.getValue();
    });
    return result as T;
  }

  /** Записать значения полей; цели `compute` пропускаются — ими владеет поведение. */
  setValue(value: T): void {
    // Не объект (`null` на месте вложенной группы `{…} | null`) — группа остаётся прежней, как
    // при `model.patch`: обход ключей не начинается, частичной записи нет.
    if (value === null || typeof value !== 'object') return;
    for (const [key, fieldValue] of Object.entries(value as Record<string, unknown>)) {
      const child = this.children.get(key);
      if (!child) continue;
      const source = this.leafSignals.get(child) ?? child.value;
      if (isDerived(source as Signal<unknown>)) continue;
      (child as FormNode<unknown>).setValue(fieldValue);
    }
  }

  /**
   * Сбросить группу: замечания группы и всех полей, `touched`, `dirty` и значения. Без аргумента —
   * к значениям, с которыми форма создана (точку отсчёта модели возвращает `model.reset()`).
   */
  reset(value?: T): void {
    this.own.clear();
    this.children.forEach((child, key) => {
      child.reset((value as Record<string, unknown> | undefined)?.[key]);
    });
  }

  markAsTouched(): void {
    this.children.forEach((child) => child.markAsTouched());
  }

  markAsUntouched(): void {
    this.children.forEach((child) => child.markAsUntouched());
  }

  disable(): void {
    this.availability.setDisabled(true);
    // Как у поля: выключенная нода замечаний не держит.
    this.own.clear();
    this.children.forEach((child) => child.disable());
  }

  enable(): void {
    this.availability.setDisabled(false);
    this.children.forEach((child) => child.enable());
  }

  setIssues(issues: readonly ValidationIssue[]): void {
    this.own.set(issues);
  }

  clearIssues(): void {
    this.own.clear();
    this.children.forEach((child) => child.clearIssues());
  }

  /** Своё ожидание async-правила на ручке группы; ожидание детей агрегат добавит сам. @internal */
  setPending(pending: boolean): void {
    this.ownPending.mark(pending);
  }

  /** Прикрепить cleanup поведения формы (`createForm({ behavior })`). @internal */
  attachBehaviorCleanup(cleanup: () => void): void {
    this.behaviorCleanup = cleanup;
  }

  /** Связать лист с его сигналом модели для `setValue`. @internal */
  registerLeafSignal(node: InternalFormNode, source: Signal<unknown>): void {
    this.leafSignals.set(node, source);
  }

  /** Снять поведение и подписки всех детей. @internal */
  dispose(): void {
    this.behaviorCleanup?.();
    this.behaviorCleanup = undefined;
    this.children.forEach((child) => child.dispose());
  }
}
