import { useMemo, useRef, useState } from 'react';
import { FormWizard, type FormWizardStep } from '@reformer/ui-kit/form-wizard';
import type { FormWizardHandle } from '@reformer/cdk/form-wizard';

import { createCreditApplicationForm, STEP_VALIDATIONS } from './schema';
import { Step1, Step2, Step3, Step4, Step5, Step6 } from './steps';
import { submitApplication } from './api';
import type { CreditApplicationForm } from './types';

const STEPS: FormWizardStep<CreditApplicationForm>[] = [
  { number: 1, title: 'Кредит', icon: '💰', body: Step1 },
  { number: 2, title: 'Личные', icon: '🪪', body: Step2 },
  { number: 3, title: 'Контакты', icon: '📞', body: Step3 },
  { number: 4, title: 'Работа', icon: '💼', body: Step4 },
  { number: 5, title: 'Доп. инфо', icon: '🏠', body: Step5 },
  { number: 6, title: 'Подтверждение', icon: '✅', body: Step6 },
];

export default function MccaCoreV17Page() {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const navRef = useRef<FormWizardHandle<CreditApplicationForm>>(null);
  const [submitState, setSubmitState] = useState<
    | { status: 'idle' }
    | { status: 'success'; id: string }
    | { status: 'error'; message: string }
  >({ status: 'idle' });

  const handleSubmit = async () => {
    const values = form.getValue();
    try {
      const result = await submitApplication<CreditApplicationForm>(values);
      if (result.success) {
        setSubmitState({ status: 'success', id: result.id });
      } else {
        setSubmitState({ status: 'error', message: 'Не удалось отправить заявку' });
      }
    } catch (e) {
      setSubmitState({ status: 'error', message: (e as Error).message });
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold mb-2">Заявка на кредит</h1>
      <p className="text-gray-600 mb-6">
        MCP-credit-application (target=core, iter-17). 6 шагов: кредит, личные, контакты,
        работа, доп.&nbsp;инфо, подтверждение.
      </p>

      {submitState.status === 'success' && (
        <div
          className="mb-4 rounded border border-green-200 bg-green-50 p-3 text-green-700"
          data-testid="submit-success"
        >
          Заявка отправлена. ID: {submitState.id}
        </div>
      )}
      {submitState.status === 'error' && (
        <div
          className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-red-700"
          data-testid="submit-error"
        >
          Ошибка: {submitState.message}
        </div>
      )}

      <FormWizard
        ref={navRef}
        form={form}
        config={{
          stepValidations: STEP_VALIDATIONS,
          fullValidation: (path) => {
            for (const fn of Object.values(STEP_VALIDATIONS)) fn(path);
          },
        }}
        steps={STEPS}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
