/**
 * Поведение разметки формы «Заявка на кредит».
 *
 * Здесь живёт всё, что относится к дереву рендера, а не к модели:
 * условная видимость секций, блокировка readonly-полей и режима просмотра,
 * подписка на submit визарда.
 */

import type { FormProxy } from '@reformer/core';
import type { FormWizardHandle } from '@reformer/cdk/form-wizard';
import {
  hideWhen,
  onComponentEvent,
  onInit,
  type RenderBehaviorFn,
} from '@reformer/renderer-react';

import { submitCreditApplication, type SubmitApplicationResult } from './api';
import type { CreditApplicationForm, FormMode } from './types';

export type CreditRenderBehaviorDeps = {
  /** Режим формы: в `view` все поля блокируются целиком. */
  mode: FormMode;
  onSubmitStart: () => void;
  onSubmitSuccess: (result: SubmitApplicationResult) => void;
  onSubmitError: (message: string) => void;
};

/** Поля, которые считаются поведением и не редактируются вручную. */
const READONLY_FIELDS = [
  'interestRate',
  'monthlyPayment',
  'initialPayment',
  'fullName',
  'age',
  'totalIncome',
  'paymentToIncomeRatio',
  'coBorrowersIncome',
] as const;

/**
 * Фабрика render-behavior. Замыкает колбэки страницы, поэтому создаётся в `index.tsx`
 * и передаётся в `createReactForm({ renderBehavior })`.
 */
export function makeCreditApplicationRenderBehavior(deps: CreditRenderBehaviorDeps) {
  return (form: FormProxy<CreditApplicationForm>): RenderBehaviorFn<CreditApplicationForm> =>
    (schema) => {
      // Ref визарда запрашивается ДО первого рендера — иначе он никогда не прикрепится.
      const wizardRef = schema.node('wizard').getRef<FormWizardHandle<CreditApplicationForm>>();

      // ----------------------------------------------------------------------------------
      // Условная видимость. Предикат обязан читать сигнал ЦЕЛИКОМ (`.value.value`),
      // иначе условие не переоценится.
      // ----------------------------------------------------------------------------------
      hideWhen(schema.node('mortgage-section'), () => form.loanType.value.value !== 'mortgage');
      hideWhen(schema.node('car-section'), () => form.loanType.value.value !== 'car');
      hideWhen(
        schema.node('employed-section'),
        () => form.employmentStatus.value.value !== 'employed'
      );
      hideWhen(
        schema.node('self-employed-section'),
        () => form.employmentStatus.value.value !== 'selfEmployed'
      );
      hideWhen(
        schema.node('residence-section'),
        () => form.sameAsRegistration.value.value === true
      );
      hideWhen(schema.node('properties-array'), () => form.hasProperty.value.value !== true);
      hideWhen(schema.node('loans-array'), () => form.hasExistingLoans.value.value !== true);
      hideWhen(schema.node('loans-hint'), () => form.hasExistingLoans.value.value !== true);
      hideWhen(schema.node('coborrowers-array'), () => form.hasCoBorrower.value.value !== true);
      hideWhen(schema.node('coBorrowersIncome'), () => form.hasCoBorrower.value.value !== true);
      hideWhen(
        schema.node('additionalIncomeSource'),
        () => (form.additionalIncome.value.value ?? 0) <= 0
      );

      // ----------------------------------------------------------------------------------
      // Блокировки. Глобального `settings.readonly` нет; единственный рычаг — состояние
      // ноды (`disable()`): `componentProps.disabled` затирается seam-ом и не работает.
      // `onInit` синхронный и срабатывает до первого рендера.
      // ----------------------------------------------------------------------------------
      onInit(schema.node('wizard'), () => {
        if (deps.mode === 'view') {
          form.disable();
          return;
        }
        for (const field of READONLY_FIELDS) {
          form[field].disable();
        }
      });

      // ----------------------------------------------------------------------------------
      // Submit. `FormWizard.Actions` вызывает `onSubmit` сразу по клику и сам валидацию
      // не гоняет — её запускает `handle.submit`, который сперва прогоняет `validateAll`.
      // ----------------------------------------------------------------------------------
      onComponentEvent(schema.node('wizard'), 'onSubmit', async () => {
        if (deps.mode === 'view') return;
        deps.onSubmitStart();
        try {
          const result = await wizardRef.current?.submit((values) =>
            submitCreditApplication(values)
          );
          if (result) {
            deps.onSubmitSuccess(result);
          } else {
            deps.onSubmitError('Форма заполнена не полностью — проверьте выделенные поля.');
          }
        } catch (error) {
          deps.onSubmitError(
            error instanceof Error ? error.message : 'Не удалось отправить заявку.'
          );
        }
      });
    };
}
