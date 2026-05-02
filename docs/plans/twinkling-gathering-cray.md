# RenderSchema: План реализации

## Контекст

**Цель:** Разделить ответственности в формах ReFormer.

**Зафиксированные решения:**

| Аспект            | Решение                                                |
| ----------------- | ------------------------------------------------------ |
| API               | `RenderSchemaFn<T> = (path) => RenderNode<T>`          |
| Структура узла    | `{ component, componentProps }`                        |
| Типизация         | Union types: `FieldNode \| ContainerNode \| ArrayNode` |
| Массивы           | Компонент `FormArray` с `array` и `renderItem`         |
| Wrapper полей     | `wrapper` prop (по умолчанию `'div'`)                  |
| Стилизация        | Atomic CSS через `className`                           |
| JSON-сериализация | Да (функции только для `hidden`)                       |

---

## Архитектура

```
┌─────────────────────────────────────────────────────────────────┐
│                         ModelSchema                              │
│  (Описание полей: value, component, componentProps, label)      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        RenderSchema                              │
│  (Структура страницы: дерево узлов с component + componentProps)│
├─────────────────────────────────────────────────────────────────┤
│  • FieldRenderNode   - поле формы (path.fieldName)              │
│  • ContainerRenderNode - контейнер (Box, Section, Collapsible)  │
│  • ArrayRenderNode   - массив (FormArray + renderItem)          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        FormRenderer                              │
│  (Рекурсивный рендеринг дерева узлов)                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Типы

```typescript
// ============================================================================
// RENDER SCHEMA
// ============================================================================

type RenderSchemaFn<T> = (path: FieldPath<T>) => RenderNode<T>;

// ============================================================================
// RENDER NODE - дискриминированный union
// ============================================================================

type RenderNode<T> = FieldRenderNode<T> | ContainerRenderNode<T> | ArrayRenderNode<T>;

/** Поле формы */
interface FieldRenderNode<T> {
  component: FieldPathNode<T, any>;
  componentProps?: {
    className?: string;
    wrapper?: ElementType; // 'div' | 'span' | CustomWrapper
    hidden?: (form: FormProxy<T>, path: FieldPath<T>) => boolean;
  };
}

/** Контейнер (Box, Section, Collapsible) */
interface ContainerRenderNode<T> {
  component: ComponentType<any>;
  componentProps?: {
    className?: string;
    children?: RenderNode<T>[];
    hidden?: (form: FormProxy<T>, path: FieldPath<T>) => boolean;
    [key: string]: any; // title, defaultOpen, etc.
  };
}

/** Массив */
interface ArrayRenderNode<T> {
  component: typeof FormArray;
  componentProps: {
    array: FieldPathNode<T, any[]>;
    className?: string;
    renderItem: (itemPath: FieldPath<any>, index: number) => RenderNode<any>;
    hidden?: (form: FormProxy<T>, path: FieldPath<T>) => boolean;
  };
}

// ============================================================================
// FORM RENDERER
// ============================================================================

interface FormRendererProps<T> {
  form: FormProxy<T>;
  render: RenderSchemaFn<T>;
}
```

---

## Примеры

### Базовый

```typescript
const renderSchema: RenderSchemaFn<CreditForm> = (path) => ({
  component: Box,
  componentProps: {
    className: 'flex flex-col gap-6',
    children: [
      {
        component: Section,
        componentProps: {
          title: 'Информация о кредите',
          className: 'grid grid-cols-2 gap-4',
          children: [
            { component: path.loanType, componentProps: { className: 'col-span-2' } },
            { component: path.loanAmount },
            { component: path.loanTerm },
          ],
        },
      },
      {
        component: Section,
        componentProps: {
          title: 'Параметры ипотеки',
          className: 'flex flex-col gap-3',
          hidden: (form) => form.loanType.value.value !== 'mortgage',
          children: [{ component: path.propertyValue }, { component: path.initialPayment }],
        },
      },
    ],
  },
});
```

### С массивами

```typescript
const renderSchema: RenderSchemaFn<OrderForm> = (path) => ({
  component: Box,
  componentProps: {
    className: 'flex flex-col gap-6',
    children: [
      { component: path.customer },
      {
        component: FormArray,
        componentProps: {
          array: path.items,
          className: 'flex flex-col gap-4',
          renderItem: (itemPath, index) => ({
            component: Box,
            componentProps: {
              className: 'grid grid-cols-3 gap-2 p-3 border rounded',
              children: [
                { component: itemPath.product },
                { component: itemPath.quantity },
                { component: itemPath.price },
              ],
            },
          }),
        },
      },
    ],
  },
});
```

### С wrapper

```typescript
// Кастомный wrapper для поля
{
  component: path.email,
  componentProps: {
    wrapper: 'span',  // или CustomFieldWrapper
    className: 'col-span-2'
  }
}
```

---

## Реализация

### Структура файлов

```
packages/reformer/src/core/render/
├── index.ts              # exports
├── types.ts              # RenderSchemaFn, RenderNode, etc.
├── form-renderer.tsx     # FormRenderer
├── render-node.tsx       # RenderNodeComponent (recursive)
├── utils.ts              # isFieldNode, isArrayNode, isContainerNode
└── components/
    ├── box.tsx           # div wrapper
    ├── section.tsx       # section с title
    ├── collapsible.tsx   # сворачиваемая секция
    └── form-array.tsx    # рендеринг массива
```

### Type guards

```typescript
function isFieldNode<T>(node: RenderNode<T>): node is FieldRenderNode<T> {
  return typeof node.component === 'object' && '__fieldPath' in node.component;
}

function isArrayNode<T>(node: RenderNode<T>): node is ArrayRenderNode<T> {
  return node.component === FormArray;
}

function isContainerNode<T>(node: RenderNode<T>): node is ContainerRenderNode<T> {
  return typeof node.component === 'function' && node.component !== FormArray;
}
```

### FormRenderer

```typescript
function FormRenderer<T>({ form, render }: FormRendererProps<T>) {
  const path = createFieldPath<T>();
  const rootNode = render(path);
  return <RenderNodeComponent node={rootNode} form={form} path={path} />;
}

function RenderNodeComponent<T>({ node, form, path }: Props<T>) {
  const { componentProps = {} } = node;

  // hidden check
  if (componentProps.hidden?.(form, path)) return null;

  // FieldRenderNode
  if (isFieldNode(node)) {
    const { className, wrapper: Wrapper = 'div' } = componentProps;
    const fieldNode = getFieldByPathNode(form, node.component);
    return (
      <Wrapper className={className}>
        <FormField control={fieldNode} />
      </Wrapper>
    );
  }

  // ArrayRenderNode
  if (isArrayNode(node)) {
    const { array, className, renderItem } = componentProps;
    const arrayNode = getFieldByPathNode(form, array);
    return (
      <div className={className}>
        {arrayNode.controls.map((item, index) => {
          const itemPath = createFieldPath<any>();
          return (
            <RenderNodeComponent
              key={index}
              node={renderItem(itemPath, index)}
              form={item}
              path={itemPath}
            />
          );
        })}
      </div>
    );
  }

  // ContainerRenderNode
  if (isContainerNode(node)) {
    const { children, hidden, ...restProps } = componentProps;
    const Component = node.component;
    return (
      <Component {...restProps}>
        {children?.map((child, i) => (
          <RenderNodeComponent key={i} node={child} form={form} path={path} />
        ))}
      </Component>
    );
  }

  return null;
}
```

---

## План реализации

### Фаза 1: Типы

- [x] `types.ts` - RenderSchemaFn, RenderNode (union), FieldRenderNode, ContainerRenderNode, ArrayRenderNode
- [x] `utils.ts` - type guards (isFieldRenderNode, isArrayRenderNode, isContainerRenderNode)

### Фаза 2: FormRenderer

- [x] `form-renderer.tsx` - FormRenderer компонент
- [x] `render-node.tsx` - RenderNodeComponent (рекурсивный)

### Фаза 3: Компоненты

- [x] `box.tsx` - простой div
- [x] `section.tsx` - секция с title
- [x] `collapsible.tsx` - сворачиваемая секция
- [x] `form-array.tsx` - рендеринг массивов

### Фаза 4: Интеграция

- [x] Экспорты в index.ts
- [x] Пример в playground (`projects/react-playground/src/pages/examples/render-schema/`)

---

## Верификация

1. Создать тестовую форму с RenderSchema
2. Проверить рендеринг полей, секций, массивов
3. Проверить hidden условия
4. Проверить wrapper prop
5. TypeScript - нет ошибок типизации
