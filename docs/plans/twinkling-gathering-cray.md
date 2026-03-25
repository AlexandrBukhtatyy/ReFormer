# RenderSchema: План реализации

## Контекст

**Цель:** Разделить ответственности в формах ReFormer.

**Принятые решения:**
- **RenderSchema = функция** `(path) => RenderNode` возвращает **объект**
- **Узел имеет только 2 свойства:** `component` и `componentProps`
- `component` может быть: FieldPathNode (поле формы) или React компонент (Box, Section, etc.)
- ModelSchema содержит все свойства компонентов (component, componentProps, label, placeholder)
- **Вся стилизация через atomic CSS в `className`**

---

## Архитектура

### Разделение ответственностей

```
┌─────────────────────────────────────────────────────────────────┐
│                         ModelSchema                              │
│  (ЧТО отображать - описание полей)                              │
├─────────────────────────────────────────────────────────────────┤
│  • value - начальное значение                                   │
│  • component - React компонент (Input, Select, etc.)            │
│  • componentProps - label, placeholder, options и т.д.          │
│  • disabled, updateOn, debounce - поведение поля                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        RenderSchema                              │
│  (КАК и ГДЕ отображать - структура страницы)                    │
├─────────────────────────────────────────────────────────────────┤
│  • component - FieldPathNode или React компонент                │
│  • componentProps:                                              │
│    - className - atomic CSS (grid, gap, span)                   │
│    - children - вложенные узлы                                  │
│    - hidden - функция условия скрытия                           │
│    - любые props для компонента                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        FormRenderer                              │
│  (Рекурсивный рендеринг дерева)                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Типы

### RenderSchema (функциональный подход)

```typescript
// ============================================================================
// RENDER SCHEMA FUNCTION
// ============================================================================

type RenderSchemaFn<T> = (path: FieldPath<T>) => RenderNode<T>;

// ============================================================================
// RENDER NODE - дискриминированный union
// ============================================================================

type RenderNode<T> =
  | FieldRenderNode<T>
  | ContainerRenderNode<T>
  | ArrayRenderNode<T>;

/** Узел для поля формы */
interface FieldRenderNode<T> {
  component: FieldPathNode<T, any>;
  componentProps?: {
    className?: string;
    wrapper?: ElementType;  // 'div' | 'span' | CustomWrapper
    hidden?: (form: FormProxy<T>, path: FieldPath<T>) => boolean;
  };
}

/** Узел-контейнер (Box, Section, Collapsible) */
interface ContainerRenderNode<T> {
  component: ComponentType<any>;
  componentProps?: {
    className?: string;
    children?: RenderNode<T>[];
    hidden?: (form: FormProxy<T>, path: FieldPath<T>) => boolean;
    [key: string]: any;  // title, collapsible, etc.
  };
}

/** Узел для массива */
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
// TYPE ALIASES
// ============================================================================

type ModelSchema<T> = FormSchema<T>;
```

### FormRenderer Props

```typescript
interface FormRendererProps<T> {
  /** Экземпляр формы (GroupNode) */
  form: FormProxy<T>;

  /** Функция рендеринга */
  render: RenderSchemaFn<T>;
}
```

---

## Примеры использования

### Базовый пример

```typescript
interface CreditForm {
  loanType: string;
  loanAmount: number;
  loanTerm: number;
  propertyValue: number;
  initialPayment: number;
  carBrand: string;
  carModel: string;
}

// ModelSchema - полное описание полей (как сейчас)
const modelSchema: ModelSchema<CreditForm> = {
  loanType: {
    value: 'consumer',
    component: Select,
    componentProps: {
      label: 'Тип кредита',
      placeholder: 'Выберите тип',
      options: [
        { value: 'consumer', label: 'Потребительский' },
        { value: 'mortgage', label: 'Ипотека' },
        { value: 'car', label: 'Автокредит' },
      ],
    },
  },
  loanAmount: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Сумма кредита',
      type: 'number',
    },
  },
  // ... остальные поля
};

// RenderSchema - функция с type-safe path, возвращает ОБЪЕКТ
const renderSchema: RenderSchemaFn<CreditForm> = (path) => ({
  component: Box,  // или 'div'
  componentProps: {
    className: 'flex flex-col gap-6',
    children: [
      // Секция с информацией о кредите
      {
        component: Section,
        componentProps: {
          title: 'Информация о кредите',
          className: 'grid grid-cols-2 gap-4',
          children: [
            { component: path.loanType, componentProps: { className: 'col-span-2', wrapper: 'div' } },
            { component: path.loanAmount },
            { component: path.loanTerm },
          ],
        },
      },

      // Секция ипотеки (показывается условно)
      {
        component: Section,
        componentProps: {
          title: 'Параметры ипотеки',
          className: 'flex flex-col gap-3 p-4 bg-gray-50 rounded',
          hidden: (form) => form.loanType.value.value !== 'mortgage',
          children: [
            { component: path.propertyValue },
            { component: path.initialPayment },
          ],
        },
      },

      // Секция автокредита
      {
        component: Section,
        componentProps: {
          title: 'Параметры автокредита',
          className: 'grid grid-cols-2 gap-3',
          hidden: (form) => form.loanType.value.value !== 'car',
          children: [
            { component: path.carBrand },
            {
              component: path.carModel,
              componentProps: {
                hidden: (form) => !form.carBrand.value.value,
              },
            },
          ],
        },
      },
    ],
  },
});

// Использование
const form = createForm({ form: modelSchema });

function CreditApplication() {
  return <FormRenderer form={form} render={renderSchema} />;
}
```

### Пример с вложенными полями

```typescript
interface AddressForm {
  personalInfo: {
    firstName: string;
    lastName: string;
  };
  address: {
    city: string;
    street: string;
    building: string;
  };
}

const renderSchema: RenderSchemaFn<AddressForm> = (path) => ({
  component: Box,
  componentProps: {
    className: 'flex flex-col gap-6',
    children: [
      {
        component: Section,
        componentProps: {
          title: 'Личные данные',
          className: 'grid grid-cols-2 gap-4',
          children: [
            { component: path.personalInfo.firstName },
            { component: path.personalInfo.lastName },
          ],
        },
      },
      {
        component: Section,
        componentProps: {
          title: 'Адрес',
          className: 'grid grid-cols-3 gap-4',
          children: [
            { component: path.address.city },
            { component: path.address.street, componentProps: { className: 'col-span-2' } },
            { component: path.address.building },
          ],
        },
      },
    ],
  },
});
```

### Пример с collapsible секциями

```typescript
const renderSchema: RenderSchemaFn<ExtendedForm> = (path) => ({
  component: Box,
  componentProps: {
    className: 'flex flex-col gap-6',
    children: [
      {
        component: Section,
        componentProps: {
          title: 'Основная информация',
          className: 'flex flex-col gap-3',
          children: [
            { component: path.name },
            { component: path.email },
            { component: path.phone },
          ],
        },
      },
      {
        component: Collapsible,  // отдельный компонент для сворачивания
        componentProps: {
          title: 'Дополнительная информация',
          defaultOpen: false,
          className: 'flex flex-col gap-3',
          children: [
            { component: path.company },
            { component: path.position },
            { component: path.website },
          ],
        },
      },
    ],
  },
});
```

### Пример с массивами

```typescript
interface OrderForm {
  customer: string;
  items: Array<{
    product: string;
    quantity: number;
    price: number;
  }>;
}

const renderSchema: RenderSchemaFn<OrderForm> = (path) => ({
  component: Box,
  componentProps: {
    className: 'flex flex-col gap-6',
    children: [
      {
        component: Section,
        componentProps: {
          title: 'Заказчик',
          children: [
            { component: path.customer },
          ],
        },
      },
      // Массив товаров
      {
        component: FormArray,  // специальный компонент для массивов
        componentProps: {
          array: path.items,
          className: 'flex flex-col gap-4',
          itemRender: (itemPath, index) => ({
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

---

## Реализация

### Структура файлов

```
packages/reformer/src/
├── core/
│   ├── types/
│   │   ├── render-schema.ts      # RenderSchemaFn, RenderNode
│   │   └── index.ts              # + export render types
│   └── render/
│       ├── index.ts              # public exports
│       ├── form-renderer.tsx     # FormRenderer component
│       ├── render-node.tsx       # RenderNode component (recursive)
│       ├── utils.ts              # isFieldPath
│       └── components/
│           ├── box.tsx           # простой контейнер (div)
│           ├── section.tsx       # секция с title
│           ├── collapsible.tsx   # сворачиваемая секция
│           └── form-array.tsx    # рендеринг массива
└── index.ts                      # + export FormRenderer, Box, Section, etc.
```

### Ключевые функции

```typescript
// utils.ts

/** Type guard для FieldRenderNode */
function isFieldNode<T>(node: RenderNode<T>): node is FieldRenderNode<T> {
  return node.component && typeof node.component === 'object' && '__fieldPath' in node.component;
}

/** Type guard для ArrayRenderNode */
function isArrayNode<T>(node: RenderNode<T>): node is ArrayRenderNode<T> {
  return node.component === FormArray;
}

/** Type guard для ContainerRenderNode */
function isContainerNode<T>(node: RenderNode<T>): node is ContainerRenderNode<T> {
  return typeof node.component === 'function' && node.component !== FormArray;
}
```

### FormRenderer (псевдокод)

```typescript
function FormRenderer<T>({ form, render }: FormRendererProps<T>) {
  const path = createFieldPath<T>();
  const rootNode = render(path);

  return <RenderNodeComponent node={rootNode} form={form} path={path} />;
}

function RenderNodeComponent<T>({ node, form, path }: RenderNodeProps<T>) {
  const { componentProps = {} } = node;
  const { hidden } = componentProps;

  // Проверяем hidden
  if (hidden?.(form, path)) return null;

  // FieldRenderNode - поле формы
  if (isFieldNode(node)) {
    const { className, wrapper: Wrapper = 'div' } = componentProps;
    const fieldNode = getFieldByPathNode(form, node.component);

    return (
      <Wrapper className={className}>
        <FormField control={fieldNode} />
      </Wrapper>
    );
  }

  // ArrayRenderNode - массив
  if (isArrayNode(node)) {
    const { array, className, renderItem } = componentProps;
    const arrayNode = getFieldByPathNode(form, array);

    return (
      <div className={className}>
        {arrayNode.controls.map((item, index) => {
          const itemPath = createFieldPath<any>();
          const itemNode = renderItem(itemPath, index);
          return (
            <RenderNodeComponent
              key={index}
              node={itemNode}
              form={item}
              path={itemPath}
            />
          );
        })}
      </div>
    );
  }

  // ContainerRenderNode - контейнер (Box, Section, Collapsible)
  if (isContainerNode(node)) {
    const { children, ...restProps } = componentProps;
    const Component = node.component;

    const renderedChildren = children?.map((child, index) => (
      <RenderNodeComponent key={index} node={child} form={form} path={path} />
    ));

    return <Component {...restProps}>{renderedChildren}</Component>;
  }

  return null;
}
```

---

## План реализации

### Фаза 1: Типы и утилиты
- [ ] Создать `render-schema.ts` с типами (RenderSchemaFn, RenderNode)
- [ ] Реализовать `utils.ts` (isFieldPath)
- [ ] Добавить экспорты в index.ts

### Фаза 2: FormRenderer и RenderNode
- [ ] Реализовать `FormRenderer` компонент
- [ ] Реализовать `RenderNode` (рекурсивный рендеринг)

### Фаза 3: Layout компоненты
- [ ] `Box` - простой контейнер
- [ ] `Section` - секция с заголовком
- [ ] `Collapsible` - сворачиваемая секция
- [ ] `FormArray` - рендеринг массивов

### Фаза 4: Примеры
- [ ] Пример в playground: credit-application с RenderSchema
- [ ] Пример с массивами

---

## Оценка и рекомендации

### Зафиксированные решения

| Проблема | Решение |
|----------|---------|
| **Verbosity** | Оставить `componentProps` - единообразие важнее |
| **FormArray** | Явный компонент `FormArray` с `array` и `renderItem` props |
| **Type safety** | Union types сразу: `FieldNode \| ContainerNode \| ArrayNode` |
| **Wrapper** | Добавить `wrapper` prop для полей |
| **JSON-сериализация** | Да, функции только для `hidden` |

### Финальная структура типов

```typescript
// ============================================================================
// RENDER NODE - дискриминированный union
// ============================================================================

type RenderNode<T> =
  | FieldRenderNode<T>
  | ContainerRenderNode<T>
  | ArrayRenderNode<T>;

/** Узел для поля формы */
interface FieldRenderNode<T> {
  component: FieldPathNode<T, any>;
  componentProps?: {
    className?: string;
    wrapper?: ElementType;  // 'div' | 'span' | CustomWrapper
    hidden?: (form: FormProxy<T>, path: FieldPath<T>) => boolean;
  };
}

/** Узел-контейнер (Box, Section, Collapsible) */
interface ContainerRenderNode<T> {
  component: ComponentType<any>;
  componentProps?: {
    className?: string;
    children?: RenderNode<T>[];
    hidden?: (form: FormProxy<T>, path: FieldPath<T>) => boolean;
    // + любые props компонента (title, collapsible, etc.)
    [key: string]: any;
  };
}

/** Узел для массива */
interface ArrayRenderNode<T> {
  component: typeof FormArray;
  componentProps: {
    array: FieldPathNode<T, any[]>;
    className?: string;
    renderItem: (itemPath: FieldPath<any>, index: number) => RenderNode<any>;
    hidden?: (form: FormProxy<T>, path: FieldPath<T>) => boolean;
  };
}
```

---

## Принятые решения по открытым вопросам

### ArrayNode в layout
**Решение:** Компонент `FormArray` с `itemRender`

```typescript
{
  component: FormArray,
  componentProps: {
    array: path.contacts,
    className: 'flex flex-col gap-4',
    itemRender: (itemPath, index) => ({
      component: Box,
      componentProps: {
        className: 'p-3 border rounded',
        children: [
          { component: itemPath.name },
          { component: itemPath.phone },
        ],
      },
    }),
  },
}
```

### Responsive layout
**Решение:** Через atomic CSS классы

```typescript
{
  component: Box,
  componentProps: {
    className: 'grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4',
    children: [
      { component: path.name },
      { component: path.email },
    ],
  },
}
```

### Секции и Collapsible
**Решение:** Обычные React компоненты

```typescript
// Секция с заголовком
{ component: Section, componentProps: { title: 'Заголовок', children: [...] } }

// Сворачиваемая секция
{ component: Collapsible, componentProps: { title: 'Заголовок', defaultOpen: false, children: [...] } }
```
