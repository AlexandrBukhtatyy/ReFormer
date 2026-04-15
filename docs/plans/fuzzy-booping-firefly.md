# План: @reformer/renderer-json

## Context

Текущая архитектура ReFormer включает `@reformer/renderer-react` с декларативным RenderSchema API. Однако RenderSchema требует TypeScript-кода для описания формы:

```typescript
const schema = createRenderSchema<MyForm>((path) => ({
  component: Box,
  children: [
    { component: path.email },
    { component: path.password },
  ]
}));
```

**Проблема:** Для сценариев, когда схема формы приходит с сервера, хранится в базе данных, или генерируется динамически — нужна возможность описывать формы в JSON-формате.

**Решение:** Создать `@reformer/renderer-json` — обёртку над `renderer-react`, которая:
1. Принимает JSON-схему вместо TypeScript-функции
2. Предоставляет реестр компонентов с предустановленными из `ui-kit`
3. Позволяет регистрировать кастомные компоненты

---

## Архитектура

### 1. JSON Schema Format

**Унифицированный интерфейс JsonNode:**

```typescript
interface JsonNode {
  /** Идентификатор для renderBehavior (hideWhen, patchProps) */
  selector?: string;

  /**
   * Имя компонента из реестра: "Input", "Box", "Section", "Select"
   * Обязательно если нет model.
   */
  component?: string;

  /**
   * Путь к полю формы (модели): "email", "personalData.firstName", "addresses[0].city"
   * Если указан — узел представляет поле формы.
   */
  model?: string;

  /** Props для компонента */
  componentProps?: Record<string, unknown>;

  /** Дочерние узлы */
  children?: JsonNode[];

  /** Обёртка для узла (например, fieldWrapper) */
  wrapper?: JsonNode;
}

interface JsonFormSchema {
  version?: string;
  root: JsonNode;
}
```

**Определение типа узла:**
- Если есть `model` → узел поля формы (FieldRenderNode)
- Если есть только `component` → узел контейнера (ContainerRenderNode)
- `component` + `model` → поле с явно указанным компонентом (например, Select вместо дефолтного Input)

**Пример JSON:**
```json
{
  "root": {
    "component": "Box",
    "componentProps": { "className": "space-y-4" },
    "children": [
      { "model": "email" },
      { "model": "password", "component": "InputPassword" },
      {
        "component": "Section",
        "componentProps": { "title": "Personal Data" },
        "children": [
          { "model": "personalData.firstName" },
          { "model": "personalData.lastName" },
          {
            "model": "personalData.gender",
            "component": "Select",
            "componentProps": { "placeholder": "Выберите пол" }
          }
        ]
      }
    ]
  }
}
```

**Пример с wrapper:**
```json
{
  "model": "email",
  "wrapper": {
    "component": "FormField",
    "componentProps": { "className": "col-span-2" }
  }
}
```

### 2. ComponentRegistry

```typescript
interface ComponentMetadata<P = unknown> {
  component: ComponentType<P>;
  type: 'field' | 'container';
  description?: string;
}

interface ComponentRegistry {
  register<P>(name: string, metadata: ComponentMetadata<P>): this;
  get(name: string): ComponentMetadata | undefined;
  has(name: string): boolean;
  names(): string[];
  extend(): ComponentRegistry;
}
```

**Дефолтный реестр** включает все компоненты из `@reformer/ui-kit`:
- Input, InputPassword, InputMask, Textarea
- Select, Checkbox, RadioGroup
- Box, Section, Collapsible
- FormField, Button

### 2.1 JsonRendererProvider — конфигурация через контекст

Настройки задаются через React Provider. `JsonRendererSettings` расширяет `RendererSettings` из renderer-react:

```typescript
// context/json-renderer-context.tsx

import type { RendererSettings } from '@reformer/renderer-react';

/**
 * Настройки JsonRenderer.
 * Расширяет RendererSettings, добавляя registry.
 */
interface JsonRendererSettings extends RendererSettings {
  /** Реестр компонентов (по умолчанию defaultRegistry) */
  registry?: ComponentRegistry;
}

const JsonRendererContext = createContext<JsonRendererSettings>({});

/**
 * Provider для настройки JsonFormRenderer на уровне приложения/секции.
 */
export function JsonRendererProvider({
  children,
  settings,
}: {
  children: ReactNode;
  settings: JsonRendererSettings;
}) {
  return (
    <JsonRendererContext.Provider value={settings}>
      {children}
    </JsonRendererContext.Provider>
  );
}

/**
 * Hook для получения настроек из контекста.
 */
export function useJsonRendererSettings(): JsonRendererSettings {
  return useContext(JsonRendererContext);
}
```

**Пример инициализации в приложении:**

```tsx
// src/App.tsx
import {
  JsonRendererProvider,
  createDefaultRegistry
} from '@reformer/renderer-json';
import { FormField } from '@reformer/ui-kit';
import { MyDatePicker, MyWizard } from './components';

// Создаём кастомный реестр
const appRegistry = createDefaultRegistry()
  .register('DatePicker', { component: MyDatePicker, type: 'field' })
  .register('CustomWizard', { component: MyWizard, type: 'container' });

function App() {
  return (
    <JsonRendererProvider
      settings={{
        fieldWrapper: FormField,  // из RendererSettings
        registry: appRegistry     // добавленное свойство
      }}
    >
      {/* Все JsonFormRenderer внутри используют эти настройки */}
      <Routes>
        <Route path="/form1" element={<Form1 />} />
        <Route path="/form2" element={<Form2 />} />
      </Routes>
    </JsonRendererProvider>
  );
}
```

**Использование — настройки берутся из контекста:**

```tsx
function Form1() {
  const form = useMemo(() => createMyForm(), []);

  return (
    <JsonFormRenderer
      schema={schema}
      form={form}
      // registry и settings берутся из JsonRendererProvider
    />
  );
}
```

**Локальное переопределение** через вложенный Provider:

```tsx
// Вложенный Provider для секции с другими настройками
<JsonRendererProvider settings={{ registry: specialRegistry }}>
  <JsonFormRenderer schema={schema} form={form} />
</JsonRendererProvider>
```

### 3. JsonFormRenderer

```typescript
interface JsonFormRendererProps<T> {
  /** JSON-схема формы */
  schema: JsonFormSchema;

  /** Форма (FormProxy) */
  form: FormProxy<T>;
}

function JsonFormRenderer<T>(props: JsonFormRendererProps<T>): ReactNode;
```

**Настройки (registry, rendererSettings) берутся из `JsonRendererProvider`.**

Под капотом:
1. Конвертирует JSON в `RenderSchemaFn<T>`
2. Резолвит строковые пути в `FieldPathNode` через навигацию по `FieldPath<T>`
3. Резолвит имена компонентов в React-компоненты через реестр
4. Передаёт результат в `FormRenderer`

---

## Структура пакета

```
packages/reformer-renderer-json/
├── src/
│   ├── index.ts                      # Публичный API
│   ├── types/
│   │   └── json-schema.ts            # JsonFormSchema, JsonNode (унифицированный)
│   ├── registry/
│   │   ├── types.ts                  # ComponentRegistry interface
│   │   ├── component-registry.ts     # Реализация
│   │   └── default-registry.ts       # Реестр с ui-kit компонентами
│   ├── context/
│   │   └── json-renderer-context.tsx # JsonRendererProvider + hook
│   ├── converter/
│   │   └── json-to-render-schema.ts  # Конвертер JSON → RenderSchemaFn
│   └── components/
│       └── json-form-renderer.tsx    # Главный компонент
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

## Зависимости

```json
{
  "peerDependencies": {
    "@reformer/core": ">=1.1.0-beta.0",
    "@reformer/renderer-react": ">=1.0.0-beta.0",
    "@reformer/ui-kit": ">=1.0.0-beta.0",
    "react": "^18.0.0 || ^19.0.0"
  }
}
```

---

## Публичный API

```typescript
// Главный компонент
export { JsonFormRenderer } from './components/json-form-renderer';
export type { JsonFormRendererProps } from './components/json-form-renderer';

// JSON Schema типы
export type { JsonFormSchema, JsonNode } from './types/json-schema';

// Component Registry
export { createComponentRegistry } from './registry/component-registry';
export { createDefaultRegistry, defaultRegistry } from './registry/default-registry';
export type { ComponentRegistry, ComponentMetadata } from './registry/types';

// Context Provider & Settings
export { JsonRendererProvider, useJsonRendererSettings } from './context/json-renderer-context';
export type { JsonRendererSettings } from './context/json-renderer-context';
// Note: JsonRendererSettings extends RendererSettings from @reformer/renderer-react

// Конвертер (для advanced use cases)
export { createRenderSchemaFromJson } from './converter/json-to-render-schema';

// Type guards
export { isFieldNode, isContainerNode } from './converter/json-to-render-schema';
```

---

## Пример использования

### Базовый

```tsx
import { JsonFormRenderer } from '@reformer/renderer-json';
import { FormField } from '@reformer/ui-kit';

const schema = {
  root: {
    component: 'Box',
    children: [
      { model: 'email' },
      { model: 'password', component: 'InputPassword' }
    ]
  }
};

function App() {
  const form = useMemo(() => createLoginForm(), []);
  return (
    <JsonFormRenderer
      schema={schema}
      form={form}
      settings={{ fieldWrapper: FormField }}
    />
  );
}
```

### С кастомным реестром

```tsx
import { JsonFormRenderer, createDefaultRegistry } from '@reformer/renderer-json';
import { MyDatePicker, MyCustomWizard } from './components';

const customRegistry = createDefaultRegistry()
  .register('DatePicker', { component: MyDatePicker, type: 'field' })
  .register('CustomWizard', { component: MyCustomWizard, type: 'container' });

<JsonFormRenderer
  schema={schema}
  form={form}
  registry={customRegistry}
/>
```

---

## Критические файлы для модификации/чтения

| Файл | Действие |
|------|----------|
| `packages/reformer-renderer-react/src/core/types.ts` | Читать — базовые типы RenderNode |
| `packages/reformer-renderer-react/src/core/form-renderer.tsx` | Читать — FormRenderer API |
| `packages/reformer-ui-kit/src/index.ts` | Читать — экспорты для реестра |
| `packages/reformer-renderer-json/` | Создать — новый пакет |
| `package.json` (root) | Добавить workspace |

---

## Verification

1. **Unit tests:** Конвертер JSON → RenderSchema
2. **Integration test:** JsonFormRenderer с простой формой
3. **Example:** Добавить пример в `react-playground`
4. **Build:** Проверить сборку и экспорты

---

## Принятые решения

1. **FormArray** — описывается как отдельный компонент (`component: "FormArray"`) с props `array`, `itemComponent`. Аналогично текущему `RendererFormArraySection`.

2. **RenderBehavior** — остаётся только в TypeScript. JSON описывает layout, behaviors применяются через `RenderSchemaProxy` после конвертации.

3. **Form context** — renderer-json максимально переиспользует renderer-react. Основная задача — интерпретация JSON в RenderSchema + реестр компонентов. Вся работа с состоянием формы остаётся в renderer-react.

---

## Итого

`@reformer/renderer-json` — это тонкая обёртка над `@reformer/renderer-react`:
1. **Парсит JSON** → конвертирует в `RenderSchemaFn`
2. **Резолвит компоненты** → через `ComponentRegistry` преобразует строки в React-компоненты
3. **Делегирует рендеринг** → передаёт результат в `FormRenderer`

Никакой собственной логики работы с формой — только трансляция JSON в существующий API.
