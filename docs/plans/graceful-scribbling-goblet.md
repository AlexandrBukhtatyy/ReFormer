# Версии JSON-схем: оси `format` + `kits`, цепочка миграций, гейт кита, деградация

## Context

Микрофронтенды (МФ) пишут JSON-документы форм, а UI-кит и рендерер живут только в хосте. МФ
отстают от хоста по версии ReFormer, и документ МФ должен работать на обновлённом ките хоста.

Анализ показал, что сломать документ могут две вещи:
- грамматика документа: `format`, ключи узлов, операторы;
- словарь кита: имена и пропсы компонентов.

Для обеих нужна версия в документе и цепочка миграций. Хватает и уже реализованных частей
(`format: 2`, загрузчик и preflight в `@reformer/form-registry`), и дыр:
- `format: 3` молча перемаркировывается в 2;
- версии словаря кита нет;
- неизвестный компонент роняет форму;
- `degrade: 'placeholder'` объявлен, но не реализован.

**Решения пользователя:**
- Старые версии игнорируем: отсчёт с текущего состояния. Формат v1, его миграцию и таблицу
  `renamed-components.ts` не трогаем.
- Версия в документе — две оси: `format` (грамматика) и `kits` (контракт каждого кита отдельно).
- В первую итерацию входят механизм, гейт кита в CI и деградация `placeholder`.

## Правила версий

- **`format`**: текущий — `2` (`CURRENT_FORMAT`). Числовой формат больше текущего — отказ.
  Документ без поля идёт прежним путём, как сейчас.
- **`kits: { "<kitId>": <major> }`** — мажор контракта словаря каждого кита.
  - **Нет записи для кита = версия 1**: текущий каталог и есть версия 1. Все существующие
    документы валидны без правок.
  - Версия в документе меньше, чем у хоста, — цепочка шагов `N → N+1 → … → текущая`.
  - Версия равна хостовой — документ без изменений.
  - Версия больше хостовой — отказ.
  - Кит, которого хост не знает, — предупреждение.
- После апгрейда документ получает версии хоста. Повторный апгрейд ничего не делает.
- **Мажор контракта кита растёт только при ломающей правке поверхности.** Ломающие правки:
  - компонент удалён или переименован;
  - проп удалён или переименован;
  - сменился тип пропа;
  - из `enum` удалено значение;
  - сменилась роль компонента.

  Добавления — не ломающие.

## Этап 0 — задачи

- Завести в beads эпик и задачи этапов 1–3 плюс follow-up из раздела «Вне итерации».
- Работать по ним (`bd update --claim`).

## Этап 1 — типы и цепочка в ядре и renderer-json

- **`packages/reformer/src/form/kit-contract.ts`** (новый, только типы, экспорт из `@reformer/core`
  рядом с `ResolvedSchema` из `form-bundle.ts`).
  - Сюда, а не в renderer-json: ui-kit зависит от core, но не от renderer-json.
  - `KitContract { id: string; version: number; migrations: readonly KitMigrationStep[] }`.
  - `KitMigrationStep { from: number; to: number; description?: string; ops: readonly KitMigrationOp[] }`.
  - `KitMigrationOp` — операции-данные:
    - `renameComponent {from, to}`;
    - `renameProp {component, from, to}`;
    - `mapPropValue {component, prop, values}`;
    - `removeProp {component, prop}`;
    - `transform {component, run(node)}` — лазейка для случаев 1→N.
- **`packages/reformer-renderer-json/src/types/json-schema.ts`**: в `JsonFormSchema` поле
  `kits?: Readonly<Record<string, number>>`.
- **`src/schema/form-schema.schema.json`**: свойство `kits` (object, значения — integer ≥ 1).
  Корень закрыт `additionalProperties: false`, без этого документ со штампом не пройдёт проверку.
- **`src/upgrade/`** (новый, без React и ajv):
  - `apply-ops.ts` — применение операций по корню и `parts`. Обход «с запасом», как в
    `collect-operator-names.ts`: `$component(X)` переименовывается в любой позиции, включая
    вложенные узлы в `componentProps`. Операции над пропсами применяются к узлам с компонентом X.
  - `upgrade.ts`:
    - `upgradeJsonSchema(doc, { kits }) → { schema, applied: {kit, from, to, description}[] }`;
    - `SchemaVersionError { code: 'format-ahead' | 'kit-ahead' | 'missing-migration', … }`;
    - константа `CURRENT_FORMAT`;
    - кит из документа, неизвестный хосту, попадает в `unknownKits[]`, а не в исключение;
    - документ без `format` сначала проходит прежний `migrateJsonSchema` — путь не меняется.
- **`src/migrate.ts`**: числовой `format`, отличный от 2, — исключение вместо перемаркировки
  (`:75,151-155`). Единственная правка прежнего пути.
- **Реестр** (`src/registry/types.ts`, `component-registry.ts`):
  - `RegistryBuilder.kit(contract)`;
  - необязательный `ComponentRegistry.kits?(): readonly KitContract[]`;
  - `withParent`/`composeRegistries` сливают киты по `id` (побеждает последний);
  - `resolveSchema` вызывает `upgradeJsonSchema` перед `convertJsonSchema`. Тогда и хост без
    form-registry (`createForm({ schema, registry })`) получает миграции.
- **Экспорт** в `src/index.ts`.
- **Документация**: раздел `docs/llms/11-versioning.md` + пересборка `llms.txt` скриптом пакета.

## Этап 2 — ui-kit: контракт и гейт

- **`packages/reformer-ui-kit/src/contract/index.ts`**:
  `reformerUiKitContract: KitContract = { id: 'reformer-ui-kit', version: 1, migrations: [] }`.
  Чистые данные, без React.
- **Подпуть `./contract`**: фиксированная точка в `scripts/generate-exports.mjs` + entry в vite-конфиге.
  Проверка — `npm run check:subpaths`.
- **Снимок поверхности контракта** `contract/surface.v1.json`.
  - Строится из `component-catalog.json`: на компонент — имя и роль, на проп — тип и `enum`.
  - Описания и умолчания в снимок не входят.
  - Генератор — `scripts/contract-surface.ts`, команда `npm run contract:snapshot`.
  - Сам каталог не меняется, поэтому снимок `catalog-equivalence` в билдере не затронут.
- **Гейт** `src/contract/contract.test.ts` (vitest, CI уже гоняет `npm run test -w @reformer/ui-kit`):
  - Поверхность каталога сравнивается со снимком `surface.v{version}.json`.
    - Ломающая разница — тест падает со списком и инструкцией: поднять `version`, добавить шаг
      `N→N+1`, снять снимок `v{N+1}`.
    - Аддитивная разница — тест падает с подсказкой обновить снимок без подъёма версии.
  - Цепочка `migrations` непрерывна от 1 до `version`.
  - Операции шагов ссылаются на компоненты, которые есть в предыдущем снимке.
  - Функция сравнения поверхностей тестируется на фикстурах, а не правкой реального каталога.

## Этап 3 — form-registry: подключение и деградация

- **`packages/reformer-form-registry/src/loader.ts`**:
  - Реестр компонуется до разбора документа (сейчас — после `migrateJsonSchema`, `:199-205`).
  - Вместо `migrateJsonSchema` вызывается `upgradeJsonSchema(raw, { kits: registry.kits?.() ?? [] })`.
  - Обработка результата:
    - `SchemaVersionError` → `FormPreflightError` с новыми кодами `schema-ahead-of-host` и
      `missing-migration` (error);
    - применённые шаги → `onDiagnostic` с кодом `schema-upgraded` (warn): команда МФ видит, что отстаёт;
    - `unknownKits` → `unknown-kit` (warn).
- **Деградация `placeholder`**.
  - Политика: `entry.degrade ?? opts.degrade ?? 'error'`.
  - При `placeholder` недостающие имена из `collectOperatorNames(schema).components` регистрируются
    заглушками: `composeRegistries(registry, defineRegistry(reg => missing.forEach(n => reg.component(n, opts.placeholder(n)))))`.
  - Диагностика `degraded-components` (warn). Preflight после этого видит компоненты на месте.
  - Источники данных, функции и части по-прежнему дают ошибку.
  - Конвертер не меняется.
- **`src/preflight.ts`**: новые коды в объединении `PreflightProblem['code']`.
- **`src/react/placeholder.tsx`** (новый) — `createDegradedNode(name)`:
  - рисует `children`, поэтому контейнер со всем содержимым выживает;
  - ставит атрибут `data-reformer-degraded={name}` и показывает пометку в dev;
  - чужие пропсы в DOM не прокидывает.
- **`src/react/context.tsx`**: в `FormRegistryOptions` поля `degrade?` (умолчание для всех записей)
  и `placeholder?` (по умолчанию `createDegradedNode`).
- **`src/react/use-form-resource.ts`**: передаёт `degrade` и `placeholder` в `loadForm`.
- **`docs/llms/`** form-registry: разделы о версиях документа и о деградации, пересборка `llms.txt`.

## Вне итерации (follow-up задачи в beads)

- Штамп `kits` при создании документа: кодоген и `normalize.ts` билдера (при пересохранении поле
  может теряться) и `generate_form` в MCP. Пока версия 1, это не срочно: отсутствие поля = 1.
- `validateFormSchema({ kits })` — CI МФ сверяет документ с китами хоста.
- Набор контрактных тестов хоста: все схемы МФ → upgrade → validate → preflight → рендер.
- `requires.core` для кода МФ и гайд по политике депрекаций.

## Проверка

- **renderer-json** (`npm run test -w @reformer/renderer-json`):
  - текущий документ без `kits` проходит апгрейд без изменений;
  - синтетический контракт 1→2 с каждой операцией: фикстуры «до/после», включая `parts` и узлы
    внутри `componentProps`;
  - повторный апгрейд идемпотентен;
  - отказы: `format: 3` → `SchemaVersionError` (и `migrateJsonSchema` бросает), кит новее хоста
    → ошибка, пропущенный шаг → ошибка;
  - `composeRegistries` сливает киты;
  - `resolveSchema` применяет апгрейд.
- **ui-kit** (`npm run test -w @reformer/ui-kit`, `npm run check:subpaths -w @reformer/ui-kit`):
  - гейт зелёный на текущем каталоге;
  - сравнение поверхностей ловит ломающую и аддитивную разницу на фикстурах.
- **form-registry** (`npm run test -w @reformer/form-registry`):
  - диагностика `schema-upgraded`;
  - документ новее хоста → `FormPreflightError` с кодом `schema-ahead-of-host`;
  - `placeholder`: форма с неизвестным компонентом монтируется, у заглушки есть data-атрибут,
    остальные поля работают;
  - политика `error` ведёт себя как раньше.
- **Типы**: `npx tsc --noEmit` из каталога каждого затронутого пакета (core, renderer-json, ui-kit,
  form-registry), не из корня. `npm run lint`.
- **Smoke в react-playground**: debug-страница с `FormOutlet`.
  - Документ на «старой» версии синтетического кита рисуется после апгрейда.
  - Документ с неизвестным компонентом при `placeholder` — форма со стабом, при `error` — панель ошибки.
  - Скриншоты — в `projects/react-playground-e2e/screenshots/schema-versioning/`.
