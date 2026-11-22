/**
 * Схема кредитной заявки — одна на все способы реализации.
 *
 * Каркас: загрузка → визард → шаги. Шаги берутся из потока (`flow/credit-application-flow.ts`):
 * он назначает шагу `selector`, заголовок и значок; содержимое шага — `schema/steps/<шаг>.ts`.
 */

import type { FormModel, FormSchemaNode } from '@reformer/core';
import { Step } from '@reformer/cdk/form-wizard';
import { AsyncBoundary, FormWizard } from '@reformer/ui-kit';
import { creditApplicationFlow } from '../flow/credit-application-flow';
import type { CreditApplicationForm } from '../types/credit-application';

export const creditApplicationSchema = (
  model: FormModel<CreditApplicationForm>
): FormSchemaNode => ({
  selector: 'data-boundary',
  component: AsyncBoundary,
  // Статус (loading | error | ready) и текст ошибки подставляет приложение.
  componentProps: { status: 'loading' },
  children: [
    {
      selector: 'wizard',
      component: FormWizard,
      componentProps: {
        className: 'bg-white p-8 rounded-lg shadow-md',
        submitLabel: 'Отправить заявку',
      },
      children: creditApplicationFlow.map((step) => ({
        selector: step.selector,
        component: Step,
        componentProps: { title: step.title, icon: step.icon },
        children: step.content(model),
      })),
    },
  ],
});
