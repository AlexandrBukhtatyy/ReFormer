/**
 * Behavior-схема JSON-варианта кредитной заявки.
 *
 * Тонкая обёртка над TS-variant behavior-ом:
 * 1. Инжектит в `componentProps` wizard-а через `onInit` (build-time hook,
 *    до первого рендера) всё form-specific: сам FormProxy, step-validations и
 *    full-validation. JSON-схема не знает про эти сущности — она описывает layout.
 * 2. Делегирует остальное (hideWhen для conditional sections, onComponentEvent
 *    для submit, renderEffect, lifecycle-хуки) в общий `createCreditApplicationRenderBehavior`.
 */

import {
  hideWhen,
  onComponentEvent,
  onInit,
  onMount,
  onUnmount,
  renderEffect,
  type RenderBehaviorFn,
} from '@reformer/renderer-react';
import type { FormProxy } from '@reformer/core';
import type { CreditApplicationForm } from '../complex-multy-step-form/types/credit-application';
import creditApplicationValidation, {
  STEP_VALIDATIONS,
} from '../complex-multy-step-form/schemas/credit-application-validation';
import { createCreditApplicationRenderBehavior } from '../complex-multy-step-form-renderer/render-behavior';
import { submitCreditApplication } from '../complex-multy-step-form/api';
import type { FormWizardHandle } from '@reformer/cdk/form-wizard';

export function createCreditApplicationJsonRenderBehavior(
  form: FormProxy<CreditApplicationForm>
): RenderBehaviorFn<CreditApplicationForm> {
  return (schema) => {
    const wizardRef = schema.node('wizard').getRef<FormWizardHandle<CreditApplicationForm>>();

    // ── Реактивный эффект: навигация wizard через ref ────────────────────────
    // useEffect запускается после mount — wizardRef.current уже доступен.
    renderEffect(schema, () => {
      if (form.loanType.value.value === 'mortgage') {
        wizardRef.current?.goToStep(1);
      }
    });

    // ── Шаг 1: тип кредита ──────────────────────────────────────────────────
    hideWhen(schema.node('mortgage-section'), () => form.loanType.value.value !== 'mortgage');
    hideWhen(schema.node('car-section'), () => form.loanType.value.value !== 'car');

    // ── Шаг 3: адреса ───────────────────────────────────────────────────────
    hideWhen(
      schema.node('residence-address-section'),
      () => form.sameAsRegistration.value.value === true
    );

    // ── Шаг 4: занятость ────────────────────────────────────────────────────
    hideWhen(
      schema.node('employer-section'),
      () => form.employmentStatus.value.value !== 'employed'
    );
    hideWhen(
      schema.node('business-section'),
      () => form.employmentStatus.value.value !== 'selfEmployed'
    );
    hideWhen(
      schema.node('income-section'),
      () => form.employmentStatus.value.value === 'unemployed'
    );
    hideWhen(
      schema.node('unemployed-warning'),
      () => form.employmentStatus.value.value !== 'unemployed'
    );

    // ── Шаг 5: дополнительные секции ────────────────────────────────────────
    hideWhen(schema.node('properties-array'), () => !form.hasProperty.value.value);
    hideWhen(schema.node('existing-loans-array'), () => !form.hasExistingLoans.value.value);
    hideWhen(schema.node('co-borrowers-array'), () => !form.hasCoBorrower.value.value);

    // ── Шаг 6: отправка формы ───────────────────────────────────────────────
    onComponentEvent(schema.node('wizard'), 'onSubmit', async (values: CreditApplicationForm) => {
      const response = await submitCreditApplication(values);
      if (response.status === 200 || response.status === 201) {
        alert(`Заявка успешно отправлена! ID: ${response.data.id}`);
      } else {
        throw new Error('Ошибка отправки заявки');
      }
    });

    // ── Lifecycle-хуки: демонстрация ────────────────────────────────────────
    // onMount/onUnmount применимы к любой ноде с selector (контейнер или поле).
    onInit(schema.node('wizard'), () => {
      schema.node('wizard').patchProps({
        form,
        stepValidations: STEP_VALIDATIONS,
        fullValidation: creditApplicationValidation,
      });
    });

    onMount(schema.node('wizard'), () => {
      console.log('[render-behavior] wizard mounted');
      return () => console.log('[render-behavior] wizard cleanup from onMount');
    });

    onUnmount(schema.node('wizard'), () => {
      console.log('[render-behavior] wizard unmounted');
    });

    createCreditApplicationRenderBehavior(form)(schema);
  };
}
