/**
 * Содержимое шага «Доп. инфо». Заголовок, значок и `selector` шага — в потоке заявки.
 */

import type { FormModel, FormSchemaNode } from '@reformer/core';
import {
  Box,
  CheckboxWithLabel,
  FileUploadDropzone,
  FormArray,
  InputNumber,
  RadioGroupOptions,
  Section,
  SelectAsync,
} from '@reformer/ui-kit';
import { EDUCATIONS, MARITAL_STATUSES } from '../../constants/credit-application';
import type { CreditApplicationForm } from '../../types/credit-application';
import { propertyRow } from '../sections/property';
import { existingLoanRow } from '../sections/existing-loan';
import { coBorrowerRow } from '../sections/co-borrower';

export const additionalStep = (model: FormModel<CreditApplicationForm>): FormSchemaNode[] => [
  {
    component: Section,
    componentProps: {
      title: 'Дополнительная информация',
      titleAs: 'h2',
      titleClassName: 'text-xl font-bold',
      className: 'space-y-6',
    },
    children: [
      {
        component: Section,
        componentProps: {
          title: 'Общая информация',
          titleClassName: 'text-lg font-semibold',
          className: 'space-y-4',
        },
        children: [
          {
            model: model.$.maritalStatus,
            component: RadioGroupOptions,
            componentProps: {
              label: 'Семейное положение',
              options: MARITAL_STATUSES,
            },
          },
          {
            component: Box,
            componentProps: { className: 'grid grid-cols-2 gap-4' },
            children: [
              {
                model: model.$.dependents,
                component: InputNumber,
                componentProps: {
                  label: 'Количество иждивенцев',
                  placeholder: '0',
                  min: 0,
                  max: 10,
                },
              },
              {
                model: model.$.education,
                component: SelectAsync,
                componentProps: {
                  label: 'Образование',
                  placeholder: 'Выберите уровень образования',
                  options: EDUCATIONS,
                },
              },
            ],
          },
          // Deferred-режим: value = File[]; отбор делает сам компонент.
          {
            model: model.$.documents,
            component: FileUploadDropzone,
            componentProps: {
              label: 'Документы',
              placeholder: 'Перетащите файлы или нажмите для выбора',
              hint: 'Паспорт, справка о доходах — изображения или PDF, до 10 МБ, максимум 5 файлов',
              accept: 'image/*,.pdf',
              multiple: true,
              maxFiles: 5,
              maxFileSize: 10 * 1024 * 1024,
            },
          },
        ],
      },
      // Имущество
      {
        component: Section,
        componentProps: { className: 'space-y-4' },
        children: [
          {
            model: model.$.hasProperty,
            component: CheckboxWithLabel,
            componentProps: {
              label: 'У меня есть имущество',
            },
          },
          {
            selector: 'properties-array',
            model: model.$.properties,
            component: FormArray,
            componentProps: {
              title: 'Имущество',
              reorderable: true,
              itemLabel: 'Имущество',
              addButtonLabel: '+ Добавить имущество',
              emptyMessage: 'Нажмите "Добавить имущество" для добавления информации',
            },
            item: propertyRow,
          },
        ],
      },
      // Существующие кредиты
      {
        component: Section,
        componentProps: { className: 'space-y-4' },
        children: [
          {
            model: model.$.hasExistingLoans,
            component: CheckboxWithLabel,
            componentProps: {
              label: 'У меня есть другие кредиты',
            },
          },
          {
            selector: 'existing-loans-array',
            model: model.$.existingLoans,
            component: FormArray,
            componentProps: {
              title: 'Существующие кредиты',
              reorderable: true,
              itemLabel: 'Кредит',
              addButtonLabel: '+ Добавить кредит',
              emptyMessage: 'Нажмите "Добавить кредит" для добавления информации',
            },
            item: existingLoanRow,
          },
        ],
      },
      // Созаёмщики
      {
        component: Section,
        componentProps: { className: 'space-y-4' },
        children: [
          {
            model: model.$.hasCoBorrower,
            component: CheckboxWithLabel,
            componentProps: {
              label: 'Добавить созаемщика',
            },
          },
          {
            selector: 'co-borrowers-array',
            model: model.$.coBorrowers,
            component: FormArray,
            componentProps: {
              title: 'Созаемщики',
              reorderable: true,
              itemLabel: 'Созаемщик',
              addButtonLabel: '+ Добавить созаемщика',
              emptyMessage: 'Нажмите "Добавить созаемщика" для добавления информации',
            },
            item: coBorrowerRow,
          },
        ],
      },
    ],
  },
];
