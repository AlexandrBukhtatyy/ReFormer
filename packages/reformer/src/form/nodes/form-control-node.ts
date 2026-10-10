/**
 * FormControlNode — реализация {@link FormControl}: нода поля над сигналом модели.
 *
 * Значением не владеет — ссылается на сигнал модели. Правил не исполняет: замечания разносит
 * раннер валидации через {@link FormControlNode.setIssues}.
 *
 * @internal
 * @module form/nodes/form-control-node
 */

import { computed, type ReadonlySignal, type Signal } from '@preact/signals-core';
import type { FieldConfig } from '../types/field-config';
import type { ValidationIssue } from '../types/contracts';
import type { ComponentRef } from '../types/schema-node';
import type { FormControl } from '../types/nodes';
import { NODE_KIND, type InternalFormNode } from './node-kind';
import {
  createAvailability,
  createComponentState,
  createInteraction,
  createIssues,
  createPending,
} from './state';

export class FormControlNode<T> implements FormControl<T>, InternalFormNode<T> {
  readonly [NODE_KIND] = 'control' as const;

  readonly value: ReadonlySignal<T>;
  readonly valid: ReadonlySignal<boolean>;
  readonly invalid: ReadonlySignal<boolean>;
  readonly pending: ReadonlySignal<boolean>;
  readonly disabled: ReadonlySignal<boolean>;
  readonly touched: ReadonlySignal<boolean>;
  readonly dirty: ReadonlySignal<boolean>;
  readonly issues: ReadonlySignal<readonly ValidationIssue[]>;
  readonly ownIssues: ReadonlySignal<readonly ValidationIssue[]>;
  readonly component: ComponentRef | undefined;
  readonly componentProps: ReadonlySignal<Readonly<Record<string, unknown>>>;
  readonly shouldShowError: ReadonlySignal<boolean>;

  private readonly source: Signal<T>;
  /** Значение на момент построения — к нему возвращает {@link reset} без аргумента. */
  private readonly initialValue: T;
  private readonly interaction = createInteraction();
  private readonly issueState = createIssues();
  private readonly availability: ReturnType<typeof createAvailability>;
  private readonly pendingState = createPending();
  private readonly componentState: ReturnType<typeof createComponentState>;

  constructor(config: FieldConfig<T>) {
    this.source = config.valueSignal;
    this.initialValue = this.source.peek();
    this.component = config.component;
    this.availability = createAvailability(config.disabled === true);
    this.componentState = createComponentState(config.componentProps ?? {});

    const { disabled } = this.availability;
    const blocking = this.issueState.blocking;
    this.value = computed(() => this.source.value);
    this.disabled = disabled;
    this.pending = computed(() => !disabled.value && this.pendingState.active.value);
    this.invalid = computed(() => !disabled.value && !this.pending.value && blocking.value);
    this.valid = computed(() => !disabled.value && !this.pending.value && !blocking.value);
    this.touched = this.interaction.touched;
    this.dirty = this.interaction.dirty;
    this.issues = this.issueState.list;
    this.ownIssues = this.issueState.list;
    this.componentProps = this.componentState.props;
    this.shouldShowError = computed(
      () => this.invalid.value && (this.touched.value || this.dirty.value)
    );
  }

  getValue(): T {
    return this.source.peek();
  }

  setValue(value: T): void {
    this.source.value = value;
    this.interaction.setDirty(true);
  }

  /**
   * Сбросить поле: значение, замечания, `touched` и `dirty`. Без аргумента — к значению, с которым
   * нода создана (не к точке отсчёта модели: её возвращает `model.reset()`).
   */
  reset(value?: T): void {
    this.source.value = value !== undefined ? value : this.initialValue;
    this.issueState.clear();
    this.interaction.setTouched(false);
    this.interaction.setDirty(false);
  }

  markAsTouched(): void {
    this.interaction.setTouched(true);
  }

  markAsUntouched(): void {
    this.interaction.setTouched(false);
  }

  disable(): void {
    this.availability.setDisabled(true);
    this.issueState.clear();
  }

  enable(): void {
    this.availability.setDisabled(false);
  }

  setIssues(issues: readonly ValidationIssue[]): void {
    this.issueState.set(issues);
  }

  clearIssues(): void {
    this.issueState.clear();
  }

  updateComponentProps(patch: Record<string, unknown>): void {
    this.componentState.update(patch);
  }

  /** Раннер валидации: начало (`true`) и конец (`false`) async-правил поля. @internal */
  setPending(pending: boolean): void {
    this.pendingState.mark(pending);
  }

  /** У поля подписок нет. @internal */
  dispose(): void {}
}
