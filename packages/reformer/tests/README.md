# Тесты @reformer/core

Все тесты пакета ядра. План доработки покрытия — `docs/plans/core-tests-coverage.md`.

## Каталоги

Структура `tests/` не зеркалит `src/` целиком; соответствие слоёв:

```
tests/
├── behaviors/        # поведение формы                 → src/form/behaviors/
├── core/
│   ├── flow/         # поток шагов                     → src/form/flow/
│   ├── model/        # модель данных                   → src/model/
│   ├── nodes/        # ноды формы и модули состояния   → src/form/nodes/
│   ├── utils/        # смешанный: сборка, схема, derived-registry, safe-effect
│   ├── validation/   # раннер, стратегии, области      → src/form/validation/
│   └── validators/   # правила                         → src/form/validators/
├── hooks/            # React-хуки (DOM)                → src/platforms/react/hooks/
├── i18n/             # локализация                     → src/i18n/, src/platforms/react/i18n/, src/locale/
├── integration/      # сквозные сценарии на синтетической сложной форме
├── meta/             # мета-тесты: каждый it.fails закреплён за открытой задачей beads
├── model/            # сабпат @reformer/core/model против собранного dist
├── types/            # сквозные compile-time проверки (*.type-test.ts)
└── test-utils/       # общие помощники — см. test-utils/README.md
```

Тесты рядом с исходником: `src/**/*.type-test.ts` (проверяет `tsc`) и
`src/platforms/react/field-binding/field-binding.test.tsx`.

## Окружения

- **node** — по умолчанию.
- **happy-dom** — React-хуки и провайдеры, которым нужны эффекты, монтаж и размонтирование.
  Первая строка файла — `// @vitest-environment happy-dom`; в теле — `afterEach(cleanup)` из
  `test-utils/react` (глобалов vitest в пакете нет, автоочистка testing-library сама не включится).
  Помощники: `renderHookCounting` (счётчик рендеров), `StrictWrapper`.
- Серверный рендер (`renderToStaticMarkup`) и мок React (`tests/hooks/useFormControl-*.test.ts`)
  остаются для дешёвых проверок без DOM.

## Имена и соглашения

- Файл — kebab-case по исходнику: `<модуль>.test.ts`, темы — суффиксом: `form-array-node-keys.test.ts`.
- Суффиксы видов: `.property.test.ts` (fast-check), `.snapshot.test.ts` (снапшоты),
  `.dom.test.tsx` — DOM-вариант рядом с node-близнецом.
- Шапка — русский JSDoc «что проверяется и почему»; `describe('<модуль> — <тема>')`.
- Импорт из `vitest` явный; исходники — относительным путём `../../src/...`; помощники — явным путём
  `test-utils/<модуль>` без barrel.
- Каждый тест собирает свою форму: ключи строк массивов (`rowKey`) и кэши раннера — модульные,
  общие сборки между тестами дают зависимость от порядка.
- Отложенные записи поведения (`defer`, `runOutsideEffect`) — `await tick()` / `settle()`
  из `test-utils/async`; `debounce` — `useFakeClock()` + `advance(ms)`; async-правило под контролем
  теста — `deferred()`. С фейковыми часами `waitFor` testing-library не использовать.

## Виды тестов

- **Property-based** (fast-check): параметры — `propertyParams()` из `test-utils/property`.
  Воспроизведение упавшего случая: `FC_SEED=<seed> FC_NUM_RUNS=1000 npx vitest run <файл>`.
- **Снапшоты**: обновление — `npx vitest run -u <файл>` из каталога пакета; в CI новые снапшоты не
  пишутся, расхождение — падение.
- **Type-тесты**: `*.type-test.ts` с `expectTypeOf` / `@ts-expect-error — причина`. Их исполняет
  `tsc` — `npm run typecheck` пакета (`tsconfig.json` + `tsconfig.tests.json`, второй проверяет и
  `tests/`), в CI — корневой `npm run typecheck`. Vitest их не запускает.
- **Утечки**: `test-utils/effect-tracker` считает живые effect'ы (`vi.mock('@preact/signals-core')`,
  см. шапку модуля); после dispose / размонтирования число возвращается к исходному.

## Найденные дефекты

Тест вскрыл дефект — заводится задача bd, её id — в названии теста. Маленький дефект чинится
в том же этапе отдельным коммитом. Крупный или спорный — `it.fails('… [ReFormer-xxxx]', …)` с
одним точным утверждением: тест покраснеет, когда дефект починят, и станет обычным `it`.

## Запуск

Из `packages/reformer`:

```bash
npm test                          # все тесты (обёртка scripts/run-vitest.mjs — vitest#8766)
npm test -- form-level            # файлы по подстроке имени
npm run test:watch
npm run coverage                  # покрытие + агрегатные пороги + минимум на файл
npm run typecheck                 # tsc по src и tests
```

## Покрытие

Гейт двухуровневый, оба уровня — в `npm run coverage` (в CI — шаг «Tests and coverage gate»):

- агрегатные пороги — `coverage.thresholds` в `vitest.config.ts`, храповик: после этапа плана
  поднимаются до замера минус 1–2 п.п., в комментарии — дата и замер;
- минимум на файл — `coverage.per-file.json` (строки ≥ 80, ветви ≥ 70), проверяет
  `scripts/check-coverage-per-file.mjs` по отчёту `coverage/coverage-summary.json`. Ловит новый
  модуль без тестов, которого агрегат не замечает. Файлы без исполняемых строк не оцениваются.
  Исключение — `{ file, reason, issue, lines?, branches? }`, только с причиной и задачей bd;
  ненужное исключение (файл проходит минимум, его нет в отчёте) — тоже ошибка.
