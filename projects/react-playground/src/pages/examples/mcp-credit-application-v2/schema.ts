import { createForm, type FormProxy } from '@reformer/core';
import {
  required,
  min,
  max,
  minLength,
  email,
  pattern,
  validate,
  applyWhen,
  validateItems,
} from '@reformer/core/validators';
import { Input, InputMask, Textarea, Checkbox, Select, RadioGroup } from '@reformer/ui-kit';
import type { CreditApplicationForm } from './types';

const CURRENT_YEAR = new Date().getFullYear();

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
// per MCP docs is a function-cast on createForm with `validation: unknown`.
export const creditApplicationForm: FormProxy<CreditApplicationForm> = (
  createForm as (config: { form: unknown; validation: unknown }) => FormProxy<CreditApplicationForm>
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  validation: (path: any) => {
    // ===== Step 1. Кредит =====
    required(path.step1.loanAmount, { message: 'Введите сумму кредита' });
    min(path.step1.loanAmount, 50000, { message: 'Минимальная сумма — 50 000 ₽' });

    required(path.step1.loanTerm, { message: 'Введите срок кредита' });
    min(path.step1.loanTerm, 6, { message: 'Минимальный срок — 6 месяцев' });
    max(path.step1.loanTerm, 360, { message: 'Максимальный срок — 360 месяцев' });

    // Loan-type-conditional validation
    applyWhen(
      path.step1.loanType,
      (value: string) => value === 'consumer',
      (p: typeof path) => {
        required(p.step1.loanPurpose, { message: 'Опишите цель кредита' });
        minLength(p.step1.loanPurpose, 10, {
          message: 'Описание цели должно быть не короче 10 символов',
        });
      }
    );

    applyWhen(
      path.step1.loanType,
      (value: string) => value === 'mortgage',
      (p: typeof path) => {
        required(p.step1.propertyValue, { message: 'Введите стоимость недвижимости' });
        min(p.step1.propertyValue, 500000, {
          message: 'Минимальная стоимость недвижимости — 500 000 ₽',
        });
      }
    );

    applyWhen(
      path.step1.loanType,
      (value: string) => value === 'auto',
      (p: typeof path) => {
        required(p.step1.carBrand, { message: 'Введите марку автомобиля' });
        required(p.step1.carModel, { message: 'Введите модель автомобиля' });
        required(p.step1.carYear, { message: 'Введите год выпуска' });
        min(p.step1.carYear, 2000, { message: 'Год выпуска не ранее 2000' });
        max(p.step1.carYear, CURRENT_YEAR, {
          message: `Год выпуска не позднее ${CURRENT_YEAR}`,
        });
        required(p.step1.carPrice, { message: 'Введите стоимость автомобиля' });
        min(p.step1.carPrice, 100000, { message: 'Минимальная стоимость автомобиля — 100 000 ₽' });
      }
    );

    // ===== Step 2. Личные данные =====
    required(path.step2.personalData.lastName, { message: 'Введите фамилию' });
    minLength(path.step2.personalData.lastName, 2, { message: 'Фамилия минимум 2 символа' });

    required(path.step2.personalData.firstName, { message: 'Введите имя' });
    minLength(path.step2.personalData.firstName, 2, { message: 'Имя минимум 2 символа' });

    required(path.step2.personalData.birthDate, { message: 'Укажите дату рождения' });
    validate(path.step2.personalData.birthDate, (value: string) => {
      if (!value) return null;
      const birth = new Date(value);
      if (Number.isNaN(birth.getTime())) {
        return { code: 'invalid-date', message: 'Некорректная дата' };
      }
      const now = new Date();
      let age = now.getFullYear() - birth.getFullYear();
      const m = now.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
        age -= 1;
      }
      if (age < 18) {
        return { code: 'tooYoung', message: 'Заёмщику должно быть не менее 18 лет' };
      }
      return null;
    });

    required(path.step2.personalData.gender, { message: 'Укажите пол' });
    required(path.step2.personalData.birthPlace, { message: 'Укажите место рождения' });

    required(path.step2.passportData.series, { message: 'Введите серию паспорта' });
    pattern(path.step2.passportData.series, /^\d{2} \d{2}$|^\d{4}$/, {
      message: 'Серия паспорта — 4 цифры',
    });

    required(path.step2.passportData.number, { message: 'Введите номер паспорта' });
    pattern(path.step2.passportData.number, /^\d{6}$/, { message: 'Номер паспорта — 6 цифр' });

    required(path.step2.passportData.issueDate, { message: 'Укажите дату выдачи' });

    required(path.step2.passportData.issuedBy, { message: 'Укажите, кем выдан паспорт' });
    minLength(path.step2.passportData.issuedBy, 5, {
      message: 'Поле «Кем выдан» — минимум 5 символов',
    });

    required(path.step2.passportData.departmentCode, { message: 'Введите код подразделения' });
    pattern(path.step2.passportData.departmentCode, /^\d{3}-\d{3}$/, {
      message: 'Формат: 123-456',
    });

    required(path.step2.inn, { message: 'Введите ИНН' });
    pattern(path.step2.inn, /^\d{12}$/, { message: 'ИНН должен содержать 12 цифр' });

    required(path.step2.snils, { message: 'Введите СНИЛС' });
    pattern(path.step2.snils, /^\d{3}-\d{3}-\d{3} \d{2}$/, {
      message: 'Формат СНИЛС: 123-456-789 00',
    });

    // ===== Step 3. Контакты =====
    required(path.step3.phoneMain, { message: 'Укажите телефон' });
    pattern(path.step3.phoneMain, /^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/, {
      message: 'Формат: +7 (999) 999-99-99',
    });

    required(path.step3.email, { message: 'Укажите email' });
    email(path.step3.email, { message: 'Некорректный email' });

    required(path.step3.registrationAddress.region, { message: 'Укажите регион' });
    required(path.step3.registrationAddress.city, { message: 'Укажите город' });
    required(path.step3.registrationAddress.street, { message: 'Укажите улицу' });
    required(path.step3.registrationAddress.house, { message: 'Укажите дом' });
    required(path.step3.registrationAddress.postalCode, { message: 'Укажите индекс' });
    pattern(path.step3.registrationAddress.postalCode, /^\d{6}$/, {
      message: 'Индекс — 6 цифр',
    });

    // ===== Step 4. Занятость =====
    required(path.step4.employmentStatus, { message: 'Укажите статус занятости' });

    applyWhen(
      path.step4.employmentStatus,
      (value: string) => value === 'employed',
      (p: typeof path) => {
        required(p.step4.companyName, { message: 'Укажите название компании' });
        required(p.step4.companyInn, { message: 'Укажите ИНН компании' });
        pattern(p.step4.companyInn, /^\d{10}$/, { message: 'ИНН компании — 10 цифр' });
        required(p.step4.position, { message: 'Укажите должность' });
        required(p.step4.workExperienceTotal, { message: 'Укажите общий стаж' });
        min(p.step4.workExperienceTotal, 0, { message: 'Стаж не может быть отрицательным' });
        required(p.step4.monthlyIncome, { message: 'Укажите ежемесячный доход' });
        min(p.step4.monthlyIncome, 1, { message: 'Доход должен быть больше 0' });
      }
    );

    applyWhen(
      path.step4.employmentStatus,
      (value: string) => value === 'selfEmployed' || value === 'businessOwner',
      (p: typeof path) => {
        required(p.step4.businessType, { message: 'Укажите тип бизнеса' });
        required(p.step4.businessInn, { message: 'Укажите ИНН ИП / организации' });
        pattern(p.step4.businessInn, /^\d{12}$/, { message: 'ИНН — 12 цифр' });
        required(p.step4.businessActivity, { message: 'Опишите вид деятельности' });
        required(p.step4.monthlyIncome, { message: 'Укажите ежемесячный доход' });
        min(p.step4.monthlyIncome, 1, { message: 'Доход должен быть больше 0' });
      }
    );

    // Cross-field: workExperienceCurrent <= workExperienceTotal
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validate(path.step4.workExperienceCurrent, (value: number | null, ctx: any) => {
      const total = ctx.form.step4.workExperienceTotal.value.value as number | null;
      if (total != null && value != null && value > total) {
        return {
          code: 'experience-mismatch',
          message: 'Стаж на текущем месте не может превышать общий стаж',
        };
      }
      return null;
    });

    // ===== Step 5. Дополнительно =====
    required(path.step5.maritalStatus, { message: 'Укажите семейное положение' });
    required(path.step5.dependents, { message: 'Укажите число иждивенцев' });
    min(path.step5.dependents, 0, { message: 'Число иждивенцев не может быть отрицательным' });
    required(path.step5.education, { message: 'Укажите уровень образования' });

    // FormArray items — basic required-field rules per item, gated by their toggle.
    applyWhen(
      path.step5.hasProperty,
      (value: boolean) => value === true,
      (p: typeof path) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        validateItems(p.step5.properties, (itemPath: any) => {
          required(itemPath.type, { message: 'Укажите тип имущества' });
          required(itemPath.estimatedValue, { message: 'Укажите оценочную стоимость' });
          min(itemPath.estimatedValue, 0, { message: 'Стоимость не может быть отрицательной' });
        });
      }
    );

    applyWhen(
      path.step5.hasExistingLoans,
      (value: boolean) => value === true,
      (p: typeof path) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        validateItems(p.step5.existingLoans, (itemPath: any) => {
          required(itemPath.bank, { message: 'Укажите банк' });
          required(itemPath.amount, { message: 'Укажите сумму кредита' });
          min(itemPath.amount, 0, { message: 'Сумма не может быть отрицательной' });
          required(itemPath.monthlyPayment, { message: 'Укажите ежемесячный платёж' });
          min(itemPath.monthlyPayment, 0, { message: 'Платёж не может быть отрицательным' });
        });
      }
    );

    applyWhen(
      path.step5.hasCoBorrower,
      (value: boolean) => value === true,
      (p: typeof path) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        validateItems(p.step5.coBorrowers, (itemPath: any) => {
          required(itemPath.personalData.lastName, { message: 'Введите фамилию созаемщика' });
          required(itemPath.personalData.firstName, { message: 'Введите имя созаемщика' });
          required(itemPath.phone, { message: 'Введите телефон созаемщика' });
          required(itemPath.relationship, { message: 'Укажите родство' });
        });
      }
    );

    // ===== Step 6. Подтверждение =====
    validate(path.step6.agreePersonalData, (value: boolean) => {
      if (value !== true) {
        return {
          code: 'consent-required',
          message: 'Необходимо согласие на обработку персональных данных',
        };
      }
      return null;
    });

    validate(path.step6.agreeTerms, (value: boolean) => {
      if (value !== true) {
        return {
          code: 'consent-required',
          message: 'Необходимо согласие с условиями кредитования',
        };
      }
      return null;
    });

    validate(path.step6.confirmAccuracy, (value: boolean) => {
      if (value !== true) {
        return { code: 'consent-required', message: 'Подтвердите точность введённых данных' };
      }
      return null;
    });

    required(path.step6.electronicSignature, { message: 'Введите код подтверждения' });
    minLength(path.step6.electronicSignature, 5, { message: 'Код минимум 5 символов' });
  },
});
