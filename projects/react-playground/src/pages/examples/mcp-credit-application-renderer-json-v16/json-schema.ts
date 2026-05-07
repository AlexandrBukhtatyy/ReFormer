/**
 * iter-16 / renderer-json — JSON form schema (UI tree).
 *
 * Root: FormRoot → FormWizard with 6 steps. Each step body is a Box with field nodes.
 * Step 5 contains 3 FormArraySection blocks (with $template item components).
 */
import type { JsonFormSchema } from '@reformer/renderer-json';

export const jsonSchema: JsonFormSchema = {
  version: '1.0',
  root: {
    selector: 'root',
    component: 'FormRoot',
    children: [
      {
        selector: 'wizard',
        component: 'FormWizard',
        componentProps: {
          // form, config, onSubmit injected via componentProps closure (see index.tsx)
          steps: [
            // ============ Step 1: Loan ============
            {
              number: 1,
              title: 'Кредит',
              icon: '💰',
              body: {
                component: 'Box',
                componentProps: { className: 'space-y-4' },
                children: [
                  { model: 'loanType', component: 'Select' },
                  { model: 'loanAmount', component: 'Input' },
                  { model: 'loanTerm', component: 'Input' },
                  { model: 'loanPurpose', component: 'Textarea' },

                  // Mortgage section
                  {
                    selector: 'mortgage-section',
                    component: 'Section',
                    componentProps: { title: 'Ипотека' },
                    children: [
                      { model: 'propertyValue', component: 'Input' },
                      { model: 'initialPayment', component: 'Input' },
                    ],
                  },

                  // Car section
                  {
                    selector: 'car-section',
                    component: 'Section',
                    componentProps: { title: 'Автокредит' },
                    children: [
                      { model: 'carBrand', component: 'Input' },
                      { model: 'carModel', component: 'Select' },
                      { model: 'carYear', component: 'Input' },
                      { model: 'carPrice', component: 'Input' },
                    ],
                  },

                  // Computed (read-only)
                  {
                    component: 'Section',
                    componentProps: { title: 'Расчёты' },
                    children: [
                      { model: 'interestRate', component: 'Input' },
                      { model: 'monthlyPayment', component: 'Input' },
                    ],
                  },
                ],
              },
            },

            // ============ Step 2: Personal ============
            {
              number: 2,
              title: 'Личные',
              icon: '👤',
              body: {
                component: 'Box',
                componentProps: { className: 'space-y-4' },
                children: [
                  {
                    component: 'Section',
                    componentProps: { title: 'Личные данные' },
                    children: [
                      { model: 'personalData.lastName', component: 'Input' },
                      { model: 'personalData.firstName', component: 'Input' },
                      { model: 'personalData.middleName', component: 'Input' },
                      { model: 'personalData.birthDate', component: 'Input' },
                      { model: 'personalData.gender', component: 'RadioGroup' },
                      { model: 'personalData.birthPlace', component: 'Input' },
                    ],
                  },
                  {
                    component: 'Section',
                    componentProps: { title: 'Паспортные данные' },
                    children: [
                      { model: 'passportData.series', component: 'InputMask' },
                      { model: 'passportData.number', component: 'InputMask' },
                      { model: 'passportData.issueDate', component: 'Input' },
                      { model: 'passportData.issuedBy', component: 'Input' },
                      { model: 'passportData.departmentCode', component: 'InputMask' },
                    ],
                  },
                  {
                    component: 'Section',
                    componentProps: { title: 'Документы' },
                    children: [
                      { model: 'inn', component: 'InputMask' },
                      { model: 'snils', component: 'InputMask' },
                    ],
                  },
                  {
                    component: 'Section',
                    componentProps: { title: 'Расчёты' },
                    children: [
                      { model: 'fullName', component: 'Input' },
                      { model: 'age', component: 'Input' },
                    ],
                  },
                ],
              },
            },

            // ============ Step 3: Contacts ============
            {
              number: 3,
              title: 'Контакты',
              icon: '📞',
              body: {
                component: 'Box',
                componentProps: { className: 'space-y-4' },
                children: [
                  {
                    component: 'Section',
                    componentProps: { title: 'Телефоны' },
                    children: [
                      { model: 'phoneMain', component: 'InputMask' },
                      { model: 'phoneAdditional', component: 'InputMask' },
                    ],
                  },
                  {
                    component: 'Section',
                    componentProps: { title: 'Email' },
                    children: [
                      { model: 'email', component: 'Input' },
                      { model: 'sameEmail', component: 'Checkbox' },
                      { model: 'emailAdditional', component: 'Input' },
                    ],
                  },
                  {
                    component: 'Section',
                    componentProps: { title: 'Адрес регистрации' },
                    children: [
                      { model: 'registrationAddress.region', component: 'Select' },
                      { model: 'registrationAddress.city', component: 'Select' },
                      { model: 'registrationAddress.street', component: 'Input' },
                      { model: 'registrationAddress.house', component: 'Input' },
                      { model: 'registrationAddress.apartment', component: 'Input' },
                      { model: 'registrationAddress.postalCode', component: 'InputMask' },
                    ],
                  },
                  { model: 'sameAsRegistration', component: 'Checkbox' },
                  {
                    selector: 'residence-section',
                    component: 'Section',
                    componentProps: { title: 'Адрес проживания' },
                    children: [
                      { model: 'residenceAddress.region', component: 'Select' },
                      { model: 'residenceAddress.city', component: 'Select' },
                      { model: 'residenceAddress.street', component: 'Input' },
                      { model: 'residenceAddress.house', component: 'Input' },
                      { model: 'residenceAddress.apartment', component: 'Input' },
                      { model: 'residenceAddress.postalCode', component: 'InputMask' },
                    ],
                  },
                ],
              },
            },

            // ============ Step 4: Employment ============
            {
              number: 4,
              title: 'Работа',
              icon: '💼',
              body: {
                component: 'Box',
                componentProps: { className: 'space-y-4' },
                children: [
                  { model: 'employmentStatus', component: 'RadioGroup' },

                  {
                    selector: 'employed-section',
                    component: 'Section',
                    componentProps: { title: 'Работа по найму' },
                    children: [
                      { model: 'companyName', component: 'Input' },
                      { model: 'companyInn', component: 'InputMask' },
                      { model: 'companyPhone', component: 'InputMask' },
                      { model: 'companyAddress', component: 'Input' },
                      { model: 'position', component: 'Input' },
                    ],
                  },

                  {
                    selector: 'self-employed-section',
                    component: 'Section',
                    componentProps: { title: 'ИП' },
                    children: [
                      { model: 'businessType', component: 'Input' },
                      { model: 'businessInn', component: 'InputMask' },
                      { model: 'businessActivity', component: 'Textarea' },
                    ],
                  },

                  {
                    component: 'Section',
                    componentProps: { title: 'Стаж работы' },
                    children: [
                      { model: 'workExperienceTotal', component: 'Input' },
                      { model: 'workExperienceCurrent', component: 'Input' },
                    ],
                  },

                  {
                    component: 'Section',
                    componentProps: { title: 'Доход' },
                    children: [
                      { model: 'monthlyIncome', component: 'Input' },
                      { model: 'additionalIncome', component: 'Input' },
                      { model: 'additionalIncomeSource', component: 'Input' },
                      { model: 'totalIncome', component: 'Input' },
                      { model: 'paymentToIncomeRatio', component: 'Input' },
                    ],
                  },
                ],
              },
            },

            // ============ Step 5: Additional ============
            {
              number: 5,
              title: 'Доп. инфо',
              icon: '📋',
              body: {
                component: 'Box',
                componentProps: { className: 'space-y-4' },
                children: [
                  {
                    component: 'Section',
                    componentProps: { title: 'Личное' },
                    children: [
                      { model: 'maritalStatus', component: 'RadioGroup' },
                      { model: 'dependents', component: 'Input' },
                      { model: 'education', component: 'Select' },
                    ],
                  },

                  // Properties
                  {
                    component: 'Section',
                    componentProps: { title: 'Имущество' },
                    children: [
                      { model: 'hasProperty', component: 'Checkbox' },
                      {
                        selector: 'properties-array',
                        component: 'FormArraySection',
                        componentProps: {
                          control: 'properties',
                          title: 'Список имущества',
                          itemLabel: 'PROPERTY_ITEM_LABEL',
                          addButtonLabel: '+ Добавить имущество',
                          removeButtonLabel: 'Удалить',
                          initialValue: 'PROPERTY_TEMPLATE',
                          emptyMessage: 'Нажмите «Добавить имущество», чтобы добавить запись',
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

                  // Existing loans
                  {
                    component: 'Section',
                    componentProps: { title: 'Существующие кредиты' },
                    children: [
                      { model: 'hasExistingLoans', component: 'Checkbox' },
                      {
                        selector: 'existing-loans-array',
                        component: 'FormArraySection',
                        componentProps: {
                          control: 'existingLoans',
                          title: 'Список кредитов',
                          itemLabel: 'LOAN_ITEM_LABEL',
                          addButtonLabel: '+ Добавить кредит',
                          removeButtonLabel: 'Удалить',
                          initialValue: 'EXISTING_LOAN_TEMPLATE',
                          emptyMessage: 'Нажмите «Добавить кредит», чтобы добавить запись',
                          itemComponent: {
                            $template: {
                              component: 'Box',
                              componentProps: { className: 'space-y-3' },
                              children: [
                                { model: 'bank', component: 'Input' },
                                { model: 'type', component: 'Input' },
                                { model: 'amount', component: 'Input' },
                                { model: 'remainingAmount', component: 'Input' },
                                { model: 'monthlyPayment', component: 'Input' },
                                { model: 'maturityDate', component: 'Input' },
                              ],
                            },
                          },
                        },
                      },
                    ],
                  },

                  // Co-borrowers
                  {
                    component: 'Section',
                    componentProps: { title: 'Созаемщики' },
                    children: [
                      { model: 'hasCoBorrower', component: 'Checkbox' },
                      {
                        selector: 'co-borrowers-array',
                        component: 'FormArraySection',
                        componentProps: {
                          control: 'coBorrowers',
                          title: 'Список созаемщиков',
                          itemLabel: 'CO_BORROWER_ITEM_LABEL',
                          addButtonLabel: '+ Добавить созаемщика',
                          removeButtonLabel: 'Удалить',
                          initialValue: 'CO_BORROWER_TEMPLATE',
                          emptyMessage: 'Нажмите «Добавить созаемщика», чтобы добавить запись',
                          itemComponent: {
                            $template: {
                              component: 'Box',
                              componentProps: { className: 'space-y-3' },
                              children: [
                                { model: 'personalData.lastName', component: 'Input' },
                                { model: 'personalData.firstName', component: 'Input' },
                                { model: 'personalData.middleName', component: 'Input' },
                                { model: 'personalData.birthDate', component: 'Input' },
                                { model: 'personalData.gender', component: 'RadioGroup' },
                                { model: 'personalData.birthPlace', component: 'Input' },
                                { model: 'phone', component: 'InputMask' },
                                { model: 'email', component: 'Input' },
                                { model: 'relationship', component: 'Input' },
                                { model: 'monthlyIncome', component: 'Input' },
                              ],
                            },
                          },
                        },
                      },
                      { model: 'coBorrowersIncome', component: 'Input' },
                    ],
                  },
                ],
              },
            },

            // ============ Step 6: Confirmation ============
            {
              number: 6,
              title: 'Подтверждение',
              icon: '✅',
              body: {
                component: 'Box',
                componentProps: { className: 'space-y-4' },
                children: [
                  {
                    component: 'Section',
                    componentProps: { title: 'Согласия' },
                    children: [
                      { model: 'agreePersonalData', component: 'Checkbox' },
                      { model: 'agreeCreditHistory', component: 'Checkbox' },
                      { model: 'agreeMarketing', component: 'Checkbox' },
                      { model: 'agreeTerms', component: 'Checkbox' },
                    ],
                  },
                  {
                    component: 'Section',
                    componentProps: { title: 'Подтверждение' },
                    children: [
                      { model: 'confirmAccuracy', component: 'Checkbox' },
                      { model: 'electronicSignature', component: 'InputMask' },
                    ],
                  },
                ],
              },
            },
          ],
        },
      },
    ],
  },
};
