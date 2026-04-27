import { createForm } from '@reformer/core';
import type { FormSchema } from '@reformer/core';
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

export const creditApplicationForm = createForm<CreditApplicationForm>({
  form: formSchema as unknown as FormSchema<CreditApplicationForm>,
});
