# Кредитная заявка в новом контракте: пример для оценки

Эталонная форма
[complex-multy-step-form](../../projects/react-playground/src/pages/demo/complex-multy-step-form)
переписана под контракт, согласованный в шагах 1–9
([synchronous-snacking-moon.md](synchronous-snacking-moon.md)). Цель — увидеть контракт на реальной
форме: 6 шагов, 85 полей, подформа адреса, три массива, условные секции, вычисляемые поля, загрузка
и отправка.

**Код не запускался.** Контракт ещё не реализован: `createForm` в новом смысле, `arrayOf`, узел
`part`, `apply` / `applyEach` в валидации, `schema` в поведении, библиотечный визард в схеме —
из согласованных шагов. Всё остальное (компоненты, правила, операторы поведения) — существующее API.

## Как читать

- **За основу взято дерево renderer-варианта** — в нём разметка описана полностью. Подписи,
  плейсхолдеры, классы и `selector` перенесены как есть. Добавлен чекбокс `sameEmail`, который
  был только в варианте «React руками».
- **Полностью показано** всё, где есть отдельная конструкция контракта: каркас, шаги «Кредит»,
  «Контакты», «Доп. инфо», «Подтверждение», подформа адреса, три шаблона массивов, поведение,
  сборка трёх вариантов.
- **Свёрнуто** то, что повторяет уже показанное: шаги «Данные» и «Работа» (27 полей того же вида,
  что в шаге «Кредит»), константы правил и cross-field функции в валидации (они не меняются).
  Каждое свёрнутое место помечено и посчитано.
- Узлы записаны объектом `{ model, component, componentProps }`, без локальных хелперов — так, как
  их определяет контракт.

## 1. Раскладка файлов

**Было** — три варианта одной формы:

| Что | Файл | Строк |
| --- | --- | --- |
| модель | `schemas/model.ts` | 159 |
| схема формы (карта полей) — React руками | `schemas/schema.ts` | 680 |
| схема UI — renderer | `render-schema.ts` | 1 093 |
| схема UI — JSON | `json-schema.json` | 1 421 |
| валидация | `schemas/validation.ts` | 773 |
| поведение модели | `schemas/behavior.ts`, `operators.ts`, `address-behavior.ts` | 139 + 59 + 17 |
| поведение рендера — renderer | `render-behavior.ts` | 144 |
| поведение рендера — JSON | `render-behavior.ts` | 39 |
| сборка — React руками | `schemas/create-form.ts` | 40 |
| shim визарда | `components/RendererFormWizard.tsx` | 113 |
| реестр — JSON | `registry.ts` | 127 |

**Стало** — один набор файлов на форму:

```
credit-application/
├── types.ts
├── model.ts               # значения и шаблоны новых элементов массивов
├── form.schema.ts         # каркас: загрузка → визард → шаги
├── form.validation.ts     # правила: шаги, подформы, элементы массивов
├── form.behavior.ts       # единственное поведение
├── api.ts
├── steps/
│   ├── loan/form.schema.ts
│   ├── applicant/form.schema.ts
│   ├── contacts/form.schema.ts      # + подформа адреса
│   ├── employment/form.schema.ts
│   ├── additional/form.schema.ts    # + шаблоны трёх массивов
│   └── confirmation/form.schema.ts
└── index.tsx              # сборка и рендер

# только JSON-вариант
├── form.schema.json       # то же дерево данными, вместо form.schema.ts и steps/*
└── registry.ts
```

Не стало: карты полей, двух файлов поведения рендера, файла сборки, shim визарда.

## 2. Модель — `model.ts`

Начальные значения не меняются. Меняются три строки с массивами: шаблон нового элемента объявлен у
самого поля (шаг 9).

```ts
import { createModel, arrayOf, type FormModel } from '@reformer/core';
import type { Address, CoBorrower, CreditApplicationForm, ExistingLoan, Property } from './types';

const blankAddress = (): Address => ({
  region: '',
  city: '',
  street: '',
  house: '',
  apartment: '',
  postalCode: '',
});

const blankProperty = (): Property => ({
  type: 'apartment',
  description: '',
  estimatedValue: 0,
  hasEncumbrance: false,
});

const blankExistingLoan = (): ExistingLoan => ({
  bank: '',
  type: 'consumer',
  amount: 0,
  remainingAmount: 0,
  monthlyPayment: 0,
  maturityDate: '',
});

const blankCoBorrower = (): CoBorrower => ({
  personalData: { lastName: '', firstName: '', middleName: '', birthDate: '' },
  phone: '',
  email: '',
  relationship: 'spouse',
  monthlyIncome: 0,
});

export const createCreditApplicationModel = (): FormModel<CreditApplicationForm> =>
  createModel<CreditApplicationForm>({
    // Шаг 1
    loanType: 'consumer',
    loanAmount: null,
    loanTerm: 12,
    // … остальные скалярные поля шагов 1–6 и вычисляемые поля — как сейчас (≈ 70 строк)

    // Шаг 3
    registrationAddress: blankAddress(),
    sameAsRegistration: true,
    residenceAddress: blankAddress(),

    // Шаг 5: пустой массив + шаблон для кнопки «Добавить»
    hasProperty: false,
    properties: arrayOf(blankProperty),
    hasExistingLoans: false,
    existingLoans: arrayOf(blankExistingLoan),
    hasCoBorrower: false,
    coBorrowers: arrayOf(blankCoBorrower),
  });
```

Было: `properties: []`, а фабрики `createBlankProperty` и две другие экспортировались и
подставлялись в схему (`initialValue: createBlankProperty`) и в JSX
(`initialValue={createBlankProperty()}`).

## 3. Схема — `form.schema.ts` и шаги

### 3.1. Каркас

```ts
// form.schema.ts
import type { FormModel } from '@reformer/core';
import { AsyncBoundary, FormWizard } from '@reformer/ui-kit';
import type { CreditApplicationForm } from './types';
import { loanStep } from './steps/loan/form.schema';
import { applicantStep } from './steps/applicant/form.schema';
import { contactsStep } from './steps/contacts/form.schema';
import { employmentStep } from './steps/employment/form.schema';
import { additionalStep } from './steps/additional/form.schema';
import { confirmationStep } from './steps/confirmation/form.schema';

export const creditSchema = (model: FormModel<CreditApplicationForm>) => ({
  selector: 'data-boundary',
  component: AsyncBoundary,
  componentProps: { status: 'loading' }, // статус и текст ошибки подставляет поведение
  children: [
    {
      selector: 'wizard',
      component: FormWizard, // библиотечный компонент ui-kit
      componentProps: {
        className: 'bg-white p-8 rounded-lg shadow-md',
        submitLabel: 'Отправить заявку',
      },
      children: [
        loanStep(model),
        applicantStep(model),
        contactsStep(model),
        employmentStep(model),
        additionalStep(model),
        confirmationStep(model),
      ],
    },
  ],
});
```

Было — узел визарда в `render-schema.ts`:

```ts
export function buildCreditApplicationSchema(
  model: FormModel<CreditApplicationForm>,
  form?: FormProxy<CreditApplicationForm> // билдер вызывался дважды: без формы и с формой
) {
  // …
      {
        selector: 'wizard',
        component: RendererFormWizard, // прикладной shim, 113 строк
        componentProps: {
          ...(form ? { form } : {}),
          ...makeCreditValidationConfig(model),
          className: 'bg-white p-8 rounded-lg shadow-md',
          submitLabel: 'Отправить заявку',
          steps: [/* шаги — в пропсе, а не в children */],
        },
      },
```

### 3.2. Шаг «Кредит» — поля и условные секции

```ts
// steps/loan/form.schema.ts
import type { FormModel } from '@reformer/core';
import { Step } from '@reformer/cdk/form-wizard';
import { Box, Input, InputNumber, Section, SelectAsync, Textarea } from '@reformer/ui-kit';
import { LOAN_TYPES, type CreditApplicationForm } from '../../types';

const CURRENT_YEAR = new Date().getFullYear();

export const loanStep = (model: FormModel<CreditApplicationForm>) => ({
  selector: 'loan', // он же ключ правил шага в form.validation.ts
  component: Step,
  componentProps: { title: 'Кредит', icon: '💰' },
  children: [
    {
      component: Box,
      componentProps: { className: 'space-y-6' },
      children: [
        {
          component: Section,
          componentProps: {
            title: 'Основная информация о кредите',
            titleAs: 'h2',
            titleClassName: 'text-xl font-bold',
            className: 'space-y-6',
          },
          children: [
            {
              model: model.$.loanType,
              component: SelectAsync,
              componentProps: {
                label: 'Тип кредита',
                placeholder: 'Выберите тип кредита',
                options: LOAN_TYPES,
              },
            },
            {
              model: model.$.loanAmount,
              component: InputNumber,
              componentProps: {
                label: 'Сумма кредита (₽)',
                placeholder: 'Введите сумму',
                min: 50000,
                max: 10000000,
                step: 10000,
              },
            },
            {
              model: model.$.loanTerm,
              component: InputNumber,
              componentProps: {
                label: 'Срок кредита (месяцев)',
                placeholder: 'Введите срок',
                min: 6,
                max: 240,
              },
            },
            {
              model: model.$.loanPurpose,
              component: Textarea,
              componentProps: {
                label: 'Цель кредита',
                placeholder: 'Опишите, на что планируете потратить средства',
                rows: 4,
                maxLength: 500,
              },
            },
          ],
        },
        {
          selector: 'mortgage-section', // видимость — в form.behavior.ts
          component: Section,
          componentProps: {
            title: 'Информация о недвижимости',
            titleClassName: 'text-lg font-semibold mt-4',
            className: 'space-y-4',
          },
          children: [
            {
              model: model.$.propertyValue,
              component: InputNumber,
              componentProps: {
                label: 'Стоимость недвижимости (₽)',
                placeholder: 'Введите стоимость',
                min: 1000000,
                step: 100000,
              },
            },
            {
              model: model.$.initialPayment,
              component: InputNumber,
              componentProps: {
                label: 'Первоначальный взнос (₽)',
                placeholder: 'Введите сумму',
                min: 0,
                step: 10000,
              },
            },
          ],
        },
        {
          selector: 'car-section',
          component: Section,
          componentProps: {
            title: 'Информация об автомобиле',
            titleClassName: 'text-lg font-semibold mt-4',
            className: 'space-y-4',
          },
          children: [
            {
              model: model.$.carBrand,
              component: Input,
              componentProps: { label: 'Марка автомобиля', placeholder: 'Например: Toyota' },
            },
            {
              model: model.$.carModel,
              component: SelectAsync,
              componentProps: { label: 'Модель автомобиля', placeholder: 'Например: Camry' },
            },
            {
              component: Box,
              componentProps: { className: 'grid grid-cols-2 gap-4' },
              children: [
                {
                  model: model.$.carYear,
                  component: InputNumber,
                  componentProps: {
                    label: 'Год выпуска',
                    placeholder: '2020',
                    min: 2000,
                    max: CURRENT_YEAR + 1,
                  },
                },
                {
                  model: model.$.carPrice,
                  component: InputNumber,
                  componentProps: {
                    label: 'Стоимость автомобиля (₽)',
                    placeholder: 'Введите стоимость',
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
});
```

Отличия от сегодняшнего `render-schema.ts`: ключ `model` вместо `value`, у шага появился
`selector`. Больше ничего — узлы те же.

### 3.3. Шаг «Контакты» — подформа адреса

Адрес объявлен один раз и стоит в схеме дважды. Сейчас в renderer-варианте он записан дважды
целиком.

```ts
// steps/contacts/form.schema.ts
import type { FormModel } from '@reformer/core';
import { Step } from '@reformer/cdk/form-wizard';
import { Box, CheckboxWithLabel, Input, InputMask, Section } from '@reformer/ui-kit';
import { ResidenceAddressSection } from '../../components/ResidenceAddressSection';
import type { Address, CreditApplicationForm } from '../../types';

/** Подформа адреса: получает под-модель, привязки внутри — через её `$`. */
export const address = (model: FormModel<Address>) => ({
  component: Box,
  componentProps: { className: 'space-y-4' },
  children: [
    {
      component: Box,
      componentProps: { className: 'grid grid-cols-2 gap-4' },
      children: [
        {
          model: model.$.region,
          component: Input,
          componentProps: { label: 'Регион', placeholder: 'Введите регион' },
        },
        {
          model: model.$.city,
          component: Input,
          componentProps: { label: 'Город', placeholder: 'Введите город' },
        },
      ],
    },
    {
      model: model.$.street,
      component: Input,
      componentProps: { label: 'Улица', placeholder: 'Введите улицу' },
    },
    {
      component: Box,
      componentProps: { className: 'grid grid-cols-3 gap-4' },
      children: [
        {
          model: model.$.house,
          component: Input,
          componentProps: { label: 'Дом', placeholder: '№' },
        },
        {
          model: model.$.apartment,
          component: Input,
          componentProps: { label: 'Квартира', placeholder: '№' },
        },
        {
          model: model.$.postalCode,
          component: InputMask,
          componentProps: { label: 'Индекс', placeholder: '000000', mask: '999999' },
        },
      ],
    },
  ],
});

const PHONE = { placeholder: '+7 (___) ___-__-__', mask: '+7 (999) 999-99-99' };

export const contactsStep = (model: FormModel<CreditApplicationForm>) => ({
  selector: 'contacts',
  component: Step,
  componentProps: { title: 'Контакты', icon: '📞' },
  children: [
    {
      component: Section,
      componentProps: {
        title: 'Контактная информация',
        titleAs: 'h2',
        titleClassName: 'text-xl font-bold',
        className: 'space-y-6',
      },
      children: [
        {
          component: Section,
          componentProps: {
            title: 'Контакты',
            titleClassName: 'text-lg font-semibold',
            className: 'space-y-4',
          },
          children: [
            {
              component: Box,
              componentProps: { className: 'grid grid-cols-2 gap-4' },
              children: [
                {
                  model: model.$.phoneMain,
                  component: InputMask,
                  componentProps: { label: 'Основной телефон', ...PHONE },
                },
                {
                  model: model.$.phoneAdditional,
                  component: InputMask,
                  componentProps: { label: 'Дополнительный телефон', ...PHONE },
                },
              ],
            },
            {
              component: Box,
              componentProps: { className: 'grid grid-cols-2 gap-4' },
              children: [
                {
                  model: model.$.email,
                  component: Input,
                  componentProps: {
                    label: 'Email',
                    placeholder: 'example@mail.com',
                    type: 'email',
                  },
                },
                {
                  model: model.$.emailAdditional,
                  component: Input,
                  componentProps: {
                    label: 'Дополнительный email',
                    placeholder: 'example@mail.com',
                    type: 'email',
                  },
                },
              ],
            },
            {
              model: model.$.sameEmail,
              component: CheckboxWithLabel,
              componentProps: { label: 'Дублировать email' },
            },
          ],
        },
        {
          component: Section,
          componentProps: {
            title: 'Адрес регистрации',
            titleClassName: 'text-lg font-semibold',
            className: 'space-y-4',
          },
          children: [{ model: model.$.registrationAddress, part: address }],
        },
        {
          model: model.$.sameAsRegistration,
          component: CheckboxWithLabel,
          componentProps: { label: 'Адрес проживания совпадает с адресом регистрации' },
        },
        {
          selector: 'residence-address-section',
          component: Box,
          children: [
            {
              component: ResidenceAddressSection, // заголовок и кнопки «Скопировать» / «Очистить»
              children: [{ model: model.$.residenceAddress, part: address }],
            },
          ],
        },
      ],
    },
  ],
});
```

`testId` полей адреса получается из пути сигнала, как и сейчас: `registrationAddress-region`,
`residenceAddress-region`. Отдельно задавать его в подформе не нужно.

### 3.4. Шаг «Доп. инфо» — три массива

Шаблон строки массива — та же «часть», что и подформа: функция от под-модели элемента.

```ts
// steps/additional/form.schema.ts
import type { FormModel } from '@reformer/core';
import { Step } from '@reformer/cdk/form-wizard';
import {
  Box,
  CheckboxWithLabel,
  FileUploadDropzone,
  FormArray,
  Input,
  InputMask,
  InputNumber,
  RadioGroupOptions,
  Section,
  SelectAsync,
  Textarea,
} from '@reformer/ui-kit';
import {
  EDUCATIONS,
  EXISTING_LOAN_TYPES,
  MARITAL_STATUSES,
  RELATIONSHIPS,
  type CoBorrower,
  type CreditApplicationForm,
  type ExistingLoan,
  type Property,
} from '../../types';

const property = (model: FormModel<Property>) => ({
  component: Box,
  componentProps: { className: 'space-y-3' },
  children: [
    {
      model: model.$.type,
      component: SelectAsync,
      componentProps: {
        label: 'Тип имущества',
        placeholder: 'Выберите тип',
        testId: 'property-type',
        options: [
          { value: 'apartment', label: 'Квартира' },
          { value: 'house', label: 'Дом' },
          { value: 'land', label: 'Земельный участок' },
          { value: 'commercial', label: 'Коммерческая недвижимость' },
          { value: 'car', label: 'Автомобиль' },
          { value: 'other', label: 'Другое' },
        ],
      },
    },
    {
      model: model.$.description,
      component: Textarea,
      componentProps: {
        label: 'Описание',
        placeholder: 'Опишите имущество',
        rows: 2,
        testId: 'property-description',
      },
    },
    {
      model: model.$.estimatedValue,
      component: InputNumber,
      componentProps: {
        label: 'Оценочная стоимость',
        placeholder: '0',
        min: 0,
        step: 1000,
        testId: 'property-estimatedValue',
      },
    },
    {
      model: model.$.hasEncumbrance,
      component: CheckboxWithLabel,
      componentProps: { label: 'Имеется обременение (залог)', testId: 'property-hasEncumbrance' },
    },
  ],
});

const existingLoan = (model: FormModel<ExistingLoan>) => ({
  component: Box,
  componentProps: { className: 'space-y-3' },
  children: [
    {
      model: model.$.bank,
      component: Input,
      componentProps: { label: 'Банк', placeholder: 'Название банка', testId: 'existingLoan-bank' },
    },
    {
      model: model.$.type,
      component: SelectAsync,
      componentProps: {
        label: 'Тип кредита',
        placeholder: 'Выберите тип',
        options: EXISTING_LOAN_TYPES,
        testId: 'existingLoan-type',
      },
    },
    {
      component: Box,
      componentProps: { className: 'grid grid-cols-2 gap-4' },
      children: [
        {
          model: model.$.amount,
          component: InputNumber,
          componentProps: {
            label: 'Сумма кредита (₽)',
            placeholder: '0',
            min: 0,
            step: 1000,
            testId: 'existingLoan-amount',
          },
        },
        {
          model: model.$.remainingAmount,
          component: InputNumber,
          componentProps: {
            label: 'Остаток долга (₽)',
            placeholder: '0',
            min: 0,
            step: 1000,
            testId: 'existingLoan-remainingAmount',
          },
        },
      ],
    },
    {
      component: Box,
      componentProps: { className: 'grid grid-cols-2 gap-4' },
      children: [
        {
          model: model.$.monthlyPayment,
          component: InputNumber,
          componentProps: {
            label: 'Ежемесячный платеж (₽)',
            placeholder: '0',
            min: 0,
            step: 100,
            testId: 'existingLoan-monthlyPayment',
          },
        },
        {
          model: model.$.maturityDate,
          component: Input,
          componentProps: {
            label: 'Дата погашения',
            type: 'date',
            testId: 'existingLoan-maturityDate',
          },
        },
      ],
    },
  ],
});

const coBorrower = (model: FormModel<CoBorrower>) => ({
  component: Box,
  componentProps: { className: 'space-y-3' },
  children: [
    {
      component: Box,
      componentProps: { className: 'grid grid-cols-3 gap-4' },
      children: [
        {
          model: model.$.personalData.lastName,
          component: Input,
          componentProps: {
            label: 'Фамилия',
            placeholder: 'Введите фамилию',
            testId: 'coBorrower-lastName',
          },
        },
        {
          model: model.$.personalData.firstName,
          component: Input,
          componentProps: {
            label: 'Имя',
            placeholder: 'Введите имя',
            testId: 'coBorrower-firstName',
          },
        },
        {
          model: model.$.personalData.middleName,
          component: Input,
          componentProps: {
            label: 'Отчество',
            placeholder: 'Введите отчество',
            testId: 'coBorrower-middleName',
          },
        },
      ],
    },
    {
      model: model.$.personalData.birthDate,
      component: Input,
      componentProps: { label: 'Дата рождения', type: 'date', testId: 'coBorrower-birthDate' },
    },
    {
      component: Box,
      componentProps: { className: 'grid grid-cols-2 gap-4' },
      children: [
        {
          model: model.$.phone,
          component: InputMask,
          componentProps: {
            label: 'Телефон',
            placeholder: '+7 (___) ___-__-__',
            mask: '+7 (999) 999-99-99',
            testId: 'coBorrower-phone',
          },
        },
        {
          model: model.$.email,
          component: Input,
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
      component: Box,
      componentProps: { className: 'grid grid-cols-2 gap-4' },
      children: [
        {
          model: model.$.relationship,
          component: SelectAsync,
          componentProps: {
            label: 'Отношение к заемщику',
            placeholder: 'Выберите отношение',
            options: RELATIONSHIPS,
            testId: 'coBorrower-relationship',
          },
        },
        {
          model: model.$.monthlyIncome,
          component: InputNumber,
          componentProps: {
            label: 'Ежемесячный доход (₽)',
            placeholder: '0',
            min: 0,
            step: 1000,
            testId: 'coBorrower-monthlyIncome',
          },
        },
      ],
    },
  ],
});

export const additionalStep = (model: FormModel<CreditApplicationForm>) => ({
  selector: 'additional',
  component: Step,
  componentProps: { title: 'Доп. инфо', icon: '📋' },
  children: [
    {
      component: Section,
      componentProps: {
        title: 'Дополнительная информация',
        titleAs: 'h2',
        titleClassName: 'text-xl font-bold',
        className: 'space-y-6',
      },
      children: [
        {
          component: Section,
          componentProps: {
            title: 'Общая информация',
            titleClassName: 'text-lg font-semibold',
            className: 'space-y-4',
          },
          children: [
            {
              model: model.$.maritalStatus,
              component: RadioGroupOptions,
              componentProps: { label: 'Семейное положение', options: MARITAL_STATUSES },
            },
            {
              component: Box,
              componentProps: { className: 'grid grid-cols-2 gap-4' },
              children: [
                {
                  model: model.$.dependents,
                  component: InputNumber,
                  componentProps: {
                    label: 'Количество иждивенцев',
                    placeholder: '0',
                    min: 0,
                    max: 10,
                  },
                },
                {
                  model: model.$.education,
                  component: SelectAsync,
                  componentProps: {
                    label: 'Образование',
                    placeholder: 'Выберите уровень образования',
                    options: EDUCATIONS,
                  },
                },
              ],
            },
            {
              // массив как значение одного поля: File[]
              model: model.$.documents,
              component: FileUploadDropzone,
              componentProps: {
                label: 'Документы',
                placeholder: 'Перетащите файлы или нажмите для выбора',
                hint: 'Паспорт, справка о доходах — изображения или PDF, до 10 МБ, максимум 5 файлов',
                accept: 'image/*,.pdf',
                multiple: true,
                maxFiles: 5,
                maxFileSize: 10 * 1024 * 1024,
              },
            },
          ],
        },
        {
          component: Section,
          componentProps: { className: 'space-y-4' },
          children: [
            {
              model: model.$.hasProperty,
              component: CheckboxWithLabel,
              componentProps: { label: 'У меня есть имущество' },
            },
            {
              selector: 'properties-array',
              model: model.$.properties, // массив под-форм: есть item
              component: FormArray,
              item: property,
              componentProps: {
                title: 'Имущество',
                reorderable: true,
                itemLabel: 'Имущество',
                addButtonLabel: '+ Добавить имущество',
                emptyMessage: 'Нажмите "Добавить имущество" для добавления информации',
              },
            },
          ],
        },
        {
          component: Section,
          componentProps: { className: 'space-y-4' },
          children: [
            {
              model: model.$.hasExistingLoans,
              component: CheckboxWithLabel,
              componentProps: { label: 'У меня есть другие кредиты' },
            },
            {
              selector: 'existing-loans-array',
              model: model.$.existingLoans,
              component: FormArray,
              item: existingLoan,
              componentProps: {
                title: 'Существующие кредиты',
                reorderable: true,
                itemLabel: 'Кредит',
                addButtonLabel: '+ Добавить кредит',
                emptyMessage: 'Нажмите "Добавить кредит" для добавления информации',
              },
            },
          ],
        },
        {
          component: Section,
          componentProps: { className: 'space-y-4' },
          children: [
            {
              model: model.$.hasCoBorrower,
              component: CheckboxWithLabel,
              componentProps: { label: 'Добавить созаемщика' },
            },
            {
              selector: 'co-borrowers-array',
              model: model.$.coBorrowers,
              component: FormArray,
              item: coBorrower,
              componentProps: {
                title: 'Созаемщики',
                reorderable: true,
                itemLabel: 'Созаемщик',
                addButtonLabel: '+ Добавить созаемщика',
                emptyMessage: 'Нажмите "Добавить созаемщика" для добавления информации',
              },
            },
          ],
        },
      ],
    },
  ],
});
```

Было — узел массива:

```ts
{
  selector: 'properties-array',
  array: model.properties, // value-фасад, а не сигнал
  component: FormArray,
  initialValue: createBlankProperty, // шаблон элемента — в схеме
  componentProps: { /* … */ },
  item: (item: any) => ({ /* … */ }),
}
```

### 3.5. Шаг «Подтверждение» — узлы без привязки

Свои компоненты встают в дерево обычными контейнерами. Форму они читают сами, хуком.

```ts
// steps/confirmation/form.schema.ts
import type { FormModel } from '@reformer/core';
import { Step } from '@reformer/cdk/form-wizard';
import { Box, CheckboxWithLabel, InputMask, Section } from '@reformer/ui-kit';
import {
  ApplicantSummarySection,
  ConfirmationInfoBlock,
  ElectronicSignatureHint,
  HighPaymentWarning,
  LoanSummarySection,
  NextStepsInfo,
  SubmitWarning,
} from '../../components/ConfirmationComponents';
import type { CreditApplicationForm } from '../../types';

export const confirmationStep = (model: FormModel<CreditApplicationForm>) => ({
  selector: 'confirmation',
  component: Step,
  componentProps: { title: 'Подтверждение', icon: '✓' },
  children: [
    {
      component: Section,
      componentProps: {
        title: 'Подтверждение и согласия',
        titleAs: 'h2',
        titleClassName: 'text-xl font-bold',
        className: 'space-y-6',
      },
      children: [
        {
          component: Box,
          componentProps: { className: 'space-y-4' },
          children: [{ component: ConfirmationInfoBlock }, { component: HighPaymentWarning }],
        },
        { component: LoanSummarySection }, // читает ставку и платёж из формы
        { component: ApplicantSummarySection },
        {
          component: Section,
          componentProps: {
            title: 'Обязательные согласия',
            titleClassName: 'text-lg font-semibold',
            className: 'space-y-3',
          },
          children: [
            {
              model: model.$.agreePersonalData,
              component: CheckboxWithLabel,
              componentProps: { label: 'Согласие на обработку персональных данных' },
            },
            {
              model: model.$.agreeCreditHistory,
              component: CheckboxWithLabel,
              componentProps: { label: 'Согласие на проверку кредитной истории' },
            },
            {
              model: model.$.agreeTerms,
              component: CheckboxWithLabel,
              componentProps: { label: 'Согласие с условиями кредитования' },
            },
            {
              model: model.$.confirmAccuracy,
              component: CheckboxWithLabel,
              componentProps: { label: 'Подтверждаю точность введенных данных' },
            },
          ],
        },
        {
          component: Section,
          componentProps: {
            title: 'Опциональные согласия',
            titleClassName: 'text-lg font-semibold mt-6',
          },
          children: [
            {
              model: model.$.agreeMarketing,
              component: CheckboxWithLabel,
              componentProps: { label: 'Согласие на получение маркетинговых материалов' },
            },
          ],
        },
        {
          component: Section,
          componentProps: {
            title: 'Электронная подпись',
            titleClassName: 'text-lg font-semibold mt-6',
            className: 'space-y-4',
          },
          children: [
            {
              model: model.$.electronicSignature,
              component: InputMask,
              componentProps: {
                label: 'Код подтверждения из СМС',
                placeholder: '123456',
                mask: '999999',
              },
            },
            { component: ElectronicSignatureHint },
          ],
        },
        { component: SubmitWarning },
        { component: NextStepsInfo },
      ],
    },
  ],
});
```

### 3.6. Шаги «Данные» и «Работа» — свёрнуто

Новых конструкций в них нет: поля как в шаге «Кредит», условные секции как `mortgage-section`.

```ts
// steps/applicant/form.schema.ts — 13 полей, 3 секции, без условий
export const applicantStep = (model: FormModel<CreditApplicationForm>) => ({
  selector: 'applicant',
  component: Step,
  componentProps: { title: 'Данные', icon: '👤' },
  children: [
    {
      component: Section,
      componentProps: { title: 'Персональные данные' /* … */ },
      children: [
        { component: Section, componentProps: { title: 'Личные данные' }, children: [/* 6 */] },
        { component: Section, componentProps: { title: 'Паспортные данные' }, children: [/* 5 */] },
        {
          component: Section,
          componentProps: { title: 'Дополнительные документы' },
          children: [/* 2 поля: ИНН и СНИЛС */],
        },
      ],
    },
  ],
});
// поля группы привязываются напрямую: { model: model.$.personalData.lastName, component: Input, … }

// steps/employment/form.schema.ts — 14 полей, 4 условных узла
export const employmentStep = (model: FormModel<CreditApplicationForm>) => ({
  selector: 'employment',
  component: Step,
  componentProps: { title: 'Работа', icon: '💼' },
  children: [
    {
      component: Section,
      componentProps: { title: 'Информация о занятости' /* … */ },
      children: [
        {
          model: model.$.employmentStatus,
          component: RadioGroupOptions,
          componentProps: { label: 'Статус занятости', options: EMPLOYMENT_STATUSES },
        },
        { selector: 'employer-section', component: Section, children: [/* 7 полей */] },
        { selector: 'business-section', component: Section, children: [/* 3 поля */] },
        { selector: 'income-section', component: Section, children: [/* 3 поля */] },
        {
          selector: 'unemployed-warning',
          component: UnemployedWarning,
          componentProps: { className: 'mt-6' },
        },
      ],
    },
  ],
});
```

В развёрнутом виде это ≈ 135 и ≈ 170 строк — столько же, сколько сейчас в `render-schema.ts`.

## 4. Валидация — `form.validation.ts`

Константы правил (67 наборов вида `LOAN_AMOUNT_RULES`) и cross-field функции не меняются — это
≈ 500 строк из 773. Меняется то, как подключаются подформа и элементы массивов.

### Подформа и элементы массивов — обычные схемы

```ts
import {
  defineValidationSchema,
  validate,
  validateAsync,
  validateWhen,
  cross,
  apply,
  applyEach,
} from '@reformer/core/validation';

/** Правила адреса — объявлены один раз. */
const addressRules = defineValidationSchema<Address>(({ model }) => {
  validate(model.$.region, ADDRESS_REGION_RULES);
  validate(model.$.city, ADDRESS_CITY_RULES);
  validate(model.$.street, ADDRESS_STREET_RULES);
  validate(model.$.house, ADDRESS_HOUSE_RULES);
  validate(model.$.apartment!, ADDRESS_APARTMENT_RULES);
  validate(model.$.postalCode, ADDRESS_POSTAL_CODE_RULES);
});

const propertyRules = defineValidationSchema<Property>(({ model }) => {
  validate(model.$.type, PROPERTY_TYPE_RULES);
  validate(model.$.description, PROPERTY_DESCRIPTION_RULES);
  validate(model.$.estimatedValue, PROPERTY_ESTIMATED_VALUE_RULES);
});

const existingLoanRules = defineValidationSchema<ExistingLoan>(({ model }) => {
  validate(model.$.bank, EXISTING_LOAN_BANK_RULES);
  validate(model.$.type, EXISTING_LOAN_TYPE_RULES);
  validate(model.$.amount, EXISTING_LOAN_AMOUNT_RULES);
  validate(model.$.remainingAmount, EXISTING_LOAN_REMAINING_RULES);
  cross(model.$.remainingAmount, remainingNotExceedAmount); // получает снапшот элемента
  validate(model.$.monthlyPayment, EXISTING_LOAN_MONTHLY_PAYMENT_RULES);
  validate(model.$.maturityDate, EXISTING_LOAN_MATURITY_DATE_RULES);
  cross(model.$.maturityDate, maturityInFuture);
});

const coBorrowerRules = defineValidationSchema<CoBorrower>(({ model }) => {
  validate(model.$.personalData.lastName, ruName('Фамилия'));
  validate(model.$.personalData.firstName, ruName('Имя'));
  validate(model.$.personalData.middleName, ruName('Отчество'));
  validate(model.$.personalData.birthDate, CO_BORROWER_BIRTH_DATE_RULES);
  validate(model.$.phone, CO_BORROWER_PHONE_RULES);
  validate(model.$.email, EMAIL_REQUIRED_RULES);
  validate(model.$.relationship, CO_BORROWER_RELATIONSHIP_RULES);
  validate(model.$.monthlyIncome, CO_BORROWER_INCOME_RULES);
});
```

Было — правила элемента были функцией другого вида, а снапшот для `cross` захватывался вручную:

```ts
const existingLoanItem = (item: FormModel<ExistingLoan>): void => {
  const loan = item.get(); // cross получал снапшот корня, поэтому элемент брали в замыкание
  validate(item.$.remainingAmount, EXISTING_LOAN_REMAINING_RULES);
  cross(item.$.remainingAmount, () => remainingNotExceedAmount(loan));
  // …
};
```

### Шаги

Шаги «Кредит», «Данные», «Работа», «Подтверждение» не меняются — в них только `validate`,
`validateWhen`, `cross`, `validateAsync`. Меняются два шага и экспорт.

```ts
const contactsRules = defineValidationSchema<CreditApplicationForm>(({ model }) => {
  validate(model.$.phoneMain, PHONE_MAIN_RULES);
  validate(model.$.phoneAdditional, PHONE_FORMAT_RULES);
  cross(model.$.phoneAdditional, phoneAdditionalDiffers);
  validate(model.$.email, EMAIL_REQUIRED_RULES);
  validate(model.$.emailAdditional, EMAIL_FORMAT_RULES);
  cross(model.$.emailAdditional, emailAdditionalDiffers);

  // было: addressSchema({ model: model.registrationAddress });
  apply(model.$.registrationAddress, addressRules);
  validateWhen(
    () => model.sameAsRegistration === false,
    () => apply(model.$.residenceAddress, addressRules)
  );
});

const additionalRules = defineValidationSchema<CreditApplicationForm>(({ model }) => {
  validate(model.$.maritalStatus, MARITAL_STATUS_RULES);
  validate(model.$.dependents, DEPENDENTS_RULES);
  validate(model.$.education, EDUCATION_RULES);
  cross(model.$.hasProperty, (values: CreditApplicationForm) =>
    notEmptyWhen(values, 'hasProperty', 'properties', 'Добавьте хотя бы один объект имущества')
  );
  cross(model.$.hasExistingLoans, (values: CreditApplicationForm) =>
    notEmptyWhen(values, 'hasExistingLoans', 'existingLoans', 'Добавьте информацию о кредите')
  );
  cross(model.$.hasCoBorrower, (values: CreditApplicationForm) =>
    notEmptyWhen(values, 'hasCoBorrower', 'coBorrowers', 'Добавьте информацию о созаемщике')
  );

  // было: each(model.properties, propertyItem);
  applyEach(model.$.properties, propertyRules);
  applyEach(model.$.existingLoans, existingLoanRules);
  applyEach(model.$.coBorrowers, coBorrowerRules);
});

/** Правила формы. Ключ шага = selector шага в схеме. */
export const creditValidation: FormValidation<CreditApplicationForm> = {
  steps: {
    loan: loanRules,
    applicant: applicantRules,
    contacts: contactsRules,
    employment: employmentRules,
    additional: additionalRules,
    confirmation: confirmationRules,
  },
  extras: crossStepRules,
};
```

Уходит `makeCreditValidationConfig` с импортом `defineSteps`: конфиг для визарда собирает сборка.

## 5. Поведение — `form.behavior.ts`

Один файл вместо двух. Видимость секций стоит рядом с включением их полей, условие объявлено один
раз, значение читается из модели.

```ts
import {
  defineFormBehavior,
  compute,
  copyFrom,
  enableWhen,
  onChange,
  apply,
  hideWhen,
  onComponentEvent,
  onMount,
  renderEffect,
} from '@reformer/core/behaviors';
import type { FormWizardHandle } from '@reformer/cdk/form-wizard';
import type { CoBorrower, CreditApplicationForm, PersonalData } from './types';
import { addressBehavior } from './address.behavior';
import { loadOptionsOn, clearWhenOff } from './operators';
import {
  computeAge,
  computeCoBorrowersIncome,
  computeFullName,
  computeInitialPayment,
  computeInterestRate,
  computeMonthlyPayment,
  computePaymentRatio,
  computeTotalIncome,
} from './utils';
import {
  applyCreditApplication,
  fetchCarModels,
  loadCreditApplication,
  submitCreditApplication,
} from './api';

export const creditBehavior = defineFormBehavior<CreditApplicationForm>(
  ({ model, form, schema }) => {
    // Условия — по одному разу на форму
    const isMortgage = () => model.loanType === 'mortgage';
    const isCar = () => model.loanType === 'car';
    const isEmployed = () => model.employmentStatus === 'employed';
    const isSelfEmployed = () => model.employmentStatus === 'selfEmployed';
    const isUnemployed = () => model.employmentStatus === 'unemployed';
    const livesElsewhere = () => model.sameAsRegistration === false;

    // ── 1. Вычисляемые поля — без изменений ────────────────────────────────
    compute(model.$.interestRate, () =>
      computeInterestRate({
        loanType: model.loanType,
        registrationAddress: { region: model.registrationAddress.region },
        hasProperty: model.hasProperty,
        properties: model.properties.map(() => null),
      })
    );
    compute(model.$.monthlyPayment, () => computeMonthlyPayment(model));
    compute(model.$.initialPayment, () => computeInitialPayment(model), { when: isMortgage });
    compute(model.$.fullName, () => computeFullName(model));
    compute(model.$.age, () =>
      computeAge({ personalData: { birthDate: model.personalData.birthDate } as PersonalData })
    );
    compute(model.$.coBorrowersIncome, () =>
      computeCoBorrowersIncome({
        coBorrowers: model.coBorrowers.map((coBorrower) => ({
          monthlyIncome: coBorrower.monthlyIncome,
        })) as CoBorrower[],
      })
    );
    compute(model.$.totalIncome, () => computeTotalIncome(model));
    compute(model.$.paymentToIncomeRatio, () => computePaymentRatio(model));

    // ── 2. Копирование — без изменений ─────────────────────────────────────
    copyFrom(model.$.email, model.$.emailAdditional, { when: () => model.sameEmail === true });
    copyFrom(model.$.registrationAddress, model.$.residenceAddress, {
      when: () => model.sameAsRegistration === true,
    });

    // ── 3. Условные секции: включение полей и видимость — рядом ─────────────
    enableWhen([model.$.propertyValue, model.$.initialPayment], isMortgage, {
      resetOnDisable: true,
    });
    hideWhen(schema.node('mortgage-section'), () => !isMortgage());

    enableWhen([model.$.carBrand, model.$.carModel, model.$.carYear, model.$.carPrice], isCar, {
      resetOnDisable: true,
    });
    hideWhen(schema.node('car-section'), () => !isCar());

    enableWhen(
      [
        model.$.companyName,
        model.$.companyInn,
        model.$.companyPhone,
        model.$.companyAddress,
        model.$.position,
      ],
      isEmployed,
      { resetOnDisable: true }
    );
    hideWhen(schema.node('employer-section'), () => !isEmployed());

    enableWhen(
      [model.$.businessType, model.$.businessInn, model.$.businessActivity],
      isSelfEmployed,
      { resetOnDisable: true }
    );
    hideWhen(schema.node('business-section'), () => !isSelfEmployed());

    hideWhen(schema.node('income-section'), isUnemployed);
    hideWhen(schema.node('unemployed-warning'), () => !isUnemployed());

    // адрес проживания — группа: без сброса, значение копируется из адреса регистрации
    enableWhen(model.$.residenceAddress, livesElsewhere);
    hideWhen(schema.node('residence-address-section'), () => !livesElsewhere());

    hideWhen(schema.node('properties-array'), () => !model.hasProperty);
    hideWhen(schema.node('existing-loans-array'), () => !model.hasExistingLoans);
    hideWhen(schema.node('co-borrowers-array'), () => !model.hasCoBorrower);

    // ── 4. Реакции — без изменений ──────────────────────────────────────────
    loadOptionsOn(model.$.carBrand, form.carModel, fetchCarModels, { resetTarget: true });

    onChange(model.$.totalIncome, (totalIncome) => {
      if (totalIncome && totalIncome > 0) {
        form.loanAmount.updateComponentProps({ max: Math.min(totalIncome * 12 * 10, 10_000_000) });
      }
    });
    onChange(model.$.age, (age) => {
      if (age && age >= 18) {
        form.loanTerm.updateComponentProps({ max: Math.min(Math.max(70 - age, 1) * 12, 240) });
      }
    });

    clearWhenOff(model.$.hasProperty, form.properties);
    clearWhenOff(model.$.hasExistingLoans, form.existingLoans);
    clearWhenOff(model.$.hasCoBorrower, form.coBorrowers);

    // ── 5. Подформа адреса — на оба адреса ──────────────────────────────────
    apply([model.$.registrationAddress, model.$.residenceAddress], addressBehavior);

    // ── 6. Загрузка заявки: статус показывает AsyncBoundary ─────────────────
    const boundary = schema.node('data-boundary');
    const loadApplication = async () => {
      boundary.patchProps({ status: 'loading', error: null });
      try {
        applyCreditApplication(form, await loadCreditApplication('1'));
        boundary.patchProps({ status: 'ready' });
      } catch (error) {
        boundary.patchProps({
          status: 'error',
          error: error instanceof Error ? error.message : 'Неизвестная ошибка',
          onRetry: () => void loadApplication(),
        });
      }
    };
    onMount(boundary, () => void loadApplication());

    // ── 7. Отправка: визард зовёт обработчик только после успешной валидации ─
    onComponentEvent(schema.node('wizard'), 'onSubmit', async () => {
      try {
        const response = await submitCreditApplication(model.get());
        if (response.status === 200 || response.status === 201) {
          alert(`Заявка успешно отправлена! ID: ${response.data.id}`);
        } else {
          alert('Ошибка отправки заявки: сервер вернул неожиданный ответ');
        }
      } catch {
        alert('Ошибка отправки заявки: сервер недоступен');
      }
    });

    // ── 8. Навигация через ref визарда (демо-эффект из эталона) ─────────────
    const wizard = schema.node('wizard').getRef<FormWizardHandle<CreditApplicationForm>>();
    renderEffect(schema, () => {
      if (isMortgage()) wizard.current?.goToStep(1);
    });
  }
);
```

Поведение подформы адреса не меняется:

```ts
// address.behavior.ts
export const addressBehavior = defineFormBehavior<Address>(({ model, form }) => {
  loadOptionsOn(model.$.region, form.city, fetchCities);
  transformValue(model.$.postalCode, (postalCode) =>
    (postalCode ?? '').replace(/\D/g, '').slice(0, 6)
  );
});
```

Было — видимость в отдельном файле, значение через ноду формы:

```ts
// render-behavior.ts — фабрика (form) => (schema) => …
hideWhen(schema.node('mortgage-section'), () => form.loanType.value.value !== 'mortgage');
hideWhen(
  schema.node('employer-section'),
  () => form.employmentStatus.value.value !== 'employed'
);
// … 11 обращений вида form.x.value.value

// а в JSON-варианте — ещё один файл, чтобы донести форму и валидацию до визарда
onInit(schema.node('wizard'), () => {
  schema.node('wizard').patchProps({ form, ...(validation ?? makeCreditValidationConfig(model)) });
});
```

## 6. Сборка и рендер

Сборка одна. Три способа отличаются видом схемы и тем, кто рисует.

### 6.1. renderer

```tsx
// index.tsx
import { createForm, useFormBundle } from '@reformer/core';
import { FormRenderer } from '@reformer/renderer-react';
import { FormField } from '@reformer/ui-kit';
import { ValidationMessagesProvider } from '@reformer/cdk';

export default function CreditApplicationPage() {
  const credit = useFormBundle(() =>
    createForm<CreditApplicationForm>({
      model: createCreditApplicationModel(),
      schema: creditSchema,
      behavior: creditBehavior,
      validation: creditValidation,
    })
  );
  // credit = { model, form, validation, render }

  return (
    <ValidationMessagesProvider resolver={fileUploadMessages}>
      <FormRenderer form={credit} settings={{ fieldWrapper: FormField }} />
    </ValidationMessagesProvider>
  );
}
```

Программное управление схемой остаётся:
`credit.render.node('mortgage-section').setHidden(true)`.

Было:

```tsx
const creditForm = useReactForm(() =>
  createReactForm<CreditApplicationForm>({
    model: createCreditApplicationModel(),
    schema: buildCreditApplicationSchema, // (model, form?) — вызывается дважды
    behavior: creditApplicationBehavior,
    renderBehavior: (form) => createCreditApplicationRenderBehavior(form),
  })
);
// правила в сборку не передавались: makeCreditValidationConfig(model) стоял в узле визарда
```

### 6.2. React руками

Сборка та же. Разметка, видимость, загрузка и отправка — в JSX, как сейчас: операторы узлов
(`hideWhen`, `onMount`, `onComponentEvent`) исполняет рендерер, без него они не действуют.

```tsx
// index.tsx
const STEPS: FormWizardStep<CreditApplicationForm>[] = [
  { number: 1, title: 'Кредит', icon: '💰', body: BasicInfoForm },
  { number: 2, title: 'Данные', icon: '👤', body: PersonalInfoForm },
  { number: 3, title: 'Контакты', icon: '📞', body: ContactInfoForm },
  { number: 4, title: 'Работа', icon: '💼', body: EmploymentForm },
  { number: 5, title: 'Доп. инфо', icon: '📋', body: AdditionalInfoForm },
  { number: 6, title: 'Подтверждение', icon: '✓', body: ConfirmationForm },
];

export default function CreditApplicationPage() {
  const wizardRef = useRef<FormWizardHandle<CreditApplicationForm>>(null);
  const { form, validation } = useFormBundle(() =>
    createForm<CreditApplicationForm>({
      model: createCreditApplicationModel(),
      schema: creditSchema, // из схемы берутся поля; контейнеры не используются
      behavior: creditBehavior,
      validation: creditValidation,
    })
  );

  const submitApplication = async () => {
    /* как сейчас: wizardRef.current?.submit(...) */
  };

  return (
    <ValidationMessagesProvider resolver={fileUploadMessages}>
      <AsyncBoundary<CreditApplicationBundle>
        load={(signal) => loadCreditApplication('1', signal)}
        loadKey="1"
        onSuccess={(bundle) => applyCreditApplication(form, bundle)}
      >
        <FormWizard
          ref={wizardRef}
          form={form}
          config={validation}
          steps={STEPS}
          onSubmit={submitApplication}
          submitLabel="Отправить заявку"
        />
      </AsyncBoundary>
    </ValidationMessagesProvider>
  );
}
```

Компоненты шагов не меняются, кроме секций массивов — у них пропадает `initialValue`:

```tsx
// BasicInfoForm.tsx — без изменений
const loanType = useFormControlValue(control.loanType) as LoanType;

<FormField control={control.loanType} testId="loanType" />
{loanType === 'mortgage' && (
  <>
    <h3 className="text-lg font-semibold mt-4">Информация о недвижимости</h3>
    <FormField control={control.propertyValue} testId="propertyValue" />
    <FormField control={control.initialPayment} testId="initialPayment" />
  </>
)}

// ContactInfoForm.tsx — без изменений: подформа — React-компонент
<AddressForm control={control.registrationAddress} testIdPrefix="registrationAddress" />

// AdditionalInfoForm.tsx
<FormArraySection
  title="Имущество"
  control={control.properties}
  itemComponent={PropertyForm}
  itemLabel="Имущество"
  addButtonLabel="+ Добавить имущество"
  emptyMessage='Нажмите "Добавить имущество" для добавления информации'
  hasItems={hasProperty}
  reorderable
/> {/* было ещё: initialValue={createBlankProperty()} */}
```

Что уходит в этом варианте: `schemas/schema.ts` (680 строк — отдельная карта тех же полей) и
`schemas/create-form.ts`.

Если форма существует **только** в варианте «React руками», контейнеры в схеме не нужны — остаются
поля, подформы и массивы:

```ts
export const creditSchema = (model: FormModel<CreditApplicationForm>) => ({
  children: [
    {
      model: model.$.loanType,
      component: SelectAsync,
      componentProps: { label: 'Тип кредита', options: LOAN_TYPES },
    },
    // … остальные поля
    { model: model.$.registrationAddress, part: addressFields },
    { model: model.$.residenceAddress, part: addressFields },
    { model: model.$.properties, item: propertyFields },
  ],
});
```

### 6.3. JSON

Страница отличается от renderer-варианта двумя строками конфига.

```tsx
// index.tsx
import creditJson from './form.schema.json';

const credit = useFormBundle(() =>
  createForm<CreditApplicationForm>({
    model: createCreditApplicationModel(),
    schema: creditJson as JsonFormSchema<CreditApplicationForm>,
    registry: creditRegistry,
    behavior: creditBehavior,
    validation: creditValidation,
  })
);

return (
  <ValidationMessagesProvider resolver={fileUploadMessages}>
    <FormRenderer form={credit} /> {/* обёртка поля — запись FIELD_WRAPPER реестра */}
  </ValidationMessagesProvider>
);
```

Было:

```tsx
const jsonForm = useJsonForm(() =>
  createJsonForm<CreditApplicationForm>({
    schema: creditApplicationJsonSchema,
    registry: createCreditApplicationRegistry(),
    model: createCreditApplicationModel(),
    behavior: creditApplicationBehavior,
    validation: creditApplicationValidation,
    renderBehavior: createCreditApplicationJsonRenderBehavior,
  })
);

<JsonRendererProvider settings={{ registry: jsonForm.registry }}>
  <JsonFormRenderer<CreditApplicationForm> form={jsonForm} validateSchema={import.meta.env.DEV} />
</JsonRendererProvider>
```

Документ — то же дерево данными:

```json
{
  "$schema": "./form-schema.schema.json",
  "format": 2,
  "version": "1.0",
  "parts": {
    "address": {
      "component": "$component(Box)",
      "componentProps": { "className": "space-y-4" },
      "children": [
        {
          "component": "$component(Box)",
          "componentProps": { "className": "grid grid-cols-2 gap-4" },
          "children": [
            {
              "model": "$model(region)",
              "component": "$component(Input)",
              "componentProps": { "label": "Регион", "placeholder": "Введите регион" }
            },
            {
              "model": "$model(city)",
              "component": "$component(Input)",
              "componentProps": { "label": "Город", "placeholder": "Введите город" }
            }
          ]
        }
      ]
    },
    "property": {
      "component": "$component(Box)",
      "componentProps": { "className": "space-y-3" },
      "children": [
        {
          "model": "$model(type)",
          "component": "$component(Select)",
          "componentProps": { "label": "Тип имущества", "testId": "property-type" }
        }
      ]
    }
  },
  "root": {
    "selector": "data-boundary",
    "component": "$component(AsyncBoundary)",
    "componentProps": { "status": "loading" },
    "children": [
      {
        "selector": "wizard",
        "component": "$component(FormWizard)",
        "componentProps": {
          "className": "bg-white p-8 rounded-lg shadow-md",
          "submitLabel": "Отправить заявку"
        },
        "children": [
          {
            "selector": "loan",
            "component": "$component(Step)",
            "componentProps": { "title": "Кредит", "icon": "💰" },
            "children": [
              {
                "model": "$model(loanType)",
                "component": "$component(Select)",
                "componentProps": {
                  "label": "Тип кредита",
                  "placeholder": "Выберите тип кредита",
                  "options": "$dataSource(LOAN_TYPES)"
                }
              },
              {
                "selector": "mortgage-section",
                "component": "$component(Section)",
                "componentProps": { "title": "Информация о недвижимости" },
                "children": [
                  {
                    "model": "$model(propertyValue)",
                    "component": "$component(InputNumber)",
                    "componentProps": { "label": "Стоимость недвижимости (₽)", "min": 1000000 }
                  }
                ]
              }
            ]
          },
          {
            "selector": "contacts",
            "component": "$component(Step)",
            "componentProps": { "title": "Контакты", "icon": "📞" },
            "children": [
              {
                "component": "$component(Section)",
                "componentProps": { "title": "Адрес регистрации" },
                "children": [{ "model": "$model(registrationAddress)", "part": "$part(address)" }]
              },
              {
                "selector": "residence-address-section",
                "component": "$component(Box)",
                "children": [
                  {
                    "component": "$component(ResidenceAddressSection)",
                    "children": [{ "model": "$model(residenceAddress)", "part": "$part(address)" }]
                  }
                ]
              }
            ]
          },
          {
            "selector": "additional",
            "component": "$component(Step)",
            "componentProps": { "title": "Доп. инфо", "icon": "📋" },
            "children": [
              {
                "selector": "properties-array",
                "model": "$model(properties)",
                "component": "$component(FormArray)",
                "item": "$part(property)",
                "componentProps": {
                  "title": "Имущество",
                  "reorderable": true,
                  "itemLabel": "$dataSource(PROPERTY_ITEM_LABEL_SOURCE_FN)",
                  "addButtonLabel": "+ Добавить имущество"
                }
              }
            ]
          }
        ]
      }
    ]
  }
}
```

Фрагмент сокращён: поля шагов и частей показаны по одному-два. Что изменилось в документе:

| Было | Стало |
| --- | --- |
| `"value": "$model(loanType)"` | `"model": "$model(loanType)"` |
| `"array": "$model(properties)"` + `"item": { "$template": {…} }` | `"model": "$model(properties)"` + `"item": "$part(property)"` |
| шаги в `componentProps.steps` | шаги в `children`, у шага — `selector` |
| `$component(RendererFormWizard)` | `$component(FormWizard)` |
| адрес записан дважды: 12 узлов с путями `registrationAddress.region` … | одна часть `address` с относительными путями и два узла `{ model, part }` |
| три литерала `initialValue` (26 строк) | нет: шаблоны объявлены в `model.ts` |
| — | `"format": 2`, словарь `parts` |

Шаги в отдельных файлах подключаются, как и сейчас, через `{ "$ref": "./steps/loan/form.schema.json" }` —
но ссылка стоит в `children` визарда.

Реестр теряет одну прикладную запись:

```ts
// registry.ts
export const creditRegistry = defineRegistry((registry) => {
  registry.component('Input', Input);
  registry.component('Select', SelectAsync);
  // … остальные компоненты ui-kit и свои блоки — как сейчас
  // было: registry.component('RendererFormWizard', RendererFormWizard)
  registry.component('FormWizard', FormWizard);
  registry.component('Step', Step);
  registry.component(FIELD_WRAPPER, FormField);

  registry.dataSource('LOAN_TYPES', LOAN_TYPES);
  // … остальные источники — как сейчас
});
```

## 7. Что изменилось в цифрах

Числа «было» измерены по файлам эталона. Числа «стало» — оценка: код не написан и не запускался.

**Уходят целиком — 1 016 строк:**

| Файл | Строк | Куда делось |
| --- | --- | --- |
| `schemas/schema.ts` | 680 | карта полей не нужна: поля берутся из общей схемы |
| `render-behavior.ts` (renderer) | 144 | ≈ 95 строк логики переехали в `form.behavior.ts` |
| `render-behavior.ts` (JSON) | 39 | форму и валидацию визард берёт из сборки |
| `schemas/create-form.ts` | 40 | сборка — один вызов на странице |
| `RendererFormWizard.tsx` | 113 | визард — библиотечный |

**Уходят куски внутри файлов — ≈ 140 строк:**

| Где | Строк | Что |
| --- | --- | --- |
| `render-schema.ts` | ≈ 36 | второй экземпляр адреса |
| `json-schema.json` | ≈ 65 | второй экземпляр адреса |
| `json-schema.json` | 26 | три литерала `initialValue` |
| `validation.ts` | 14 | `makeCreditValidationConfig` |

**Растёт:** `form.behavior.ts` — со 139 до ≈ 180 строк: в него переехали видимость, загрузка и
отправка.

Итог на три варианта: было ≈ 5 940 строк, станет ≈ 4 850 — меньше примерно на 1 100. Точное число
даст только реализация.

**Не изменилось:**

| Что | Строк | Почему |
| --- | --- | --- |
| правила: константы и cross-field функции | ≈ 500 | правила остаются отдельно от полей |
| разметка схемы | TS ≈ 1 050, JSON ≈ 1 330 | узел записывается объектом, каркас контейнеров на месте |
| JSX шагов и подформ в варианте «React руками» | ≈ 580 | разметку рисует приложение |
| начальные значения | ≈ 160 | значения остаются в `model.ts` |

## 8. На что посмотреть при оценке

Места, где контракт на этой форме выглядит не так гладко, как в коротких листингах.

1. **Два способа декомпозиции схемы.** Шаг в отдельном файле — функция от корневой модели,
   вызывается напрямую: `loanStep(model)`. Подформа и шаблон массива — узел `{ model, part }` или
   `{ model, item }`. Разница оправдана (шаг работает с корнем, часть — с под-моделью), но в одном
   файле рядом стоят обе записи.
2. **Подформа подключается трижды.** Адрес: `part: address` в схеме, `apply(…, addressRules)` в
   валидации, `apply(…, addressBehavior)` в поведении. Три объявления и три подключения в трёх
   файлах. Запись одинаковая, но связать их вместе нечем.
3. **Условие по-прежнему в нескольких местах.** `isMortgage` в поведении служит и включению полей,
   и видимости секции. В валидации то же условие записано отдельно (`validateWhen`), в варианте
   «React руками» — ещё раз в JSX.
4. **«React руками» выигрывает меньше остальных.** Уходят карта полей и файл сборки, но операторы
   узлов там не действуют: видимость, загрузка и отправка остаются в JSX. В общем
   `form.behavior.ts` для этого варианта разделы 6–8 и все `hideWhen` — мёртвый код.
5. **`selector` шага несёт две роли.** Он адресует узел в поведении и служит ключом правил в
   `form.validation.ts`. Опечатка в одном из двух мест даёт шаг без правил; план закрывает это
   проверкой в dev.
6. **Узлы внутри строки массива из корня не видны.** Корневое поведение не может написать
   `hideWhen(schema.node('…'))` для узла внутри шаблона `property` — только через
   `applyEach(model.$.properties, propertyBehavior)`. В этой форме такого случая нет.
7. **`testId` в шаблонах массивов задан вручную.** У адреса он выводится из пути сигнала, а у
   строк массивов e2e ждут `property-type`, а не `properties-0-type`, поэтому 18 полей несут
   явный `testId` — как и сейчас.
8. **Запись узла объектом.** Лист занимает 4–9 строк, секция с заголовком — 6 строк до первого
   поля. Шаг «Кредит» с десятью полями — ≈ 140 строк. Короткая запись узла отклонена; локальный
   хелпер в прикладном коде по-прежнему возможен.
9. **Часть не проверяется типами.** `{ model: model.$.registrationAddress, part: address }` не
   сверяет, что `address` ждёт именно `FormModel<Address>`. Так же сегодня у `item`.
10. **Тип `validation` в бандле необязателен.** Сегодня ради сужения типа держат отдельный файл
    `create-form.ts`. В новой сборке тип стоит выводить из конфига: правила переданы — значит,
    `validation` в бандле есть.
11. **Фамилия, имя и отчество созаёмщика записаны отдельно** от тех же полей заёмщика. Вынести
    их в общую часть мешают разные `testId` и разный состав полей.
