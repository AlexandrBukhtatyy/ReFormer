// renderer.schema.tsx — схема формы: одно дерево узлов, без валидаторов (они в validation.ts).
// Узел привязан к модели ключом `model` (model: model.$.x). Корень — библиотечный FormWizard,
// шаги — его дети; `selector` шага — ключ его правил в `creditValidation.steps`. Форму и валидацию
// визард берёт из сборки сам. Условные секции несут `selector` — их прячут правила поведения.

import type { FormModel, FormSchemaNode } from '@reformer/core';
import { Step } from '@reformer/cdk/form-wizard';
import {
  Box,
  CheckboxWithLabel,
  FormArray,
  Input,
  InputMask,
  RadioGroupOptions,
  Section,
  SelectAsync,
  Textarea,
  FormWizard,
  InputNumber,
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

const RO = { disabled: true }; // readonly (computed) fields

export function buildCreditApplicationSchema(
  model: FormModel<CreditApplicationForm>
): FormSchemaNode {
  // ── Step 1 — Основная информация о кредите ─────────────────────────────────
  const step1Body = {
    component: Box,
    componentProps: { className: 'space-y-4' },
    children: [
      {
        model: model.$.loanType,
        component: SelectAsync,
        componentProps: { label: 'Тип кредита', testId: 'loanType', options: LOAN_TYPE_OPTIONS },
      },
      {
        model: model.$.loanAmount,
        component: InputNumber,
        componentProps: {
          label: 'Сумма кредита (₽)',
          testId: 'loanAmount',

          step: 10000,
        },
      },
      {
        model: model.$.loanTerm,
        component: InputNumber,
        componentProps: { label: 'Срок кредита (мес.)', testId: 'loanTerm' },
      },
      {
        model: model.$.loanPurpose,
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
            model: model.$.propertyValue,
            component: InputNumber,
            componentProps: {
              label: 'Стоимость недвижимости (₽)',
              testId: 'propertyValue',
            },
          },
          {
            model: model.$.initialPayment,
            component: InputNumber,
            componentProps: {
              label: 'Первоначальный взнос (₽)',
              testId: 'initialPayment',

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
            model: model.$.carBrand,
            component: Input,
            componentProps: { label: 'Марка автомобиля', testId: 'carBrand' },
          },
          {
            model: model.$.carModel,
            component: SelectAsync,
            componentProps: { label: 'Модель автомобиля', testId: 'carModel', options: [] },
          },
          {
            model: model.$.carYear,
            component: InputNumber,
            componentProps: { label: 'Год выпуска', testId: 'carYear' },
          },
          {
            model: model.$.carPrice,
            component: InputNumber,
            componentProps: {
              label: 'Стоимость автомобиля (₽)',
              testId: 'carPrice',
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
            model: model.$.interestRate,
            component: InputNumber,
            componentProps: {
              label: 'Процентная ставка (%)',
              testId: 'interestRate',

              ...RO,
            },
          },
          {
            model: model.$.monthlyPayment,
            component: InputNumber,
            componentProps: {
              label: 'Ежемесячный платёж (₽)',
              testId: 'monthlyPayment',

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
            model: model.$.personalData.lastName,
            component: Input,
            componentProps: { label: 'Фамилия', testId: 'personalData-lastName' },
          },
          {
            model: model.$.personalData.firstName,
            component: Input,
            componentProps: { label: 'Имя', testId: 'personalData-firstName' },
          },
          {
            model: model.$.personalData.middleName,
            component: Input,
            componentProps: { label: 'Отчество', testId: 'personalData-middleName' },
          },
          {
            model: model.$.personalData.birthDate,
            component: Input,
            componentProps: {
              label: 'Дата рождения',
              testId: 'personalData-birthDate',
              type: 'date',
            },
          },
          {
            model: model.$.personalData.gender,
            component: RadioGroupOptions,
            componentProps: {
              label: 'Пол',
              testId: 'personalData-gender',
              options: GENDER_OPTIONS,
            },
          },
          {
            model: model.$.personalData.birthPlace,
            component: Input,
            componentProps: { label: 'Место рождения', testId: 'personalData-birthPlace' },
          },
          {
            model: model.$.fullName,
            component: Input,
            componentProps: { label: 'Полное имя', testId: 'fullName', ...RO },
          },
          {
            model: model.$.age,
            component: InputNumber,
            componentProps: { label: 'Возраст (лет)', testId: 'age', ...RO },
          },
        ],
      },
      {
        component: Section,
        componentProps: { title: 'Паспортные данные', className: 'space-y-4' },
        children: [
          {
            model: model.$.passportData.series,
            component: InputMask,
            componentProps: {
              label: 'Серия паспорта',
              testId: 'passportData-series',
              mask: '99 99',
            },
          },
          {
            model: model.$.passportData.number,
            component: InputMask,
            componentProps: {
              label: 'Номер паспорта',
              testId: 'passportData-number',
              mask: '999999',
            },
          },
          {
            model: model.$.passportData.issueDate,
            component: Input,
            componentProps: {
              label: 'Дата выдачи',
              testId: 'passportData-issueDate',
              type: 'date',
            },
          },
          {
            model: model.$.passportData.issuedBy,
            component: Input,
            componentProps: { label: 'Кем выдан', testId: 'passportData-issuedBy' },
          },
          {
            model: model.$.passportData.departmentCode,
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
            model: model.$.inn,
            component: InputMask,
            componentProps: { label: 'ИНН', testId: 'inn', mask: '999999999999' },
          },
          {
            model: model.$.snils,
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
            model: model.$.phoneMain,
            component: InputMask,
            componentProps: {
              label: 'Основной телефон',
              testId: 'phoneMain',
              mask: '+7 (999) 999-99-99',
            },
          },
          {
            model: model.$.phoneAdditional,
            component: InputMask,
            componentProps: {
              label: 'Дополнительный телефон',
              testId: 'phoneAdditional',
              mask: '+7 (999) 999-99-99',
            },
          },
          {
            model: model.$.email,
            component: Input,
            componentProps: { label: 'Email', testId: 'email', type: 'email' },
          },
          {
            model: model.$.sameEmail,
            component: CheckboxWithLabel,
            componentProps: {
              label: 'Использовать основной email для уведомлений',
              testId: 'sameEmail',
            },
          },
          {
            model: model.$.emailAdditional,
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
            model: model.$.registrationAddress.region,
            component: SelectAsync,
            componentProps: {
              label: 'Регион',
              testId: 'registrationAddress-region',
              options: REGION_OPTIONS,
            },
          },
          {
            model: model.$.registrationAddress.city,
            component: SelectAsync,
            componentProps: { label: 'Город', testId: 'registrationAddress-city', options: [] },
          },
          {
            model: model.$.registrationAddress.street,
            component: Input,
            componentProps: { label: 'Улица', testId: 'registrationAddress-street' },
          },
          {
            model: model.$.registrationAddress.house,
            component: Input,
            componentProps: { label: 'Дом', testId: 'registrationAddress-house' },
          },
          {
            model: model.$.registrationAddress.apartment,
            component: Input,
            componentProps: { label: 'Квартира', testId: 'registrationAddress-apartment' },
          },
          {
            model: model.$.registrationAddress.postalCode,
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
        model: model.$.sameAsRegistration,
        component: CheckboxWithLabel,
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
            model: model.$.residenceAddress.region,
            component: SelectAsync,
            componentProps: {
              label: 'Регион',
              testId: 'residenceAddress-region',
              options: REGION_OPTIONS,
            },
          },
          {
            model: model.$.residenceAddress.city,
            component: SelectAsync,
            componentProps: { label: 'Город', testId: 'residenceAddress-city', options: [] },
          },
          {
            model: model.$.residenceAddress.street,
            component: Input,
            componentProps: { label: 'Улица', testId: 'residenceAddress-street' },
          },
          {
            model: model.$.residenceAddress.house,
            component: Input,
            componentProps: { label: 'Дом', testId: 'residenceAddress-house' },
          },
          {
            model: model.$.residenceAddress.apartment,
            component: Input,
            componentProps: { label: 'Квартира', testId: 'residenceAddress-apartment' },
          },
          {
            model: model.$.residenceAddress.postalCode,
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
        model: model.$.employmentStatus,
        component: RadioGroupOptions,
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
            model: model.$.companyName,
            component: Input,
            componentProps: { label: 'Название компании', testId: 'companyName' },
          },
          {
            model: model.$.companyInn,
            component: InputMask,
            componentProps: { label: 'ИНН компании', testId: 'companyInn', mask: '9999999999' },
          },
          {
            model: model.$.companyPhone,
            component: InputMask,
            componentProps: {
              label: 'Телефон компании',
              testId: 'companyPhone',
              mask: '+7 (999) 999-99-99',
            },
          },
          {
            model: model.$.companyAddress,
            component: Input,
            componentProps: { label: 'Адрес компании', testId: 'companyAddress' },
          },
          {
            model: model.$.position,
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
            model: model.$.businessType,
            component: Input,
            componentProps: { label: 'Тип бизнеса', testId: 'businessType' },
          },
          {
            model: model.$.businessInn,
            component: InputMask,
            componentProps: { label: 'ИНН ИП', testId: 'businessInn', mask: '999999999999' },
          },
          {
            model: model.$.businessActivity,
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
            model: model.$.workExperienceTotal,
            component: InputNumber,
            componentProps: {
              label: 'Общий стаж (мес.)',
              testId: 'workExperienceTotal',
            },
          },
          {
            model: model.$.workExperienceCurrent,
            component: InputNumber,
            componentProps: {
              label: 'Стаж на текущем месте (мес.)',
              testId: 'workExperienceCurrent',
            },
          },
          {
            model: model.$.monthlyIncome,
            component: InputNumber,
            componentProps: {
              label: 'Ежемесячный доход (₽)',
              testId: 'monthlyIncome',
            },
          },
          {
            model: model.$.additionalIncome,
            component: InputNumber,
            componentProps: {
              label: 'Дополнительный доход (₽)',
              testId: 'additionalIncome',
            },
          },
          {
            model: model.$.additionalIncomeSource,
            component: Input,
            componentProps: { label: 'Источник доп. дохода', testId: 'additionalIncomeSource' },
          },
          {
            model: model.$.totalIncome,
            component: InputNumber,
            componentProps: {
              label: 'Общий доход (₽)',
              testId: 'totalIncome',

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
        model: im.$.type,
        component: SelectAsync,
        componentProps: { label: 'Тип имущества', testId: 'type', options: PROPERTY_TYPE_OPTIONS },
      },
      {
        model: im.$.description,
        component: Textarea,
        componentProps: { label: 'Описание', testId: 'description' },
      },
      {
        model: im.$.estimatedValue,
        component: InputNumber,
        componentProps: {
          label: 'Оценочная стоимость (₽)',
          testId: 'estimatedValue',
        },
      },
      {
        model: im.$.hasEncumbrance,
        component: CheckboxWithLabel,
        componentProps: { label: 'Имеется обременение (залог)', testId: 'hasEncumbrance' },
      },
    ],
  });

  const existingLoanItem = (im: FormModel<ExistingLoan>) => ({
    component: Box,
    componentProps: { className: 'space-y-3' },
    children: [
      {
        model: im.$.bank,
        component: SelectAsync,
        componentProps: { label: 'Банк', testId: 'bank', options: BANK_OPTIONS },
      },
      {
        model: im.$.type,
        component: Input,
        componentProps: { label: 'Тип кредита', testId: 'type' },
      },
      {
        model: im.$.amount,
        component: InputNumber,
        componentProps: { label: 'Сумма кредита (₽)', testId: 'amount' },
      },
      {
        model: im.$.remainingAmount,
        component: InputNumber,
        componentProps: {
          label: 'Остаток задолженности (₽)',
          testId: 'remainingAmount',
        },
      },
      {
        model: im.$.monthlyPayment,
        component: InputNumber,
        componentProps: {
          label: 'Ежемесячный платёж (₽)',
          testId: 'monthlyPayment',
        },
      },
      {
        model: im.$.maturityDate,
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
        model: im.$.personalData.lastName,
        component: Input,
        componentProps: { label: 'Фамилия', testId: 'personalData-lastName' },
      },
      {
        model: im.$.personalData.firstName,
        component: Input,
        componentProps: { label: 'Имя', testId: 'personalData-firstName' },
      },
      {
        model: im.$.phone,
        component: InputMask,
        componentProps: { label: 'Телефон', testId: 'phone', mask: '+7 (999) 999-99-99' },
      },
      {
        model: im.$.email,
        component: Input,
        componentProps: { label: 'Email', testId: 'email', type: 'email' },
      },
      {
        model: im.$.relationship,
        component: Input,
        componentProps: { label: 'Родство', testId: 'relationship' },
      },
      {
        model: im.$.monthlyIncome,
        component: InputNumber,
        componentProps: { label: 'Ежемесячный доход (₽)', testId: 'monthlyIncome' },
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
            model: model.$.maritalStatus,
            component: RadioGroupOptions,
            componentProps: {
              label: 'Семейное положение',
              testId: 'maritalStatus',
              options: MARITAL_STATUS_OPTIONS,
            },
          },
          {
            model: model.$.dependents,
            component: InputNumber,
            componentProps: {
              label: 'Количество иждивенцев',
              testId: 'dependents',
            },
          },
          {
            model: model.$.education,
            component: SelectAsync,
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
        model: model.$.hasProperty,
        component: CheckboxWithLabel,
        componentProps: { label: 'У меня есть имущество', testId: 'hasProperty' },
      },
      {
        selector: 'properties-section',
        model: model.$.properties,
        component: FormArray,
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
        model: model.$.hasExistingLoans,
        component: CheckboxWithLabel,
        componentProps: { label: 'У меня есть другие кредиты', testId: 'hasExistingLoans' },
      },
      {
        selector: 'existingLoans-section',
        model: model.$.existingLoans,
        component: FormArray,
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
        model: model.$.hasCoBorrower,
        component: CheckboxWithLabel,
        componentProps: { label: 'Добавить созаемщика', testId: 'hasCoBorrower' },
      },
      {
        selector: 'coBorrowers-section',
        model: model.$.coBorrowers,
        component: FormArray,
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
            model: model.$.coBorrowersIncome,
            component: InputNumber,
            componentProps: {
              label: 'Доход созаемщиков (₽)',
              testId: 'coBorrowersIncome',

              ...RO,
            },
          },
          {
            model: model.$.paymentToIncomeRatio,
            component: InputNumber,
            componentProps: {
              label: 'Платёж от дохода (%)',
              testId: 'paymentToIncomeRatio',

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
            model: model.$.agreePersonalData,
            component: CheckboxWithLabel,
            componentProps: {
              label: 'Согласие на обработку персональных данных',
              testId: 'agreePersonalData',
            },
          },
          {
            model: model.$.agreeCreditHistory,
            component: CheckboxWithLabel,
            componentProps: {
              label: 'Согласие на проверку кредитной истории',
              testId: 'agreeCreditHistory',
            },
          },
          {
            model: model.$.agreeMarketing,
            component: CheckboxWithLabel,
            componentProps: {
              label: 'Согласие на получение маркетинговых материалов',
              testId: 'agreeMarketing',
            },
          },
          {
            model: model.$.agreeTerms,
            component: CheckboxWithLabel,
            componentProps: { label: 'Согласие с условиями кредитования', testId: 'agreeTerms' },
          },
        ],
      },
      {
        component: Section,
        componentProps: { title: 'Подтверждение', className: 'space-y-4' },
        children: [
          {
            model: model.$.confirmAccuracy,
            component: CheckboxWithLabel,
            componentProps: {
              label: 'Подтверждаю точность введённых данных',
              testId: 'confirmAccuracy',
            },
          },
          {
            model: model.$.electronicSignature,
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

  /** Узел шага: `selector` — ключ правил шага, `title` и `icon` читает индикатор визарда. */
  const step = (selector: string, title: string, icon: string, body: object) => ({
    selector,
    component: Step,
    componentProps: { title, icon },
    children: [body],
  });

  const tree = {
    selector: 'wizard',
    component: FormWizard,
    children: [
      step('step1', 'Кредит', '💰', step1Body),
      step('step2', 'Личные данные', '👤', step2Body),
      step('step3', 'Контакты', '📞', step3Body),
      step('step4', 'Работа', '💼', step4Body),
      step('step5', 'Дополнительно', '📋', step5Body),
      step('step6', 'Подтверждение', '✅', step6Body),
    ],
  };

  return tree as unknown as FormSchemaNode;
}
