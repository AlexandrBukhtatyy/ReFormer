/**
 * Содержимое шага «Контакты». Заголовок, значок и `selector` шага — в потоке заявки.
 */

import type { FormModel, FormSchemaNode } from '@reformer/core';
import { Box, CheckboxWithLabel, Input, InputMask, Section } from '@reformer/ui-kit';
import { ResidenceAddressSection } from '../../components/ui/ResidenceAddressSection';
import type { CreditApplicationForm } from '../../types/credit-application';
import { addressPart } from '../sections/address';

export const contactsStep = (model: FormModel<CreditApplicationForm>): FormSchemaNode[] => [
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
        children: [{ model: model.$.registrationAddress, part: addressPart }],
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
            children: [{ model: model.$.residenceAddress, part: addressPart }],
          },
        ],
      },
    ],
  },
];
