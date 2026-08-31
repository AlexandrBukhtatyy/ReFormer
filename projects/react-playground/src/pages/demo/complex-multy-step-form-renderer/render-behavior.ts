/**
 * Поведение схемы рендера кредитной заявки — ЕДИНЫЙ источник для обоих рендеров.
 *
 * Содержит всю visibility/navigation/submit/lifecycle + загрузку данных (через `data-boundary`).
 * Переиспользуется JSON-вариантом (`complex-multy-step-form-renderer-json/render-behavior.ts`),
 * который лишь до-инъектит `form`/validation в wizard и зовёт это поведение.
 *
 * Условия видимости нод и реактивные эффекты вынесены отдельно от layout-схемы.
 * Форма читается через ref wizard-компонента (FormWizardHandle.form).
 */

import {
  hideWhen,
  renderEffect,
  onComponentEvent,
  onMount,
  onUnmount,
  type RenderBehaviorFn,
} from '@reformer/renderer-react';
import type { FormProxy } from '@reformer/core';
import type { CreditApplicationForm } from '../complex-multy-step-form/types/credit-application';
import type { FormWizardHandle } from '@reformer/cdk/form-wizard';
import type { Property } from '../complex-multy-step-form/components/nested-forms/Property/types';
import type { ExistingLoan } from '../complex-multy-step-form/components/nested-forms/ExistingLoan/types';
import {
  fetchCreditApplication,
  fetchDictionaries,
  submitCreditApplication,
} from '../complex-multy-step-form/api';

/**
 * Фабрика поведения: принимает form напрямую, чтобы Preact computed()
 * мог корректно трекать сигналы формы — без зависимости от ref wizard-а,
 * который null в момент первого запуска computed при mount.
 */
export function createCreditApplicationRenderBehavior(
  form: FormProxy<CreditApplicationForm>
): RenderBehaviorFn<CreditApplicationForm> {
  return (schema) => {
    const wizardRef = schema.node('wizard').getRef<FormWizardHandle<CreditApplicationForm>>();
    const boundary = schema.node('data-boundary');

    // ── Загрузка данных заявки: управляет status у AsyncBoundary ─────────────
    const loadApplication = async () => {
      boundary.patchProps({ status: 'loading', error: null });
      try {
        const [app, dict] = await Promise.all([fetchCreditApplication('1'), fetchDictionaries()]);
        if (app.status !== 200) throw new Error('Ошибка загрузки заявки');
        if (dict.status !== 200) throw new Error('Ошибка загрузки справочников');
        form.patchValue(app.data);
        // queueMicrotask — дожидаемся завершения реактивных эффектов от patchValue
        queueMicrotask(() => {
          form.registrationAddress.city.updateComponentProps({ options: dict.data.cities });
          form.residenceAddress?.city.updateComponentProps({ options: dict.data.cities });
          form.properties?.forEach((p: FormProxy<Property>) =>
            p.type.updateComponentProps({ options: dict.data.propertyTypes })
          );
          form.existingLoans?.forEach((l: FormProxy<ExistingLoan>) =>
            l.bank.updateComponentProps({ options: dict.data.banks })
          );
        });
        boundary.patchProps({ status: 'ready' });
      } catch (e) {
        // Текст ошибки уходит прямо в props: раньше он был захардкожен в слот-компоненте,
        // а причина сбоя (заявка или справочники) до пользователя не доходила.
        boundary.patchProps({
          status: 'error',
          error: e instanceof Error ? e.message : 'Неизвестная ошибка',
          onRetry: () => void loadApplication(),
        });
      }
    };

    onMount(boundary, () => {
      void loadApplication();
    });

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
      try {
        const response = await submitCreditApplication(values);
        if (response.status === 200 || response.status === 201) {
          alert(`Заявка успешно отправлена! ID: ${response.data.id}`);
        } else {
          alert('Ошибка отправки заявки: сервер вернул неожиданный ответ');
        }
      } catch {
        alert('Ошибка отправки заявки: сервер недоступен');
      }
    });

    // ── Lifecycle-хуки: демонстрация ────────────────────────────────────────
    // onMount/onUnmount применимы к любой ноде с selector (контейнер или поле).
    onMount(schema.node('wizard'), () => {
      console.log('[render-behavior] wizard mounted');
      return () => console.log('[render-behavior] wizard cleanup from onMount');
    });

    onUnmount(schema.node('wizard'), () => {
      console.log('[render-behavior] wizard unmounted');
    });
  };
}
