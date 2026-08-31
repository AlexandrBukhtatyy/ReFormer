// form.schema.ts — FieldConfig tree binding model signals → component/componentProps/testId.
// Schema-driven UI: component + все props объявлены здесь; JSX рендерит <FormField control={...}/>.
// Валидаторы живут в validation.ts (model-схема, исполняется validateFormModel).
import { type FormModel } from '@reformer/core';
import {
  CheckboxField,
  InputField,
  InputMaskField,
  RadioGroupField,
  SelectField,
  TextareaField,
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
      component: SelectField,
      componentProps: cp({
        label: 'Тип имущества',
        testId: 'type',
        options: PROPERTY_TYPE_OPTIONS,
      }),
    },
    description: {
      value: item.$.description,
      component: TextareaField,
      componentProps: cp({
        label: 'Описание',
        testId: 'description',
        placeholder: 'Опишите имущество',
      }),
    },
    estimatedValue: {
      value: item.$.estimatedValue,
      component: InputField,
      componentProps: cp({
        label: 'Оценочная стоимость (₽)',
        testId: 'estimatedValue',
        type: 'number',
      }),
    },
    hasEncumbrance: {
      value: item.$.hasEncumbrance,
      component: CheckboxField,
      componentProps: cp({ label: 'Имеется обременение (залог)', testId: 'hasEncumbrance' }),
    },
  });

  const existingLoanItem = (item: FormModel<ExistingLoan>) => ({
    bank: {
      value: item.$.bank,
      component: InputField,
      componentProps: cp({ label: 'Банк', testId: 'bank', placeholder: 'Название банка' }),
    },
    type: {
      value: item.$.type,
      component: InputField,
      componentProps: cp({ label: 'Тип кредита', testId: 'type', placeholder: 'Тип кредита' }),
    },
    amount: {
      value: item.$.amount,
      component: InputField,
      componentProps: cp({ label: 'Сумма кредита (₽)', testId: 'amount', type: 'number' }),
    },
    remainingAmount: {
      value: item.$.remainingAmount,
      component: InputField,
      componentProps: cp({
        label: 'Остаток задолженности (₽)',
        testId: 'remainingAmount',
        type: 'number',
      }),
    },
    monthlyPayment: {
      value: item.$.monthlyPayment,
      component: InputField,
      componentProps: cp({
        label: 'Ежемесячный платёж (₽)',
        testId: 'monthlyPayment',
        type: 'number',
      }),
    },
    maturityDate: {
      value: item.$.maturityDate,
      component: InputField,
      componentProps: cp({ label: 'Дата погашения', testId: 'maturityDate', type: 'date' }),
    },
  });

  const coBorrowerItem = (item: FormModel<CoBorrower>) => ({
    personalData: {
      lastName: {
        value: item.$.personalData.lastName,
        component: InputField,
        componentProps: cp({ label: 'Фамилия', testId: 'personalData-lastName' }),
      },
      firstName: {
        value: item.$.personalData.firstName,
        component: InputField,
        componentProps: cp({ label: 'Имя', testId: 'personalData-firstName' }),
      },
      middleName: {
        value: item.$.personalData.middleName,
        component: InputField,
        componentProps: cp({ label: 'Отчество', testId: 'personalData-middleName' }),
      },
      birthDate: {
        value: item.$.personalData.birthDate,
        component: InputField,
        componentProps: cp({
          label: 'Дата рождения',
          testId: 'personalData-birthDate',
          type: 'date',
        }),
      },
      gender: {
        value: item.$.personalData.gender,
        component: RadioGroupField,
        componentProps: cp({
          label: 'Пол',
          testId: 'personalData-gender',
          options: GENDER_OPTIONS,
        }),
      },
      birthPlace: {
        value: item.$.personalData.birthPlace,
        component: InputField,
        componentProps: cp({ label: 'Место рождения', testId: 'personalData-birthPlace' }),
      },
    },
    phone: {
      value: item.$.phone,
      component: InputMaskField,
      componentProps: cp({ label: 'Телефон', testId: 'phone', mask: '+7 (999) 999-99-99' }),
    },
    email: {
      value: item.$.email,
      component: InputField,
      componentProps: cp({ label: 'Email', testId: 'email', type: 'email' }),
    },
    relationship: {
      value: item.$.relationship,
      component: InputField,
      componentProps: cp({
        label: 'Родство',
        testId: 'relationship',
        placeholder: 'Укажите родство',
      }),
    },
    monthlyIncome: {
      value: item.$.monthlyIncome,
      component: InputField,
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
      value: model.$.loanType,
      component: SelectField,
      componentProps: cp({ label: 'Тип кредита', testId: 'loanType', options: LOAN_TYPE_OPTIONS }),
    },
    loanAmount: {
      value: model.$.loanAmount,
      component: InputField,
      componentProps: cp({
        label: 'Сумма кредита (₽)',
        testId: 'loanAmount',
        type: 'number',
        step: 10000,
      }),
    },
    loanTerm: {
      value: model.$.loanTerm,
      component: InputField,
      componentProps: cp({ label: 'Срок кредита (месяцев)', testId: 'loanTerm', type: 'number' }),
    },
    loanPurpose: {
      value: model.$.loanPurpose,
      component: TextareaField,
      componentProps: cp({ label: 'Цель кредита', testId: 'loanPurpose', maxLength: 500 }),
    },
    propertyValue: {
      value: model.$.propertyValue,
      component: InputField,
      componentProps: cp({
        label: 'Стоимость недвижимости (₽)',
        testId: 'propertyValue',
        type: 'number',
      }),
    },
    initialPayment: {
      value: model.$.initialPayment,
      component: InputField,
      componentProps: roProps({
        label: 'Первоначальный взнос (₽)',
        testId: 'initialPayment',
        type: 'number',
      }),
    },
    carBrand: {
      value: model.$.carBrand,
      component: InputField,
      componentProps: cp({
        label: 'Марка автомобиля',
        testId: 'carBrand',
        placeholder: 'Например: Toyota',
      }),
    },
    carModel: {
      value: model.$.carModel,
      component: SelectField,
      componentProps: cp({ label: 'Модель автомобиля', testId: 'carModel', options: [] }),
    },
    carYear: {
      value: model.$.carYear,
      component: InputField,
      componentProps: cp({ label: 'Год выпуска', testId: 'carYear', type: 'number' }),
    },
    carPrice: {
      value: model.$.carPrice,
      component: InputField,
      componentProps: cp({ label: 'Стоимость автомобиля (₽)', testId: 'carPrice', type: 'number' }),
    },

    // ===== Step 2 — personal =====
    personalData: {
      lastName: {
        value: model.$.personalData.lastName,
        component: InputField,
        componentProps: cp({ label: 'Фамилия', testId: 'personalData-lastName' }),
      },
      firstName: {
        value: model.$.personalData.firstName,
        component: InputField,
        componentProps: cp({ label: 'Имя', testId: 'personalData-firstName' }),
      },
      middleName: {
        value: model.$.personalData.middleName,
        component: InputField,
        componentProps: cp({ label: 'Отчество', testId: 'personalData-middleName' }),
      },
      birthDate: {
        value: model.$.personalData.birthDate,
        component: InputField,
        componentProps: cp({
          label: 'Дата рождения',
          testId: 'personalData-birthDate',
          type: 'date',
        }),
      },
      gender: {
        value: model.$.personalData.gender,
        component: RadioGroupField,
        componentProps: cp({
          label: 'Пол',
          testId: 'personalData-gender',
          options: GENDER_OPTIONS,
        }),
      },
      birthPlace: {
        value: model.$.personalData.birthPlace,
        component: InputField,
        componentProps: cp({ label: 'Место рождения', testId: 'personalData-birthPlace' }),
      },
    },
    passportData: {
      series: {
        value: model.$.passportData.series,
        component: InputMaskField,
        componentProps: cp({
          label: 'Серия паспорта',
          testId: 'passportData-series',
          mask: '99 99',
        }),
      },
      number: {
        value: model.$.passportData.number,
        component: InputMaskField,
        componentProps: cp({
          label: 'Номер паспорта',
          testId: 'passportData-number',
          mask: '999999',
        }),
      },
      issueDate: {
        value: model.$.passportData.issueDate,
        component: InputField,
        componentProps: cp({
          label: 'Дата выдачи',
          testId: 'passportData-issueDate',
          type: 'date',
        }),
      },
      issuedBy: {
        value: model.$.passportData.issuedBy,
        component: InputField,
        componentProps: cp({ label: 'Кем выдан', testId: 'passportData-issuedBy' }),
      },
      departmentCode: {
        value: model.$.passportData.departmentCode,
        component: InputMaskField,
        componentProps: cp({
          label: 'Код подразделения',
          testId: 'passportData-departmentCode',
          mask: '999-999',
        }),
      },
    },
    inn: {
      value: model.$.inn,
      component: InputMaskField,
      componentProps: cp({ label: 'ИНН', testId: 'inn', mask: '999999999999' }),
    },
    snils: {
      value: model.$.snils,
      component: InputMaskField,
      componentProps: cp({ label: 'СНИЛС', testId: 'snils', mask: '999-999-999 99' }),
    },

    // ===== Step 3 — contacts =====
    phoneMain: {
      value: model.$.phoneMain,
      component: InputMaskField,
      componentProps: cp({
        label: 'Основной телефон',
        testId: 'phoneMain',
        mask: '+7 (999) 999-99-99',
      }),
    },
    phoneAdditional: {
      value: model.$.phoneAdditional,
      component: InputMaskField,
      componentProps: cp({
        label: 'Дополнительный телефон',
        testId: 'phoneAdditional',
        mask: '+7 (999) 999-99-99',
      }),
    },
    email: {
      value: model.$.email,
      component: InputField,
      componentProps: cp({ label: 'Email', testId: 'email', type: 'email' }),
    },
    emailAdditional: {
      value: model.$.emailAdditional,
      component: InputField,
      componentProps: cp({
        label: 'Дополнительный email',
        testId: 'emailAdditional',
        type: 'email',
      }),
    },
    sameEmail: {
      value: model.$.sameEmail,
      component: CheckboxField,
      componentProps: cp({
        label: 'Дополнительный email совпадает с основным',
        testId: 'sameEmail',
      }),
    },
    registrationAddress: {
      region: {
        value: model.$.registrationAddress.region,
        component: SelectField,
        componentProps: cp({
          label: 'Регион',
          testId: 'registrationAddress-region',
          options: REGION_OPTIONS,
        }),
      },
      city: {
        value: model.$.registrationAddress.city,
        component: SelectField,
        componentProps: cp({ label: 'Город', testId: 'registrationAddress-city', options: [] }),
      },
      street: {
        value: model.$.registrationAddress.street,
        component: InputField,
        componentProps: cp({ label: 'Улица', testId: 'registrationAddress-street' }),
      },
      house: {
        value: model.$.registrationAddress.house,
        component: InputField,
        componentProps: cp({ label: 'Дом', testId: 'registrationAddress-house' }),
      },
      apartment: {
        value: model.$.registrationAddress.apartment,
        component: InputField,
        componentProps: cp({ label: 'Квартира', testId: 'registrationAddress-apartment' }),
      },
      postalCode: {
        value: model.$.registrationAddress.postalCode,
        component: InputMaskField,
        componentProps: cp({
          label: 'Индекс',
          testId: 'registrationAddress-postalCode',
          mask: '999999',
        }),
      },
    },
    sameAsRegistration: {
      value: model.$.sameAsRegistration,
      component: CheckboxField,
      componentProps: cp({
        label: 'Адрес проживания совпадает с адресом регистрации',
        testId: 'sameAsRegistration',
      }),
    },
    residenceAddress: {
      region: {
        value: model.$.residenceAddress.region,
        component: SelectField,
        componentProps: cp({
          label: 'Регион',
          testId: 'residenceAddress-region',
          options: REGION_OPTIONS,
        }),
      },
      city: {
        value: model.$.residenceAddress.city,
        component: SelectField,
        componentProps: cp({ label: 'Город', testId: 'residenceAddress-city', options: [] }),
      },
      street: {
        value: model.$.residenceAddress.street,
        component: InputField,
        componentProps: cp({ label: 'Улица', testId: 'residenceAddress-street' }),
      },
      house: {
        value: model.$.residenceAddress.house,
        component: InputField,
        componentProps: cp({ label: 'Дом', testId: 'residenceAddress-house' }),
      },
      apartment: {
        value: model.$.residenceAddress.apartment,
        component: InputField,
        componentProps: cp({ label: 'Квартира', testId: 'residenceAddress-apartment' }),
      },
      postalCode: {
        value: model.$.residenceAddress.postalCode,
        component: InputMaskField,
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
      component: RadioGroupField,
      componentProps: cp({
        label: 'Статус занятости',
        testId: 'employmentStatus',
        options: EMPLOYMENT_STATUS_OPTIONS,
      }),
    },
    companyName: {
      value: model.$.companyName,
      component: InputField,
      componentProps: cp({ label: 'Название компании', testId: 'companyName' }),
    },
    companyInn: {
      value: model.$.companyInn,
      component: InputMaskField,
      componentProps: cp({ label: 'ИНН компании', testId: 'companyInn', mask: '9999999999' }),
    },
    companyPhone: {
      value: model.$.companyPhone,
      component: InputMaskField,
      componentProps: cp({
        label: 'Телефон компании',
        testId: 'companyPhone',
        mask: '+7 (999) 999-99-99',
      }),
    },
    companyAddress: {
      value: model.$.companyAddress,
      component: InputField,
      componentProps: cp({ label: 'Адрес компании', testId: 'companyAddress' }),
    },
    position: {
      value: model.$.position,
      component: InputField,
      componentProps: cp({ label: 'Должность', testId: 'position' }),
    },
    workExperienceTotal: {
      value: model.$.workExperienceTotal,
      component: InputField,
      componentProps: cp({
        label: 'Общий стаж (месяцев)',
        testId: 'workExperienceTotal',
        type: 'number',
      }),
    },
    workExperienceCurrent: {
      value: model.$.workExperienceCurrent,
      component: InputField,
      componentProps: cp({
        label: 'Стаж на текущем месте (месяцев)',
        testId: 'workExperienceCurrent',
        type: 'number',
      }),
    },
    monthlyIncome: {
      value: model.$.monthlyIncome,
      component: InputField,
      componentProps: cp({
        label: 'Ежемесячный доход (₽)',
        testId: 'monthlyIncome',
        type: 'number',
      }),
    },
    additionalIncome: {
      value: model.$.additionalIncome,
      component: InputField,
      componentProps: cp({
        label: 'Дополнительный доход (₽)',
        testId: 'additionalIncome',
        type: 'number',
      }),
    },
    additionalIncomeSource: {
      value: model.$.additionalIncomeSource,
      component: InputField,
      componentProps: cp({
        label: 'Источник дополнительного дохода',
        testId: 'additionalIncomeSource',
      }),
    },
    businessType: {
      value: model.$.businessType,
      component: InputField,
      componentProps: cp({
        label: 'Тип бизнеса',
        testId: 'businessType',
        placeholder: 'ИП, ООО и т.д.',
      }),
    },
    businessInn: {
      value: model.$.businessInn,
      component: InputMaskField,
      componentProps: cp({ label: 'ИНН ИП', testId: 'businessInn', mask: '999999999999' }),
    },
    businessActivity: {
      value: model.$.businessActivity,
      component: TextareaField,
      componentProps: cp({ label: 'Вид деятельности', testId: 'businessActivity' }),
    },

    // ===== Step 5 — additional =====
    maritalStatus: {
      value: model.$.maritalStatus,
      component: RadioGroupField,
      componentProps: cp({
        label: 'Семейное положение',
        testId: 'maritalStatus',
        options: MARITAL_STATUS_OPTIONS,
      }),
    },
    dependents: {
      value: model.$.dependents,
      component: InputField,
      componentProps: cp({ label: 'Количество иждивенцев', testId: 'dependents', type: 'number' }),
    },
    education: {
      value: model.$.education,
      component: SelectField,
      componentProps: cp({ label: 'Образование', testId: 'education', options: EDUCATION_OPTIONS }),
    },
    hasProperty: {
      value: model.$.hasProperty,
      component: CheckboxField,
      componentProps: cp({ label: 'У меня есть имущество', testId: 'hasProperty' }),
    },
    properties: { array: model.properties, item: propertyItem },
    hasExistingLoans: {
      value: model.$.hasExistingLoans,
      component: CheckboxField,
      componentProps: cp({ label: 'У меня есть другие кредиты', testId: 'hasExistingLoans' }),
    },
    existingLoans: { array: model.existingLoans, item: existingLoanItem },
    hasCoBorrower: {
      value: model.$.hasCoBorrower,
      component: CheckboxField,
      componentProps: cp({ label: 'Добавить созаёмщика', testId: 'hasCoBorrower' }),
    },
    coBorrowers: { array: model.coBorrowers, item: coBorrowerItem },

    // ===== Step 6 — confirmation =====
    agreePersonalData: {
      value: model.$.agreePersonalData,
      component: CheckboxField,
      componentProps: cp({
        label: 'Согласие на обработку персональных данных',
        testId: 'agreePersonalData',
      }),
    },
    agreeCreditHistory: {
      value: model.$.agreeCreditHistory,
      component: CheckboxField,
      componentProps: cp({
        label: 'Согласие на проверку кредитной истории',
        testId: 'agreeCreditHistory',
      }),
    },
    agreeMarketing: {
      value: model.$.agreeMarketing,
      component: CheckboxField,
      componentProps: cp({
        label: 'Согласие на получение маркетинговых материалов',
        testId: 'agreeMarketing',
      }),
    },
    agreeTerms: {
      value: model.$.agreeTerms,
      component: CheckboxField,
      componentProps: cp({ label: 'Согласие с условиями кредитования', testId: 'agreeTerms' }),
    },
    confirmAccuracy: {
      value: model.$.confirmAccuracy,
      component: CheckboxField,
      componentProps: cp({
        label: 'Подтверждаю точность введённых данных',
        testId: 'confirmAccuracy',
      }),
    },
    electronicSignature: {
      value: model.$.electronicSignature,
      component: InputMaskField,
      componentProps: cp({
        label: 'Код подтверждения из СМС',
        testId: 'electronicSignature',
        mask: '999999',
      }),
    },

    // ===== Computed (readonly) =====
    interestRate: {
      value: model.$.interestRate,
      component: InputField,
      componentProps: roProps({
        label: 'Процентная ставка (%)',
        testId: 'interestRate',
        type: 'number',
      }),
    },
    monthlyPayment: {
      value: model.$.monthlyPayment,
      component: InputField,
      componentProps: roProps({
        label: 'Ежемесячный платёж (₽)',
        testId: 'monthlyPayment',
        type: 'number',
      }),
    },
    fullName: {
      value: model.$.fullName,
      component: InputField,
      componentProps: roProps({ label: 'Полное имя', testId: 'fullName' }),
    },
    age: {
      value: model.$.age,
      component: InputField,
      componentProps: roProps({ label: 'Возраст (лет)', testId: 'age', type: 'number' }),
    },
    totalIncome: {
      value: model.$.totalIncome,
      component: InputField,
      componentProps: roProps({ label: 'Общий доход (₽)', testId: 'totalIncome', type: 'number' }),
    },
    paymentToIncomeRatio: {
      value: model.$.paymentToIncomeRatio,
      component: InputField,
      componentProps: roProps({
        label: 'Платёж от дохода (%)',
        testId: 'paymentToIncomeRatio',
        type: 'number',
      }),
    },
    coBorrowersIncome: {
      value: model.$.coBorrowersIncome,
      component: InputField,
      componentProps: roProps({
        label: 'Доход созаёмщиков (₽)',
        testId: 'coBorrowersIncome',
        type: 'number',
      }),
    },
  };
}
