/**
 * Состояние поля формы в компоненте Angular: сигналы ноды сигналами Angular и текст показанного
 * замечания.
 *
 * @module renderer-angular/platform/form-control
 */

import { DestroyRef, inject, type Signal } from '@angular/core';
import type { FormControl, ValidationIssue } from '@reformer/core';
import { resolveIssueMessage } from '@reformer/core/i18n';
import { primaryIssue } from '@reformer/core/render';
import { fromCoreSignal } from '../bridge/signals';
import { ISSUE_MESSAGES, REFORMER_I18N } from '../context';

/** Состояние поля сигналами Angular. Подписка на сигнал ноды заводится при первом чтении. */
export interface FormControlSignals<T = unknown> {
  readonly value: Signal<T>;
  readonly disabled: Signal<boolean>;
  readonly touched: Signal<boolean>;
  /** Идёт асинхронная проверка поля. */
  readonly pending: Signal<boolean>;
  readonly issues: Signal<readonly ValidationIssue[]>;
  /** Состояние ошибки: поле невалидно и его трогали или меняли. */
  readonly shouldShowError: Signal<boolean>;
  /** Показывать ли тексты замечаний: ошибки или предупреждения на тронутом поле. */
  readonly shouldShowIssues: Signal<boolean>;
  /** Путь поля в модели; у поля строки массива следует за индексом строки. */
  readonly path: Signal<string>;
  /** Реактивные пропсы ноды (`updateComponentProps`). */
  readonly componentProps: Signal<Readonly<Record<string, unknown>>>;
}

const KEYS = [
  'value',
  'disabled',
  'touched',
  'pending',
  'issues',
  'shouldShowError',
  'shouldShowIssues',
  'path',
  'componentProps',
] as const;

/**
 * Состояние поля для шаблона. Компонент подписывается только на прочитанное: поле, которое не
 * показывает `pending`, на серверную проверку не перерисовывается.
 *
 * Нода передаётся функцией — обычно это сам вход компонента: сигналы следуют и за сменой ноды.
 * Вызывать при создании компонента: подписки снимаются вместе с ним.
 *
 * @example
 * ```ts
 * @Component({
 *   selector: 'input[appTextInput]',
 *   template: '',
 *   host: { '[value]': 'field.value()', '[disabled]': 'field.disabled()' },
 * })
 * export class TextInput {
 *   static readonly reformerNeedsControl = true; // нода — входом `control`
 *   readonly control = input.required<FormControl<string>>();
 *   protected readonly field = formControlSignals(this.control);
 * }
 * ```
 */
export function formControlSignals<T>(control: () => FormControl<T>): FormControlSignals<T> {
  const destroyRef = inject(DestroyRef);
  const signals: Record<string, Signal<unknown>> = {};
  for (const name of KEYS) {
    signals[name] = fromCoreSignal(() => control()[name].value as unknown, destroyRef);
  }
  return signals as unknown as FormControlSignals<T>;
}

/**
 * Резолвер текста замечания: словарь формы → словарь локали по коду → встроенный английский →
 * сам код. Вызывать при создании компонента.
 */
export function injectIssueMessage(): (issue: ValidationIssue) => string {
  const i18n = inject(REFORMER_I18N);
  const messages = inject(ISSUE_MESSAGES, { optional: true }) ?? undefined;
  return (issue) => resolveIssueMessage(issue, i18n, messages);
}

/**
 * Текст замечания, которое поле показывает сейчас: главное замечание тронутого поля либо
 * `undefined`. Пока текста нет, элемент ошибки в разметку не ставится. Вызывать при создании
 * компонента.
 *
 * @example
 * ```ts
 * @Component({
 *   selector: 'app-field-error',
 *   template: `@if (error(); as text) { <p role="alert">{{ text }}</p> }`,
 * })
 * export class FieldError {
 *   readonly control = input.required<FormControl<unknown>>();
 *   protected readonly error = fieldError(this.control);
 * }
 * ```
 */
export function fieldError(control: () => FormControl<unknown>): Signal<string | undefined> {
  const resolve = injectIssueMessage();
  return fromCoreSignal(() => {
    const node = control();
    if (!node.shouldShowIssues.value) return undefined;
    const issue = primaryIssue(node.issues.value);
    return issue ? resolve(issue) : undefined;
  });
}
