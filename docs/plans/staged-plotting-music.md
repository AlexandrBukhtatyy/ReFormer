# План: живой рендер Wizard в preview билдера

## Context

В reformer-builder любой узел-визард в схеме (`$component(Wizard)`) в режиме **Renderer/preview**
показывает алармовый ворнинг «— компонент не зарегистрирован в preview»
([unknown-component.tsx:23](../../projects/reformer-builder/src/preview-runtime/unknown-component.tsx#L23)).

Причина: preview-реестр (`KNOWN_COMPONENTS`) и палитра строятся из одного `getCatalog()`. Визард
из ui-kit (`form-wizard`) намеренно исключён из ui-kit-каталога
([generate-catalog.ts:45](../../packages/reformer-ui-kit/scripts/generate-catalog.ts#L45), «form-* обрабатываются
билдером синтетически»), но билдер синтезирует только `FormArray`
([synthetic-entries.ts](../../projects/reformer-builder/src/catalog/synthetic-entries.ts)) — `Wizard` не синтезируется.
FormArray довели, FormWizard — нет. Пользователь выбрал: сделать **живой рендер, как у FormArray**
(в палитре + живой предпросмотр).

**Что уже работает и НЕ требует правок** (важно для оценки объёма):
- Модельный слой билдера уже понимает структуру визарда: `childSlots` отдаёт слот `steps` из
  `componentProps.steps` ([node-kind.ts:95-105](../../projects/reformer-builder/src/model/node-kind.ts#L95)),
  name-agnostic. Навигация ([query.ts](../../projects/reformer-builder/src/model/query.ts)), drop-в-steps
  ([resolve-drop.ts](../../projects/reformer-builder/src/dnd/resolve-drop.ts)), `activeStep`, `paths` — всё есть.
- `Step` уже рендерится живьём (сейчас как INFRA-имя через cdk `Step`).
- Рендерер уже конвертирует `componentProps.steps` в RenderNode-узлы и умеет `__selfManagedChildren`
  (инъекция `form` + сырые children).

Пробел ровно один: **имя визард-компонента не зарегистрировано в каталоге** → нет в палитре и в
preview-реестре. Нативного compound-пути для визарда (в отличие от массива) в рендерере нет, поэтому
визард обязан быть зарегистрированным `$component` роли `container`.

## Recommended approach

Зарегистрировать `Wizard` (и повысить `Step` до палитрового компонента) как синтетические записи
каталога билдера + дать `Wizard` живой preview-адаптер поверх ui-kit `FormWizard`.

Имя выбираем **`Wizard`** (совпадает с golden-схемой примера v20 `$component(Wizard)` и с формулировкой
задачи). Fixture `sample-schema.ts` использует `RendererFormWizard` — его НЕ трогаем, он остаётся
«unknown» (это тест-fixture, не user-facing), благодаря чему `unknown.test.ts`/`query.test.ts` не ломаются.

### 1. Синтетические записи каталога — [synthetic-entries.ts](../../projects/reformer-builder/src/catalog/synthetic-entries.ts)
Добавить в `syntheticRecords()` две записи (по образцу `FormArray`), обе `role: 'container'`,
`category: 'Мастер'`:
- `Wizard` — `propsSchema` с `className` (минимум; steps редактируются структурно на canvas).
- `Step` — `propsSchema` с `title` и `icon` (`x-doc` group `Control`), чтобы подпись/иконку шага
  можно было править в инспекторе при выделении шага.

### 2. `Step` из INFRA → каталог
Чтобы не было двойной регистрации ([agent-подтверждено]): убрать `'Step'` из `INFRA_NAMES`
([known-names.ts:21](../../projects/reformer-builder/src/preview-runtime/known-names.ts#L21)) и из
`INFRA_LOOKUP` ([known-components.ts:46-50](../../projects/reformer-builder/src/preview-runtime/known-components.ts#L46)).
`FormField`/`AsyncBoundary` остаются INFRA.

### 3. Preview-реестр — [known-components.ts](../../projects/reformer-builder/src/preview-runtime/known-components.ts)
В namespace `PREVIEW_UIKIT` (стр. 36-43) добавить два ключа, чтобы `classify` резолвил их как `live`
(правило имён для container: `PREVIEW_UIKIT[name]`):
- `Step: Step` (cdk `Step`, импорт уже есть — переиспользовать).
- `Wizard: WizardPreview` (новый адаптер из п.4).

### 4. Builder-адаптер визарда — новый файл `src/preview-runtime/wizard-preview.tsx`
Точный аналог [RendererFormWizard.tsx](../../projects/react-playground/src/components/RendererFormWizard.tsx),
но для data-only preview:
- FC: `form` берём из `props.form` (инъектится рендерером через `__selfManagedChildren`), fallback —
  `useRenderContext().form` (`@reformer/renderer-react`; provider даёт `JsonFormRenderer`).
- `props.steps` (уже сконвертированные RenderNode-узлы Step) → `FormWizardStep[]`: `number=idx+1`,
  `title`/`icon` поднять из `step.componentProps`, `body = step` (ui-kit `renderStepBody` увидит
  `.component` → отрисует через `RenderNodeComponent` → живые поля шага).
- `config = {}` (без валидации), `onSubmit = () => {}` (в preview submit — no-op).
- Рендерит ui-kit `FormWizard` (`@reformer/ui-kit/form-wizard`). Пометить
  `(WizardPreview as any).__selfManagedChildren = true`.

### 5. Дефолтные узлы — [make-node.ts](../../projects/reformer-builder/src/catalog/make-node.ts)
В `makeNodeFor` добавить ветки ПЕРЕД дефолтным `containerNode`:
- `Wizard` → `{ component:'$component(Wizard)', componentProps:{ steps:[ stepNode() ] } }` — **без ключа
  `children`** (иначе drop уходит в `children`, а не в `steps`) и **c одним посеянным шагом** (иначе
  слот `steps` не появится: `steps.some(isNodeLike)`).
- `Step` → `{ component:'$component(Step)', componentProps:{ title:'Шаг' }, children:[] }`.

## Тесты

Существующие проходят без правок (проверено против кода):
- `render-policy.test.ts` — гвардит только allowlist'ы; `Wizard`/`Step` туда не добавляем.
- `registry-drift.test.ts`, `known-names`/`unknown.ts` — автоадаптируются от `getCatalog()`.
- `unknown.test.ts` (`['RendererFormWizard']`) и `query.test.ts` (`Step` в components) — `Step`
  остаётся known (теперь через каталог), `RendererFormWizard` остаётся unknown → зелёные.
- `contract.test.ts`/`catalog.test.ts` — `Wizard`/`Step` роль `container` валидны; `kindOf(makeNode())`
  для обоих = `container` = role.

Добавить (новый небольшой тест): в `known-components.test`/новом спеке проверить, что
`classifyCatalog()` помечает `Wizard` и `Step` как `policy:'live'` (агент отметил, что `render-policy.test`
НЕ гарантирует резолв — закрываем этот пробел явной проверкой).

Перед реализацией: `grep` на пин `INFRA_NAMES`/`'Step'` в тестах preview-runtime — убедиться, что нет
теста, жёстко фиксирующего состав INFRA (если есть — поправить под новый состав).

## Verification (end-to-end)

1. `npm test` в `projects/reformer-builder` (vitest) — все спеки зелёные.
2. `npx tsc -b --noEmit` в `projects/reformer-builder` — без новых ошибок (в `html-tags.test.ts` есть
   предсуществующие, к правке не относятся).
3. Live-проверка в браузере (dev-сервер вне sandbox: `npm run dev`, playwright MCP):
   - Открыть билдер, через палитру/QuickAdd вставить `Wizard`, переключиться в режим **Renderer**.
   - Ожидаемо: живой ui-kit FormWizard (индикатор шагов + навигация Назад/Далее), без амбер-ворнинга,
     консоль чистая (нет «не зарегистрирован», нет «Too many re-renders»).
   - Выделить шаг → в инспекторе редактируются `title`/`icon`. Добавить поле в шаг (QuickAdd при
     выделенном Step) → поле появляется в теле шага в preview.
   - Скриншот before/after в `projects/react-playground-e2e/screenshots/wizard-preview/`.

## Out of scope (возможные follow-up)

- Алиасы `RendererFormWizard`/`FormWizard` на тот же адаптер (если понадобится рендерить другие
  wizard-схемы) — тривиально добавить, но потребует правки `unknown.test.ts`/`query.test.ts`.
- Спец-логика инспектора «добавить/удалить шаг» кнопкой (сейчас шаги добавляются перетаскиванием
  Step в слот steps или дублированием ⌘D).
