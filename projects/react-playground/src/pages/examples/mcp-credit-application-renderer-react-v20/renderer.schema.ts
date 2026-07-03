// renderer.schema.ts — the RenderNode tree (M1). Layout only, NO validators (those live in
// validation.ts). Leaves carry model signals (value: model.$.x). FormWizard is the root node;
// all 6 steps + 3 FormArray sections are inline. Validation config injected inline into the wizard node.
// Conditional sections carry a `selector` so renderer.behavior can hideWhen them.

import type { FormModel, FormProxy } from '@reformer/core';
import type { RenderNode } from '@reformer/renderer-react';
import { FormWizard } from '@reformer/ui-kit/form-wizard';
import {
  Box,
  Checkbox,
  Input,
  InputMask,
  RadioGroup,
  Section,
  Select,
  Textarea,
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
  const m = model.$;

  // ── Step 1 — Основная информация о кредите ─────────────────────────────────
  const step1Body = {
    component: Box,
    componentProps: { className: 'space-y-4' },
    children: [
      {
        value: m.loanType,
        component: Select,
        componentProps: { label: 'Тип кредита', testId: 'loanType', options: LOAN_TYPE_OPTIONS },
      },
      {
        value: m.loanAmount,
        component: Input,
        componentProps: {
          label: 'Сумма кредита (₽)',
          testId: 'loanAmount',
          type: 'number',
          step: 10000,
        },
      },
      {
        value: m.loanTerm,
        component: Input,
        componentProps: { label: 'Срок кредита (мес.)', testId: 'loanTerm', type: 'number' },
      },
      {
        value: m.loanPurpose,
        component: Textarea,
        componentProps: { label: 'Цель кредита', testId: 'loanPurpose', maxLength: 500 },
      },
      // mortgage-only
      {
        selector: 'mortgage-section',
        component: Section,
        componentProps: { title: 'Ипотека', className: 'space-y-4' },
        children: [
          {
            value: m.propertyValue,
            component: Input,
            componentProps: {
              label: 'Стоимость недвижимости (₽)',
              testId: 'propertyValue',
              type: 'number',
            },
          },
          {
            value: m.initialPayment,
            component: Input,
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
            value: m.carBrand,
            component: Input,
            componentProps: { label: 'Марка автомобиля', testId: 'carBrand' },
          },
          {
            value: m.carModel,
            component: Select,
            componentProps: { label: 'Модель автомобиля', testId: 'carModel', options: [] },
          },
          {
            value: m.carYear,
            component: Input,
            componentProps: { label: 'Год выпуска', testId: 'carYear', type: 'number' },
          },
          {
            value: m.carPrice,
            component: Input,
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
            value: m.interestRate,
            component: Input,
            componentProps: {
              label: 'Процентная ставка (%)',
              testId: 'interestRate',
              type: 'number',
              ...RO,
            },
          },
          {
            value: m.monthlyPayment,
            component: Input,
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
            value: m.personalData.lastName,
            component: Input,
            componentProps: { label: 'Фамилия', testId: 'personalData-lastName' },
          },
          {
            value: m.personalData.firstName,
            component: Input,
            componentProps: { label: 'Имя', testId: 'personalData-firstName' },
          },
          {
            value: m.personalData.middleName,
            component: Input,
            componentProps: { label: 'Отчество', testId: 'personalData-middleName' },
          },
          {
            value: m.personalData.birthDate,
            component: Input,
            componentProps: {
              label: 'Дата рождения',
              testId: 'personalData-birthDate',
              type: 'date',
            },
          },
          {
            value: m.personalData.gender,
            component: RadioGroup,
            componentProps: {
              label: 'Пол',
              testId: 'personalData-gender',
              options: GENDER_OPTIONS,
            },
          },
          {
            value: m.personalData.birthPlace,
            component: Input,
            componentProps: { label: 'Место рождения', testId: 'personalData-birthPlace' },
          },
          {
            value: m.fullName,
            component: Input,
            componentProps: { label: 'Полное имя', testId: 'fullName', ...RO },
          },
          {
            value: m.age,
            component: Input,
            componentProps: { label: 'Возраст (лет)', testId: 'age', type: 'number', ...RO },
          },
        ],
      },
      {
        component: Section,
        componentProps: { title: 'Паспортные данные', className: 'space-y-4' },
        children: [
          {
            value: m.passportData.series,
            component: InputMask,
            componentProps: {
              label: 'Серия паспорта',
              testId: 'passportData-series',
              mask: '99 99',
            },
          },
          {
            value: m.passportData.number,
            component: InputMask,
            componentProps: {
              label: 'Номер паспорта',
              testId: 'passportData-number',
              mask: '999999',
            },
          },
          {
            value: m.passportData.issueDate,
            component: Input,
            componentProps: {
              label: 'Дата выдачи',
              testId: 'passportData-issueDate',
              type: 'date',
            },
          },
          {
            value: m.passportData.issuedBy,
            component: Input,
            componentProps: { label: 'Кем выдан', testId: 'passportData-issuedBy' },
          },
          {
            value: m.passportData.departmentCode,
            component: InputMask,
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
            value: m.inn,
            component: InputMask,
            componentProps: { label: 'ИНН', testId: 'inn', mask: '999999999999' },
          },
          {
            value: m.snils,
            component: InputMask,
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
            value: m.phoneMain,
            component: InputMask,
            componentProps: {
              label: 'Основной телефон',
              testId: 'phoneMain',
              mask: '+7 (999) 999-99-99',
            },
          },
          {
            value: m.phoneAdditional,
            component: InputMask,
            componentProps: {
              label: 'Дополнительный телефон',
              testId: 'phoneAdditional',
              mask: '+7 (999) 999-99-99',
            },
          },
          {
            value: m.email,
            component: Input,
            componentProps: { label: 'Email', testId: 'email', type: 'email' },
          },
          {
            value: m.sameEmail,
            component: Checkbox,
            componentProps: {
              label: 'Использовать основной email для уведомлений',
              testId: 'sameEmail',
            },
          },
          {
            value: m.emailAdditional,
            component: Input,
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
            value: m.registrationAddress.region,
            component: Select,
            componentProps: {
              label: 'Регион',
              testId: 'registrationAddress-region',
              options: REGION_OPTIONS,
            },
          },
          {
            value: m.registrationAddress.city,
            component: Select,
            componentProps: { label: 'Город', testId: 'registrationAddress-city', options: [] },
          },
          {
            value: m.registrationAddress.street,
            component: Input,
            componentProps: { label: 'Улица', testId: 'registrationAddress-street' },
          },
          {
            value: m.registrationAddress.house,
            component: Input,
            componentProps: { label: 'Дом', testId: 'registrationAddress-house' },
          },
          {
            value: m.registrationAddress.apartment,
            component: Input,
            componentProps: { label: 'Квартира', testId: 'registrationAddress-apartment' },
          },
          {
            value: m.registrationAddress.postalCode,
            component: InputMask,
            componentProps: {
              label: 'Индекс',
              testId: 'registrationAddress-postalCode',
              mask: '999999',
            },
          },
        ],
      },
      {
        value: m.sameAsRegistration,
        component: Checkbox,
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
            value: m.residenceAddress.region,
            component: Select,
            componentProps: {
              label: 'Регион',
              testId: 'residenceAddress-region',
              options: REGION_OPTIONS,
            },
          },
          {
            value: m.residenceAddress.city,
            component: Select,
            componentProps: { label: 'Город', testId: 'residenceAddress-city', options: [] },
          },
          {
            value: m.residenceAddress.street,
            component: Input,
            componentProps: { label: 'Улица', testId: 'residenceAddress-street' },
          },
          {
            value: m.residenceAddress.house,
            component: Input,
            componentProps: { label: 'Дом', testId: 'residenceAddress-house' },
          },
          {
            value: m.residenceAddress.apartment,
            component: Input,
            componentProps: { label: 'Квартира', testId: 'residenceAddress-apartment' },
          },
          {
            value: m.residenceAddress.postalCode,
            component: InputMask,
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
        value: m.employmentStatus,
        component: RadioGroup,
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
            value: m.companyName,
            component: Input,
            componentProps: { label: 'Название компании', testId: 'companyName' },
          },
          {
            value: m.companyInn,
            component: InputMask,
            componentProps: { label: 'ИНН компании', testId: 'companyInn', mask: '9999999999' },
          },
          {
            value: m.companyPhone,
            component: InputMask,
            componentProps: {
              label: 'Телефон компании',
              testId: 'companyPhone',
              mask: '+7 (999) 999-99-99',
            },
          },
          {
            value: m.companyAddress,
            component: Input,
            componentProps: { label: 'Адрес компании', testId: 'companyAddress' },
          },
          {
            value: m.position,
            component: Input,
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
            value: m.businessType,
            component: Input,
            componentProps: { label: 'Тип бизнеса', testId: 'businessType' },
          },
          {
            value: m.businessInn,
            component: InputMask,
            componentProps: { label: 'ИНН ИП', testId: 'businessInn', mask: '999999999999' },
          },
          {
            value: m.businessActivity,
            component: Textarea,
            componentProps: { label: 'Вид деятельности', testId: 'businessActivity' },
          },
        ],
      },
      {
        component: Section,
        componentProps: { title: 'Стаж и доход', className: 'space-y-4' },
        children: [
          {
            value: m.workExperienceTotal,
            component: Input,
            componentProps: {
              label: 'Общий стаж (мес.)',
              testId: 'workExperienceTotal',
              type: 'number',
            },
          },
          {
            value: m.workExperienceCurrent,
            component: Input,
            componentProps: {
              label: 'Стаж на текущем месте (мес.)',
              testId: 'workExperienceCurrent',
              type: 'number',
            },
          },
          {
            value: m.monthlyIncome,
            component: Input,
            componentProps: {
              label: 'Ежемесячный доход (₽)',
              testId: 'monthlyIncome',
              type: 'number',
            },
          },
          {
            value: m.additionalIncome,
            component: Input,
            componentProps: {
              label: 'Дополнительный доход (₽)',
              testId: 'additionalIncome',
              type: 'number',
            },
          },
          {
            value: m.additionalIncomeSource,
            component: Input,
            componentProps: { label: 'Источник доп. дохода', testId: 'additionalIncomeSource' },
          },
          {
            value: m.totalIncome,
            component: Input,
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
        component: Select,
        componentProps: { label: 'Тип имущества', testId: 'type', options: PROPERTY_TYPE_OPTIONS },
      },
      {
        value: im.$.description,
        component: Textarea,
        componentProps: { label: 'Описание', testId: 'description' },
      },
      {
        value: im.$.estimatedValue,
        component: Input,
        componentProps: {
          label: 'Оценочная стоимость (₽)',
          testId: 'estimatedValue',
          type: 'number',
        },
      },
      {
        value: im.$.hasEncumbrance,
        component: Checkbox,
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
        component: Select,
        componentProps: { label: 'Банк', testId: 'bank', options: BANK_OPTIONS },
      },
      {
        value: im.$.type,
        component: Input,
        componentProps: { label: 'Тип кредита', testId: 'type' },
      },
      {
        value: im.$.amount,
        component: Input,
        componentProps: { label: 'Сумма кредита (₽)', testId: 'amount', type: 'number' },
      },
      {
        value: im.$.remainingAmount,
        component: Input,
        componentProps: {
          label: 'Остаток задолженности (₽)',
          testId: 'remainingAmount',
          type: 'number',
        },
      },
      {
        value: im.$.monthlyPayment,
        component: Input,
        componentProps: {
          label: 'Ежемесячный платёж (₽)',
          testId: 'monthlyPayment',
          type: 'number',
        },
      },
      {
        value: im.$.maturityDate,
        component: Input,
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
        component: Input,
        componentProps: { label: 'Фамилия', testId: 'personalData-lastName' },
      },
      {
        value: im.$.personalData.firstName,
        component: Input,
        componentProps: { label: 'Имя', testId: 'personalData-firstName' },
      },
      {
        value: im.$.phone,
        component: InputMask,
        componentProps: { label: 'Телефон', testId: 'phone', mask: '+7 (999) 999-99-99' },
      },
      {
        value: im.$.email,
        component: Input,
        componentProps: { label: 'Email', testId: 'email', type: 'email' },
      },
      {
        value: im.$.relationship,
        component: Input,
        componentProps: { label: 'Родство', testId: 'relationship' },
      },
      {
        value: im.$.monthlyIncome,
        component: Input,
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
            value: m.maritalStatus,
            component: RadioGroup,
            componentProps: {
              label: 'Семейное положение',
              testId: 'maritalStatus',
              options: MARITAL_STATUS_OPTIONS,
            },
          },
          {
            value: m.dependents,
            component: Input,
            componentProps: {
              label: 'Количество иждивенцев',
              testId: 'dependents',
              type: 'number',
            },
          },
          {
            value: m.education,
            component: Select,
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
        value: m.hasProperty,
        component: Checkbox,
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
        value: m.hasExistingLoans,
        component: Checkbox,
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
        value: m.hasCoBorrower,
        component: Checkbox,
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
            value: m.coBorrowersIncome,
            component: Input,
            componentProps: {
              label: 'Доход созаемщиков (₽)',
              testId: 'coBorrowersIncome',
              type: 'number',
              ...RO,
            },
          },
          {
            value: m.paymentToIncomeRatio,
            component: Input,
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
            value: m.agreePersonalData,
            component: Checkbox,
            componentProps: {
              label: 'Согласие на обработку персональных данных',
              testId: 'agreePersonalData',
            },
          },
          {
            value: m.agreeCreditHistory,
            component: Checkbox,
            componentProps: {
              label: 'Согласие на проверку кредитной истории',
              testId: 'agreeCreditHistory',
            },
          },
          {
            value: m.agreeMarketing,
            component: Checkbox,
            componentProps: {
              label: 'Согласие на получение маркетинговых материалов',
              testId: 'agreeMarketing',
            },
          },
          {
            value: m.agreeTerms,
            component: Checkbox,
            componentProps: { label: 'Согласие с условиями кредитования', testId: 'agreeTerms' },
          },
        ],
      },
      {
        component: Section,
        componentProps: { title: 'Подтверждение', className: 'space-y-4' },
        children: [
          {
            value: m.confirmAccuracy,
            component: Checkbox,
            componentProps: {
              label: 'Подтверждаю точность введённых данных',
              testId: 'confirmAccuracy',
            },
          },
          {
            value: m.electronicSignature,
            component: InputMask,
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
