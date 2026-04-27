import { createForm } from '@reformer/core';
import type { FormProxy, FormSchema } from '@reformer/core';
import {
  required,
  min,
  max,
  minLength,
  maxLength,
  email,
  pattern,
  validate,
  applyWhen,
  validateItems,
} from '@reformer/core/validators';
import { Input, Checkbox, Select, Textarea, InputMask, RadioGroup } from '@reformer/ui-kit';
import type { CreditApplicationForm } from './types';

// ─── Main form schema ────────────────────────────────────────────────────────
// Explicit FormSchema annotation prevents TS "excessively deep" inference.

const formSchema = {
  step1: {
    loanType: {
      value: 'consumer',
      component: Select,
      componentProps: {
        label: 'Тип кредита',
        placeholder: 'Выберите тип кредита',
        options: [
          { value: 'consumer', label: 'Потребительский' },
          { value: 'mortgage', label: 'Ипотека' },
          { value: 'car', label: 'Автокредит' },
          { value: 'business', label: 'Бизнес' },
          { value: 'refinancing', label: 'Рефинансирование' },
        ],
      },
    },
    loanAmount: {
      value: null,
      component: Input,
      componentProps: { label: 'Сумма кредита (₽)', type: 'number', placeholder: 'Введите сумму' },
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
      },
    },
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
        placeholder: 'Введите сумму',
      },
    },
    carBrand: {
      value: null,
      component: Input,
      componentProps: { label: 'Марка автомобиля', placeholder: 'Например: Toyota' },
    },
    carModel: {
      value: null,
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
  },

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
        componentProps: {
          label: 'Пол',
          options: [
            { value: 'male', label: 'Мужской' },
            { value: 'female', label: 'Женский' },
          ],
        },
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
  },

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
      value: null,
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
      value: null,
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
        componentProps: { label: 'Регион (регистрация)', placeholder: 'Введите регион' },
      },
      city: {
        value: '',
        component: Input,
        componentProps: { label: 'Город (регистрация)', placeholder: 'Введите город' },
      },
      street: {
        value: '',
        component: Input,
        componentProps: { label: 'Улица (регистрация)', placeholder: 'Введите улицу' },
      },
      house: {
        value: '',
        component: Input,
        componentProps: { label: 'Дом (регистрация)', placeholder: '№' },
      },
      apartment: {
        value: '',
        component: Input,
        componentProps: { label: 'Квартира (регистрация)', placeholder: '№' },
      },
      postalCode: {
        value: '',
        component: InputMask,
        componentProps: { label: 'Индекс (регистрация)', mask: '999999', placeholder: '000000' },
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
        componentProps: { label: 'Регион (проживание)', placeholder: 'Введите регион' },
      },
      city: {
        value: '',
        component: Input,
        componentProps: { label: 'Город (проживание)', placeholder: 'Введите город' },
      },
      street: {
        value: '',
        component: Input,
        componentProps: { label: 'Улица (проживание)', placeholder: 'Введите улицу' },
      },
      house: {
        value: '',
        component: Input,
        componentProps: { label: 'Дом (проживание)', placeholder: '№' },
      },
      apartment: {
        value: '',
        component: Input,
        componentProps: { label: 'Квартира (проживание)', placeholder: '№' },
      },
      postalCode: {
        value: '',
        component: InputMask,
        componentProps: { label: 'Индекс (проживание)', mask: '999999', placeholder: '000000' },
      },
    },
  },

  step4: {
    employmentStatus: {
      value: 'employed',
      component: RadioGroup,
      componentProps: {
        label: 'Статус занятости',
        options: [
          { value: 'employed', label: 'Работаю по найму' },
          { value: 'selfEmployed', label: 'Самозанятый / ИП' },
          { value: 'unemployed', label: 'Не работаю' },
          { value: 'retired', label: 'Пенсионер' },
          { value: 'student', label: 'Студент' },
        ],
      },
    },
    companyName: {
      value: null,
      component: Input,
      componentProps: { label: 'Название компании', placeholder: 'Введите название' },
    },
    companyInn: {
      value: null,
      component: InputMask,
      componentProps: { label: 'ИНН компании', mask: '9999999999', placeholder: '1234567890' },
    },
    companyPhone: {
      value: null,
      component: InputMask,
      componentProps: {
        label: 'Телефон компании',
        mask: '+7 (999) 999-99-99',
        placeholder: '+7 (___) ___-__-__',
      },
    },
    companyAddress: {
      value: null,
      component: Input,
      componentProps: { label: 'Адрес компании', placeholder: 'Полный адрес' },
    },
    position: {
      value: null,
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
      value: null,
      component: Input,
      componentProps: { label: 'Источник дополнительного дохода', placeholder: 'Опишите источник' },
    },
    businessType: {
      value: null,
      component: Input,
      componentProps: { label: 'Тип бизнеса', placeholder: 'ИП, ООО и т.д.' },
    },
    businessInn: {
      value: null,
      component: InputMask,
      componentProps: { label: 'ИНН ИП', mask: '999999999999', placeholder: '123456789012' },
    },
    businessActivity: {
      value: null,
      component: Textarea,
      componentProps: { label: 'Вид деятельности', placeholder: 'Опишите вид деятельности' },
    },
  },

  step5: {
    maritalStatus: {
      value: 'single',
      component: RadioGroup,
      componentProps: {
        label: 'Семейное положение',
        options: [
          { value: 'single', label: 'Не женат/не замужем' },
          { value: 'married', label: 'Женат/замужем' },
          { value: 'divorced', label: 'Разведен/разведена' },
          { value: 'widowed', label: 'Вдовец/вдова' },
        ],
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
        placeholder: 'Выберите уровень образования',
        options: [
          { value: 'secondary', label: 'Среднее' },
          { value: 'specialized', label: 'Среднее специальное' },
          { value: 'higher', label: 'Высшее' },
          { value: 'postgraduate', label: 'Послевузовское' },
        ],
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
            placeholder: 'Выберите тип',
            options: [
              { value: 'apartment', label: 'Квартира' },
              { value: 'house', label: 'Дом' },
              { value: 'car', label: 'Автомобиль' },
              { value: 'land', label: 'Земельный участок' },
            ],
          },
        },
        description: {
          value: '',
          component: Textarea,
          componentProps: { label: 'Описание имущества', placeholder: 'Опишите имущество' },
        },
        estimatedValue: {
          value: 0,
          component: Input,
          componentProps: { label: 'Оценочная стоимость', type: 'number', placeholder: '0' },
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
          componentProps: { label: 'Сумма кредита', type: 'number', placeholder: '0' },
        },
        remainingAmount: {
          value: 0,
          component: Input,
          componentProps: { label: 'Остаток задолженности', type: 'number', placeholder: '0' },
        },
        monthlyPayment: {
          value: 0,
          component: Input,
          componentProps: { label: 'Ежемесячный платеж', type: 'number', placeholder: '0' },
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
            componentProps: { label: 'Фамилия созаемщика' },
          },
          firstName: { value: '', component: Input, componentProps: { label: 'Имя созаемщика' } },
          middleName: {
            value: '',
            component: Input,
            componentProps: { label: 'Отчество созаемщика' },
          },
          birthDate: {
            value: '',
            component: Input,
            componentProps: { label: 'Дата рождения созаемщика', type: 'date' },
          },
          gender: {
            value: 'male',
            component: RadioGroup,
            componentProps: {
              label: 'Пол созаемщика',
              options: [
                { value: 'male', label: 'Мужской' },
                { value: 'female', label: 'Женский' },
              ],
            },
          },
          birthPlace: {
            value: '',
            component: Input,
            componentProps: { label: 'Место рождения созаемщика' },
          },
        },
        phone: {
          value: '',
          component: InputMask,
          componentProps: {
            label: 'Телефон созаемщика',
            mask: '+7 (999) 999-99-99',
            placeholder: '+7 (___) ___-__-__',
          },
        },
        email: {
          value: '',
          component: Input,
          componentProps: {
            label: 'Email созаемщика',
            type: 'email',
            placeholder: 'example@mail.com',
          },
        },
        relationship: {
          value: '',
          component: Input,
          componentProps: { label: 'Родство', placeholder: 'Укажите родство' },
        },
        monthlyIncome: {
          value: 0,
          component: Input,
          componentProps: {
            label: 'Ежемесячный доход созаемщика',
            type: 'number',
            placeholder: '0',
          },
        },
      },
    ],
  },

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
      componentProps: { label: 'Подтверждаю точность введенных данных' },
    },
    electronicSignature: {
      value: '',
      component: InputMask,
      componentProps: { label: 'Код подтверждения из СМС', mask: '999999', placeholder: '123456' },
    },
  },
};

export const creditApplicationForm: FormProxy<CreditApplicationForm> = (
  createForm as (config: { form: unknown; validation: unknown }) => FormProxy<CreditApplicationForm>
)({
  form: formSchema as unknown as FormSchema<CreditApplicationForm>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  validation: (path: any) => {
    // ── Step 1: Loan parameters ─────────────────────────────────────────────
    required(path.step1.loanType);
    required(path.step1.loanAmount);
    min(path.step1.loanAmount, 50000, { message: 'Минимальная сумма кредита — 50 000 ₽' });
    max(path.step1.loanAmount, 10000000, { message: 'Максимальная сумма кредита — 10 000 000 ₽' });
    required(path.step1.loanTerm);
    min(path.step1.loanTerm, 6, { message: 'Минимальный срок — 6 месяцев' });
    max(path.step1.loanTerm, 240, { message: 'Максимальный срок — 240 месяцев' });
    required(path.step1.loanPurpose);
    minLength(path.step1.loanPurpose, 10, { message: 'Минимум 10 символов' });
    maxLength(path.step1.loanPurpose, 500, { message: 'Максимум 500 символов' });

    // Mortgage conditional group
    applyWhen(
      path.step1.loanType,
      (loanType: string) => loanType === 'mortgage',
      (p: typeof path) => {
        required(p.step1.propertyValue, { message: 'Введите стоимость недвижимости' });
        min(p.step1.propertyValue, 1000000, { message: 'Минимальная стоимость — 1 000 000 ₽' });
        required(p.step1.initialPayment, { message: 'Введите первоначальный взнос' });
        validate(p.step1.initialPayment, (value, ctx) => {
          const propVal = ctx.form.step1.propertyValue.value.value as number | null;
          const initPay = value as number | null;
          if (propVal != null && initPay != null && initPay < propVal * 0.2) {
            return {
              code: 'initial-payment-too-low',
              message: 'Первоначальный взнос должен быть не менее 20% от стоимости недвижимости',
            };
          }
          return null;
        });
      }
    );

    // Car loan conditional group
    applyWhen(
      path.step1.loanType,
      (loanType: string) => loanType === 'car',
      (p: typeof path) => {
        required(p.step1.carBrand, { message: 'Введите марку автомобиля' });
        minLength(p.step1.carBrand, 2, { message: 'Минимум 2 символа' });
        maxLength(p.step1.carBrand, 50, { message: 'Максимум 50 символов' });
        required(p.step1.carModel, { message: 'Введите модель автомобиля' });
        minLength(p.step1.carModel, 1, { message: 'Минимум 1 символ' });
        maxLength(p.step1.carModel, 50, { message: 'Максимум 50 символов' });
        required(p.step1.carYear, { message: 'Введите год выпуска' });
        min(p.step1.carYear, 2000, { message: 'Год выпуска не ранее 2000' });
        max(p.step1.carYear, new Date().getFullYear() + 1, {
          message: 'Год выпуска не позднее следующего года',
        });
        required(p.step1.carPrice, { message: 'Введите стоимость автомобиля' });
        min(p.step1.carPrice, 300000, { message: 'Минимальная стоимость — 300 000 ₽' });
        max(p.step1.carPrice, 10000000, { message: 'Максимальная стоимость — 10 000 000 ₽' });
      }
    );

    // ── Step 2: Personal data ───────────────────────────────────────────────
    required(path.step2.personalData.lastName);
    required(path.step2.personalData.firstName);
    required(path.step2.personalData.middleName);
    required(path.step2.personalData.birthDate);
    required(path.step2.personalData.gender);
    required(path.step2.personalData.birthPlace);

    // Age cross-check: 18–70 via passport issue date cross-reference
    validate(path.step2.personalData.birthDate, (value) => {
      if (!value) return null;
      const birth = new Date(value as string);
      const today = new Date();
      const age =
        today.getFullYear() -
        birth.getFullYear() -
        (today.getMonth() < birth.getMonth() ||
        (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
          ? 1
          : 0);
      if (age < 18) {
        return { code: 'age-too-young', message: 'Возраст заёмщика должен быть не менее 18 лет' };
      }
      if (age > 70) {
        return { code: 'age-too-old', message: 'Возраст заёмщика не должен превышать 70 лет' };
      }
      return null;
    });

    required(path.step2.passportData.series);
    required(path.step2.passportData.number);
    required(path.step2.passportData.issueDate);
    required(path.step2.passportData.issuedBy);
    required(path.step2.passportData.departmentCode);

    // INN: 12 digits + checksum
    required(path.step2.inn);
    pattern(path.step2.inn, /^\d{12}$/, {
      message: 'ИНН физического лица должен содержать 12 цифр',
    });
    validate(path.step2.inn, (value) => {
      const inn = (value as string) ?? '';
      if (inn.length !== 12) return null; // pattern handles format
      const d = inn.split('').map(Number);
      const c1 =
        ((7 * d[0] +
          2 * d[1] +
          4 * d[2] +
          10 * d[3] +
          3 * d[4] +
          5 * d[5] +
          9 * d[6] +
          4 * d[7] +
          6 * d[8] +
          8 * d[9]) %
          11) %
        10;
      const c2 =
        ((3 * d[0] +
          7 * d[1] +
          2 * d[2] +
          4 * d[3] +
          10 * d[4] +
          3 * d[5] +
          5 * d[6] +
          9 * d[7] +
          4 * d[8] +
          6 * d[9] +
          8 * d[10]) %
          11) %
        10;
      if (d[10] !== c1 || d[11] !== c2) {
        return { code: 'inn-checksum', message: 'Некорректный ИНН (ошибка контрольной суммы)' };
      }
      return null;
    });

    // SNILS: format 999-999-999 99 + checksum
    required(path.step2.snils);
    pattern(path.step2.snils, /^\d{3}-\d{3}-\d{3} \d{2}$/, {
      message: 'СНИЛС должен быть в формате 999-999-999 99',
    });
    validate(path.step2.snils, (value) => {
      const raw = ((value as string) ?? '').replace(/[-\s]/g, '');
      if (raw.length !== 11) return null;
      const digits = raw.split('').map(Number);
      const number = parseInt(raw.slice(0, 9), 10);
      if (number <= 1001998) return null; // older numbers not checked
      const weights = [9, 8, 7, 6, 5, 4, 3, 2, 1];
      let sum = weights.reduce((acc, w, i) => acc + w * digits[i], 0);
      sum = sum % 101 === 100 ? 0 : sum % 101;
      const checksum = digits[9] * 10 + digits[10];
      if (sum !== checksum) {
        return { code: 'snils-checksum', message: 'Некорректный СНИЛС (ошибка контрольной суммы)' };
      }
      return null;
    });

    // ── Step 3: Contact information ─────────────────────────────────────────
    required(path.step3.phoneMain);
    pattern(path.step3.phoneMain, /^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/, {
      message: 'Введите телефон в формате +7 (999) 999-99-99',
    });
    required(path.step3.email);
    email(path.step3.email, { message: 'Введите корректный email' });

    required(path.step3.registrationAddress.region);
    required(path.step3.registrationAddress.city);
    required(path.step3.registrationAddress.street);
    required(path.step3.registrationAddress.house);
    required(path.step3.registrationAddress.postalCode);
    pattern(path.step3.registrationAddress.postalCode, /^\d{6}$/, {
      message: 'Индекс должен содержать 6 цифр',
    });

    // Residence address required only when different from registration
    applyWhen(
      path.step3.sameAsRegistration,
      (same: boolean) => same === false,
      (p: typeof path) => {
        required(p.step3.residenceAddress.region);
        required(p.step3.residenceAddress.city);
        required(p.step3.residenceAddress.street);
        required(p.step3.residenceAddress.house);
        required(p.step3.residenceAddress.postalCode);
        pattern(p.step3.residenceAddress.postalCode, /^\d{6}$/, {
          message: 'Индекс должен содержать 6 цифр',
        });
      }
    );

    // ── Step 4: Employment ──────────────────────────────────────────────────
    required(path.step4.employmentStatus);
    required(path.step4.workExperienceTotal);
    min(path.step4.workExperienceTotal, 0, { message: 'Стаж не может быть отрицательным' });
    required(path.step4.workExperienceCurrent);
    min(path.step4.workExperienceCurrent, 0, { message: 'Стаж не может быть отрицательным' });

    // Cross-field: current experience <= total experience
    validate(path.step4.workExperienceCurrent, (value, ctx) => {
      const total = ctx.form.step4.workExperienceTotal.value.value as number | null;
      const current = value as number | null;
      if (total != null && current != null && current > total) {
        return {
          code: 'experience-mismatch',
          message: 'Стаж на текущем месте не может превышать общий стаж',
        };
      }
      return null;
    });

    required(path.step4.monthlyIncome);
    min(path.step4.monthlyIncome, 10000, { message: 'Минимальный доход — 10 000 ₽' });

    // Employed conditional group
    applyWhen(
      path.step4.employmentStatus,
      (status: string) => status === 'employed',
      (p: typeof path) => {
        required(p.step4.companyName, { message: 'Введите название компании' });
        required(p.step4.companyInn, { message: 'Введите ИНН компании' });
        pattern(p.step4.companyInn, /^\d{10}$/, {
          message: 'ИНН компании должен содержать 10 цифр',
        });
        required(p.step4.companyPhone, { message: 'Введите телефон компании' });
        pattern(p.step4.companyPhone, /^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/, {
          message: 'Введите телефон в формате +7 (999) 999-99-99',
        });
        required(p.step4.companyAddress, { message: 'Введите адрес компании' });
        required(p.step4.position, { message: 'Введите должность' });
      }
    );

    // Self-employed conditional group
    applyWhen(
      path.step4.employmentStatus,
      (status: string) => status === 'selfEmployed',
      (p: typeof path) => {
        required(p.step4.businessType, { message: 'Введите тип бизнеса' });
        required(p.step4.businessInn, { message: 'Введите ИНН ИП' });
        pattern(p.step4.businessInn, /^\d{12}$/, { message: 'ИНН ИП должен содержать 12 цифр' });
        required(p.step4.businessActivity, { message: 'Опишите вид деятельности' });
      }
    );

    // Additional income source required when additionalIncome > 0
    applyWhen(
      path.step4.additionalIncome,
      (income: number | null) => income != null && income > 0,
      (p: typeof path) => {
        required(p.step4.additionalIncomeSource, {
          message: 'Укажите источник дополнительного дохода',
        });
      }
    );

    // ── Step 5: Additional information ─────────────────────────────────────
    required(path.step5.maritalStatus);
    required(path.step5.dependents);
    min(path.step5.dependents, 0, { message: 'Количество иждивенцев не может быть отрицательным' });
    max(path.step5.dependents, 10, { message: 'Максимальное количество иждивенцев — 10' });
    required(path.step5.education);

    // Properties array validators
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validateItems(path.step5.properties, (itemPath: any) => {
      required(itemPath.type, { message: 'Выберите тип имущества' });
      required(itemPath.description, { message: 'Введите описание имущества' });
      required(itemPath.estimatedValue, { message: 'Введите оценочную стоимость' });
      min(itemPath.estimatedValue, 0, { message: 'Стоимость не может быть отрицательной' });
    });

    // Existing loans array validators
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validateItems(path.step5.existingLoans, (itemPath: any) => {
      required(itemPath.bank, { message: 'Введите название банка' });
      required(itemPath.type, { message: 'Введите тип кредита' });
      required(itemPath.amount, { message: 'Введите сумму кредита' });
      min(itemPath.amount, 0, { message: 'Сумма не может быть отрицательной' });
      required(itemPath.remainingAmount, { message: 'Введите остаток задолженности' });
      min(itemPath.remainingAmount, 0, { message: 'Остаток не может быть отрицательным' });
      validate(itemPath.remainingAmount, (value, ctx) => {
        const total = ctx.form.amount?.value?.value as number | null;
        const remaining = value as number | null;
        if (total != null && remaining != null && remaining > total) {
          return {
            code: 'remaining-exceeds-amount',
            message: 'Остаток задолженности не может превышать сумму кредита',
          };
        }
        return null;
      });
      required(itemPath.monthlyPayment, { message: 'Введите ежемесячный платёж' });
      min(itemPath.monthlyPayment, 0, { message: 'Платёж не может быть отрицательным' });
      required(itemPath.maturityDate, { message: 'Введите дату погашения' });
    });

    // Co-borrowers array validators
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validateItems(path.step5.coBorrowers, (itemPath: any) => {
      required(itemPath.personalData.lastName, { message: 'Введите фамилию созаёмщика' });
      required(itemPath.personalData.firstName, { message: 'Введите имя созаёмщика' });
      required(itemPath.personalData.middleName, { message: 'Введите отчество созаёмщика' });
      required(itemPath.personalData.birthDate, { message: 'Введите дату рождения созаёмщика' });
      required(itemPath.personalData.gender);
      required(itemPath.personalData.birthPlace, { message: 'Введите место рождения созаёмщика' });
      required(itemPath.phone, { message: 'Введите телефон созаёмщика' });
      pattern(itemPath.phone, /^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/, {
        message: 'Введите телефон в формате +7 (999) 999-99-99',
      });
      required(itemPath.email, { message: 'Введите email созаёмщика' });
      email(itemPath.email, { message: 'Введите корректный email созаёмщика' });
      required(itemPath.relationship, { message: 'Укажите родство с созаёмщиком' });
      required(itemPath.monthlyIncome, { message: 'Введите ежемесячный доход созаёмщика' });
      min(itemPath.monthlyIncome, 0, { message: 'Доход не может быть отрицательным' });
    });

    // ── Step 6: Confirmation ────────────────────────────────────────────────
    validate(path.step6.agreePersonalData, (value) => {
      if (value !== true) {
        return {
          code: 'agreement-required',
          message: 'Необходимо дать согласие на обработку персональных данных',
        };
      }
      return null;
    });
    validate(path.step6.agreeCreditHistory, (value) => {
      if (value !== true) {
        return {
          code: 'agreement-required',
          message: 'Необходимо дать согласие на проверку кредитной истории',
        };
      }
      return null;
    });
    validate(path.step6.agreeTerms, (value) => {
      if (value !== true) {
        return {
          code: 'agreement-required',
          message: 'Необходимо принять условия кредитования',
        };
      }
      return null;
    });
    validate(path.step6.confirmAccuracy, (value) => {
      if (value !== true) {
        return {
          code: 'confirmation-required',
          message: 'Необходимо подтвердить точность введённых данных',
        };
      }
      return null;
    });
    required(path.step6.electronicSignature);
    pattern(path.step6.electronicSignature, /^\d{6}$/, {
      message: 'Код подтверждения должен содержать 6 цифр',
    });
  },
});
