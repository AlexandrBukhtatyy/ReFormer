/**
 * JSON-схема для формы кредитной заявки (iter-7 page 3, target=renderer-json).
 *
 * Структура:
 *   FormRoot (selector: 'root')
 *     ├─ stepN containers (selector: 'stepN'), N=1..6 — управляются `setHidden`
 *     │    в `index.tsx` через useEffect.
 *     └─ Внутри шагов — Section + Box (grid layouts) + поля по `model:`.
 *
 * Conditional sub-sections (selector + setHidden):
 *   - mortgage-section, car-section (step 1)
 *   - residence-address-section (step 3)
 *   - employer-section, business-section (step 4)
 *   - properties-array-section, existing-loans-array-section,
 *     coborrowers-array-section (step 5)
 *
 * Patch D напоминание: `componentProps` здесь несут только `selector` /
 * `wrapper` / `testId` / `className` для самого `RenderNodeComponent`. Сам
 * input берёт `label` / `placeholder` / `options` / `mask` из FieldNode.state.
 * componentProps (set в `createForm`). Дублирование `label` здесь —
 * документация, не runtime источник.
 *
 * 3 array-секции через **app-level RendererFormArraySection** (`'FormArraySection'`
 * в registry) + `componentProps.itemComponent.$template = {...}`. Никаких
 * per-page array-blocks.
 */

import type { JsonFormSchema } from '@reformer/renderer-json';

const STEP_CARD_PROPS = {
  className: 'space-y-6 bg-white border rounded-xl shadow-sm p-6',
};

export const creditApplicationJsonSchema: JsonFormSchema = {
  version: '1.0',
  root: {
    selector: 'root',
    component: 'FormRoot',
    children: [
      // ====================================================================
      // Step 1: Loan basics
      // ====================================================================
      {
        selector: 'step1',
        component: 'Section',
        componentProps: {
          ...STEP_CARD_PROPS,
          title: 'Шаг 1. Основная информация о кредите',
          titleAs: 'h2',
          titleClassName: 'text-xl font-bold mb-4 text-gray-900',
        },
        children: [
          {
            component: 'Box',
            componentProps: { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
            children: [
              { model: 'loanType', component: 'Select' },
              { model: 'loanAmount', component: 'Input' },
            ],
          },
          {
            component: 'Box',
            componentProps: { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
            children: [{ model: 'loanTerm', component: 'Input' }],
          },
          { model: 'loanPurpose', component: 'Textarea' },
          // mortgage-conditional sub-section
          {
            selector: 'mortgage-section',
            component: 'Section',
            componentProps: {
              title: 'Информация о недвижимости',
              titleAs: 'h3',
              titleClassName: 'text-lg font-semibold mt-2 text-gray-800',
              className: 'space-y-4',
            },
            children: [
              {
                component: 'Box',
                componentProps: { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                children: [
                  { model: 'propertyValue', component: 'Input' },
                  { model: 'initialPayment', component: 'Input' },
                ],
              },
            ],
          },
          // car-conditional sub-section
          {
            selector: 'car-section',
            component: 'Section',
            componentProps: {
              title: 'Информация об автомобиле',
              titleAs: 'h3',
              titleClassName: 'text-lg font-semibold mt-2 text-gray-800',
              className: 'space-y-4',
            },
            children: [
              {
                component: 'Box',
                componentProps: { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                children: [
                  { model: 'carBrand', component: 'Input' },
                  { model: 'carModel', component: 'Input' },
                ],
              },
              {
                component: 'Box',
                componentProps: { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                children: [
                  { model: 'carYear', component: 'Input' },
                  { model: 'carPrice', component: 'Input' },
                ],
              },
            ],
          },
        ],
      },

      // ====================================================================
      // Step 2: Personal data
      // ====================================================================
      {
        selector: 'step2',
        component: 'Section',
        componentProps: {
          ...STEP_CARD_PROPS,
          title: 'Шаг 2. Персональные данные',
          titleAs: 'h2',
          titleClassName: 'text-xl font-bold mb-4 text-gray-900',
        },
        children: [
          {
            component: 'Section',
            componentProps: {
              title: 'Личные данные',
              titleAs: 'h3',
              titleClassName: 'text-lg font-semibold text-gray-800',
              className: 'space-y-4',
            },
            children: [
              {
                component: 'Box',
                componentProps: { className: 'grid grid-cols-1 md:grid-cols-3 gap-4' },
                children: [
                  { model: 'personalData.lastName', component: 'Input' },
                  { model: 'personalData.firstName', component: 'Input' },
                  { model: 'personalData.middleName', component: 'Input' },
                ],
              },
              {
                component: 'Box',
                componentProps: { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                children: [
                  { model: 'personalData.birthDate', component: 'Input' },
                  { model: 'personalData.gender', component: 'RadioGroup' },
                ],
              },
              { model: 'personalData.birthPlace', component: 'Input' },
            ],
          },
          {
            component: 'Section',
            componentProps: {
              title: 'Паспортные данные',
              titleAs: 'h3',
              titleClassName: 'text-lg font-semibold text-gray-800',
              className: 'space-y-4',
            },
            children: [
              {
                component: 'Box',
                componentProps: { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                children: [
                  { model: 'passportData.series', component: 'InputMask' },
                  { model: 'passportData.number', component: 'InputMask' },
                ],
              },
              {
                component: 'Box',
                componentProps: { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                children: [
                  { model: 'passportData.issueDate', component: 'Input' },
                  { model: 'passportData.departmentCode', component: 'InputMask' },
                ],
              },
              { model: 'passportData.issuedBy', component: 'Textarea' },
            ],
          },
          {
            component: 'Section',
            componentProps: {
              title: 'Документы',
              titleAs: 'h3',
              titleClassName: 'text-lg font-semibold text-gray-800',
              className: 'space-y-4',
            },
            children: [
              {
                component: 'Box',
                componentProps: { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                children: [
                  { model: 'inn', component: 'InputMask' },
                  { model: 'snils', component: 'InputMask' },
                ],
              },
            ],
          },
        ],
      },

      // ====================================================================
      // Step 3: Contacts
      // ====================================================================
      {
        selector: 'step3',
        component: 'Section',
        componentProps: {
          ...STEP_CARD_PROPS,
          title: 'Шаг 3. Контактная информация',
          titleAs: 'h2',
          titleClassName: 'text-xl font-bold mb-4 text-gray-900',
        },
        children: [
          {
            component: 'Section',
            componentProps: {
              title: 'Телефоны и email',
              titleAs: 'h3',
              titleClassName: 'text-lg font-semibold text-gray-800',
              className: 'space-y-4',
            },
            children: [
              {
                component: 'Box',
                componentProps: { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                children: [
                  { model: 'phoneMain', component: 'InputMask' },
                  { model: 'phoneAdditional', component: 'InputMask' },
                ],
              },
              {
                component: 'Box',
                componentProps: { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                children: [
                  { model: 'email', component: 'Input' },
                  { model: 'emailAdditional', component: 'Input' },
                ],
              },
            ],
          },
          {
            component: 'Section',
            componentProps: {
              title: 'Адрес регистрации',
              titleAs: 'h3',
              titleClassName: 'text-lg font-semibold text-gray-800',
              className: 'space-y-4',
            },
            children: [
              {
                component: 'Box',
                componentProps: { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                children: [
                  { model: 'registrationAddress.region', component: 'Input' },
                  { model: 'registrationAddress.city', component: 'Input' },
                ],
              },
              { model: 'registrationAddress.street', component: 'Input' },
              {
                component: 'Box',
                componentProps: { className: 'grid grid-cols-1 md:grid-cols-3 gap-4' },
                children: [
                  { model: 'registrationAddress.house', component: 'Input' },
                  { model: 'registrationAddress.apartment', component: 'Input' },
                  { model: 'registrationAddress.postalCode', component: 'InputMask' },
                ],
              },
            ],
          },
          { model: 'sameAsRegistration', component: 'Checkbox' },
          // residence-address-conditional sub-section
          {
            selector: 'residence-address-section',
            component: 'Section',
            componentProps: {
              title: 'Адрес проживания',
              titleAs: 'h3',
              titleClassName: 'text-lg font-semibold text-gray-800',
              className: 'space-y-4',
            },
            children: [
              {
                component: 'Box',
                componentProps: { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                children: [
                  { model: 'residenceAddress.region', component: 'Input' },
                  { model: 'residenceAddress.city', component: 'Input' },
                ],
              },
              { model: 'residenceAddress.street', component: 'Input' },
              {
                component: 'Box',
                componentProps: { className: 'grid grid-cols-1 md:grid-cols-3 gap-4' },
                children: [
                  { model: 'residenceAddress.house', component: 'Input' },
                  { model: 'residenceAddress.apartment', component: 'Input' },
                  { model: 'residenceAddress.postalCode', component: 'InputMask' },
                ],
              },
            ],
          },
        ],
      },

      // ====================================================================
      // Step 4: Employment
      // ====================================================================
      {
        selector: 'step4',
        component: 'Section',
        componentProps: {
          ...STEP_CARD_PROPS,
          title: 'Шаг 4. Информация о занятости',
          titleAs: 'h2',
          titleClassName: 'text-xl font-bold mb-4 text-gray-900',
        },
        children: [
          { model: 'employmentStatus', component: 'RadioGroup' },
          // employer-conditional sub-section
          {
            selector: 'employer-section',
            component: 'Section',
            componentProps: {
              title: 'Работа по найму',
              titleAs: 'h3',
              titleClassName: 'text-lg font-semibold text-gray-800',
              className: 'space-y-4',
            },
            children: [
              { model: 'companyName', component: 'Input' },
              {
                component: 'Box',
                componentProps: { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                children: [
                  { model: 'companyInn', component: 'InputMask' },
                  { model: 'companyPhone', component: 'InputMask' },
                ],
              },
              { model: 'companyAddress', component: 'Input' },
              { model: 'position', component: 'Input' },
            ],
          },
          // business-conditional sub-section
          {
            selector: 'business-section',
            component: 'Section',
            componentProps: {
              title: 'Индивидуальный предприниматель',
              titleAs: 'h3',
              titleClassName: 'text-lg font-semibold text-gray-800',
              className: 'space-y-4',
            },
            children: [
              { model: 'businessType', component: 'Input' },
              { model: 'businessInn', component: 'InputMask' },
              { model: 'businessActivity', component: 'Textarea' },
            ],
          },
          {
            component: 'Section',
            componentProps: {
              title: 'Стаж',
              titleAs: 'h3',
              titleClassName: 'text-lg font-semibold text-gray-800',
              className: 'space-y-4',
            },
            children: [
              {
                component: 'Box',
                componentProps: { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                children: [
                  { model: 'workExperienceTotal', component: 'Input' },
                  { model: 'workExperienceCurrent', component: 'Input' },
                ],
              },
            ],
          },
          {
            component: 'Section',
            componentProps: {
              title: 'Доход',
              titleAs: 'h3',
              titleClassName: 'text-lg font-semibold text-gray-800',
              className: 'space-y-4',
            },
            children: [
              { model: 'monthlyIncome', component: 'Input' },
              {
                component: 'Box',
                componentProps: { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                children: [
                  { model: 'additionalIncome', component: 'Input' },
                  { model: 'additionalIncomeSource', component: 'Input' },
                ],
              },
            ],
          },
        ],
      },

      // ====================================================================
      // Step 5: Additional info (3 arrays)
      // ====================================================================
      {
        selector: 'step5',
        component: 'Section',
        componentProps: {
          ...STEP_CARD_PROPS,
          title: 'Шаг 5. Дополнительная информация',
          titleAs: 'h2',
          titleClassName: 'text-xl font-bold mb-4 text-gray-900',
        },
        children: [
          {
            component: 'Section',
            componentProps: {
              title: 'Семейное положение и образование',
              titleAs: 'h3',
              titleClassName: 'text-lg font-semibold text-gray-800',
              className: 'space-y-4',
            },
            children: [
              { model: 'maritalStatus', component: 'RadioGroup' },
              {
                component: 'Box',
                componentProps: { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                children: [
                  { model: 'dependents', component: 'Input' },
                  { model: 'education', component: 'Select' },
                ],
              },
            ],
          },
          // Properties array
          {
            component: 'Section',
            componentProps: { className: 'space-y-3' },
            children: [
              { model: 'hasProperty', component: 'Checkbox' },
              {
                selector: 'properties-array-section',
                component: 'FormArraySection',
                componentProps: {
                  title: 'Имущество',
                  control: 'properties',
                  addButtonLabel: '+ Добавить имущество',
                  removeButtonLabel: 'Удалить',
                  initialValue: 'PROPERTY_TEMPLATE',
                  emptyLabel: 'Пока ничего не добавлено',
                  itemComponent: {
                    $template: {
                      component: 'Box',
                      componentProps: { className: 'space-y-3' },
                      children: [
                        { model: 'type', component: 'Select' },
                        { model: 'description', component: 'Textarea' },
                        { model: 'estimatedValue', component: 'Input' },
                        { model: 'hasEncumbrance', component: 'Checkbox' },
                      ],
                    },
                  },
                },
              },
            ],
          },
          // Existing loans array
          {
            component: 'Section',
            componentProps: { className: 'space-y-3' },
            children: [
              { model: 'hasExistingLoans', component: 'Checkbox' },
              {
                selector: 'existing-loans-array-section',
                component: 'FormArraySection',
                componentProps: {
                  title: 'Существующие кредиты',
                  control: 'existingLoans',
                  addButtonLabel: '+ Добавить кредит',
                  removeButtonLabel: 'Удалить',
                  initialValue: 'EXISTING_LOAN_TEMPLATE',
                  emptyLabel: 'Пока ничего не добавлено',
                  itemComponent: {
                    $template: {
                      component: 'Box',
                      componentProps: { className: 'space-y-3' },
                      children: [
                        { model: 'bank', component: 'Input' },
                        { model: 'type', component: 'Select' },
                        {
                          component: 'Box',
                          componentProps: { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                          children: [
                            { model: 'amount', component: 'Input' },
                            { model: 'remainingAmount', component: 'Input' },
                          ],
                        },
                        {
                          component: 'Box',
                          componentProps: { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                          children: [
                            { model: 'monthlyPayment', component: 'Input' },
                            { model: 'maturityDate', component: 'Input' },
                          ],
                        },
                      ],
                    },
                  },
                },
              },
            ],
          },
          // CoBorrowers array
          {
            component: 'Section',
            componentProps: { className: 'space-y-3' },
            children: [
              { model: 'hasCoBorrower', component: 'Checkbox' },
              {
                selector: 'coborrowers-array-section',
                component: 'FormArraySection',
                componentProps: {
                  title: 'Созаемщики',
                  control: 'coBorrowers',
                  addButtonLabel: '+ Добавить созаемщика',
                  removeButtonLabel: 'Удалить',
                  initialValue: 'COBORROWER_TEMPLATE',
                  emptyLabel: 'Пока ничего не добавлено',
                  itemComponent: {
                    $template: {
                      component: 'Box',
                      componentProps: { className: 'space-y-3' },
                      children: [
                        {
                          component: 'Box',
                          componentProps: { className: 'grid grid-cols-1 md:grid-cols-3 gap-4' },
                          children: [
                            { model: 'personalData.lastName', component: 'Input' },
                            { model: 'personalData.firstName', component: 'Input' },
                            { model: 'personalData.middleName', component: 'Input' },
                          ],
                        },
                        { model: 'personalData.birthDate', component: 'Input' },
                        {
                          component: 'Box',
                          componentProps: { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                          children: [
                            { model: 'phone', component: 'InputMask' },
                            { model: 'email', component: 'Input' },
                          ],
                        },
                        {
                          component: 'Box',
                          componentProps: { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                          children: [
                            { model: 'relationship', component: 'Select' },
                            { model: 'monthlyIncome', component: 'Input' },
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

      // ====================================================================
      // Step 6: Confirmation
      // ====================================================================
      {
        selector: 'step6',
        component: 'Section',
        componentProps: {
          ...STEP_CARD_PROPS,
          title: 'Шаг 6. Подтверждение и согласия',
          titleAs: 'h2',
          titleClassName: 'text-xl font-bold mb-4 text-gray-900',
        },
        children: [
          {
            component: 'Section',
            componentProps: {
              title: 'Обязательные согласия',
              titleAs: 'h3',
              titleClassName: 'text-lg font-semibold text-gray-800',
              className: 'space-y-3',
            },
            children: [
              { model: 'agreePersonalData', component: 'Checkbox' },
              { model: 'agreeCreditHistory', component: 'Checkbox' },
              { model: 'agreeTerms', component: 'Checkbox' },
              { model: 'confirmAccuracy', component: 'Checkbox' },
            ],
          },
          {
            component: 'Section',
            componentProps: {
              title: 'Опциональные согласия',
              titleAs: 'h3',
              titleClassName: 'text-lg font-semibold text-gray-800',
              className: 'space-y-3',
            },
            children: [{ model: 'agreeMarketing', component: 'Checkbox' }],
          },
          {
            component: 'Section',
            componentProps: {
              title: 'Электронная подпись',
              titleAs: 'h3',
              titleClassName: 'text-lg font-semibold text-gray-800',
              className: 'space-y-4',
            },
            children: [{ model: 'electronicSignature', component: 'InputMask' }],
          },
        ],
      },
    ],
  },
};
