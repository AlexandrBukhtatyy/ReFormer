/**
 * CreditApplicationForm — вариант «React руками».
 *
 * Сборка та же, что у renderer-вариантов: `createForm` с общими моделью, схемой, правилами и
 * поведением. Из схемы эта страница берёт только поля — разметку, видимость секций, загрузку и
 * отправку она рисует и ведёт сама, в JSX:
 * - `FormWizard` получает `form`, `config` и `steps` пропсами;
 * - тела шагов — React-компоненты с `<FormField control={…} />`;
 * - правила узлов из поведения (`hideWhen`, `onMount`, `onComponentEvent`) исполняет рендерер,
 *   которого здесь нет, — поэтому условия видимости записаны в компонентах шагов.
 */

import { useRef } from 'react';
import { createForm, useFormBundle } from '@reformer/core';
import { createCreditApplicationModel } from './model';
import { creditApplicationSchema } from './form.schema';
import { creditApplicationBehavior } from './form.behavior';
import { creditApplicationValidation } from './form.validation';
import { BasicInfoForm } from './components/steps/BasicInfo/BasicInfoForm';
import { PersonalInfoForm } from './components/steps/PersonalInfo/PersonalInfoForm';
import { ContactInfoForm } from './components/steps/ContactInfo/ContactInfoForm';
import { EmploymentForm } from './components/steps/Employment/EmploymentForm';
import { AdditionalInfoForm } from './components/steps/AdditionalInfo/AdditionalInfoForm';
import { ConfirmationForm } from './components/steps/Confirmation/ConfirmationForm';
import {
  applyCreditApplication,
  loadCreditApplication,
  type CreditApplicationBundle,
} from './hooks/useLoadCreditApplication';
import { submitCreditApplication } from './api';
import type { CreditApplicationForm as CreditApplicationFormType } from './types/credit-application';
import { AsyncBoundary, FormWizard, type FormWizardStep } from '@reformer/ui-kit';
import type { FormWizardHandle } from '@reformer/cdk/form-wizard';
import { ValidationMessagesProvider } from '@reformer/cdk';
import { fileUploadMessages } from './constants/file-upload-messages';

export const STEPS: FormWizardStep<CreditApplicationFormType>[] = [
  { number: 1, title: 'Кредит', icon: '💰', body: BasicInfoForm },
  { number: 2, title: 'Данные', icon: '👤', body: PersonalInfoForm },
  { number: 3, title: 'Контакты', icon: '📞', body: ContactInfoForm },
  { number: 4, title: 'Работа', icon: '💼', body: EmploymentForm },
  { number: 5, title: 'Доп. инфо', icon: '📋', body: AdditionalInfoForm },
  { number: 6, title: 'Подтверждение', icon: '✓', body: ConfirmationForm },
];

// ============================================================================
// Компонент формы
// ============================================================================
function CreditApplicationForm() {
  // Ref для доступа к методам навигации
  const navRef = useRef<FormWizardHandle<CreditApplicationFormType>>(null);

  //  Модель + форма + валидация — одним вызовом. useFormBundle зовёт фабрику ровно один раз и
  //  держит бандл стабильным (useMemo для этого не годится: React вправе сбросить его кэш).
  //  Поведение (compute/enableWhen/onChange) запускается внутри сборки.
  const { form, validation } = useFormBundle(() =>
    createForm<CreditApplicationFormType>({
      model: createCreditApplicationModel(),
      // Из схемы берутся поля: компоненты и пропсы для `FormField`. Контейнеры не используются.
      schema: creditApplicationSchema,
      behavior: creditApplicationBehavior,
      validation: creditApplicationValidation,
    })
  );

  //  ID заявки: '1' / '2' — редактирование, null — пустая форма (создание).
  const applicationId: string | null = '1';

  // ============================================================================
  // Отправка формы
  // ============================================================================

  const submitApplication = async () => {
    try {
      const result = await navRef.current?.submit(async (values: CreditApplicationFormType) => {
        const response = await submitCreditApplication(values);
        if (response.status === 200 || response.status === 201) {
          return response.data;
        }
        throw new Error('Ошибка отправки заявки');
      });

      if (result) {
        alert(`Заявка успешно отправлена! ID: ${result.id}`);
      } else {
        alert('Пожалуйста, исправьте ошибки в форме');
      }
    } catch {
      alert('Ошибка отправки заявки: сервер недоступен');
    }
  };

  // ============================================================================
  // Рендер
  // ============================================================================

  // Загрузкой управляет сам AsyncBoundary (self-managed режим): состояние, отмена
  // устаревшего запроса при смене id, кнопка «Повторить» и ARIA (aria-busy /
  // role=status / role=alert) — внутри компонента. Снаружи остаются только
  // «как загрузить» и «что сделать с ответом».
  return (
    // Резолвер текстов для кодов отбора FileUpload (поле «Документы», шаг 5).
    <ValidationMessagesProvider resolver={fileUploadMessages}>
      <AsyncBoundary<CreditApplicationBundle>
        load={(signal) => loadCreditApplication(applicationId!, signal)}
        loadKey={applicationId}
        enabled={applicationId !== null}
        onSuccess={(bundle) => applyCreditApplication(form, bundle)}
      >
        <FormWizard
          ref={navRef}
          form={form}
          config={validation}
          steps={STEPS}
          onSubmit={submitApplication}
          submitLabel="Отправить заявку"
        />
      </AsyncBoundary>
    </ValidationMessagesProvider>
  );
}

export default CreditApplicationForm;
