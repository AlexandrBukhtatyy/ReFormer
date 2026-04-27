import { createForm, type FormProxy } from '@reformer/core';
import { Input, InputMask, Textarea, Checkbox, Select, RadioGroup } from '@reformer/ui-kit';
import type { CreditApplicationForm } from './types';

// ───── Option lists (componentProps options for Select / RadioGroup) ─────

const LOAN_TYPE_OPTIONS = [
  { value: 'consumer', label: 'Потребительский' },
  { value: 'mortgage', label: 'Ипотека' },
  { value: 'auto', label: 'Автокредит' },
  { value: 'business', label: 'Бизнес' },
  { value: 'refinance', label: 'Рефинансирование' },
];

const GENDER_OPTIONS = [
  { value: 'male', label: 'Мужской' },
  { value: 'female', label: 'Женский' },
];

const EMPLOYMENT_STATUS_OPTIONS = [
  { value: 'employed', label: 'Работаю по найму' },
  { value: 'selfEmployed', label: 'Самозанятый / ИП' },
  { value: 'businessOwner', label: 'Владелец бизнеса' },
  { value: 'unemployed', label: 'Безработный' },
  { value: 'retired', label: 'Пенсионер' },
  { value: 'student', label: 'Студент' },
];

const MARITAL_STATUS_OPTIONS = [
  { value: 'single', label: 'Не женат / не замужем' },
  { value: 'married', label: 'В браке' },
  { value: 'divorced', label: 'В разводе' },
  { value: 'widowed', label: 'Вдовец / вдова' },
];

const EDUCATION_OPTIONS = [
  { value: 'secondary', label: 'Среднее' },
  { value: 'specialized', label: 'Среднее специальное' },
  { value: 'higher', label: 'Высшее' },
  { value: 'postgraduate', label: 'Послевузовское' },
];

const PROPERTY_TYPE_OPTIONS = [
  { value: 'apartment', label: 'Квартира' },
  { value: 'house', label: 'Дом' },
  { value: 'land', label: 'Земельный участок' },
  { value: 'commercial', label: 'Коммерческая' },
  { value: 'car', label: 'Автомобиль' },
];

// ───── Schema ─────

// The recursive FormSchema<T> mapped type for a 4-level-deep step-grouped form
// hits TS2589 ("type instantiation excessively deep") — canonical workaround
// per MCP docs is a function-cast on createForm.
export const creditApplicationForm: FormProxy<CreditApplicationForm> = (
  createForm as (config: { form: unknown }) => FormProxy<CreditApplicationForm>
)({
  form: {
    // ===== Step 1. Кредит =====
    step1: {
      loanType: {
        value: 'consumer',
        component: Select,
        componentProps: {
          label: 'Тип кредита',
          options: LOAN_TYPE_OPTIONS,
          placeholder: 'Выберите тип кредита',
        },
      },
      loanAmount: {
        value: null,
        component: Input,
        componentProps: {
          label: 'Сумма кредита (₽)',
          type: 'number',
          placeholder: 'Введите сумму',
        },
      },
      loanTerm: {
        value: 12,
        component: Input,
        componentProps: {
          label: 'Срок кредита (месяцев)',
          type: 'number',
          placeholder: 'Введите срок',
        },
      },
      loanPurpose: {
        value: '',
        component: Textarea,
        componentProps: {
          label: 'Цель кредита',
          placeholder: 'Опишите, на что планируете потратить средства',
          rows: 3,
          maxLength: 500,
        },
      },
      // Mortgage-only
      propertyValue: {
        value: null,
        component: Input,
        componentProps: {
          label: 'Стоимость недвижимости (₽)',
          type: 'number',
          placeholder: 'Введите стоимость',
        },
      },
      initialPayment: {
        value: null,
        component: Input,
        componentProps: {
          label: 'Первоначальный взнос (₽)',
          type: 'number',
          placeholder: 'Вычисляется автоматически',
        },
        disabled: true,
      },
      // Auto-only
      carBrand: {
        value: '',
        component: Input,
        componentProps: { label: 'Марка автомобиля', placeholder: 'Например: Toyota' },
      },
      carModel: {
        value: '',
        component: Input,
        componentProps: { label: 'Модель автомобиля', placeholder: 'Например: Camry' },
      },
      carYear: {
        value: null,
        component: Input,
        componentProps: { label: 'Год выпуска', type: 'number', placeholder: '2020' },
      },
      carPrice: {
        value: null,
        component: Input,
        componentProps: {
          label: 'Стоимость автомобиля (₽)',
          type: 'number',
          placeholder: 'Введите стоимость',
        },
      },
      // Computed
      interestRate: {
        value: null,
        component: Input,
        componentProps: {
          label: 'Процентная ставка (%)',
          type: 'number',
          placeholder: 'Вычисляется автоматически',
        },
        disabled: true,
      },
      monthlyPayment: {
        value: null,
        component: Input,
        componentProps: {
          label: 'Ежемесячный платёж (₽)',
          type: 'number',
          placeholder: 'Вычисляется автоматически',
        },
        disabled: true,
      },
    },

    // ===== Step 2. Личные данные =====
    step2: {
      personalData: {
        lastName: {
          value: '',
          component: Input,
          componentProps: { label: 'Фамилия', placeholder: 'Введите фамилию' },
        },
        firstName: {
          value: '',
          component: Input,
          componentProps: { label: 'Имя', placeholder: 'Введите имя' },
        },
        middleName: {
          value: '',
          component: Input,
          componentProps: { label: 'Отчество', placeholder: 'Введите отчество' },
        },
        birthDate: {
          value: '',
          component: Input,
          componentProps: { label: 'Дата рождения', type: 'date' },
        },
        gender: {
          value: 'male',
          component: RadioGroup,
          componentProps: { label: 'Пол', options: GENDER_OPTIONS, className: '!flex-row gap-6' },
        },
        birthPlace: {
          value: '',
          component: Input,
          componentProps: { label: 'Место рождения', placeholder: 'Введите место рождения' },
        },
      },
      passportData: {
        series: {
          value: '',
          component: InputMask,
          componentProps: { label: 'Серия паспорта', mask: '99 99', placeholder: '12 34' },
        },
        number: {
          value: '',
          component: InputMask,
          componentProps: { label: 'Номер паспорта', mask: '999999', placeholder: '123456' },
        },
        issueDate: {
          value: '',
          component: Input,
          componentProps: { label: 'Дата выдачи', type: 'date' },
        },
        issuedBy: {
          value: '',
          component: Input,
          componentProps: { label: 'Кем выдан', placeholder: 'Введите название органа' },
        },
        departmentCode: {
          value: '',
          component: InputMask,
          componentProps: { label: 'Код подразделения', mask: '999-999', placeholder: '123-456' },
        },
      },
      inn: {
        value: '',
        component: InputMask,
        componentProps: { label: 'ИНН', mask: '999999999999', placeholder: '123456789012' },
      },
      snils: {
        value: '',
        component: InputMask,
        componentProps: { label: 'СНИЛС', mask: '999-999-999 99', placeholder: '123-456-789 00' },
      },
      // Computed
      fullName: {
        value: '',
        component: Input,
        componentProps: { label: 'Полное имя', placeholder: 'Вычисляется автоматически' },
        disabled: true,
      },
      age: {
        value: null,
        component: Input,
        componentProps: {
          label: 'Возраст (лет)',
          type: 'number',
          placeholder: 'Вычисляется автоматически',
        },
        disabled: true,
      },
    },

    // ===== Step 3. Контакты =====
    step3: {
      phoneMain: {
        value: '',
        component: InputMask,
        componentProps: {
          label: 'Основной телефон',
          mask: '+7 (999) 999-99-99',
          placeholder: '+7 (___) ___-__-__',
        },
      },
      phoneAdditional: {
        value: '',
        component: InputMask,
        componentProps: {
          label: 'Дополнительный телефон',
          mask: '+7 (999) 999-99-99',
          placeholder: '+7 (___) ___-__-__',
        },
      },
      email: {
        value: '',
        component: Input,
        componentProps: { label: 'Email', type: 'email', placeholder: 'example@mail.com' },
      },
      emailAdditional: {
        value: '',
        component: Input,
        componentProps: {
          label: 'Дополнительный email',
          type: 'email',
          placeholder: 'example@mail.com',
        },
      },
      registrationAddress: {
        region: {
          value: '',
          component: Input,
          componentProps: { label: 'Регион', placeholder: 'Введите регион' },
        },
        city: {
          value: '',
          component: Input,
          componentProps: { label: 'Город', placeholder: 'Введите город' },
        },
        street: {
          value: '',
          component: Input,
          componentProps: { label: 'Улица', placeholder: 'Введите улицу' },
        },
        house: { value: '', component: Input, componentProps: { label: 'Дом', placeholder: '№' } },
        apartment: {
          value: '',
          component: Input,
          componentProps: { label: 'Квартира', placeholder: '№' },
        },
        postalCode: {
          value: '',
          component: InputMask,
          componentProps: { label: 'Индекс', mask: '999999', placeholder: '000000' },
        },
      },
      sameAsRegistration: {
        value: true,
        component: Checkbox,
        componentProps: { label: 'Адрес проживания совпадает с адресом регистрации' },
      },
      residenceAddress: {
        region: {
          value: '',
          component: Input,
          componentProps: { label: 'Регион', placeholder: 'Введите регион' },
        },
        city: {
          value: '',
          component: Input,
          componentProps: { label: 'Город', placeholder: 'Введите город' },
        },
        street: {
          value: '',
          component: Input,
          componentProps: { label: 'Улица', placeholder: 'Введите улицу' },
        },
        house: { value: '', component: Input, componentProps: { label: 'Дом', placeholder: '№' } },
        apartment: {
          value: '',
          component: Input,
          componentProps: { label: 'Квартира', placeholder: '№' },
        },
        postalCode: {
          value: '',
          component: InputMask,
          componentProps: { label: 'Индекс', mask: '999999', placeholder: '000000' },
        },
      },
    },

    // ===== Step 4. Занятость =====
    step4: {
      employmentStatus: {
        value: 'employed',
        component: Select,
        componentProps: {
          label: 'Статус занятости',
          options: EMPLOYMENT_STATUS_OPTIONS,
          placeholder: 'Выберите статус',
        },
      },
      companyName: {
        value: '',
        component: Input,
        componentProps: { label: 'Название компании', placeholder: 'Введите название' },
      },
      companyInn: {
        value: '',
        component: InputMask,
        componentProps: { label: 'ИНН компании', mask: '9999999999', placeholder: '1234567890' },
      },
      companyPhone: {
        value: '',
        component: InputMask,
        componentProps: {
          label: 'Телефон компании',
          mask: '+7 (999) 999-99-99',
          placeholder: '+7 (___) ___-__-__',
        },
      },
      companyAddress: {
        value: '',
        component: Input,
        componentProps: { label: 'Адрес компании', placeholder: 'Полный адрес' },
      },
      position: {
        value: '',
        component: Input,
        componentProps: { label: 'Должность', placeholder: 'Ваша должность' },
      },
      workExperienceTotal: {
        value: null,
        component: Input,
        componentProps: { label: 'Общий стаж работы (месяцев)', type: 'number', placeholder: '0' },
      },
      workExperienceCurrent: {
        value: null,
        component: Input,
        componentProps: {
          label: 'Стаж на текущем месте (месяцев)',
          type: 'number',
          placeholder: '0',
        },
      },
      monthlyIncome: {
        value: null,
        component: Input,
        componentProps: { label: 'Ежемесячный доход (₽)', type: 'number', placeholder: '0' },
      },
      additionalIncome: {
        value: null,
        component: Input,
        componentProps: { label: 'Дополнительный доход (₽)', type: 'number', placeholder: '0' },
      },
      additionalIncomeSource: {
        value: '',
        component: Input,
        componentProps: {
          label: 'Источник дополнительного дохода',
          placeholder: 'Опишите источник',
        },
      },
      businessType: {
        value: '',
        component: Input,
        componentProps: { label: 'Тип бизнеса', placeholder: 'ИП, ООО и т.д.' },
      },
      businessInn: {
        value: '',
        component: InputMask,
        componentProps: { label: 'ИНН ИП', mask: '999999999999', placeholder: '123456789012' },
      },
      businessActivity: {
        value: '',
        component: Textarea,
        componentProps: {
          label: 'Вид деятельности',
          placeholder: 'Опишите вид деятельности',
          rows: 3,
        },
      },
      // Computed
      totalIncome: {
        value: null,
        component: Input,
        componentProps: {
          label: 'Общий доход (₽)',
          type: 'number',
          placeholder: 'Вычисляется автоматически',
        },
        disabled: true,
      },
      paymentToIncomeRatio: {
        value: null,
        component: Input,
        componentProps: {
          label: 'Процент платежа от дохода (%)',
          type: 'number',
          placeholder: 'Вычисляется автоматически',
        },
        disabled: true,
      },
    },

    // ===== Step 5. Дополнительно =====
    step5: {
      maritalStatus: {
        value: 'single',
        component: Select,
        componentProps: {
          label: 'Семейное положение',
          options: MARITAL_STATUS_OPTIONS,
          placeholder: 'Выберите',
        },
      },
      dependents: {
        value: 0,
        component: Input,
        componentProps: { label: 'Количество иждивенцев', type: 'number', placeholder: '0' },
      },
      education: {
        value: 'higher',
        component: Select,
        componentProps: {
          label: 'Образование',
          options: EDUCATION_OPTIONS,
          placeholder: 'Выберите уровень образования',
        },
      },
      hasProperty: {
        value: false,
        component: Checkbox,
        componentProps: { label: 'У меня есть имущество' },
      },
      properties: [
        {
          type: {
            value: 'apartment',
            component: Select,
            componentProps: {
              label: 'Тип имущества',
              options: PROPERTY_TYPE_OPTIONS,
              placeholder: 'Выберите тип',
            },
          },
          description: {
            value: '',
            component: Textarea,
            componentProps: { label: 'Описание', placeholder: 'Опишите имущество', rows: 2 },
          },
          estimatedValue: {
            value: 0,
            component: Input,
            componentProps: { label: 'Оценочная стоимость (₽)', type: 'number', placeholder: '0' },
          },
          hasEncumbrance: {
            value: false,
            component: Checkbox,
            componentProps: { label: 'Имеется обременение (залог)' },
          },
        },
      ],
      hasExistingLoans: {
        value: false,
        component: Checkbox,
        componentProps: { label: 'У меня есть другие кредиты' },
      },
      existingLoans: [
        {
          bank: {
            value: '',
            component: Input,
            componentProps: { label: 'Банк', placeholder: 'Название банка' },
          },
          type: {
            value: '',
            component: Input,
            componentProps: { label: 'Тип кредита', placeholder: 'Тип кредита' },
          },
          amount: {
            value: 0,
            component: Input,
            componentProps: { label: 'Сумма кредита (₽)', type: 'number', placeholder: '0' },
          },
          remainingAmount: {
            value: 0,
            component: Input,
            componentProps: {
              label: 'Остаток задолженности (₽)',
              type: 'number',
              placeholder: '0',
            },
          },
          monthlyPayment: {
            value: 0,
            component: Input,
            componentProps: { label: 'Ежемесячный платёж (₽)', type: 'number', placeholder: '0' },
          },
          maturityDate: {
            value: '',
            component: Input,
            componentProps: { label: 'Дата погашения', type: 'date' },
          },
        },
      ],
      hasCoBorrower: {
        value: false,
        component: Checkbox,
        componentProps: { label: 'Добавить созаемщика' },
      },
      coBorrowers: [
        {
          personalData: {
            lastName: {
              value: '',
              component: Input,
              componentProps: { label: 'Фамилия', placeholder: 'Введите фамилию' },
            },
            firstName: {
              value: '',
              component: Input,
              componentProps: { label: 'Имя', placeholder: 'Введите имя' },
            },
            middleName: {
              value: '',
              component: Input,
              componentProps: { label: 'Отчество', placeholder: 'Введите отчество' },
            },
            birthDate: {
              value: '',
              component: Input,
              componentProps: { label: 'Дата рождения', type: 'date' },
            },
            gender: {
              value: 'male',
              component: RadioGroup,
              componentProps: {
                label: 'Пол',
                options: GENDER_OPTIONS,
                className: '!flex-row gap-6',
              },
            },
            birthPlace: {
              value: '',
              component: Input,
              componentProps: { label: 'Место рождения', placeholder: 'Введите место рождения' },
            },
          },
          phone: {
            value: '',
            component: InputMask,
            componentProps: {
              label: 'Телефон',
              mask: '+7 (999) 999-99-99',
              placeholder: '+7 (___) ___-__-__',
            },
          },
          email: {
            value: '',
            component: Input,
            componentProps: { label: 'Email', type: 'email', placeholder: 'example@mail.com' },
          },
          relationship: {
            value: '',
            component: Input,
            componentProps: { label: 'Родство', placeholder: 'Укажите родство' },
          },
          monthlyIncome: {
            value: 0,
            component: Input,
            componentProps: { label: 'Ежемесячный доход (₽)', type: 'number', placeholder: '0' },
          },
        },
      ],
      // Computed
      coBorrowersIncome: {
        value: null,
        component: Input,
        componentProps: {
          label: 'Доход созаемщиков (₽)',
          type: 'number',
          placeholder: 'Вычисляется автоматически',
        },
        disabled: true,
      },
    },

    // ===== Step 6. Подтверждение =====
    step6: {
      agreePersonalData: {
        value: false,
        component: Checkbox,
        componentProps: { label: 'Согласие на обработку персональных данных' },
      },
      agreeCreditHistory: {
        value: false,
        component: Checkbox,
        componentProps: { label: 'Согласие на проверку кредитной истории' },
      },
      agreeMarketing: {
        value: false,
        component: Checkbox,
        componentProps: { label: 'Согласие на получение маркетинговых материалов' },
      },
      agreeTerms: {
        value: false,
        component: Checkbox,
        componentProps: { label: 'Согласие с условиями кредитования' },
      },
      confirmAccuracy: {
        value: false,
        component: Checkbox,
        componentProps: { label: 'Подтверждаю точность введённых данных' },
      },
      electronicSignature: {
        value: '',
        component: InputMask,
        componentProps: {
          label: 'Код подтверждения из СМС',
          mask: '999999',
          placeholder: '123456',
        },
      },
    },
  },
});
