import type { JsonFormSchema } from '@reformer/renderer-json';

// Pure JSON schema. Field-nodes use `model` (string path), containers use `component` + `children`.
// Section selectors `step1`..`step6` are stable so future stage 5 can drive setHidden().
export const creditApplicationJsonSchema: JsonFormSchema = {
  version: '1.0',
  root: {
    component: 'FormRoot',
    children: [
      {
        selector: 'step1',
        component: 'Section',
        componentProps: { title: 'Шаг 1. Параметры кредита', className: 'mb-6' },
        children: [
          {
            component: 'Box',
            componentProps: { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
            children: [
              {
                model: 'loanType',
                component: 'Select',
                componentProps: { label: 'Тип кредита', options: 'LOAN_TYPE_OPTIONS' },
              },
              {
                model: 'loanAmount',
                component: 'Input',
                componentProps: { label: 'Сумма кредита (руб.)', type: 'number', min: 0 },
              },
              {
                model: 'loanTerm',
                component: 'Input',
                componentProps: { label: 'Срок кредита (мес.)', type: 'number', min: 1 },
              },
              {
                model: 'loanPurpose',
                component: 'Textarea',
                componentProps: { label: 'Цель кредита', rows: 2 },
              },

              // mortgage-only fields (hidden by behavior; visible while loanType==='mortgage')
              {
                model: 'propertyValue',
                component: 'Input',
                componentProps: { label: 'Стоимость объекта (руб.)', type: 'number', min: 0 },
              },
              {
                model: 'initialPayment',
                component: 'Input',
                componentProps: { label: 'Первоначальный взнос (руб.)', type: 'number', min: 0 },
              },

              // car-only fields
              {
                model: 'carBrand',
                component: 'Input',
                componentProps: { label: 'Марка/модель авто' },
              },
              {
                model: 'carYear',
                component: 'Input',
                componentProps: { label: 'Год выпуска', type: 'number' },
              },

              // computed
              {
                model: 'interestRate',
                component: 'Input',
                componentProps: { label: 'Ставка, % годовых', type: 'number', readOnly: true },
              },
              {
                model: 'monthlyPayment',
                component: 'Input',
                componentProps: {
                  label: 'Ежемесячный платёж (руб.)',
                  type: 'number',
                  readOnly: true,
                },
              },
            ],
          },
        ],
      },

      {
        selector: 'step2',
        component: 'Section',
        componentProps: { title: 'Шаг 2. Личные данные', className: 'mb-6' },
        children: [
          {
            component: 'Box',
            componentProps: { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
            children: [
              { model: 'lastName', component: 'Input', componentProps: { label: 'Фамилия' } },
              { model: 'firstName', component: 'Input', componentProps: { label: 'Имя' } },
              { model: 'middleName', component: 'Input', componentProps: { label: 'Отчество' } },
              {
                model: 'birthDate',
                component: 'Input',
                componentProps: { label: 'Дата рождения', type: 'date' },
              },
              {
                model: 'passport',
                component: 'InputMask',
                componentProps: { label: 'Паспорт (серия и номер)', mask: '0000 000000' },
              },
              {
                model: 'inn',
                component: 'InputMask',
                componentProps: { label: 'ИНН', mask: '000000000000' },
              },
              {
                model: 'maritalStatus',
                component: 'Select',
                componentProps: { label: 'Семейное положение', options: 'MARITAL_STATUS_OPTIONS' },
              },
              {
                model: 'childrenCount',
                component: 'Input',
                componentProps: { label: 'Количество детей', type: 'number', min: 0 },
              },
              {
                model: 'fullName',
                component: 'Input',
                componentProps: { label: 'Полное ФИО', readOnly: true },
              },
              {
                model: 'age',
                component: 'Input',
                componentProps: { label: 'Возраст', type: 'number', readOnly: true },
              },
            ],
          },
        ],
      },

      {
        selector: 'step3',
        component: 'Section',
        componentProps: { title: 'Шаг 3. Занятость', className: 'mb-6' },
        children: [
          {
            component: 'Box',
            componentProps: { className: 'flex flex-col gap-4' },
            children: [
              {
                model: 'employmentStatus',
                component: 'RadioGroup',
                componentProps: { label: 'Статус занятости', options: 'EMPLOYMENT_STATUS_OPTIONS' },
              },
              {
                component: 'Box',
                componentProps: { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                children: [
                  {
                    model: 'companyName',
                    component: 'Input',
                    componentProps: { label: 'Наименование компании' },
                  },
                  { model: 'position', component: 'Input', componentProps: { label: 'Должность' } },
                  {
                    model: 'workExperience',
                    component: 'Input',
                    componentProps: { label: 'Стаж (мес.)', type: 'number', min: 0 },
                  },
                  {
                    model: 'monthlySalary',
                    component: 'Input',
                    componentProps: { label: 'Ежемесячный доход (руб.)', type: 'number', min: 0 },
                  },
                  {
                    model: 'businessType',
                    component: 'Input',
                    componentProps: { label: 'Вид деятельности' },
                  },
                  {
                    model: 'monthlyRevenue',
                    component: 'Input',
                    componentProps: {
                      label: 'Ежемесячный доход от бизнеса (руб.)',
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
        selector: 'step4',
        component: 'Section',
        componentProps: { title: 'Шаг 4. Финансовая информация', className: 'mb-6' },
        children: [
          {
            component: 'Box',
            componentProps: { className: 'flex flex-col gap-4' },
            children: [
              {
                component: 'Box',
                componentProps: { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                children: [
                  {
                    model: 'additionalIncome',
                    component: 'Input',
                    componentProps: {
                      label: 'Дополнительный доход (руб./мес.)',
                      type: 'number',
                      min: 0,
                    },
                  },
                  {
                    model: 'monthlyExpenses',
                    component: 'Input',
                    componentProps: { label: 'Ежемесячные расходы (руб.)', type: 'number', min: 0 },
                  },
                ],
              },
              {
                model: 'hasProperty',
                component: 'Checkbox',
                componentProps: { label: 'Есть имущество в собственности' },
              },
              // Custom block — renders FormArray UI for properties when hasProperty=true.
              { component: 'PropertiesArrayBlock' },
              {
                model: 'hasExistingLoans',
                component: 'Checkbox',
                componentProps: { label: 'Есть действующие кредиты' },
              },
              { component: 'ExistingLoansArrayBlock' },
              {
                component: 'Box',
                componentProps: { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                children: [
                  {
                    model: 'totalIncome',
                    component: 'Input',
                    componentProps: {
                      label: 'Общий доход (руб./мес.)',
                      type: 'number',
                      readOnly: true,
                    },
                  },
                  {
                    model: 'paymentToIncomeRatio',
                    component: 'Input',
                    componentProps: {
                      label: 'Долговая нагрузка (PTI), %',
                      type: 'number',
                      readOnly: true,
                    },
                  },
                ],
              },
            ],
          },
        ],
      },

      {
        selector: 'step5',
        component: 'Section',
        componentProps: { title: 'Шаг 5. Созаёмщики', className: 'mb-6' },
        children: [
          {
            component: 'Box',
            componentProps: { className: 'flex flex-col gap-4' },
            children: [
              {
                model: 'hasCoBorrower',
                component: 'Checkbox',
                componentProps: { label: 'Привлечь созаёмщиков' },
              },
              { component: 'CoBorrowersArrayBlock' },
              {
                model: 'coBorrowersIncome',
                component: 'Input',
                componentProps: {
                  label: 'Доход созаёмщиков (руб./мес.)',
                  type: 'number',
                  readOnly: true,
                },
              },
            ],
          },
        ],
      },

      {
        selector: 'step6',
        component: 'Section',
        componentProps: { title: 'Шаг 6. Подтверждение', className: 'mb-6' },
        children: [
          {
            component: 'Box',
            componentProps: { className: 'flex flex-col gap-4' },
            children: [
              {
                model: 'agreeToProcessData',
                component: 'Checkbox',
                componentProps: { label: 'Согласен на обработку персональных данных' },
              },
              {
                model: 'agreeToCreditCheck',
                component: 'Checkbox',
                componentProps: { label: 'Согласен на проверку кредитной истории' },
              },
              {
                component: 'Box',
                componentProps: { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                children: [
                  {
                    model: 'contactPhone',
                    component: 'InputMask',
                    componentProps: { label: 'Контактный телефон', mask: '+7 (000) 000-00-00' },
                  },
                  {
                    model: 'contactEmail',
                    component: 'Input',
                    componentProps: { label: 'Контактный email', type: 'email' },
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
