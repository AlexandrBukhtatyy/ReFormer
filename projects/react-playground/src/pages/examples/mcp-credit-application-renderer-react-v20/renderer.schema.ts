// renderer.schema.ts — the RenderNode tree (M1). Layout only, NO validators (those live in
// validation.ts). Leaves carry model signals (value: model.$.x). FormWizard is the root node;
// all 6 steps + 3 FormArray sections are inline. Validation config injected inline into the wizard node.
// Conditional sections carry a `selector` so renderer.behavior can hideWhen them.

import type { FormModel, FormProxy } from '@reformer/core';
import type { RenderNode } from '@reformer/renderer-react';
import { FormWizard } from '@reformer/ui-kit/form-wizard';
import {
  Box,
  CheckboxField,
  InputField,
  InputMaskField,
  RadioGroupField,
  Section,
  SelectField,
  TextareaField,
} from '@reformer/ui-kit';
import type { CoBorrower, CreditApplicationForm, ExistingLoan, PropertyItem } from './types';
import {
  EDUCATION_OPTIONS,
  EMPLOYMENT_STATUS_OPTIONS,
  GENDER_OPTIONS,
  LOAN_TYPE_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  PROPERTY_TYPE_OPTIONS,
} from './types';
import { BANK_OPTIONS, REGION_OPTIONS } from './data-sources';
import { createBlankCoBorrower, createBlankExistingLoan, createBlankProperty } from './model';
import { makeCreditValidationConfig } from './validation';

const RO = { disabled: true }; // readonly (computed) fields

export function buildCreditApplicationSchema(
  model: FormModel<CreditApplicationForm>,
  form?: FormProxy<CreditApplicationForm>
): RenderNode<CreditApplicationForm> {
  // ── Step 1 — Основная информация о кредите ─────────────────────────────────
  const step1Body = {
    component: Box,
    componentProps: { className: 'space-y-4' },
    children: [
      {
        value: model.$.loanType,
        component: SelectField,
        componentProps: { label: 'Тип кредита', testId: 'loanType', options: LOAN_TYPE_OPTIONS },
      },
      {
        value: model.$.loanAmount,
        component: InputField,
        componentProps: {
          label: 'Сумма кредита (₽)',
          testId: 'loanAmount',
          type: 'number',
          step: 10000,
        },
      },
      {
        value: model.$.loanTerm,
        component: InputField,
        componentProps: { label: 'Срок кредита (мес.)', testId: 'loanTerm', type: 'number' },
      },
      {
        value: model.$.loanPurpose,
        component: TextareaField,
        componentProps: { label: 'Цель кредита', testId: 'loanPurpose', maxLength: 500 },
      },
      // mortgage-only
      {
        selector: 'mortgage-section',
        component: Section,
        componentProps: { title: 'Ипотека', className: 'space-y-4' },
        children: [
          {
            value: model.$.propertyValue,
            component: InputField,
            componentProps: {
              label: 'Стоимость недвижимости (₽)',
              testId: 'propertyValue',
              type: 'number',
            },
          },
          {
            value: model.$.initialPayment,
            component: InputField,
            componentProps: {
              label: 'Первоначальный взнос (₽)',
              testId: 'initialPayment',
              type: 'number',
              ...RO,
            },
          },
        ],
      },
      // car-only
      {
        selector: 'car-section',
        component: Section,
        componentProps: { title: 'Автокредит', className: 'space-y-4' },
        children: [
          {
            value: model.$.carBrand,
            component: InputField,
            componentProps: { label: 'Марка автомобиля', testId: 'carBrand' },
          },
          {
            value: model.$.carModel,
            component: SelectField,
            componentProps: { label: 'Модель автомобиля', testId: 'carModel', options: [] },
          },
          {
            value: model.$.carYear,
            component: InputField,
            componentProps: { label: 'Год выпуска', testId: 'carYear', type: 'number' },
          },
          {
            value: model.$.carPrice,
            component: InputField,
            componentProps: {
              label: 'Стоимость автомобиля (₽)',
              testId: 'carPrice',
              type: 'number',
            },
          },
        ],
      },
      // computed summary
      {
        component: Section,
        componentProps: { title: 'Расчёт', className: 'space-y-4' },
        children: [
          {
            value: model.$.interestRate,
            component: InputField,
            componentProps: {
              label: 'Процентная ставка (%)',
              testId: 'interestRate',
              type: 'number',
              ...RO,
            },
          },
          {
            value: model.$.monthlyPayment,
            component: InputField,
            componentProps: {
              label: 'Ежемесячный платёж (₽)',
              testId: 'monthlyPayment',
              type: 'number',
              ...RO,
            },
          },
        ],
      },
    ],
  };

  // ── Step 2 — Персональные данные ───────────────────────────────────────────
  const step2Body = {
    component: Box,
    componentProps: { className: 'space-y-4' },
    children: [
      {
        component: Section,
        componentProps: { title: 'Личные данные', className: 'space-y-4' },
        children: [
          {
            value: model.$.personalData.lastName,
            component: InputField,
            componentProps: { label: 'Фамилия', testId: 'personalData-lastName' },
          },
          {
            value: model.$.personalData.firstName,
            component: InputField,
            componentProps: { label: 'Имя', testId: 'personalData-firstName' },
          },
          {
            value: model.$.personalData.middleName,
            component: InputField,
            componentProps: { label: 'Отчество', testId: 'personalData-middleName' },
          },
          {
            value: model.$.personalData.birthDate,
            component: InputField,
            componentProps: {
              label: 'Дата рождения',
              testId: 'personalData-birthDate',
              type: 'date',
            },
          },
          {
            value: model.$.personalData.gender,
            component: RadioGroupField,
            componentProps: {
              label: 'Пол',
              testId: 'personalData-gender',
              options: GENDER_OPTIONS,
            },
          },
          {
            value: model.$.personalData.birthPlace,
            component: InputField,
            componentProps: { label: 'Место рождения', testId: 'personalData-birthPlace' },
          },
          {
            value: model.$.fullName,
            component: InputField,
            componentProps: { label: 'Полное имя', testId: 'fullName', ...RO },
          },
          {
            value: model.$.age,
            component: InputField,
            componentProps: { label: 'Возраст (лет)', testId: 'age', type: 'number', ...RO },
          },
        ],
      },
      {
        component: Section,
        componentProps: { title: 'Паспортные данные', className: 'space-y-4' },
        children: [
          {
            value: model.$.passportData.series,
            component: InputMaskField,
            componentProps: {
              label: 'Серия паспорта',
              testId: 'passportData-series',
              mask: '99 99',
            },
          },
          {
            value: model.$.passportData.number,
            component: InputMaskField,
            componentProps: {
              label: 'Номер паспорта',
              testId: 'passportData-number',
              mask: '999999',
            },
          },
          {
            value: model.$.passportData.issueDate,
            component: InputField,
            componentProps: {
              label: 'Дата выдачи',
              testId: 'passportData-issueDate',
              type: 'date',
            },
          },
          {
            value: model.$.passportData.issuedBy,
            component: InputField,
            componentProps: { label: 'Кем выдан', testId: 'passportData-issuedBy' },
          },
          {
            value: model.$.passportData.departmentCode,
            component: InputMaskField,
            componentProps: {
              label: 'Код подразделения',
              testId: 'passportData-departmentCode',
              mask: '999-999',
            },
          },
        ],
      },
      {
        component: Section,
        componentProps: { title: 'Документы', className: 'space-y-4' },
        children: [
          {
            value: model.$.inn,
            component: InputMaskField,
            componentProps: { label: 'ИНН', testId: 'inn', mask: '999999999999' },
          },
          {
            value: model.$.snils,
            component: InputMaskField,
            componentProps: { label: 'СНИЛС', testId: 'snils', mask: '999-999-999 99' },
          },
        ],
      },
    ],
  };

  // ── Step 3 — Контактная информация ─────────────────────────────────────────
  const step3Body = {
    component: Box,
    componentProps: { className: 'space-y-4' },
    children: [
      {
        component: Section,
        componentProps: { title: 'Контакты', className: 'space-y-4' },
        children: [
          {
            value: model.$.phoneMain,
            component: InputMaskField,
            componentProps: {
              label: 'Основной телефон',
              testId: 'phoneMain',
              mask: '+7 (999) 999-99-99',
            },
          },
          {
            value: model.$.phoneAdditional,
            component: InputMaskField,
            componentProps: {
              label: 'Дополнительный телефон',
              testId: 'phoneAdditional',
              mask: '+7 (999) 999-99-99',
            },
          },
          {
            value: model.$.email,
            component: InputField,
            componentProps: { label: 'Email', testId: 'email', type: 'email' },
          },
          {
            value: model.$.sameEmail,
            component: CheckboxField,
            componentProps: {
              label: 'Использовать основной email для уведомлений',
              testId: 'sameEmail',
            },
          },
          {
            value: model.$.emailAdditional,
            component: InputField,
            componentProps: {
              label: 'Дополнительный email',
              testId: 'emailAdditional',
              type: 'email',
            },
          },
        ],
      },
      {
        component: Section,
        componentProps: { title: 'Адрес регистрации', className: 'space-y-4' },
        children: [
          {
            value: model.$.registrationAddress.region,
            component: SelectField,
            componentProps: {
              label: 'Регион',
              testId: 'registrationAddress-region',
              options: REGION_OPTIONS,
            },
          },
          {
            value: model.$.registrationAddress.city,
            component: SelectField,
            componentProps: { label: 'Город', testId: 'registrationAddress-city', options: [] },
          },
          {
            value: model.$.registrationAddress.street,
            component: InputField,
            componentProps: { label: 'Улица', testId: 'registrationAddress-street' },
          },
          {
            value: model.$.registrationAddress.house,
            component: InputField,
            componentProps: { label: 'Дом', testId: 'registrationAddress-house' },
          },
          {
            value: model.$.registrationAddress.apartment,
            component: InputField,
            componentProps: { label: 'Квартира', testId: 'registrationAddress-apartment' },
          },
          {
            value: model.$.registrationAddress.postalCode,
            component: InputMaskField,
            componentProps: {
              label: 'Индекс',
              testId: 'registrationAddress-postalCode',
              mask: '999999',
            },
          },
        ],
      },
      {
        value: model.$.sameAsRegistration,
        component: CheckboxField,
        componentProps: {
          label: 'Адрес проживания совпадает с адресом регистрации',
          testId: 'sameAsRegistration',
        },
      },
      {
        selector: 'residence-section',
        component: Section,
        componentProps: { title: 'Адрес проживания', className: 'space-y-4' },
        children: [
          {
            value: model.$.residenceAddress.region,
            component: SelectField,
            componentProps: {
              label: 'Регион',
              testId: 'residenceAddress-region',
              options: REGION_OPTIONS,
            },
          },
          {
            value: model.$.residenceAddress.city,
            component: SelectField,
            componentProps: { label: 'Город', testId: 'residenceAddress-city', options: [] },
          },
          {
            value: model.$.residenceAddress.street,
            component: InputField,
            componentProps: { label: 'Улица', testId: 'residenceAddress-street' },
          },
          {
            value: model.$.residenceAddress.house,
            component: InputField,
            componentProps: { label: 'Дом', testId: 'residenceAddress-house' },
          },
          {
            value: model.$.residenceAddress.apartment,
            component: InputField,
            componentProps: { label: 'Квартира', testId: 'residenceAddress-apartment' },
          },
          {
            value: model.$.residenceAddress.postalCode,
            component: InputMaskField,
            componentProps: {
              label: 'Индекс',
              testId: 'residenceAddress-postalCode',
              mask: '999999',
            },
          },
        ],
      },
    ],
  };

  // ── Step 4 — Информация о занятости ────────────────────────────────────────
  const step4Body = {
    component: Box,
    componentProps: { className: 'space-y-4' },
    children: [
      {
        value: model.$.employmentStatus,
        component: RadioGroupField,
        componentProps: {
          label: 'Статус занятости',
          testId: 'employmentStatus',
          options: EMPLOYMENT_STATUS_OPTIONS,
        },
      },
      // employed-only
      {
        selector: 'employed-section',
        component: Section,
        componentProps: { title: 'Работа по найму', className: 'space-y-4' },
        children: [
          {
            value: model.$.companyName,
            component: InputField,
            componentProps: { label: 'Название компании', testId: 'companyName' },
          },
          {
            value: model.$.companyInn,
            component: InputMaskField,
            componentProps: { label: 'ИНН компании', testId: 'companyInn', mask: '9999999999' },
          },
          {
            value: model.$.companyPhone,
            component: InputMaskField,
            componentProps: {
              label: 'Телефон компании',
              testId: 'companyPhone',
              mask: '+7 (999) 999-99-99',
            },
          },
          {
            value: model.$.companyAddress,
            component: InputField,
            componentProps: { label: 'Адрес компании', testId: 'companyAddress' },
          },
          {
            value: model.$.position,
            component: InputField,
            componentProps: { label: 'Должность', testId: 'position' },
          },
        ],
      },
      // self-employed-only
      {
        selector: 'selfEmployed-section',
        component: Section,
        componentProps: { title: 'ИП / самозанятый', className: 'space-y-4' },
        children: [
          {
            value: model.$.businessType,
            component: InputField,
            componentProps: { label: 'Тип бизнеса', testId: 'businessType' },
          },
          {
            value: model.$.businessInn,
            component: InputMaskField,
            componentProps: { label: 'ИНН ИП', testId: 'businessInn', mask: '999999999999' },
          },
          {
            value: model.$.businessActivity,
            component: TextareaField,
            componentProps: { label: 'Вид деятельности', testId: 'businessActivity' },
          },
        ],
      },
      {
        component: Section,
        componentProps: { title: 'Стаж и доход', className: 'space-y-4' },
        children: [
          {
            value: model.$.workExperienceTotal,
            component: InputField,
            componentProps: {
              label: 'Общий стаж (мес.)',
              testId: 'workExperienceTotal',
              type: 'number',
            },
          },
          {
            value: model.$.workExperienceCurrent,
            component: InputField,
            componentProps: {
              label: 'Стаж на текущем месте (мес.)',
              testId: 'workExperienceCurrent',
              type: 'number',
            },
          },
          {
            value: model.$.monthlyIncome,
            component: InputField,
            componentProps: {
              label: 'Ежемесячный доход (₽)',
              testId: 'monthlyIncome',
              type: 'number',
            },
          },
          {
            value: model.$.additionalIncome,
            component: InputField,
            componentProps: {
              label: 'Дополнительный доход (₽)',
              testId: 'additionalIncome',
              type: 'number',
            },
          },
          {
            value: model.$.additionalIncomeSource,
            component: InputField,
            componentProps: { label: 'Источник доп. дохода', testId: 'additionalIncomeSource' },
          },
          {
            value: model.$.totalIncome,
            component: InputField,
            componentProps: {
              label: 'Общий доход (₽)',
              testId: 'totalIncome',
              type: 'number',
              ...RO,
            },
          },
        ],
      },
    ],
  };

  // ── Step 5 — Дополнительная информация ─────────────────────────────────────
  const propertyItem = (im: FormModel<PropertyItem>) => ({
    component: Box,
    componentProps: { className: 'space-y-3' },
    children: [
      {
        value: im.$.type,
        component: SelectField,
        componentProps: { label: 'Тип имущества', testId: 'type', options: PROPERTY_TYPE_OPTIONS },
      },
      {
        value: im.$.description,
        component: TextareaField,
        componentProps: { label: 'Описание', testId: 'description' },
      },
      {
        value: im.$.estimatedValue,
        component: InputField,
        componentProps: {
          label: 'Оценочная стоимость (₽)',
          testId: 'estimatedValue',
          type: 'number',
        },
      },
      {
        value: im.$.hasEncumbrance,
        component: CheckboxField,
        componentProps: { label: 'Имеется обременение (залог)', testId: 'hasEncumbrance' },
      },
    ],
  });

  const existingLoanItem = (im: FormModel<ExistingLoan>) => ({
    component: Box,
    componentProps: { className: 'space-y-3' },
    children: [
      {
        value: im.$.bank,
        component: SelectField,
        componentProps: { label: 'Банк', testId: 'bank', options: BANK_OPTIONS },
      },
      {
        value: im.$.type,
        component: InputField,
        componentProps: { label: 'Тип кредита', testId: 'type' },
      },
      {
        value: im.$.amount,
        component: InputField,
        componentProps: { label: 'Сумма кредита (₽)', testId: 'amount', type: 'number' },
      },
      {
        value: im.$.remainingAmount,
        component: InputField,
        componentProps: {
          label: 'Остаток задолженности (₽)',
          testId: 'remainingAmount',
          type: 'number',
        },
      },
      {
        value: im.$.monthlyPayment,
        component: InputField,
        componentProps: {
          label: 'Ежемесячный платёж (₽)',
          testId: 'monthlyPayment',
          type: 'number',
        },
      },
      {
        value: im.$.maturityDate,
        component: InputField,
        componentProps: { label: 'Дата погашения', testId: 'maturityDate', type: 'date' },
      },
    ],
  });

  const coBorrowerItem = (im: FormModel<CoBorrower>) => ({
    component: Box,
    componentProps: { className: 'space-y-3' },
    children: [
      {
        value: im.$.personalData.lastName,
        component: InputField,
        componentProps: { label: 'Фамилия', testId: 'personalData-lastName' },
      },
      {
        value: im.$.personalData.firstName,
        component: InputField,
        componentProps: { label: 'Имя', testId: 'personalData-firstName' },
      },
      {
        value: im.$.phone,
        component: InputMaskField,
        componentProps: { label: 'Телефон', testId: 'phone', mask: '+7 (999) 999-99-99' },
      },
      {
        value: im.$.email,
        component: InputField,
        componentProps: { label: 'Email', testId: 'email', type: 'email' },
      },
      {
        value: im.$.relationship,
        component: InputField,
        componentProps: { label: 'Родство', testId: 'relationship' },
      },
      {
        value: im.$.monthlyIncome,
        component: InputField,
        componentProps: { label: 'Ежемесячный доход (₽)', testId: 'monthlyIncome', type: 'number' },
      },
    ],
  });

  const step5Body = {
    component: Box,
    componentProps: { className: 'space-y-4' },
    children: [
      {
        component: Section,
        componentProps: { title: 'Личное', className: 'space-y-4' },
        children: [
          {
            value: model.$.maritalStatus,
            component: RadioGroupField,
            componentProps: {
              label: 'Семейное положение',
              testId: 'maritalStatus',
              options: MARITAL_STATUS_OPTIONS,
            },
          },
          {
            value: model.$.dependents,
            component: InputField,
            componentProps: {
              label: 'Количество иждивенцев',
              testId: 'dependents',
              type: 'number',
            },
          },
          {
            value: model.$.education,
            component: SelectField,
            componentProps: {
              label: 'Образование',
              testId: 'education',
              options: EDUCATION_OPTIONS,
            },
          },
        ],
      },
      // Имущество
      {
        value: model.$.hasProperty,
        component: CheckboxField,
        componentProps: { label: 'У меня есть имущество', testId: 'hasProperty' },
      },
      {
        selector: 'properties-section',
        array: model.properties,
        initialValue: createBlankProperty,
        item: propertyItem,
        componentProps: {
          title: 'Имущество',
          itemLabel: 'Имущество',
          addButtonLabel: '+ Добавить имущество',
          emptyMessage: 'Нажмите «Добавить имущество»',
          reorderable: true,
        },
      },
      // Кредиты
      {
        value: model.$.hasExistingLoans,
        component: CheckboxField,
        componentProps: { label: 'У меня есть другие кредиты', testId: 'hasExistingLoans' },
      },
      {
        selector: 'existingLoans-section',
        array: model.existingLoans,
        initialValue: createBlankExistingLoan,
        item: existingLoanItem,
        componentProps: {
          title: 'Существующие кредиты',
          itemLabel: 'Кредит',
          addButtonLabel: '+ Добавить кредит',
          emptyMessage: 'Нажмите «Добавить кредит»',
        },
      },
      // Созаемщики
      {
        value: model.$.hasCoBorrower,
        component: CheckboxField,
        componentProps: { label: 'Добавить созаемщика', testId: 'hasCoBorrower' },
      },
      {
        selector: 'coBorrowers-section',
        array: model.coBorrowers,
        initialValue: createBlankCoBorrower,
        item: coBorrowerItem,
        componentProps: {
          title: 'Созаемщики',
          itemLabel: 'Созаемщик',
          addButtonLabel: '+ Добавить созаемщика',
          emptyMessage: 'Нажмите «Добавить созаемщика»',
          reorderable: true,
        },
      },
      {
        component: Section,
        componentProps: { title: 'Итоги', className: 'space-y-4' },
        children: [
          {
            value: model.$.coBorrowersIncome,
            component: InputField,
            componentProps: {
              label: 'Доход созаемщиков (₽)',
              testId: 'coBorrowersIncome',
              type: 'number',
              ...RO,
            },
          },
          {
            value: model.$.paymentToIncomeRatio,
            component: InputField,
            componentProps: {
              label: 'Платёж от дохода (%)',
              testId: 'paymentToIncomeRatio',
              type: 'number',
              ...RO,
            },
          },
        ],
      },
    ],
  };

  // ── Step 6 — Подтверждение и согласия ──────────────────────────────────────
  const step6Body = {
    component: Box,
    componentProps: { className: 'space-y-4' },
    children: [
      {
        component: Section,
        componentProps: { title: 'Согласия', className: 'space-y-4' },
        children: [
          {
            value: model.$.agreePersonalData,
            component: CheckboxField,
            componentProps: {
              label: 'Согласие на обработку персональных данных',
              testId: 'agreePersonalData',
            },
          },
          {
            value: model.$.agreeCreditHistory,
            component: CheckboxField,
            componentProps: {
              label: 'Согласие на проверку кредитной истории',
              testId: 'agreeCreditHistory',
            },
          },
          {
            value: model.$.agreeMarketing,
            component: CheckboxField,
            componentProps: {
              label: 'Согласие на получение маркетинговых материалов',
              testId: 'agreeMarketing',
            },
          },
          {
            value: model.$.agreeTerms,
            component: CheckboxField,
            componentProps: { label: 'Согласие с условиями кредитования', testId: 'agreeTerms' },
          },
        ],
      },
      {
        component: Section,
        componentProps: { title: 'Подтверждение', className: 'space-y-4' },
        children: [
          {
            value: model.$.confirmAccuracy,
            component: CheckboxField,
            componentProps: {
              label: 'Подтверждаю точность введённых данных',
              testId: 'confirmAccuracy',
            },
          },
          {
            value: model.$.electronicSignature,
            component: InputMaskField,
            componentProps: {
              label: 'Код подтверждения из СМС',
              testId: 'electronicSignature',
              mask: '999999',
            },
          },
        ],
      },
    ],
  };

  const tree = {
    selector: 'wizard',
    component: FormWizard,
    componentProps: {
      ...(form ? { form } : {}),
      config: makeCreditValidationConfig(model),
      steps: [
        { number: 1, title: 'Кредит', icon: '💰', body: step1Body },
        { number: 2, title: 'Личные данные', icon: '👤', body: step2Body },
        { number: 3, title: 'Контакты', icon: '📞', body: step3Body },
        { number: 4, title: 'Работа', icon: '💼', body: step4Body },
        { number: 5, title: 'Дополнительно', icon: '📋', body: step5Body },
        { number: 6, title: 'Подтверждение', icon: '✅', body: step6Body },
      ],
    },
  };

  return tree as unknown as RenderNode<CreditApplicationForm>;
}
