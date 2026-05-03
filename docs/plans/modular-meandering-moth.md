# Анализ архитектуры ReFormer — core, cdk, ui-kit, renderer, renderer-json

## Context

Задача: максимально подробное изучение и анализ работы пяти пакетов ReFormer с рекомендациями по улучшению.

---

## 1. КАК РАБОТАЕТ КАЖДЫЙ ПАКЕТ

### 1.1 `@reformer/core` — реактивная система управления формами

**Принцип работы:** Signal-based реактивность через `@preact/signals-core` — без React.

**Иерархия узлов:**

```
FormNode (abstract)
  ├── FieldNode<T>          — одно поле (значение + состояние + валидация)
  ├── GroupNode<T>          — группа полей (объект)
  │   └── создаёт FormProxy<T> (типобезопасный Proxy-доступ)
  └── ArrayNode<T>          — динамический массив форм
```

**Ключевые механизмы:**

1. **FieldNode** хранит `Signal<T>` для значения. Каждое изменение автоматически триггерит пересчёт `computed()` сигналов — `valid`, `errors`, `shouldShowError`.

2. **GroupNode** конфигурируется двумя способами:
   - Старый: `new GroupNode({ email: { value: '', component: Input } })`
   - Новый (рекомендуемый): `new GroupNode({ form: {...}, behavior: (path) => {}, validation: (path) => {} })`

3. **ValidationRegistry** работает как стек: вызов `required(path.email)` регистрирует валидатор в текущем активном реестре, который потом применяется к `GroupNode`.

4. **BehaviorRegistry** аналогично работает со стеком — `watchField`, `copyFrom`, `enableWhen` и др. регистрируются и применяются к форме одним блоком.

5. **FieldPath** — типобезопасный Proxy-объект, позволяющий писать `path.address.city` вместо строк `"address.city"`. Используется в validation/behavior схемах.

6. **FormProxy** — Proxy поверх GroupNode, маппящий `form.email` → `FieldNode<string>`, `form.address` → `FormProxy<Address>`.

7. **React-интеграция** через `useFormControl(node)` — подписывается на `@preact/signals-core` через `useSyncExternalStore` (Concurrent Mode безопасно).

**Потоки данных:**

```
User Input
  → FieldNode.setValue()
  → Signal<T>.value = newValue
  → computed(valid, errors, shouldShowError) пересчитываются
  → ValidationRegistry запускает validators
  → useFormControl переподписывается
  → React компонент перерисовывается
```

---

### 1.2 `@reformer/cdk` — headless compound components

**Принцип работы:** Context + Render Props паттерн. Логика без стилей.

**Три компонента:**

#### FormArray (динамические списки)

```
ArrayNode<T>
  ↓
FormArray.Root (Context provider)
  ├── FormArray.Empty     — контент для пустого массива
  ├── FormArray.List      — итератор (render props: { control, index, remove })
  │   └── FormArray.RemoveButton
  ├── FormArray.AddButton — добавление с initialValue
  └── FormArray.Count     — счётчик элементов
```

- `useFormArray(control)` — hook для полного контроля

#### FormField (одно поле)

```
FieldNode<T>
  ↓
FormField.Root (Context provider → ids, state, aria attrs)
  ├── FormField.Label     — auto-required star, auto-htmlFor
  ├── FormField.Control   — auto-render ИЛИ asChild для custom input
  ├── FormField.Error     — single/multi ошибки с aria-errormessage
  └── FormField.Description — helper text
```

- Автоматически вычисляет `aria-*` атрибуты (labelledby, errormessage, required, invalid)
- `useFormField(control)` — hook возвращает `labelProps`, `controlProps`, `errorProps`

#### FormWizard (многошаговые формы)

```
FormProxy<T> + config
  ↓
FormWizard (Root — Context provider)
  ├── FormWizard.Indicator — headless (render props: { steps, isCurrent, isCompleted, canNavigate })
  ├── FormWizard.Step      — показывает только если currentStep совпадает
  ├── FormWizard.Progress  — headless (render props: { current, total, percent })
  └── FormWizard.Actions
      ├── FormWizard.Next   — с авто-disabled во время валидации
      ├── FormWizard.Prev
      └── FormWizard.Submit — с loadingText
```

**Алгоритм goToNextStep:**

1. Применяет `stepValidations[currentStep]` к форме
2. Если invalid → touchAll() + return false
3. Добавляет в completedSteps → переходит на следующий step

---

### 1.3 `@reformer/ui-kit` — конкретные UI компоненты

**Принцип работы:** React компоненты с Tailwind CSS. Нет специфики ReFormer — чистые HTML-компоненты с `value/onChange/onBlur` API.

**Компоненты:**
| Компонент | Назначение | Особенности |
|---|---|---|
| `Input` | Базовый ввод | Поддержка `type=number` с блокировкой NaN |
| `Select` | Выпадающий список | Static/Preload/Partial resource, группировка, clearable |
| `Checkbox` | Чекбокс | Inline label |
| `Textarea` | Многострочный | resize-y |
| `RadioGroup` | Радиогруппа | Массив опций |
| `Button` | Кнопка | CVA: 6 variants × 6 sizes |
| `InputPassword` | Пароль | Toggle показа через Eye иконку |
| `InputMask` | С маской | Простая реализация |
| `FormField` | Обёртка поля | Интегрирован с CDK, рендерит label+error+pending |
| `Box` | Layout div | Простой контейнер |
| `Section` | Секция | Заголовок h1-h6 + slot для children |
| `Collapsible` | Сворачиваемый | useState toggle |
| `AsyncBoundary` | 3-состояния | loading / error / ready |

**FormField** — ключевой компонент ui-kit, интегрирует CDK:

```tsx
function FormField({ control }) {
  // Использует @reformer/cdk:
  // CdkFormField.Root → CdkFormField.Label → CdkFormField.Control → CdkFormField.Error
}
```

---

### 1.4 `@reformer/renderer-react` — React рендерер на основе схем

**Принцип работы:** Принимает `RenderSchemaFn<T>` → строит дерево узлов → рекурсивно рендерит через `RenderNodeComponent`.

**Типы узлов схемы:**

```typescript
type RenderNode<T> =
  | FieldRenderNode // { component: path.email }
  | ContainerRenderNode<T>; // { component: Box, children: [...] }
```

**Программное управление — RenderSchemaProxy:**

```typescript
const schema = createRenderSchema<T>((path) => ({...}));

// После создания:
schema.node('email-field').setHidden(true);
schema.node('email-field').patchProps({ className: 'col-span-2' });
```

Версионирование через `Signal<number>` — инкремент версии триггерит перерисовку.

**Behavior API:**

- `hideWhen(node, () => condition)` — реактивное условие на Preact сигналах
- `renderEffect(schema, effectFn)` — эффект на сигналах
- `onComponentEvent(node, 'onSubmit', handler)` — делегирование событий
- `onInit/onMount/onUnmount` — lifecycle hooks

---

### 1.5 `@reformer/renderer-json` — JSON-driven рендерер

**Принцип работы:** JSON Schema → Registry lookup → `createRenderSchemaFromJson` → `FormRenderer`.

**Конвертация JSON → RenderSchema:**

```
{ model: "email" }          → FieldRenderNode (path.email)
{ component: "Box", ... }   → ContainerRenderNode (Box component)
{ componentProps: { options: "LOAN_TYPES" } } → source lookup из registry
{ componentProps: { fieldPath: { $model: "addresses" } } } → FieldPathNode
{ componentProps: { itemComponent: { $template: {...} } } } → (itemPath) => RenderNode
```

**Registry система:**

```typescript
const registry = defineRegistry((reg) => {
  reg.field('Input', Input);
  reg.container('Box', Box);
  reg.source('LOAN_TYPES', [...]);
});
```

**Context inheritance:**

```
<JsonRendererProvider settings={{ registry: globalRegistry }}>
  <JsonRendererProvider settings={{ registry: localRegistry }}>
    // localRegistry → (fallback) → globalRegistry
  </JsonRendererProvider>
</JsonRendererProvider>
```

**FIELD_WRAPPER константа:** специальное имя в registry для регистрации обёртки поля:

```typescript
reg.container(FIELD_WRAPPER, FormField);
// Будет использоваться как fieldWrapper для всех полей
```

---

## 2. ОБЩАЯ АРХИТЕКТУРА

```
┌─────────────────────────────────────────────────────────────────┐
│                    reformer-renderer-json                       │
│  JSON Schema → defineRegistry → createRenderSchemaFromJson      │
│  JsonRendererProvider (context inheritance)                     │
└─────────────────────────────┬───────────────────────────────────┘
                              │ uses
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   reformer-renderer-react                       │
│  RenderSchemaFn → FormRenderer → RenderNodeComponent            │
│  createRenderSchema (proxy) + Behavior API                      │
└─────────────────────────────┬───────────────────────────────────┘
                              │ renders components from
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     reformer-ui-kit                             │
│  Input, Select, Checkbox, FormField, Box, Section, ...          │
│  Tailwind CSS + CVA + Radix UI                                  │
└─────────────────────────────┬───────────────────────────────────┘
                              │ uses CDK components
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      reformer-cdk                               │
│  FormField, FormArray, FormWizard (headless compound)           │
│  Context + Render Props                                         │
└─────────────────────────────┬───────────────────────────────────┘
                              │ manages state of
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      @reformer/core                             │
│  FieldNode, GroupNode, ArrayNode + Signals                      │
│  ValidationRegistry, BehaviorRegistry                           │
│  createForm, useFormControl                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. РЕКОМЕНДАЦИИ ПО УЛУЧШЕНИЮ

### 3.1 `@reformer/core` — критические улучшения

#### [HIGH] Отсутствует встроенный механизм dirty-tracking на уровне GroupNode

**Проблема:** `dirty` на GroupNode — агрегированное OR по всем детям. Нельзя узнать, какие конкретно поля изменились.
**Решение:** Добавить `getDirtyFields(): Partial<T>` — возвращает только изменённые поля.

#### [HIGH] ArrayNode не поддерживает reorder операцию

**Проблема:** Есть `insert/push/removeAt`, но нет `move(from, to)` / `reorder(indices)`.
**Решение:** Добавить `move(fromIndex: number, toIndex: number): void`.

#### [MEDIUM] Отсутствует cross-form связь (форма B зависит от формы A)

**Проблема:** `behavior` работает только внутри одной формы. Для межформенных зависимостей нужны ручные `effect()`.
**Решение:** Добавить `watchExternal(signal: ReadonlySignal<T>, callback)` в BehaviorRegistry.

#### [MEDIUM] `validate()` не возвращает список невалидных полей

**Проблема:** `await form.validate()` возвращает `boolean`. При ошибке неизвестно, какие поля провалили валидацию.
**Решение:**

```typescript
interface ValidationResult {
  valid: boolean;
  invalidFields: string[];  // пути к невалидным полям
  errors: Record<string, ValidationError[]>;
}
async validateDetailed(): Promise<ValidationResult>
```

#### [MEDIUM] Нет поддержки dependent validators (валидатор B зависит от значения поля A)

**Проблема:** `validateTree` существует, но громоздко для простых случаев. Частый паттерн — "confirmPassword === password".
**Решение:** Добавить `equalTo(path.confirmPassword, path.password, { message: 'Passwords must match' })` как встроенный валидатор.

#### [LOW] Нет debounce для `transformValue`

**Проблема:** `transformValue` запускается синхронно на каждый keystroke, что дорого для сложных трансформаций.
**Решение:** Добавить `{ debounce?: number }` в `TransformValueOptions`.

#### [LOW] `resetToInitial()` — неочевидное vs `reset()` различие

**Проблема:** Разработчики путают `reset()` (сбрасывает к переданному значению или к defaultValue) vs `resetToInitial()` (сбрасывает к значению на момент создания).
**Решение:** Переименовать: `reset()` → `resetToDefault()`, `resetToInitial()` → `reset()`. Или улучшить JSDoc с примерами.

---

### 3.2 `@reformer/cdk` — улучшения API

#### [HIGH] FormWizard не поддерживает async onStepChange

**Проблема:** `onStepChange?: (step: number) => void` — синхронный. Нельзя сохранять данные между шагами (например, сохранение draft на каждый шаг).
**Решение:**

```typescript
onStepChange?: (step: number) => void | Promise<void>;
// + новый prop:
onStepChangeError?: (error: Error) => void;
```

#### [HIGH] FormArray не поддерживает drag-and-drop reorder из коробки

**Проблема:** Нет `move()` в ArrayNode (см. выше), и FormArray не предоставляет drag-and-drop API.
**Решение:** После добавления `ArrayNode.move()`, добавить `FormArray.DragHandle` компонент + `onReorder` callback.

#### [MEDIUM] FormField.Control теряет ref при auto-render режиме

**Проблема:** В режиме `<FormField.Control />` (auto-render) нельзя получить ref на actual input.
**Решение:** Добавить `ref` forwarding в FormField.Root или `FormField.Control`:

```typescript
<FormField.Root control={control} ref={inputRef}>
```

#### [MEDIUM] FormWizard.Step не поддерживает условный skip шага

**Проблема:** Нет способа пропустить шаг на основе значений формы (например, шаг "Адрес ипотеки" — только для mortgage).
**Решение:**

```typescript
<FormWizard.Step skip={() => form.loanType.value.value !== 'mortgage'}>
  <MortgageStep />
</FormWizard.Step>
```

#### [LOW] FormArray.List не поддерживает виртуализацию для больших списков

**Проблема:** При 100+ элементах всё рендерится в DOM.
**Решение:** Добавить `virtual` prop с интеграцией `@tanstack/virtual` или `react-window`.

#### [LOW] useFormArray / useFormField не экспортируют типы возвращаемых значений

**Проблема:** Разработчик не может написать `const state: UseFormArrayReturn<T>` без импорта.
**Решение:** Экспортировать `UseFormArrayReturn<T>`, `UseFormFieldReturn<T>` из index.

---

### 3.3 `@reformer/ui-kit` — улучшения компонентов

#### [HIGH] InputMask — псевдо-реализация, не применяет маску

**Проблема:** `InputMask` принимает `mask: string`, но фактически не применяет маску к вводу.
**Решение:** Реализовать настоящую маску или подключить `react-imask` / `react-input-mask`:

```typescript
import { IMaskInput } from 'react-imask';
// Поддержка: date, phone, number, custom regex маски
```

#### [HIGH] Select не поддерживает multi-select

**Проблема:** Только single value. Частый use-case — выбор нескольких тегов/категорий.
**Решение:**

```typescript
interface SelectProps {
  multiple?: boolean; // включает multi-select
  value: string | string[]; // union type при multiple
  onChange: (value: string | string[]) => void;
}
```

#### [MEDIUM] FormField не поддерживает кастомный pending контент

**Проблема:** Захардкожен текст `"Проверка..."` для async валидации.
**Решение:**

```typescript
interface FormFieldProps {
  pendingContent?: ReactNode; // default: <span>Проверка...</span>
}
```

#### [MEDIUM] Button отсутствует `loading` состояние

**Проблема:** Для асинхронных действий (submit формы) нет встроенного loading spinner.
**Решение:**

```typescript
interface ButtonProps {
  loading?: boolean;
  loadingText?: ReactNode;
}
```

#### [MEDIUM] Select.resource — нет кеширования результатов

**Проблема:** При `type: 'preload'` данные загружаются каждый раз при mount компонента.
**Решение:** Добавить простой кеш (Map по ключу опций) или поддержку `staleTime`.

#### [LOW] Checkbox не поддерживает indeterminate состояние

**Проблема:** Для tree-select UI нужен `indeterminate`.
**Решение:**

```typescript
interface CheckboxProps {
  value: boolean | 'indeterminate';
}
```

#### [LOW] Нет компонента DatePicker

**Проблема:** Отсутствует базовый date input, хотя core поддерживает `Date` тип и `minDate/maxDate` валидаторы.
**Решение:** Добавить `DatePicker` на основе `@radix-ui/react-popover` + `react-day-picker`.

---

### 3.4 `@reformer/renderer-react` — улучшения рендерера

#### [HIGH] Отсутствует поддержка Suspense/ErrorBoundary

**Проблема:** При ошибке в `renderEffect` или async операции падает весь рендерер.
**Решение:** Обернуть `FormRenderer` в ErrorBoundary по умолчанию с пропом `fallback`.

#### [HIGH] RenderSchemaProxy.node() — нет TypeScript типизации для конкретного узла

**Проблема:** `schema.node('email').patchProps(...)` — props не типизированы.
**Решение:**

```typescript
// Generics для типизированного доступа
const schema = createRenderSchema<MyForm, {
  'email-field': typeof Input,
  'name-field': typeof Input,
}>((path) => ({...}));

schema.node('email-field').patchProps({ placeholder: 'Enter email' }); // типизировано
```

#### [MEDIUM] hideWhen не поддерживает анимации (mount/unmount)

**Проблема:** При скрытии узла он полностью unmount-ится, нет возможности добавить fade-out анимацию.
**Решение:** Добавить `animateWhen` behavior:

```typescript
animateWhen(schema.node('section'), {
  condition: () => form.loanType.value.value === 'mortgage',
  enter: 'fade-in 200ms',
  leave: 'fade-out 200ms',
});
```

#### [MEDIUM] Нет поддержки conditional children в ContainerRenderNode

**Проблема:** Нельзя добавить/убрать ребёнка программно — только всю ноду целиком.
**Решение:** Добавить поддержку `children` override в `patchProps`:

```typescript
schema.node('container').patchProps({ children: [...] });
```

#### [LOW] onInit/onMount вызываются каждый раз при ре-рендере родителя

**Проблема:** Lifecycle hooks не привязаны к конкретному mount/unmount цикла.
**Решение:** Использовать `useEffect(() => { onInit(); return onUnmount; }, [])` как в обычном React.

---

### 3.5 `@reformer/renderer-json` — улучшения JSON рендерера

#### [HIGH] JSON Schema не валидируется

**Проблема:** Передача `{ model: "nonExistentField" }` не даёт ошибку — просто ничего не рендерится.
**Решение:** Добавить опциональную валидацию схемы (zod-based):

```typescript
function validateJsonSchema(schema: JsonFormSchema, form: GroupNode<T>): ValidationResult;
// + dev-mode warnings в консоль
```

#### [HIGH] Нет поддержки динамических массивов в JSON Schema

**Проблема:** Нет декларативного способа описать `FormArray` в JSON — только через кастомный registry container.
**Решение:** Добавить специальный тип узла:

```json
{
  "type": "array",
  "model": "addresses",
  "itemTemplate": {
    "component": "Section",
    "children": [{ "model": "city" }]
  }
}
```

#### [MEDIUM] $template не поддерживает вложенные $template

**Проблема:** Нельзя вложить `$template` внутрь другого `$template`.
**Решение:** Добавить рекурсивную обработку в `transformPropValue`.

#### [MEDIUM] defineRegistry не поддерживает aliases

**Проблема:** Нельзя зарегистрировать `'TextArea'` как alias для `'Textarea'`.
**Решение:**

```typescript
reg.alias('TextArea', 'Textarea');
```

#### [LOW] JSON Schema не поддерживает условные children (if/then/else)

**Проблема:** Для условного рендеринга секций нужен behavior. В самой JSON схеме нет декларативного условия.
**Решение:** Добавить `condition` поле:

```json
{
  "component": "Section",
  "condition": { "$model": "loanType", "equals": "mortgage" },
  "children": [...]
}
```

#### [LOW] Нет hot-reload поддержки для JSON схемы

**Проблема:** При изменении JSON схемы (например, CMS-driven) компонент полностью перемонтируется.
**Решение:** Добавить diffing алгоритм — обновлять только изменённые узлы без полного ре-монта.

---

## 4. ПРИОРИТИЗИРОВАННЫЙ ПЛАН УЛУЧШЕНИЙ

### Sprint 1 — Критические функциональные пробелы

1. `ArrayNode.move(from, to)` → `FormArray` drag-and-drop support
2. Реальная реализация `InputMask` (react-imask)
3. `Select` multi-select поддержка
4. JSON Schema валидация с dev-mode warnings

### Sprint 2 — Developer Experience

5. `validateDetailed()` возвращает список невалидных полей
6. `equalTo()` validator для confirm-password паттерна
7. `DatePicker` компонент
8. Экспорт типов `UseFormArrayReturn<T>`, `UseFormFieldReturn<T>`

### Sprint 3 — Performance & Advanced

9. `FormArray` виртуализация (tanstack virtual)
10. `FormWizard.Step` skip условие
11. `Button` loading состояние
12. Динамические массивы в JSON Schema (`"type": "array"`)

### Sprint 4 — Polishing

13. `Checkbox` indeterminate состояние
14. `hideWhen` с анимациями
15. `defineRegistry` aliases
16. ErrorBoundary в FormRenderer

---

## 5. ВЕРИФИКАЦИЯ АНАЛИЗА

Данный анализ основан на чтении исходного кода всех пакетов:

- `packages/reformer/src/` — core (nodes, validation, behavior, hooks)
- `packages/reformer-cdk/src/components/` — cdk (form-array, form-field, form-wizard)
- `packages/reformer-ui-kit/src/components/ui/` — ui-kit (14 компонентов)
- `packages/reformer-renderer-react/src/core/` — renderer-react
- `packages/reformer-renderer-json/src/` — renderer-json

Для верификации рекомендаций:

1. `packages/reformer/src/core/nodes/array-node.ts` — проверить наличие `move()`
2. `packages/reformer-ui-kit/src/components/ui/input-mask.tsx` — убедиться в псевдо-реализации
3. `packages/reformer-ui-kit/src/components/ui/select.tsx` — убедиться в отсутствии multi
4. `packages/reformer-renderer-json/src/converter/json-to-render-schema.ts` — валидация схемы
