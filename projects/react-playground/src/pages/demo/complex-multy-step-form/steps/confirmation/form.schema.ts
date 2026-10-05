/**
 * Шаг «Подтверждение» кредитной заявки. `selector` шага — ключ его правил в `form.validation.ts`.
 */

import type { FormModel, FormSchemaNode } from '@reformer/core';
import { Step } from '@reformer/cdk/form-wizard';
import { Box, CheckboxWithLabel, InputMask, Section } from '@reformer/ui-kit';
import type { CreditApplicationForm } from '../../types/credit-application';
import {
  ApplicantSummarySection,
  ConfirmationInfoBlock,
  ElectronicSignatureHint,
  HighPaymentWarning,
  LoanSummarySection,
  NextStepsInfo,
  SubmitWarning,
} from '../../components/ui/ConfirmationComponents';

export const confirmationStep = (model: FormModel<CreditApplicationForm>): FormSchemaNode => ({
  selector: 'confirmation',
  component: Step,
  componentProps: { title: 'Подтверждение', icon: '✓' },
  children: [
    {
      component: Section,
      componentProps: {
        title: 'Подтверждение и согласия',
        titleAs: 'h2',
        titleClassName: 'text-xl font-bold',
        className: 'space-y-6',
      },
      children: [
        {
          component: Box,
          componentProps: { className: 'space-y-4' },
          children: [{ component: ConfirmationInfoBlock }, { component: HighPaymentWarning }],
        },
        { component: LoanSummarySection },
        { component: ApplicantSummarySection },
        {
          component: Section,
          componentProps: {
            title: 'Обязательные согласия',
            titleClassName: 'text-lg font-semibold',
            className: 'space-y-3',
          },
          children: [
            {
              model: model.$.agreePersonalData,
              component: CheckboxWithLabel,
              componentProps: {
                label: 'Согласие на обработку персональных данных',
              },
            },
            {
              model: model.$.agreeCreditHistory,
              component: CheckboxWithLabel,
              componentProps: {
                label: 'Согласие на проверку кредитной истории',
              },
            },
            {
              model: model.$.agreeTerms,
              component: CheckboxWithLabel,
              componentProps: {
                label: 'Согласие с условиями кредитования',
              },
            },
            {
              model: model.$.confirmAccuracy,
              component: CheckboxWithLabel,
              componentProps: {
                label: 'Подтверждаю точность введенных данных',
              },
            },
          ],
        },
        {
          component: Section,
          componentProps: {
            title: 'Опциональные согласия',
            titleClassName: 'text-lg font-semibold mt-6',
          },
          children: [
            {
              model: model.$.agreeMarketing,
              component: CheckboxWithLabel,
              componentProps: {
                label: 'Согласие на получение маркетинговых материалов',
              },
            },
          ],
        },
        {
          component: Section,
          componentProps: {
            title: 'Электронная подпись',
            titleClassName: 'text-lg font-semibold mt-6',
            className: 'space-y-4',
          },
          children: [
            {
              model: model.$.electronicSignature,
              component: InputMask,
              componentProps: {
                label: 'Код подтверждения из СМС',
                placeholder: '123456',
                mask: '999999',
              },
            },
            { component: ElectronicSignatureHint },
          ],
        },
        { component: SubmitWarning },
        { component: NextStepsInfo },
      ],
    },
  ],
});
