/**
 * JSON form schema (layout) — credit-application iter-8 / target=renderer-json.
 *
 * Authored via MCP create-form (target=renderer-json) + add-wizard (B3) + add-form-array
 * (Path C). Layout-only — option arrays / mask / placeholder live in `schema.ts`'s
 * `createForm` componentProps (rule D1). String-name `options` references here
 * mirror the runtime values via `reg.source(...)` so the JSON tree is
 * self-documenting.
 *
 * Selector convention:
 * - `step1`..`step6` — wizard step containers, toggled by `useEffect setHidden`
 *   in `index.tsx` (B3 orchestration).
 * - sub-section selectors (`mortgage-section`, `car-section`,
 *   `residence-address-section`, `employer-section`, `business-section`,
 *   `properties-array`, `existing-loans-array`, `co-borrowers-array`,
 *   `unemployed-warning`) — toggled via `setHidden` reading form values in
 *   `index.tsx`.
 * - field selectors are dotted-path (`step1.loanAmount`, etc.) per testId convention.
 *
 * FormArraySection uses inline `$template` for itemComponent — converter wraps to FC.
 */

import type { JsonFormSchema } from '@reformer/renderer-json';

export const creditApplicationJsonSchema: JsonFormSchema = {
  version: '1.0',
  root: {
    selector: 'form-root',
    component: 'FormRoot',
    children: [
      // ===================================================================
      // Step 1 — Кредит
      // ===================================================================
      {
        selector: 'step1',
        component: 'Box',
        componentProps: { className: 'bg-white border rounded-xl shadow-sm p-6 space-y-4' },
        children: [
          {
            component: 'Section',
            componentProps: {
              title: 'Шаг 1 — Основная информация о кредите',
              titleAs: 'h2',
              titleClassName: 'text-xl font-bold',
              className: 'space-y-4',
            },
            children: [
              {
                model: 'loanType',
                component: 'Select',
                componentProps: {
                  label: 'Тип кредита',
                  placeholder: 'Выберите тип кредита',
                  options: 'LOAN_TYPES',
                  testId: 'step1.loanType',
                },
              },
              {
                component: 'Box',
                componentProps: { className: 'grid grid-cols-2 gap-4' },
                children: [
                  {
                    model: 'loanAmount',
                    component: 'Input',
                    componentProps: {
                      label: 'Сумма кредита (₽)',
                      placeholder: 'Введите сумму',
                      type: 'number',
                      min: 50000,
                      max: 10000000,
                      step: 10000,
                      testId: 'step1.loanAmount',
                    },
                  },
                  {
                    model: 'loanTerm',
                    component: 'Input',
                    componentProps: {
                      label: 'Срок кредита (месяцев)',
                      placeholder: 'Введите срок',
                      type: 'number',
                      min: 6,
                      max: 240,
                      testId: 'step1.loanTerm',
                    },
                  },
                ],
              },
              {
                model: 'loanPurpose',
                component: 'Textarea',
                componentProps: {
                  label: 'Цель кредита',
                  placeholder: 'Опишите, на что планируете потратить средства',
                  rows: 4,
                  maxLength: 500,
                  testId: 'step1.loanPurpose',
                },
              },
              // Conditional: mortgage section
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
                    component: 'Box',
                    componentProps: { className: 'grid grid-cols-2 gap-4' },
                    children: [
                      {
                        model: 'propertyValue',
                        component: 'Input',
                        componentProps: {
                          label: 'Стоимость недвижимости (₽)',
                          placeholder: 'Введите стоимость',
                          type: 'number',
                          min: 1000000,
                          step: 100000,
                          testId: 'step1.propertyValue',
                        },
                      },
                      {
                        model: 'initialPayment',
                        component: 'Input',
                        componentProps: {
                          label: 'Первоначальный взнос (₽)',
                          placeholder: '20% от стоимости',
                          type: 'number',
                          readOnly: true,
                          testId: 'step1.initialPayment',
                        },
                      },
                    ],
                  },
                ],
              },
              // Conditional: car section
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
                    component: 'Box',
                    componentProps: { className: 'grid grid-cols-2 gap-4' },
                    children: [
                      {
                        model: 'carBrand',
                        component: 'Input',
                        componentProps: {
                          label: 'Марка автомобиля',
                          placeholder: 'Например: Toyota',
                          testId: 'step1.carBrand',
                        },
                      },
                      {
                        model: 'carModel',
                        component: 'Input',
                        componentProps: {
                          label: 'Модель автомобиля',
                          placeholder: 'Например: Camry',
                          testId: 'step1.carModel',
                        },
                      },
                    ],
                  },
                  {
                    component: 'Box',
                    componentProps: { className: 'grid grid-cols-2 gap-4' },
                    children: [
                      {
                        model: 'carYear',
                        component: 'Input',
                        componentProps: {
                          label: 'Год выпуска',
                          placeholder: '2020',
                          type: 'number',
                          min: 2000,
                          testId: 'step1.carYear',
                        },
                      },
                      {
                        model: 'carPrice',
                        component: 'Input',
                        componentProps: {
                          label: 'Стоимость автомобиля (₽)',
                          placeholder: 'Введите стоимость',
                          type: 'number',
                          min: 300000,
                          step: 10000,
                          testId: 'step1.carPrice',
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

      // ===================================================================
      // Step 2 — Персональные данные
      // ===================================================================
      {
        selector: 'step2',
        component: 'Box',
        componentProps: { className: 'bg-white border rounded-xl shadow-sm p-6 space-y-4' },
        children: [
          {
            component: 'Section',
            componentProps: {
              title: 'Шаг 2 — Персональные данные',
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
                        model: 'personalData.lastName',
                        component: 'Input',
                        componentProps: {
                          label: 'Фамилия',
                          placeholder: 'Введите фамилию',
                          testId: 'step2.personalData.lastName',
                        },
                      },
                      {
                        model: 'personalData.firstName',
                        component: 'Input',
                        componentProps: {
                          label: 'Имя',
                          placeholder: 'Введите имя',
                          testId: 'step2.personalData.firstName',
                        },
                      },
                      {
                        model: 'personalData.middleName',
                        component: 'Input',
                        componentProps: {
                          label: 'Отчество',
                          placeholder: 'Введите отчество',
                          testId: 'step2.personalData.middleName',
                        },
                      },
                    ],
                  },
                  {
                    component: 'Box',
                    componentProps: { className: 'grid grid-cols-2 gap-4' },
                    children: [
                      {
                        model: 'personalData.birthDate',
                        component: 'Input',
                        componentProps: {
                          label: 'Дата рождения',
                          type: 'date',
                          testId: 'step2.personalData.birthDate',
                        },
                      },
                      {
                        model: 'personalData.gender',
                        component: 'RadioGroup',
                        componentProps: {
                          label: 'Пол',
                          options: 'GENDERS',
                          testId: 'step2.personalData.gender',
                        },
                      },
                    ],
                  },
                  {
                    model: 'personalData.birthPlace',
                    component: 'Input',
                    componentProps: {
                      label: 'Место рождения',
                      placeholder: 'Введите место рождения',
                      testId: 'step2.personalData.birthPlace',
                    },
                  },
                  // Computed displays
                  {
                    component: 'Box',
                    componentProps: { className: 'grid grid-cols-2 gap-4' },
                    children: [
                      {
                        model: 'fullName',
                        component: 'Input',
                        componentProps: {
                          label: 'Полное имя',
                          readOnly: true,
                          testId: 'step2.fullName',
                        },
                      },
                      {
                        model: 'age',
                        component: 'Input',
                        componentProps: {
                          label: 'Возраст (лет)',
                          type: 'number',
                          readOnly: true,
                          testId: 'step2.age',
                        },
                      },
                    ],
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
                        model: 'passportData.series',
                        component: 'InputMask',
                        componentProps: {
                          label: 'Серия паспорта',
                          placeholder: '12 34',
                          mask: '99 99',
                          testId: 'step2.passportData.series',
                        },
                      },
                      {
                        model: 'passportData.number',
                        component: 'InputMask',
                        componentProps: {
                          label: 'Номер паспорта',
                          placeholder: '123456',
                          mask: '999999',
                          testId: 'step2.passportData.number',
                        },
                      },
                    ],
                  },
                  {
                    component: 'Box',
                    componentProps: { className: 'grid grid-cols-2 gap-4' },
                    children: [
                      {
                        model: 'passportData.issueDate',
                        component: 'Input',
                        componentProps: {
                          label: 'Дата выдачи',
                          type: 'date',
                          testId: 'step2.passportData.issueDate',
                        },
                      },
                      {
                        model: 'passportData.departmentCode',
                        component: 'InputMask',
                        componentProps: {
                          label: 'Код подразделения',
                          placeholder: '123-456',
                          mask: '999-999',
                          testId: 'step2.passportData.departmentCode',
                        },
                      },
                    ],
                  },
                  {
                    model: 'passportData.issuedBy',
                    component: 'Textarea',
                    componentProps: {
                      label: 'Кем выдан',
                      placeholder: 'Введите наименование органа',
                      rows: 2,
                      testId: 'step2.passportData.issuedBy',
                    },
                  },
                ],
              },
              {
                component: 'Section',
                componentProps: {
                  title: 'Документы',
                  titleClassName: 'text-lg font-semibold',
                  className: 'space-y-4',
                },
                children: [
                  {
                    component: 'Box',
                    componentProps: { className: 'grid grid-cols-2 gap-4' },
                    children: [
                      {
                        model: 'inn',
                        component: 'InputMask',
                        componentProps: {
                          label: 'ИНН',
                          placeholder: '123456789012',
                          mask: '999999999999',
                          testId: 'step2.inn',
                        },
                      },
                      {
                        model: 'snils',
                        component: 'InputMask',
                        componentProps: {
                          label: 'СНИЛС',
                          placeholder: '123-456-789 00',
                          mask: '999-999-999 99',
                          testId: 'step2.snils',
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

      // ===================================================================
      // Step 3 — Контакты
      // ===================================================================
      {
        selector: 'step3',
        component: 'Box',
        componentProps: { className: 'bg-white border rounded-xl shadow-sm p-6 space-y-4' },
        children: [
          {
            component: 'Section',
            componentProps: {
              title: 'Шаг 3 — Контактная информация',
              titleAs: 'h2',
              titleClassName: 'text-xl font-bold',
              className: 'space-y-6',
            },
            children: [
              {
                component: 'Box',
                componentProps: { className: 'grid grid-cols-2 gap-4' },
                children: [
                  {
                    model: 'phoneMain',
                    component: 'InputMask',
                    componentProps: {
                      label: 'Основной телефон',
                      placeholder: '+7 (___) ___-__-__',
                      mask: '+7 (999) 999-99-99',
                      testId: 'step3.phoneMain',
                    },
                  },
                  {
                    model: 'phoneAdditional',
                    component: 'InputMask',
                    componentProps: {
                      label: 'Дополнительный телефон',
                      placeholder: '+7 (___) ___-__-__',
                      mask: '+7 (999) 999-99-99',
                      testId: 'step3.phoneAdditional',
                    },
                  },
                ],
              },
              {
                component: 'Box',
                componentProps: { className: 'grid grid-cols-2 gap-4' },
                children: [
                  {
                    model: 'email',
                    component: 'Input',
                    componentProps: {
                      label: 'Email',
                      placeholder: 'example@mail.com',
                      type: 'email',
                      testId: 'step3.email',
                    },
                  },
                  {
                    model: 'emailAdditional',
                    component: 'Input',
                    componentProps: {
                      label: 'Дополнительный email',
                      placeholder: 'example@mail.com',
                      type: 'email',
                      testId: 'step3.emailAdditional',
                    },
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
                        model: 'registrationAddress.region',
                        component: 'Input',
                        componentProps: {
                          label: 'Регион',
                          placeholder: 'Введите регион',
                          testId: 'step3.registrationAddress.region',
                        },
                      },
                      {
                        model: 'registrationAddress.city',
                        component: 'Input',
                        componentProps: {
                          label: 'Город',
                          placeholder: 'Введите город',
                          testId: 'step3.registrationAddress.city',
                        },
                      },
                    ],
                  },
                  {
                    model: 'registrationAddress.street',
                    component: 'Input',
                    componentProps: {
                      label: 'Улица',
                      placeholder: 'Введите улицу',
                      testId: 'step3.registrationAddress.street',
                    },
                  },
                  {
                    component: 'Box',
                    componentProps: { className: 'grid grid-cols-3 gap-4' },
                    children: [
                      {
                        model: 'registrationAddress.house',
                        component: 'Input',
                        componentProps: {
                          label: 'Дом',
                          placeholder: '№',
                          testId: 'step3.registrationAddress.house',
                        },
                      },
                      {
                        model: 'registrationAddress.apartment',
                        component: 'Input',
                        componentProps: {
                          label: 'Квартира',
                          placeholder: '№',
                          testId: 'step3.registrationAddress.apartment',
                        },
                      },
                      {
                        model: 'registrationAddress.postalCode',
                        component: 'InputMask',
                        componentProps: {
                          label: 'Индекс',
                          placeholder: '123456',
                          mask: '999999',
                          testId: 'step3.registrationAddress.postalCode',
                        },
                      },
                    ],
                  },
                ],
              },
              {
                model: 'sameAsRegistration',
                component: 'Checkbox',
                componentProps: {
                  label: 'Адрес проживания совпадает с адресом регистрации',
                  testId: 'step3.sameAsRegistration',
                },
              },
              // Conditional: residence address section
              {
                selector: 'residence-address-section',
                component: 'Section',
                componentProps: {
                  title: 'Адрес проживания',
                  titleClassName: 'text-lg font-semibold',
                  className: 'space-y-4',
                },
                children: [
                  {
                    component: 'Box',
                    componentProps: { className: 'grid grid-cols-2 gap-4' },
                    children: [
                      {
                        model: 'residenceAddress.region',
                        component: 'Input',
                        componentProps: {
                          label: 'Регион',
                          placeholder: 'Введите регион',
                          testId: 'step3.residenceAddress.region',
                        },
                      },
                      {
                        model: 'residenceAddress.city',
                        component: 'Input',
                        componentProps: {
                          label: 'Город',
                          placeholder: 'Введите город',
                          testId: 'step3.residenceAddress.city',
                        },
                      },
                    ],
                  },
                  {
                    model: 'residenceAddress.street',
                    component: 'Input',
                    componentProps: {
                      label: 'Улица',
                      placeholder: 'Введите улицу',
                      testId: 'step3.residenceAddress.street',
                    },
                  },
                  {
                    component: 'Box',
                    componentProps: { className: 'grid grid-cols-3 gap-4' },
                    children: [
                      {
                        model: 'residenceAddress.house',
                        component: 'Input',
                        componentProps: {
                          label: 'Дом',
                          placeholder: '№',
                          testId: 'step3.residenceAddress.house',
                        },
                      },
                      {
                        model: 'residenceAddress.apartment',
                        component: 'Input',
                        componentProps: {
                          label: 'Квартира',
                          placeholder: '№',
                          testId: 'step3.residenceAddress.apartment',
                        },
                      },
                      {
                        model: 'residenceAddress.postalCode',
                        component: 'InputMask',
                        componentProps: {
                          label: 'Индекс',
                          placeholder: '123456',
                          mask: '999999',
                          testId: 'step3.residenceAddress.postalCode',
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

      // ===================================================================
      // Step 4 — Занятость
      // ===================================================================
      {
        selector: 'step4',
        component: 'Box',
        componentProps: { className: 'bg-white border rounded-xl shadow-sm p-6 space-y-4' },
        children: [
          {
            component: 'Section',
            componentProps: {
              title: 'Шаг 4 — Информация о занятости',
              titleAs: 'h2',
              titleClassName: 'text-xl font-bold',
              className: 'space-y-6',
            },
            children: [
              {
                model: 'employmentStatus',
                component: 'RadioGroup',
                componentProps: {
                  label: 'Статус занятости',
                  options: 'EMPLOYMENT_STATUSES',
                  testId: 'step4.employmentStatus',
                },
              },
              // Conditional employer section
              {
                selector: 'employer-section',
                component: 'Section',
                componentProps: {
                  title: 'Информация о работодателе',
                  titleClassName: 'text-lg font-semibold',
                  className: 'space-y-4',
                },
                children: [
                  {
                    model: 'companyName',
                    component: 'Input',
                    componentProps: {
                      label: 'Название компании',
                      placeholder: 'Введите название',
                      testId: 'step4.companyName',
                    },
                  },
                  {
                    component: 'Box',
                    componentProps: { className: 'grid grid-cols-2 gap-4' },
                    children: [
                      {
                        model: 'companyInn',
                        component: 'InputMask',
                        componentProps: {
                          label: 'ИНН компании',
                          placeholder: '1234567890',
                          mask: '9999999999',
                          testId: 'step4.companyInn',
                        },
                      },
                      {
                        model: 'companyPhone',
                        component: 'InputMask',
                        componentProps: {
                          label: 'Телефон компании',
                          placeholder: '+7 (___) ___-__-__',
                          mask: '+7 (999) 999-99-99',
                          testId: 'step4.companyPhone',
                        },
                      },
                    ],
                  },
                  {
                    model: 'companyAddress',
                    component: 'Input',
                    componentProps: {
                      label: 'Адрес компании',
                      placeholder: 'Полный адрес',
                      testId: 'step4.companyAddress',
                    },
                  },
                  {
                    model: 'position',
                    component: 'Input',
                    componentProps: {
                      label: 'Должность',
                      placeholder: 'Ваша должность',
                      testId: 'step4.position',
                    },
                  },
                ],
              },
              // Conditional business section
              {
                selector: 'business-section',
                component: 'Section',
                componentProps: {
                  title: 'Информация о бизнесе',
                  titleClassName: 'text-lg font-semibold',
                  className: 'space-y-4',
                },
                children: [
                  {
                    model: 'businessType',
                    component: 'Input',
                    componentProps: {
                      label: 'Тип бизнеса',
                      placeholder: 'ИП, ООО и т.д.',
                      testId: 'step4.businessType',
                    },
                  },
                  {
                    model: 'businessInn',
                    component: 'InputMask',
                    componentProps: {
                      label: 'ИНН ИП',
                      placeholder: '123456789012',
                      mask: '999999999999',
                      testId: 'step4.businessInn',
                    },
                  },
                  {
                    model: 'businessActivity',
                    component: 'Textarea',
                    componentProps: {
                      label: 'Вид деятельности',
                      placeholder: 'Опишите вид деятельности',
                      rows: 3,
                      testId: 'step4.businessActivity',
                    },
                  },
                ],
              },
              // Стаж
              {
                component: 'Section',
                componentProps: {
                  title: 'Стаж работы',
                  titleClassName: 'text-lg font-semibold',
                  className: 'space-y-4',
                },
                children: [
                  {
                    component: 'Box',
                    componentProps: { className: 'grid grid-cols-2 gap-4' },
                    children: [
                      {
                        model: 'workExperienceTotal',
                        component: 'Input',
                        componentProps: {
                          label: 'Общий стаж работы (месяцев)',
                          placeholder: '0',
                          type: 'number',
                          min: 0,
                          testId: 'step4.workExperienceTotal',
                        },
                      },
                      {
                        model: 'workExperienceCurrent',
                        component: 'Input',
                        componentProps: {
                          label: 'Стаж на текущем месте (месяцев)',
                          placeholder: '0',
                          type: 'number',
                          min: 0,
                          testId: 'step4.workExperienceCurrent',
                        },
                      },
                    ],
                  },
                ],
              },
              // Доход
              {
                component: 'Section',
                componentProps: {
                  title: 'Доход',
                  titleClassName: 'text-lg font-semibold',
                  className: 'space-y-4',
                },
                children: [
                  {
                    model: 'monthlyIncome',
                    component: 'Input',
                    componentProps: {
                      label: 'Ежемесячный доход (₽)',
                      placeholder: '0',
                      type: 'number',
                      min: 10000,
                      step: 1000,
                      testId: 'step4.monthlyIncome',
                    },
                  },
                  {
                    component: 'Box',
                    componentProps: { className: 'grid grid-cols-2 gap-4' },
                    children: [
                      {
                        model: 'additionalIncome',
                        component: 'Input',
                        componentProps: {
                          label: 'Дополнительный доход (₽)',
                          placeholder: '0',
                          type: 'number',
                          min: 0,
                          step: 1000,
                          testId: 'step4.additionalIncome',
                        },
                      },
                      {
                        model: 'additionalIncomeSource',
                        component: 'Input',
                        componentProps: {
                          label: 'Источник дополнительного дохода',
                          placeholder: 'Опишите источник',
                          testId: 'step4.additionalIncomeSource',
                        },
                      },
                    ],
                  },
                  // Computed totals
                  {
                    component: 'Box',
                    componentProps: { className: 'grid grid-cols-2 gap-4' },
                    children: [
                      {
                        model: 'totalIncome',
                        component: 'Input',
                        componentProps: {
                          label: 'Общий доход (₽)',
                          type: 'number',
                          readOnly: true,
                          testId: 'step4.totalIncome',
                        },
                      },
                      {
                        model: 'paymentToIncomeRatio',
                        component: 'Input',
                        componentProps: {
                          label: 'Платёж от дохода (%)',
                          type: 'number',
                          readOnly: true,
                          testId: 'step4.paymentToIncomeRatio',
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

      // ===================================================================
      // Step 5 — Дополнительно
      // ===================================================================
      {
        selector: 'step5',
        component: 'Box',
        componentProps: { className: 'bg-white border rounded-xl shadow-sm p-6 space-y-4' },
        children: [
          {
            component: 'Section',
            componentProps: {
              title: 'Шаг 5 — Дополнительная информация',
              titleAs: 'h2',
              titleClassName: 'text-xl font-bold',
              className: 'space-y-6',
            },
            children: [
              {
                model: 'maritalStatus',
                component: 'RadioGroup',
                componentProps: {
                  label: 'Семейное положение',
                  options: 'MARITAL_STATUSES',
                  testId: 'step5.maritalStatus',
                },
              },
              {
                component: 'Box',
                componentProps: { className: 'grid grid-cols-2 gap-4' },
                children: [
                  {
                    model: 'dependents',
                    component: 'Input',
                    componentProps: {
                      label: 'Количество иждивенцев',
                      placeholder: '0',
                      type: 'number',
                      min: 0,
                      max: 10,
                      testId: 'step5.dependents',
                    },
                  },
                  {
                    model: 'education',
                    component: 'Select',
                    componentProps: {
                      label: 'Образование',
                      placeholder: 'Выберите уровень образования',
                      options: 'EDUCATIONS',
                      testId: 'step5.education',
                    },
                  },
                ],
              },
              // Property section
              {
                component: 'Section',
                componentProps: {
                  title: 'Имущество',
                  titleClassName: 'text-lg font-semibold mt-4',
                  className: 'space-y-4',
                },
                children: [
                  {
                    model: 'hasProperty',
                    component: 'Checkbox',
                    componentProps: { label: 'У меня есть имущество', testId: 'step5.hasProperty' },
                  },
                  {
                    selector: 'properties-array',
                    component: 'FormArraySection',
                    componentProps: {
                      control: 'properties',
                      title: 'Имущество',
                      itemLabel: 'PROPERTY_ITEM_LABEL',
                      addButtonLabel: '+ Добавить имущество',
                      removeButtonLabel: 'Удалить',
                      emptyMessage: 'Нажмите «Добавить имущество» для добавления записи',
                      // Patch D3: plain-leaf primitives
                      initialValue: {
                        type: 'apartment',
                        description: '',
                        estimatedValue: 0,
                        hasEncumbrance: false,
                      },
                      // Path C: inline $template — converter wraps to FC
                      itemComponent: {
                        $template: {
                          component: 'Box',
                          componentProps: { className: 'space-y-3' },
                          children: [
                            {
                              selector: 'type',
                              component: 'Select',
                              componentProps: {
                                label: 'Тип имущества',
                                placeholder: 'Выберите тип',
                                options: 'PROPERTY_TYPES',
                                testId: 'property.type',
                              },
                            },
                            {
                              selector: 'description',
                              component: 'Textarea',
                              componentProps: {
                                label: 'Описание',
                                placeholder: 'Опишите имущество',
                                rows: 2,
                                testId: 'property.description',
                              },
                            },
                            {
                              component: 'Box',
                              componentProps: { className: 'grid grid-cols-2 gap-4 items-center' },
                              children: [
                                {
                                  selector: 'estimatedValue',
                                  component: 'Input',
                                  componentProps: {
                                    label: 'Оценочная стоимость (₽)',
                                    placeholder: '0',
                                    type: 'number',
                                    min: 0,
                                    step: 10000,
                                    testId: 'property.estimatedValue',
                                  },
                                },
                                {
                                  selector: 'hasEncumbrance',
                                  component: 'Checkbox',
                                  componentProps: {
                                    label: 'Имеется обременение (залог)',
                                    testId: 'property.hasEncumbrance',
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
              // Existing loans section
              {
                component: 'Section',
                componentProps: {
                  title: 'Существующие кредиты',
                  titleClassName: 'text-lg font-semibold mt-4',
                  className: 'space-y-4',
                },
                children: [
                  {
                    model: 'hasExistingLoans',
                    component: 'Checkbox',
                    componentProps: {
                      label: 'У меня есть другие кредиты',
                      testId: 'step5.hasExistingLoans',
                    },
                  },
                  {
                    selector: 'existing-loans-array',
                    component: 'FormArraySection',
                    componentProps: {
                      control: 'existingLoans',
                      title: 'Кредиты',
                      itemLabel: 'EXISTING_LOAN_ITEM_LABEL',
                      addButtonLabel: '+ Добавить кредит',
                      removeButtonLabel: 'Удалить',
                      emptyMessage: 'Нажмите «Добавить кредит» для добавления записи',
                      initialValue: {
                        bank: '',
                        type: 'consumer',
                        amount: 0,
                        remainingAmount: 0,
                        monthlyPayment: 0,
                        maturityDate: '',
                      },
                      itemComponent: {
                        $template: {
                          component: 'Box',
                          componentProps: { className: 'space-y-3' },
                          children: [
                            {
                              component: 'Box',
                              componentProps: { className: 'grid grid-cols-2 gap-4' },
                              children: [
                                {
                                  selector: 'bank',
                                  component: 'Input',
                                  componentProps: {
                                    label: 'Банк',
                                    placeholder: 'Название банка',
                                    testId: 'existingLoan.bank',
                                  },
                                },
                                {
                                  selector: 'type',
                                  component: 'Select',
                                  componentProps: {
                                    label: 'Тип кредита',
                                    placeholder: 'Выберите тип',
                                    options: 'EXISTING_LOAN_TYPES',
                                    testId: 'existingLoan.type',
                                  },
                                },
                              ],
                            },
                            {
                              component: 'Box',
                              componentProps: { className: 'grid grid-cols-2 gap-4' },
                              children: [
                                {
                                  selector: 'amount',
                                  component: 'Input',
                                  componentProps: {
                                    label: 'Сумма кредита (₽)',
                                    placeholder: '0',
                                    type: 'number',
                                    min: 0,
                                    step: 1000,
                                    testId: 'existingLoan.amount',
                                  },
                                },
                                {
                                  selector: 'remainingAmount',
                                  component: 'Input',
                                  componentProps: {
                                    label: 'Остаток задолженности (₽)',
                                    placeholder: '0',
                                    type: 'number',
                                    min: 0,
                                    step: 1000,
                                    testId: 'existingLoan.remainingAmount',
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
                                  component: 'Input',
                                  componentProps: {
                                    label: 'Ежемесячный платёж (₽)',
                                    placeholder: '0',
                                    type: 'number',
                                    min: 0,
                                    step: 100,
                                    testId: 'existingLoan.monthlyPayment',
                                  },
                                },
                                {
                                  selector: 'maturityDate',
                                  component: 'Input',
                                  componentProps: {
                                    label: 'Дата погашения',
                                    type: 'date',
                                    testId: 'existingLoan.maturityDate',
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
              // Co-borrowers section
              {
                component: 'Section',
                componentProps: {
                  title: 'Созаемщики',
                  titleClassName: 'text-lg font-semibold mt-4',
                  className: 'space-y-4',
                },
                children: [
                  {
                    model: 'hasCoBorrower',
                    component: 'Checkbox',
                    componentProps: { label: 'Добавить созаемщика', testId: 'step5.hasCoBorrower' },
                  },
                  {
                    selector: 'co-borrowers-array',
                    component: 'FormArraySection',
                    componentProps: {
                      control: 'coBorrowers',
                      title: 'Созаемщики',
                      itemLabel: 'CO_BORROWER_ITEM_LABEL',
                      addButtonLabel: '+ Добавить созаемщика',
                      removeButtonLabel: 'Удалить',
                      emptyMessage: 'Нажмите «Добавить созаемщика» для добавления записи',
                      initialValue: {
                        personalData: {
                          lastName: '',
                          firstName: '',
                          middleName: '',
                          birthDate: '',
                        },
                        phone: '',
                        email: '',
                        relationship: 'spouse',
                        monthlyIncome: 0,
                      },
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
                                  component: 'Input',
                                  componentProps: {
                                    label: 'Фамилия',
                                    placeholder: 'Введите фамилию',
                                    testId: 'coBorrower.personalData.lastName',
                                  },
                                },
                                {
                                  selector: 'personalData.firstName',
                                  component: 'Input',
                                  componentProps: {
                                    label: 'Имя',
                                    placeholder: 'Введите имя',
                                    testId: 'coBorrower.personalData.firstName',
                                  },
                                },
                                {
                                  selector: 'personalData.middleName',
                                  component: 'Input',
                                  componentProps: {
                                    label: 'Отчество',
                                    placeholder: 'Введите отчество',
                                    testId: 'coBorrower.personalData.middleName',
                                  },
                                },
                              ],
                            },
                            {
                              selector: 'personalData.birthDate',
                              component: 'Input',
                              componentProps: {
                                label: 'Дата рождения',
                                type: 'date',
                                testId: 'coBorrower.personalData.birthDate',
                              },
                            },
                            {
                              component: 'Box',
                              componentProps: { className: 'grid grid-cols-2 gap-4' },
                              children: [
                                {
                                  selector: 'phone',
                                  component: 'InputMask',
                                  componentProps: {
                                    label: 'Телефон',
                                    placeholder: '+7 (___) ___-__-__',
                                    mask: '+7 (999) 999-99-99',
                                    testId: 'coBorrower.phone',
                                  },
                                },
                                {
                                  selector: 'email',
                                  component: 'Input',
                                  componentProps: {
                                    label: 'Email',
                                    placeholder: 'example@mail.com',
                                    type: 'email',
                                    testId: 'coBorrower.email',
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
                                  component: 'Select',
                                  componentProps: {
                                    label: 'Родство',
                                    placeholder: 'Укажите родство',
                                    options: 'RELATIONSHIPS',
                                    testId: 'coBorrower.relationship',
                                  },
                                },
                                {
                                  selector: 'monthlyIncome',
                                  component: 'Input',
                                  componentProps: {
                                    label: 'Ежемесячный доход (₽)',
                                    placeholder: '0',
                                    type: 'number',
                                    min: 0,
                                    step: 1000,
                                    testId: 'coBorrower.monthlyIncome',
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

      // ===================================================================
      // Step 6 — Подтверждение
      // ===================================================================
      {
        selector: 'step6',
        component: 'Box',
        componentProps: { className: 'bg-white border rounded-xl shadow-sm p-6 space-y-4' },
        children: [
          {
            component: 'Section',
            componentProps: {
              title: 'Шаг 6 — Подтверждение и согласия',
              titleAs: 'h2',
              titleClassName: 'text-xl font-bold',
              className: 'space-y-6',
            },
            children: [
              // Computed summary
              {
                component: 'Section',
                componentProps: {
                  title: 'Параметры кредита',
                  titleClassName: 'text-lg font-semibold',
                  className: 'space-y-4',
                },
                children: [
                  {
                    component: 'Box',
                    componentProps: { className: 'grid grid-cols-3 gap-4' },
                    children: [
                      {
                        model: 'interestRate',
                        component: 'Input',
                        componentProps: {
                          label: 'Процентная ставка (%)',
                          type: 'number',
                          readOnly: true,
                          testId: 'step6.interestRate',
                        },
                      },
                      {
                        model: 'monthlyPayment',
                        component: 'Input',
                        componentProps: {
                          label: 'Ежемесячный платёж (₽)',
                          type: 'number',
                          readOnly: true,
                          testId: 'step6.monthlyPayment',
                        },
                      },
                      {
                        model: 'paymentToIncomeRatio',
                        component: 'Input',
                        componentProps: {
                          label: 'Платёж от дохода (%)',
                          type: 'number',
                          readOnly: true,
                          testId: 'step6.paymentToIncomeRatio',
                        },
                      },
                    ],
                  },
                ],
              },
              // Required consents
              {
                component: 'Section',
                componentProps: {
                  title: 'Обязательные согласия',
                  titleClassName: 'text-lg font-semibold',
                  className: 'space-y-3',
                },
                children: [
                  {
                    model: 'agreePersonalData',
                    component: 'Checkbox',
                    componentProps: {
                      label: 'Согласие на обработку персональных данных',
                      testId: 'step6.agreePersonalData',
                    },
                  },
                  {
                    model: 'agreeCreditHistory',
                    component: 'Checkbox',
                    componentProps: {
                      label: 'Согласие на проверку кредитной истории',
                      testId: 'step6.agreeCreditHistory',
                    },
                  },
                  {
                    model: 'agreeTerms',
                    component: 'Checkbox',
                    componentProps: {
                      label: 'Согласие с условиями кредитования',
                      testId: 'step6.agreeTerms',
                    },
                  },
                  {
                    model: 'confirmAccuracy',
                    component: 'Checkbox',
                    componentProps: {
                      label: 'Подтверждаю точность введённых данных',
                      testId: 'step6.confirmAccuracy',
                    },
                  },
                ],
              },
              // Optional consent
              {
                component: 'Section',
                componentProps: {
                  title: 'Опциональные согласия',
                  titleClassName: 'text-lg font-semibold mt-4',
                  className: 'space-y-3',
                },
                children: [
                  {
                    model: 'agreeMarketing',
                    component: 'Checkbox',
                    componentProps: {
                      label: 'Согласие на получение маркетинговых материалов',
                      testId: 'step6.agreeMarketing',
                    },
                  },
                ],
              },
              // Electronic signature
              {
                component: 'Section',
                componentProps: {
                  title: 'Электронная подпись',
                  titleClassName: 'text-lg font-semibold mt-4',
                  className: 'space-y-4',
                },
                children: [
                  {
                    model: 'electronicSignature',
                    component: 'InputMask',
                    componentProps: {
                      label: 'Код подтверждения из СМС',
                      placeholder: '123456',
                      mask: '999999',
                      testId: 'step6.electronicSignature',
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
};
