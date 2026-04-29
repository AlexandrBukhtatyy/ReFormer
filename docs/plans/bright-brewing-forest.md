# План: Path C — унификация UI в `@reformer/ui-kit` через polymorphic props (без правок renderer-react)

## Context

В `projects/react-playground/src/pages/examples/complex-multy-step-form/components/ui/` лежат wrapper-компоненты поверх headless-примитивов из `@reformer/cdk` и `@reformer/renderer-react`. Сейчас существуют **парные варианты**: `FormWizard` ⊕ `RendererFormWizard`, `FormArraySection` ⊕ `RendererFormArraySection`. Дилемма «какой брать» появляется каждый раз: TS-flow vs renderer-flow требуют разную форму `itemComponent`/`step.component` (FC vs node-factory).

**Главный gap:** `packages/reformer-ui-kit/package.json` уже декларирует exports `./form-wizard` и `./form-array` (строки 14-25), но файлов нет. Iter-7 показал последствия — Patch G hierarchy A1 («ui-kit FormWizard exists → используй») всегда обрывается, sub-agent'ы сваливаются на A3 и изобретают свой wizard каждый раз.

**User decisions:**
- Renderer-* компоненты идут в ui-kit (добавляем `@reformer/renderer-react` в peerDependencies).
- Domain-coupled (`ConfirmationComponents`, `ResidenceAddressSection`, `UnemployedWarning`) остаются в complex-multy-step-form.
- **Унификация Path C** — единый prop с runtime polymorphism. Renderer-react **не трогаем**. Дискриминация выполняется внутри ui-kit-компонентов.

Цели:
1. Унифицировать API: один `FormArraySection` + один `FormWizard` в ui-kit с **единым** prop-shape.
2. Закрыть declared-but-missing exports `./form-wizard`, `./form-array`, добавить `./state`.
3. Сделать A1 в Patch G реальным дефолтом для ui-kit-стеков.
4. Дедуплицировать complex-* + iter-7 v7 (через shim).

## Унифицированный API (Path C)

### `FormArraySection<T>` — один itemComponent

```ts
import type { ComponentType } from 'react';
import type {
  FormProxy, FormArrayProxy, ArrayNode, FieldPathNode, FormFields,
} from '@reformer/core';
import type { FieldWrapperProps } from '@reformer/renderer-react';

interface FormArraySectionProps<T extends FormFields> {
  /** Резолвится автоматически: FormArrayProxy / уже-резолвленный ArrayNode / FieldPathNode из RenderSchema. */
  control: FormArrayProxy<T> | ArrayNode<T> | FieldPathNode<unknown, unknown>;

  /** React FC получает control: FormProxy<T> для каждого элемента массива. ЕДИНСТВЕННЫЙ shape. */
  itemComponent: ComponentType<{ control: FormProxy<T> }>;

  title?: string;
  itemLabel?: string | ((control: FormProxy<T>, index: number) => string);
  addButtonLabel?: string;        // default '+ Добавить'
  removeButtonLabel?: string;     // default 'Удалить'
  emptyMessage?: string;
  emptyMessageHint?: string;
  hasItems?: boolean;
  initialValue?: Partial<FormFields>;
  maxItems?: number;
  showRemoveOnSingle?: boolean;
  className?: string;
  cardClassName?: string;

  // Auto-injected by RenderNodeComponent (self-managed marker)
  form?: FormProxy<unknown>;
  fieldWrapper?: ComponentType<FieldWrapperProps>;
}
```

**Внутри:**
- `resolveArrayNode(control, form)` — из app-level [`RendererFormArraySection.tsx:136-177`](../../projects/react-playground/src/components/RendererFormArraySection.tsx#L136-L177): резолвит `FieldPathNode → ArrayNode<T>` через `FieldPathNavigator + extractPath`. Принимает уже-резолвленный `ArrayNode/FormArrayProxy` без изменений.
- Для каждого item: `<ItemComponent control={itemForm} />` — прямой JSX. Никакого `RenderNodeComponent`, никакого `(itemPath) => RenderNode` factory.
- `__selfManagedChildren = true` — гарантирует автоинъекцию `form` + `fieldWrapper` от родителя-renderer'а.

### `FormWizard<T>` — polymorphic body

```ts
import type { ComponentType, ReactNode } from 'react';
import type { FormProxy } from '@reformer/core';
import type { RenderNode } from '@reformer/renderer-react';

type FormWizardStepBody<T> =
  | ComponentType<{ control: FormProxy<T> }>   // FC получает control={form}
  | ReactNode                                    // готовый JSX
  | RenderNode<T>;                               // RenderSchema subtree

type FormWizardStep<T> = {
  number: number;
  title: string;
  icon?: ReactNode;
  body: FormWizardStepBody<T>;
};

interface FormWizardProps<T extends object> extends FormWizardHeadlessProps<T> {
  steps: FormWizardStep<T>[];
  onSubmit: FormWizardActionsProps['onSubmit'];
  className?: string;
}
```

**Внутри (runtime-дискриминация):**
```ts
function renderStepBody<T>(body: FormWizardStepBody<T>, form: FormProxy<T>): ReactNode {
  // FC (function component, не React element)
  if (typeof body === 'function') {
    const FC = body as ComponentType<{ control: FormProxy<T> }>;
    return <FC control={form} />;
  }
  // RenderNode (plain object с .component) — отличаем от React element
  if (body && typeof body === 'object' && 'component' in body && !isValidElement(body)) {
    return <RenderNodeComponent node={body as RenderNode<T>} form={form} />;
  }
  // ReactNode (готовый JSX)
  return body as ReactNode;
}
```

**Compound API:** `Object.assign(FormWizard, { Indicator, Step, Actions, Progress })` через re-export `FormWizardHeadless.*` слотов.

`__selfManagedChildren = true` — для использования внутри RenderSchema.

## Renderer-json — minor patch для `$template` в itemComponent позиции

`packages/reformer-renderer-json/src/converter/json-to-render-schema.ts`: добавить логику резолва `itemComponent` (или любого `*Component` field):

1. **Если string** (`"itemComponent": "PropertyForm"`):
   - Lookup в registry → FC. Передаём в ui-kit как `ComponentType<{ control }>`.

2. **Если object с `$template`** (`"itemComponent": { "$template": {...} }`):
   - Конвертируем в FC-обёртку:
     ```ts
     const wrapperFC: FC<{ control: FormProxy<T> }> = ({ control }) => {
       const schema = createRenderSchema(() => templateNode);
       return <FormRenderer form={control} render={schema} />;
     };
     ```
   - Передаём в ui-kit как FC.

3. **Иначе** (raw FC reference, через registry-source) — passthrough.

**Это сохраняет JSON-flexibility:** consumer может писать inline subtree через `$template` ИЛИ ссылку на registry-FC по имени. ui-kit видит единственный FC-shape всегда.

Тест:
```jsonc
// 1. Registry name
{ "component": "FormArraySection", "componentProps": { "itemComponent": "PropertyForm" } }
// 2. Inline $template
{ "component": "FormArraySection", "componentProps": {
  "itemComponent": { "$template": { "component": "Section", "children": [...] } }
}}
```
Оба варианта на выходе — `ComponentType<{ control: FormProxy<Property> }>`.

## Что мигрируется (8 файлов → 7 в ui-kit, дубли удаляются)

| Источник | Целевой путь в `packages/reformer-ui-kit/src/` | Что делаем |
|---|---|---|
| `complex-form/components/ui/ErrorState.tsx` | `components/state/error-state.tsx` | Импорт `Button` сделать относительным. |
| `complex-form/components/ui/LoadingState.tsx` | `components/state/loading-state.tsx` | as-is. |
| `complex-form/components/ui/FormWizzard/FormWizardActions.tsx` | `components/form-wizard/form-wizard-actions.tsx` | Хардкод-строки на 31/35/39 → опциональные props (`prevLabel`, `nextLabel`, `submitLabel`, `validatingLabel`, `submittingLabel`) с Russian-дефолтами. |
| `complex-form/components/ui/FormWizzard/FormWizardProgress.tsx` | `components/form-wizard/form-wizard-progress.tsx` | `combineClasses` → `cn` из ui-kit `lib/utils`. Prop `format?: (p) => ReactNode` с Russian-дефолтом. |
| `complex-form/components/ui/FormWizzard/StepIndicator.tsx` | `components/form-wizard/step-indicator.tsx` | Aria-строки на 30/44 → props `navAriaLabel?`, `stepAriaLabel?` с Russian-дефолтами. |
| `complex-form/components/ui/FormWizzard/FormWizard.tsx` + `RendererFormWizard.tsx` | `components/form-wizard/form-wizard.tsx` (один файл) | **Слияние:** базовая структура + полиморфный `step.body` через `renderStepBody()` helper. Внутри ветка для RenderNode использует `RenderNodeComponent`. Generic по `T`, без `CreditApplicationForm`. `__selfManagedChildren = true`. Compound API. |
| `complex-form/components/ui/FormArray/FormArraySection.tsx` + app-level `components/RendererFormArraySection.tsx` | `components/form-array/form-array-section.tsx` (один файл) | **Слияние:** берём app-level версию (`maxItems`, `showRemoveOnSingle`, `initialValue` plain-leaves, `resolveArrayNode`). Заменяем `(itemPath) => RenderNode` API на единственный `itemComponent: ComponentType<{ control }>`. Items рендерятся как `<ItemComponent control={itemForm}/>`. `__selfManagedChildren = true`. |

**Удаляются** (после миграции consumer-ов):
- `complex-form/components/ui/FormWizzard/{FormWizard,RendererFormWizard,StepIndicator,FormWizardActions,FormWizardProgress}.tsx`.
- `complex-form/components/ui/FormArray/{FormArraySection,RendererFormArraySection}.tsx`.
- `complex-form/components/ui/{ErrorState,LoadingState}.tsx`.

**Shim:** `projects/react-playground/src/components/RendererFormArraySection.tsx` → адаптер для iter-7 v7-страниц. v7 ожидает старый API `itemComponent: (itemPath) => RenderNode<T>`. Внутри shim:
```ts
import { FormArraySection } from '@reformer/ui-kit/form-array';

export function RendererFormArraySection<T>(props: { itemComponent: (itemPath) => RenderNode<T>; ... }) {
  // Преобразуем node-factory в FC-обёртку
  const itemFC: FC<{ control: FormProxy<T> }> = ({ control }) => {
    const itemPath = createFieldPath<T>();
    const node = props.itemComponent(itemPath);
    return <RenderNodeComponent node={node} form={control} />;
  };
  return <FormArraySection {...props} itemComponent={itemFC} />;
}
```
Iter-7 страницы продолжают работать без изменений.

**Не трогаем:** `ConfirmationComponents.tsx`, `ResidenceAddressSection.tsx`, `UnemployedWarning.tsx`.

## Структура целевого пакета

```
packages/reformer-ui-kit/src/
├── components/
│   ├── ui/                          # существующие 14 leaf-компонентов
│   ├── form-wizard/                 # NEW
│   │   ├── form-wizard.tsx          # унифицированный (полиморфный body)
│   │   ├── form-wizard-actions.tsx
│   │   ├── form-wizard-progress.tsx
│   │   ├── step-indicator.tsx
│   │   └── index.ts
│   ├── form-array/                  # NEW
│   │   ├── form-array-section.tsx   # унифицированный (FC itemComponent)
│   │   └── index.ts
│   └── state/                       # NEW
│       ├── error-state.tsx
│       ├── loading-state.tsx
│       └── index.ts
└── index.ts
```

## Изменения в инфраструктуре

**`packages/reformer-ui-kit/package.json`:**
- `peerDependencies`: добавить `"@reformer/renderer-react": ">=1.0.0-beta.0"`.
- `devDependencies`: `"@reformer/renderer-react": "*"`.
- `exports`: добавить `"./state"` (form-wizard и form-array уже задекларированы).

**`packages/reformer-ui-kit/vite.config.ts`:**
- Entry-points: `'form-wizard'`, `'form-array'`, `'state'`.
- `rollupOptions.external`: `'@reformer/renderer-react'`.

## Renderer-react

**НЕ ТРОГАЕМ.** Никаких изменений в `types.ts`, `render-node.tsx`, `utils.ts`. Никакого SemVer impact.

## Порядок фаз

1. **Phase 0 — ui-kit infra:** package.json + vite.config.ts.
2. **Phase 1 — state листья:** ErrorState, LoadingState (smoke-test пайплайна).
3. **Phase 2 — wizard cluster:** Actions, Progress, StepIndicator → унифицированный FormWizard с polymorphic `body`.
4. **Phase 3 — form-array:** унифицированный FormArraySection с FC `itemComponent`.
5. **Phase 4 — renderer-json converter:** patch для `$template` → FC в `*Component` слотах + registry-name string resolve. Тесты.
6. **Phase 5 — миграция consumer-ов** + удаление старых файлов + shim для v7.
7. **Phase 6 — MCP prompt G + llms-доки.**
8. **Phase 7 — verification.**

## Consumer migration

`projects/react-playground/src/pages/examples/complex-multy-step-form-renderer/render-schema.ts` (строки 20-36):
- Старое: `<RendererFormWizard steps={[{ ..., component: someRenderNode }]}>` — где `someRenderNode` это RenderNode subtree.
- Новое: `<FormWizard steps={[{ ..., body: someRenderNode }]}>` from `@reformer/ui-kit/form-wizard`. Тот же RenderNode subtree, поле переименовано `component` → `body`.
- Старое: `<RendererFormArraySection itemComponent={(itemPath) => itemRenderNode}>` — node-factory.
- Новое: items должны стать FC. Один из путей:
  - **Inline FC обёртка:** `itemComponent={(props) => <FormRenderer form={props.control} render={() => itemRenderNode}/>}`.
  - **Lift item в отдельный FC:** `const PropertyForm: FC<{control: FormProxy<Property>}> = ({control}) => <Section>...</Section>`. Тогда `itemComponent={PropertyForm}`.
- `LoadingState`, `ErrorState` → `'@reformer/ui-kit'` напрямую.
- `ResidenceAddressSection`, `UnemployedWarning`, `ConfirmationComponents` — НЕ трогаем.

`projects/react-playground/src/pages/examples/complex-multy-step-form-renderer-json/registry.ts` (строки 34-48): тот же набор замен. JSON `itemComponent: "Name"` или `itemComponent: { "$template": {...} }` — оба работают через converter patch.

Iter-7 v7-страницы: подхватят shim в `projects/react-playground/src/components/RendererFormArraySection.tsx` без изменений в самих v7 страницах.

## MCP prompt + llms-доки

**`packages/reformer-mcp/src/prompts/templates/add-wizard.md` Section A1:** переписать на «**A1 — default путь для ui-kit-detected стеков**»:
```tsx
import { FormWizard } from '@reformer/ui-kit/form-wizard';
<FormWizard form={form} config={config} steps={steps} onSubmit={onSubmit} />
```
Описать что `step.body` принимает `FC | ReactNode | RenderNode<T>` (runtime-дискриминация). Привести по примеру каждого варианта.

**`packages/reformer-mcp/src/prompts/templates/add-form-array.md`:** переписать `itemComponent` секцию — теперь это всегда `ComponentType<{ control: FormProxy<TItem> }>`. Никаких node-factory. Для JSON: registry-string или `$template` (converter сам обернёт в FC).

**`packages/reformer-ui-kit/docs/llms/`:**
- `07-form-wizard.md` — recipe «Build a multi-step form» с тремя примерами body (FC / ReactNode / RenderNode).
- `08-form-array-section.md` — recipe для FormArraySection (FC itemComponent + JSON $template/string).
- Обновить `05-recipes.md` пунктом про multi-step + form-array combo.

`generate:llms` пайплайн запускается из `scripts/generate-llms-txt` автоматически в `npm run build`.

## Critical files

- [packages/reformer-ui-kit/package.json](../../packages/reformer-ui-kit/package.json) — peerDeps + exports.
- [packages/reformer-ui-kit/vite.config.ts](../../packages/reformer-ui-kit/vite.config.ts) — entries + external.
- [packages/reformer-ui-kit/src/index.ts](../../packages/reformer-ui-kit/src/index.ts) — re-exports.
- [packages/reformer-renderer-json/src/converter/json-to-render-schema.ts](../../packages/reformer-renderer-json/src/converter/json-to-render-schema.ts) — `*Component` slot patch.
- [packages/reformer-mcp/src/prompts/templates/add-wizard.md](../../packages/reformer-mcp/src/prompts/templates/add-wizard.md) — Section A1.
- [packages/reformer-mcp/src/prompts/templates/add-form-array.md](../../packages/reformer-mcp/src/prompts/templates/add-form-array.md) — itemComponent unified shape.
- [projects/react-playground/src/components/RendererFormArraySection.tsx](../../projects/react-playground/src/components/RendererFormArraySection.tsx) — становится shim.
- [projects/react-playground/src/pages/examples/complex-multy-step-form-renderer/render-schema.ts](../../projects/react-playground/src/pages/examples/complex-multy-step-form-renderer/render-schema.ts) — consumer.
- [projects/react-playground/src/pages/examples/complex-multy-step-form-renderer-json/registry.ts](../../projects/react-playground/src/pages/examples/complex-multy-step-form-renderer-json/registry.ts) — consumer.

## Verification

1. `npm run build -w @reformer/ui-kit` — clean. `dist/form-wizard.js`, `dist/form-array.js`, `dist/state.js` + `.d.ts` присутствуют. `@reformer/renderer-react` external (нет runtime-копии в bundle).
2. `npm run build -w @reformer/renderer-json` — clean. Тест converter $template→FC проходит.
3. `cd projects/react-playground && npx tsc --noEmit` — clean.
4. Dev-server `npm run dev -w react-playground`:
   - `/examples/complex` — wizard визуально неизменён (StepIndicator, кнопки, прогресс).
   - `/examples/complex-renderer` — то же; используется `step.body: RenderNode`. Items через FC `PropertyForm`.
   - `/examples/json-renderer` — то же; через converter $template→FC resolve.
   - `/examples/mcp-credit-v7`, `/examples/mcp-credit-renderer-v7`, `/examples/mcp-credit-renderer-json-v7` — рендерятся через shim без regress.
5. **Playwright e2e** на `/examples/complex-renderer`: 6 шагов wizard happy-path, без console-errors, testIds сохранены (`btn-next`, `btn-submit`, `step-indicator-N`, `array-item-*`).
6. **Renderer-react regression:** `npm test -w @reformer/renderer-react` — все существующие тесты проходят (никаких изменений в renderer-react).
7. **MCP regression:** spawn fresh sub-agent через JSON-RPC `prompts/get name=add-wizard target=core projectPath=projects/react-playground` — подтвердить A1 как DEFAULT и пример `from '@reformer/ui-kit/form-wizard'` со step.body: FC|ReactNode|RenderNode присутствует.
8. **Type-safety check:** TS правильно типизирует step.body через discriminated runtime + valid type union. Подтвердить отсутствие `as never` cast в migrated consumer files.

## Risk matrix

| Риск | Митигация |
|---|---|
| **Полиморфный `step.body` runtime-дискриминация** — функция vs React element vs plain object. | Чёткие type guards: `typeof body === 'function'` (FC), `isValidElement(body)` (ReactElement), `'component' in body && !isValidElement` (RenderNode). Unit-тесты ui-kit/form-wizard на каждый shape. |
| **`$template` → FC wrapper в renderer-json** — wrapper создаётся per-render, не оптимизировано. | Memoize wrapper по identity templateNode внутри converter. Performance impact для arrays на 100+ items. Если станет проблемой — оптимизация в follow-up. |
| **Shim для iter-7 v7** — старый API node-factory нужно адаптировать. | Inline FC-обёртка вокруг `RenderNodeComponent`. Поведение сохраняется, тесты v7 не падают. |
| **complex-form-renderer items — что они сейчас?** | Перед миграцией читаем существующие render-schema. Если items сейчас — RenderSchema-tree, оборачиваем в `(props) => <FormRenderer form={props.control} render={...}/>`. |
| **Type union FC \| ReactNode \| RenderNode** — TS может неправильно сужать. | Явный helper `renderStepBody<T>()` с type guards. Опционально — добавить test-d.ts если есть в ui-kit. |

## Out of scope

- Path A (discriminated props) и Path B (controlMode) — отвергнуты.
- Генерализация `UnemployedWarning` в общий `Callout`/`Alert`.
- Миграция iter-7 v7 страниц на новый FC-shape (через shim работает).
- Расширение renderer-react новыми node-вариантами — отдельная задача когда станет нужно.
- Коммиты — только по явному запросу пользователя (per CLAUDE.md).
