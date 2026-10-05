/**
 * Схема кредитной заявки — одна на все способы реализации.
 *
 * Узел привязан к модели ключом `model`: поле, массив под-форм (`item`) или подформа (`part`).
 * Из этого дерева сборка `createForm` строит форму, а `FormRenderer` рисует разметку. Вариант
 * «React руками» берёт из той же схемы только поля — разметку он рисует сам.
 *
 * Каркас: загрузка → визард → шаги. Шаги лежат в `steps/<шаг>/form.schema.ts`.
 */

import type { FormModel, FormSchemaNode } from '@reformer/core';
import { AsyncBoundary, FormWizard } from '@reformer/ui-kit';
import type { CreditApplicationForm } from './types/credit-application';
import { loanStep } from './steps/loan/form.schema';
import { applicantStep } from './steps/applicant/form.schema';
import { contactsStep } from './steps/contacts/form.schema';
import { employmentStep } from './steps/employment/form.schema';
import { additionalStep } from './steps/additional/form.schema';
import { confirmationStep } from './steps/confirmation/form.schema';

export const creditApplicationSchema = (
  model: FormModel<CreditApplicationForm>
): FormSchemaNode => ({
  selector: 'data-boundary',
  component: AsyncBoundary,
  // Статус (loading | error | ready) и текст ошибки подставляет поведение формы.
  componentProps: { status: 'loading' },
  children: [
    {
      selector: 'wizard',
      component: FormWizard,
      componentProps: {
        className: 'bg-white p-8 rounded-lg shadow-md',
        submitLabel: 'Отправить заявку',
      },
      children: [
        loanStep(model),
        applicantStep(model),
        contactsStep(model),
        employmentStep(model),
        additionalStep(model),
        confirmationStep(model),
      ],
    },
  ],
});
