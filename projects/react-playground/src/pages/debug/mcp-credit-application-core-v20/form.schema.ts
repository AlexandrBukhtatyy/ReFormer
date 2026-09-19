// form.schema.ts — FieldConfig tree binding model signals → component/componentProps/testId.
// Schema-driven UI: component + все props объявлены здесь; JSX рендерит <FormField control={...}/>.
// Валидаторы живут в validation.ts (model-схема, исполняется validateFormModel).
import { type FormModel } from '@reformer/core';
import {
  CheckboxWithLabel,
  Input,
  InputMask,
  RadioGroupOptions,
  SelectAsync,
  Textarea,
  InputNumber,
} from '@reformer/ui-kit';
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
      component: SelectAsync,
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
      component: InputNumber,
      componentProps: cp({
        label: 'Оценочная стоимость (₽)',
        testId: 'estimatedValue',
      }),
    },
    hasEncumbrance: {
      value: item.$.hasEncumbrance,
      component: CheckboxWithLabel,
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
      component: InputNumber,
      componentProps: cp({ label: 'Сумма кредита (₽)', testId: 'amount' }),
    },
    remainingAmount: {
      value: item.$.remainingAmount,
      component: InputNumber,
      componentProps: cp({
        label: 'Остаток задолженности (₽)',
        testId: 'remainingAmount',
      }),
    },
    monthlyPayment: {
      value: item.$.monthlyPayment,
      component: InputNumber,
      componentProps: cp({
        label: 'Ежемесячный платёж (₽)',
        testId: 'monthlyPayment',
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
        component: RadioGroupOptions,
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
      component: InputNumber,
      componentProps: cp({
        label: 'Ежемесячный доход (₽)',
        testId: 'monthlyIncome',
      }),
    },
  });

  return {
    // ===== Step 1 — loan =====
    loanType: {
      value: model.$.loanType,
      component: SelectAsync,
      componentProps: cp({ label: 'Тип кредита', testId: 'loanType', options: LOAN_TYPE_OPTIONS }),
    },
    loanAmount: {
      value: model.$.loanAmount,
      component: InputNumber,
      componentProps: cp({
        label: 'Сумма кредита (₽)',
        testId: 'loanAmount',

        step: 10000,
      }),
    },
    loanTerm: {
      value: model.$.loanTerm,
      component: InputNumber,
      componentProps: cp({ label: 'Срок кредита (месяцев)', testId: 'loanTerm' }),
    },
    loanPurpose: {
      value: model.$.loanPurpose,
      component: Textarea,
      componentProps: cp({ label: 'Цель кредита', testId: 'loanPurpose', maxLength: 500 }),
    },
    propertyValue: {
      value: model.$.propertyValue,
      component: InputNumber,
      componentProps: cp({
        label: 'Стоимость недвижимости (₽)',
        testId: 'propertyValue',
      }),
    },
    initialPayment: {
      value: model.$.initialPayment,
      component: InputNumber,
      componentProps: roProps({
        label: 'Первоначальный взнос (₽)',
        testId: 'initialPayment',
      }),
    },
    carBrand: {
      value: model.$.carBrand,
      component: Input,
      componentProps: cp({
        label: 'Марка автомобиля',
        testId: 'carBrand',
        placeholder: 'Например: Toyota',
      }),
    },
    carModel: {
      value: model.$.carModel,
      component: SelectAsync,
      componentProps: cp({ label: 'Модель автомобиля', testId: 'carModel', options: [] }),
    },
    carYear: {
      value: model.$.carYear,
      component: InputNumber,
      componentProps: cp({ label: 'Год выпуска', testId: 'carYear' }),
    },
    carPrice: {
      value: model.$.carPrice,
      component: InputNumber,
      componentProps: cp({ label: 'Стоимость автомобиля (₽)', testId: 'carPrice' }),
    },

    // ===== Step 2 — personal =====
    personalData: {
      lastName: {
        value: model.$.personalData.lastName,
        component: Input,
        componentProps: cp({ label: 'Фамилия', testId: 'personalData-lastName' }),
      },
      firstName: {
        value: model.$.personalData.firstName,
        component: Input,
        componentProps: cp({ label: 'Имя', testId: 'personalData-firstName' }),
      },
      middleName: {
        value: model.$.personalData.middleName,
        component: Input,
        componentProps: cp({ label: 'Отчество', testId: 'personalData-middleName' }),
      },
      birthDate: {
        value: model.$.personalData.birthDate,
        component: Input,
        componentProps: cp({
          label: 'Дата рождения',
          testId: 'personalData-birthDate',
          type: 'date',
        }),
      },
      gender: {
        value: model.$.personalData.gender,
        component: RadioGroupOptions,
        componentProps: cp({
          label: 'Пол',
          testId: 'personalData-gender',
          options: GENDER_OPTIONS,
        }),
      },
      birthPlace: {
        value: model.$.personalData.birthPlace,
        component: Input,
        componentProps: cp({ label: 'Место рождения', testId: 'personalData-birthPlace' }),
      },
    },
    passportData: {
      series: {
        value: model.$.passportData.series,
        component: InputMask,
        componentProps: cp({
          label: 'Серия паспорта',
          testId: 'passportData-series',
          mask: '99 99',
        }),
      },
      number: {
        value: model.$.passportData.number,
        component: InputMask,
        componentProps: cp({
          label: 'Номер паспорта',
          testId: 'passportData-number',
          mask: '999999',
        }),
      },
      issueDate: {
        value: model.$.passportData.issueDate,
        component: Input,
        componentProps: cp({
          label: 'Дата выдачи',
          testId: 'passportData-issueDate',
          type: 'date',
        }),
      },
      issuedBy: {
        value: model.$.passportData.issuedBy,
        component: Input,
        componentProps: cp({ label: 'Кем выдан', testId: 'passportData-issuedBy' }),
      },
      departmentCode: {
        value: model.$.passportData.departmentCode,
        component: InputMask,
        componentProps: cp({
          label: 'Код подразделения',
          testId: 'passportData-departmentCode',
          mask: '999-999',
        }),
      },
    },
    inn: {
      value: model.$.inn,
      component: InputMask,
      componentProps: cp({ label: 'ИНН', testId: 'inn', mask: '999999999999' }),
    },
    snils: {
      value: model.$.snils,
      component: InputMask,
      componentProps: cp({ label: 'СНИЛС', testId: 'snils', mask: '999-999-999 99' }),
    },

    // ===== Step 3 — contacts =====
    phoneMain: {
      value: model.$.phoneMain,
      component: InputMask,
      componentProps: cp({
        label: 'Основной телефон',
        testId: 'phoneMain',
        mask: '+7 (999) 999-99-99',
      }),
    },
    phoneAdditional: {
      value: model.$.phoneAdditional,
      component: InputMask,
      componentProps: cp({
        label: 'Дополнительный телефон',
        testId: 'phoneAdditional',
        mask: '+7 (999) 999-99-99',
      }),
    },
    email: {
      value: model.$.email,
      component: Input,
      componentProps: cp({ label: 'Email', testId: 'email', type: 'email' }),
    },
    emailAdditional: {
      value: model.$.emailAdditional,
      component: Input,
      componentProps: cp({
        label: 'Дополнительный email',
        testId: 'emailAdditional',
        type: 'email',
      }),
    },
    sameEmail: {
      value: model.$.sameEmail,
      component: CheckboxWithLabel,
      componentProps: cp({
        label: 'Дополнительный email совпадает с основным',
        testId: 'sameEmail',
      }),
    },
    registrationAddress: {
      region: {
        value: model.$.registrationAddress.region,
        component: SelectAsync,
        componentProps: cp({
          label: 'Регион',
          testId: 'registrationAddress-region',
          options: REGION_OPTIONS,
        }),
      },
      city: {
        value: model.$.registrationAddress.city,
        component: SelectAsync,
        componentProps: cp({ label: 'Город', testId: 'registrationAddress-city', options: [] }),
      },
      street: {
        value: model.$.registrationAddress.street,
        component: Input,
        componentProps: cp({ label: 'Улица', testId: 'registrationAddress-street' }),
      },
      house: {
        value: model.$.registrationAddress.house,
        component: Input,
        componentProps: cp({ label: 'Дом', testId: 'registrationAddress-house' }),
      },
      apartment: {
        value: model.$.registrationAddress.apartment,
        component: Input,
        componentProps: cp({ label: 'Квартира', testId: 'registrationAddress-apartment' }),
      },
      postalCode: {
        value: model.$.registrationAddress.postalCode,
        component: InputMask,
        componentProps: cp({
          label: 'Индекс',
          testId: 'registrationAddress-postalCode',
          mask: '999999',
        }),
      },
    },
    sameAsRegistration: {
      value: model.$.sameAsRegistration,
      component: CheckboxWithLabel,
      componentProps: cp({
        label: 'Адрес проживания совпадает с адресом регистрации',
        testId: 'sameAsRegistration',
      }),
    },
    residenceAddress: {
      region: {
        value: model.$.residenceAddress.region,
        component: SelectAsync,
        componentProps: cp({
          label: 'Регион',
          testId: 'residenceAddress-region',
          options: REGION_OPTIONS,
        }),
      },
      city: {
        value: model.$.residenceAddress.city,
        component: SelectAsync,
        componentProps: cp({ label: 'Город', testId: 'residenceAddress-city', options: [] }),
      },
      street: {
        value: model.$.residenceAddress.street,
        component: Input,
        componentProps: cp({ label: 'Улица', testId: 'residenceAddress-street' }),
      },
      house: {
        value: model.$.residenceAddress.house,
        component: Input,
        componentProps: cp({ label: 'Дом', testId: 'residenceAddress-house' }),
      },
      apartment: {
        value: model.$.residenceAddress.apartment,
        component: Input,
        componentProps: cp({ label: 'Квартира', testId: 'residenceAddress-apartment' }),
      },
      postalCode: {
        value: model.$.residenceAddress.postalCode,
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
      value: model.$.employmentStatus,
      component: RadioGroupOptions,
      componentProps: cp({
        label: 'Статус занятости',
        testId: 'employmentStatus',
        options: EMPLOYMENT_STATUS_OPTIONS,
      }),
    },
    companyName: {
      value: model.$.companyName,
      component: Input,
      componentProps: cp({ label: 'Название компании', testId: 'companyName' }),
    },
    companyInn: {
      value: model.$.companyInn,
      component: InputMask,
      componentProps: cp({ label: 'ИНН компании', testId: 'companyInn', mask: '9999999999' }),
    },
    companyPhone: {
      value: model.$.companyPhone,
      component: InputMask,
      componentProps: cp({
        label: 'Телефон компании',
        testId: 'companyPhone',
        mask: '+7 (999) 999-99-99',
      }),
    },
    companyAddress: {
      value: model.$.companyAddress,
      component: Input,
      componentProps: cp({ label: 'Адрес компании', testId: 'companyAddress' }),
    },
    position: {
      value: model.$.position,
      component: Input,
      componentProps: cp({ label: 'Должность', testId: 'position' }),
    },
    workExperienceTotal: {
      value: model.$.workExperienceTotal,
      component: InputNumber,
      componentProps: cp({
        label: 'Общий стаж (месяцев)',
        testId: 'workExperienceTotal',
      }),
    },
    workExperienceCurrent: {
      value: model.$.workExperienceCurrent,
      component: InputNumber,
      componentProps: cp({
        label: 'Стаж на текущем месте (месяцев)',
        testId: 'workExperienceCurrent',
      }),
    },
    monthlyIncome: {
      value: model.$.monthlyIncome,
      component: InputNumber,
      componentProps: cp({
        label: 'Ежемесячный доход (₽)',
        testId: 'monthlyIncome',
      }),
    },
    additionalIncome: {
      value: model.$.additionalIncome,
      component: InputNumber,
      componentProps: cp({
        label: 'Дополнительный доход (₽)',
        testId: 'additionalIncome',
      }),
    },
    additionalIncomeSource: {
      value: model.$.additionalIncomeSource,
      component: Input,
      componentProps: cp({
        label: 'Источник дополнительного дохода',
        testId: 'additionalIncomeSource',
      }),
    },
    businessType: {
      value: model.$.businessType,
      component: Input,
      componentProps: cp({
        label: 'Тип бизнеса',
        testId: 'businessType',
        placeholder: 'ИП, ООО и т.д.',
      }),
    },
    businessInn: {
      value: model.$.businessInn,
      component: InputMask,
      componentProps: cp({ label: 'ИНН ИП', testId: 'businessInn', mask: '999999999999' }),
    },
    businessActivity: {
      value: model.$.businessActivity,
      component: Textarea,
      componentProps: cp({ label: 'Вид деятельности', testId: 'businessActivity' }),
    },

    // ===== Step 5 — additional =====
    maritalStatus: {
      value: model.$.maritalStatus,
      component: RadioGroupOptions,
      componentProps: cp({
        label: 'Семейное положение',
        testId: 'maritalStatus',
        options: MARITAL_STATUS_OPTIONS,
      }),
    },
    dependents: {
      value: model.$.dependents,
      component: InputNumber,
      componentProps: cp({ label: 'Количество иждивенцев', testId: 'dependents' }),
    },
    education: {
      value: model.$.education,
      component: SelectAsync,
      componentProps: cp({ label: 'Образование', testId: 'education', options: EDUCATION_OPTIONS }),
    },
    hasProperty: {
      value: model.$.hasProperty,
      component: CheckboxWithLabel,
      componentProps: cp({ label: 'У меня есть имущество', testId: 'hasProperty' }),
    },
    properties: { array: model.properties, item: propertyItem },
    hasExistingLoans: {
      value: model.$.hasExistingLoans,
      component: CheckboxWithLabel,
      componentProps: cp({ label: 'У меня есть другие кредиты', testId: 'hasExistingLoans' }),
    },
    existingLoans: { array: model.existingLoans, item: existingLoanItem },
    hasCoBorrower: {
      value: model.$.hasCoBorrower,
      component: CheckboxWithLabel,
      componentProps: cp({ label: 'Добавить созаёмщика', testId: 'hasCoBorrower' }),
    },
    coBorrowers: { array: model.coBorrowers, item: coBorrowerItem },

    // ===== Step 6 — confirmation =====
    agreePersonalData: {
      value: model.$.agreePersonalData,
      component: CheckboxWithLabel,
      componentProps: cp({
        label: 'Согласие на обработку персональных данных',
        testId: 'agreePersonalData',
      }),
    },
    agreeCreditHistory: {
      value: model.$.agreeCreditHistory,
      component: CheckboxWithLabel,
      componentProps: cp({
        label: 'Согласие на проверку кредитной истории',
        testId: 'agreeCreditHistory',
      }),
    },
    agreeMarketing: {
      value: model.$.agreeMarketing,
      component: CheckboxWithLabel,
      componentProps: cp({
        label: 'Согласие на получение маркетинговых материалов',
        testId: 'agreeMarketing',
      }),
    },
    agreeTerms: {
      value: model.$.agreeTerms,
      component: CheckboxWithLabel,
      componentProps: cp({ label: 'Согласие с условиями кредитования', testId: 'agreeTerms' }),
    },
    confirmAccuracy: {
      value: model.$.confirmAccuracy,
      component: CheckboxWithLabel,
      componentProps: cp({
        label: 'Подтверждаю точность введённых данных',
        testId: 'confirmAccuracy',
      }),
    },
    electronicSignature: {
      value: model.$.electronicSignature,
      component: InputMask,
      componentProps: cp({
        label: 'Код подтверждения из СМС',
        testId: 'electronicSignature',
        mask: '999999',
      }),
    },

    // ===== Computed (readonly) =====
    interestRate: {
      value: model.$.interestRate,
      component: InputNumber,
      componentProps: roProps({
        label: 'Процентная ставка (%)',
        testId: 'interestRate',
      }),
    },
    monthlyPayment: {
      value: model.$.monthlyPayment,
      component: InputNumber,
      componentProps: roProps({
        label: 'Ежемесячный платёж (₽)',
        testId: 'monthlyPayment',
      }),
    },
    fullName: {
      value: model.$.fullName,
      component: Input,
      componentProps: roProps({ label: 'Полное имя', testId: 'fullName' }),
    },
    age: {
      value: model.$.age,
      component: InputNumber,
      componentProps: roProps({ label: 'Возраст (лет)', testId: 'age' }),
    },
    totalIncome: {
      value: model.$.totalIncome,
      component: InputNumber,
      componentProps: roProps({ label: 'Общий доход (₽)', testId: 'totalIncome' }),
    },
    paymentToIncomeRatio: {
      value: model.$.paymentToIncomeRatio,
      component: InputNumber,
      componentProps: roProps({
        label: 'Платёж от дохода (%)',
        testId: 'paymentToIncomeRatio',
      }),
    },
    coBorrowersIncome: {
      value: model.$.coBorrowersIncome,
      component: InputNumber,
      componentProps: roProps({
        label: 'Доход созаёмщиков (₽)',
        testId: 'coBorrowersIncome',
      }),
    },
  };
}
