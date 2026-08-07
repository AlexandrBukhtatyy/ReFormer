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
}
