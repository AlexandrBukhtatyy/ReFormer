/**
 * Шаг «Доп. инфо» кредитной заявки. `selector` шага — ключ его правил в `form.validation.ts`.
 */

import type { FormModel, FormSchemaNode } from '@reformer/core';
import { Step } from '@reformer/cdk/form-wizard';
import {
  Box,
  CheckboxWithLabel,
  FileUploadDropzone,
  FormArray,
  Input,
  InputMask,
  InputNumber,
  RadioGroupOptions,
  Section,
  SelectAsync,
  Textarea,
} from '@reformer/ui-kit';
import {
  EDUCATIONS,
  EXISTING_LOAN_TYPES,
  MARITAL_STATUSES,
  RELATIONSHIPS,
} from '../../constants/credit-application';
import type { CreditApplicationForm } from '../../types/credit-application';
import type { Property } from '../../components/nested-forms/Property/types';
import type { ExistingLoan } from '../../components/nested-forms/ExistingLoan/types';
import type { CoBorrower } from '../../components/nested-forms/CoBorrower/types';

/** Строка массива: пути — от элемента. Шаблон нового элемента объявлен в `model.ts`. */
const property = (model: FormModel<Property>): FormSchemaNode => ({
  component: Box,
  componentProps: { className: 'space-y-3' },
  children: [
    {
      model: model.$.type,
      component: SelectAsync,
      componentProps: {
        label: 'Тип имущества',
        placeholder: 'Выберите тип',
        testId: 'property-type',
        options: [
          { value: 'apartment', label: 'Квартира' },
          { value: 'house', label: 'Дом' },
          { value: 'land', label: 'Земельный участок' },
          { value: 'commercial', label: 'Коммерческая недвижимость' },
          { value: 'car', label: 'Автомобиль' },
          { value: 'other', label: 'Другое' },
        ],
      },
    },
    {
      model: model.$.description,
      component: Textarea,
      componentProps: {
        label: 'Описание',
        placeholder: 'Опишите имущество',
        rows: 2,
        testId: 'property-description',
      },
    },
    {
      model: model.$.estimatedValue,
      component: InputNumber,
      componentProps: {
        label: 'Оценочная стоимость',
        placeholder: '0',
        min: 0,
        step: 1000,
        testId: 'property-estimatedValue',
      },
    },
    {
      model: model.$.hasEncumbrance,
      component: CheckboxWithLabel,
      componentProps: {
        label: 'Имеется обременение (залог)',
        testId: 'property-hasEncumbrance',
      },
    },
  ],
});

/** Строка массива: пути — от элемента. Шаблон нового элемента объявлен в `model.ts`. */
const existingLoan = (model: FormModel<ExistingLoan>): FormSchemaNode => ({
  component: Box,
  componentProps: { className: 'space-y-3' },
  children: [
    {
      model: model.$.bank,
      component: Input,
      componentProps: {
        label: 'Банк',
        placeholder: 'Название банка',
        testId: 'existingLoan-bank',
      },
    },
    {
      model: model.$.type,
      component: SelectAsync,
      componentProps: {
        label: 'Тип кредита',
        placeholder: 'Выберите тип',
        options: EXISTING_LOAN_TYPES,
        testId: 'existingLoan-type',
      },
    },
    {
      component: Box,
      componentProps: { className: 'grid grid-cols-2 gap-4' },
      children: [
        {
          model: model.$.amount,
          component: InputNumber,
          componentProps: {
            label: 'Сумма кредита (₽)',
            placeholder: '0',
            min: 0,
            step: 1000,
            testId: 'existingLoan-amount',
          },
        },
        {
          model: model.$.remainingAmount,
          component: InputNumber,
          componentProps: {
            label: 'Остаток долга (₽)',
            placeholder: '0',
            min: 0,
            step: 1000,
            testId: 'existingLoan-remainingAmount',
          },
        },
      ],
    },
    {
      component: Box,
      componentProps: { className: 'grid grid-cols-2 gap-4' },
      children: [
        {
          model: model.$.monthlyPayment,
          component: InputNumber,
          componentProps: {
            label: 'Ежемесячный платеж (₽)',
            placeholder: '0',
            min: 0,
            step: 100,
            testId: 'existingLoan-monthlyPayment',
          },
        },
        {
          model: model.$.maturityDate,
          component: Input,
          componentProps: {
            label: 'Дата погашения',
            type: 'date',
            testId: 'existingLoan-maturityDate',
          },
        },
      ],
    },
  ],
});

/** Строка массива: пути — от элемента. Шаблон нового элемента объявлен в `model.ts`. */
const coBorrower = (model: FormModel<CoBorrower>): FormSchemaNode => ({
  component: Box,
  componentProps: { className: 'space-y-3' },
  children: [
    {
      component: Box,
      componentProps: { className: 'grid grid-cols-3 gap-4' },
      children: [
        {
          model: model.$.personalData.lastName,
          component: Input,
          componentProps: {
            label: 'Фамилия',
            placeholder: 'Введите фамилию',
            testId: 'coBorrower-lastName',
          },
        },
        {
          model: model.$.personalData.firstName,
          component: Input,
          componentProps: {
            label: 'Имя',
            placeholder: 'Введите имя',
            testId: 'coBorrower-firstName',
          },
        },
        {
          model: model.$.personalData.middleName,
          component: Input,
          componentProps: {
            label: 'Отчество',
            placeholder: 'Введите отчество',
            testId: 'coBorrower-middleName',
          },
        },
      ],
    },
    {
      model: model.$.personalData.birthDate,
      component: Input,
      componentProps: {
        label: 'Дата рождения',
        type: 'date',
        testId: 'coBorrower-birthDate',
      },
    },
    {
      component: Box,
      componentProps: { className: 'grid grid-cols-2 gap-4' },
      children: [
        {
          model: model.$.phone,
          component: InputMask,
          componentProps: {
            label: 'Телефон',
            placeholder: '+7 (___) ___-__-__',
            mask: '+7 (999) 999-99-99',
            testId: 'coBorrower-phone',
          },
        },
        {
          model: model.$.email,
          component: Input,
          componentProps: {
            label: 'Email',
            placeholder: 'example@mail.com',
            type: 'email',
            testId: 'coBorrower-email',
          },
        },
      ],
    },
    {
      component: Box,
      componentProps: { className: 'grid grid-cols-2 gap-4' },
      children: [
        {
          model: model.$.relationship,
          component: SelectAsync,
          componentProps: {
            label: 'Отношение к заемщику',
            placeholder: 'Выберите отношение',
            options: RELATIONSHIPS,
            testId: 'coBorrower-relationship',
          },
        },
        {
          model: model.$.monthlyIncome,
          component: InputNumber,
          componentProps: {
            label: 'Ежемесячный доход (₽)',
            placeholder: '0',
            min: 0,
            step: 1000,
            testId: 'coBorrower-monthlyIncome',
          },
        },
      ],
    },
  ],
});

export const additionalStep = (model: FormModel<CreditApplicationForm>): FormSchemaNode => ({
  selector: 'additional',
  component: Step,
  componentProps: { title: 'Доп. инфо', icon: '📋' },
  children: [
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
              item: property,
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
              item: existingLoan,
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
              item: coBorrower,
            },
          ],
        },
      ],
    },
  ],
});
