# План: ENV-переменная для замеров производительности в e2e

## Context

В `projects/react-playground-e2e/tests/shared/performance.ts` уже написан
набор утилит (`measurePerformance`, `getPerformanceTiming`, `measureAction`,
`getMemoryUsage`, `createPerformanceReport`, `measureRenderCount`), но они
**никем не используются**: единственные замеры в e2e выполняются через
`Date.now()` внутри `performance.spec.ts`, метрики не агрегируются и никуда
не экспортируются.

Задача:

1. Встроить замеры в **все e2e сценарии** (happy-path, validation, navigation
   и т.д.), чтобы на реальных пользовательских путях собирались метрики
   ключевых действий (`goto`, `fillStepN`, `goToNextStep`, `submitForm`,
   Web Vitals в конце теста).
2. Сделать замеры **опциональными** через ENV-переменную — по умолчанию
   отключены, чтобы не тормозить обычные прогоны; включаются только при
   целевом запуске.
3. При включённом флаге писать результаты в **JSON-файл**
   (`test-results/perf/*.jsonl` + итоговый `perf-summary.json`) и
   **печатать отчёт в консоль** через существующий `createPerformanceReport`.

Переменная — `PERF_ENABLED` (аналогично уже существующим `E2E_PORT` /
`E2E_BASE_URL` в [playwright.config.ts](projects/react-playground-e2e/playwright.config.ts)).

## Подход

**Ключевое решение**: добавить в test-fixture коллектор `perf`, который в
disabled-режиме имеет **нулевой overhead** (методы — no-op), а в
enabled-режиме — проксирует вызовы в `measureAction` и агрегирует результаты
в per-worker NDJSON-файл. Сборка в единый summary выполняется кастомным
Playwright Reporter в `onEnd`.

Альтернативу с декорированием POM через Proxy **отклоняю** — это
непрозрачно и ломает типы; явные обёртки в POM-методах проще читать.

## Изменения

### 1. Новый файл: `tests/shared/performance-collector.ts`

Класс `PerformanceCollector` — стабильное API для fixture и POM:

```ts
export interface CollectedAction {
  name: string;
  duration: number;
  startTime: number;
}

export class PerformanceCollector {
  readonly enabled: boolean;
  private actions: CollectedAction[] = [];

  constructor(
    private page: Page,
    private testInfo: TestInfo
  ) {
    this.enabled = process.env.PERF_ENABLED === 'true';
  }

  async measure<T>(name: string, action: () => Promise<T>): Promise<T> {
    if (!this.enabled) return action(); // быстрый путь
    const m = await measureAction(this.page, name, action);
    this.actions.push({ name, duration: m.duration, startTime: m.startTime });
    return m.result;
  }

  async flush(): Promise<void> {
    if (!this.enabled) return;
    // собираем webVitals, timing, memory через shared/performance.ts
    // append-пишем строку в test-results/perf/worker-${workerIndex}.jsonl
    // печатаем createPerformanceReport() в console.log
  }
}
```

Использует существующие функции из
[shared/performance.ts](projects/react-playground-e2e/tests/shared/performance.ts)
— переиспользуем, а не дублируем.

### 2. Новый файл: `tests/shared/performance-reporter.ts`

Кастомный Playwright Reporter
([docs](https://playwright.dev/docs/api/class-reporter)):

- `onTestEnd` — no-op (уже записано в jsonl через `flush`)
- `onEnd` — читает все `test-results/perf/worker-*.jsonl`, сливает в
  `test-results/perf-summary.json` с сортировкой по testId и агрегатами
  (min/max/avg duration по названию action).

Регистрируется в
[playwright.config.ts](projects/react-playground-e2e/playwright.config.ts)
через `reporter`, **активен только при `PERF_ENABLED=true`** (проверка
внутри reporter-а — no-op при выключенном флаге).

### 3. Модификация: `tests/shared/test-factory.ts`

Добавить в [TestFixtures](projects/react-playground-e2e/tests/shared/test-factory.ts#L15):

```ts
export interface TestFixtures {
  creditForm: CreditFormPage;
  mockApis: MockApisFixture;
  perf: PerformanceCollector; // ← новая
}
```

Fixture `perf` с auto-teardown:

```ts
perf: async ({ page }, use, testInfo) => {
  const collector = new PerformanceCollector(page, testInfo);
  await use(collector);
  await collector.flush();   // после теста — сразу в файл и консоль
},
```

Fixture `creditForm` — пробросить коллектор в POM через опции:

```ts
creditForm: async ({ page, perf }, use, testInfo) => {
  const creditForm = new CreditFormPage(page, { ..., perf });
  await use(creditForm);
},
```

### 4. Модификация: POM-классы

Затрагиваются:

- [credit-form-page.pom.ts](projects/react-playground-e2e/tests/pages/complex-multy-step-form/credit-form-page.pom.ts) — главный
- [simple-form-page.pom.ts](projects/react-playground-e2e/tests/pages/simple-form/simple-form-page.pom.ts)
- [behaviors-page.pom.ts](projects/react-playground-e2e/tests/pages/behaviors/behaviors-page.pom.ts)
- [validation-page.pom.ts](projects/react-playground-e2e/tests/pages/validation/validators-page.pom.ts)

В конструкторе принять `perf?: PerformanceCollector` (опционально — для
совместимости с `createVariantTest` и прямыми new в `behaviors.spec.ts`).

Обернуть **только ключевые action-методы** через `this.perf?.measure(...)`:

- `goto()` → `'goto'`
- `fillStep1ConsumerLoan / Mortgage / CarLoan` → `'fillStep1'`
- `fillStep2PersonalData`, `fillStep3ContactInfo`, `fillStep4Employment`,
  `fillStep5AdditionalInfo`, `fillStep6Confirmation` → соответствующие имена
- `goToNextStep`, `goToPreviousStep`, `goToStep` → `'nav.next'` / `'nav.prev'` / `'nav.step'`
- `submitForm` → `'submit'`
- Остальные `fill*`, `select*`, `toggle*`, `accept*` — **не оборачиваем**
  (слишком гранулярно, замусорит отчёт)

Пример обёртки:

```ts
async goto(options?: { disableMsw?: boolean }): Promise<void> {
  await (this.perf?.measure('goto', () => this._gotoImpl(options))
       ?? this._gotoImpl(options));
}
private async _gotoImpl(options?: { disableMsw?: boolean }): Promise<void> {
  /* существующая реализация */
}
```

В disabled-режиме `perf.measure` сразу зовёт `action()` без оверхеда
(проверка `this.enabled` в начале).

### 5. Модификация: `playwright.config.ts`

- Зарегистрировать `performance-reporter` в массиве reporter-ов (в обеих
  ветках — CI и local).
- Добавить константу `PERF_ENABLED` рядом с существующими
  [`E2E_PORT`/`E2E_BASE_URL`](projects/react-playground-e2e/playwright.config.ts#L9-L10).
- Передавать через `use.extraHTTPHeaders` не нужно — коллектор читает
  `process.env` напрямую.

### 6. Модификация: `package.json`

Добавить скрипт + зависимость `cross-env` (для кросс-платформенной работы
на Windows, без неё `PERF_ENABLED=true ...` не работает в cmd/PowerShell):

```json
"scripts": {
  "test:e2e:perf": "cross-env PERF_ENABLED=true playwright test",
  "test:e2e:perf:smoke": "cross-env PERF_ENABLED=true playwright test --grep=@smoke"
},
"devDependencies": {
  "cross-env": "^7.0.3"
}
```

Либо (альтернатива без новой зависимости) — отдельный Playwright **project**
`perf-smoke` в конфиге, где `PERF_ENABLED` выставляется в `use.launchOptions.env`.
Но cross-env — стандарт де-факто в npm-экосистеме, и проще поддерживать.

## Критические файлы

- [playwright.config.ts](projects/react-playground-e2e/playwright.config.ts) — регистрация reporter, константа `PERF_ENABLED`
- [tests/shared/test-factory.ts](projects/react-playground-e2e/tests/shared/test-factory.ts) — fixture `perf`
- [tests/shared/performance.ts](projects/react-playground-e2e/tests/shared/performance.ts) — переиспользуем (без изменений)
- [tests/shared/performance-collector.ts](projects/react-playground-e2e/tests/shared/performance-collector.ts) — **новый**
- [tests/shared/performance-reporter.ts](projects/react-playground-e2e/tests/shared/performance-reporter.ts) — **новый**
- [tests/pages/complex-multy-step-form/credit-form-page.pom.ts](projects/react-playground-e2e/tests/pages/complex-multy-step-form/credit-form-page.pom.ts) — обёртки ключевых методов
- [tests/pages/simple-form/simple-form-page.pom.ts](projects/react-playground-e2e/tests/pages/simple-form/simple-form-page.pom.ts), [tests/pages/behaviors/behaviors-page.pom.ts](projects/react-playground-e2e/tests/pages/behaviors/behaviors-page.pom.ts), [tests/pages/validation/validation-page.pom.ts](projects/react-playground-e2e/tests/pages/validation/validation-page.pom.ts) — по ключевым методам
- [package.json](projects/react-playground-e2e/package.json) — скрипты и `cross-env`

Сами `.spec.ts` **не трогаем** — это ключевой плюс подхода, изменения
прозрачны для существующих тестов.

## Verification

Руками:

1. **Disabled (дефолт)**: `npm run test:e2e --prefix projects/react-playground-e2e -- --grep=@smoke`
   — тесты проходят как раньше, директории `test-results/perf/` нет,
   `perf-summary.json` не появляется.
2. **Enabled**: `npm run test:e2e:perf:smoke --prefix projects/react-playground-e2e`
   — в конце прогона:
   - в консоли виден отчёт `=== Performance Report ===` для каждого теста
   - файл `test-results/perf-summary.json` содержит массив записей с
     `testId`, `duration`, `actions[]`, `webVitals`
   - файлы `test-results/perf/worker-*.jsonl` существуют и читабельны

Автоматически (опционально):

3. Добавить unit-тест на `PerformanceCollector`: при `PERF_ENABLED !== 'true'`
   метод `measure` не делает `page.evaluate` (mock `page`, проверить что
   `evaluate` не вызвался ни разу).

4. Проверить идемпотентность: повторный запуск перезаписывает
   `perf-summary.json`, старые `.jsonl` очищаются в `onBegin` reporter-а.
