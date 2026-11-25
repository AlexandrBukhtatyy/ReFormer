/**
 * Поток шагов формы в компоненте Angular: сигналы потока сигналами Angular.
 *
 * @module renderer-angular/platform/form-flow
 */

import { DestroyRef, inject, type Signal } from '@angular/core';
import type { FormFlow } from '@reformer/core';
import { fromCoreSignal } from '../bridge/signals';

/** Состояние потока шагов сигналами Angular. Подписка заводится при первом чтении. */
export interface FormFlowSignals {
  /** Идентификатор текущего шага. */
  readonly current: Signal<string>;
  /** Место текущего шага среди участвующих, с нуля. */
  readonly index: Signal<number>;
  /** Шаги, которые сейчас участвуют в потоке, по порядку. */
  readonly activeSteps: Signal<readonly string[]>;
  /** Пройденные шаги. */
  readonly completed: Signal<ReadonlySet<string>>;
  readonly isFirst: Signal<boolean>;
  readonly isLast: Signal<boolean>;
  /** Идёт проверка шага перед переходом. */
  readonly validating: Signal<boolean>;
}

const KEYS = [
  'current',
  'index',
  'activeSteps',
  'completed',
  'isFirst',
  'isLast',
  'validating',
] as const;

/**
 * Состояние потока шагов для шаблона. Компонент подписывается только на прочитанное: визард,
 * который не показывает `validating`, на проверку шага не перерисовывается.
 *
 * Переходы — методы самого потока: `flow.next()`, `flow.previous()`, `flow.goTo(id)`.
 *
 * Вызывать при создании компонента: подписки снимаются вместе с ним.
 *
 * @param flow - Поток шагов сборки (`createForm({ flow })` → `bundle.flow`) функцией.
 *
 * @example
 * ```ts
 * @Component({
 *   selector: 'app-wizard-next',
 *   template: `<button [disabled]="steps.isLast()" (click)="flow.next()">{{ steps.current() }}</button>`,
 * })
 * export class WizardNext {
 *   protected readonly flow = injectFormBundle()!.flow!;
 *   protected readonly steps = formFlowSignals(() => this.flow);
 * }
 * ```
 */
export function formFlowSignals(flow: () => FormFlow): FormFlowSignals {
  const destroyRef = inject(DestroyRef);
  const signals: Record<string, Signal<unknown>> = {};
  for (const name of KEYS) {
    signals[name] = fromCoreSignal(() => flow()[name].value as unknown, destroyRef);
  }
  return signals as unknown as FormFlowSignals;
}
