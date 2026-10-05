/**
 * Документ схемы формы — формат 2. Только разметка: правил и поведения здесь нет
 * (они в `validation.ts` и `form.behavior.ts`).
 *
 * Узел привязан к модели ключом `model`; `defineJsonSchema<T>` типизирует пути `$model(...)`
 * по форме модели: опечатка в пути — ошибка компиляции, а не тихий баг в рантайме.
 *
 * Корень — визард (`$component(Wizard)`), шаги — его дети: узлы `$component(Step)` с
 * `componentProps.title/icon`. `selector` шага — ключ его правил в `creditValidation.steps`.
 * Шаблон нового элемента массива объявлен в модели (`arrayOf`), поэтому `item` несёт только
 * разметку строки.
 *
 * Документ переведён из прежнего формата библиотечной функцией `migrateJsonSchema`.
 */
import { defineJsonSchema } from '@reformer/renderer-json';

import type { CreditApplicationForm } from './types';

const GRID_2 = 'grid grid-cols-1 md:grid-cols-2 gap-4';
const GRID_3 = 'grid grid-cols-1 md:grid-cols-3 gap-4';
const SECTION_TITLE = 'text-lg font-semibold';
const HINT_BOX = 'p-4 rounded-md border border-blue-200 bg-blue-50 text-sm text-blue-900';
const WARN_BOX = 'p-4 rounded-md border border-amber-300 bg-amber-50 text-sm text-amber-900';

export const creditFormSchema = defineJsonSchema<CreditApplicationForm>({
  format: 2,
  version: '1.0',
  root: {
    selector: 'wizard',
    component: '$component(Wizard)',
    componentProps: {
      className: 'bg-card text-card-foreground p-6 rounded-lg border',
    },
    children: [
      /* ============================ Шаг 1 ============================ */
      {
        selector: 'loan',
        component: '$component(Step)',
        componentProps: {
          title: 'Кредит',
          icon: '💰',
        },
        children: [
          {
            component: '$component(Section)',
            componentProps: {
              title: 'Параметры кредита',
              titleAs: 'h3',
              titleClassName: SECTION_TITLE,
              className: 'space-y-4',
            },
            children: [
              {
                component: '$component(Box)',
                componentProps: {
                  className: GRID_3,
                },
                children: [
                  {
                    selector: 'loanType',
                    model: '$model(loanType)',
                    component: '$component(Select)',
                    componentProps: {
                      label: 'Тип кредита',
                      placeholder: 'Выберите тип кредита',
                      options: '$dataSource(LOAN_TYPES)',
                      testId: 'loanType',
                    },
                  },
                  {
                    selector: 'loanAmount',
                    model: '$model(loanAmount)',
                    component: '$component(InputNumber)',
                    componentProps: {
                      label: 'Сумма кредита (₽)',
                      placeholder: 'Введите сумму',
                      min: 50000,
                      max: 10000000,
                      testId: 'loanAmount',
                    },
                  },
                  {
                    selector: 'loanTerm',
                    model: '$model(loanTerm)',
                    component: '$component(InputNumber)',
                    componentProps: {
                      label: 'Срок кредита (месяцев)',
                      placeholder: 'Введите срок',
                      min: 6,
                      max: 240,
                      testId: 'loanTerm',
                    },
                  },
                ],
              },
              {
                selector: 'loanPurpose',
                model: '$model(loanPurpose)',
                component: '$component(Textarea)',
                componentProps: {
                  label: 'Цель кредита',
                  placeholder: 'Опишите, на что планируете потратить средства',
                  rows: 3,
                  testId: 'loanPurpose',
                },
              },
            ],
          },
          {
            selector: 'mortgage-section',
            component: '$component(Section)',
            componentProps: {
              title: 'Ипотека',
              titleAs: 'h3',
              titleClassName: SECTION_TITLE,
              className: 'space-y-4',
            },
            children: [
              {
                component: '$component(Box)',
                componentProps: {
                  className: GRID_2,
                },
                children: [
                  {
                    selector: 'propertyValue',
                    model: '$model(propertyValue)',
                    component: '$component(InputNumber)',
                    componentProps: {
                      label: 'Стоимость недвижимости (₽)',
                      placeholder: 'Введите стоимость',
                      min: 1000000,
                      testId: 'propertyValue',
                    },
                  },
                  {
                    selector: 'initialPayment',
                    model: '$model(initialPayment)',
                    component: '$component(InputNumber)',
                    componentProps: {
                      label: 'Первоначальный взнос (₽) — 20 % от стоимости',
                      testId: 'initialPayment',
                    },
                  },
                ],
              },
            ],
          },
          {
            selector: 'mortgage-hint',
            component: '$html(div)',
            componentProps: {
              className: HINT_BOX,
            },
            children: [
              {
                component: '$html(b)',
                children: ['Документы на недвижимость.'],
              },
              ' Подготовьте выписку из ЕГРН, отчёт об оценке и договор купли-продажи.',
            ],
          },
          {
            selector: 'car-section',
            component: '$component(Section)',
            componentProps: {
              title: 'Автомобиль',
              titleAs: 'h3',
              titleClassName: SECTION_TITLE,
              className: 'space-y-4',
            },
            children: [
              {
                component: '$component(Box)',
                componentProps: {
                  className: GRID_2,
                },
                children: [
                  {
                    selector: 'carBrand',
                    model: '$model(carBrand)',
                    component: '$component(Select)',
                    componentProps: {
                      label: 'Марка автомобиля',
                      placeholder: 'Например: Toyota',
                      options: '$dataSource(CAR_BRANDS)',
                      testId: 'carBrand',
                    },
                  },
                  {
                    selector: 'carModel',
                    model: '$model(carModel)',
                    component: '$component(Select)',
                    componentProps: {
                      label: 'Модель автомобиля',
                      placeholder: 'Сначала выберите марку',
                      options: '$dataSource(EMPTY_OPTIONS)',
                      testId: 'carModel',
                    },
                  },
                  {
                    selector: 'carYear',
                    model: '$model(carYear)',
                    component: '$component(InputNumber)',
                    componentProps: {
                      label: 'Год выпуска',
                      placeholder: '2020',
                      min: 2000,
                      max: '$dataSource(CURRENT_YEAR_PLUS_ONE)',
                      testId: 'carYear',
                    },
                  },
                  {
                    selector: 'carPrice',
                    model: '$model(carPrice)',
                    component: '$component(InputNumber)',
                    componentProps: {
                      label: 'Стоимость автомобиля (₽)',
                      placeholder: 'Введите стоимость',
                      min: 300000,
                      max: 10000000,
                      testId: 'carPrice',
                    },
                  },
                ],
              },
            ],
          },
          {
            component: '$component(Section)',
            componentProps: {
              title: 'Предварительный расчёт',
              titleAs: 'h3',
              titleClassName: SECTION_TITLE,
              className: 'space-y-4',
            },
            children: [
              {
                component: '$component(Box)',
                componentProps: {
                  className: GRID_2,
                },
                children: [
                  {
                    selector: 'interestRate',
                    model: '$model(interestRate)',
                    component: '$component(InputNumber)',
                    componentProps: {
                      label: 'Процентная ставка (%)',
                      testId: 'interestRate',
                    },
                  },
                  {
                    selector: 'monthlyPayment',
                    model: '$model(monthlyPayment)',
                    component: '$component(InputNumber)',
                    componentProps: {
                      label: 'Ежемесячный платёж (₽)',
                      testId: 'monthlyPayment',
                    },
                  },
                ],
              },
              {
                component: '$html(p)',
                componentProps: {
                  className: 'text-sm text-muted-foreground',
                },
                children: [
                  'При ставке ',
                  '$model(interestRate)',
                  ' % платёж составит ',
                  '$model(monthlyPayment)',
                  ' ₽ в месяц.',
                ],
              },
            ],
          },
        ],
      },
      /* ============================ Шаг 2 ============================ */
      {
        selector: 'personal',
        component: '$component(Step)',
        componentProps: {
          title: 'Заявитель',
          icon: '🧑',
        },
        children: [
          {
            component: '$component(Section)',
            componentProps: {
              title: 'Личные данные',
              titleAs: 'h3',
              titleClassName: SECTION_TITLE,
              className: 'space-y-4',
            },
            children: [
              {
                component: '$component(Box)',
                componentProps: {
                  className: GRID_3,
                },
                children: [
                  {
                    model: '$model(personalData.lastName)',
                    component: '$component(Input)',
                    componentProps: {
                      label: 'Фамилия',
                      placeholder: 'Введите фамилию',
                      testId: 'personalData-lastName',
                    },
                  },
                  {
                    model: '$model(personalData.firstName)',
                    component: '$component(Input)',
                    componentProps: {
                      label: 'Имя',
                      placeholder: 'Введите имя',
                      testId: 'personalData-firstName',
                    },
                  },
                  {
                    model: '$model(personalData.middleName)',
                    component: '$component(Input)',
                    componentProps: {
                      label: 'Отчество',
                      placeholder: 'Введите отчество',
                      testId: 'personalData-middleName',
                    },
                  },
                ],
              },
              {
                component: '$component(Box)',
                componentProps: {
                  className: GRID_3,
                },
                children: [
                  {
                    model: '$model(personalData.birthDate)',
                    component: '$component(Input)',
                    componentProps: {
                      label: 'Дата рождения',
                      type: 'date',
                      testId: 'personalData-birthDate',
                    },
                  },
                  {
                    model: '$model(personalData.gender)',
                    component: '$component(RadioGroup)',
                    componentProps: {
                      label: 'Пол',
                      options: '$dataSource(GENDERS)',
                      className: '!flex-row gap-6',
                      testId: 'personalData-gender',
                    },
                  },
                  {
                    model: '$model(personalData.birthPlace)',
                    component: '$component(Input)',
                    componentProps: {
                      label: 'Место рождения',
                      placeholder: 'Введите место рождения',
                      testId: 'personalData-birthPlace',
                    },
                  },
                ],
              },
              {
                component: '$component(Box)',
                componentProps: {
                  className: GRID_2,
                },
                children: [
                  {
                    selector: 'fullName',
                    model: '$model(fullName)',
                    component: '$component(Input)',
                    componentProps: {
                      label: 'Полное имя',
                      testId: 'fullName',
                    },
                  },
                  {
                    selector: 'age',
                    model: '$model(age)',
                    component: '$component(InputNumber)',
                    componentProps: {
                      label: 'Возраст (лет)',
                      testId: 'age',
                    },
                  },
                ],
              },
            ],
          },
          {
            selector: 'warn-age',
            component: '$html(div)',
            componentProps: {
              className: WARN_BOX,
            },
            children: [
              'Могут потребоваться дополнительные гарантии: возраст заемщика выше 60 лет.',
            ],
          },
          {
            component: '$component(Section)',
            componentProps: {
              title: 'Паспортные данные',
              titleAs: 'h3',
              titleClassName: SECTION_TITLE,
              className: 'space-y-4',
            },
            children: [
              {
                component: '$component(Box)',
                componentProps: {
                  className: GRID_3,
                },
                children: [
                  {
                    model: '$model(passportData.series)',
                    component: '$component(InputMask)',
                    componentProps: {
                      label: 'Серия паспорта',
                      mask: '99 99',
                      placeholder: '12 34',
                      testId: 'passportData-series',
                    },
                  },
                  {
                    model: '$model(passportData.number)',
                    component: '$component(InputMask)',
                    componentProps: {
                      label: 'Номер паспорта',
                      mask: '999999',
                      placeholder: '123456',
                      testId: 'passportData-number',
                    },
                  },
                  {
                    model: '$model(passportData.departmentCode)',
                    component: '$component(InputMask)',
                    componentProps: {
                      label: 'Код подразделения',
                      mask: '999-999',
                      placeholder: '123-456',
                      testId: 'passportData-departmentCode',
                    },
                  },
                ],
              },
              {
                component: '$component(Box)',
                componentProps: {
                  className: GRID_2,
                },
                children: [
                  {
                    model: '$model(passportData.issueDate)',
                    component: '$component(Input)',
                    componentProps: {
                      label: 'Дата выдачи',
                      type: 'date',
                      testId: 'passportData-issueDate',
                    },
                  },
                  {
                    model: '$model(passportData.issuedBy)',
                    component: '$component(Input)',
                    componentProps: {
                      label: 'Кем выдан',
                      placeholder: 'Введите название органа',
                      testId: 'passportData-issuedBy',
                    },
                  },
                ],
              },
            ],
          },
          {
            component: '$component(Section)',
            componentProps: {
              title: 'Документы',
              titleAs: 'h3',
              titleClassName: SECTION_TITLE,
              className: 'space-y-4',
            },
            children: [
              {
                component: '$component(Box)',
                componentProps: {
                  className: GRID_2,
                },
                children: [
                  {
                    model: '$model(inn)',
                    component: '$component(InputMask)',
                    componentProps: {
                      label: 'ИНН',
                      mask: '999999999999',
                      placeholder: '123456789012',
                      testId: 'inn',
                    },
                  },
                  {
                    model: '$model(snils)',
                    component: '$component(InputMask)',
                    componentProps: {
                      label: 'СНИЛС',
                      mask: '999-999-999 99',
                      placeholder: '123-456-789 00',
                      testId: 'snils',
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
      /* ============================ Шаг 3 ============================ */
      {
        selector: 'contacts',
        component: '$component(Step)',
        componentProps: {
          title: 'Контакты',
          icon: '📞',
        },
        children: [
          {
            component: '$component(Section)',
            componentProps: {
              title: 'Телефоны и email',
              titleAs: 'h3',
              titleClassName: SECTION_TITLE,
              className: 'space-y-4',
            },
            children: [
              {
                component: '$component(Box)',
                componentProps: {
                  className: GRID_2,
                },
                children: [
                  {
                    model: '$model(phoneMain)',
                    component: '$component(InputMask)',
                    componentProps: {
                      label: 'Основной телефон',
                      mask: '+7 (999) 999-99-99',
                      testId: 'phoneMain',
                    },
                  },
                  {
                    model: '$model(phoneAdditional)',
                    component: '$component(InputMask)',
                    componentProps: {
                      label: 'Дополнительный телефон',
                      mask: '+7 (999) 999-99-99',
                      testId: 'phoneAdditional',
                    },
                  },
                ],
              },
              {
                component: '$component(Box)',
                componentProps: {
                  className: GRID_2,
                },
                children: [
                  {
                    model: '$model(email)',
                    component: '$component(Input)',
                    componentProps: {
                      label: 'Email',
                      type: 'email',
                      placeholder: 'example@mail.com',
                      testId: 'email',
                    },
                  },
                  {
                    model: '$model(emailAdditional)',
                    component: '$component(Input)',
                    componentProps: {
                      label: 'Дополнительный email',
                      type: 'email',
                      placeholder: 'example@mail.com',
                      testId: 'emailAdditional',
                    },
                  },
                ],
              },
              {
                model: '$model(sameEmail)',
                component: '$component(Checkbox)',
                componentProps: {
                  label: 'Дополнительный email совпадает с основным',
                  testId: 'sameEmail',
                },
              },
            ],
          },
          {
            component: '$component(Section)',
            componentProps: {
              title: 'Адрес регистрации',
              titleAs: 'h3',
              titleClassName: SECTION_TITLE,
              className: 'space-y-4',
            },
            children: [
              {
                component: '$component(Box)',
                componentProps: {
                  className: GRID_2,
                },
                children: [
                  {
                    selector: 'registration-region',
                    model: '$model(registrationAddress.region)',
                    component: '$component(Select)',
                    componentProps: {
                      label: 'Регион',
                      placeholder: 'Введите регион',
                      options: '$dataSource(REGIONS)',
                      testId: 'registrationAddress-region',
                    },
                  },
                  {
                    selector: 'registration-city',
                    model: '$model(registrationAddress.city)',
                    component: '$component(Select)',
                    componentProps: {
                      label: 'Город',
                      placeholder: 'Сначала выберите регион',
                      options: '$dataSource(EMPTY_OPTIONS)',
                      testId: 'registrationAddress-city',
                    },
                  },
                ],
              },
              {
                component: '$component(Box)',
                componentProps: {
                  className: GRID_3,
                },
                children: [
                  {
                    model: '$model(registrationAddress.street)',
                    component: '$component(Input)',
                    componentProps: {
                      label: 'Улица',
                      placeholder: 'Введите улицу',
                      testId: 'registrationAddress-street',
                    },
                  },
                  {
                    model: '$model(registrationAddress.house)',
                    component: '$component(Input)',
                    componentProps: {
                      label: 'Дом',
                      placeholder: '№',
                      testId: 'registrationAddress-house',
                    },
                  },
                  {
                    model: '$model(registrationAddress.apartment)',
                    component: '$component(Input)',
                    componentProps: {
                      label: 'Квартира',
                      placeholder: '№',
                      testId: 'registrationAddress-apartment',
                    },
                  },
                ],
              },
              {
                model: '$model(registrationAddress.postalCode)',
                component: '$component(InputMask)',
                componentProps: {
                  label: 'Индекс',
                  mask: '999999',
                  placeholder: '000000',
                  testId: 'registrationAddress-postalCode',
                },
              },
            ],
          },
          {
            model: '$model(sameAsRegistration)',
            component: '$component(Checkbox)',
            componentProps: {
              label: 'Адрес проживания совпадает с адресом регистрации',
              testId: 'sameAsRegistration',
            },
          },
          {
            selector: 'residence-section',
            component: '$component(Section)',
            componentProps: {
              title: 'Адрес проживания',
              titleAs: 'h3',
              titleClassName: SECTION_TITLE,
              className: 'space-y-4',
            },
            children: [
              {
                component: '$component(Box)',
                componentProps: {
                  className: GRID_2,
                },
                children: [
                  {
                    selector: 'residence-region',
                    model: '$model(residenceAddress.region)',
                    component: '$component(Select)',
                    componentProps: {
                      label: 'Регион',
                      placeholder: 'Введите регион',
                      options: '$dataSource(REGIONS)',
                      testId: 'residenceAddress-region',
                    },
                  },
                  {
                    selector: 'residence-city',
                    model: '$model(residenceAddress.city)',
                    component: '$component(Select)',
                    componentProps: {
                      label: 'Город',
                      placeholder: 'Сначала выберите регион',
                      options: '$dataSource(EMPTY_OPTIONS)',
                      testId: 'residenceAddress-city',
                    },
                  },
                ],
              },
              {
                component: '$component(Box)',
                componentProps: {
                  className: GRID_3,
                },
                children: [
                  {
                    model: '$model(residenceAddress.street)',
                    component: '$component(Input)',
                    componentProps: {
                      label: 'Улица',
                      testId: 'residenceAddress-street',
                    },
                  },
                  {
                    model: '$model(residenceAddress.house)',
                    component: '$component(Input)',
                    componentProps: {
                      label: 'Дом',
                      testId: 'residenceAddress-house',
                    },
                  },
                  {
                    model: '$model(residenceAddress.apartment)',
                    component: '$component(Input)',
                    componentProps: {
                      label: 'Квартира',
                      testId: 'residenceAddress-apartment',
                    },
                  },
                ],
              },
              {
                model: '$model(residenceAddress.postalCode)',
                component: '$component(InputMask)',
                componentProps: {
                  label: 'Индекс',
                  mask: '999999',
                  testId: 'residenceAddress-postalCode',
                },
              },
            ],
          },
        ],
      },
      /* ============================ Шаг 4 ============================ */
      {
        selector: 'employment',
        component: '$component(Step)',
        componentProps: {
          title: 'Работа',
          icon: '💼',
        },
        children: [
          {
            model: '$model(employmentStatus)',
            component: '$component(RadioGroup)',
            componentProps: {
              label: 'Статус занятости',
              options: '$dataSource(EMPLOYMENT_STATUSES)',
              testId: 'employmentStatus',
            },
          },
          {
            selector: 'employed-section',
            component: '$component(Section)',
            componentProps: {
              title: 'Работа по найму',
              titleAs: 'h3',
              titleClassName: SECTION_TITLE,
              className: 'space-y-4',
            },
            children: [
              {
                component: '$component(Box)',
                componentProps: {
                  className: GRID_2,
                },
                children: [
                  {
                    model: '$model(companyName)',
                    component: '$component(Input)',
                    componentProps: {
                      label: 'Название компании',
                      placeholder: 'Введите название',
                      testId: 'companyName',
                    },
                  },
                  {
                    model: '$model(companyInn)',
                    component: '$component(InputMask)',
                    componentProps: {
                      label: 'ИНН компании',
                      mask: '9999999999',
                      placeholder: '1234567890',
                      testId: 'companyInn',
                    },
                  },
                  {
                    model: '$model(companyPhone)',
                    component: '$component(InputMask)',
                    componentProps: {
                      label: 'Телефон компании',
                      mask: '+7 (999) 999-99-99',
                      testId: 'companyPhone',
                    },
                  },
                  {
                    model: '$model(position)',
                    component: '$component(Input)',
                    componentProps: {
                      label: 'Должность',
                      placeholder: 'Ваша должность',
                      testId: 'position',
                    },
                  },
                ],
              },
              {
                model: '$model(companyAddress)',
                component: '$component(Input)',
                componentProps: {
                  label: 'Адрес компании',
                  placeholder: 'Полный адрес',
                  testId: 'companyAddress',
                },
              },
            ],
          },
          {
            selector: 'self-employed-section',
            component: '$component(Section)',
            componentProps: {
              title: 'Собственный бизнес',
              titleAs: 'h3',
              titleClassName: SECTION_TITLE,
              className: 'space-y-4',
            },
            children: [
              {
                component: '$component(Box)',
                componentProps: {
                  className: GRID_2,
                },
                children: [
                  {
                    model: '$model(businessType)',
                    component: '$component(Input)',
                    componentProps: {
                      label: 'Тип бизнеса',
                      placeholder: 'ИП, ООО и т.д.',
                      testId: 'businessType',
                    },
                  },
                  {
                    model: '$model(businessInn)',
                    component: '$component(InputMask)',
                    componentProps: {
                      label: 'ИНН ИП',
                      mask: '999999999999',
                      placeholder: '123456789012',
                      testId: 'businessInn',
                    },
                  },
                ],
              },
              {
                model: '$model(businessActivity)',
                component: '$component(Textarea)',
                componentProps: {
                  label: 'Вид деятельности',
                  placeholder: 'Опишите вид деятельности',
                  rows: 3,
                  testId: 'businessActivity',
                },
              },
            ],
          },
          {
            selector: 'self-employed-hint',
            component: '$html(div)',
            componentProps: {
              className: HINT_BOX,
            },
            children: [
              {
                component: '$html(b)',
                children: ['Подтверждение дохода для ИП.'],
              },
              ' Понадобятся налоговая декларация за последний период и выписка по расчётному счёту.',
            ],
          },
          {
            component: '$component(Section)',
            componentProps: {
              title: 'Стаж',
              titleAs: 'h3',
              titleClassName: SECTION_TITLE,
              className: 'space-y-4',
            },
            children: [
              {
                component: '$component(Box)',
                componentProps: {
                  className: GRID_2,
                },
                children: [
                  {
                    model: '$model(workExperienceTotal)',
                    component: '$component(InputNumber)',
                    componentProps: {
                      label: 'Общий стаж работы (месяцев)',
                      min: 0,
                      testId: 'workExperienceTotal',
                    },
                  },
                  {
                    model: '$model(workExperienceCurrent)',
                    component: '$component(InputNumber)',
                    componentProps: {
                      label: 'Стаж на текущем месте (месяцев)',
                      min: 0,
                      testId: 'workExperienceCurrent',
                    },
                  },
                ],
              },
            ],
          },
          {
            selector: 'warn-experience',
            component: '$html(div)',
            componentProps: {
              className: WARN_BOX,
            },
            children: ['Малый стаж на текущем месте работы — заявку рассмотрят внимательнее.'],
          },
          {
            component: '$component(Section)',
            componentProps: {
              title: 'Доход',
              titleAs: 'h3',
              titleClassName: SECTION_TITLE,
              className: 'space-y-4',
            },
            children: [
              {
                component: '$component(Box)',
                componentProps: {
                  className: GRID_2,
                },
                children: [
                  {
                    model: '$model(monthlyIncome)',
                    component: '$component(InputNumber)',
                    componentProps: {
                      label: 'Ежемесячный доход (₽)',
                      min: 0,
                      testId: 'monthlyIncome',
                    },
                  },
                  {
                    model: '$model(additionalIncome)',
                    component: '$component(InputNumber)',
                    componentProps: {
                      label: 'Дополнительный доход (₽)',
                      min: 0,
                      testId: 'additionalIncome',
                    },
                  },
                ],
              },
              {
                selector: 'additional-income-source',
                model: '$model(additionalIncomeSource)',
                component: '$component(Input)',
                componentProps: {
                  label: 'Источник дополнительного дохода',
                  placeholder: 'Опишите источник',
                  testId: 'additionalIncomeSource',
                },
              },
              {
                component: '$component(Box)',
                componentProps: {
                  className: GRID_2,
                },
                children: [
                  {
                    selector: 'totalIncome',
                    model: '$model(totalIncome)',
                    component: '$component(InputNumber)',
                    componentProps: {
                      label: 'Общий доход (₽)',
                      testId: 'totalIncome',
                    },
                  },
                  {
                    selector: 'paymentToIncomeRatio',
                    model: '$model(paymentToIncomeRatio)',
                    component: '$component(InputNumber)',
                    componentProps: {
                      label: 'Платёж от дохода (%)',
                      testId: 'paymentToIncomeRatio',
                    },
                  },
                ],
              },
            ],
          },
          {
            selector: 'warn-debt-load',
            component: '$html(div)',
            componentProps: {
              className: WARN_BOX,
            },
            children: [
              {
                component: '$html(b)',
                children: ['Высокая долговая нагрузка.'],
              },
              ' Платёж составляет ',
              '$model(paymentToIncomeRatio)',
              ' % от дохода.',
            ],
          },
        ],
      },
      /* ============================ Шаг 5 ============================ */
      {
        selector: 'additional',
        component: '$component(Step)',
        componentProps: {
          title: 'Дополнительно',
          icon: '📋',
        },
        children: [
          {
            component: '$component(Section)',
            componentProps: {
              title: 'Личное',
              titleAs: 'h3',
              titleClassName: SECTION_TITLE,
              className: 'space-y-4',
            },
            children: [
              {
                component: '$component(Box)',
                componentProps: {
                  className: GRID_3,
                },
                children: [
                  {
                    model: '$model(maritalStatus)',
                    component: '$component(RadioGroup)',
                    componentProps: {
                      label: 'Семейное положение',
                      options: '$dataSource(MARITAL_STATUSES)',
                      testId: 'maritalStatus',
                    },
                  },
                  {
                    model: '$model(dependents)',
                    component: '$component(InputNumber)',
                    componentProps: {
                      label: 'Количество иждивенцев',
                      min: 0,
                      max: 10,
                      testId: 'dependents',
                    },
                  },
                  {
                    model: '$model(education)',
                    component: '$component(Select)',
                    componentProps: {
                      label: 'Образование',
                      placeholder: 'Выберите уровень образования',
                      options: '$dataSource(EDUCATION_LEVELS)',
                      testId: 'education',
                    },
                  },
                ],
              },
            ],
          },
          {
            model: '$model(hasProperty)',
            component: '$component(Checkbox)',
            componentProps: {
              label: 'У меня есть имущество',
              testId: 'hasProperty',
            },
          },
          {
            selector: 'properties-array',
            model: '$model(properties)',
            component: '$component(FormArray)',
            componentProps: {
              title: 'Имущество',
              addButtonLabel: '+ Добавить имущество',
              emptyMessage: 'Нажмите «Добавить имущество»',
              itemLabel: '$fn(propertyItemLabel)',
            },
            item: {
              $template: {
                component: '$component(Box)',
                componentProps: {
                  className: 'space-y-3',
                },
                children: [
                  {
                    component: '$component(Box)',
                    componentProps: {
                      className: GRID_2,
                    },
                    children: [
                      {
                        model: '$model(type)',
                        component: '$component(Select)',
                        componentProps: {
                          label: 'Тип имущества',
                          placeholder: 'Выберите тип',
                          options: '$dataSource(PROPERTY_TYPES)',
                          testId: 'type',
                        },
                      },
                      {
                        model: '$model(estimatedValue)',
                        component: '$component(InputNumber)',
                        componentProps: {
                          label: 'Оценочная стоимость (₽)',
                          min: 0,
                          testId: 'estimatedValue',
                        },
                      },
                    ],
                  },
                  {
                    model: '$model(description)',
                    component: '$component(Textarea)',
                    componentProps: {
                      label: 'Описание',
                      placeholder: 'Опишите имущество',
                      rows: 2,
                      testId: 'description',
                    },
                  },
                  {
                    model: '$model(hasEncumbrance)',
                    component: '$component(Checkbox)',
                    componentProps: {
                      label: 'Имеется обременение (залог)',
                      testId: 'hasEncumbrance',
                    },
                  },
                ],
              },
            },
          },
          {
            model: '$model(hasExistingLoans)',
            component: '$component(Checkbox)',
            componentProps: {
              label: 'У меня есть другие кредиты',
              testId: 'hasExistingLoans',
            },
          },
          {
            selector: 'existing-loans-hint',
            component: '$html(div)',
            componentProps: {
              className: HINT_BOX,
            },
            children: [
              'Действующие кредиты учитываются при расчёте долговой нагрузки и могут повлиять на решение по заявке.',
            ],
          },
          {
            selector: 'existing-loans-array',
            model: '$model(existingLoans)',
            component: '$component(FormArray)',
            componentProps: {
              title: 'Действующие кредиты',
              addButtonLabel: '+ Добавить кредит',
              emptyMessage: 'Нажмите «Добавить кредит»',
              itemLabel: '$fn(loanItemLabel)',
            },
            item: {
              $template: {
                component: '$component(Box)',
                componentProps: {
                  className: 'space-y-3',
                },
                children: [
                  {
                    component: '$component(Box)',
                    componentProps: {
                      className: GRID_2,
                    },
                    children: [
                      {
                        model: '$model(bank)',
                        component: '$component(Select)',
                        componentProps: {
                          label: 'Банк',
                          placeholder: 'Название банка',
                          options: '$dataSource(BANKS)',
                          testId: 'bank',
                        },
                      },
                      {
                        model: '$model(type)',
                        component: '$component(Select)',
                        componentProps: {
                          label: 'Тип кредита',
                          placeholder: 'Тип кредита',
                          options: '$dataSource(LOAN_KINDS)',
                          testId: 'type',
                        },
                      },
                    ],
                  },
                  {
                    component: '$component(Box)',
                    componentProps: {
                      className: GRID_3,
                    },
                    children: [
                      {
                        model: '$model(amount)',
                        component: '$component(InputNumber)',
                        componentProps: {
                          label: 'Сумма кредита (₽)',
                          min: 0,
                          testId: 'amount',
                        },
                      },
                      {
                        model: '$model(remainingAmount)',
                        component: '$component(InputNumber)',
                        componentProps: {
                          label: 'Остаток задолженности (₽)',
                          min: 0,
                          testId: 'remainingAmount',
                        },
                      },
                      {
                        model: '$model(monthlyPayment)',
                        component: '$component(InputNumber)',
                        componentProps: {
                          label: 'Ежемесячный платёж (₽)',
                          min: 0,
                          testId: 'monthlyPayment',
                        },
                      },
                    ],
                  },
                  {
                    model: '$model(maturityDate)',
                    component: '$component(Input)',
                    componentProps: {
                      label: 'Дата погашения',
                      type: 'date',
                      testId: 'maturityDate',
                    },
                  },
                ],
              },
            },
          },
          {
            model: '$model(hasCoBorrower)',
            component: '$component(Checkbox)',
            componentProps: {
              label: 'Добавить созаемщика',
              testId: 'hasCoBorrower',
            },
          },
          {
            selector: 'co-borrowers-array',
            model: '$model(coBorrowers)',
            component: '$component(FormArray)',
            componentProps: {
              title: 'Созаемщики',
              addButtonLabel: '+ Добавить созаемщика',
              emptyMessage: 'Нажмите «Добавить созаемщика»',
              itemLabel: '$fn(coBorrowerItemLabel)',
            },
            item: {
              $template: {
                component: '$component(Box)',
                componentProps: {
                  className: 'space-y-3',
                },
                children: [
                  {
                    component: '$component(Box)',
                    componentProps: {
                      className: GRID_3,
                    },
                    children: [
                      {
                        model: '$model(personalData.lastName)',
                        component: '$component(Input)',
                        componentProps: {
                          label: 'Фамилия',
                          testId: 'personalData-lastName',
                        },
                      },
                      {
                        model: '$model(personalData.firstName)',
                        component: '$component(Input)',
                        componentProps: {
                          label: 'Имя',
                          testId: 'personalData-firstName',
                        },
                      },
                      {
                        model: '$model(personalData.middleName)',
                        component: '$component(Input)',
                        componentProps: {
                          label: 'Отчество',
                          testId: 'personalData-middleName',
                        },
                      },
                    ],
                  },
                  {
                    component: '$component(Box)',
                    componentProps: {
                      className: GRID_3,
                    },
                    children: [
                      {
                        model: '$model(personalData.birthDate)',
                        component: '$component(Input)',
                        componentProps: {
                          label: 'Дата рождения',
                          type: 'date',
                          testId: 'personalData-birthDate',
                        },
                      },
                      {
                        model: '$model(personalData.gender)',
                        component: '$component(RadioGroup)',
                        componentProps: {
                          label: 'Пол',
                          options: '$dataSource(GENDERS)',
                          className: '!flex-row gap-6',
                          testId: 'personalData-gender',
                        },
                      },
                      {
                        model: '$model(personalData.birthPlace)',
                        component: '$component(Input)',
                        componentProps: {
                          label: 'Место рождения',
                          testId: 'personalData-birthPlace',
                        },
                      },
                    ],
                  },
                  {
                    component: '$component(Box)',
                    componentProps: {
                      className: GRID_2,
                    },
                    children: [
                      {
                        model: '$model(phone)',
                        component: '$component(InputMask)',
                        componentProps: {
                          label: 'Телефон',
                          mask: '+7 (999) 999-99-99',
                          testId: 'phone',
                        },
                      },
                      {
                        model: '$model(email)',
                        component: '$component(Input)',
                        componentProps: {
                          label: 'Email',
                          type: 'email',
                          placeholder: 'example@mail.com',
                          testId: 'email',
                        },
                      },
                      {
                        model: '$model(relationship)',
                        component: '$component(Input)',
                        componentProps: {
                          label: 'Родство',
                          placeholder: 'Укажите родство',
                          testId: 'relationship',
                        },
                      },
                      {
                        model: '$model(monthlyIncome)',
                        component: '$component(InputNumber)',
                        componentProps: {
                          label: 'Ежемесячный доход (₽)',
                          min: 0,
                          testId: 'monthlyIncome',
                        },
                      },
                    ],
                  },
                ],
              },
            },
          },
          {
            selector: 'coBorrowersIncome',
            model: '$model(coBorrowersIncome)',
            component: '$component(InputNumber)',
            componentProps: {
              label: 'Доход созаемщиков (₽)',
              testId: 'coBorrowersIncome',
            },
          },
        ],
      },
      /* ============================ Шаг 6 ============================ */
      {
        selector: 'confirm',
        component: '$component(Step)',
        componentProps: {
          title: 'Подтверждение',
          icon: '✓',
        },
        children: [
          {
            component: '$html(div)',
            componentProps: {
              className: 'p-4 rounded-md border bg-muted/40',
            },
            children: [
              {
                component: '$html(h4)',
                componentProps: {
                  className: 'text-base font-semibold mb-3',
                },
                children: ['Проверьте заявку'],
              },
              {
                component: '$html(dl)',
                componentProps: {
                  className: 'grid grid-cols-2 gap-2 text-sm',
                },
                children: [
                  {
                    component: '$html(dt)',
                    children: ['Заявитель'],
                  },
                  {
                    component: '$html(dd)',
                    componentProps: {
                      className: 'font-medium',
                    },
                    children: ['$model(fullName)'],
                  },
                  {
                    component: '$html(dt)',
                    children: ['Запрошенная сумма'],
                  },
                  {
                    component: '$html(dd)',
                    componentProps: {
                      className: 'font-medium',
                    },
                    children: ['$model(loanAmount)', ' ₽ на ', '$model(loanTerm)', ' мес.'],
                  },
                  {
                    component: '$html(dt)',
                    children: ['Ставка'],
                  },
                  {
                    component: '$html(dd)',
                    componentProps: {
                      className: 'font-medium',
                    },
                    children: ['$model(interestRate)', ' %'],
                  },
                  {
                    component: '$html(dt)',
                    children: ['Ежемесячный платёж'],
                  },
                  {
                    component: '$html(dd)',
                    componentProps: {
                      className: 'font-medium',
                    },
                    children: ['$model(monthlyPayment)', ' ₽'],
                  },
                  {
                    component: '$html(dt)',
                    children: ['Общий доход'],
                  },
                  {
                    component: '$html(dd)',
                    componentProps: {
                      className: 'font-medium',
                    },
                    children: ['$model(totalIncome)', ' ₽'],
                  },
                ],
              },
            ],
          },
          {
            component: '$html(hr)',
          },
          {
            component: '$component(Section)',
            componentProps: {
              title: 'Согласия',
              titleAs: 'h3',
              titleClassName: SECTION_TITLE,
              className: 'space-y-3',
            },
            children: [
              {
                model: '$model(agreePersonalData)',
                component: '$component(Checkbox)',
                componentProps: {
                  label: 'Согласие на обработку персональных данных',
                  testId: 'agreePersonalData',
                },
              },
              {
                model: '$model(agreeCreditHistory)',
                component: '$component(Checkbox)',
                componentProps: {
                  label: 'Согласие на проверку кредитной истории',
                  testId: 'agreeCreditHistory',
                },
              },
              {
                model: '$model(agreeMarketing)',
                component: '$component(Checkbox)',
                componentProps: {
                  label: 'Согласие на получение маркетинговых материалов',
                  testId: 'agreeMarketing',
                },
              },
              {
                model: '$model(agreeTerms)',
                component: '$component(Checkbox)',
                componentProps: {
                  label: 'Согласие с условиями кредитования',
                  testId: 'agreeTerms',
                },
              },
            ],
          },
          {
            component: '$component(Section)',
            componentProps: {
              title: 'Подтверждение',
              titleAs: 'h3',
              titleClassName: SECTION_TITLE,
              className: 'space-y-3',
            },
            children: [
              {
                model: '$model(confirmAccuracy)',
                component: '$component(Checkbox)',
                componentProps: {
                  label: 'Подтверждаю точность введённых данных',
                  testId: 'confirmAccuracy',
                },
              },
              {
                model: '$model(electronicSignature)',
                component: '$component(InputMask)',
                componentProps: {
                  label: 'Код подтверждения из СМС',
                  mask: '999999',
                  placeholder: '123456',
                  testId: 'electronicSignature',
                },
              },
            ],
          },
        ],
      },
    ],
  },
});
