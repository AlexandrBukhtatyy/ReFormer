# Перенос обработчиков из реестра в render-behavior

## Context

Пример `registration-form-renderer-json` сейчас регистрирует обработчики событий как `reg.fn` в
реестре, а JSON-схема дёргает их через `$fn(...)`:

- `reg.fn('submit')`, `reg.fn('reset')` → кнопки: `"onClick": "$fn(submit)"` / `"$fn(reset)"`
- `reg.fn('loadPrefill')`, `reg.fn('applyPrefill')` → AsyncBoundary: `"load": "$fn(loadPrefill)"`,
  `"onSuccess": "$fn(applyPrefill)"`

Претензия (пользователь): реестр — это **словарь** «что рендерить» (компоненты, источники данных), а
обработчики событий — это **поведение**, им место в render-behavior. Оператор `$fn` в реестре ещё и
навязывает жёсткую привязку колбэка прямо в JSON-схеме.

Штатный механизм для этого уже есть и используется в эталонах — `onComponentEvent(node, event, handler)`
([render-behavior.ts:90](../../packages/reformer-renderer-react/src/core/render-behavior.ts#L90)),
он вешает колбэк на событие компонента по `selector` через `callbackRegistry`, «вместо жёсткого указания
в componentProps схемы» (его же JSDoc). Образец —
[complex-multy-step-form-renderer/render-behavior.ts:120](../../projects/react-playground/src/pages/examples/complex-multy-step-form-renderer/render-behavior.ts#L120)
(`onComponentEvent(schema.node('wizard'), 'onSubmit', …)`).

**Решение (выбор пользователя — «все обработчики»):** перенести все четыре обработчика из реестра в
render-behavior. Реестр становится чистым словарём: `reg.component(...)` + `reg.dataSource(SUBMIT_STATUS)`,
**ни одного `reg.fn`**.

### Ключевое следствие — уходит late-binding бойлерплейт

Сейчас `actions` строится пустыми заглушками и дозаполняется после `createForm`, потому что реестр
**замыкает** `actions` (через `reg.fn`), а форме нужен реестр — цикл `registry → actions → form`.
Когда `reg.fn` уходят, **реестр больше не зависит от `actions`**, цикл разрывается. Значит:

- `createRegistrationRegistry(ui)` — принимает только `ui` (для `statusText` и `PendingButton`), без `actions`;
- объект `actions` с заглушками и весь паттерн «дозаполнить позже» удаляются;
- `submit`/`reset`/`applyPrefill`/`loadPrefill` определяются как обычные `const` **после** `form` (он уже в scope);
- тип `FormActions` удаляется полностью (единственный потребитель был реестр).

То есть перенос не просто двигает код — он снимает целый слой бойлерплейта, который существовал только
ради обхода этого цикла.

## Почему это безопасно (проверено по коду)

- **Колбэки долетают с первого рендера.** `renderBehavior(proxy)` вызывается синхронно в `useMemo`
  ДО передачи proxy в `FormRenderer`
  ([json-form-renderer.tsx:160-176](../../packages/reformer-renderer-json/src/components/json-form-renderer.tsx#L160-L176)).
  Значит `callbackRegistry` заполнен `onComponentEvent`-ами до первого рендера дерева, и `load`
  долетит до AsyncBoundary сразу — self-managed режим включится с первого кадра (тот же путь, что уже
  работающий `onInit` для `form-state`).
- **Identity `load` стабильна.** `renderBehavior` мемоизируется, `callbackRegistry.set` выполняется
  один раз; при ре-рендерах `render-node` читает ту же функцию из Map, поэтому проп `load` по ссылке
  не меняется и AsyncBoundary не уходит в повторную загрузку.
- **e2e не завязаны на механизм** — тесты кликают по `data-testid` и проверяют наблюдаемое поведение;
  `data-testid` остаётся в `componentProps`, меняется только источник `onClick`.

## Изменения по файлам

### 1. `json-schema.json` — убрать `$fn` из компонентов

Убрать четыре ключа (остальные `componentProps` не трогать):

- `prefill-boundary` (root): удалить `"load": "$fn(loadPrefill)"` и `"onSuccess": "$fn(applyPrefill)"`
  (оставить `delayMs`, `loadingTitle`, `loadingSubtitle`, `errorTitle`, `retryLabel`).
- `submit-button`: удалить `"onClick": "$fn(submit)"` (оставить `type`, `data-testid`).
- `reset-button`: удалить `"onClick": "$fn(reset)"` (оставить `type`, `variant`, `data-testid`).

`selector` у всех трёх узлов уже есть — он и адресует ноду для `onComponentEvent`.

### 2. `registry.tsx` — реестр без `reg.fn` и без `actions`

- Сигнатура: `createRegistrationRegistry(ui: FormUiState)` — убрать параметр `actions`.
- Удалить: интерфейс `FormActions`, константу `INVITE_CODE`, все `reg.fn(...)` (loadPrefill/applyPrefill/
  submit/reset). `INVITE_CODE` и тело `loadPrefill` переезжают в `form-setup.ts` (см. ниже).
- Остаётся: `useSignalValue` + `createPendingButton`, `statusText` (computed), тело `defineRegistry`
  с `reg.component(...)` ×7 и `reg.dataSource('SUBMIT_STATUS', statusText)`.

### 3. `form-setup.ts` — линейная сборка + onComponentEvent

- Импорт `onComponentEvent` добавить к уже импортируемым `onInit`/`RenderBehaviorFn` из
  `@reformer/renderer-react`. Убрать импорт `FormActions` из `./registry`.
- Перенести `INVITE_CODE` сюда.
- В `createRegistrationSetup` убрать объект `actions`-заглушек и вызов `createRegistrationRegistry(actions, ui)` →
  `createRegistrationRegistry(ui)`. Порядок: `ui` → `registry(ui)` → `model` → `form` → `validationSchema`.
- Определить `submit`/`reset`/`applyPrefill` как `const` (тела без изменений — те же, что сейчас в
  `actions.*`), плюс `loadPrefill` (перенос из реестра; async `(signal) => fetch(prefill…)`).
- `renderBehavior` (инлайн-фабрика вместо отдельной `createRenderBehavior`) вешает всё:
  ```ts
  const renderBehavior: RenderBehaviorFn<RegistrationFormData> = (schema) => {
    onInit(schema.node('form-state'), () => schema.node('form-state').patchProps({ form }));
    onComponentEvent(schema.node('submit-button'), 'onClick', submit);
    onComponentEvent(schema.node('reset-button'), 'onClick', reset);
    onComponentEvent(schema.node('prefill-boundary'), 'onSuccess', applyPrefill);
    onComponentEvent(schema.node('prefill-boundary'), 'load', loadPrefill);
  };
  return { model, registry, renderBehavior };
  ```

`RegistrationFormRendererJson.tsx` не меняется (инвариант «в JSX только Provider + Renderer» сохранён).
Комментарий-манифест файлов в его шапке остаётся верным (5 файлов).

## Verification

1. `npx tsc --noEmit -p projects/react-playground/tsconfig.app.json` — 0 ошибок в каталоге примера
   (в т.ч. `FormActions` больше не резолвится нигде — признак полного удаления).
2. `npx eslint` по каталогу примера — чисто.
3. **Критично — загрузка префилла не зациклилась** (`load` теперь из callbackRegistry): прогнать
   страницу playwright'ом, посчитать запросы к `registration-prefill` — должно быть ровно 2
   (двойной маунт StrictMode), и не расти при ре-рендерах (ввод в поля).
4. `npx playwright test --project=registration-form-json` — все 11 зелёные, 3 прогона подряд
   (без флейков). Особое внимание к тестам: три состояния AsyncBoundary (loading/error/повтор →
   форма), submit-флоу, reset, disabled кнопок.
5. Ручной прогон через скриншоты (`.tmp/`): дефолтная загрузка префилла (RF-2026 → поля заполнены),
   404-ветка (`page.route` → error-state + «Повторить»), submit → «Регистрация успешна».
