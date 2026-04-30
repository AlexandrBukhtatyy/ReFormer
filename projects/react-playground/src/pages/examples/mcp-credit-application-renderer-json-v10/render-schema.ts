// =============================================================================
// render-schema.ts — JSON schema for renderer-json (iter-10, target=renderer-json)
// =============================================================================
//
// Patches encoded:
//   K — leaf fields use `model` (real field-path), NOT `selector`. testIds stay
//       in `componentProps.testId` (dotted-path).
//   B3 — each step container has `selector: 'stepN'` for setHidden orchestration
//       in index.tsx. FormRoot is the registry-bound root and receives `form`
//       via RenderSchemaFn-wrapper.
//   $template — array sections use inline templates so converter wraps them
//       into FC for FormArraySection.itemComponent.
//
// Constants (LOAN_TYPE_OPTIONS, etc.) live as registry sources — JSON refers
// to them by string name. componentProps that the leaf reads (label, type,
// rows, mask, etc.) are duplicated here so the JSON is self-describing, but
// the runtime source-of-truth is the schema.ts createForm componentProps —
// these are documentation.
// =============================================================================

import type { JsonFormSchema, JsonNode } from '@reformer/renderer-json';

// -----------------------------------------------------------------------------
// Helper for building a field node — keeps boilerplate compact.
// -----------------------------------------------------------------------------

// `testId` is bare (no `input-` prefix); renderer-react auto-prefixes `input-`
// when emitting `data-testid` on the leaf component.
const f = (
  model: string,
  component: string,
  testId: string,
  componentProps: Record<string, unknown> = {}
): JsonNode => ({
  model,
  component,
  componentProps: { ...componentProps, testId },
});

// -----------------------------------------------------------------------------
// Step 1 — Loan parameters
// -----------------------------------------------------------------------------

const step1: JsonNode = {
  selector: 'step1',
  component: 'Section',
  componentProps: {
    title: 'Шаг 1. Параметры кредита',
    titleAs: 'h2',
    titleClassName: 'text-xl font-bold mb-4 text-gray-900',
    className: 'space-y-4 bg-white border rounded-xl shadow-sm p-6',
  },
  children: [
    f('loanType', 'Select', 'step1.loanType', {
      label: 'Тип кредита',
      placeholder: 'Выберите тип кредита',
      options: 'LOAN_TYPE_OPTIONS',
    }),
    {
      component: 'Box',
      componentProps: { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
      children: [
        f('loanAmount', 'Input', 'step1.loanAmount', {
          label: 'Сумма кредита (₽)',
          placeholder: 'Введите сумму',
          type: 'number',
        }),
        f('loanTerm', 'Input', 'step1.loanTerm', {
          label: 'Срок кредита (месяцев)',
          placeholder: 'Введите срок',
          type: 'number',
        }),
      ],
    },
    f('loanPurpose', 'Textarea', 'step1.loanPurpose', {
      label: 'Цель кредита',
      placeholder: 'Опишите, на что планируете потратить средства',
      rows: 4,
    }),
    // Mortgage section — visibility controlled via setHidden('mortgage-section')
    {
      selector: 'mortgage-section',
      component: 'Box',
      componentProps: { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
      children: [
        f('propertyValue', 'Input', 'step1.propertyValue', {
          label: 'Стоимость недвижимости (₽)',
          placeholder: 'Введите стоимость',
          type: 'number',
        }),
        f('initialPayment', 'Input', 'step1.initialPayment', {
          label: 'Первоначальный взнос (₽)',
          placeholder: 'Введите сумму',
          type: 'number',
          readOnly: true,
        }),
      ],
    },
    // Car section
    {
      selector: 'car-section',
      component: 'Box',
      componentProps: { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
      children: [
        f('carBrand', 'Input', 'step1.carBrand', {
          label: 'Марка автомобиля',
          placeholder: 'Toyota',
        }),
        f('carModel', 'Input', 'step1.carModel', {
          label: 'Модель автомобиля',
          placeholder: 'Camry',
        }),
        f('carYear', 'Input', 'step1.carYear', {
          label: 'Год выпуска',
          placeholder: '2020',
          type: 'number',
        }),
        f('carPrice', 'Input', 'step1.carPrice', {
          label: 'Стоимость автомобиля (₽)',
          placeholder: 'Введите стоимость',
          type: 'number',
        }),
      ],
    },
  ],
};

// -----------------------------------------------------------------------------
// Step 2 — Personal & passport
// -----------------------------------------------------------------------------

const step2: JsonNode = {
  selector: 'step2',
  component: 'Section',
  componentProps: {
    title: 'Шаг 2. Личные данные',
    titleAs: 'h2',
    titleClassName: 'text-xl font-bold mb-4 text-gray-900',
    className: 'space-y-4 bg-white border rounded-xl shadow-sm p-6',
  },
  children: [
    {
      component: 'Box',
      componentProps: { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
      children: [
        f('personalData.lastName', 'Input', 'step2.personalData.lastName', {
          label: 'Фамилия',
          placeholder: 'Введите фамилию',
        }),
        f('personalData.firstName', 'Input', 'step2.personalData.firstName', {
          label: 'Имя',
          placeholder: 'Введите имя',
        }),
        f('personalData.middleName', 'Input', 'step2.personalData.middleName', {
          label: 'Отчество',
          placeholder: 'Введите отчество',
        }),
        f('personalData.birthDate', 'Input', 'step2.personalData.birthDate', {
          label: 'Дата рождения',
          type: 'date',
        }),
      ],
    },
    f('personalData.gender', 'RadioGroup', 'step2.personalData.gender', {
      label: 'Пол',
      options: 'GENDER_OPTIONS',
    }),
    f('personalData.birthPlace', 'Input', 'step2.personalData.birthPlace', {
      label: 'Место рождения',
      placeholder: 'Введите место рождения',
    }),
    {
      component: 'Box',
      componentProps: { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
      children: [
        f('passportData.series', 'InputMask', 'step2.passportData.series', {
          label: 'Серия паспорта',
          placeholder: '12 34',
          mask: '99 99',
        }),
        f('passportData.number', 'InputMask', 'step2.passportData.number', {
          label: 'Номер паспорта',
          placeholder: '123456',
          mask: '999999',
        }),
        f('passportData.issueDate', 'Input', 'step2.passportData.issueDate', {
          label: 'Дата выдачи',
          type: 'date',
        }),
        f('passportData.departmentCode', 'InputMask', 'step2.passportData.departmentCode', {
          label: 'Код подразделения',
          placeholder: '123-456',
          mask: '999-999',
        }),
      ],
    },
    f('passportData.issuedBy', 'Input', 'step2.passportData.issuedBy', {
      label: 'Кем выдан',
      placeholder: 'Введите название органа',
    }),
    {
      component: 'Box',
      componentProps: { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
      children: [
        f('inn', 'InputMask', 'step2.inn', {
          label: 'ИНН',
          placeholder: '123456789012',
          mask: '999999999999',
        }),
        f('snils', 'InputMask', 'step2.snils', {
          label: 'СНИЛС',
          placeholder: '123-456-789 00',
          mask: '999-999-999 99',
        }),
      ],
    },
  ],
};

// -----------------------------------------------------------------------------
// Step 3 — Contacts
// -----------------------------------------------------------------------------

const step3: JsonNode = {
  selector: 'step3',
  component: 'Section',
  componentProps: {
    title: 'Шаг 3. Контактная информация',
    titleAs: 'h2',
    titleClassName: 'text-xl font-bold mb-4 text-gray-900',
    className: 'space-y-4 bg-white border rounded-xl shadow-sm p-6',
  },
  children: [
    {
      component: 'Box',
      componentProps: { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
      children: [
        f('phoneMain', 'InputMask', 'step3.phoneMain', {
          label: 'Основной телефон',
          placeholder: '+7 (___) ___-__-__',
          mask: '+7 (999) 999-99-99',
        }),
        f('phoneAdditional', 'InputMask', 'step3.phoneAdditional', {
          label: 'Дополнительный телефон',
          placeholder: '+7 (___) ___-__-__',
          mask: '+7 (999) 999-99-99',
        }),
        f('email', 'Input', 'step3.email', {
          label: 'Email',
          placeholder: 'example@mail.com',
          type: 'email',
        }),
        f('emailAdditional', 'Input', 'step3.emailAdditional', {
          label: 'Дополнительный email',
          placeholder: 'example@mail.com',
          type: 'email',
        }),
      ],
    },
    {
      component: 'Section',
      componentProps: { title: 'Адрес регистрации', titleAs: 'h3', className: 'space-y-4' },
      children: [
        {
          component: 'Box',
          componentProps: { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
          children: [
            f('registrationAddress.region', 'Input', 'step3.registrationAddress.region', {
              label: 'Регион',
              placeholder: 'Введите регион',
            }),
            f('registrationAddress.city', 'Input', 'step3.registrationAddress.city', {
              label: 'Город',
              placeholder: 'Введите город',
            }),
            f('registrationAddress.street', 'Input', 'step3.registrationAddress.street', {
              label: 'Улица',
              placeholder: 'Введите улицу',
            }),
            f('registrationAddress.house', 'Input', 'step3.registrationAddress.house', {
              label: 'Дом',
              placeholder: '№',
            }),
            f('registrationAddress.apartment', 'Input', 'step3.registrationAddress.apartment', {
              label: 'Квартира',
              placeholder: '№',
            }),
            f('registrationAddress.postalCode', 'InputMask', 'step3.registrationAddress.postalCode', {
              label: 'Индекс',
              placeholder: '000000',
              mask: '999999',
            }),
          ],
        },
      ],
    },
    f('sameAsRegistration', 'Checkbox', 'step3.sameAsRegistration', {
      label: 'Адрес проживания совпадает с адресом регистрации',
    }),
    {
      selector: 'residence-section',
      component: 'Section',
      componentProps: { title: 'Адрес проживания', titleAs: 'h3', className: 'space-y-4' },
      children: [
        {
          component: 'Box',
          componentProps: { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
          children: [
            f('residenceAddress.region', 'Input', 'step3.residenceAddress.region', {
              label: 'Регион',
              placeholder: 'Введите регион',
            }),
            f('residenceAddress.city', 'Input', 'step3.residenceAddress.city', {
              label: 'Город',
              placeholder: 'Введите город',
            }),
            f('residenceAddress.street', 'Input', 'step3.residenceAddress.street', {
              label: 'Улица',
              placeholder: 'Введите улицу',
            }),
            f('residenceAddress.house', 'Input', 'step3.residenceAddress.house', {
              label: 'Дом',
              placeholder: '№',
            }),
            f('residenceAddress.apartment', 'Input', 'step3.residenceAddress.apartment', {
              label: 'Квартира',
              placeholder: '№',
            }),
            f('residenceAddress.postalCode', 'InputMask', 'step3.residenceAddress.postalCode', {
              label: 'Индекс',
              placeholder: '000000',
              mask: '999999',
            }),
          ],
        },
      ],
    },
  ],
};

// -----------------------------------------------------------------------------
// Step 4 — Employment
// -----------------------------------------------------------------------------

const step4: JsonNode = {
  selector: 'step4',
  component: 'Section',
  componentProps: {
    title: 'Шаг 4. Трудоустройство',
    titleAs: 'h2',
    titleClassName: 'text-xl font-bold mb-4 text-gray-900',
    className: 'space-y-4 bg-white border rounded-xl shadow-sm p-6',
  },
  children: [
    f('employmentStatus', 'RadioGroup', 'step4.employmentStatus', {
      label: 'Статус занятости',
      options: 'EMPLOYMENT_OPTIONS',
    }),
    {
      selector: 'employed-section',
      component: 'Box',
      componentProps: { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
      children: [
        f('companyName', 'Input', 'step4.companyName', {
          label: 'Название компании',
          placeholder: 'Введите название',
        }),
        f('companyInn', 'InputMask', 'step4.companyInn', {
          label: 'ИНН компании',
          placeholder: '1234567890',
          mask: '9999999999',
        }),
        f('companyPhone', 'InputMask', 'step4.companyPhone', {
          label: 'Телефон компании',
          placeholder: '+7 (___) ___-__-__',
          mask: '+7 (999) 999-99-99',
        }),
        f('companyAddress', 'Input', 'step4.companyAddress', {
          label: 'Адрес компании',
          placeholder: 'Полный адрес',
        }),
        f('position', 'Input', 'step4.position', {
          label: 'Должность',
          placeholder: 'Ваша должность',
        }),
      ],
    },
    {
      selector: 'business-section',
      component: 'Box',
      componentProps: { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
      children: [
        f('businessType', 'Input', 'step4.businessType', {
          label: 'Тип бизнеса',
          placeholder: 'ИП, ООО и т.д.',
        }),
        f('businessInn', 'InputMask', 'step4.businessInn', {
          label: 'ИНН ИП',
          placeholder: '123456789012',
          mask: '999999999999',
        }),
        f('businessActivity', 'Textarea', 'step4.businessActivity', {
          label: 'Вид деятельности',
          placeholder: 'Опишите вид деятельности',
          rows: 3,
        }),
      ],
    },
    {
      component: 'Box',
      componentProps: { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
      children: [
        f('workExperienceTotal', 'Input', 'step4.workExperienceTotal', {
          label: 'Общий стаж работы (месяцев)',
          placeholder: '0',
          type: 'number',
        }),
        f('workExperienceCurrent', 'Input', 'step4.workExperienceCurrent', {
          label: 'Стаж на текущем месте (месяцев)',
          placeholder: '0',
          type: 'number',
        }),
        f('monthlyIncome', 'Input', 'step4.monthlyIncome', {
          label: 'Ежемесячный доход (₽)',
          placeholder: '0',
          type: 'number',
        }),
        f('additionalIncome', 'Input', 'step4.additionalIncome', {
          label: 'Дополнительный доход (₽)',
          placeholder: '0',
          type: 'number',
        }),
      ],
    },
    f('additionalIncomeSource', 'Input', 'step4.additionalIncomeSource', {
      label: 'Источник дополнительного дохода',
      placeholder: 'Опишите источник',
    }),
    // Computed read-only fields
    {
      component: 'Box',
      componentProps: { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
      children: [
        f('totalIncome', 'Input', 'step4.totalIncome', {
          label: 'Общий доход (₽)',
          type: 'number',
          readOnly: true,
          disabled: true,
        }),
        f('interestRate', 'Input', 'step4.interestRate', {
          label: 'Процентная ставка (%)',
          type: 'number',
          readOnly: true,
          disabled: true,
        }),
        f('monthlyPayment', 'Input', 'step4.monthlyPayment', {
          label: 'Ежемесячный платеж (₽)',
          type: 'number',
          readOnly: true,
          disabled: true,
        }),
        f('paymentToIncomeRatio', 'Input', 'step4.paymentToIncomeRatio', {
          label: 'Процент платежа от дохода (%)',
          type: 'number',
          readOnly: true,
          disabled: true,
        }),
      ],
    },
  ],
};

// -----------------------------------------------------------------------------
// Step 5 — Additional + arrays
// -----------------------------------------------------------------------------

// Property item template — referenced via $template
const propertyTemplate: JsonNode = {
  component: 'Box',
  componentProps: { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
  children: [
    f('type', 'Select', 'step5.properties.type', {
      label: 'Тип имущества',
      placeholder: 'Выберите тип',
      options: 'PROPERTY_TYPE_OPTIONS',
    }),
    f('estimatedValue', 'Input', 'step5.properties.estimatedValue', {
      label: 'Оценочная стоимость',
      placeholder: '0',
      type: 'number',
    }),
    f('description', 'Textarea', 'step5.properties.description', {
      label: 'Описание',
      placeholder: 'Опишите имущество',
      rows: 2,
    }),
    f('hasEncumbrance', 'Checkbox', 'step5.properties.hasEncumbrance', {
      label: 'Имеется обременение (залог)',
    }),
  ],
};

const existingLoanTemplate: JsonNode = {
  component: 'Box',
  componentProps: { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
  children: [
    f('bank', 'Input', 'step5.existingLoans.bank', {
      label: 'Банк',
      placeholder: 'Название банка',
    }),
    f('type', 'Input', 'step5.existingLoans.type', {
      label: 'Тип кредита',
      placeholder: 'Тип кредита',
    }),
    f('amount', 'Input', 'step5.existingLoans.amount', {
      label: 'Сумма кредита',
      placeholder: '0',
      type: 'number',
    }),
    f('remainingAmount', 'Input', 'step5.existingLoans.remainingAmount', {
      label: 'Остаток задолженности',
      placeholder: '0',
      type: 'number',
    }),
    f('monthlyPayment', 'Input', 'step5.existingLoans.monthlyPayment', {
      label: 'Ежемесячный платеж',
      placeholder: '0',
      type: 'number',
    }),
    f('maturityDate', 'Input', 'step5.existingLoans.maturityDate', {
      label: 'Дата погашения',
      type: 'date',
    }),
  ],
};

const coBorrowerTemplate: JsonNode = {
  component: 'Box',
  componentProps: { className: 'space-y-4' },
  children: [
    {
      component: 'Box',
      componentProps: { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
      children: [
        f('personalData.lastName', 'Input', 'step5.coBorrowers.personalData.lastName', {
          label: 'Фамилия',
          placeholder: 'Введите фамилию',
        }),
        f('personalData.firstName', 'Input', 'step5.coBorrowers.personalData.firstName', {
          label: 'Имя',
          placeholder: 'Введите имя',
        }),
        f('personalData.middleName', 'Input', 'step5.coBorrowers.personalData.middleName', {
          label: 'Отчество',
          placeholder: 'Введите отчество',
        }),
        f('personalData.birthDate', 'Input', 'step5.coBorrowers.personalData.birthDate', {
          label: 'Дата рождения',
          type: 'date',
        }),
        f('phone', 'InputMask', 'step5.coBorrowers.phone', {
          label: 'Телефон',
          placeholder: '+7 (___) ___-__-__',
          mask: '+7 (999) 999-99-99',
        }),
        f('email', 'Input', 'step5.coBorrowers.email', {
          label: 'Email',
          placeholder: 'example@mail.com',
          type: 'email',
        }),
        f('relationship', 'Input', 'step5.coBorrowers.relationship', {
          label: 'Родство',
          placeholder: 'Укажите родство',
        }),
        f('monthlyIncome', 'Input', 'step5.coBorrowers.monthlyIncome', {
          label: 'Ежемесячный доход',
          placeholder: '0',
          type: 'number',
        }),
      ],
    },
  ],
};

const step5: JsonNode = {
  selector: 'step5',
  component: 'Section',
  componentProps: {
    title: 'Шаг 5. Дополнительная информация',
    titleAs: 'h2',
    titleClassName: 'text-xl font-bold mb-4 text-gray-900',
    className: 'space-y-4 bg-white border rounded-xl shadow-sm p-6',
  },
  children: [
    f('maritalStatus', 'RadioGroup', 'step5.maritalStatus', {
      label: 'Семейное положение',
      options: 'MARITAL_OPTIONS',
    }),
    {
      component: 'Box',
      componentProps: { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
      children: [
        f('dependents', 'Input', 'step5.dependents', {
          label: 'Количество иждивенцев',
          placeholder: '0',
          type: 'number',
        }),
        f('education', 'Select', 'step5.education', {
          label: 'Образование',
          placeholder: 'Выберите уровень образования',
          options: 'EDUCATION_OPTIONS',
        }),
      ],
    },
    f('hasProperty', 'Checkbox', 'step5.hasProperty', {
      label: 'У меня есть имущество',
    }),
    {
      selector: 'properties-section',
      component: 'FormArraySection',
      componentProps: {
        control: 'properties',
        title: 'Имущество',
        addButtonLabel: '+ Добавить имущество',
        addButtonTestId: 'array-add-properties',
        itemTestIdPrefix: 'array-item-properties',
        itemComponent: { $template: propertyTemplate },
      },
    },
    f('hasExistingLoans', 'Checkbox', 'step5.hasExistingLoans', {
      label: 'У меня есть другие кредиты',
    }),
    {
      selector: 'existingLoans-section',
      component: 'FormArraySection',
      componentProps: {
        control: 'existingLoans',
        title: 'Существующие кредиты',
        addButtonLabel: '+ Добавить кредит',
        addButtonTestId: 'array-add-existingLoans',
        itemTestIdPrefix: 'array-item-existingLoans',
        itemComponent: { $template: existingLoanTemplate },
      },
    },
    f('hasCoBorrower', 'Checkbox', 'step5.hasCoBorrower', {
      label: 'Добавить созаемщика',
    }),
    {
      selector: 'coBorrowers-section',
      component: 'FormArraySection',
      componentProps: {
        control: 'coBorrowers',
        title: 'Созаемщики',
        addButtonLabel: '+ Добавить созаемщика',
        addButtonTestId: 'array-add-coBorrowers',
        itemTestIdPrefix: 'array-item-coBorrowers',
        itemComponent: { $template: coBorrowerTemplate },
      },
    },
  ],
};

// -----------------------------------------------------------------------------
// Step 6 — Confirmation
// -----------------------------------------------------------------------------

const step6: JsonNode = {
  selector: 'step6',
  component: 'Section',
  componentProps: {
    title: 'Шаг 6. Подтверждение',
    titleAs: 'h2',
    titleClassName: 'text-xl font-bold mb-4 text-gray-900',
    className: 'space-y-4 bg-white border rounded-xl shadow-sm p-6',
  },
  children: [
    f('fullName', 'Input', 'step6.fullName', {
      label: 'Полное имя',
      readOnly: true,
      disabled: true,
    }),
    f('age', 'Input', 'step6.age', {
      label: 'Возраст (лет)',
      type: 'number',
      readOnly: true,
      disabled: true,
    }),
    f('agreePersonalData', 'Checkbox', 'step6.agreePersonalData', {
      label: 'Согласие на обработку персональных данных',
    }),
    f('agreeCreditHistory', 'Checkbox', 'step6.agreeCreditHistory', {
      label: 'Согласие на проверку кредитной истории',
    }),
    f('agreeMarketing', 'Checkbox', 'step6.agreeMarketing', {
      label: 'Согласие на получение маркетинговых материалов',
    }),
    f('agreeTerms', 'Checkbox', 'step6.agreeTerms', {
      label: 'Согласие с условиями кредитования',
    }),
    f('confirmAccuracy', 'Checkbox', 'step6.confirmAccuracy', {
      label: 'Подтверждаю точность введенных данных',
    }),
    f('electronicSignature', 'InputMask', 'step6.electronicSignature', {
      label: 'Код подтверждения из СМС',
      placeholder: '123456',
      mask: '999999',
    }),
  ],
};

// -----------------------------------------------------------------------------
// Root form schema
// -----------------------------------------------------------------------------

export const creditApplicationJsonSchema: JsonFormSchema = {
  version: '1.0',
  root: {
    component: 'FormRoot',
    children: [step1, step2, step3, step4, step5, step6],
  },
};
