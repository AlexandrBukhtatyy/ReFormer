/**
 * Содержимое шага «Работа». Заголовок, значок и `selector` шага — в потоке заявки.
 */

import type { FormModel, FormSchemaNode } from '@reformer/core';
import { Box, RadioGroupOptions, Section } from '@reformer/ui-kit';
import { UnemployedWarning } from '../../components/ui/UnemployedWarning';
import { EMPLOYMENT_STATUSES } from '../../constants/credit-application';
import type { CreditApplicationForm } from '../../types/credit-application';
import { businessSection } from '../sections/business';
import { employerSection } from '../sections/employer';
import { incomeSection } from '../sections/income';

export const employmentStep = (model: FormModel<CreditApplicationForm>): FormSchemaNode[] => [
  {
    component: Section,
    componentProps: {
      title: 'Информация о занятости',
      titleAs: 'h2',
      titleClassName: 'text-xl font-bold',
      className: 'space-y-6',
    },
    children: [
      {
        component: Box,
        componentProps: { className: 'space-y-4' },
        children: [
          {
            model: model.$.employmentStatus,
            component: RadioGroupOptions,
            componentProps: {
              label: 'Статус занятости',
              options: EMPLOYMENT_STATUSES,
            },
          },
        ],
      },
      employerSection(model),
      businessSection(model, {
        selector: 'business-section',
        titleClassName: 'text-lg font-semibold mt-6',
      }),
      incomeSection(model),
      {
        selector: 'unemployed-warning',
        component: UnemployedWarning,
        componentProps: { className: 'mt-6' },
      },
    ],
  },
];
