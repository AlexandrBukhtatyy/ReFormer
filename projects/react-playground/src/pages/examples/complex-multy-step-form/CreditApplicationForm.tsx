/**
 * CreditApplicationForm
 *
 * Использует:
 * - FormWizard компонент для multi-step формы
 * - Actions с render props для навигационных кнопок
 * - Headless компоненты (Indicator, Progress) с render props
 * - GroupNode для вложенных форм и массивов
 * - validateForm для валидации по шагам
 * - useLoadCreditApplication для загрузки данных
 * - Полную типизацию TypeScript
 */

import { useMemo, useRef } from 'react';
import { createCreditApplicationFormM1 } from './schemas/create-form';
import { BasicInfoForm } from './components/steps/BasicInfo/BasicInfoForm';
import { PersonalInfoForm } from './components/steps/PersonalInfo/PersonalInfoForm';
import { ContactInfoForm } from './components/steps/ContactInfo/ContactInfoForm';
import { EmploymentForm } from './components/steps/Employment/EmploymentForm';
import { AdditionalInfoForm } from './components/steps/AdditionalInfo/AdditionalInfoForm';
import { ConfirmationForm } from './components/steps/Confirmation/ConfirmationForm';
import { makeCreditValidationConfig } from './schemas/validation';
import {
  applyCreditApplication,
  loadCreditApplication,
  type CreditApplicationBundle,
} from './hooks/useLoadCreditApplication';
import { submitCreditApplication } from './api';
import type { CreditApplicationForm as CreditApplicationFormType } from './types/credit-application';
import { AsyncBoundary } from '@reformer/ui-kit';
import { FormWizard, type FormWizardStep } from '@reformer/ui-kit/form-wizard';
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

  //  Инициализируем модель + форму (M1) — мемоизируем, чтобы не пересоздавать при рендере.
  //  Поведение (compute/enableWhen/onChange) запускается внутри createForm({ behavior }).
  const { form, model } = useMemo(() => createCreditApplicationFormM1(), []);

  // Конфигурация навигации: M1-валидация (validateFormModel) per-step + полная
  const navConfig = useMemo(() => makeCreditValidationConfig(model), [model]);

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
          config={navConfig}
          steps={STEPS}
          onSubmit={submitApplication}
        />
      </AsyncBoundary>
    </ValidationMessagesProvider>
  );
}

export default CreditApplicationForm;
