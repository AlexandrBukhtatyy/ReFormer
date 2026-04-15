/**
 * JSON-схема для формы кредитной заявки
 *
 * Структурно эквивалентна render-schema.ts (TS-variant) + включает inline-описания
 * полей из credit-application-schema.ts. Каждое поле самодостаточно описывает
 * своё представление: селектор (путь), дефолтное значение, UI-компонент и пропсы.
 *
 * Паттерн inline-поля:
 *   { selector: 'loanType', value: 'consumer', component: 'Select',
 *     componentProps: { label: ..., options: 'LOAN_TYPES' } }
 *
 * `selector` служит двойной цели: путь к полю в форме + идентификатор для
 * renderBehavior. Строки-имена (`LOAN_TYPES` и т.п.) резолвятся через
 * `registerSource()` в registry.
 *
 * Поведение (hideWhen, onComponentEvent) — в render-behavior.ts (переиспользуется
 * из TS-variant).
 */

import type { JsonFormSchema } from '@reformer/renderer-json';

// Константа, встречающаяся только inline в propertyFormSchema — дублируется здесь,
// чтобы JSON-файл был самодостаточным по описанию полей.
const PROPERTY_TYPE_OPTIONS = [
  { value: 'apartment', label: 'Квартира' },
  { value: 'house', label: 'Дом' },
  { value: 'land', label: 'Земельный участок' },
  { value: 'commercial', label: 'Коммерческая недвижимость' },
  { value: 'car', label: 'Автомобиль' },
  { value: 'other', label: 'Другое' },
];

export const creditApplicationJsonSchema: JsonFormSchema = {
  version: '1.0',
  root: {
    selector: 'wizard',
    component: 'RendererFormWizard',
    componentProps: {
      // form, stepValidations, fullValidation инжектятся через onInit в behavior —
      // это form-specific сущности, JSON-схема их не знает.
      className: 'bg-white p-8 rounded-lg shadow-md',
      steps: [
        // ========================================
        // Шаг 1: Основная информация о кредите
        // ========================================
        {
          component: 'Step',
          componentProps: { title: 'Кредит', icon: '💰' },
          children: [
            {
              component: 'Box',
              componentProps: { className: 'space-y-6' },
              children: [
                {
                  component: 'Section',
                  componentProps: {
                    title: 'Основная информация о кредите',
                    titleAs: 'h2',
                    titleClassName: 'text-xl font-bold',
                    className: 'space-y-6',
                  },
                  children: [
                    {
                      selector: 'loanType',
                      value: 'consumer',
                      component: 'Select',
                      componentProps: {
                        label: 'Тип кредита',
                        placeholder: 'Выберите тип кредита',
                        options: 'LOAN_TYPES',
                      },
                    },
                    {
                      selector: 'loanAmount',
                      value: null,
                      component: 'Input',
                      componentProps: {
                        label: 'Сумма кредита (₽)',
                        placeholder: 'Введите сумму',
                        type: 'number',
                        min: 50000,
                        max: 10000000,
                        step: 10000,
                      },
                    },
                    {
                      selector: 'loanTerm',
                      value: 12,
                      component: 'Input',
                      componentProps: {
                        label: 'Срок кредита (месяцев)',
                        placeholder: 'Введите срок',
                        type: 'number',
                        min: 6,
                        max: 240,
                      },
                    },
                    {
                      selector: 'loanPurpose',
                      value: '',
                      component: 'Textarea',
                      componentProps: {
                        label: 'Цель кредита',
                        placeholder: 'Опишите, на что планируете потратить средства',
                        rows: 4,
                        maxLength: 500,
                      },
                    },
                  ],
                },
                // Секция для ипотеки (видимость через render-behavior)
                {
                  selector: 'mortgage-section',
                  component: 'Section',
                  componentProps: {
                    title: 'Информация о недвижимости',
                    titleClassName: 'text-lg font-semibold mt-4',
                    className: 'space-y-4',
                  },
                  children: [
                    {
                      selector: 'propertyValue',
                      value: null,
                      component: 'Input',
                      componentProps: {
                        label: 'Стоимость недвижимости (₽)',
                        placeholder: 'Введите стоимость',
                        type: 'number',
                        min: 1000000,
                        step: 100000,
                      },
                    },
                    {
                      selector: 'initialPayment',
                      value: null,
                      component: 'Input',
                      componentProps: {
                        label: 'Первоначальный взнос (₽)',
                        placeholder: 'Введите сумму',
                        type: 'number',
                        min: 0,
                        step: 10000,
                      },
                    },
                  ],
                },
                // Секция для автокредита
                {
                  selector: 'car-section',
                  component: 'Section',
                  componentProps: {
                    title: 'Информация об автомобиле',
                    titleClassName: 'text-lg font-semibold mt-4',
                    className: 'space-y-4',
                  },
                  children: [
                    {
                      selector: 'carBrand',
                      value: null,
                      component: 'Input',
                      componentProps: {
                        label: 'Марка автомобиля',
                        placeholder: 'Например: Toyota',
                      },
                    },
                    {
                      selector: 'carModel',
                      value: null,
                      component: 'Select',
                      componentProps: {
                        label: 'Модель автомобиля',
                        placeholder: 'Например: Camry',
                      },
                    },
                    {
                      component: 'Box',
                      componentProps: { className: 'grid grid-cols-2 gap-4' },
                      children: [
                        {
                          selector: 'carYear',
                          value: null,
                          component: 'Input',
                          componentProps: {
                            label: 'Год выпуска',
                            placeholder: '2020',
                            type: 'number',
                            min: 2000,
                            max: 'CURRENT_YEAR_PLUS_ONE',
                          },
                        },
                        {
                          selector: 'carPrice',
                          value: null,
                          component: 'Input',
                          componentProps: {
                            label: 'Стоимость автомобиля (₽)',
                            placeholder: 'Введите стоимость',
                            type: 'number',
                            min: 300000,
                            step: 10000,
                          },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },

        // ========================================
        // Шаг 2: Персональные данные
        // ========================================
        {
          component: 'Step',
          componentProps: { title: 'Данные', icon: '👤' },
          children: [
            {
              component: 'Section',
              componentProps: {
                title: 'Персональные данные',
                titleAs: 'h2',
                titleClassName: 'text-xl font-bold',
                className: 'space-y-6',
              },
              children: [
                {
                  component: 'Section',
                  componentProps: {
                    title: 'Личные данные',
                    titleClassName: 'text-lg font-semibold',
                    className: 'space-y-4',
                  },
                  children: [
                    {
                      component: 'Box',
                      componentProps: { className: 'grid grid-cols-3 gap-4' },
                      children: [
                        {
                          selector: 'personalData.lastName',
                          value: '',
                          component: 'Input',
                          componentProps: { label: 'Фамилия', placeholder: 'Введите фамилию' },
                        },
                        {
                          selector: 'personalData.firstName',
                          value: '',
                          component: 'Input',
                          componentProps: { label: 'Имя', placeholder: 'Введите имя' },
                        },
                        {
                          selector: 'personalData.middleName',
                          value: '',
                          component: 'Input',
                          componentProps: { label: 'Отчество', placeholder: 'Введите отчество' },
                        },
                      ],
                    },
                    {
                      component: 'Box',
                      componentProps: { className: 'grid grid-cols-2 gap-4' },
                      children: [
                        {
                          selector: 'personalData.birthDate',
                          value: '',
                          component: 'Input',
                          componentProps: { label: 'Дата рождения', type: 'date' },
                        },
                        {
                          selector: 'personalData.gender',
                          value: 'male',
                          component: 'RadioGroup',
                          componentProps: { label: 'Пол', options: 'GENDERS' },
                        },
                      ],
                    },
                    {
                      selector: 'personalData.birthPlace',
                      value: '',
                      component: 'Input',
                      componentProps: {
                        label: 'Место рождения',
                        placeholder: 'Введите место рождения',
                      },
                    },
                  ],
                },
                {
                  component: 'Section',
                  componentProps: {
                    title: 'Паспортные данные',
                    titleClassName: 'text-lg font-semibold',
                    className: 'space-y-4',
                  },
                  children: [
                    {
                      component: 'Box',
                      componentProps: { className: 'grid grid-cols-2 gap-4' },
                      children: [
                        {
                          selector: 'passportData.series',
                          value: '',
                          component: 'InputMask',
                          componentProps: {
                            label: 'Серия паспорта',
                            placeholder: '00 00',
                            mask: '99 99',
                          },
                        },
                        {
                          selector: 'passportData.number',
                          value: '',
                          component: 'InputMask',
                          componentProps: {
                            label: 'Номер паспорта',
                            placeholder: '000000',
                            mask: '999999',
                          },
                        },
                      ],
                    },
                    {
                      selector: 'passportData.issuedBy',
                      value: '',
                      component: 'Textarea',
                      componentProps: {
                        label: 'Кем выдан',
                        placeholder: 'Введите наименование органа',
                        rows: 3,
                      },
                    },
                    {
                      component: 'Box',
                      componentProps: { className: 'grid grid-cols-2 gap-4' },
                      children: [
                        {
                          selector: 'passportData.issueDate',
                          value: '',
                          component: 'Input',
                          componentProps: { label: 'Дата выдачи', type: 'date' },
                        },
                        {
                          selector: 'passportData.departmentCode',
                          value: '',
                          component: 'InputMask',
                          componentProps: {
                            label: 'Код подразделения',
                            placeholder: '000-000',
                            mask: '999-999',
                          },
                        },
                      ],
                    },
                  ],
                },
                {
                  component: 'Section',
                  componentProps: {
                    title: 'Дополнительные документы',
                    titleClassName: 'text-lg font-semibold',
                    className: 'space-y-4',
                  },
                  children: [
                    {
                      component: 'Box',
                      componentProps: { className: 'grid grid-cols-2 gap-4' },
                      children: [
                        {
                          selector: 'inn',
                          value: '',
                          component: 'InputMask',
                          componentProps: {
                            label: 'ИНН',
                            placeholder: '123456789012',
                            mask: '999999999999',
                          },
                        },
                        {
                          selector: 'snils',
                          value: '',
                          component: 'InputMask',
                          componentProps: {
                            label: 'СНИЛС',
                            placeholder: '123-456-789 00',
                            mask: '999-999-999 99',
                          },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },

        // ========================================
        // Шаг 3: Контактная информация
        // ========================================
        {
          component: 'Step',
          componentProps: { title: 'Контакты', icon: '📞' },
          children: [
            {
              component: 'Section',
              componentProps: {
                title: 'Контактная информация',
                titleAs: 'h2',
                titleClassName: 'text-xl font-bold',
                className: 'space-y-6',
              },
              children: [
                {
                  component: 'Section',
                  componentProps: {
                    title: 'Контакты',
                    titleClassName: 'text-lg font-semibold',
                    className: 'space-y-4',
                  },
                  children: [
                    {
                      component: 'Box',
                      componentProps: { className: 'grid grid-cols-2 gap-4' },
                      children: [
                        {
                          selector: 'phoneMain',
                          value: '',
                          component: 'InputMask',
                          componentProps: {
                            label: 'Основной телефон',
                            placeholder: '+7 (___) ___-__-__',
                            mask: '+7 (999) 999-99-99',
                          },
                        },
                        {
                          selector: 'phoneAdditional',
                          value: null,
                          component: 'InputMask',
                          componentProps: {
                            label: 'Дополнительный телефон',
                            placeholder: '+7 (___) ___-__-__',
                            mask: '+7 (999) 999-99-99',
                          },
                        },
                      ],
                    },
                    {
                      component: 'Box',
                      componentProps: { className: 'grid grid-cols-2 gap-4' },
                      children: [
                        {
                          selector: 'email',
                          value: '',
                          component: 'Input',
                          componentProps: {
                            label: 'Email',
                            placeholder: 'example@mail.com',
                            type: 'email',
                          },
                        },
                        {
                          selector: 'emailAdditional',
                          value: null,
                          component: 'Input',
                          componentProps: {
                            label: 'Дополнительный email',
                            placeholder: 'example@mail.com',
                            type: 'email',
                          },
                        },
                      ],
                    },
                  ],
                },
                {
                  component: 'Section',
                  componentProps: {
                    title: 'Адрес регистрации',
                    titleClassName: 'text-lg font-semibold',
                    className: 'space-y-4',
                  },
                  children: [
                    {
                      component: 'Box',
                      componentProps: { className: 'grid grid-cols-2 gap-4' },
                      children: [
                        {
                          selector: 'registrationAddress.region',
                          value: '',
                          component: 'Input',
                          componentProps: { label: 'Регион', placeholder: 'Введите регион' },
                        },
                        {
                          selector: 'registrationAddress.city',
                          value: '',
                          component: 'Input',
                          componentProps: { label: 'Город', placeholder: 'Введите город' },
                        },
                      ],
                    },
                    {
                      selector: 'registrationAddress.street',
                      value: '',
                      component: 'Input',
                      componentProps: { label: 'Улица', placeholder: 'Введите улицу' },
                    },
                    {
                      component: 'Box',
                      componentProps: { className: 'grid grid-cols-3 gap-4' },
                      children: [
                        {
                          selector: 'registrationAddress.house',
                          value: '',
                          component: 'Input',
                          componentProps: { label: 'Дом', placeholder: '№' },
                        },
                        {
                          selector: 'registrationAddress.apartment',
                          value: '',
                          component: 'Input',
                          componentProps: { label: 'Квартира', placeholder: '№' },
                        },
                        {
                          selector: 'registrationAddress.postalCode',
                          value: '',
                          component: 'InputMask',
                          componentProps: {
                            label: 'Индекс',
                            placeholder: '000000',
                            mask: '999999',
                          },
                        },
                      ],
                    },
                  ],
                },
                {
                  selector: 'sameAsRegistration',
                  value: true,
                  component: 'Checkbox',
                  componentProps: {
                    label: 'Адрес проживания совпадает с адресом регистрации',
                  },
                },
                {
                  selector: 'residence-address-section',
                  component: 'Box',
                  children: [
                    {
                      component: 'ResidenceAddressSection',
                      children: [
                        {
                          component: 'Box',
                          componentProps: { className: 'grid grid-cols-2 gap-4' },
                          children: [
                            {
                              selector: 'residenceAddress.region',
                              value: '',
                              component: 'Input',
                              componentProps: { label: 'Регион', placeholder: 'Введите регион' },
                            },
                            {
                              selector: 'residenceAddress.city',
                              value: '',
                              component: 'Input',
                              componentProps: { label: 'Город', placeholder: 'Введите город' },
                            },
                          ],
                        },
                        {
                          selector: 'residenceAddress.street',
                          value: '',
                          component: 'Input',
                          componentProps: { label: 'Улица', placeholder: 'Введите улицу' },
                        },
                        {
                          component: 'Box',
                          componentProps: { className: 'grid grid-cols-3 gap-4' },
                          children: [
                            {
                              selector: 'residenceAddress.house',
                              value: '',
                              component: 'Input',
                              componentProps: { label: 'Дом', placeholder: '№' },
                            },
                            {
                              selector: 'residenceAddress.apartment',
                              value: '',
                              component: 'Input',
                              componentProps: { label: 'Квартира', placeholder: '№' },
                            },
                            {
                              selector: 'residenceAddress.postalCode',
                              value: '',
                              component: 'InputMask',
                              componentProps: {
                                label: 'Индекс',
                                placeholder: '000000',
                                mask: '999999',
                              },
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },

        // ========================================
        // Шаг 4: Информация о занятости
        // ========================================
        {
          component: 'Step',
          componentProps: { title: 'Работа', icon: '💼' },
          children: [
            {
              component: 'Section',
              componentProps: {
                title: 'Информация о занятости',
                titleAs: 'h2',
                titleClassName: 'text-xl font-bold',
                className: 'space-y-6',
              },
              children: [
                {
                  component: 'Box',
                  componentProps: { className: 'space-y-4' },
                  children: [
                    {
                      selector: 'employmentStatus',
                      value: 'employed',
                      component: 'RadioGroup',
                      componentProps: {
                        label: 'Статус занятости',
                        options: 'EMPLOYMENT_STATUSES',
                      },
                    },
                  ],
                },
                {
                  selector: 'employer-section',
                  component: 'Section',
                  componentProps: {
                    title: 'Информация о работодателе',
                    titleClassName: 'text-lg font-semibold mt-6',
                    className: 'space-y-4',
                  },
                  children: [
                    {
                      selector: 'companyName',
                      value: null,
                      component: 'Input',
                      componentProps: {
                        label: 'Название компании',
                        placeholder: 'Введите название',
                      },
                    },
                    {
                      component: 'Box',
                      componentProps: { className: 'grid grid-cols-2 gap-4' },
                      children: [
                        {
                          selector: 'companyInn',
                          value: null,
                          component: 'InputMask',
                          componentProps: {
                            label: 'ИНН компании',
                            placeholder: '1234567890',
                            mask: '9999999999',
                          },
                        },
                        {
                          selector: 'companyPhone',
                          value: null,
                          component: 'InputMask',
                          componentProps: {
                            label: 'Телефон компании',
                            placeholder: '+7 (___) ___-__-__',
                            mask: '+7 (999) 999-99-99',
                          },
                        },
                      ],
                    },
                    {
                      selector: 'companyAddress',
                      value: null,
                      component: 'Input',
                      componentProps: {
                        label: 'Адрес компании',
                        placeholder: 'Полный адрес',
                      },
                    },
                    {
                      component: 'Section',
                      componentProps: {
                        title: 'Должность и стаж',
                        titleClassName: 'text-lg font-semibold mt-6',
                        className: 'space-y-4',
                      },
                      children: [
                        {
                          selector: 'position',
                          value: null,
                          component: 'Input',
                          componentProps: {
                            label: 'Должность',
                            placeholder: 'Ваша должность',
                          },
                        },
                        {
                          component: 'Box',
                          componentProps: { className: 'grid grid-cols-2 gap-4' },
                          children: [
                            {
                              selector: 'workExperienceTotal',
                              value: null,
                              component: 'Input',
                              componentProps: {
                                label: 'Общий стаж работы (месяцев)',
                                placeholder: '0',
                                type: 'number',
                                min: 0,
                              },
                            },
                            {
                              selector: 'workExperienceCurrent',
                              value: null,
                              component: 'Input',
                              componentProps: {
                                label: 'Стаж на текущем месте (месяцев)',
                                placeholder: '0',
                                type: 'number',
                                min: 0,
                              },
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
                {
                  selector: 'business-section',
                  component: 'Section',
                  componentProps: {
                    title: 'Информация о бизнесе',
                    titleClassName: 'text-lg font-semibold mt-6',
                    className: 'space-y-4',
                  },
                  children: [
                    {
                      selector: 'businessType',
                      value: null,
                      component: 'Input',
                      componentProps: { label: 'Тип бизнеса', placeholder: 'ИП, ООО и т.д.' },
                    },
                    {
                      selector: 'businessInn',
                      value: null,
                      component: 'InputMask',
                      componentProps: {
                        label: 'ИНН ИП',
                        placeholder: '123456789012',
                        mask: '999999999999',
                      },
                    },
                    {
                      selector: 'businessActivity',
                      value: null,
                      component: 'Textarea',
                      componentProps: {
                        label: 'Вид деятельности',
                        placeholder: 'Опишите вид деятельности',
                        rows: 3,
                      },
                    },
                  ],
                },
                {
                  selector: 'income-section',
                  component: 'Section',
                  componentProps: {
                    title: 'Доход',
                    titleClassName: 'text-lg font-semibold mt-6',
                    className: 'space-y-4',
                  },
                  children: [
                    {
                      selector: 'monthlyIncome',
                      value: null,
                      component: 'Input',
                      componentProps: {
                        label: 'Ежемесячный доход (₽)',
                        placeholder: '0',
                        type: 'number',
                        min: 10000,
                        step: 1000,
                      },
                    },
                    {
                      component: 'Box',
                      componentProps: { className: 'grid grid-cols-2 gap-4' },
                      children: [
                        {
                          selector: 'additionalIncome',
                          value: null,
                          component: 'Input',
                          componentProps: {
                            label: 'Дополнительный доход (₽)',
                            placeholder: '0',
                            type: 'number',
                            min: 0,
                            step: 1000,
                          },
                        },
                        {
                          selector: 'additionalIncomeSource',
                          value: null,
                          component: 'Input',
                          componentProps: {
                            label: 'Источник дополнительного дохода',
                            placeholder: 'Опишите источник',
                          },
                        },
                      ],
                    },
                  ],
                },
                {
                  selector: 'unemployed-warning',
                  component: 'UnemployedWarning',
                  componentProps: { className: 'mt-6' },
                },
              ],
            },
          ],
        },

        // ========================================
        // Шаг 5: Дополнительная информация
        // ========================================
        {
          component: 'Step',
          componentProps: { title: 'Доп. инфо', icon: '📋' },
          children: [
            {
              component: 'Section',
              componentProps: {
                title: 'Дополнительная информация',
                titleAs: 'h2',
                titleClassName: 'text-xl font-bold',
                className: 'space-y-6',
              },
              children: [
                {
                  component: 'Section',
                  componentProps: {
                    title: 'Общая информация',
                    titleClassName: 'text-lg font-semibold',
                    className: 'space-y-4',
                  },
                  children: [
                    {
                      selector: 'maritalStatus',
                      value: 'single',
                      component: 'RadioGroup',
                      componentProps: {
                        label: 'Семейное положение',
                        options: 'MARITAL_STATUSES',
                      },
                    },
                    {
                      component: 'Box',
                      componentProps: { className: 'grid grid-cols-2 gap-4' },
                      children: [
                        {
                          selector: 'dependents',
                          value: 0,
                          component: 'Input',
                          componentProps: {
                            label: 'Количество иждивенцев',
                            placeholder: '0',
                            type: 'number',
                            min: 0,
                            max: 10,
                          },
                        },
                        {
                          selector: 'education',
                          value: 'higher',
                          component: 'Select',
                          componentProps: {
                            label: 'Образование',
                            placeholder: 'Выберите уровень образования',
                            options: 'EDUCATIONS',
                          },
                        },
                      ],
                    },
                  ],
                },
                // Имущество
                {
                  component: 'Section',
                  componentProps: { className: 'space-y-4' },
                  children: [
                    {
                      selector: 'hasProperty',
                      value: false,
                      component: 'Checkbox',
                      componentProps: { label: 'У меня есть имущество' },
                    },
                    {
                      selector: 'properties-array',
                      component: 'RendererFormArraySection',
                      componentProps: {
                        title: 'Имущество',
                        array: { $model: 'properties' },
                        itemLabel: 'PROPERTY_ITEM_LABEL_SOURCE_FN',
                        addButtonLabel: '+ Добавить имущество',
                        emptyMessage: 'Нажмите "Добавить имущество" для добавления информации',
                        itemComponent: {
                          $template: {
                            component: 'Box',
                            componentProps: { className: 'space-y-3' },
                            children: [
                              {
                                selector: 'type',
                                value: 'apartment',
                                component: 'Select',
                                componentProps: {
                                  label: 'Тип имущества',
                                  placeholder: 'Выберите тип',
                                  options: PROPERTY_TYPE_OPTIONS,
                                  testId: 'property-type',
                                },
                              },
                              {
                                selector: 'description',
                                value: '',
                                component: 'Textarea',
                                componentProps: {
                                  label: 'Описание',
                                  placeholder: 'Опишите имущество',
                                  rows: 2,
                                  testId: 'property-description',
                                },
                              },
                              {
                                selector: 'estimatedValue',
                                value: 0,
                                component: 'Input',
                                componentProps: {
                                  label: 'Оценочная стоимость',
                                  placeholder: '0',
                                  type: 'number',
                                  min: 0,
                                  step: 1000,
                                  testId: 'property-estimatedValue',
                                },
                              },
                              {
                                selector: 'hasEncumbrance',
                                value: false,
                                component: 'Checkbox',
                                componentProps: {
                                  label: 'Имеется обременение (залог)',
                                  testId: 'property-hasEncumbrance',
                                },
                              },
                            ],
                          },
                        },
                      },
                    },
                  ],
                },
                // Существующие кредиты
                {
                  component: 'Section',
                  componentProps: { className: 'space-y-4' },
                  children: [
                    {
                      selector: 'hasExistingLoans',
                      value: false,
                      component: 'Checkbox',
                      componentProps: { label: 'У меня есть другие кредиты' },
                    },
                    {
                      selector: 'existing-loans-array',
                      component: 'RendererFormArraySection',
                      componentProps: {
                        title: 'Существующие кредиты',
                        array: { $model: 'existingLoans' },
                        itemLabel: 'EXISTING_LOAN_ITEM_LABEL_SOURCE_FN',
                        addButtonLabel: '+ Добавить кредит',
                        emptyMessage: 'Нажмите "Добавить кредит" для добавления информации',
                        // testId прописан явно для совместимости с e2e POM (compound-конвенция)
                        itemComponent: {
                          $template: {
                            component: 'Box',
                            componentProps: { className: 'space-y-3' },
                            children: [
                              {
                                selector: 'bank',
                                value: '',
                                component: 'Input',
                                componentProps: {
                                  label: 'Банк',
                                  placeholder: 'Название банка',
                                  testId: 'existingLoan-bank',
                                },
                              },
                              {
                                selector: 'type',
                                value: 'consumer',
                                component: 'Select',
                                componentProps: {
                                  label: 'Тип кредита',
                                  placeholder: 'Выберите тип',
                                  options: 'EXISTING_LOAN_TYPES',
                                  testId: 'existingLoan-type',
                                },
                              },
                              {
                                component: 'Box',
                                componentProps: { className: 'grid grid-cols-2 gap-4' },
                                children: [
                                  {
                                    selector: 'amount',
                                    value: 0,
                                    component: 'Input',
                                    componentProps: {
                                      label: 'Сумма кредита (₽)',
                                      placeholder: '0',
                                      type: 'number',
                                      min: 0,
                                      step: 1000,
                                      testId: 'existingLoan-amount',
                                    },
                                  },
                                  {
                                    selector: 'remainingAmount',
                                    value: 0,
                                    component: 'Input',
                                    componentProps: {
                                      label: 'Остаток долга (₽)',
                                      placeholder: '0',
                                      type: 'number',
                                      min: 0,
                                      step: 1000,
                                      testId: 'existingLoan-remainingAmount',
                                    },
                                  },
                                ],
                              },
                              {
                                component: 'Box',
                                componentProps: { className: 'grid grid-cols-2 gap-4' },
                                children: [
                                  {
                                    selector: 'monthlyPayment',
                                    value: 0,
                                    component: 'Input',
                                    componentProps: {
                                      label: 'Ежемесячный платеж (₽)',
                                      placeholder: '0',
                                      type: 'number',
                                      min: 0,
                                      step: 100,
                                      testId: 'existingLoan-monthlyPayment',
                                    },
                                  },
                                  {
                                    selector: 'maturityDate',
                                    value: '',
                                    component: 'Input',
                                    componentProps: {
                                      label: 'Дата погашения',
                                      type: 'date',
                                      testId: 'existingLoan-maturityDate',
                                    },
                                  },
                                ],
                              },
                            ],
                          },
                        },
                      },
                    },
                  ],
                },
                // Созаёмщики
                {
                  component: 'Section',
                  componentProps: { className: 'space-y-4' },
                  children: [
                    {
                      selector: 'hasCoBorrower',
                      value: false,
                      component: 'Checkbox',
                      componentProps: { label: 'Добавить созаемщика' },
                    },
                    {
                      selector: 'co-borrowers-array',
                      component: 'RendererFormArraySection',
                      componentProps: {
                        title: 'Созаемщики',
                        array: { $model: 'coBorrowers' },
                        itemLabel: 'CO_BORROWER_ITEM_LABEL_SOURCE_FN',
                        addButtonLabel: '+ Добавить созаемщика',
                        emptyMessage: 'Нажмите "Добавить созаемщика" для добавления информации',
                        emptyMessageHint:
                          'CoBorrowerForm поддерживает вложенную группу personalData',
                        itemComponent: {
                          $template: {
                            component: 'Box',
                            componentProps: { className: 'space-y-3' },
                            children: [
                              {
                                component: 'Box',
                                componentProps: { className: 'grid grid-cols-3 gap-4' },
                                children: [
                                  {
                                    selector: 'personalData.lastName',
                                    value: '',
                                    component: 'Input',
                                    componentProps: {
                                      label: 'Фамилия',
                                      placeholder: 'Введите фамилию',
                                      testId: 'coBorrower-lastName',
                                    },
                                  },
                                  {
                                    selector: 'personalData.firstName',
                                    value: '',
                                    component: 'Input',
                                    componentProps: {
                                      label: 'Имя',
                                      placeholder: 'Введите имя',
                                      testId: 'coBorrower-firstName',
                                    },
                                  },
                                  {
                                    selector: 'personalData.middleName',
                                    value: '',
                                    component: 'Input',
                                    componentProps: {
                                      label: 'Отчество',
                                      placeholder: 'Введите отчество',
                                      testId: 'coBorrower-middleName',
                                    },
                                  },
                                ],
                              },
                              {
                                selector: 'personalData.birthDate',
                                value: '',
                                component: 'Input',
                                componentProps: {
                                  label: 'Дата рождения',
                                  type: 'date',
                                  testId: 'coBorrower-birthDate',
                                },
                              },
                              {
                                component: 'Box',
                                componentProps: { className: 'grid grid-cols-2 gap-4' },
                                children: [
                                  {
                                    selector: 'phone',
                                    value: '',
                                    component: 'InputMask',
                                    componentProps: {
                                      label: 'Телефон',
                                      placeholder: '+7 (___) ___-__-__',
                                      mask: '+7 (999) 999-99-99',
                                      testId: 'coBorrower-phone',
                                    },
                                  },
                                  {
                                    selector: 'email',
                                    value: '',
                                    component: 'Input',
                                    componentProps: {
                                      label: 'Email',
                                      placeholder: 'example@mail.com',
                                      type: 'email',
                                      testId: 'coBorrower-email',
                                    },
                                  },
                                ],
                              },
                              {
                                component: 'Box',
                                componentProps: { className: 'grid grid-cols-2 gap-4' },
                                children: [
                                  {
                                    selector: 'relationship',
                                    value: 'spouse',
                                    component: 'Select',
                                    componentProps: {
                                      label: 'Отношение к заемщику',
                                      placeholder: 'Выберите отношение',
                                      options: 'RELATIONSHIPS',
                                      testId: 'coBorrower-relationship',
                                    },
                                  },
                                  {
                                    selector: 'monthlyIncome',
                                    value: 0,
                                    component: 'Input',
                                    componentProps: {
                                      label: 'Ежемесячный доход (₽)',
                                      placeholder: '0',
                                      type: 'number',
                                      min: 0,
                                      step: 1000,
                                      testId: 'coBorrower-monthlyIncome',
                                    },
                                  },
                                ],
                              },
                            ],
                          },
                        },
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },

        // ========================================
        // Шаг 6: Подтверждение
        // ========================================
        {
          component: 'Step',
          componentProps: { title: 'Подтверждение', icon: '✓' },
          children: [
            {
              component: 'Section',
              componentProps: {
                title: 'Подтверждение и согласия',
                titleAs: 'h2',
                titleClassName: 'text-xl font-bold',
                className: 'space-y-6',
              },
              children: [
                {
                  component: 'Box',
                  componentProps: { className: 'space-y-4' },
                  children: [
                    { component: 'ConfirmationInfoBlock' },
                    { component: 'HighPaymentWarning' },
                  ],
                },
                { component: 'LoanSummarySection' },
                { component: 'ApplicantSummarySection' },
                {
                  component: 'Section',
                  componentProps: {
                    title: 'Обязательные согласия',
                    titleClassName: 'text-lg font-semibold',
                    className: 'space-y-3',
                  },
                  children: [
                    {
                      selector: 'agreePersonalData',
                      value: false,
                      component: 'Checkbox',
                      componentProps: { label: 'Согласие на обработку персональных данных' },
                    },
                    {
                      selector: 'agreeCreditHistory',
                      value: false,
                      component: 'Checkbox',
                      componentProps: { label: 'Согласие на проверку кредитной истории' },
                    },
                    {
                      selector: 'agreeTerms',
                      value: false,
                      component: 'Checkbox',
                      componentProps: { label: 'Согласие с условиями кредитования' },
                    },
                    {
                      selector: 'confirmAccuracy',
                      value: false,
                      component: 'Checkbox',
                      componentProps: { label: 'Подтверждаю точность введенных данных' },
                    },
                  ],
                },
                {
                  component: 'Section',
                  componentProps: {
                    title: 'Опциональные согласия',
                    titleClassName: 'text-lg font-semibold mt-6',
                  },
                  children: [
                    {
                      selector: 'agreeMarketing',
                      value: false,
                      component: 'Checkbox',
                      componentProps: {
                        label: 'Согласие на получение маркетинговых материалов',
                      },
                    },
                  ],
                },
                {
                  component: 'Section',
                  componentProps: {
                    title: 'Электронная подпись',
                    titleClassName: 'text-lg font-semibold mt-6',
                    className: 'space-y-4',
                  },
                  children: [
                    {
                      selector: 'electronicSignature',
                      value: '',
                      component: 'InputMask',
                      componentProps: {
                        label: 'Код подтверждения из СМС',
                        placeholder: '123456',
                        mask: '999999',
                      },
                    },
                    { component: 'ElectronicSignatureHint' },
                  ],
                },
                { component: 'SubmitWarning' },
                { component: 'NextStepsInfo' },
              ],
            },
          ],
        },
      ],
    },
  },
};
