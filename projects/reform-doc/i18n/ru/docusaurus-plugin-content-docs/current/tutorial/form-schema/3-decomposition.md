---
sidebar_position: 3
---

# Декомпозиция схемы

Разбиение схемы на переиспользуемые части.

## Зачем декомпозировать?

В предыдущем разделе мы создали полную схему из более чем 700 строк кода. Эта схема имеет несколько проблем:

1. **Дублирование** — `registrationAddress` и `residenceAddress` идентичны
2. **Большой файл** — сложно ориентироваться и поддерживать
3. **Нет переиспользования** — нельзя использовать `Address` или `PersonalData` в других формах
4. **Подвержено ошибкам** — изменение полей адреса требует изменений в нескольких местах

Декомпозиция схемы решает эти проблемы, выделяя общие паттерны в переиспользуемые модули.

## Выделение переиспользуемых схем

### Схема адреса

Структура адреса используется дважды в нашей форме. Давайте выделим её:

```typescript title="src/schemas/address.schema.ts"
import type { FormSchema } from 'reformer';
import { Input } from '@/components/ui/input';

export interface Address {
  region: string;
  city: string;
  street: string;
  house: string;
  apartment?: string;
  postalCode: string;
}

export const addressSchema: FormSchema<Address> = {
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
};
```

### Схема персональных данных

Персональные данные — также распространённый паттерн:

```typescript title="src/schemas/personal-data.schema.ts"
import type { FormSchema } from 'reformer';
import { Input, RadioGroup } from '@/components/ui';

export interface PersonalData {
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: string;
  birthPlace: string;
  gender: 'male' | 'female';
}

export const personalDataSchema: FormSchema<PersonalData> = {
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
};
```

### Схема паспортных данных

```typescript title="src/schemas/passport-data.schema.ts"
import type { FormSchema } from 'reformer';
import { Input, Textarea } from '@/components/ui';

export interface PassportData {
  series: string;
  number: string;
  issueDate: string;
  issuedBy: string;
  departmentCode: string;
}

export const passportDataSchema: FormSchema<PassportData> = {
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
};
```

### Схема имущества (для массивов)

```typescript title="src/schemas/property.schema.ts"
import type { FormSchema } from 'reformer';
import { Input, Select, Textarea, Checkbox } from '@/components/ui';

export type PropertyType = 'apartment' | 'house' | 'land' | 'commercial' | 'car' | 'other';

export interface Property {
  type: PropertyType;
  description: string;
  estimatedValue: number;
  hasEncumbrance: boolean;
}

export const propertySchema: FormSchema<Property> = {
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
};
```

### Схема существующего кредита (для массивов)

```typescript title="src/schemas/existing-loan.schema.ts"
import type { FormSchema } from 'reformer';
import { Input, Select } from '@/components/ui';

export interface ExistingLoan {
  bank: string;
  type: string;
  amount: number;
  remainingAmount: number;
  monthlyPayment: number;
  maturityDate: string;
}

export const existingLoanSchema: FormSchema<ExistingLoan> = {
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
};
```

### Схема созаёмщика (вложенная структура в массиве)

```typescript title="src/schemas/co-borrower.schema.ts"
import type { FormSchema } from 'reformer';
import { Input, Select } from '@/components/ui';

export interface CoBorrower {
  personalData: {
    lastName: string;
    firstName: string;
    middleName: string;
    birthDate: string;
  };
  phone: string;
  email: string;
  relationship: string;
  monthlyIncome: number;
}

export const coBorrowerSchema: FormSchema<CoBorrower> = {
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
};
```

## Композиция основной схемы

Теперь используем выделенные схемы в основной схеме формы:

```typescript title="src/schemas/credit-application.schema.ts"
import type { FormSchema } from 'reformer';
import { Input, Select, Checkbox, Textarea, RadioGroup } from '@/components/ui';
import type { CreditApplicationForm } from '../types';

// Импорт переиспользуемых схем
import { addressSchema } from './address.schema';
import { personalDataSchema } from './personal-data.schema';
import { passportDataSchema } from './passport-data.schema';
import { propertySchema } from './property.schema';
import { existingLoanSchema } from './existing-loan.schema';
import { coBorrowerSchema } from './co-borrower.schema';

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
    componentProps: { label: 'Сумма кредита', type: 'number', min: 50000, max: 10000000 },
  },

  loanTerm: {
    value: 12,
    component: Input,
    componentProps: { label: 'Срок кредита (месяцев)', type: 'number', min: 6, max: 240 },
  },

  loanPurpose: {
    value: '',
    component: Textarea,
    componentProps: { label: 'Цель кредита', rows: 3 },
  },

  // Поля для ипотеки
  propertyValue: {
    value: null,
    component: Input,
    componentProps: { label: 'Стоимость недвижимости', type: 'number', min: 1000000 },
  },

  initialPayment: {
    value: null,
    component: Input,
    componentProps: { label: 'Первоначальный взнос', type: 'number', min: 0 },
  },

  // Поля для автокредита
  carBrand: { value: '', component: Input, componentProps: { label: 'Марка автомобиля' } },
  carModel: { value: '', component: Input, componentProps: { label: 'Модель автомобиля' } },
  carYear: { value: null, component: Input, componentProps: { label: 'Год выпуска', type: 'number' } },
  carPrice: { value: null, component: Input, componentProps: { label: 'Стоимость', type: 'number' } },

  // ============================================================================
  // Шаг 2: Персональные данные — ИСПОЛЬЗУЕМ ПЕРЕИСПОЛЬЗУЕМЫЕ СХЕМЫ
  // ============================================================================

  personalData: personalDataSchema,    // ← Переиспользуемая схема
  passportData: passportDataSchema,    // ← Переиспользуемая схема

  inn: { value: '', component: Input, componentProps: { label: 'ИНН' } },
  snils: { value: '', component: Input, componentProps: { label: 'СНИЛС' } },

  // ============================================================================
  // Шаг 3: Контактная информация
  // ============================================================================

  phoneMain: { value: '', component: Input, componentProps: { label: 'Основной телефон' } },
  phoneAdditional: { value: '', component: Input, componentProps: { label: 'Дополнительный телефон' } },
  email: { value: '', component: Input, componentProps: { label: 'Email', type: 'email' } },
  emailAdditional: { value: '', component: Input, componentProps: { label: 'Дополнительный email', type: 'email' } },

  registrationAddress: addressSchema,  // ← Переиспользуемая схема
  sameAsRegistration: {
    value: true,
    component: Checkbox,
    componentProps: { label: 'Адрес проживания совпадает с адресом регистрации' },
  },
  residenceAddress: addressSchema,     // ← Та же схема используется повторно!

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

  companyName: { value: '', component: Input, componentProps: { label: 'Название компании' } },
  companyInn: { value: '', component: Input, componentProps: { label: 'ИНН компании' } },
  companyPhone: { value: '', component: Input, componentProps: { label: 'Телефон компании' } },
  companyAddress: { value: '', component: Input, componentProps: { label: 'Адрес компании' } },
  position: { value: '', component: Input, componentProps: { label: 'Должность' } },
  workExperienceTotal: { value: null, component: Input, componentProps: { label: 'Общий стаж (месяцев)', type: 'number' } },
  workExperienceCurrent: { value: null, component: Input, componentProps: { label: 'На текущем месте (месяцев)', type: 'number' } },
  monthlyIncome: { value: null, component: Input, componentProps: { label: 'Ежемесячный доход', type: 'number' } },
  additionalIncome: { value: null, component: Input, componentProps: { label: 'Дополнительный доход', type: 'number' } },
  additionalIncomeSource: { value: '', component: Input, componentProps: { label: 'Источник дополнительного дохода' } },
  businessType: { value: '', component: Input, componentProps: { label: 'Тип бизнеса' } },
  businessInn: { value: '', component: Input, componentProps: { label: 'ИНН ИП' } },
  businessActivity: { value: '', component: Textarea, componentProps: { label: 'Вид деятельности', rows: 3 } },

  // ============================================================================
  // Шаг 5: Дополнительная информация — МАССИВЫ ИСПОЛЬЗУЮТ ПЕРЕИСПОЛЬЗУЕМЫЕ СХЕМЫ
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

  dependents: { value: 0, component: Input, componentProps: { label: 'Иждивенцы', type: 'number' } },
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

  hasProperty: { value: false, component: Checkbox, componentProps: { label: 'У меня есть имущество' } },
  properties: [propertySchema],        // ← Массив с переиспользуемой схемой

  hasExistingLoans: { value: false, component: Checkbox, componentProps: { label: 'У меня есть действующие кредиты' } },
  existingLoans: [existingLoanSchema], // ← Массив с переиспользуемой схемой

  hasCoBorrower: { value: false, component: Checkbox, componentProps: { label: 'Добавить созаёмщика' } },
  coBorrowers: [coBorrowerSchema],     // ← Массив с переиспользуемой схемой

  // ============================================================================
  // Шаг 6: Согласия
  // ============================================================================

  agreePersonalData: { value: false, component: Checkbox, componentProps: { label: 'Согласие на обработку персональных данных' } },
  agreeCreditHistory: { value: false, component: Checkbox, componentProps: { label: 'Согласие на проверку кредитной истории' } },
  agreeMarketing: { value: false, component: Checkbox, componentProps: { label: 'Согласие на маркетинговые материалы' } },
  agreeTerms: { value: false, component: Checkbox, componentProps: { label: 'Согласие с условиями кредитования' } },
  confirmAccuracy: { value: false, component: Checkbox, componentProps: { label: 'Подтверждаю достоверность данных' } },
  electronicSignature: { value: '', component: Input, componentProps: { label: 'Код из СМС' } },

  // ============================================================================
  // Вычисляемые поля
  // ============================================================================

  interestRate: { value: 0, component: Input, componentProps: { label: 'Процентная ставка (%)', disabled: true } },
  monthlyPayment: { value: 0, component: Input, componentProps: { label: 'Ежемесячный платёж', disabled: true } },
  fullName: { value: '', component: Input, componentProps: { label: 'Полное имя', disabled: true } },
  age: { value: null, component: Input, componentProps: { label: 'Возраст', disabled: true } },
  totalIncome: { value: 0, component: Input, componentProps: { label: 'Общий доход', disabled: true } },
  paymentToIncomeRatio: { value: 0, component: Input, componentProps: { label: 'Платёж/Доход (%)', disabled: true } },
  coBorrowersIncome: { value: 0, component: Input, componentProps: { label: 'Доход созаёмщиков', disabled: true } },
};
```

## Структура файлов

После декомпозиции структура проекта может выглядеть так:

```
src/
├── schemas/
│   ├── address.schema.ts
│   ├── personal-data.schema.ts
│   ├── passport-data.schema.ts
│   ├── property.schema.ts
│   ├── existing-loan.schema.ts
│   ├── co-borrower.schema.ts
│   └── credit-application.schema.ts
└── types/
    └── credit-application.ts
```

## Преимущества декомпозиции

### 1. Переиспользуемость

Одна и та же схема может использоваться в нескольких местах:

```typescript
// Форма заявки на кредит
registrationAddress: addressSchema,
residenceAddress: addressSchema,

// Форма компании (другой проект)
companyAddress: addressSchema,
```

### 2. Простота тестирования

Можно тестировать каждую схему изолированно:

```typescript
describe('addressSchema', () => {
  it('должна содержать все обязательные поля', () => {
    expect(addressSchema).toHaveProperty('city');
    expect(addressSchema).toHaveProperty('street');
    expect(addressSchema).toHaveProperty('house');
  });
});
```

### 3. Лучшая поддерживаемость

Изменение структуры адреса требует редактирования только одного файла:

```typescript
// address.schema.ts - добавляем новое поле
export const addressSchema: FormSchema<Address> = {
  // ... существующие поля
  country: {  // ← Новое поле
    value: '',
    component: Input,
    componentProps: { label: 'Страна' },
  },
};
```

И `registrationAddress`, и `residenceAddress` автоматически получат новое поле.

### 4. Типобезопасность

Каждая схема экспортирует свой интерфейс, обеспечивая типобезопасность:

```typescript
import type { Address } from './schemas/address.schema';
import type { PersonalData } from './schemas/personal-data.schema';

// Полная типобезопасность в основном интерфейсе
interface CreditApplicationForm {
  registrationAddress: Address;
  residenceAddress: Address;
  personalData: PersonalData;
  // ...
}
```

## Когда выделять схему

Выделяйте схему, когда:

1. **Используется несколько раз** — адреса, контакты, любая повторяющаяся структура
2. **Логически независима** — персональные данные, паспортные данные, имущество
3. **Достаточно сложна** — более 3-4 полей
4. **Может быть переиспользована** — в других формах или проектах

Оставляйте inline, когда:

1. **Используется один раз** — выбор типа кредита, согласия
2. **Тесно связана** — поля, которые имеют смысл только вместе в данном контексте
3. **Простая** — один чекбокс или поле ввода

## Следующий шаг

Теперь, когда у нас есть хорошо организованная схема, перейдём к вёрстке UI формы и подключению её к нашим компонентам.
