/**
 * Содержимое шага «Данные». Заголовок, значок и `selector` шага — в потоке заявки.
 */

import type { FormModel, FormSchemaNode } from '@reformer/core';
import { Box, InputMask, Section } from '@reformer/ui-kit';
import type { CreditApplicationForm } from '../../types/credit-application';
import { personalDataSection } from '../sections/personal-data';
import { passportDataSection } from '../sections/passport-data';

export const applicantStep = (model: FormModel<CreditApplicationForm>): FormSchemaNode[] => [
  {
    component: Section,
    componentProps: {
      title: 'Персональные данные',
      titleAs: 'h2',
      titleClassName: 'text-xl font-bold',
      className: 'space-y-6',
    },
    children: [
      personalDataSection(model),
      passportDataSection(model),
      {
        component: Section,
        componentProps: {
          title: 'Дополнительные документы',
          titleClassName: 'text-lg font-semibold',
          className: 'space-y-4',
        },
        children: [
          {
            component: Box,
            componentProps: { className: 'grid grid-cols-2 gap-4' },
            children: [
              {
                model: model.$.inn,
                component: InputMask,
                componentProps: {
                  label: 'ИНН',
                  placeholder: '123456789012',
                  mask: '999999999999',
                },
              },
              {
                model: model.$.snils,
                component: InputMask,
                componentProps: {
                  label: 'СНИЛС',
                  placeholder: '123-456-789 00',
                  mask: '999-999-999 99',
                },
              },
            ],
          },
        ],
      },
    ],
  },
];
