# Развязка `@reformer/ui-kit` → `@reformer/renderer-react`

## Context

`@reformer/ui-kit` объявляет `@reformer/renderer-react` **обязательным** (не optional) peer'ом и
импортирует из него рантайм-символы. Зависимость **инвертирована**: в рантайме рендерер *управляет*
ui-kit — [`ModelArrayComponentRenderer`](../../packages/reformer-renderer-react/src/core/render-node.tsx#L525-L543)
инстанциирует `List`/`FormArray` и инжектит им пропы, — а в компайл-тайме ui-kit зависит от рендерера.
Вызываемый зависит от вызывающего.

Последствия: (1) публичный API рендерера содержит хук, существующий ради ui-kit
([`index.ts:52`](../../packages/reformer-renderer-react/src/index.ts#L52) — «для ui-kit List/FormArray»),
то есть концептуальный цикл при ациклическом графе модулей; (2) потребитель, берущий ui-kit ради
дизайн-системы + cdk (документированный TS-flow), обязан ставить рендерер — 3 компонента из ~60
облагают налогом весь пакет; (3) `">=1.0.0"` в peer'е — ложь, `useModelArrayItems` в 1.0.0 не было,
рассинхрон даёт рантайм-`undefined is not a function`; (4) альтернативный рендерер или чужая
дизайн-система вынуждены импортировать внутренности `renderer-react`.

Отдельно: [`ModelArraySectionRenderer`](../../packages/reformer-renderer-react/src/core/render-node.tsx#L369-L517)
— ~150 строк Tailwind-разметки (кнопки «Добавить»/«Удалить»/↑↓) внутри UI-агностичного пакета,
почти побайтовая копия ui-kit `FormArray`.

**Цель:** снять peer-зависимость полностью, без нового пакета; убрать дублирующую секцию.

**Выбранный подход:** Passive View (рендерер отдаёт готовые элементы) для `List`/`FormArray` +
инъекция стратегии `renderStepBody` для `FormWizard`. Инвертировать пропы у визарда нельзя —
тело шага должно рендериться лениво, поэтому там стратегия.

---

## Текущая поверхность связи

| Файл ui-kit | Импорт | Судьба |
|---|---|---|
| [list.tsx:10-15](../../packages/reformer-ui-kit/src/components/list/variants/base/list.tsx#L10-L15) | `useModelArrayItems` + 3 типа | → пропы `items` |
| [form-array.tsx:14-20](../../packages/reformer-ui-kit/src/components/form-array/variants/base/form-array.tsx#L14-L20) | `useModelArrayItems`, `resolveInitialValue` + 3 типа | → `items` + `onAdd/onRemove/onMove` |
| [form-wizard.tsx:37](../../packages/reformer-ui-kit/src/components/form-wizard/variants/base/form-wizard.tsx#L37) | `RenderNodeComponent`, `RenderNode` | → проп `renderStepBody` |
| [form-array-section.tsx:20](../../packages/reformer-ui-kit/src/components/form-array/variants/base/form-array-section.tsx#L20) | `FieldWrapperProps` (type-only) | → локальный структурный тип |
| `form-array-json.test.tsx:10`, `list.test.tsx:9` | `FormRenderer` | остаются (тесты, devDependency) |

Статик-флаги `__selfManagedChildren` / `reformerNeedsControl` **не трогаем** — это булев маркер на
компоненте, зависимости пакета он не создаёт (аналог `displayName`). Документировать как публичный
протокол рендерера.

### Радиус миграции (проверено)

- **JSON-схемы уже мигрированы**: все `array`-узлы в `complex-multy-step-form-renderer-json`,
  `complex-multy-step-form-registry`, `mcp-credit-application-renderer-json-v20`,
  `alerts-list-renderer-json` уже несут `"component": "$component(FormArray)"` / `"$component(List)"`.
- **Голый `{array, item}` без `component`** — только 2 TS-схемы, 6 узлов:
  `complex-multy-step-form-renderer/render-schema.ts:758,820,907` и
  `mcp-credit-application-renderer-react-v20/renderer.schema.ts:726,745,763`.
- **Реестры с `List`/`FormArray`** — 4 файла в `projects/react-playground/src/pages/examples/*/registry.ts`.
- **`RenderNode` как `step.body`** — `projects/react-playground/src/components/RendererFormWizard.tsx`
  (шим) и `mcp-credit-application-renderer-react-v20/renderer.schema.ts:8`.

---

## Шаги реализации

### 1. renderer-react: инвертировать инъекцию пропов массива

`packages/reformer-renderer-react/src/core/render-node.tsx`

`ModelArrayComponentRenderer` сам вызывает `useModelArrayItems` (хук остаётся дома) и отдаёт
компоненту **готовые элементы** + колбэки вместо сырых `array`/`item`:

```tsx
const ModelArrayComponentRenderer = memo(function ModelArrayComponentRenderer({ node, fieldWrapper }) {
  const Comp = node.component as React.ComponentType<any>;
  const items = useModelArrayItems(node.array, node.item, fieldWrapper);
  return (
    <Comp
      items={items.map(({ key, index, model, element }) => ({ key, index, model, children: element }))}
      onAdd={() => node.array.push(resolveInitialValue(node.initialValue))}
      onRemove={(i: number) => node.array.removeAt(i)}
      onMove={(from: number, to: number) => node.array.move(from, to)}
      {...(node.componentProps ?? {})}
    />
  );
});
```

Экспортировать публичный тип слота (он же станет контрактом для любого UI-kit):

```ts
// core/types.ts
export interface ArrayItemSlot {
  key: React.Key;
  index: number;
  model?: unknown;
  children: React.ReactNode;
}
export interface ArrayComponentProps {
  items: ArrayItemSlot[];
  onAdd(): void;
  onRemove(index: number): void;
  onMove(from: number, to: number): void;
}
```

### 2. renderer-react: удалить `ModelArraySectionRenderer`, оставить безхромный fallback

Удалить строки 369-517 (`render-node.tsx`). Ветка для узла без `component`:

```tsx
if (isArrayRenderNode(node)) {
  return node.component
    ? <ModelArrayComponentRenderer node={node} fieldWrapper={fieldWrapper} />
    : <ModelArrayFallback node={node} fieldWrapper={fieldWrapper} />;
}
```

`ModelArrayFallback` — ~10 строк: `useModelArrayItems` + рендер элементов во фрагменте, **без**
`<section>`, кнопок и Tailwind. В dev — один `console.warn`: «array-узел без `component`
рендерится без UI управления; зарегистрируйте `FormArray` из @reformer/ui-kit».
Схемы не падают, но кнопка «Добавить» пропадает — поэтому шаг 6 мигрирует обе TS-схемы.

### 3. renderer-react: сузить публичный API

`packages/reformer-renderer-react/src/index.ts` — убрать `useModelArrayItems`, `resolveInitialValue`,
`ModelArrayItem` из барреля (после шагов 1-2 они внутренние). Добавить `ArrayItemSlot`,
`ArrayComponentProps`. Убрать из JSDoc упоминания ui-kit `List`/`FormArray` — рендерер больше
не знает про них.

### 4. ui-kit: `List` и `FormArray` → чистая презентация

`packages/reformer-ui-kit/src/components/list/variants/base/list.tsx` — ни одного `@reformer/*` импорта:

```tsx
import type { ReactNode, ElementType, Key } from 'react';
import { cn } from '@/lib/utils';

/** Готовый к отрисовке элемент массива. Собственный тип ui-kit — чужой контракт не импортируем. */
export interface ArrayItemSlot {
  key: Key;
  index: number;
  model?: unknown;      // для itemLabel(model, index)
  children: ReactNode;  // уже отрендеренное поддерево
}

export interface ListProps {
  items?: ArrayItemSlot[];
  className?: string;
  testId?: string;
  as?: ElementType;
}

export function List({ items = [], className, testId, as: As = 'div' }: ListProps) {
  return (
    <As role="list" data-slot="list" data-testid={testId} className={cn('space-y-2', className)}>
      {items.map((it) => <div key={it.key}>{it.children}</div>)}
    </As>
  );
}
```

`form-array.tsx` — то же плюс `onAdd`/`onRemove`/`onMove?` вместо `array.push/removeAt/move`.
Весь хром и **все `data-testid` сохранить дословно**: `array-add`, `array-item-N`,
`array-item-N-remove`, `array-item-N-move-up/down` — на них завязан
`projects/react-playground-e2e/tests/pages/complex-multy-step-form/credit-form-page.pom.ts:580-608`
и `reorder.spec.ts`. `initialValue` из пропов уходит (его резолвит рендерер в `onAdd`).

Структурная совместимость `ArrayItemSlot` в обоих пакетах обязательна: TS сматчит их по форме,
номинальной связи не будет. Добавить в `list.test.tsx` кейс с фейковыми `items` без формы —
это и есть доказательство renderer-agnostic.

### 5. ui-kit: `FormWizard` → стратегия `renderStepBody`, `FormArraySection` → локальный тип

`packages/reformer-ui-kit/src/components/form-wizard/variants/base/form-wizard.tsx`:

```tsx
/** Тело шага. `TBody` — расширение для внешних рендереров (например RenderNode). */
export type FormWizardStepBody<T, TBody = never> =
  | ComponentType<{ control: FormProxy<T> }>
  | ReactNode
  | TBody;

export interface FormWizardProps<T, TBody = never> extends FormWizardHeadlessProps<T> {
  steps: FormWizardStep<T, TBody>[];
  /**
   * Отрисовка нестандартного `body`. ui-kit знает только ReactNode и ComponentType;
   * всё остальное отдаёт сюда. Рендерер подставляет свою реализацию — ui-kit о нём не знает.
   */
  renderStepBody?: (body: TBody, form: FormProxy<T>) => ReactNode;
}

function renderStepBody<T, TBody>(body, form, custom?) {
  if (isValidElement(body)) return body;
  if (isComponentType<T>(body)) return <Comp control={form} />;
  return custom ? custom(body as TBody, form) : (body as ReactNode);
}
```

Хелперы `isRenderNode`/`isComponentType` остаются, но `isRenderNode` больше не нужен —
дискриминация «не element и не component ⇒ отдать в `custom`». Импорт
`RenderNodeComponent, type RenderNode` удаляется.

`form-array-section.tsx:20` — заменить импорт `FieldWrapperProps` на локальное объявление
(интерфейс из 4 полей, `control`/`className`/`children`/`testId`).

### 6. Мигрировать потребителей

**TS render-схемы** (шаг 2 требует явный `component`) — добавить `component: FormArray` в 6 узлов:
`complex-multy-step-form-renderer/render-schema.ts:758,820,907`,
`mcp-credit-application-renderer-react-v20/renderer.schema.ts:726,745,763`.

**Визард** — подставить стратегию в двух точках:
```tsx
// projects/react-playground/src/components/RendererFormWizard.tsx
import { RenderNodeComponent } from '@reformer/renderer-react';
<FormWizard<T, RenderNode<T>>
  renderStepBody={(body, form) => <RenderNodeComponent node={body} form={form} />}
  … />
```
и там же в `mcp-credit-application-renderer-react-v20/renderer.schema.ts` (FormWizard вставлен
в схему напрямую) — через `componentProps.renderStepBody`.
Приложение уже играет роль моста ([`RendererFormWizard.tsx`](../../projects/react-playground/src/components/RendererFormWizard.tsx))
— это ровно то место, где стратегия и должна жить.

**Реестры** — сигнатуры `reg.component('List'|'FormArray', …)` не меняются, менять нечего.

**Builder** — проверить `preview-runtime/known-components.ts`, `wizard-preview.tsx`,
`app/wizard-templates.ts`: свои Wizard-обёртки со своим `__selfManagedChildren`, но если где-то
`body` — RenderNode, добавить `renderStepBody`.

### 7. Манифесты и гварды

- `packages/reformer-ui-kit/package.json` — убрать `@reformer/renderer-react` из `peerDependencies`
  и `peerDependenciesMeta`; **оставить в `devDependencies`** (нужен тестам `FormRenderer`).
- `packages/reformer-ui-kit/scripts/check-subpaths.mjs:31-36` — убрать `@reformer/renderer-react`
  из `LOCAL_PACKAGES`.
- `packages/reformer-renderer-json/package.json:63,68,78` — удалить вестигиальный peer
  `@reformer/ui-kit` (пакет его ни разу не импортирует; `validate-component-props.test.ts:8`
  это прямо фиксирует).
- Корневой `typecheck` — ui-kit больше не зависит от `dist/` рендерера, порядок можно ослабить
  (не обязательно в этой работе).
- `.size-limit.json` — бюджеты чанков `form-array`/`list`/`form-wizard` уменьшатся, проверить.

---

## Verification

```bash
# 1. Гвард, ради которого всё затевалось: в dist ui-kit не должно остаться @reformer/renderer-react
npm run build -w @reformer/renderer-react && npm run build -w @reformer/ui-kit
node scripts/check-dist-deps.mjs
grep -rn "@reformer/renderer-react" packages/reformer-ui-kit/dist/   # ожидаем: пусто

# 2. Типы и unit
npm run typecheck
npm test -w @reformer/renderer-react   # model-array-component.test.tsx, html-nodes.test.tsx
npm test -w @reformer/ui-kit           # list.test.tsx, form-array.test.tsx, form-array-json.test.tsx

# 3. Изоляция ui-kit (out-of-monorepo install без renderer-react)
node packages/reformer-ui-kit/scripts/check-subpaths.mjs

# 4. e2e — визуально и по testid должно быть эквивалентно
cd projects/react-playground-e2e
npx playwright test tests/pages/complex-multy-step-form/reorder.spec.ts
npx playwright test tests/pages/complex-multy-step-form/
```

Ручная проверка в `react-playground` (`npm run dev -w react-playground`) по страницам:
`complex-multy-step-form-renderer` (TS-схема, мигрированный `component: FormArray`),
`complex-multy-step-form-renderer-json` (JSON, `$component(FormArray)` — не должна измениться),
`alerts-list-renderer-json` (`$component(List)`), `mcp-credit-application-renderer-react-v20` (визард
с `renderStepBody`). Скриншоты — в `projects/react-playground-e2e/screenshots/ui-kit-decoupling/`.

Критерий приёмки: `grep -rn "@reformer/renderer-react" packages/reformer-ui-kit/src --include=*.tsx --include=*.ts`
даёт только два тестовых файла (`form-array-json.test.tsx`, `list.test.tsx`).

---

## Риски

- **Breaking change публичного API ui-kit**: `ListProps`/`FormArrayProps` меняют форму. Пакет v6.0.0
  → нужен major bump и запись в CHANGELOG с примером «до/после».
- **`data-testid` — самая хрупкая точка.** Их 5 семейств, на них завязаны POM и `reorder.spec.ts`.
  Переносить строки дословно, не «переписывая красивее».
- **Fallback без хрома (шаг 2)** молча меняет UI для чужих схем с голым `{array, item}`.
  Смягчение: dev-`console.warn` + запись в CHANGELOG.
- **Структурная совместимость `ArrayItemSlot`**: два независимых объявления. Если разъедутся —
  TS поймает на потребителе, а не на границе. Покрыть тестом в `model-array-component.test.tsx`,
  который рендерит настоящий ui-kit `FormArray` через рендерер.

## Трекинг

Завести issue в bd (`bd create`) на всю работу с подзадачами по шагам 1-7; отдельным issue —
чистку peer'а в `renderer-json` (независима и мержится первой).
