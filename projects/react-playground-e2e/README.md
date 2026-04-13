# E2E Тесты React Playground

End-to-end тесты для демонстрационного приложения библиотеки ReFormer.
Используется Playwright + Page Object Model.

## Быстрый старт

**\*Для активации accessibility тестов нужно установить зависимость**

```
npm install -D @axe-core/playwright
```

Команды для тестов нужxно запускать из директории `projects/react-playground-e2e`

```
cd projects/react-playground-e2e
```

```bash
# Установка зависимостей (из корня монорепозитория)
npm install

# Запуск всех тестов
npm run test:e2e

# Запуск в UI(интерактивном) режиме
npm run test:e2e:ui

# Headed режим (с браузером)
npx playwright test --headed

# Debug режим
npx playwright test --debug

# Обновление скриншотов
npx playwright test --update-snapshots

# Генерация отчёта
npx playwright show-report

# Codegen (запись тестов)
npx playwright codegen http://localhost:5173

# Просмотр отчёта
npm run test:e2e:report

# Запуск конкретного файла
npx playwright test tests/pages/simple-form/registration.spec.ts

# Запуск конкретного проекта
npx playwright test --project=simple-form
npx playwright test --project=complex-multy-step-form

# Конкретный тест по имени
npx playwright test -g "REG-001-A"

# По тегам
playwright test --grep @smoke      # быстрый CI
playwright test --grep @critical   # PR CI
playwright test --grep @a11y       # accessibility
playwright test --grep @visual     # visual regression
playwright test --grep @perf       # performance
playwright test --grep "@smoke|@critical" # multi

# Оба варианта комплексной формы
playwright test --project='complex-multy-step-form*'

# Запуск кросс-браузерных @critical тестов
npx playwright test --project=complex-form:firefox --project=complex-form:webkit
```

## Структура проекта

```
tests/
├── shared/                          # Общие утилиты
│   ├── base-page.ts                 # Базовый Page Object Model
│   ├── a11y.ts                      # Утилиты доступности (axe-core)
│   ├── performance.ts               # Утилиты производительности
│   └── test-factory.ts              # Фабрика тестов
│
└── pages/                           # Тесты по страницам
    ├── simple-form/                 # Простая форма регистрации
    │   ├── registration.spec.ts     # REG-*: Тесты регистрации
    │   ├── accessibility.spec.ts    # SFA11Y-*: Тесты доступности
    │   └── simple-form-page.pom.ts  # Page Object
    │
    ├── behaviors/                   # Примеры поведений
    │   ├── behaviors.spec.ts        # BEH-*: Тесты behaviors
    │   └── behaviors-page.pom.ts    # Page Object
    │
    ├── validation/                  # Примеры валидации
    │   ├── validators.spec.ts       # SVAL-*, NVAL-*, DVAL-*: Тесты валидаторов
    │   └── validation-page.pom.ts   # Page Object
    │
    └── complex-multy-step-form/     # Сложная многошаговая форма
        ├── happy-path.spec.ts       # HP-*: Успешные сценарии
        ├── validation.spec.ts       # VAL-*: Валидация
        ├── navigation.spec.ts       # NAV-*: Навигация
        ├── arrays.spec.ts           # ARR-*: Работа с массивами
        ├── conditional-fields.spec.ts # COND-*: Условные поля
        ├── computed-fields.spec.ts  # COMP-*: Вычисляемые поля
        ├── dependencies.spec.ts     # DEP-*: Зависимости полей
        ├── accessibility.spec.ts    # A11Y-*: Доступность
        ├── performance.spec.ts      # PERF-*: Производительность
        ├── visual.spec.ts           # VIS-*: Визуальная регрессия
        ├── credit-form-page.pom.ts  # Page Object
        ├── test-data.ts             # Тестовые данные
        ├── mocks.ts                 # Моки API
        ├── builders.ts              # Билдеры данных
        └── scenarios.ts             # Сценарии заполнения
```

## Проекты Playwright

| Проект                    | Описание                       | Браузер | Тесты       |
| ------------------------- | ------------------------------ | ------- | ----------- |
| `complex-multy-step-form` | Сложная форма кредитной заявки | Chrome  | Все         |
| `complex-form:firefox`    | Кросс-браузерные тесты         | Firefox | `@critical` |
| `complex-form:webkit`     | Кросс-браузерные тесты         | Safari  | `@critical` |
| `simple-form`             | Простая форма регистрации      | Chrome  | Все         |
| `validation`              | Примеры валидаторов            | Chrome  | Все         |
| `behaviors`               | Примеры поведений форм         | Chrome  | Все         |

## Теги тестов

| Тег             | Описание                             | Пример запуска         |
| --------------- | ------------------------------------ | ---------------------- |
| `@critical`     | Критические тесты (кросс-браузерные) | `--grep @critical`     |
| `@smoke`        | Дымовые тесты                        | `--grep @smoke`        |
| `@a11y`         | Тесты доступности WCAG               | `--grep @a11y`         |
| `@validation`   | Тесты валидации полей                | `--grep @validation`   |
| `@behaviors`    | Тесты поведений форм                 | `--grep @behaviors`    |
| `@registration` | Тесты формы регистрации              | `--grep @registration` |
| `@navigation`   | Тесты навигации по шагам             | `--grep @navigation`   |

## Page Object Model

### BasePage (tests/shared/base-page.ts)

Базовый класс для всех Page Object с общей функциональностью:

```typescript
import { BasePage } from '../shared/base-page';

class MyFormPage extends BasePage {
  async goto() {
    await this.navigateTo('/my-form');
  }
}
```

**Селекторы по data-testid:**

```typescript
// Поле (контейнер): [data-testid="field-email"]
this.field('email');

// Input: [data-testid="input-email"]
this.input('email');

// Label: [data-testid="label-email"]
this.label('email');

// Ошибка: [data-testid="error-email"]
this.error('email');

// Произвольный testId
this.byTestId('submit-button');
```

**Assertions:**

```typescript
await this.expectFieldVisible('email');
await this.expectFieldHidden('additionalInfo');
await this.expectFieldError('email', /обязателен/i);
await this.expectNoFieldError('email');
await this.expectFieldValue('email', 'test@example.com');
await this.expectFieldDisabled('readonlyField');
await this.expectFieldEnabled('editableField');
```

**Отслеживание ошибок:**

```typescript
// Проверка отсутствия ошибок консоли
expect(page.hasNoErrors()).toBe(true);

// Проверка отсутствия stack overflow
expect(page.hasNoStackOverflow()).toBe(true);

// Проверка отсутствия React ошибок
expect(page.hasNoReactErrors()).toBe(true);

// Очистка накопленных ошибок
page.clearErrors();

// Получение отчёта об ошибках
console.log(page.getErrorsSummary());
```

## Утилиты доступности (tests/shared/a11y.ts)

### Проверки через axe-core

```typescript
import { checkA11y, checkWcag21AA, expectNoA11yViolations } from '../shared/a11y';

test('страница соответствует WCAG 2.1 AA', async ({ page }) => {
  await page.goto('/form');

  // Проверка и получение результата
  const result = await checkWcag21AA(page);
  expect(result.violations).toHaveLength(0);

  // Или с выбросом ошибки при нарушениях
  await expectNoA11yViolations(page);
});
```

### Ручные проверки

```typescript
import {
  checkImagesHaveAlt,
  checkInputsHaveLabels,
  checkHeadingHierarchy,
  checkAriaValidity,
  createA11yReport,
} from '../shared/a11y';

// Проверка alt текста у изображений
const images = await checkImagesHaveAlt(page);
expect(images.valid).toBe(true);

// Проверка меток у полей ввода
const inputs = await checkInputsHaveLabels(page);
expect(inputs.valid).toBe(true);

// Проверка иерархии заголовков
const headings = await checkHeadingHierarchy(page);
expect(headings.valid).toBe(true);

// Проверка ARIA атрибутов
const aria = await checkAriaValidity(page);
expect(aria.valid).toBe(true);

// Полный отчёт по доступности
const report = await createA11yReport(page);
console.log(report);
```

## Конвенции именования тестов

### Формат ID-кодов

```
{PREFIX}-{GROUP}-{VARIANT}: Описание на русском
```

**Префиксы по файлам:**

| Файл                                | Префикс  | Пример         |
| ----------------------------------- | -------- | -------------- |
| registration.spec.ts                | `REG`    | `REG-001-A`    |
| accessibility.spec.ts (simple-form) | `SFA11Y` | `SFA11Y-001-A` |
| behaviors.spec.ts                   | `BEH`    | `BEH-001-A`    |
| validators.spec.ts (string)         | `SVAL`   | `SVAL-001-A`   |
| validators.spec.ts (number)         | `NVAL`   | `NVAL-001-A`   |
| validators.spec.ts (date)           | `DVAL`   | `DVAL-001-A`   |
| happy-path.spec.ts                  | `HP`     | `HP-001`       |
| validation.spec.ts                  | `VAL`    | `VAL-001-A`    |
| navigation.spec.ts                  | `NAV`    | `NAV-001-A`    |
| arrays.spec.ts                      | `ARR`    | `ARR-001-A`    |
| conditional-fields.spec.ts          | `COND`   | `COND-001-A`   |
| computed-fields.spec.ts             | `COMP`   | `COMP-001-A`   |
| dependencies.spec.ts                | `DEP`    | `DEP-001-A`    |
| accessibility.spec.ts (complex)     | `A11Y`   | `A11Y-001-A`   |
| performance.spec.ts                 | `PERF`   | `PERF-001`     |
| visual.spec.ts                      | `VIS`    | `VIS-001`      |

**Пример теста:**

```typescript
test.describe('REG-001: Успешная регистрация', () => {
  test('REG-001-A: Регистрация с валидными данными', async ({ page }) => {
    // ...
  });

  test('REG-001-B: Очистка формы после сброса', async ({ page }) => {
    // ...
  });
});
```

## Переменные окружения

| Переменная     | Описание                    | По умолчанию            |
| -------------- | --------------------------- | ----------------------- |
| `E2E_PORT`     | Порт dev-сервера            | `5173`                  |
| `E2E_BASE_URL` | Базовый URL для тестов      | `http://localhost:5173` |
| `CI`           | Режим CI (retries, workers) | -                       |

```bash
# Запуск на другом порту
E2E_PORT=3000 npm run test:e2e

# Запуск против внешнего URL
E2E_BASE_URL=https://staging.example.com npm run test:e2e
```

## CI/CD

В CI режиме (`CI=true`):

- Retries: 2 (повторы при падении)
- Workers: 1 (последовательный запуск)
- Trace: on-first-retry (запись при повторе)

```yaml
# Пример для GitHub Actions
- name: Run E2E tests
  run: npm run test:e2e
  env:
    CI: true
```

## Зависимости

- `@playwright/test` — Playwright Test Runner
- `@axe-core/playwright` — Проверки доступности axe-core
- `@types/node` — TypeScript типы для Node.js
