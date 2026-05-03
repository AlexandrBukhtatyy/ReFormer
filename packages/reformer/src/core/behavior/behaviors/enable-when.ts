/**
 * Условное включение/отключение полей
 *
 * @group Behaviors
 * @category Behavior Rules
 * @module behaviors/enableWhen
 */

import { effect } from '@preact/signals-core';
import type { FieldPathNode } from '../../types';
import { getCurrentBehaviorRegistry } from '../../utils/registry-helpers';
import { runOutsideEffect } from '../../utils/safe-effect';
import type { EnableWhenOptions, BehaviorHandlerFn } from '../types';

/**
 * Условное включение поля на основе значений других полей
 *
 * @group Behaviors
 * @category Behavior Rules
 *
 * @param field - Поле для включения/выключения
 * @param condition - Функция условия (true = enable, false = disable)
 * @param options - Опции (`resetOnDisable`, `debounce`)
 *
 * @example Базовый сценарий с `resetOnDisable: true`
 * ```typescript
 * import { enableWhen, type BehaviorSchemaFn } from '@reformer/core/behaviors';
 *
 * interface LoanForm {
 *   loanType: 'mortgage' | 'consumer' | 'car';
 *   propertyValue: number;
 *   initialPayment: number;
 * }
 *
 * export const loanBehavior: BehaviorSchemaFn<LoanForm> = (path) => {
 *   // Поля ипотеки активны только для loanType === 'mortgage'.
 *   // resetOnDisable: true гарантирует чистые initial values при переключении.
 *   enableWhen(path.propertyValue, (form) => form.loanType === 'mortgage', {
 *     resetOnDisable: true,
 *   });
 *   enableWhen(path.initialPayment, (form) => form.loanType === 'mortgage', {
 *     resetOnDisable: true,
 *   });
 * };
 * ```
 *
 * @example Множественные independent условия + cycle prevention
 * ```typescript
 * import { enableWhen, type BehaviorSchemaFn } from '@reformer/core/behaviors';
 *
 * interface ProfileForm {
 *   sameAsRegistration: boolean;
 *   employmentStatus: 'employed' | 'selfEmployed' | 'unemployed';
 *   residenceAddress: { city: string; street: string };
 *   companyName: string;
 *   companyInn: string;
 *   businessType: string;
 * }
 *
 * export const profileBehavior: BehaviorSchemaFn<ProfileForm> = (path) => {
 *   // Адрес проживания: enabled, когда НЕ совпадает с регистрационным
 *   enableWhen(path.residenceAddress, (form) => form.sameAsRegistration === false, {
 *     resetOnDisable: true,
 *   });
 *
 *   // Поля работодателя: только для employed
 *   enableWhen(path.companyName, (form) => form.employmentStatus === 'employed', {
 *     resetOnDisable: true,
 *   });
 *   enableWhen(path.companyInn, (form) => form.employmentStatus === 'employed', {
 *     resetOnDisable: true,
 *   });
 *
 *   // ИП-поля: только для selfEmployed
 *   enableWhen(path.businessType, (form) => form.employmentStatus === 'selfEmployed', {
 *     resetOnDisable: true,
 *   });
 *
 *   // ВАЖНО: condition не должен читать значение САМОГО поля — иначе цикл.
 *   // condition зависит ТОЛЬКО от независимых триггеров (loanType, employmentStatus, ...).
 * };
 * ```
 *
 * @see [docs/llms/22-cycle-detection.md](../../../../docs/llms/22-cycle-detection.md)
 */
export function enableWhen<TForm>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  field: FieldPathNode<TForm, any>,
  condition: (form: TForm) => boolean,
  options?: EnableWhenOptions
): void {
  const { debounce, resetOnDisable = false } = options || {};

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handler: BehaviorHandlerFn<any> = (form, _context, withDebounce) => {
    const targetNode = form.getFieldByPath(field.__path);
    if (!targetNode) return null;

    return effect(() => {
      const formValue = form.value.value;

      withDebounce(() => {
        const shouldEnable = condition(formValue);

        // runOutsideEffect выходит из контекста effect, предотвращая "Cycle detected"
        runOutsideEffect(() => {
          if (shouldEnable) {
            targetNode.enable();
          } else {
            targetNode.disable();
            if (resetOnDisable) {
              targetNode.reset();
            }
          }
        });
      });
    });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getCurrentBehaviorRegistry().register(handler as any, { debounce });
}

/**
 * Условное выключение поля (инверсия enableWhen)
 *
 * @group Behaviors
 * @category Behavior Rules
 *
 * @param field - Поле для выключения
 * @param condition - Функция условия (true = disable, false = enable)
 * @param options - Опции (`resetOnDisable`, `debounce`)
 *
 * @example Базовый сценарий — readonly после подтверждения
 * ```typescript
 * import { disableWhen, type BehaviorSchemaFn } from '@reformer/core/behaviors';
 *
 * interface ConfirmForm {
 *   isConfirmed: boolean;
 *   editableField: string;
 * }
 *
 * export const confirmBehavior: BehaviorSchemaFn<ConfirmForm> = (path) => {
 *   // Поле блокируется после установки чекбокса подтверждения
 *   disableWhen(path.editableField, (form) => form.isConfirmed === true);
 *   // resetOnDisable НЕ ставим — сохраняем введённый текст
 * };
 * ```
 *
 * @example С `resetOnDisable` для очистки заблокированного поля
 * ```typescript
 * import { disableWhen, type BehaviorSchemaFn } from '@reformer/core/behaviors';
 *
 * interface PromoForm {
 *   loanType: 'mortgage' | 'consumer';
 *   promoCode: string;
 * }
 *
 * export const promoBehavior: BehaviorSchemaFn<PromoForm> = (path) => {
 *   // Промокод недоступен для потребительских кредитов и сбрасывается
 *   disableWhen(path.promoCode, (form) => form.loanType === 'consumer', {
 *     resetOnDisable: true,
 *   });
 * };
 * ```
 */
export function disableWhen<TForm>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  field: FieldPathNode<TForm, any>,
  condition: (form: TForm) => boolean,
  options?: EnableWhenOptions
): void {
  // Инвертируем условие
  enableWhen(field, (form) => !condition(form), options);
}
