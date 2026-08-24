/**
 * Layout формы в JSON-DSL. Только разметка: валидаторов в JSON нет
 * (оператора `$validator(...)` не существует), поведение — тоже отдельно.
 *
 * `defineJsonSchema<T>` типизирует пути `$model(...)` по форме модели:
 * опечатка внутри оператора — ошибка компиляции, а не тихий баг в рантайме.
 *
 * Шаги wizard-а лежат в `componentProps.steps` (НЕ в `children`), каждый —
 * container-нода `$component(Step)` c `componentProps.title/icon`.
 */
import { defineJsonSchema } from '@reformer/renderer-json';

import type { CreditApplicationForm } from './types';

const GRID_2 = 'grid grid-cols-1 md:grid-cols-2 gap-4';
const GRID_3 = 'grid grid-cols-1 md:grid-cols-3 gap-4';
const SECTION_TITLE = 'text-lg font-semibold';
const HINT_BOX = 'p-4 rounded-md border border-blue-200 bg-blue-50 text-sm text-blue-900';
const WARN_BOX = 'p-4 rounded-md border border-amber-300 bg-amber-50 text-sm text-amber-900';

export const creditFormSchema = defineJsonSchema<CreditApplicationForm>({
  version: '1.0',
  root: {
    selector: 'wizard',
    component: '$component(Wizard)',
    componentProps: {
      className: 'bg-card text-card-foreground p-6 rounded-lg border',
      steps: [
        /* ============================ Шаг 1 ============================ */
        {
          selector: 'loan',
          component: '$component(Step)',
          componentProps: { title: 'Кредит', icon: '💰' },
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
                  componentProps: { className: GRID_3 },
                  children: [
                    {
                      selector: 'loanType',
                      value: '$model(loanType)',
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
                      value: '$model(loanAmount)',
                      component: '$component(Input)',
                      componentProps: {
                        label: 'Сумма кредита (₽)',
                        type: 'number',
                        placeholder: 'Введите сумму',
                        min: 50000,
                        max: 10000000,
                        testId: 'loanAmount',
                      },
                    },
                    {
                      selector: 'loanTerm',
                      value: '$model(loanTerm)',
                      component: '$component(Input)',
                      componentProps: {
                        label: 'Срок кредита (месяцев)',
                        type: 'number',
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
                  value: '$model(loanPurpose)',
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

            /* --- ипотека --- */
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
                  componentProps: { className: GRID_2 },
                  children: [
                    {
                      selector: 'propertyValue',
                      value: '$model(propertyValue)',
                      component: '$component(Input)',
                      componentProps: {
                        label: 'Стоимость недвижимости (₽)',
                        type: 'number',
                        placeholder: 'Введите стоимость',
                        min: 1000000,
                        testId: 'propertyValue',
                      },
                    },
                    {
                      selector: 'initialPayment',
                      value: '$model(initialPayment)',
                      component: '$component(Input)',
                      componentProps: {
                        label: 'Первоначальный взнос (₽) — 20 % от стоимости',
                        type: 'number',
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
              componentProps: { className: HINT_BOX },
              children: [
                { component: '$html(b)', children: ['Документы на недвижимость.'] },
                ' Подготовьте выписку из ЕГРН, отчёт об оценке и договор купли-продажи.',
              ],
            },

            /* --- автокредит --- */
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
                  componentProps: { className: GRID_2 },
                  children: [
                    {
                      selector: 'carBrand',
                      value: '$model(carBrand)',
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
                      value: '$model(carModel)',
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
                      value: '$model(carYear)',
                      component: '$component(Input)',
                      componentProps: {
                        label: 'Год выпуска',
                        type: 'number',
                        placeholder: '2020',
                        min: 2000,
                        max: '$dataSource(CURRENT_YEAR_PLUS_ONE)',
                        testId: 'carYear',
                      },
                    },
                    {
                      selector: 'carPrice',
                      value: '$model(carPrice)',
                      component: '$component(Input)',
                      componentProps: {
                        label: 'Стоимость автомобиля (₽)',
                        type: 'number',
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

            /* --- предварительный расчёт (вычисляемые поля) --- */
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
                  componentProps: { className: GRID_2 },
                  children: [
                    {
                      selector: 'interestRate',
                      value: '$model(interestRate)',
                      component: '$component(Input)',
                      componentProps: {
                        label: 'Процентная ставка (%)',
                        type: 'number',
                        testId: 'interestRate',
                      },
                    },
                    {
                      selector: 'monthlyPayment',
                      value: '$model(monthlyPayment)',
                      component: '$component(Input)',
                      componentProps: {
                        label: 'Ежемесячный платёж (₽)',
                        type: 'number',
                        testId: 'monthlyPayment',
                      },
                    },
                  ],
                },
                {
                  component: '$html(p)',
                  componentProps: { className: 'text-sm text-muted-foreground' },
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
          componentProps: { title: 'Заявитель', icon: '🧑' },
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
                  componentProps: { className: GRID_3 },
                  children: [
                    {
                      value: '$model(personalData.lastName)',
                      component: '$component(Input)',
                      componentProps: {
                        label: 'Фамилия',
                        placeholder: 'Введите фамилию',
                        testId: 'personalData-lastName',
                      },
                    },
                    {
                      value: '$model(personalData.firstName)',
                      component: '$component(Input)',
                      componentProps: {
                        label: 'Имя',
                        placeholder: 'Введите имя',
                        testId: 'personalData-firstName',
                      },
                    },
                    {
                      value: '$model(personalData.middleName)',
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
                  componentProps: { className: GRID_3 },
                  children: [
                    {
                      value: '$model(personalData.birthDate)',
                      component: '$component(Input)',
                      componentProps: {
                        label: 'Дата рождения',
                        type: 'date',
                        testId: 'personalData-birthDate',
                      },
                    },
                    {
                      value: '$model(personalData.gender)',
                      component: '$component(RadioGroup)',
                      componentProps: {
                        label: 'Пол',
                        options: '$dataSource(GENDERS)',
                        className: '!flex-row gap-6',
                        testId: 'personalData-gender',
                      },
                    },
                    {
                      value: '$model(personalData.birthPlace)',
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
                  componentProps: { className: GRID_2 },
                  children: [
                    {
                      selector: 'fullName',
                      value: '$model(fullName)',
                      component: '$component(Input)',
                      componentProps: { label: 'Полное имя', testId: 'fullName' },
                    },
                    {
                      selector: 'age',
                      value: '$model(age)',
                      component: '$component(Input)',
                      componentProps: { label: 'Возраст (лет)', type: 'number', testId: 'age' },
                    },
                  ],
                },
              ],
            },
            {
              selector: 'warn-age',
              component: '$html(div)',
              componentProps: { className: WARN_BOX },
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
                  componentProps: { className: GRID_3 },
                  children: [
                    {
                      value: '$model(passportData.series)',
                      component: '$component(InputMask)',
                      componentProps: {
                        label: 'Серия паспорта',
                        mask: '99 99',
                        placeholder: '12 34',
                        testId: 'passportData-series',
                      },
                    },
                    {
                      value: '$model(passportData.number)',
                      component: '$component(InputMask)',
                      componentProps: {
                        label: 'Номер паспорта',
                        mask: '999999',
                        placeholder: '123456',
                        testId: 'passportData-number',
                      },
                    },
                    {
                      value: '$model(passportData.departmentCode)',
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
                  componentProps: { className: GRID_2 },
                  children: [
                    {
                      value: '$model(passportData.issueDate)',
                      component: '$component(Input)',
                      componentProps: {
                        label: 'Дата выдачи',
                        type: 'date',
                        testId: 'passportData-issueDate',
                      },
                    },
                    {
                      value: '$model(passportData.issuedBy)',
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
                  componentProps: { className: GRID_2 },
                  children: [
                    {
                      value: '$model(inn)',
                      component: '$component(InputMask)',
                      componentProps: {
                        label: 'ИНН',
                        mask: '999999999999',
                        placeholder: '123456789012',
                        testId: 'inn',
                      },
                    },
                    {
                      value: '$model(snils)',
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
          componentProps: { title: 'Контакты', icon: '📞' },
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
                  componentProps: { className: GRID_2 },
                  children: [
                    {
                      value: '$model(phoneMain)',
                      component: '$component(InputMask)',
                      componentProps: {
                        label: 'Основной телефон',
                        mask: '+7 (999) 999-99-99',
                        testId: 'phoneMain',
                      },
                    },
                    {
                      value: '$model(phoneAdditional)',
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
                  componentProps: { className: GRID_2 },
                  children: [
                    {
                      value: '$model(email)',
                      component: '$component(Input)',
                      componentProps: {
                        label: 'Email',
                        type: 'email',
                        placeholder: 'example@mail.com',
                        testId: 'email',
                      },
                    },
                    {
                      value: '$model(emailAdditional)',
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
                  value: '$model(sameEmail)',
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
                  componentProps: { className: GRID_2 },
                  children: [
                    {
                      selector: 'registration-region',
                      value: '$model(registrationAddress.region)',
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
                      value: '$model(registrationAddress.city)',
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
                  componentProps: { className: GRID_3 },
                  children: [
                    {
                      value: '$model(registrationAddress.street)',
                      component: '$component(Input)',
                      componentProps: {
                        label: 'Улица',
                        placeholder: 'Введите улицу',
                        testId: 'registrationAddress-street',
                      },
                    },
                    {
                      value: '$model(registrationAddress.house)',
                      component: '$component(Input)',
                      componentProps: {
                        label: 'Дом',
                        placeholder: '№',
                        testId: 'registrationAddress-house',
                      },
                    },
                    {
                      value: '$model(registrationAddress.apartment)',
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
                  value: '$model(registrationAddress.postalCode)',
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
              value: '$model(sameAsRegistration)',
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
                  componentProps: { className: GRID_2 },
                  children: [
                    {
                      selector: 'residence-region',
                      value: '$model(residenceAddress.region)',
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
                      value: '$model(residenceAddress.city)',
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
                  componentProps: { className: GRID_3 },
                  children: [
                    {
                      value: '$model(residenceAddress.street)',
                      component: '$component(Input)',
                      componentProps: { label: 'Улица', testId: 'residenceAddress-street' },
                    },
                    {
                      value: '$model(residenceAddress.house)',
                      component: '$component(Input)',
                      componentProps: { label: 'Дом', testId: 'residenceAddress-house' },
                    },
                    {
                      value: '$model(residenceAddress.apartment)',
                      component: '$component(Input)',
                      componentProps: { label: 'Квартира', testId: 'residenceAddress-apartment' },
                    },
                  ],
                },
                {
                  value: '$model(residenceAddress.postalCode)',
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
          componentProps: { title: 'Работа', icon: '💼' },
          children: [
            {
              value: '$model(employmentStatus)',
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
                  componentProps: { className: GRID_2 },
                  children: [
                    {
                      value: '$model(companyName)',
                      component: '$component(Input)',
                      componentProps: {
                        label: 'Название компании',
                        placeholder: 'Введите название',
                        testId: 'companyName',
                      },
                    },
                    {
                      value: '$model(companyInn)',
                      component: '$component(InputMask)',
                      componentProps: {
                        label: 'ИНН компании',
                        mask: '9999999999',
                        placeholder: '1234567890',
                        testId: 'companyInn',
                      },
                    },
                    {
                      value: '$model(companyPhone)',
                      component: '$component(InputMask)',
                      componentProps: {
                        label: 'Телефон компании',
                        mask: '+7 (999) 999-99-99',
                        testId: 'companyPhone',
                      },
                    },
                    {
                      value: '$model(position)',
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
                  value: '$model(companyAddress)',
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
                  componentProps: { className: GRID_2 },
                  children: [
                    {
                      value: '$model(businessType)',
                      component: '$component(Input)',
                      componentProps: {
                        label: 'Тип бизнеса',
                        placeholder: 'ИП, ООО и т.д.',
                        testId: 'businessType',
                      },
                    },
                    {
                      value: '$model(businessInn)',
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
                  value: '$model(businessActivity)',
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
              componentProps: { className: HINT_BOX },
              children: [
                { component: '$html(b)', children: ['Подтверждение дохода для ИП.'] },
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
                  componentProps: { className: GRID_2 },
                  children: [
                    {
                      value: '$model(workExperienceTotal)',
                      component: '$component(Input)',
                      componentProps: {
                        label: 'Общий стаж работы (месяцев)',
                        type: 'number',
                        min: 0,
                        testId: 'workExperienceTotal',
                      },
                    },
                    {
                      value: '$model(workExperienceCurrent)',
                      component: '$component(Input)',
                      componentProps: {
                        label: 'Стаж на текущем месте (месяцев)',
                        type: 'number',
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
              componentProps: { className: WARN_BOX },
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
                  componentProps: { className: GRID_2 },
                  children: [
                    {
                      value: '$model(monthlyIncome)',
                      component: '$component(Input)',
                      componentProps: {
                        label: 'Ежемесячный доход (₽)',
                        type: 'number',
                        min: 0,
                        testId: 'monthlyIncome',
                      },
                    },
                    {
                      value: '$model(additionalIncome)',
                      component: '$component(Input)',
                      componentProps: {
                        label: 'Дополнительный доход (₽)',
                        type: 'number',
                        min: 0,
                        testId: 'additionalIncome',
                      },
                    },
                  ],
                },
                {
                  selector: 'additional-income-source',
                  value: '$model(additionalIncomeSource)',
                  component: '$component(Input)',
                  componentProps: {
                    label: 'Источник дополнительного дохода',
                    placeholder: 'Опишите источник',
                    testId: 'additionalIncomeSource',
                  },
                },
                {
                  component: '$component(Box)',
                  componentProps: { className: GRID_2 },
                  children: [
                    {
                      selector: 'totalIncome',
                      value: '$model(totalIncome)',
                      component: '$component(Input)',
                      componentProps: {
                        label: 'Общий доход (₽)',
                        type: 'number',
                        testId: 'totalIncome',
                      },
                    },
                    {
                      selector: 'paymentToIncomeRatio',
                      value: '$model(paymentToIncomeRatio)',
                      component: '$component(Input)',
                      componentProps: {
                        label: 'Платёж от дохода (%)',
                        type: 'number',
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
              componentProps: { className: WARN_BOX },
              children: [
                { component: '$html(b)', children: ['Высокая долговая нагрузка.'] },
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
          componentProps: { title: 'Дополнительно', icon: '📋' },
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
                  componentProps: { className: GRID_3 },
                  children: [
                    {
                      value: '$model(maritalStatus)',
                      component: '$component(RadioGroup)',
                      componentProps: {
                        label: 'Семейное положение',
                        options: '$dataSource(MARITAL_STATUSES)',
                        testId: 'maritalStatus',
                      },
                    },
                    {
                      value: '$model(dependents)',
                      component: '$component(Input)',
                      componentProps: {
                        label: 'Количество иждивенцев',
                        type: 'number',
                        min: 0,
                        max: 10,
                        testId: 'dependents',
                      },
                    },
                    {
                      value: '$model(education)',
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

            /* --- имущество --- */
            {
              value: '$model(hasProperty)',
              component: '$component(Checkbox)',
              componentProps: { label: 'У меня есть имущество', testId: 'hasProperty' },
            },
            {
              selector: 'properties-array',
              array: '$model(properties)',
              component: '$component(FormArray)',
              initialValue: {
                type: 'apartment',
                description: '',
                estimatedValue: 0,
                hasEncumbrance: false,
              },
              componentProps: {
                title: 'Имущество',
                addButtonLabel: '+ Добавить имущество',
                emptyMessage: 'Нажмите «Добавить имущество»',
                itemLabel: '$fn(propertyItemLabel)',
              },
              item: {
                $template: {
                  component: '$component(Box)',
                  componentProps: { className: 'space-y-3' },
                  children: [
                    {
                      component: '$component(Box)',
                      componentProps: { className: GRID_2 },
                      children: [
                        {
                          value: '$model(type)',
                          component: '$component(Select)',
                          componentProps: {
                            label: 'Тип имущества',
                            placeholder: 'Выберите тип',
                            options: '$dataSource(PROPERTY_TYPES)',
                            testId: 'type',
                          },
                        },
                        {
                          value: '$model(estimatedValue)',
                          component: '$component(Input)',
                          componentProps: {
                            label: 'Оценочная стоимость (₽)',
                            type: 'number',
                            min: 0,
                            testId: 'estimatedValue',
                          },
                        },
                      ],
                    },
                    {
                      value: '$model(description)',
                      component: '$component(Textarea)',
                      componentProps: {
                        label: 'Описание',
                        placeholder: 'Опишите имущество',
                        rows: 2,
                        testId: 'description',
                      },
                    },
                    {
                      value: '$model(hasEncumbrance)',
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

            /* --- существующие кредиты --- */
            {
              value: '$model(hasExistingLoans)',
              component: '$component(Checkbox)',
              componentProps: { label: 'У меня есть другие кредиты', testId: 'hasExistingLoans' },
            },
            {
              selector: 'existing-loans-hint',
              component: '$html(div)',
              componentProps: { className: HINT_BOX },
              children: [
                'Действующие кредиты учитываются при расчёте долговой нагрузки и могут повлиять на решение по заявке.',
              ],
            },
            {
              selector: 'existing-loans-array',
              array: '$model(existingLoans)',
              component: '$component(FormArray)',
              initialValue: {
                bank: '',
                type: '',
                amount: 0,
                remainingAmount: 0,
                monthlyPayment: 0,
                maturityDate: '',
              },
              componentProps: {
                title: 'Действующие кредиты',
                addButtonLabel: '+ Добавить кредит',
                emptyMessage: 'Нажмите «Добавить кредит»',
                itemLabel: '$fn(loanItemLabel)',
              },
              item: {
                $template: {
                  component: '$component(Box)',
                  componentProps: { className: 'space-y-3' },
                  children: [
                    {
                      component: '$component(Box)',
                      componentProps: { className: GRID_2 },
                      children: [
                        {
                          value: '$model(bank)',
                          component: '$component(Select)',
                          componentProps: {
                            label: 'Банк',
                            placeholder: 'Название банка',
                            options: '$dataSource(BANKS)',
                            testId: 'bank',
                          },
                        },
                        {
                          value: '$model(type)',
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
                      componentProps: { className: GRID_3 },
                      children: [
                        {
                          value: '$model(amount)',
                          component: '$component(Input)',
                          componentProps: {
                            label: 'Сумма кредита (₽)',
                            type: 'number',
                            min: 0,
                            testId: 'amount',
                          },
                        },
                        {
                          value: '$model(remainingAmount)',
                          component: '$component(Input)',
                          componentProps: {
                            label: 'Остаток задолженности (₽)',
                            type: 'number',
                            min: 0,
                            testId: 'remainingAmount',
                          },
                        },
                        {
                          value: '$model(monthlyPayment)',
                          component: '$component(Input)',
                          componentProps: {
                            label: 'Ежемесячный платёж (₽)',
                            type: 'number',
                            min: 0,
                            testId: 'monthlyPayment',
                          },
                        },
                      ],
                    },
                    {
                      value: '$model(maturityDate)',
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

            /* --- созаемщики --- */
            {
              value: '$model(hasCoBorrower)',
              component: '$component(Checkbox)',
              componentProps: { label: 'Добавить созаемщика', testId: 'hasCoBorrower' },
            },
            {
              selector: 'co-borrowers-array',
              array: '$model(coBorrowers)',
              component: '$component(FormArray)',
              initialValue: {
                personalData: {
                  lastName: '',
                  firstName: '',
                  middleName: '',
                  birthDate: '',
                  gender: 'male',
                  birthPlace: '',
                },
                phone: '',
                email: '',
                relationship: '',
                monthlyIncome: 0,
              },
              componentProps: {
                title: 'Созаемщики',
                addButtonLabel: '+ Добавить созаемщика',
                emptyMessage: 'Нажмите «Добавить созаемщика»',
                itemLabel: '$fn(coBorrowerItemLabel)',
              },
              item: {
                $template: {
                  component: '$component(Box)',
                  componentProps: { className: 'space-y-3' },
                  children: [
                    {
                      component: '$component(Box)',
                      componentProps: { className: GRID_3 },
                      children: [
                        {
                          value: '$model(personalData.lastName)',
                          component: '$component(Input)',
                          componentProps: { label: 'Фамилия', testId: 'personalData-lastName' },
                        },
                        {
                          value: '$model(personalData.firstName)',
                          component: '$component(Input)',
                          componentProps: { label: 'Имя', testId: 'personalData-firstName' },
                        },
                        {
                          value: '$model(personalData.middleName)',
                          component: '$component(Input)',
                          componentProps: { label: 'Отчество', testId: 'personalData-middleName' },
                        },
                      ],
                    },
                    {
                      component: '$component(Box)',
                      componentProps: { className: GRID_3 },
                      children: [
                        {
                          value: '$model(personalData.birthDate)',
                          component: '$component(Input)',
                          componentProps: {
                            label: 'Дата рождения',
                            type: 'date',
                            testId: 'personalData-birthDate',
                          },
                        },
                        {
                          value: '$model(personalData.gender)',
                          component: '$component(RadioGroup)',
                          componentProps: {
                            label: 'Пол',
                            options: '$dataSource(GENDERS)',
                            className: '!flex-row gap-6',
                            testId: 'personalData-gender',
                          },
                        },
                        {
                          value: '$model(personalData.birthPlace)',
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
                      componentProps: { className: GRID_2 },
                      children: [
                        {
                          value: '$model(phone)',
                          component: '$component(InputMask)',
                          componentProps: {
                            label: 'Телефон',
                            mask: '+7 (999) 999-99-99',
                            testId: 'phone',
                          },
                        },
                        {
                          value: '$model(email)',
                          component: '$component(Input)',
                          componentProps: {
                            label: 'Email',
                            type: 'email',
                            placeholder: 'example@mail.com',
                            testId: 'email',
                          },
                        },
                        {
                          value: '$model(relationship)',
                          component: '$component(Input)',
                          componentProps: {
                            label: 'Родство',
                            placeholder: 'Укажите родство',
                            testId: 'relationship',
                          },
                        },
                        {
                          value: '$model(monthlyIncome)',
                          component: '$component(Input)',
                          componentProps: {
                            label: 'Ежемесячный доход (₽)',
                            type: 'number',
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
              value: '$model(coBorrowersIncome)',
              component: '$component(Input)',
              componentProps: {
                label: 'Доход созаемщиков (₽)',
                type: 'number',
                testId: 'coBorrowersIncome',
              },
            },
          ],
        },

        /* ============================ Шаг 6 ============================ */
        {
          selector: 'confirm',
          component: '$component(Step)',
          componentProps: { title: 'Подтверждение', icon: '✓' },
          children: [
            {
              component: '$html(div)',
              componentProps: { className: 'p-4 rounded-md border bg-muted/40' },
              children: [
                {
                  component: '$html(h4)',
                  componentProps: { className: 'text-base font-semibold mb-3' },
                  children: ['Проверьте заявку'],
                },
                {
                  component: '$html(dl)',
                  componentProps: { className: 'grid grid-cols-2 gap-2 text-sm' },
                  children: [
                    { component: '$html(dt)', children: ['Заявитель'] },
                    {
                      component: '$html(dd)',
                      componentProps: { className: 'font-medium' },
                      children: ['$model(fullName)'],
                    },
                    { component: '$html(dt)', children: ['Запрошенная сумма'] },
                    {
                      component: '$html(dd)',
                      componentProps: { className: 'font-medium' },
                      children: ['$model(loanAmount)', ' ₽ на ', '$model(loanTerm)', ' мес.'],
                    },
                    { component: '$html(dt)', children: ['Ставка'] },
                    {
                      component: '$html(dd)',
                      componentProps: { className: 'font-medium' },
                      children: ['$model(interestRate)', ' %'],
                    },
                    { component: '$html(dt)', children: ['Ежемесячный платёж'] },
                    {
                      component: '$html(dd)',
                      componentProps: { className: 'font-medium' },
                      children: ['$model(monthlyPayment)', ' ₽'],
                    },
                    { component: '$html(dt)', children: ['Общий доход'] },
                    {
                      component: '$html(dd)',
                      componentProps: { className: 'font-medium' },
                      children: ['$model(totalIncome)', ' ₽'],
                    },
                  ],
                },
              ],
            },
            { component: '$html(hr)' },
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
                  value: '$model(agreePersonalData)',
                  component: '$component(Checkbox)',
                  componentProps: {
                    label: 'Согласие на обработку персональных данных',
                    testId: 'agreePersonalData',
                  },
                },
                {
                  value: '$model(agreeCreditHistory)',
                  component: '$component(Checkbox)',
                  componentProps: {
                    label: 'Согласие на проверку кредитной истории',
                    testId: 'agreeCreditHistory',
                  },
                },
                {
                  value: '$model(agreeMarketing)',
                  component: '$component(Checkbox)',
                  componentProps: {
                    label: 'Согласие на получение маркетинговых материалов',
                    testId: 'agreeMarketing',
                  },
                },
                {
                  value: '$model(agreeTerms)',
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
                  value: '$model(confirmAccuracy)',
                  component: '$component(Checkbox)',
                  componentProps: {
                    label: 'Подтверждаю точность введённых данных',
                    testId: 'confirmAccuracy',
                  },
                },
                {
                  value: '$model(electronicSignature)',
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
  },
});
