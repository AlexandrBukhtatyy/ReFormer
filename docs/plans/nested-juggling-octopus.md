# План: Новая структура E2E тестов для react-playground

## Контекст

После больших изменений в react-playground нужно удалить старые e2e тесты и создать новую структуру с нуля. Ключевое требование: переиспользование тестов для двух страниц с комплексной формой.

**Текущее состояние:**
- 15 тестовых файлов (~3900 строк) в `projects/react-playground-e2e/tests/credit-form/`
- CreditFormPage.ts с жёстко закодированным `baseUrl = '/examples/complex'`
- Нет тестов для других страниц приложения

## Страницы приложения

| URL | Компонент | Директория |
|-----|-----------|------------|
| `/examples/simple` | RegistrationForm | `simple-form/` |
| `/examples/complex` | CreditApplicationForm | `complex-multy-step-form/` |
| `/examples/complex-renderer` | CreditApplicationFormRenderer | `complex-multy-step-form-renderer/` |
| `/examples/validation` | ValidationExamples | `validation/` |
| `/examples/behaviors` | BehaviorsExamples | `behaviors/` |

**Переиспользуемые тесты:**
- `complex-multy-step-form` и `complex-multy-step-form-renderer` отображают одинаковую форму кредитной заявки (6 шагов wizard, те же поля, валидация, behaviors), но реализованы по-разному:
  - `complex-multy-step-form` — headless compound components с render props
  - `complex-multy-step-form-renderer` — FormRenderer + RenderSchema API

## Test Strategy

### Уровни тестирования

| Уровень | Когда запускать | Браузеры | Теги |
|---------|-----------------|----------|------|
| **Smoke** | Каждый PR | Chromium | `@smoke` |
| **Critical** | Каждый PR | Chromium, Firefox, WebKit | `@critical` |
| **Regression** | Nightly / перед релизом | Chromium | `@high`, `@medium` |
| **Visual** | Перед релизом | Chromium | `@visual` |
| **Performance** | Nightly / перед релизом | Chromium | `@perf` |

### Границы E2E тестирования

**Тестируем:**
- Пользовательские сценарии (заполнение форм, навигация)
- Валидация полей и форм
- Условное отображение/скрытие полей
- Вычисляемые поля
- Работа с массивами (добавление/удаление элементов)
- Зависимости между полями

**НЕ тестируем в E2E (покрыто unit/integration):**
- Внутренняя логика ReFormer библиотеки
- Детали реализации компонентов
- Производительность рендеринга

### API Mocking

Все API вызовы мокаются для стабильности тестов:
```typescript
// tests/mocks/api.mocks.ts
export async function mockAllApis(page: Page) {
  await page.route('**/api/**', handler);
}
```

### Performance Testing

**Замеряемые метрики:**

| Метрика | Описание | Порог |
|---------|----------|-------|
| **Time to Interactive (TTI)** | Время до интерактивности формы | < 2s |
| **First Contentful Paint (FCP)** | Первый контент на экране | < 1s |
| **Step Navigation Time** | Время перехода между шагами | < 300ms |
| **Validation Response Time** | Время отклика валидации | < 100ms |
| **Form Submission Time** | Время отправки формы | < 500ms |
| **Re-render Count** | Количество ре-рендеров при вводе | baseline ±10% |

**Подход:**
```typescript
// tests/shared/performance.ts
export async function measurePerformance(page: Page) {
  const metrics = await page.evaluate(() => ({
    // Web Vitals
    fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime,
    // Custom marks
    tti: performance.getEntriesByName('form-interactive')[0]?.startTime,
  }));
  return metrics;
}

export async function measureAction(page: Page, action: () => Promise<void>) {
  const start = performance.now();
  await action();
  return performance.now() - start;
}
```

**Сравнение вариантов:**
- Замеры для `compound` и `renderer` должны быть сопоставимы
- Алерт если разница > 20%

## Новая структура тестов

```
projects/react-playground-e2e/
├── playwright.config.ts              # Projects + retry + cross-browser
├── tests/
│   ├── fixtures/
│   │   ├── index.ts                  # Реэкспорт
│   │   ├── test-data.ts              # Общие данные
│   │   └── builders/                 # Data Builders
│   │       ├── credit-form.builder.ts
│   │       ├── registration.builder.ts
│   │       └── index.ts
│   │
│   ├── mocks/                        # API mocks
│   │   ├── api.mocks.ts              # Общие моки API
│   │   ├── credit-application.mock.ts
│   │   └── dictionaries.mock.ts
│   │
│   ├── pages/
│   │   ├── index.ts
│   │   ├── BasePage.ts               # Базовый класс + a11y helpers
│   │   ├── CreditFormPage.ts         # POM с поддержкой variant
│   │   ├── SimpleFormPage.ts
│   │   ├── ValidationPage.ts
│   │   └── BehaviorsPage.ts
│   │
│   ├── shared/
│   │   ├── test-factory.ts           # Fixtures + API mocking
│   │   ├── a11y.ts                   # Accessibility helpers
│   │   ├── performance.ts            # Performance measurement helpers
│   │   └── scenarios/
│   │       ├── credit-form.scenarios.ts
│   │       └── index.ts
│   │
│   ├── complex-multy-step-form/
│   │   ├── happy-path.spec.ts
│   │   ├── validation.spec.ts
│   │   ├── navigation.spec.ts
│   │   ├── conditional-fields.spec.ts
│   │   ├── computed-fields.spec.ts
│   │   ├── arrays.spec.ts
│   │   ├── dependencies.spec.ts
│   │   ├── accessibility.spec.ts     # A11y тесты
│   │   ├── visual.spec.ts            # Visual regression
│   │   └── performance.spec.ts       # Замеры производительности
│   │
│   ├── simple-form/
│   │   ├── registration.spec.ts
│   │   └── accessibility.spec.ts
│   │
│   ├── validation/
│   │   └── validators.spec.ts
│   │
│   └── behaviors/
│       └── behaviors.spec.ts
```

## Подход к переиспользованию тестов

### Playwright Config

```typescript
// playwright.config.ts
export default defineConfig({
  retries: process.env.CI ? 2 : 0,
  expect: { timeout: 5000 },

  projects: [
    // === Complex Form - Chromium (основной) ===
    {
      name: 'complex-multy-step-form',
      testDir: './tests/complex-multy-step-form',
      use: { ...devices['Desktop Chrome'] },
      metadata: { basePath: '/examples/complex', variant: 'compound' },
    },
    {
      name: 'complex-multy-step-form-renderer',
      testDir: './tests/complex-multy-step-form',  // ТЕ ЖЕ ТЕСТЫ!
      use: { ...devices['Desktop Chrome'] },
      metadata: { basePath: '/examples/complex-renderer', variant: 'renderer' },
    },

    // === Complex Form - Cross-browser (только @critical) ===
    {
      name: 'complex-form:firefox',
      testDir: './tests/complex-multy-step-form',
      grep: /@critical/,
      use: { ...devices['Desktop Firefox'] },
      metadata: { basePath: '/examples/complex', variant: 'compound' },
    },
    {
      name: 'complex-form:webkit',
      testDir: './tests/complex-multy-step-form',
      grep: /@critical/,
      use: { ...devices['Desktop Safari'] },
      metadata: { basePath: '/examples/complex', variant: 'compound' },
    },

    // === Остальные страницы ===
    { name: 'simple-form', testDir: './tests/simple-form', use: { ...devices['Desktop Chrome'] } },
    { name: 'validation', testDir: './tests/validation', use: { ...devices['Desktop Chrome'] } },
    { name: 'behaviors', testDir: './tests/behaviors', use: { ...devices['Desktop Chrome'] } },
  ],
});
```

### Параметризованный Page Object с поддержкой variant

```typescript
// tests/pages/CreditFormPage.ts
type FormVariant = 'compound' | 'renderer';

export class CreditFormPage extends BasePage {
  readonly variant: FormVariant;
  readonly basePath: string;

  constructor(page: Page, options?: { basePath?: string; variant?: FormVariant }) {
    super(page);
    this.basePath = options?.basePath ?? '/examples/complex';
    this.variant = options?.variant ?? 'compound';
  }

  async goto() {
    await this.page.goto(this.basePath);
  }

  // Для тестов, специфичных для одного варианта
  isRenderer(): boolean {
    return this.variant === 'renderer';
  }

  isCompound(): boolean {
    return this.variant === 'compound';
  }
}

// Использование в тестах для пропуска специфичных кейсов:
test('renderer-specific feature', async ({ creditForm }) => {
  test.skip(!creditForm.isRenderer(), 'Only for renderer variant');
  // ...
});
```

### Test Factory с fixtures и API mocking

```typescript
// tests/shared/test-factory.ts
import { mockAllApis } from '../mocks/api.mocks';

type TestFixtures = {
  creditForm: CreditFormPage;
  mockApis: void;
};

export const test = base.extend<TestFixtures>({
  // Автоматический мокинг API для всех тестов
  mockApis: [async ({ page }, use) => {
    await mockAllApis(page);
    await use();
  }, { auto: true }],

  creditForm: async ({ page }, use, testInfo) => {
    const { basePath, variant } = testInfo.project.metadata ?? {};
    const creditForm = new CreditFormPage(page, { basePath, variant });
    await use(creditForm);
  },
});
```

### Data Builders

```typescript
// tests/fixtures/builders/credit-form.builder.ts
export const creditFormBuilder = {
  consumerLoan: () => ({
    loanType: 'consumer',
    loanAmount: 500000,
    loanTerm: 24,
    loanPurpose: 'purchase',
  }),

  mortgage: () => ({
    loanType: 'mortgage',
    loanAmount: 5000000,
    propertyValue: 6000000,
    initialPayment: 1000000,
  }),

  // Модификаторы для негативных сценариев
  withInvalidPhone: <T>(base: T) => ({ ...base, phoneMain: 'invalid' }),
  withMissingRequired: <T>(base: T) => ({ ...base, lastName: '' }),
};
```

### Shared Scenarios

```typescript
// tests/shared/scenarios/credit-form.scenarios.ts
import { creditFormBuilder } from '../../fixtures/builders';

export async function fillConsumerLoanHappyPath(form: CreditFormPage) {
  const data = creditFormBuilder.consumerLoan();
  await form.selectLoanType(data.loanType);
  await form.fillLoanAmount(data.loanAmount);
  // ...
}
```

## Тестовые сценарии

### complex-multy-step-form (+ complex-multy-step-form-renderer)

#### happy-path.spec.ts `@critical` `@smoke`
| ID | Сценарий |
|----|----------|
| HP-001 | Потребительский кредит — полное заполнение и отправка |
| HP-002 | Ипотека — полное заполнение с расчётом первоначального взноса |
| HP-003 | Автокредит — выбор марки/модели и заполнение |

#### validation.spec.ts `@critical`
| ID | Сценарий |
|----|----------|
| VAL-001 | Обязательные поля — ошибки при пустых значениях |
| VAL-002 | Email — валидация формата |
| VAL-003 | Телефон — валидация с маской |
| VAL-004 | Дата рождения — проверка возраста (18-65 лет) |
| VAL-005 | Cross-field — проверка связанных полей |

#### navigation.spec.ts `@critical`
| ID | Сценарий |
|----|----------|
| NAV-001 | Переход вперёд при валидных данных |
| NAV-002 | Блокировка перехода при ошибках валидации |
| NAV-003 | Переход назад с сохранением данных |
| NAV-004 | Индикатор шагов — отображение прогресса |

#### conditional-fields.spec.ts `@high`
| ID | Сценарий |
|----|----------|
| COND-001 | Ипотека — показ полей propertyValue, initialPayment |
| COND-002 | Автокредит — показ полей carBrand, carModel, carYear |
| COND-003 | Безработный — скрытие полей о работодателе |
| COND-004 | Адрес проживания = регистрации — скрытие дублирующих полей |

#### computed-fields.spec.ts `@high`
| ID | Сценарий |
|----|----------|
| COMP-001 | Расчёт ежемесячного платежа |
| COMP-002 | Расчёт процентной ставки по типу кредита |
| COMP-003 | Расчёт возраста по дате рождения |
| COMP-004 | Расчёт соотношения платёж/доход |

#### arrays.spec.ts `@high`
| ID | Сценарий |
|----|----------|
| ARR-001 | Добавление элемента в массив (созаёмщик) |
| ARR-002 | Удаление элемента из массива |
| ARR-003 | Валидация элементов массива |
| ARR-004 | Лимит элементов массива |

#### dependencies.spec.ts `@high`
| ID | Сценарий |
|----|----------|
| DEP-001 | Регион → города (загрузка справочника) |
| DEP-002 | Марка авто → модели (фильтрация) |
| DEP-003 | Тип занятости → обязательность полей |

#### accessibility.spec.ts `@a11y`
| ID | Сценарий |
|----|----------|
| A11Y-001 | Нет критических нарушений WCAG на каждом шаге |
| A11Y-002 | Фокус перемещается корректно при навигации |
| A11Y-003 | Ошибки валидации анонсируются screen reader |

#### visual.spec.ts `@visual`
| ID | Сценарий |
|----|----------|
| VIS-001 | Скриншот каждого шага формы |
| VIS-002 | Сравнение compound vs renderer (должны быть идентичны) |

#### performance.spec.ts `@perf`
| ID | Сценарий | Порог |
|----|----------|-------|
| PERF-001 | Время загрузки формы (TTI) | < 2000ms |
| PERF-002 | Время перехода между шагами | < 300ms |
| PERF-003 | Время отклика валидации при blur | < 100ms |
| PERF-004 | Время отправки формы | < 500ms |
| PERF-005 | Количество ре-рендеров при вводе текста | baseline ±10% |
| PERF-006 | Сравнение compound vs renderer (разница < 20%) | — |
| PERF-007 | Memory usage — нет утечек при навигации | baseline ±5% |

### Simple форма (/examples/simple)

| Категория | Приоритет | Описание |
|-----------|-----------|----------|
| Registration | High | Заполнение формы, async валидация, маска телефона |
| Behaviors | High | Behaviors в контексте простой формы |

### Validation страница (/examples/validation)

| Категория | Приоритет | Описание |
|-----------|-----------|----------|
| Built-in validators | High | required, email, date, age и др. |
| Custom validators | High | Пользовательские правила валидации |

### Behaviors страница (/examples/behaviors)

| Категория | Приоритет | Описание |
|-----------|-----------|----------|
| Reactive behaviors | High | Декларативные поведения полей |
| Conditional rendering | High | Условное отображение |

## Шаги реализации

### 1. Удалить старые тесты
- Удалить все файлы в `tests/credit-form/`
- Удалить `tests/form-array-delete.spec.ts`
- Сохранить `tests/fixtures/test-data.ts` как основу

### 2. Создать инфраструктуру

**Page Objects:**
- `tests/pages/BasePage.ts` — базовый класс с error tracking + a11y helpers
- `tests/pages/CreditFormPage.ts` — параметризованный POM с поддержкой variant
- `tests/pages/SimpleFormPage.ts` — POM для регистрации
- `tests/pages/ValidationPage.ts` — POM для валидации
- `tests/pages/BehaviorsPage.ts` — POM для behaviors

**Data & Mocks:**
- `tests/fixtures/builders/credit-form.builder.ts` — Data Builder для кредитной формы
- `tests/fixtures/builders/registration.builder.ts` — Data Builder для регистрации
- `tests/mocks/api.mocks.ts` — общий API mocking
- `tests/mocks/credit-application.mock.ts` — моки для кредитной заявки
- `tests/mocks/dictionaries.mock.ts` — моки справочников

**Shared:**
- `tests/shared/test-factory.ts` — fixtures + auto API mocking
- `tests/shared/a11y.ts` — accessibility helpers (axe-playwright)
- `tests/shared/performance.ts` — замеры TTI, FCP, action timing, memory

**Config:**
- Обновить `playwright.config.ts` — projects, retries, cross-browser

### 3. Написать тесты для complex-multy-step-form (запускаются на обоих вариантах)
- `happy-path.spec.ts` — HP-001, HP-002, HP-003
- `validation.spec.ts` — VAL-001..VAL-005
- `navigation.spec.ts` — NAV-001..NAV-004
- `conditional-fields.spec.ts` — COND-001..COND-004
- `computed-fields.spec.ts` — COMP-001..COMP-004
- `arrays.spec.ts` — ARR-001..ARR-004
- `dependencies.spec.ts` — DEP-001..DEP-003
- `accessibility.spec.ts` — A11Y-001..A11Y-003
- `visual.spec.ts` — VIS-001, VIS-002
- `performance.spec.ts` — PERF-001..PERF-007

### 4. Написать тесты для simple-form
- `registration.spec.ts` — заполнение, async валидация, маска телефона
- `accessibility.spec.ts` — базовые a11y проверки

### 5. Написать тесты для validation
- `validators.spec.ts` — built-in и custom валидаторы

### 6. Написать тесты для behaviors
- `behaviors.spec.ts` — reactive behaviors, conditional rendering

## Верификация

```bash
# === По проектам ===
# Compound components
npx playwright test --project='complex-multy-step-form'

# Renderer API
npx playwright test --project='complex-multy-step-form-renderer'

# Оба варианта
npx playwright test --project='complex-multy-step-form*'

# === По тегам ===
# Smoke (быстрый CI)
npx playwright test --grep @smoke

# Critical (PR CI)
npx playwright test --grep @critical

# Cross-browser critical
npx playwright test --project='complex-form:*'

# Accessibility
npx playwright test --grep @a11y

# Visual regression
npx playwright test --grep @visual

# Performance
npx playwright test --grep @perf

# === Полный набор ===
npx playwright test
```

## Дополнительные зависимости

```bash
npm install -D @axe-core/playwright  # Accessibility testing
```

Visual regression использует встроенный `expect(page).toHaveScreenshot()` из Playwright.

## Ключевые файлы для изменения

- [playwright.config.ts](projects/react-playground-e2e/playwright.config.ts)
- [CreditFormPage.ts](projects/react-playground-e2e/tests/pages/CreditFormPage.ts)
- [test-data.ts](projects/react-playground-e2e/tests/fixtures/test-data.ts)
