/**
 * FormStatusMachine - State Machine для управления статусами полей
 *
 * Централизует логику переходов между статусами:
 * - valid -> pending -> valid/invalid
 * - any -> disabled
 * - disabled -> valid/invalid
 *
 * @group Utils
 * @module utils/status-machine
 */

import { signal, computed } from '@preact/signals-core';
import type { Signal, ReadonlySignal } from '@preact/signals-core';
import type { FieldStatus } from './types/index';

/**
 * События для State Machine
 *
 * @deprecated Будет удалён в 7.0 вместе с {@link FormStatusMachine.dispatch} — единственным
 * потребителем этого типа. Используйте именованные методы (`startValidation`/`completeValidation`/
 * `setErrors`/`disable`/`enable`).
 */
export type StatusEvent =
  | { type: 'START_VALIDATION' }
  | { type: 'VALIDATION_SUCCESS' }
  | { type: 'VALIDATION_FAILURE' }
  | { type: 'DISABLE' }
  | { type: 'ENABLE'; hasErrors?: boolean }
  | { type: 'SET_ERRORS'; hasErrors: boolean };

/**
 * FormStatusMachine - управляет состоянием поля формы
 *
 * Предоставляет:
 * - Единый источник истины для статуса
 * - Computed signals для derived состояний (valid, invalid, pending, disabled)
 * - Валидацию переходов между состояниями
 *
 * @example
 * ```typescript
 * const statusMachine = new FormStatusMachine('valid');
 *
 * // Начало валидации
 * statusMachine.startValidation();
 * console.log(statusMachine.pending.value); // true
 *
 * // Завершение валидации с ошибками
 * statusMachine.completeValidation(true);
 * console.log(statusMachine.invalid.value); // true
 *
 * // Отключение поля
 * statusMachine.disable();
 * console.log(statusMachine.disabled.value); // true
 * ```
 */
export class FormStatusMachine {
  /** Внутренний сигнал статуса */
  private readonly _status: Signal<FieldStatus>;

  /** Публичный read-only сигнал статуса */
  readonly status: ReadonlySignal<FieldStatus>;

  /** Поле валидно */
  readonly valid: ReadonlySignal<boolean>;

  /** Поле невалидно */
  readonly invalid: ReadonlySignal<boolean>;

  /** Идет валидация */
  readonly pending: ReadonlySignal<boolean>;

  /** Поле отключено */
  readonly disabled: ReadonlySignal<boolean>;

  /**
   * @param initial - Начальный статус (по умолчанию 'valid')
   */
  constructor(initial: FieldStatus = 'valid') {
    this._status = signal(initial);

    // Публичный read-only статус
    this.status = computed(() => this._status.value);

    // Derived signals
    this.valid = computed(() => this._status.value === 'valid');
    this.invalid = computed(() => this._status.value === 'invalid');
    this.pending = computed(() => this._status.value === 'pending');
    this.disabled = computed(() => this._status.value === 'disabled');
  }

  /**
   * Начать валидацию
   *
   * Переводит статус в 'pending' если поле не отключено
   *
   * @example
   * ```typescript
   * statusMachine.startValidation();
   * // status: 'pending'
   * ```
   */
  startValidation(): void {
    if (this._status.value !== 'disabled') {
      this._status.value = 'pending';
    }
  }

  /**
   * Завершить валидацию
   *
   * @param hasErrors - Есть ли ошибки валидации
   *
   * @example
   * ```typescript
   * // Валидация успешна
   * statusMachine.completeValidation(false);
   * // status: 'valid'
   *
   * // Есть ошибки
   * statusMachine.completeValidation(true);
   * // status: 'invalid'
   * ```
   */
  completeValidation(hasErrors: boolean): void {
    // Guard против устаревшего async-результата: если поле, пока шла валидация,
    // перешло в 'disabled', результат не применяем. Во всех остальных состояниях
    // (pending — обычный async-путь; valid/invalid — sync-путь) завершаем.
    // NB: `=== 'pending' || !== 'disabled'` тождественно `!== 'disabled'` — прежний
    // первый дизъюнкт был мёртвым кодом.
    if (this._status.value !== 'disabled') {
      this._status.value = hasErrors ? 'invalid' : 'valid';
    }
  }

  /**
   * Установить ошибки напрямую (без перехода через pending)
   *
   * Используется для синхронной валидации или установки ошибок извне
   *
   * @param hasErrors - Есть ли ошибки
   *
   * @example
   * ```typescript
   * statusMachine.setErrors(true);
   * // status: 'invalid'
   * ```
   */
  setErrors(hasErrors: boolean): void {
    if (this._status.value !== 'disabled') {
      this._status.value = hasErrors ? 'invalid' : 'valid';
    }
  }

  /**
   * Отключить поле
   *
   * Переводит статус в 'disabled'
   *
   * @example
   * ```typescript
   * statusMachine.disable();
   * // status: 'disabled'
   * ```
   */
  disable(): void {
    this._status.value = 'disabled';
  }

  /**
   * Включить поле
   *
   * @param hasErrors - Есть ли ошибки (определяет valid/invalid)
   *
   * @example
   * ```typescript
   * statusMachine.enable(false);
   * // status: 'valid'
   *
   * statusMachine.enable(true);
   * // status: 'invalid'
   * ```
   */
  enable(hasErrors: boolean = false): void {
    this._status.value = hasErrors ? 'invalid' : 'valid';
  }

  /**
   * Обработать событие (альтернативный API)
   *
   * @param event - Событие для обработки
   *
   * @example
   * ```typescript
   * statusMachine.dispatch({ type: 'START_VALIDATION' });
   * statusMachine.dispatch({ type: 'VALIDATION_FAILURE' });
   * ```
   *
   * @deprecated Будет удалён в 7.0. Альтернативный event-based API не прижился: ни одного
   * вызова ни в ядре, ни в остальных пакетах — `FieldNode` работает только через именованные
   * методы. Используйте их напрямую.
   */
  dispatch(event: StatusEvent): void {
    switch (event.type) {
      case 'START_VALIDATION':
        this.startValidation();
        break;
      case 'VALIDATION_SUCCESS':
        this.completeValidation(false);
        break;
      case 'VALIDATION_FAILURE':
        this.completeValidation(true);
        break;
      case 'DISABLE':
        this.disable();
        break;
      case 'ENABLE':
        this.enable(event.hasErrors);
        break;
      case 'SET_ERRORS':
        this.setErrors(event.hasErrors);
        break;
    }
  }

  /**
   * Получить текущий статус
   *
   * @deprecated Будет удалён в 7.0. Используйте сигнал `status` (`machine.status.value`) —
   * он реактивен, а этот метод отдаёт снимок.
   */
  getStatus(): FieldStatus {
    return this._status.value;
  }

  /**
   * Проверить, можно ли начать валидацию
   *
   * @deprecated Будет удалён в 7.0. Используйте `!machine.disabled.value` — ту же проверку
   * ядро уже делает инлайном в трёх местах, а метод не вызывается нигде.
   */
  canValidate(): boolean {
    return this._status.value !== 'disabled';
  }
}
