# План: Исправление ошибок E2E тестов после рефакторинга

## Контекст

После рефакторинга структуры E2E тестов (колокация по страницам) при запуске `npx playwright test --grep @smoke` возникают ошибки. Причина — несоответствие интерфейсов между файлами `mocks.ts`, `test-data.ts` и `builders.ts`.

## Выявленные проблемы

### 1. КРИТИЧЕСКАЯ: Несоответствие полей PassportData

**Файл:** [mocks.ts:41-47](projects/react-playground-e2e/tests/pages/complex-multy-step-form/mocks.ts#L41-L47)

```typescript
// В mocks.ts (НЕПРАВИЛЬНО):
export interface PassportData {
  issueDate: string; // ← должно быть issuedDate
  departmentCode: string; // ← должно быть code
}

// В test-data.ts (ПРАВИЛЬНО):
export interface PassportData {
  issuedDate: string;
  code: string;
}
```

**Последствие:** Mock API возвращает данные с неправильными полями, форма не может их прочитать.

### 2. ВЫСОКАЯ: Отсутствие полей в CoBorrower

**Файл:** [mocks.ts:71-75](projects/react-playground-e2e/tests/pages/complex-multy-step-form/mocks.ts#L71-L75)

```typescript
// В mocks.ts (неполный):
export interface CoBorrower {
  personalData: PersonalData;
  monthlyIncome: number;
  relationship: string;
  // отсутствуют: phone, email
}
```

### 3. СРЕДНЯЯ: Дублирование типов

Типы `PersonalData`, `LoanType`, `EmploymentStatus`, `MaritalStatus`, `EducationLevel` определены в нескольких файлах с разной структурой.

## План исправления

### Шаг 1: Исправить PassportData в mocks.ts

Переименовать поля в интерфейсе и во всех mock-данных:

- `issueDate` → `issuedDate`
- `departmentCode` → `code`

**Файлы для изменения:**

- [mocks.ts](projects/react-playground-e2e/tests/pages/complex-multy-step-form/mocks.ts) — интерфейс и данные MOCK_CREDIT_APPLICATION_1, MOCK_CREDIT_APPLICATION_2

### Шаг 2: Унифицировать типы

Удалить дублирующиеся типы из `mocks.ts`, импортировать из `test-data.ts`:

```typescript
// mocks.ts — БЫЛО:
export interface PassportData { ... }
export interface PersonalData { ... }

// mocks.ts — СТАЛО:
import type { PassportData, PersonalData, AddressData } from './test-data';
```

### Шаг 3: Добавить недостающие поля в CoBorrower (опционально)

Если форма использует phone/email для созаёмщика — добавить поля. Если нет — оставить как есть.

## Файлы для изменения

| Файл                                                                                   | Изменение                                                  |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| [mocks.ts](projects/react-playground-e2e/tests/pages/complex-multy-step-form/mocks.ts) | Исправить PassportData, импортировать типы из test-data.ts |

## Верификация

```bash
cd projects/react-playground-e2e
npx playwright test --project='complex-multy-step-form' --grep @smoke
```
