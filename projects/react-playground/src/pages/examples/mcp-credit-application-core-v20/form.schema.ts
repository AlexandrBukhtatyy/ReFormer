// form.schema.ts — FieldConfig tree binding model signals → component/componentProps/testId.
// Schema-driven UI: component + все props объявлены здесь; JSX рендерит <FormField control={...}/>.
// Валидаторы живут в validation.ts (model-схема, исполняется validateFormModel).
import { type FormModel } from '@reformer/core';
import { Checkbox, Input, InputMask, RadioGroup, Select, Textarea } from '@reformer/ui-kit';
import {
  EDUCATION_OPTIONS,
  EMPLOYMENT_STATUS_OPTIONS,
  GENDER_OPTIONS,
  LOAN_TYPE_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  PROPERTY_TYPE_OPTIONS,
  type CoBorrower,
  type CreditForm,
  type ExistingLoan,
  type Property,
} from './types';
import { REGION_OPTIONS } from './data-sources';

/**
 * Строит схему формы. `readOnly=true` (mode='view') делает все поля disabled.
 * Computed-поля (interestRate/monthlyPayment/…) всегда readonly.
 */
export function buildCreditSchema(model: FormModel<CreditForm>, readOnly = false) {
  const m = model.$;

  // merge disabled в componentProps при view-mode
  const cp = (props: Record<string, unknown>) => (readOnly ? { ...props, disabled: true } : props);
  // computed / readonly props (всегда disabled)
  const roProps = (props: Record<string, unknown>) => ({
    ...props,
    readOnly: true,
    disabled: true,
  });

  // --- array item builders --------------------------------------------------
  const propertyItem = (item: FormModel<Property>) => ({
    type: {
      value: item.$.type,
      component: Select,
      componentProps: cp({
        label: 'Тип имущества',
        testId: 'type',
        options: PROPERTY_TYPE_OPTIONS,
      }),
    },
    description: {
      value: item.$.description,
      component: Textarea,
      componentProps: cp({
        label: 'Описание',
        testId: 'description',
        placeholder: 'Опишите имущество',
      }),
    },
    estimatedValue: {
      value: item.$.estimatedValue,
      component: Input,
      componentProps: cp({
        label: 'Оценочная стоимость (₽)',
        testId: 'estimatedValue',
        type: 'number',
      }),
    },
    hasEncumbrance: {
      value: item.$.hasEncumbrance,
      component: Checkbox,
      componentProps: cp({ label: 'Имеется обременение (залог)', testId: 'hasEncumbrance' }),
    },
  });

  const existingLoanItem = (item: FormModel<ExistingLoan>) => ({
    bank: {
      value: item.$.bank,
      component: Input,
      componentProps: cp({ label: 'Банк', testId: 'bank', placeholder: 'Название банка' }),
    },
    type: {
      value: item.$.type,
      component: Input,
      componentProps: cp({ label: 'Тип кредита', testId: 'type', placeholder: 'Тип кредита' }),
    },
    amount: {
      value: item.$.amount,
      component: Input,
      componentProps: cp({ label: 'Сумма кредита (₽)', testId: 'amount', type: 'number' }),
    },
    remainingAmount: {
      value: item.$.remainingAmount,
      component: Input,
      componentProps: cp({
        label: 'Остаток задолженности (₽)',
        testId: 'remainingAmount',
        type: 'number',
      }),
    },
    monthlyPayment: {
      value: item.$.monthlyPayment,
      component: Input,
      componentProps: cp({
        label: 'Ежемесячный платёж (₽)',
        testId: 'monthlyPayment',
        type: 'number',
      }),
    },
    maturityDate: {
      value: item.$.maturityDate,
      component: Input,
      componentProps: cp({ label: 'Дата погашения', testId: 'maturityDate', type: 'date' }),
    },
  });

  const coBorrowerItem = (item: FormModel<CoBorrower>) => ({
    personalData: {
      lastName: {
        value: item.$.personalData.lastName,
        component: Input,
        componentProps: cp({ label: 'Фамилия', testId: 'personalData-lastName' }),
      },
      firstName: {
        value: item.$.personalData.firstName,
        component: Input,
        componentProps: cp({ label: 'Имя', testId: 'personalData-firstName' }),
      },
      middleName: {
        value: item.$.personalData.middleName,
        component: Input,
        componentProps: cp({ label: 'Отчество', testId: 'personalData-middleName' }),
      },
      birthDate: {
        value: item.$.personalData.birthDate,
        component: Input,
        componentProps: cp({
          label: 'Дата рождения',
          testId: 'personalData-birthDate',
          type: 'date',
        }),
      },
      gender: {
        value: item.$.personalData.gender,
        component: RadioGroup,
        componentProps: cp({
          label: 'Пол',
          testId: 'personalData-gender',
          options: GENDER_OPTIONS,
        }),
      },
      birthPlace: {
        value: item.$.personalData.birthPlace,
        component: Input,
        componentProps: cp({ label: 'Место рождения', testId: 'personalData-birthPlace' }),
      },
    },
    phone: {
      value: item.$.phone,
      component: InputMask,
      componentProps: cp({ label: 'Телефон', testId: 'phone', mask: '+7 (999) 999-99-99' }),
    },
    email: {
      value: item.$.email,
      component: Input,
      componentProps: cp({ label: 'Email', testId: 'email', type: 'email' }),
    },
    relationship: {
      value: item.$.relationship,
      component: Input,
      componentProps: cp({
        label: 'Родство',
        testId: 'relationship',
        placeholder: 'Укажите родство',
      }),
    },
    monthlyIncome: {
      value: item.$.monthlyIncome,
      component: Input,
      componentProps: cp({
        label: 'Ежемесячный доход (₽)',
        testId: 'monthlyIncome',
        type: 'number',
      }),
    },
  });

  return {
    // ===== Step 1 — loan =====
    loanType: {
      value: m.loanType,
      component: Select,
      componentProps: cp({ label: 'Тип кредита', testId: 'loanType', options: LOAN_TYPE_OPTIONS }),
    },
    loanAmount: {
      value: m.loanAmount,
      component: Input,
      componentProps: cp({
        label: 'Сумма кредита (₽)',
        testId: 'loanAmount',
        type: 'number',
        step: 10000,
      }),
    },
    loanTerm: {
      value: m.loanTerm,
      component: Input,
      componentProps: cp({ label: 'Срок кредита (месяцев)', testId: 'loanTerm', type: 'number' }),
    },
    loanPurpose: {
      value: m.loanPurpose,
      component: Textarea,
      componentProps: cp({ label: 'Цель кредита', testId: 'loanPurpose', maxLength: 500 }),
    },
    propertyValue: {
      value: m.propertyValue,
      component: Input,
      componentProps: cp({
        label: 'Стоимость недвижимости (₽)',
        testId: 'propertyValue',
        type: 'number',
      }),
    },
    initialPayment: {
      value: m.initialPayment,
      component: Input,
      componentProps: roProps({
        label: 'Первоначальный взнос (₽)',
        testId: 'initialPayment',
        type: 'number',
      }),
    },
    carBrand: {
      value: m.carBrand,
      component: Input,
      componentProps: cp({
        label: 'Марка автомобиля',
        testId: 'carBrand',
        placeholder: 'Например: Toyota',
      }),
    },
    carModel: {
      value: m.carModel,
      component: Select,
      componentProps: cp({ label: 'Модель автомобиля', testId: 'carModel', options: [] }),
    },
    carYear: {
      value: m.carYear,
      component: Input,
      componentProps: cp({ label: 'Год выпуска', testId: 'carYear', type: 'number' }),
    },
    carPrice: {
      value: m.carPrice,
      component: Input,
      componentProps: cp({ label: 'Стоимость автомобиля (₽)', testId: 'carPrice', type: 'number' }),
    },

    // ===== Step 2 — personal =====
    personalData: {
      lastName: {
        value: m.personalData.lastName,
        component: Input,
        componentProps: cp({ label: 'Фамилия', testId: 'personalData-lastName' }),
      },
      firstName: {
        value: m.personalData.firstName,
        component: Input,
        componentProps: cp({ label: 'Имя', testId: 'personalData-firstName' }),
      },
      middleName: {
        value: m.personalData.middleName,
        component: Input,
        componentProps: cp({ label: 'Отчество', testId: 'personalData-middleName' }),
      },
      birthDate: {
        value: m.personalData.birthDate,
        component: Input,
        componentProps: cp({
          label: 'Дата рождения',
          testId: 'personalData-birthDate',
          type: 'date',
        }),
      },
      gender: {
        value: m.personalData.gender,
        component: RadioGroup,
        componentProps: cp({
          label: 'Пол',
          testId: 'personalData-gender',
          options: GENDER_OPTIONS,
        }),
      },
      birthPlace: {
        value: m.personalData.birthPlace,
        component: Input,
        componentProps: cp({ label: 'Место рождения', testId: 'personalData-birthPlace' }),
      },
    },
    passportData: {
      series: {
        value: m.passportData.series,
        component: InputMask,
        componentProps: cp({
          label: 'Серия паспорта',
          testId: 'passportData-series',
          mask: '99 99',
        }),
      },
      number: {
        value: m.passportData.number,
        component: InputMask,
        componentProps: cp({
          label: 'Номер паспорта',
          testId: 'passportData-number',
          mask: '999999',
        }),
      },
      issueDate: {
        value: m.passportData.issueDate,
        component: Input,
        componentProps: cp({
          label: 'Дата выдачи',
          testId: 'passportData-issueDate',
          type: 'date',
        }),
      },
      issuedBy: {
        value: m.passportData.issuedBy,
        component: Input,
        componentProps: cp({ label: 'Кем выдан', testId: 'passportData-issuedBy' }),
      },
      departmentCode: {
        value: m.passportData.departmentCode,
        component: InputMask,
        componentProps: cp({
          label: 'Код подразделения',
          testId: 'passportData-departmentCode',
          mask: '999-999',
        }),
      },
    },
    inn: {
      value: m.inn,
      component: InputMask,
      componentProps: cp({ label: 'ИНН', testId: 'inn', mask: '999999999999' }),
    },
    snils: {
      value: m.snils,
      component: InputMask,
      componentProps: cp({ label: 'СНИЛС', testId: 'snils', mask: '999-999-999 99' }),
    },

    // ===== Step 3 — contacts =====
    phoneMain: {
      value: m.phoneMain,
      component: InputMask,
      componentProps: cp({
        label: 'Основной телефон',
        testId: 'phoneMain',
        mask: '+7 (999) 999-99-99',
      }),
    },
    phoneAdditional: {
      value: m.phoneAdditional,
      component: InputMask,
      componentProps: cp({
        label: 'Дополнительный телефон',
        testId: 'phoneAdditional',
        mask: '+7 (999) 999-99-99',
      }),
    },
    email: {
      value: m.email,
      component: Input,
      componentProps: cp({ label: 'Email', testId: 'email', type: 'email' }),
    },
    emailAdditional: {
      value: m.emailAdditional,
      component: Input,
      componentProps: cp({
        label: 'Дополнительный email',
        testId: 'emailAdditional',
        type: 'email',
      }),
    },
    sameEmail: {
      value: m.sameEmail,
      component: Checkbox,
      componentProps: cp({
        label: 'Дополнительный email совпадает с основным',
        testId: 'sameEmail',
      }),
    },
    registrationAddress: {
      region: {
        value: m.registrationAddress.region,
        component: Select,
        componentProps: cp({
          label: 'Регион',
          testId: 'registrationAddress-region',
          options: REGION_OPTIONS,
        }),
      },
      city: {
        value: m.registrationAddress.city,
        component: Select,
        componentProps: cp({ label: 'Город', testId: 'registrationAddress-city', options: [] }),
      },
      street: {
        value: m.registrationAddress.street,
        component: Input,
        componentProps: cp({ label: 'Улица', testId: 'registrationAddress-street' }),
      },
      house: {
        value: m.registrationAddress.house,
        component: Input,
        componentProps: cp({ label: 'Дом', testId: 'registrationAddress-house' }),
      },
      apartment: {
        value: m.registrationAddress.apartment,
        component: Input,
        componentProps: cp({ label: 'Квартира', testId: 'registrationAddress-apartment' }),
      },
      postalCode: {
        value: m.registrationAddress.postalCode,
        component: InputMask,
        componentProps: cp({
          label: 'Индекс',
          testId: 'registrationAddress-postalCode',
          mask: '999999',
        }),
      },
    },
    sameAsRegistration: {
      value: m.sameAsRegistration,
      component: Checkbox,
      componentProps: cp({
        label: 'Адрес проживания совпадает с адресом регистрации',
        testId: 'sameAsRegistration',
      }),
    },
    residenceAddress: {
      region: {
        value: m.residenceAddress.region,
        component: Select,
        componentProps: cp({
          label: 'Регион',
          testId: 'residenceAddress-region',
          options: REGION_OPTIONS,
        }),
      },
      city: {
        value: m.residenceAddress.city,
        component: Select,
        componentProps: cp({ label: 'Город', testId: 'residenceAddress-city', options: [] }),
      },
      street: {
        value: m.residenceAddress.street,
        component: Input,
        componentProps: cp({ label: 'Улица', testId: 'residenceAddress-street' }),
      },
      house: {
        value: m.residenceAddress.house,
        component: Input,
        componentProps: cp({ label: 'Дом', testId: 'residenceAddress-house' }),
      },
      apartment: {
        value: m.residenceAddress.apartment,
        component: Input,
        componentProps: cp({ label: 'Квартира', testId: 'residenceAddress-apartment' }),
      },
      postalCode: {
        value: m.residenceAddress.postalCode,
        component: InputMask,
        componentProps: cp({
          label: 'Индекс',
          testId: 'residenceAddress-postalCode',
          mask: '999999',
        }),
      },
    },

    // ===== Step 4 — employment =====
    employmentStatus: {
      value: m.employmentStatus,
      component: RadioGroup,
      componentProps: cp({
        label: 'Статус занятости',
        testId: 'employmentStatus',
        options: EMPLOYMENT_STATUS_OPTIONS,
      }),
    },
    companyName: {
      value: m.companyName,
      component: Input,
      componentProps: cp({ label: 'Название компании', testId: 'companyName' }),
    },
    companyInn: {
      value: m.companyInn,
      component: InputMask,
      componentProps: cp({ label: 'ИНН компании', testId: 'companyInn', mask: '9999999999' }),
    },
    companyPhone: {
      value: m.companyPhone,
      component: InputMask,
      componentProps: cp({
        label: 'Телефон компании',
        testId: 'companyPhone',
        mask: '+7 (999) 999-99-99',
      }),
    },
    companyAddress: {
      value: m.companyAddress,
      component: Input,
      componentProps: cp({ label: 'Адрес компании', testId: 'companyAddress' }),
    },
    position: {
      value: m.position,
      component: Input,
      componentProps: cp({ label: 'Должность', testId: 'position' }),
    },
    workExperienceTotal: {
      value: m.workExperienceTotal,
      component: Input,
      componentProps: cp({
        label: 'Общий стаж (месяцев)',
        testId: 'workExperienceTotal',
        type: 'number',
      }),
    },
    workExperienceCurrent: {
      value: m.workExperienceCurrent,
      component: Input,
      componentProps: cp({
        label: 'Стаж на текущем месте (месяцев)',
        testId: 'workExperienceCurrent',
        type: 'number',
      }),
    },
    monthlyIncome: {
      value: m.monthlyIncome,
      component: Input,
      componentProps: cp({
        label: 'Ежемесячный доход (₽)',
        testId: 'monthlyIncome',
        type: 'number',
      }),
    },
    additionalIncome: {
      value: m.additionalIncome,
      component: Input,
      componentProps: cp({
        label: 'Дополнительный доход (₽)',
        testId: 'additionalIncome',
        type: 'number',
      }),
    },
    additionalIncomeSource: {
      value: m.additionalIncomeSource,
      component: Input,
      componentProps: cp({
        label: 'Источник дополнительного дохода',
        testId: 'additionalIncomeSource',
      }),
    },
    businessType: {
      value: m.businessType,
      component: Input,
      componentProps: cp({
        label: 'Тип бизнеса',
        testId: 'businessType',
        placeholder: 'ИП, ООО и т.д.',
      }),
    },
    businessInn: {
      value: m.businessInn,
      component: InputMask,
      componentProps: cp({ label: 'ИНН ИП', testId: 'businessInn', mask: '999999999999' }),
    },
    businessActivity: {
      value: m.businessActivity,
      component: Textarea,
      componentProps: cp({ label: 'Вид деятельности', testId: 'businessActivity' }),
    },

    // ===== Step 5 — additional =====
    maritalStatus: {
      value: m.maritalStatus,
      component: RadioGroup,
      componentProps: cp({
        label: 'Семейное положение',
        testId: 'maritalStatus',
        options: MARITAL_STATUS_OPTIONS,
      }),
    },
    dependents: {
      value: m.dependents,
      component: Input,
      componentProps: cp({ label: 'Количество иждивенцев', testId: 'dependents', type: 'number' }),
    },
    education: {
      value: m.education,
      component: Select,
      componentProps: cp({ label: 'Образование', testId: 'education', options: EDUCATION_OPTIONS }),
    },
    hasProperty: {
      value: m.hasProperty,
      component: Checkbox,
      componentProps: cp({ label: 'У меня есть имущество', testId: 'hasProperty' }),
    },
    properties: { array: model.properties, item: propertyItem },
    hasExistingLoans: {
      value: m.hasExistingLoans,
      component: Checkbox,
      componentProps: cp({ label: 'У меня есть другие кредиты', testId: 'hasExistingLoans' }),
    },
    existingLoans: { array: model.existingLoans, item: existingLoanItem },
    hasCoBorrower: {
      value: m.hasCoBorrower,
      component: Checkbox,
      componentProps: cp({ label: 'Добавить созаёмщика', testId: 'hasCoBorrower' }),
    },
    coBorrowers: { array: model.coBorrowers, item: coBorrowerItem },

    // ===== Step 6 — confirmation =====
    agreePersonalData: {
      value: m.agreePersonalData,
      component: Checkbox,
      componentProps: cp({
        label: 'Согласие на обработку персональных данных',
        testId: 'agreePersonalData',
      }),
    },
    agreeCreditHistory: {
      value: m.agreeCreditHistory,
      component: Checkbox,
      componentProps: cp({
        label: 'Согласие на проверку кредитной истории',
        testId: 'agreeCreditHistory',
      }),
    },
    agreeMarketing: {
      value: m.agreeMarketing,
      component: Checkbox,
      componentProps: cp({
        label: 'Согласие на получение маркетинговых материалов',
        testId: 'agreeMarketing',
      }),
    },
    agreeTerms: {
      value: m.agreeTerms,
      component: Checkbox,
      componentProps: cp({ label: 'Согласие с условиями кредитования', testId: 'agreeTerms' }),
    },
    confirmAccuracy: {
      value: m.confirmAccuracy,
      component: Checkbox,
      componentProps: cp({
        label: 'Подтверждаю точность введённых данных',
        testId: 'confirmAccuracy',
      }),
    },
    electronicSignature: {
      value: m.electronicSignature,
      component: InputMask,
      componentProps: cp({
        label: 'Код подтверждения из СМС',
        testId: 'electronicSignature',
        mask: '999999',
      }),
    },

    // ===== Computed (readonly) =====
    interestRate: {
      value: m.interestRate,
      component: Input,
      componentProps: roProps({
        label: 'Процентная ставка (%)',
        testId: 'interestRate',
        type: 'number',
      }),
    },
    monthlyPayment: {
      value: m.monthlyPayment,
      component: Input,
      componentProps: roProps({
        label: 'Ежемесячный платёж (₽)',
        testId: 'monthlyPayment',
        type: 'number',
      }),
    },
    fullName: {
      value: m.fullName,
      component: Input,
      componentProps: roProps({ label: 'Полное имя', testId: 'fullName' }),
    },
    age: {
      value: m.age,
      component: Input,
      componentProps: roProps({ label: 'Возраст (лет)', testId: 'age', type: 'number' }),
    },
    totalIncome: {
      value: m.totalIncome,
      component: Input,
      componentProps: roProps({ label: 'Общий доход (₽)', testId: 'totalIncome', type: 'number' }),
    },
    paymentToIncomeRatio: {
      value: m.paymentToIncomeRatio,
      component: Input,
      componentProps: roProps({
        label: 'Платёж от дохода (%)',
        testId: 'paymentToIncomeRatio',
        type: 'number',
      }),
    },
    coBorrowersIncome: {
      value: m.coBorrowersIncome,
      component: Input,
      componentProps: roProps({
        label: 'Доход созаёмщиков (₽)',
        testId: 'coBorrowersIncome',
        type: 'number',
      }),
    },
  };
}
