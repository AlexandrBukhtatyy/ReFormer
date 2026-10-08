// form.schema.ts — FieldConfig tree binding model signals → component/componentProps/testId.
// Schema-driven UI: component + все props объявлены здесь; JSX рендерит <FormField control={...}/>.
// Правила валидации живут в validation.ts и уходят в сборку полем `validation`.
import { type FormModel, type FormSchemaNode } from '@reformer/core';
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

/** Запись «имя → узел, группа полей или массив под-форм». */
type FieldRecord = Record<string, unknown>;

/**
 * Дерево узлов из записи «имя поля → узел». Вложенные узлы сборка читает только из `children`,
 * поэтому запись раскладывается в детей: группа полей — вложенный контейнер, строка массива
 * под-форм — такое же дерево из её записи.
 */
function treeOf(fields: FieldRecord): FormSchemaNode {
  const children = Object.values(fields).map((entry): FormSchemaNode => {
    const node = entry as { model?: unknown; item?: (row: never) => FieldRecord };
    if (node.model === undefined) return treeOf(entry as FieldRecord);
    const { item } = node;
    if (typeof item !== 'function') return entry as FormSchemaNode;
    return { model: node.model, item: (row: never) => treeOf(item(row)) } as FormSchemaNode;
  });
  return { children };
}

/**
 * Строит схему формы. `readOnly=true` (mode='view') делает все поля disabled.
 * Computed-поля (interestRate/monthlyPayment/…) всегда readonly.
 */
export function buildCreditSchema(model: FormModel<CreditForm>, readOnly = false): FormSchemaNode {
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
      model: item.$.type,
      component: SelectAsync,
      componentProps: cp({
        label: 'Тип имущества',
        testId: 'type',
        options: PROPERTY_TYPE_OPTIONS,
      }),
    },
    description: {
      model: item.$.description,
      component: Textarea,
      componentProps: cp({
        label: 'Описание',
        testId: 'description',
        placeholder: 'Опишите имущество',
      }),
    },
    estimatedValue: {
      model: item.$.estimatedValue,
      component: InputNumber,
      componentProps: cp({
        label: 'Оценочная стоимость (₽)',
        testId: 'estimatedValue',
      }),
    },
    hasEncumbrance: {
      model: item.$.hasEncumbrance,
      component: CheckboxWithLabel,
      componentProps: cp({ label: 'Имеется обременение (залог)', testId: 'hasEncumbrance' }),
    },
  });

  const existingLoanItem = (item: FormModel<ExistingLoan>) => ({
    bank: {
      model: item.$.bank,
      component: Input,
      componentProps: cp({ label: 'Банк', testId: 'bank', placeholder: 'Название банка' }),
    },
    type: {
      model: item.$.type,
      component: Input,
      componentProps: cp({ label: 'Тип кредита', testId: 'type', placeholder: 'Тип кредита' }),
    },
    amount: {
      model: item.$.amount,
      component: InputNumber,
      componentProps: cp({ label: 'Сумма кредита (₽)', testId: 'amount' }),
    },
    remainingAmount: {
      model: item.$.remainingAmount,
      component: InputNumber,
      componentProps: cp({
        label: 'Остаток задолженности (₽)',
        testId: 'remainingAmount',
      }),
    },
    monthlyPayment: {
      model: item.$.monthlyPayment,
      component: InputNumber,
      componentProps: cp({
        label: 'Ежемесячный платёж (₽)',
        testId: 'monthlyPayment',
      }),
    },
    maturityDate: {
      model: item.$.maturityDate,
      component: Input,
      componentProps: cp({ label: 'Дата погашения', testId: 'maturityDate', type: 'date' }),
    },
  });

  const coBorrowerItem = (item: FormModel<CoBorrower>) => ({
    personalData: {
      lastName: {
        model: item.$.personalData.lastName,
        component: Input,
        componentProps: cp({ label: 'Фамилия', testId: 'personalData-lastName' }),
      },
      firstName: {
        model: item.$.personalData.firstName,
        component: Input,
        componentProps: cp({ label: 'Имя', testId: 'personalData-firstName' }),
      },
      middleName: {
        model: item.$.personalData.middleName,
        component: Input,
        componentProps: cp({ label: 'Отчество', testId: 'personalData-middleName' }),
      },
      birthDate: {
        model: item.$.personalData.birthDate,
        component: Input,
        componentProps: cp({
          label: 'Дата рождения',
          testId: 'personalData-birthDate',
          type: 'date',
        }),
      },
      gender: {
        model: item.$.personalData.gender,
        component: RadioGroupOptions,
        componentProps: cp({
          label: 'Пол',
          testId: 'personalData-gender',
          options: GENDER_OPTIONS,
        }),
      },
      birthPlace: {
        model: item.$.personalData.birthPlace,
        component: Input,
        componentProps: cp({ label: 'Место рождения', testId: 'personalData-birthPlace' }),
      },
    },
    phone: {
      model: item.$.phone,
      component: InputMask,
      componentProps: cp({ label: 'Телефон', testId: 'phone', mask: '+7 (999) 999-99-99' }),
    },
    email: {
      model: item.$.email,
      component: Input,
      componentProps: cp({ label: 'Email', testId: 'email', type: 'email' }),
    },
    relationship: {
      model: item.$.relationship,
      component: Input,
      componentProps: cp({
        label: 'Родство',
        testId: 'relationship',
        placeholder: 'Укажите родство',
      }),
    },
    monthlyIncome: {
      model: item.$.monthlyIncome,
      component: InputNumber,
      componentProps: cp({
        label: 'Ежемесячный доход (₽)',
        testId: 'monthlyIncome',
      }),
    },
  });

  return treeOf({
    // ===== Step 1 — loan =====
    loanType: {
      model: model.$.loanType,
      component: SelectAsync,
      componentProps: cp({ label: 'Тип кредита', testId: 'loanType', options: LOAN_TYPE_OPTIONS }),
    },
    loanAmount: {
      model: model.$.loanAmount,
      component: InputNumber,
      componentProps: cp({
        label: 'Сумма кредита (₽)',
        testId: 'loanAmount',

        step: 10000,
      }),
    },
    loanTerm: {
      model: model.$.loanTerm,
      component: InputNumber,
      componentProps: cp({ label: 'Срок кредита (месяцев)', testId: 'loanTerm' }),
    },
    loanPurpose: {
      model: model.$.loanPurpose,
      component: Textarea,
      componentProps: cp({ label: 'Цель кредита', testId: 'loanPurpose', maxLength: 500 }),
    },
    propertyValue: {
      model: model.$.propertyValue,
      component: InputNumber,
      componentProps: cp({
        label: 'Стоимость недвижимости (₽)',
        testId: 'propertyValue',
      }),
    },
    initialPayment: {
      model: model.$.initialPayment,
      component: InputNumber,
      componentProps: roProps({
        label: 'Первоначальный взнос (₽)',
        testId: 'initialPayment',
      }),
    },
    carBrand: {
      model: model.$.carBrand,
      component: Input,
      componentProps: cp({
        label: 'Марка автомобиля',
        testId: 'carBrand',
        placeholder: 'Например: Toyota',
      }),
    },
    carModel: {
      model: model.$.carModel,
      component: SelectAsync,
      componentProps: cp({ label: 'Модель автомобиля', testId: 'carModel', options: [] }),
    },
    carYear: {
      model: model.$.carYear,
      component: InputNumber,
      componentProps: cp({ label: 'Год выпуска', testId: 'carYear' }),
    },
    carPrice: {
      model: model.$.carPrice,
      component: InputNumber,
      componentProps: cp({ label: 'Стоимость автомобиля (₽)', testId: 'carPrice' }),
    },

    // ===== Step 2 — personal =====
    personalData: {
      lastName: {
        model: model.$.personalData.lastName,
        component: Input,
        componentProps: cp({ label: 'Фамилия', testId: 'personalData-lastName' }),
      },
      firstName: {
        model: model.$.personalData.firstName,
        component: Input,
        componentProps: cp({ label: 'Имя', testId: 'personalData-firstName' }),
      },
      middleName: {
        model: model.$.personalData.middleName,
        component: Input,
        componentProps: cp({ label: 'Отчество', testId: 'personalData-middleName' }),
      },
      birthDate: {
        model: model.$.personalData.birthDate,
        component: Input,
        componentProps: cp({
          label: 'Дата рождения',
          testId: 'personalData-birthDate',
          type: 'date',
        }),
      },
      gender: {
        model: model.$.personalData.gender,
        component: RadioGroupOptions,
        componentProps: cp({
          label: 'Пол',
          testId: 'personalData-gender',
          options: GENDER_OPTIONS,
        }),
      },
      birthPlace: {
        model: model.$.personalData.birthPlace,
        component: Input,
        componentProps: cp({ label: 'Место рождения', testId: 'personalData-birthPlace' }),
      },
    },
    passportData: {
      series: {
        model: model.$.passportData.series,
        component: InputMask,
        componentProps: cp({
          label: 'Серия паспорта',
          testId: 'passportData-series',
          mask: '99 99',
        }),
      },
      number: {
        model: model.$.passportData.number,
        component: InputMask,
        componentProps: cp({
          label: 'Номер паспорта',
          testId: 'passportData-number',
          mask: '999999',
        }),
      },
      issueDate: {
        model: model.$.passportData.issueDate,
        component: Input,
        componentProps: cp({
          label: 'Дата выдачи',
          testId: 'passportData-issueDate',
          type: 'date',
        }),
      },
      issuedBy: {
        model: model.$.passportData.issuedBy,
        component: Input,
        componentProps: cp({ label: 'Кем выдан', testId: 'passportData-issuedBy' }),
      },
      departmentCode: {
        model: model.$.passportData.departmentCode,
        component: InputMask,
        componentProps: cp({
          label: 'Код подразделения',
          testId: 'passportData-departmentCode',
          mask: '999-999',
        }),
      },
    },
    inn: {
      model: model.$.inn,
      component: InputMask,
      componentProps: cp({ label: 'ИНН', testId: 'inn', mask: '999999999999' }),
    },
    snils: {
      model: model.$.snils,
      component: InputMask,
      componentProps: cp({ label: 'СНИЛС', testId: 'snils', mask: '999-999-999 99' }),
    },

    // ===== Step 3 — contacts =====
    phoneMain: {
      model: model.$.phoneMain,
      component: InputMask,
      componentProps: cp({
        label: 'Основной телефон',
        testId: 'phoneMain',
        mask: '+7 (999) 999-99-99',
      }),
    },
    phoneAdditional: {
      model: model.$.phoneAdditional,
      component: InputMask,
      componentProps: cp({
        label: 'Дополнительный телефон',
        testId: 'phoneAdditional',
        mask: '+7 (999) 999-99-99',
      }),
    },
    email: {
      model: model.$.email,
      component: Input,
      componentProps: cp({ label: 'Email', testId: 'email', type: 'email' }),
    },
    emailAdditional: {
      model: model.$.emailAdditional,
      component: Input,
      componentProps: cp({
        label: 'Дополнительный email',
        testId: 'emailAdditional',
        type: 'email',
      }),
    },
    sameEmail: {
      model: model.$.sameEmail,
      component: CheckboxWithLabel,
      componentProps: cp({
        label: 'Дополнительный email совпадает с основным',
        testId: 'sameEmail',
      }),
    },
    registrationAddress: {
      region: {
        model: model.$.registrationAddress.region,
        component: SelectAsync,
        componentProps: cp({
          label: 'Регион',
          testId: 'registrationAddress-region',
          options: REGION_OPTIONS,
        }),
      },
      city: {
        model: model.$.registrationAddress.city,
        component: SelectAsync,
        componentProps: cp({ label: 'Город', testId: 'registrationAddress-city', options: [] }),
      },
      street: {
        model: model.$.registrationAddress.street,
        component: Input,
        componentProps: cp({ label: 'Улица', testId: 'registrationAddress-street' }),
      },
      house: {
        model: model.$.registrationAddress.house,
        component: Input,
        componentProps: cp({ label: 'Дом', testId: 'registrationAddress-house' }),
      },
      apartment: {
        model: model.$.registrationAddress.apartment,
        component: Input,
        componentProps: cp({ label: 'Квартира', testId: 'registrationAddress-apartment' }),
      },
      postalCode: {
        model: model.$.registrationAddress.postalCode,
        component: InputMask,
        componentProps: cp({
          label: 'Индекс',
          testId: 'registrationAddress-postalCode',
          mask: '999999',
        }),
      },
    },
    sameAsRegistration: {
      model: model.$.sameAsRegistration,
      component: CheckboxWithLabel,
      componentProps: cp({
        label: 'Адрес проживания совпадает с адресом регистрации',
        testId: 'sameAsRegistration',
      }),
    },
    residenceAddress: {
      region: {
        model: model.$.residenceAddress.region,
        component: SelectAsync,
        componentProps: cp({
          label: 'Регион',
          testId: 'residenceAddress-region',
          options: REGION_OPTIONS,
        }),
      },
      city: {
        model: model.$.residenceAddress.city,
        component: SelectAsync,
        componentProps: cp({ label: 'Город', testId: 'residenceAddress-city', options: [] }),
      },
      street: {
        model: model.$.residenceAddress.street,
        component: Input,
        componentProps: cp({ label: 'Улица', testId: 'residenceAddress-street' }),
      },
      house: {
        model: model.$.residenceAddress.house,
        component: Input,
        componentProps: cp({ label: 'Дом', testId: 'residenceAddress-house' }),
      },
      apartment: {
        model: model.$.residenceAddress.apartment,
        component: Input,
        componentProps: cp({ label: 'Квартира', testId: 'residenceAddress-apartment' }),
      },
      postalCode: {
        model: model.$.residenceAddress.postalCode,
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
      model: model.$.employmentStatus,
      component: RadioGroupOptions,
      componentProps: cp({
        label: 'Статус занятости',
        testId: 'employmentStatus',
        options: EMPLOYMENT_STATUS_OPTIONS,
      }),
    },
    companyName: {
      model: model.$.companyName,
      component: Input,
      componentProps: cp({ label: 'Название компании', testId: 'companyName' }),
    },
    companyInn: {
      model: model.$.companyInn,
      component: InputMask,
      componentProps: cp({ label: 'ИНН компании', testId: 'companyInn', mask: '9999999999' }),
    },
    companyPhone: {
      model: model.$.companyPhone,
      component: InputMask,
      componentProps: cp({
        label: 'Телефон компании',
        testId: 'companyPhone',
        mask: '+7 (999) 999-99-99',
      }),
    },
    companyAddress: {
      model: model.$.companyAddress,
      component: Input,
      componentProps: cp({ label: 'Адрес компании', testId: 'companyAddress' }),
    },
    position: {
      model: model.$.position,
      component: Input,
      componentProps: cp({ label: 'Должность', testId: 'position' }),
    },
    workExperienceTotal: {
      model: model.$.workExperienceTotal,
      component: InputNumber,
      componentProps: cp({
        label: 'Общий стаж (месяцев)',
        testId: 'workExperienceTotal',
      }),
    },
    workExperienceCurrent: {
      model: model.$.workExperienceCurrent,
      component: InputNumber,
      componentProps: cp({
        label: 'Стаж на текущем месте (месяцев)',
        testId: 'workExperienceCurrent',
      }),
    },
    monthlyIncome: {
      model: model.$.monthlyIncome,
      component: InputNumber,
      componentProps: cp({
        label: 'Ежемесячный доход (₽)',
        testId: 'monthlyIncome',
      }),
    },
    additionalIncome: {
      model: model.$.additionalIncome,
      component: InputNumber,
      componentProps: cp({
        label: 'Дополнительный доход (₽)',
        testId: 'additionalIncome',
      }),
    },
    additionalIncomeSource: {
      model: model.$.additionalIncomeSource,
      component: Input,
      componentProps: cp({
        label: 'Источник дополнительного дохода',
        testId: 'additionalIncomeSource',
      }),
    },
    businessType: {
      model: model.$.businessType,
      component: Input,
      componentProps: cp({
        label: 'Тип бизнеса',
        testId: 'businessType',
        placeholder: 'ИП, ООО и т.д.',
      }),
    },
    businessInn: {
      model: model.$.businessInn,
      component: InputMask,
      componentProps: cp({ label: 'ИНН ИП', testId: 'businessInn', mask: '999999999999' }),
    },
    businessActivity: {
      model: model.$.businessActivity,
      component: Textarea,
      componentProps: cp({ label: 'Вид деятельности', testId: 'businessActivity' }),
    },

    // ===== Step 5 — additional =====
    maritalStatus: {
      model: model.$.maritalStatus,
      component: RadioGroupOptions,
      componentProps: cp({
        label: 'Семейное положение',
        testId: 'maritalStatus',
        options: MARITAL_STATUS_OPTIONS,
      }),
    },
    dependents: {
      model: model.$.dependents,
      component: InputNumber,
      componentProps: cp({ label: 'Количество иждивенцев', testId: 'dependents' }),
    },
    education: {
      model: model.$.education,
      component: SelectAsync,
      componentProps: cp({ label: 'Образование', testId: 'education', options: EDUCATION_OPTIONS }),
    },
    hasProperty: {
      model: model.$.hasProperty,
      component: CheckboxWithLabel,
      componentProps: cp({ label: 'У меня есть имущество', testId: 'hasProperty' }),
    },
    properties: { model: model.$.properties, item: propertyItem },
    hasExistingLoans: {
      model: model.$.hasExistingLoans,
      component: CheckboxWithLabel,
      componentProps: cp({ label: 'У меня есть другие кредиты', testId: 'hasExistingLoans' }),
    },
    existingLoans: { model: model.$.existingLoans, item: existingLoanItem },
    hasCoBorrower: {
      model: model.$.hasCoBorrower,
      component: CheckboxWithLabel,
      componentProps: cp({ label: 'Добавить созаёмщика', testId: 'hasCoBorrower' }),
    },
    coBorrowers: { model: model.$.coBorrowers, item: coBorrowerItem },

    // ===== Step 6 — confirmation =====
    agreePersonalData: {
      model: model.$.agreePersonalData,
      component: CheckboxWithLabel,
      componentProps: cp({
        label: 'Согласие на обработку персональных данных',
        testId: 'agreePersonalData',
      }),
    },
    agreeCreditHistory: {
      model: model.$.agreeCreditHistory,
      component: CheckboxWithLabel,
      componentProps: cp({
        label: 'Согласие на проверку кредитной истории',
        testId: 'agreeCreditHistory',
      }),
    },
    agreeMarketing: {
      model: model.$.agreeMarketing,
      component: CheckboxWithLabel,
      componentProps: cp({
        label: 'Согласие на получение маркетинговых материалов',
        testId: 'agreeMarketing',
      }),
    },
    agreeTerms: {
      model: model.$.agreeTerms,
      component: CheckboxWithLabel,
      componentProps: cp({ label: 'Согласие с условиями кредитования', testId: 'agreeTerms' }),
    },
    confirmAccuracy: {
      model: model.$.confirmAccuracy,
      component: CheckboxWithLabel,
      componentProps: cp({
        label: 'Подтверждаю точность введённых данных',
        testId: 'confirmAccuracy',
      }),
    },
    electronicSignature: {
      model: model.$.electronicSignature,
      component: InputMask,
      componentProps: cp({
        label: 'Код подтверждения из СМС',
        testId: 'electronicSignature',
        mask: '999999',
      }),
    },

    // ===== Computed (readonly) =====
    interestRate: {
      model: model.$.interestRate,
      component: InputNumber,
      componentProps: roProps({
        label: 'Процентная ставка (%)',
        testId: 'interestRate',
      }),
    },
    monthlyPayment: {
      model: model.$.monthlyPayment,
      component: InputNumber,
      componentProps: roProps({
        label: 'Ежемесячный платёж (₽)',
        testId: 'monthlyPayment',
      }),
    },
    fullName: {
      model: model.$.fullName,
      component: Input,
      componentProps: roProps({ label: 'Полное имя', testId: 'fullName' }),
    },
    age: {
      model: model.$.age,
      component: InputNumber,
      componentProps: roProps({ label: 'Возраст (лет)', testId: 'age' }),
    },
    totalIncome: {
      model: model.$.totalIncome,
      component: InputNumber,
      componentProps: roProps({ label: 'Общий доход (₽)', testId: 'totalIncome' }),
    },
    paymentToIncomeRatio: {
      model: model.$.paymentToIncomeRatio,
      component: InputNumber,
      componentProps: roProps({
        label: 'Платёж от дохода (%)',
        testId: 'paymentToIncomeRatio',
      }),
    },
    coBorrowersIncome: {
      model: model.$.coBorrowersIncome,
      component: InputNumber,
      componentProps: roProps({
        label: 'Доход созаёмщиков (₽)',
        testId: 'coBorrowersIncome',
      }),
    },
  });
}
