/**
 * JSON render-schema для credit-application-form (iter-9, renderer-json).
 *
 * Patch K (NEW iter-9): differentiate `model` vs `selector`.
 * - `model: 'fieldPath'` — actual field path в form schema (НИКОГДА с stepN. prefix).
 *   Используется для всех field-typed components: Input/Select/Checkbox/RadioGroup/Textarea/InputMask.
 * - `selector: 'unique-id'` — node identifier для setHidden/hideWhen/patchProps orchestration.
 *   Используется ТОЛЬКО для container-нод, которыми управляет render-behavior.
 * - `testId: 'step1.X'` — DOM testId convention в componentProps. Не путь, не fieldPath.
 *
 * Patch H (camelCase): `maxLength`, `readOnly` (НЕ `maxlength`/`readonly`).
 * Patch G + Path C: `FormWizard` напрямую, steps[].body — RenderNode subtree.
 * Path C update: `FormArraySection` с `itemComponent: { $template }`.
 */

import type { JsonFormSchema } from '@reformer/renderer-json';

export const creditApplicationJsonSchema: JsonFormSchema = {
  version: '1.0',
  root: {
    selector: 'wizard',
    component: 'FormWizard',
    componentProps: {
      // form, config, onSubmit инжектятся через index.tsx wrapper +
      // render-behavior onInit/patchProps.
      className: 'bg-white p-8 rounded-lg shadow-md',
      steps: [
        // ====================================================================
        // Шаг 1: Кредит
        // ====================================================================
        {
          number: 1,
          title: 'Кредит',
          icon: '💰',
          body: {
            component: 'Box',
            componentProps: { className: 'space-y-6' },
            children: [
              {
                component: 'Section',
                componentProps: {
                  title: 'Основная информация о кредите',
                  className: 'space-y-4',
                },
                children: [
                  {
                    model: 'loanType',
                    component: 'Select',
                    componentProps: { testId: 'step1.loanType' },
                  },
                  {
                    model: 'loanAmount',
                    component: 'Input',
                    componentProps: { testId: 'step1.loanAmount' },
                  },
                  {
                    model: 'loanTerm',
                    component: 'Input',
                    componentProps: { testId: 'step1.loanTerm' },
                  },
                  {
                    model: 'loanPurpose',
                    component: 'Textarea',
                    componentProps: { testId: 'step1.loanPurpose' },
                  },
                ],
              },
              // Mortgage-specific (orchestration via hideWhen, selector only)
              {
                selector: 'mortgage-section',
                component: 'Section',
                componentProps: {
                  title: 'Информация о недвижимости',
                  className: 'space-y-4',
                },
                children: [
                  {
                    model: 'propertyValue',
                    component: 'Input',
                    componentProps: { testId: 'step1.propertyValue' },
                  },
                  {
                    model: 'initialPayment',
                    component: 'Input',
                    componentProps: { testId: 'step1.initialPayment' },
                  },
                ],
              },
              // Car-specific
              {
                selector: 'car-section',
                component: 'Section',
                componentProps: {
                  title: 'Информация об автомобиле',
                  className: 'space-y-4',
                },
                children: [
                  {
                    model: 'carBrand',
                    component: 'Input',
                    componentProps: { testId: 'step1.carBrand' },
                  },
                  {
                    model: 'carModel',
                    component: 'Input',
                    componentProps: { testId: 'step1.carModel' },
                  },
                  {
                    component: 'Box',
                    componentProps: { className: 'grid grid-cols-2 gap-4' },
                    children: [
                      {
                        model: 'carYear',
                        component: 'Input',
                        componentProps: { testId: 'step1.carYear' },
                      },
                      {
                        model: 'carPrice',
                        component: 'Input',
                        componentProps: { testId: 'step1.carPrice' },
                      },
                    ],
                  },
                ],
              },
              // Computed preview
              {
                component: 'Section',
                componentProps: {
                  title: 'Расчёт',
                  className: 'space-y-4',
                },
                children: [
                  {
                    component: 'Box',
                    componentProps: { className: 'grid grid-cols-2 gap-4' },
                    children: [
                      {
                        model: 'interestRate',
                        component: 'Input',
                        componentProps: { testId: 'step1.interestRate' },
                      },
                      {
                        model: 'monthlyPayment',
                        component: 'Input',
                        componentProps: { testId: 'step1.monthlyPayment' },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },

        // ====================================================================
        // Шаг 2: Личные данные
        // ====================================================================
        {
          number: 2,
          title: 'Данные',
          icon: '👤',
          body: {
            component: 'Box',
            componentProps: { className: 'space-y-6' },
            children: [
              {
                component: 'Section',
                componentProps: {
                  title: 'Личные данные',
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
                        componentProps: { testId: 'step2.personalData.lastName' },
                      },
                      {
                        model: 'personalData.firstName',
                        component: 'Input',
                        componentProps: { testId: 'step2.personalData.firstName' },
                      },
                      {
                        model: 'personalData.middleName',
                        component: 'Input',
                        componentProps: { testId: 'step2.personalData.middleName' },
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
                        componentProps: { testId: 'step2.personalData.birthDate' },
                      },
                      {
                        model: 'personalData.gender',
                        component: 'RadioGroup',
                        componentProps: { testId: 'step2.personalData.gender' },
                      },
                    ],
                  },
                  {
                    model: 'personalData.birthPlace',
                    component: 'Input',
                    componentProps: { testId: 'step2.personalData.birthPlace' },
                  },
                  {
                    component: 'Box',
                    componentProps: { className: 'grid grid-cols-2 gap-4' },
                    children: [
                      {
                        model: 'fullName',
                        component: 'Input',
                        componentProps: { testId: 'step2.fullName' },
                      },
                      {
                        model: 'age',
                        component: 'Input',
                        componentProps: { testId: 'step2.age' },
                      },
                    ],
                  },
                ],
              },
              {
                component: 'Section',
                componentProps: {
                  title: 'Паспортные данные',
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
                        componentProps: { testId: 'step2.passportData.series' },
                      },
                      {
                        model: 'passportData.number',
                        component: 'InputMask',
                        componentProps: { testId: 'step2.passportData.number' },
                      },
                    ],
                  },
                  {
                    model: 'passportData.issuedBy',
                    component: 'Input',
                    componentProps: { testId: 'step2.passportData.issuedBy' },
                  },
                  {
                    component: 'Box',
                    componentProps: { className: 'grid grid-cols-2 gap-4' },
                    children: [
                      {
                        model: 'passportData.issueDate',
                        component: 'Input',
                        componentProps: { testId: 'step2.passportData.issueDate' },
                      },
                      {
                        model: 'passportData.departmentCode',
                        component: 'InputMask',
                        componentProps: { testId: 'step2.passportData.departmentCode' },
                      },
                    ],
                  },
                ],
              },
              {
                component: 'Section',
                componentProps: {
                  title: 'Документы',
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
                        componentProps: { testId: 'step2.inn' },
                      },
                      {
                        model: 'snils',
                        component: 'InputMask',
                        componentProps: { testId: 'step2.snils' },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },

        // ====================================================================
        // Шаг 3: Контакты
        // ====================================================================
        {
          number: 3,
          title: 'Контакты',
          icon: '📞',
          body: {
            component: 'Box',
            componentProps: { className: 'space-y-6' },
            children: [
              {
                component: 'Section',
                componentProps: {
                  title: 'Телефоны и email',
                  className: 'space-y-4',
                },
                children: [
                  {
                    component: 'Box',
                    componentProps: { className: 'grid grid-cols-2 gap-4' },
                    children: [
                      {
                        model: 'phoneMain',
                        component: 'InputMask',
                        componentProps: { testId: 'step3.phoneMain' },
                      },
                      {
                        model: 'phoneAdditional',
                        component: 'InputMask',
                        componentProps: { testId: 'step3.phoneAdditional' },
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
                        componentProps: { testId: 'step3.email' },
                      },
                      {
                        model: 'emailAdditional',
                        component: 'Input',
                        componentProps: { testId: 'step3.emailAdditional' },
                      },
                    ],
                  },
                ],
              },
              {
                component: 'Section',
                componentProps: {
                  title: 'Адрес регистрации',
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
                        componentProps: { testId: 'step3.registrationAddress.region' },
                      },
                      {
                        model: 'registrationAddress.city',
                        component: 'Input',
                        componentProps: { testId: 'step3.registrationAddress.city' },
                      },
                    ],
                  },
                  {
                    model: 'registrationAddress.street',
                    component: 'Input',
                    componentProps: { testId: 'step3.registrationAddress.street' },
                  },
                  {
                    component: 'Box',
                    componentProps: { className: 'grid grid-cols-3 gap-4' },
                    children: [
                      {
                        model: 'registrationAddress.house',
                        component: 'Input',
                        componentProps: { testId: 'step3.registrationAddress.house' },
                      },
                      {
                        model: 'registrationAddress.apartment',
                        component: 'Input',
                        componentProps: { testId: 'step3.registrationAddress.apartment' },
                      },
                      {
                        model: 'registrationAddress.postalCode',
                        component: 'InputMask',
                        componentProps: { testId: 'step3.registrationAddress.postalCode' },
                      },
                    ],
                  },
                ],
              },
              {
                model: 'sameAsRegistration',
                component: 'Checkbox',
                componentProps: { testId: 'step3.sameAsRegistration' },
              },
              {
                selector: 'residence-address-section',
                component: 'Section',
                componentProps: {
                  title: 'Адрес проживания',
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
                        componentProps: { testId: 'step3.residenceAddress.region' },
                      },
                      {
                        model: 'residenceAddress.city',
                        component: 'Input',
                        componentProps: { testId: 'step3.residenceAddress.city' },
                      },
                    ],
                  },
                  {
                    model: 'residenceAddress.street',
                    component: 'Input',
                    componentProps: { testId: 'step3.residenceAddress.street' },
                  },
                  {
                    component: 'Box',
                    componentProps: { className: 'grid grid-cols-3 gap-4' },
                    children: [
                      {
                        model: 'residenceAddress.house',
                        component: 'Input',
                        componentProps: { testId: 'step3.residenceAddress.house' },
                      },
                      {
                        model: 'residenceAddress.apartment',
                        component: 'Input',
                        componentProps: { testId: 'step3.residenceAddress.apartment' },
                      },
                      {
                        model: 'residenceAddress.postalCode',
                        component: 'InputMask',
                        componentProps: { testId: 'step3.residenceAddress.postalCode' },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },

        // ====================================================================
        // Шаг 4: Работа
        // ====================================================================
        {
          number: 4,
          title: 'Работа',
          icon: '💼',
          body: {
            component: 'Box',
            componentProps: { className: 'space-y-6' },
            children: [
              {
                model: 'employmentStatus',
                component: 'RadioGroup',
                componentProps: { testId: 'step4.employmentStatus' },
              },
              // employed-only
              {
                selector: 'employer-section',
                component: 'Section',
                componentProps: {
                  title: 'Работодатель',
                  className: 'space-y-4',
                },
                children: [
                  {
                    model: 'companyName',
                    component: 'Input',
                    componentProps: { testId: 'step4.companyName' },
                  },
                  {
                    component: 'Box',
                    componentProps: { className: 'grid grid-cols-2 gap-4' },
                    children: [
                      {
                        model: 'companyInn',
                        component: 'InputMask',
                        componentProps: { testId: 'step4.companyInn' },
                      },
                      {
                        model: 'companyPhone',
                        component: 'InputMask',
                        componentProps: { testId: 'step4.companyPhone' },
                      },
                    ],
                  },
                  {
                    model: 'companyAddress',
                    component: 'Input',
                    componentProps: { testId: 'step4.companyAddress' },
                  },
                  {
                    model: 'position',
                    component: 'Input',
                    componentProps: { testId: 'step4.position' },
                  },
                ],
              },
              // selfEmployed-only
              {
                selector: 'business-section',
                component: 'Section',
                componentProps: {
                  title: 'Бизнес',
                  className: 'space-y-4',
                },
                children: [
                  {
                    model: 'businessType',
                    component: 'Input',
                    componentProps: { testId: 'step4.businessType' },
                  },
                  {
                    model: 'businessInn',
                    component: 'InputMask',
                    componentProps: { testId: 'step4.businessInn' },
                  },
                  {
                    model: 'businessActivity',
                    component: 'Textarea',
                    componentProps: { testId: 'step4.businessActivity' },
                  },
                ],
              },
              // Стаж
              {
                component: 'Section',
                componentProps: {
                  title: 'Стаж',
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
                        componentProps: { testId: 'step4.workExperienceTotal' },
                      },
                      {
                        model: 'workExperienceCurrent',
                        component: 'Input',
                        componentProps: { testId: 'step4.workExperienceCurrent' },
                      },
                    ],
                  },
                ],
              },
              // Income (hide for unemployed)
              {
                selector: 'income-section',
                component: 'Section',
                componentProps: {
                  title: 'Доход',
                  className: 'space-y-4',
                },
                children: [
                  {
                    model: 'monthlyIncome',
                    component: 'Input',
                    componentProps: { testId: 'step4.monthlyIncome' },
                  },
                  {
                    component: 'Box',
                    componentProps: { className: 'grid grid-cols-2 gap-4' },
                    children: [
                      {
                        model: 'additionalIncome',
                        component: 'Input',
                        componentProps: { testId: 'step4.additionalIncome' },
                      },
                      {
                        model: 'additionalIncomeSource',
                        component: 'Input',
                        componentProps: { testId: 'step4.additionalIncomeSource' },
                      },
                    ],
                  },
                  {
                    model: 'totalIncome',
                    component: 'Input',
                    componentProps: { testId: 'step4.totalIncome' },
                  },
                ],
              },
            ],
          },
        },

        // ====================================================================
        // Шаг 5: Доп. инфо (FormArray × 3)
        // ====================================================================
        {
          number: 5,
          title: 'Доп. инфо',
          icon: '📋',
          body: {
            component: 'Box',
            componentProps: { className: 'space-y-6' },
            children: [
              {
                component: 'Section',
                componentProps: {
                  title: 'Семейное положение и образование',
                  className: 'space-y-4',
                },
                children: [
                  {
                    model: 'maritalStatus',
                    component: 'RadioGroup',
                    componentProps: { testId: 'step5.maritalStatus' },
                  },
                  {
                    component: 'Box',
                    componentProps: { className: 'grid grid-cols-2 gap-4' },
                    children: [
                      {
                        model: 'dependents',
                        component: 'Input',
                        componentProps: { testId: 'step5.dependents' },
                      },
                      {
                        model: 'education',
                        component: 'Select',
                        componentProps: { testId: 'step5.education' },
                      },
                    ],
                  },
                ],
              },
              // Имущество
              {
                component: 'Box',
                componentProps: { className: 'space-y-4' },
                children: [
                  {
                    model: 'hasProperty',
                    component: 'Checkbox',
                    componentProps: { testId: 'step5.hasProperty' },
                  },
                  {
                    selector: 'properties-array',
                    component: 'FormArraySection',
                    componentProps: {
                      title: 'Имущество',
                      control: 'properties',
                      addButtonLabel: '+ Добавить имущество',
                      emptyMessage: 'Нажмите «Добавить имущество» для добавления записи',
                      initialValue: {
                        type: 'apartment',
                        description: '',
                        estimatedValue: 0,
                        hasEncumbrance: false,
                      },
                      itemComponent: {
                        $template: {
                          component: 'Box',
                          componentProps: { className: 'space-y-3' },
                          children: [
                            {
                              model: 'type',
                              component: 'Select',
                              componentProps: { testId: 'step5.property.type' },
                            },
                            {
                              model: 'description',
                              component: 'Textarea',
                              componentProps: { testId: 'step5.property.description' },
                            },
                            {
                              model: 'estimatedValue',
                              component: 'Input',
                              componentProps: { testId: 'step5.property.estimatedValue' },
                            },
                            {
                              model: 'hasEncumbrance',
                              component: 'Checkbox',
                              componentProps: { testId: 'step5.property.hasEncumbrance' },
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
                component: 'Box',
                componentProps: { className: 'space-y-4' },
                children: [
                  {
                    model: 'hasExistingLoans',
                    component: 'Checkbox',
                    componentProps: { testId: 'step5.hasExistingLoans' },
                  },
                  {
                    selector: 'existing-loans-array',
                    component: 'FormArraySection',
                    componentProps: {
                      title: 'Существующие кредиты',
                      control: 'existingLoans',
                      addButtonLabel: '+ Добавить кредит',
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
                              model: 'bank',
                              component: 'Input',
                              componentProps: { testId: 'step5.existingLoan.bank' },
                            },
                            {
                              model: 'type',
                              component: 'Select',
                              componentProps: { testId: 'step5.existingLoan.type' },
                            },
                            {
                              component: 'Box',
                              componentProps: { className: 'grid grid-cols-2 gap-4' },
                              children: [
                                {
                                  model: 'amount',
                                  component: 'Input',
                                  componentProps: { testId: 'step5.existingLoan.amount' },
                                },
                                {
                                  model: 'remainingAmount',
                                  component: 'Input',
                                  componentProps: {
                                    testId: 'step5.existingLoan.remainingAmount',
                                  },
                                },
                              ],
                            },
                            {
                              component: 'Box',
                              componentProps: { className: 'grid grid-cols-2 gap-4' },
                              children: [
                                {
                                  model: 'monthlyPayment',
                                  component: 'Input',
                                  componentProps: {
                                    testId: 'step5.existingLoan.monthlyPayment',
                                  },
                                },
                                {
                                  model: 'maturityDate',
                                  component: 'Input',
                                  componentProps: { testId: 'step5.existingLoan.maturityDate' },
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
              // Созаемщики
              {
                component: 'Box',
                componentProps: { className: 'space-y-4' },
                children: [
                  {
                    model: 'hasCoBorrower',
                    component: 'Checkbox',
                    componentProps: { testId: 'step5.hasCoBorrower' },
                  },
                  {
                    selector: 'co-borrowers-array',
                    component: 'FormArraySection',
                    componentProps: {
                      title: 'Созаемщики',
                      control: 'coBorrowers',
                      addButtonLabel: '+ Добавить созаемщика',
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
                                  model: 'personalData.lastName',
                                  component: 'Input',
                                  componentProps: {
                                    testId: 'step5.coBorrower.personalData.lastName',
                                  },
                                },
                                {
                                  model: 'personalData.firstName',
                                  component: 'Input',
                                  componentProps: {
                                    testId: 'step5.coBorrower.personalData.firstName',
                                  },
                                },
                                {
                                  model: 'personalData.middleName',
                                  component: 'Input',
                                  componentProps: {
                                    testId: 'step5.coBorrower.personalData.middleName',
                                  },
                                },
                              ],
                            },
                            {
                              model: 'personalData.birthDate',
                              component: 'Input',
                              componentProps: {
                                testId: 'step5.coBorrower.personalData.birthDate',
                              },
                            },
                            {
                              component: 'Box',
                              componentProps: { className: 'grid grid-cols-2 gap-4' },
                              children: [
                                {
                                  model: 'phone',
                                  component: 'InputMask',
                                  componentProps: { testId: 'step5.coBorrower.phone' },
                                },
                                {
                                  model: 'email',
                                  component: 'Input',
                                  componentProps: { testId: 'step5.coBorrower.email' },
                                },
                              ],
                            },
                            {
                              component: 'Box',
                              componentProps: { className: 'grid grid-cols-2 gap-4' },
                              children: [
                                {
                                  model: 'relationship',
                                  component: 'Select',
                                  componentProps: { testId: 'step5.coBorrower.relationship' },
                                },
                                {
                                  model: 'monthlyIncome',
                                  component: 'Input',
                                  componentProps: { testId: 'step5.coBorrower.monthlyIncome' },
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
        },

        // ====================================================================
        // Шаг 6: Подтверждение
        // ====================================================================
        {
          number: 6,
          title: 'Подтверждение',
          icon: '✓',
          body: {
            component: 'Box',
            componentProps: { className: 'space-y-6' },
            children: [
              {
                component: 'Section',
                componentProps: {
                  title: 'Обязательные согласия',
                  className: 'space-y-3',
                },
                children: [
                  {
                    model: 'agreePersonalData',
                    component: 'Checkbox',
                    componentProps: { testId: 'step6.agreePersonalData' },
                  },
                  {
                    model: 'agreeCreditHistory',
                    component: 'Checkbox',
                    componentProps: { testId: 'step6.agreeCreditHistory' },
                  },
                  {
                    model: 'agreeTerms',
                    component: 'Checkbox',
                    componentProps: { testId: 'step6.agreeTerms' },
                  },
                  {
                    model: 'confirmAccuracy',
                    component: 'Checkbox',
                    componentProps: { testId: 'step6.confirmAccuracy' },
                  },
                ],
              },
              {
                component: 'Section',
                componentProps: {
                  title: 'Опциональные согласия',
                },
                children: [
                  {
                    model: 'agreeMarketing',
                    component: 'Checkbox',
                    componentProps: { testId: 'step6.agreeMarketing' },
                  },
                ],
              },
              {
                component: 'Section',
                componentProps: {
                  title: 'Электронная подпись',
                  className: 'space-y-4',
                },
                children: [
                  {
                    model: 'electronicSignature',
                    component: 'InputMask',
                    componentProps: { testId: 'step6.electronicSignature' },
                  },
                ],
              },
            ],
          },
        },
      ],
    },
  },
};
