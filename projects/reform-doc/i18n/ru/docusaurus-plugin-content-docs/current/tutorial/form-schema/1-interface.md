---
sidebar_position: 1
---

# Интерфейс формы

Определение TypeScript интерфейса для формы заявки на кредит.

## Обзор

Перед созданием схемы формы необходимо определить её TypeScript интерфейс. Это обеспечивает типобезопасность во всём приложении и помогает обнаруживать ошибки на этапе компиляции.

## Базовые типы

Сначала определим перечисляемые типы, используемые в форме:

```typescript title="src/types/credit-application.types.ts"
// Типы кредита
export type LoanType = 'consumer' | 'mortgage' | 'car' | 'business' | 'refinancing';

// Статус занятости
export type EmploymentStatus = 'employed' | 'selfEmployed' | 'unemployed' | 'retired' | 'student';

// Семейное положение
export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed';

// Уровень образования
export type EducationLevel = 'secondary' | 'specialized' | 'higher' | 'postgraduate';

// Типы имущества
export type PropertyType = 'apartment' | 'house' | 'car' | 'land' | 'commercial' | 'other';
```

## Вложенные интерфейсы

Сложные формы часто имеют вложенные структуры. Определим отдельные интерфейсы для переиспользуемых секций:

### Адрес

```typescript
export interface Address {
  region: string;
  city: string;
  street: string;
  house: string;
  apartment?: string;  // Опциональное поле
  postalCode: string;
}
```

### Персональные данные

```typescript
export interface PersonalData {
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: string;
  birthPlace: string;
  gender: 'male' | 'female';
}
```

### Паспортные данные

```typescript
export interface PassportData {
  series: string;
  number: string;
  issueDate: string;
  issuedBy: string;
  departmentCode: string;
}
```

### Имущество (для массивов)

```typescript
export interface Property {
  type: PropertyType;
  description: string;
  estimatedValue: number;
  hasEncumbrance: boolean;
}
```

### Существующий кредит (для массивов)

```typescript
export interface ExistingLoan {
  bank: string;
  type: string;
  amount: number;
  remainingAmount: number;
  monthlyPayment: number;
  maturityDate: string;
}
```

### Созаёмщик (для массивов)

```typescript
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
```

## Основной интерфейс формы

Теперь объединим всё в основной интерфейс формы:

```typescript title="src/types/credit-application.types.ts"
export interface CreditApplicationForm {
  // ============================================
  // Шаг 1: Основная информация о кредите
  // ============================================
  loanType: LoanType;
  loanAmount: number;
  loanTerm: number;
  loanPurpose: string;

  // Поля для ипотеки
  propertyValue: number;
  initialPayment: number;

  // Поля для автокредита
  carBrand: string;
  carModel: string;
  carYear: number;
  carPrice: number;

  // ============================================
  // Шаг 2: Персональная информация
  // ============================================
  personalData: PersonalData;
  passportData: PassportData;
  inn: string;
  snils: string;

  // ============================================
  // Шаг 3: Контактная информация
  // ============================================
  phoneMain: string;
  phoneAdditional: string;
  email: string;
  emailAdditional: string;
  registrationAddress: Address;
  sameAsRegistration: boolean;
  residenceAddress: Address;

  // ============================================
  // Шаг 4: Информация о занятости
  // ============================================
  employmentStatus: EmploymentStatus;
  companyName: string;
  companyInn: string;
  companyPhone: string;
  companyAddress: string;
  position: string;
  workExperienceTotal: number;
  workExperienceCurrent: number;
  monthlyIncome: number;
  additionalIncome: number;
  additionalIncomeSource: string;

  // Поля для ИП
  businessType: string;
  businessInn: string;
  businessActivity: string;

  // ============================================
  // Шаг 5: Дополнительная информация
  // ============================================
  maritalStatus: MaritalStatus;
  dependents: number;
  education: EducationLevel;

  // Динамические массивы
  hasProperty: boolean;
  properties: Property[];
  hasExistingLoans: boolean;
  existingLoans: ExistingLoan[];
  hasCoBorrower: boolean;
  coBorrowers: CoBorrower[];

  // ============================================
  // Шаг 6: Согласия
  // ============================================
  agreePersonalData: boolean;
  agreeCreditHistory: boolean;
  agreeMarketing: boolean;
  agreeTerms: boolean;
  confirmAccuracy: boolean;
  electronicSignature: string;

  // ============================================
  // Вычисляемые поля
  // ============================================
  interestRate: number;
  monthlyPayment: number;
  fullName: string;
  age: number | null;
  totalIncome: number;
  paymentToIncomeRatio: number;
  coBorrowersIncome: number;
}
```

## Советы по организации интерфейса

### 1. Группируйте связанные поля

Организуйте поля по секциям формы или логическим группам. Используйте комментарии для обозначения секций:

```typescript
interface MyForm {
  // Персональная информация
  firstName: string;
  lastName: string;

  // Контактная информация
  email: string;
  phone: string;
}
```

### 2. Используйте вложенные объекты для сложных секций

Вместо плоской структуры с префиксами:

```typescript
// Избегайте
interface Form {
  addressCity: string;
  addressStreet: string;
  addressHouse: string;
}
```

Используйте вложенные объекты:

```typescript
// Предпочтительно
interface Form {
  address: {
    city: string;
    street: string;
    house: string;
  };
}
```

### 3. Используйте массивы для повторяющихся секций

Когда пользователи могут добавлять несколько элементов:

```typescript
interface Form {
  // Один элемент — объект
  personalData: PersonalData;

  // Несколько элементов — массив
  properties: Property[];
  existingLoans: ExistingLoan[];
}
```

### 4. Помечайте опциональные поля

Используйте `?` для действительно опциональных полей:

```typescript
interface Address {
  city: string;           // Обязательное
  apartment?: string;     // Опциональное
}
```

### 5. Включайте вычисляемые поля

Включайте вычисляемые поля в интерфейс, даже если они будут рассчитываться автоматически:

```typescript
interface Form {
  firstName: string;
  lastName: string;
  fullName: string;  // Вычисляется из firstName + lastName
}
```

## Преимущества типобезопасности

С правильно определённым интерфейсом TypeScript будет:

1. **Автодополнять имена полей** в вашей IDE
2. **Ловить опечатки** в именах полей на этапе компиляции
3. **Проверять типы полей** при установке значений
4. **Предоставлять подсказки типов** для значений формы

```typescript
// TypeScript поймает эту ошибку
form.controls.emial  // Ошибка: Свойство 'emial' не существует

// Подсказки типов при доступе к значениям
const amount = form.value.loanAmount;  // TypeScript знает, что это number
```

## Следующий шаг

Теперь, когда интерфейс определён, мы можем создать схему формы, которая реализует этот интерфейс.
