---
sidebar_position: 2
---

# Схема формы

Создание полной схемы формы для заявки на кредит.

## Обзор

Схема формы — это JavaScript-объект, описывающий структуру вашей формы. Она определяет:

- **Конфигурацию полей** — начальные значения, компоненты и пропсы
- **Вложенные объекты** — используя вложенные объекты схемы (создаёт `GroupNode`)
- **Массивы** — используя синтаксис массива (создаёт `ArrayNode`)

## Конфигурация поля

Каждое поле в схеме имеет три основных свойства:

```typescript
{
  fieldName: {
    value: initialValue,        // Начальное значение
    component: UIComponent,     // React-компонент для отображения
    componentProps: { ... }     // Пропсы для компонента (типизированы на основе component)
  }
}
```

:::info Типобезопасность
Поле `componentProps` полностью типизировано на основе указанного `component`. TypeScript разрешит только те пропсы, которые принимает компонент.
:::

## Вложенные объекты

Для вложенных структур данных используйте вложенный объект схемы:

```typescript
personalData: {
  firstName: { value: '', component: Input, componentProps: { label: 'Имя' } },
  lastName: { value: '', component: Input, componentProps: { label: 'Фамилия' } },
}
```

## Массивы

Для повторяющихся секций оберните схему элемента в квадратные скобки:

```typescript
properties: [{
  type: { value: 'apartment', component: Select, componentProps: { ... } },
  value: { value: 0, component: Input, componentProps: { ... } },
}]
```

## Полная схема заявки на кредит

Вот полная схема, соответствующая интерфейсу `CreditApplicationForm`:

```typescript title="src/forms/credit-application/schemas\credit-application.schema.ts"
import type { FormSchema } from 'reformer';
import { Input, Select, Checkbox, Textarea, RadioGroup } from './components/ui';
import type { CreditApplicationForm } from './types';

export const creditApplicationSchema: FormSchema<CreditApplicationForm> = {
  // ============================================================================
  // Шаг 1: Основная информация о кредите
  // ============================================================================

  loanType: {
    value: 'consumer',
    component: Select,
    componentProps: {
      label: 'Тип кредита',
      options: [
        { value: 'consumer', label: 'Потребительский' },
        { value: 'mortgage', label: 'Ипотека' },
        { value: 'car', label: 'Автокредит' },
        { value: 'business', label: 'Бизнес-кредит' },
        { value: 'refinancing', label: 'Рефинансирование' },
      ],
    },
  },

  loanAmount: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Сумма кредита',
      type: 'number',
      placeholder: 'Введите сумму',
      min: 50000,
      max: 10000000,
    },
  },

  loanTerm: {
    value: 12,
    component: Input,
    componentProps: {
      label: 'Срок кредита (месяцев)',
      type: 'number',
      min: 6,
      max: 240,
    },
  },

  loanPurpose: {
    value: '',
    component: Textarea,
    componentProps: {
      label: 'Цель кредита',
      placeholder: 'Опишите, на что планируете потратить средства',
      rows: 3,
    },
  },

  // Поля для ипотеки
  propertyValue: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Стоимость недвижимости',
      type: 'number',
      min: 1000000,
    },
  },

  initialPayment: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Первоначальный взнос',
      type: 'number',
      min: 0,
    },
  },

  // Поля для автокредита
  carBrand: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Марка автомобиля',
      placeholder: 'Например: Toyota',
    },
  },

  carModel: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Модель автомобиля',
      placeholder: 'Например: Camry',
    },
  },

  carYear: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Год выпуска',
      type: 'number',
      min: 2000,
      max: new Date().getFullYear() + 1,
    },
  },

  carPrice: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Стоимость автомобиля',
      type: 'number',
      min: 300000,
    },
  },

  // ============================================================================
  // Шаг 2: Персональные данные (вложенные объекты)
  // ============================================================================

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
    birthPlace: {
      value: '',
      component: Input,
      componentProps: { label: 'Место рождения', placeholder: 'Введите место рождения' },
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
  },

  passportData: {
    series: {
      value: '',
      component: Input,
      componentProps: { label: 'Серия паспорта', placeholder: '00 00' },
    },
    number: {
      value: '',
      component: Input,
      componentProps: { label: 'Номер паспорта', placeholder: '000000' },
    },
    issueDate: {
      value: '',
      component: Input,
      componentProps: { label: 'Дата выдачи', type: 'date' },
    },
    issuedBy: {
      value: '',
      component: Textarea,
      componentProps: { label: 'Кем выдан', placeholder: 'Орган, выдавший паспорт', rows: 2 },
    },
    departmentCode: {
      value: '',
      component: Input,
      componentProps: { label: 'Код подразделения', placeholder: '000-000' },
    },
  },

  inn: {
    value: '',
    component: Input,
    componentProps: { label: 'ИНН', placeholder: '000000000000' },
  },

  snils: {
    value: '',
    component: Input,
    componentProps: { label: 'СНИЛС', placeholder: '000-000-000 00' },
  },

  // ============================================================================
  // Шаг 3: Контактная информация
  // ============================================================================

  phoneMain: {
    value: '',
    component: Input,
    componentProps: { label: 'Основной телефон', placeholder: '+7 (000) 000-00-00' },
  },

  phoneAdditional: {
    value: '',
    component: Input,
    componentProps: { label: 'Дополнительный телефон', placeholder: '+7 (000) 000-00-00' },
  },

  email: {
    value: '',
    component: Input,
    componentProps: { label: 'Email', type: 'email', placeholder: 'example@mail.com' },
  },

  emailAdditional: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Дополнительный email',
      type: 'email',
      placeholder: 'example@mail.com',
    },
  },

  // Адрес регистрации (вложенный)
  registrationAddress: {
    region: {
      value: '',
      component: Input,
      componentProps: { label: 'Регион', placeholder: 'Введите регион' },
    },
    city: {
      value: '',
      component: Input,
      componentProps: { label: 'Город', placeholder: 'Введите город' },
    },
    street: {
      value: '',
      component: Input,
      componentProps: { label: 'Улица', placeholder: 'Введите улицу' },
    },
    house: {
      value: '',
      component: Input,
      componentProps: { label: 'Дом', placeholder: 'Номер дома' },
    },
    apartment: {
      value: '',
      component: Input,
      componentProps: { label: 'Квартира', placeholder: 'Номер квартиры' },
    },
    postalCode: {
      value: '',
      component: Input,
      componentProps: { label: 'Почтовый индекс', placeholder: '000000' },
    },
  },

  sameAsRegistration: {
    value: true,
    component: Checkbox,
    componentProps: { label: 'Адрес проживания совпадает с адресом регистрации' },
  },

  // Адрес проживания (вложенный)
  residenceAddress: {
    region: {
      value: '',
      component: Input,
      componentProps: { label: 'Регион', placeholder: 'Введите регион' },
    },
    city: {
      value: '',
      component: Input,
      componentProps: { label: 'Город', placeholder: 'Введите город' },
    },
    street: {
      value: '',
      component: Input,
      componentProps: { label: 'Улица', placeholder: 'Введите улицу' },
    },
    house: {
      value: '',
      component: Input,
      componentProps: { label: 'Дом', placeholder: 'Номер дома' },
    },
    apartment: {
      value: '',
      component: Input,
      componentProps: { label: 'Квартира', placeholder: 'Номер квартиры' },
    },
    postalCode: {
      value: '',
      component: Input,
      componentProps: { label: 'Почтовый индекс', placeholder: '000000' },
    },
  },

  // ============================================================================
  // Шаг 4: Информация о занятости
  // ============================================================================

  employmentStatus: {
    value: 'employed',
    component: RadioGroup,
    componentProps: {
      label: 'Статус занятости',
      options: [
        { value: 'employed', label: 'Работаю по найму' },
        { value: 'selfEmployed', label: 'Самозанятый/ИП' },
        { value: 'unemployed', label: 'Не работаю' },
        { value: 'retired', label: 'Пенсионер' },
        { value: 'student', label: 'Студент' },
      ],
    },
  },

  companyName: {
    value: '',
    component: Input,
    componentProps: { label: 'Название компании', placeholder: 'Введите название' },
  },

  companyInn: {
    value: '',
    component: Input,
    componentProps: { label: 'ИНН компании', placeholder: '0000000000' },
  },

  companyPhone: {
    value: '',
    component: Input,
    componentProps: { label: 'Телефон компании', placeholder: '+7 (000) 000-00-00' },
  },

  companyAddress: {
    value: '',
    component: Input,
    componentProps: { label: 'Адрес компании', placeholder: 'Полный адрес' },
  },

  position: {
    value: '',
    component: Input,
    componentProps: { label: 'Должность', placeholder: 'Ваша должность' },
  },

  workExperienceTotal: {
    value: null,
    component: Input,
    componentProps: { label: 'Общий стаж работы (месяцев)', type: 'number', min: 0 },
  },

  workExperienceCurrent: {
    value: null,
    component: Input,
    componentProps: { label: 'Стаж на текущем месте (месяцев)', type: 'number', min: 0 },
  },

  monthlyIncome: {
    value: null,
    component: Input,
    componentProps: { label: 'Ежемесячный доход', type: 'number', min: 0 },
  },

  additionalIncome: {
    value: null,
    component: Input,
    componentProps: { label: 'Дополнительный доход', type: 'number', min: 0 },
  },

  additionalIncomeSource: {
    value: '',
    component: Input,
    componentProps: { label: 'Источник дополнительного дохода', placeholder: 'Опишите источник' },
  },

  // Поля для самозанятых
  businessType: {
    value: '',
    component: Input,
    componentProps: { label: 'Тип бизнеса', placeholder: 'ООО, ИП и т.д.' },
  },

  businessInn: {
    value: '',
    component: Input,
    componentProps: { label: 'ИНН ИП', placeholder: '000000000000' },
  },

  businessActivity: {
    value: '',
    component: Textarea,
    componentProps: { label: 'Вид деятельности', placeholder: 'Опишите вид деятельности', rows: 3 },
  },

  // ============================================================================
  // Шаг 5: Дополнительная информация
  // ============================================================================

  maritalStatus: {
    value: 'single',
    component: RadioGroup,
    componentProps: {
      label: 'Семейное положение',
      options: [
        { value: 'single', label: 'Не женат / Не замужем' },
        { value: 'married', label: 'Женат / Замужем' },
        { value: 'divorced', label: 'Разведён / Разведена' },
        { value: 'widowed', label: 'Вдовец / Вдова' },
      ],
    },
  },

  dependents: {
    value: 0,
    component: Input,
    componentProps: { label: 'Количество иждивенцев', type: 'number', min: 0, max: 10 },
  },

  education: {
    value: 'higher',
    component: Select,
    componentProps: {
      label: 'Образование',
      options: [
        { value: 'secondary', label: 'Среднее' },
        { value: 'specialized', label: 'Среднее специальное' },
        { value: 'higher', label: 'Высшее' },
        { value: 'postgraduate', label: 'Учёная степень' },
      ],
    },
  },

  hasProperty: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'У меня есть имущество' },
  },

  // Массив имущества
  properties: [
    {
      type: {
        value: 'apartment',
        component: Select,
        componentProps: {
          label: 'Тип имущества',
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
      description: {
        value: '',
        component: Textarea,
        componentProps: { label: 'Описание', placeholder: 'Опишите имущество', rows: 2 },
      },
      estimatedValue: {
        value: 0,
        component: Input,
        componentProps: { label: 'Оценочная стоимость', type: 'number', min: 0 },
      },
      hasEncumbrance: {
        value: false,
        component: Checkbox,
        componentProps: { label: 'Есть обременение (ипотека, залог)' },
      },
    },
  ],

  hasExistingLoans: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'У меня есть действующие кредиты' },
  },

  // Массив существующих кредитов
  existingLoans: [
    {
      bank: {
        value: '',
        component: Input,
        componentProps: { label: 'Банк', placeholder: 'Название банка' },
      },
      type: {
        value: 'consumer',
        component: Select,
        componentProps: {
          label: 'Тип кредита',
          options: [
            { value: 'consumer', label: 'Потребительский' },
            { value: 'mortgage', label: 'Ипотека' },
            { value: 'car', label: 'Автокредит' },
            { value: 'credit_card', label: 'Кредитная карта' },
          ],
        },
      },
      amount: {
        value: 0,
        component: Input,
        componentProps: { label: 'Сумма кредита', type: 'number', min: 0 },
      },
      remainingAmount: {
        value: 0,
        component: Input,
        componentProps: { label: 'Остаток долга', type: 'number', min: 0 },
      },
      monthlyPayment: {
        value: 0,
        component: Input,
        componentProps: { label: 'Ежемесячный платёж', type: 'number', min: 0 },
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
    componentProps: { label: 'Добавить созаёмщика' },
  },

  // Массив созаёмщиков (с вложенным personalData)
  coBorrowers: [
    {
      personalData: {
        lastName: {
          value: '',
          component: Input,
          componentProps: { label: 'Фамилия' },
        },
        firstName: {
          value: '',
          component: Input,
          componentProps: { label: 'Имя' },
        },
        middleName: {
          value: '',
          component: Input,
          componentProps: { label: 'Отчество' },
        },
        birthDate: {
          value: '',
          component: Input,
          componentProps: { label: 'Дата рождения', type: 'date' },
        },
      },
      phone: {
        value: '',
        component: Input,
        componentProps: { label: 'Телефон', placeholder: '+7 (000) 000-00-00' },
      },
      email: {
        value: '',
        component: Input,
        componentProps: { label: 'Email', type: 'email' },
      },
      relationship: {
        value: 'spouse',
        component: Select,
        componentProps: {
          label: 'Родственная связь',
          options: [
            { value: 'spouse', label: 'Супруг/Супруга' },
            { value: 'parent', label: 'Родитель' },
            { value: 'child', label: 'Ребёнок' },
            { value: 'sibling', label: 'Брат/Сестра' },
            { value: 'other', label: 'Другое' },
          ],
        },
      },
      monthlyIncome: {
        value: 0,
        component: Input,
        componentProps: { label: 'Ежемесячный доход', type: 'number', min: 0 },
      },
    },
  ],

  // ============================================================================
  // Шаг 6: Согласия
  // ============================================================================

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
    componentProps: { label: 'Подтверждаю достоверность введённых данных' },
  },

  electronicSignature: {
    value: '',
    component: Input,
    componentProps: { label: 'Код подтверждения из СМС', placeholder: '000000' },
  },

  // ============================================================================
  // Вычисляемые поля (только для чтения, значения устанавливаются через behaviors)
  // ============================================================================

  interestRate: {
    value: 0,
    component: Input,
    componentProps: { label: 'Процентная ставка (%)', type: 'number', disabled: true },
  },

  monthlyPayment: {
    value: 0,
    component: Input,
    componentProps: { label: 'Ежемесячный платёж', type: 'number', disabled: true },
  },

  fullName: {
    value: '',
    component: Input,
    componentProps: { label: 'Полное имя', disabled: true },
  },

  age: {
    value: null,
    component: Input,
    componentProps: { label: 'Возраст', type: 'number', disabled: true },
  },

  totalIncome: {
    value: 0,
    component: Input,
    componentProps: { label: 'Общий доход', type: 'number', disabled: true },
  },

  paymentToIncomeRatio: {
    value: 0,
    component: Input,
    componentProps: { label: 'Отношение платежа к доходу (%)', type: 'number', disabled: true },
  },

  coBorrowersIncome: {
    value: 0,
    component: Input,
    componentProps: { label: 'Общий доход созаёмщиков', type: 'number', disabled: true },
  },
};
```

## Создание экземпляра формы

```typescript title="src/forms/credit-application/createCreditApplicationForm.ts"
import { createForm } from 'reformer';
import type { CreditApplicationForm } from './types';
import { creditApplicationSchema } from './schemas/credit-application.schema';

export const createCreditApplicationForm = () => {
  return createForm<CreditApplicationForm>(creditApplicationSchema);
};
```

## Работа с формой

### Доступ к полям

```typescript
const form = createCreditApplicationForm();

// Простые поля
<FormField control={form.controls.loanAmount} />

// Вложенные поля
<FormField control={form.controls.personalData.firstName} />
<FormField control={form.controls.registrationAddress.city} />

// Элементы массива
form.controls.properties.controls.map((property, index) => (
  <FormField control={property.controls.type} />
));
```

### Операции с массивами

```typescript
// Добавить элемент
form.controls.properties.push();

// Удалить элемент
form.controls.properties.removeAt(index);

// Получить длину
const count = form.controls.properties.length.value;
```

## Проблемы схемы

Как видите, эта схема имеет несколько проблем:

1. **Дублирование** — `registrationAddress` и `residenceAddress` имеют идентичную структуру
2. **Большой файл** — более 700 строк, сложно ориентироваться
3. **Нет переиспользования** — похожие паттерны повторяются (адреса, персональные данные)
4. **Сложно поддерживать** — изменение полей адреса требует изменений в нескольких местах

В следующем разделе мы научимся декомпозировать эту схему на меньшие, переиспользуемые части.

## Следующий шаг

Схема работает, но её сложно поддерживать. Давайте научимся декомпозировать её на переиспользуемые части в следующем разделе.
