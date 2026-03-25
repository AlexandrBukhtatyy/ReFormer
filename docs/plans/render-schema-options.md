# RenderSchema - Варианты реализации

## Текущая архитектура reformer

Сейчас библиотека использует 3 схемы:

1. **FormSchema** (`deep-schema.ts`) - структура модели с `value` и `component`
2. **ValidationSchema** (`validation-schema.ts`) - правила валидации
3. **BehaviorSchema** (`behavior/types.ts`) - поведение формы (зависимости между полями)

В текущей архитектуре `component` встроен в `FieldConfig`, но это просто ссылка на компонент, без полноценного описания рендеринга.

---

## Варианты реализации RenderSchema

### Вариант 1: Отдельная RenderSchema (декларативный JSON)

Полностью отделяем описание UI от FormSchema:

```typescript
// Типы
interface RenderSchema<T> {
  layout: 'vertical' | 'horizontal' | 'grid';
  columns?: number;
  sections?: Section[];
  fields: FieldRender<T>;
}

interface FieldRender<K> {
  [fieldName: string]: {
    component: string | ComponentType; // 'input' | 'select' | CustomComponent
    label?: string;
    placeholder?: string;
    className?: string;
    span?: number; // grid column span
    order?: number;
    hidden?: (ctx: FormContext) => boolean;
    // wrapper для кастомизации обёртки
    wrapper?: ComponentType<{ children: ReactNode }>;
  };
}

// Использование
const renderSchema: RenderSchema<MyForm> = {
  layout: 'grid',
  columns: 2,
  sections: [
    { title: 'Personal', fields: ['firstName', 'lastName'] },
    { title: 'Contact', fields: ['email', 'phone'] }
  ],
  fields: {
    firstName: { component: 'input', label: 'First Name', span: 1 },
    email: { component: 'input', label: 'Email', span: 2 }
  }
};
```

**Плюсы:**
- Полное разделение данных и UI
- JSON-сериализуемо (можно хранить в БД)
- Лёгкая смена темы/layout без изменения формы

**Минусы:**
- Дублирование полей между FormSchema и RenderSchema
- Нужен registry компонентов для string-идентификаторов

---

### Вариант 2: Расширение FieldConfig (минимальные изменения)

Добавляем `render` объект в существующий FieldConfig:

```typescript
interface FieldConfig<T> {
  value: T | null;
  component: ComponentType<any>;
  componentProps?: any;
  validators?: ValidatorFn<T>[];
  // NEW: render options
  render?: {
    label?: string;
    placeholder?: string;
    className?: string;
    span?: number;
    order?: number;
    section?: string;
    hidden?: boolean | ((ctx: FormContext) => boolean);
  };
}
```

**Плюсы:**
- Минимальные изменения API
- Всё в одном месте - легко понять структуру поля
- Backward compatible

**Минусы:**
- FormSchema становится большой
- Нельзя сериализовать в JSON (компоненты)

---

### Вариант 3: RenderSchema как функция (аналогично ValidationSchema)

Следуем существующему паттерну с FieldPath:

```typescript
type RenderSchemaFn<T> = (path: FieldPath<T>, render: RenderAPI) => void;

interface RenderAPI {
  field<T>(path: FieldPath<T>, options: RenderFieldOptions): void;
  section(name: string, fields: FieldPath<any>[], options?: SectionOptions): void;
  layout(type: 'grid' | 'flex', options?: LayoutOptions): void;
  when<T>(path: FieldPath<T>, condition: (v: T) => boolean, render: () => void): void;
}

// Использование
const renderSchema: RenderSchemaFn<MyForm> = (path, render) => {
  render.layout('grid', { columns: 2 });

  render.section('Personal', [path.firstName, path.lastName]);

  render.field(path.firstName, {
    component: TextField,
    label: 'First Name',
    span: 1
  });

  render.when(path.hasPhone, (v) => v === true, () => {
    render.field(path.phone, { component: PhoneInput, label: 'Phone' });
  });
};
```

**Плюсы:**
- Консистентно с ValidationSchema и BehaviorSchema
- Type-safe через FieldPath
- Поддержка условного рендеринга

**Минусы:**
- Сложнее сериализовать
- Императивный стиль может быть непривычен

---

### Вариант 4: Гибридный подход с компонентом `<FormRenderer>`

RenderSchema как JSON + высокоуровневый компонент:

```typescript
// Schema (JSON-сериализуемая)
interface UISchema<T> {
  layout: LayoutConfig;
  fields: Record<keyof T, UIFieldConfig>;
}

interface UIFieldConfig {
  type: 'text' | 'email' | 'select' | 'checkbox' | 'custom';
  label?: string;
  placeholder?: string;
  gridArea?: string;
  // для type: 'custom'
  componentName?: string;
}

// Использование
<FormRenderer
  form={form}
  uiSchema={uiSchema}
  components={{ custom: MyCustomField }}
/>
```

**Плюсы:**
- JSON Schema для UI (можно генерировать на сервере)
- Один компонент для рендеринга всей формы
- Легко интегрировать с дизайн-системами

**Минусы:**
- Меньше гибкости для кастомных случаев
- Нужен registry компонентов

---

## Рекомендация

Для reformer рекомендуется **Вариант 3 (RenderSchema как функция)** по причинам:

1. **Консистентность** - такой же паттерн как ValidationSchema и BehaviorSchema
2. **Type-safety** - FieldPath обеспечивает проверку типов
3. **Гибкость** - можно делать условный рендеринг через обычный JS

С возможностью **комбинировать с Вариантом 4** - добавить `<FormRenderer>` компонент который может работать как с функциональной RenderSchema, так и с JSON UISchema.

---

## Следующие шаги

1. Определить минимальный набор свойств для `RenderFieldOptions`
2. Спроектировать API для `RenderAPI`
3. Реализовать `FormRenderer` компонент
4. Добавить поддержку layout (grid/flex)
5. Добавить условный рендеринг
