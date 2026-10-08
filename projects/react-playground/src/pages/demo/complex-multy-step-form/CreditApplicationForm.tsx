/**
 * CreditApplicationForm — вариант «React руками».
 *
 * Сборка та же, что у renderer-вариантов (`application/create.ts`). Из схемы эта страница берёт
 * поля, из потока — список шагов; разметку шагов рисует JSX. Условия видимости секций — общие с
 * поведением и правилами (`model/predicates.ts`), загрузка и отправка — общие с
 * renderer-вариантами (`application/`).
 */

import { useRef } from 'react';
import { useFormBundle } from '@reformer/core';
import { AsyncBoundary, FormWizard, type FormWizardStep } from '@reformer/ui-kit';
import type { FormWizardHandle } from '@reformer/cdk/form-wizard';
import { ValidationMessagesProvider } from '@reformer/cdk';
import { createCreditApplication } from './application/create';
import { loadCreditApplication, type CreditApplicationData } from './application/load';
import { applyCreditApplication } from './application/mapping';
import { reportSubmitOutcome, sendCreditApplication } from './application/submit';
import { creditApplicationFlow, type StepSelector } from './flow/credit-application-flow';
import { BasicInfoForm } from './components/steps/BasicInfo/BasicInfoForm';
import { PersonalInfoForm } from './components/steps/PersonalInfo/PersonalInfoForm';
import { ContactInfoForm } from './components/steps/ContactInfo/ContactInfoForm';
import { EmploymentForm } from './components/steps/Employment/EmploymentForm';
import { AdditionalInfoForm } from './components/steps/AdditionalInfo/AdditionalInfoForm';
import { ConfirmationForm } from './components/steps/Confirmation/ConfirmationForm';
import { fileUploadMessages } from './constants/file-upload-messages';
import type { CreditApplicationForm as CreditApplicationFormType } from './types/credit-application';

type Step = FormWizardStep<CreditApplicationFormType>;

/** JSX тела шага. Тип требует компонент для каждого шага потока. */
const STEP_BODIES: Record<StepSelector, Step['body']> = {
  loan: BasicInfoForm,
  applicant: PersonalInfoForm,
  contacts: ContactInfoForm,
  employment: EmploymentForm,
  additional: AdditionalInfoForm,
  confirmation: ConfirmationForm,
};

/** Шаги визарда: порядок, заголовки и значки — из потока заявки. */
const STEPS: Step[] = creditApplicationFlow.map((step, index) => ({
  number: index + 1,
  title: step.title,
  icon: step.icon,
  body: STEP_BODIES[step.selector],
}));

function CreditApplicationForm() {
  const wizardRef = useRef<FormWizardHandle<CreditApplicationFormType>>(null);

  // Модель, форма и валидация — одной сборкой. useFormBundle зовёт фабрику ровно один раз и
  // держит бандл стабильным.
  const bundle = useFormBundle(() => createCreditApplication());
  const { form, validation } = bundle;

  // ID заявки: '1' / '2' — редактирование, null — пустая форма (создание).
  const applicationId: string | null = '1';

  const submitApplication = async () => {
    // Визард зовёт обработчик только после успешной валидации; иначе возвращает null.
    const outcome = await wizardRef.current?.submit(sendCreditApplication);
    if (outcome) reportSubmitOutcome(outcome);
    else alert('Пожалуйста, исправьте ошибки в форме');
  };

  // Загрузкой управляет AsyncBoundary: состояние, отмена устаревшего запроса, «Повторить».
  return (
    // Резолвер текстов для кодов отбора FileUpload (поле «Документы», шаг 5).
    <ValidationMessagesProvider resolver={fileUploadMessages}>
      <AsyncBoundary<CreditApplicationData>
        load={(signal) => loadCreditApplication(applicationId!, signal)}
        loadKey={applicationId}
        enabled={applicationId !== null}
        onSuccess={(data) => applyCreditApplication(bundle, data)}
      >
        <FormWizard
          ref={wizardRef}
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
