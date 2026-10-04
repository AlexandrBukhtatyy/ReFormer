/**
 * Шаг «Контакты» кредитной заявки. `selector` шага — ключ его правил в `form.validation.ts`.
 */

import type { FormModel, FormSchemaNode } from '@reformer/core';
import { Step } from '@reformer/cdk/form-wizard';
import { Box, CheckboxWithLabel, Input, InputMask, Section } from '@reformer/ui-kit';
import type { CreditApplicationForm } from '../../types/credit-application';
import type { Address } from '../../components/nested-forms/Address/types';
import { ResidenceAddressSection } from '../../components/ui/ResidenceAddressSection';

/** Подформа адреса: объявлена один раз, стоит в шаге дважды — регистрация и проживание. */
const address = (model: FormModel<Address>): FormSchemaNode => ({
  component: Box,
  componentProps: { className: 'space-y-4' },
  children: [
    {
      component: Box,
      componentProps: { className: 'grid grid-cols-2 gap-4' },
      children: [
        {
          model: model.$.region,
          component: Input,
          componentProps: {
            label: 'Регион',
            placeholder: 'Введите регион',
          },
        },
        {
          model: model.$.city,
          component: Input,
          componentProps: {
            label: 'Город',
            placeholder: 'Введите город',
          },
        },
      ],
    },
    {
      model: model.$.street,
      component: Input,
      componentProps: {
        label: 'Улица',
        placeholder: 'Введите улицу',
      },
    },
    {
      component: Box,
      componentProps: { className: 'grid grid-cols-3 gap-4' },
      children: [
        {
          model: model.$.house,
          component: Input,
          componentProps: {
            label: 'Дом',
            placeholder: '№',
          },
        },
        {
          model: model.$.apartment,
          component: Input,
          componentProps: {
            label: 'Квартира',
            placeholder: '№',
          },
        },
        {
          model: model.$.postalCode,
          component: InputMask,
          componentProps: {
            label: 'Индекс',
            placeholder: '000000',
            mask: '999999',
          },
        },
      ],
    },
  ],
});

export const contactsStep = (model: FormModel<CreditApplicationForm>): FormSchemaNode => ({
  selector: 'contacts',
  component: Step,
  componentProps: { title: 'Контакты', icon: '📞' },
  children: [
    {
      component: Section,
      componentProps: {
        title: 'Контактная информация',
        titleAs: 'h2',
        titleClassName: 'text-xl font-bold',
        className: 'space-y-6',
      },
      children: [
        {
          component: Section,
          componentProps: {
            title: 'Контакты',
            titleClassName: 'text-lg font-semibold',
            className: 'space-y-4',
          },
          children: [
            {
              component: Box,
              componentProps: { className: 'grid grid-cols-2 gap-4' },
              children: [
                {
                  model: model.$.phoneMain,
                  component: InputMask,
                  componentProps: {
                    label: 'Основной телефон',
                    placeholder: '+7 (___) ___-__-__',
                    mask: '+7 (999) 999-99-99',
                  },
                },
                {
                  model: model.$.phoneAdditional,
                  component: InputMask,
                  componentProps: {
                    label: 'Дополнительный телефон',
                    placeholder: '+7 (___) ___-__-__',
                    mask: '+7 (999) 999-99-99',
                  },
                },
              ],
            },
            {
              component: Box,
              componentProps: { className: 'grid grid-cols-2 gap-4' },
              children: [
                {
                  model: model.$.email,
                  component: Input,
                  componentProps: {
                    label: 'Email',
                    placeholder: 'example@mail.com',
                    type: 'email',
                  },
                },
                {
                  model: model.$.emailAdditional,
                  component: Input,
                  componentProps: {
                    label: 'Дополнительный email',
                    placeholder: 'example@mail.com',
                    type: 'email',
                  },
                },
              ],
            },
            {
              model: model.$.sameEmail,
              component: CheckboxWithLabel,
              componentProps: { label: 'Дублировать email' },
            },
          ],
        },
        {
          component: Section,
          componentProps: {
            title: 'Адрес регистрации',
            titleClassName: 'text-lg font-semibold',
            className: 'space-y-4',
          },
          children: [{ model: model.$.registrationAddress, part: address }],
        },
        {
          model: model.$.sameAsRegistration,
          component: CheckboxWithLabel,
          componentProps: {
            label: 'Адрес проживания совпадает с адресом регистрации',
          },
        },
        {
          selector: 'residence-address-section',
          component: Box,
          children: [
            {
              component: ResidenceAddressSection,
              children: [{ model: model.$.residenceAddress, part: address }],
            },
          ],
        },
      ],
    },
  ],
});
