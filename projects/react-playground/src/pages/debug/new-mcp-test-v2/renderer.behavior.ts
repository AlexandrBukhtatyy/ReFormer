/**
 * Поведение РЕНДЕРА: инъекция рантайм-сущностей в wizard, submit, условная
 * видимость секций и readonly вычисляемых полей.
 *
 * JSON статичен и не выражает `FormProxy`, конфиг валидации и колбэки —
 * поэтому они кладутся в ноду через `onInit` + `patchProps` до первого рендера.
 */
import type { FormWizardHandle } from '@reformer/cdk/form-wizard';
import type { FormModel, FormProxy, FormValidationBundle } from '@reformer/core';
import {
  hideWhen,
  onComponentEvent,
  onInit,
  type RenderBehaviorFn,
} from '@reformer/renderer-react';

import { submitCreditApplication } from './api';
import type { CreditApplicationForm, FormMode } from './types';

type Form = CreditApplicationForm;

export interface RenderBehaviorOptions {
  mode: FormMode;
  onSubmitted?: (message: string) => void;
  onSubmitError?: (message: string) => void;
}

export function createCreditRenderBehavior(
  form: FormProxy<Form>,
  model: FormModel<Form>,
  validation: FormValidationBundle<Form> | undefined,
  options: RenderBehaviorOptions
): RenderBehaviorFn<Form> {
  return (schema) => {
    const wizard = schema.node('wizard');
    // getRef() обязан быть вызван ДО первого рендера ноды.
    const wizardRef = wizard.getRef<FormWizardHandle<Form>>();

    /* (a) Инъекция рантайма: форма + validateStep/validateAll до первого рендера. */
    onInit(wizard, () => {
      wizard.patchProps({ form, config: validation });

      // Вычисляемые поля — readonly: `componentProps.disabled` в JSON не работает
      // by design, единственный рычаг — состояние ноды.
      form.interestRate.disable();
      form.monthlyPayment.disable();
      form.initialPayment.disable();
      form.fullName.disable();
      form.age.disable();
      form.totalIncome.disable();
      form.paymentToIncomeRatio.disable();
      form.coBorrowersIncome.disable();

      // mode='view' — вся форма read-only одним каскадом с корня.
      if (options.mode === 'view') form.disable();
    });

    /* (b) Submit.
     *
     * Проп-уровневый `onSubmit` у ui-kit `FormWizard` вызывается СРАЗУ по клику,
     * до какой-либо валидации (`FormWizard.Actions` дергает его из `submit.onClick`).
     * Полную валидацию запускает только `handle.submit(cb)` — он прогоняет
     * `config.validateAll` и возвращает `null`, если форма её не прошла.
     * Поэтому здесь: сначала шаг, затем submit через handle.
     */
    onComponentEvent(wizard, 'onSubmit', async () => {
      const handle = wizardRef.current;
      if (!handle) return;
      const stepOk = await handle.validateCurrentStep();
      if (!stepOk) return;
      try {
        const result = await handle.submit(() => submitCreditApplication(model.get()));
        if (!result) return; // validateAll заблокировал отправку
        options.onSubmitted?.(`${result.message} (№ ${result.id})`);
      } catch (error) {
        options.onSubmitError?.((error as Error).message);
      }
    });

    /* (c) Условная видимость секций и подсказок. */
    hideWhen(schema.node('mortgage-section'), () => model.$.loanType.value !== 'mortgage');
    hideWhen(schema.node('mortgage-hint'), () => model.$.loanType.value !== 'mortgage');
    hideWhen(schema.node('car-section'), () => model.$.loanType.value !== 'car');

    hideWhen(schema.node('employed-section'), () => model.$.employmentStatus.value !== 'employed');
    hideWhen(
      schema.node('self-employed-section'),
      () => model.$.employmentStatus.value !== 'selfEmployed'
    );
    hideWhen(
      schema.node('self-employed-hint'),
      () => model.$.employmentStatus.value !== 'selfEmployed'
    );

    hideWhen(schema.node('residence-section'), () => model.$.sameAsRegistration.value === true);

    hideWhen(schema.node('properties-array'), () => model.$.hasProperty.value !== true);
    hideWhen(schema.node('existing-loans-array'), () => model.$.hasExistingLoans.value !== true);
    hideWhen(schema.node('existing-loans-hint'), () => model.$.hasExistingLoans.value !== true);
    hideWhen(schema.node('co-borrowers-array'), () => model.$.hasCoBorrower.value !== true);
    hideWhen(schema.node('coBorrowersIncome'), () => model.$.hasCoBorrower.value !== true);

    hideWhen(
      schema.node('additional-income-source'),
      () => (model.$.additionalIncome.value ?? 0) <= 0
    );

    /* (d) Предупреждения из спеки — блоки видны только пока условие держится. */
    hideWhen(schema.node('warn-debt-load'), () => (model.$.paymentToIncomeRatio.value ?? 0) <= 40);
    hideWhen(schema.node('warn-age'), () => (model.$.age.value ?? 0) <= 60);
    hideWhen(
      schema.node('warn-experience'),
      () => model.$.workExperienceCurrent.value === null || model.$.workExperienceCurrent.value >= 3
    );
  };
}
