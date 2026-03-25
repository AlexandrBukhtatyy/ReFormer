# План: Разделение FormSchema на ModelSchema и RenderSchema

## Контекст

Текущий `FieldConfig` объединяет две ответственности:
- **Модель данных:** value, validators, disabled, updateOn, debounce
- **Рендеринг:** component, componentProps

**Проблема:** Смешение ответственностей усложняет сериализацию и переиспользование.

**Решение:** Разделить на ModelSchema + RenderSchema.

### Принятые решения
- **Breaking change:** Допустим
- **Validators:** Только в ValidationSchema
- **render.fields:** Опционально (неописанные поля не рендерятся)
- **FormRenderer:** Создать сразу
- **componentProps:** Оставить в FieldNode как сигнал для динамического обновления

---

## Архитектура

```
┌─────────────────────────────────────────────────────────────┐
│                       createForm()                          │
├─────────────┬─────────────┬─────────────┬──────────────────┤
│ ModelSchema │ RenderSchema│ Validation  │ BehaviorSchema   │
│  (данные)   │    (UI)     │  Schema     │  (поведение)     │
├─────────────┼─────────────┼─────────────┼──────────────────┤
│ • value     │ • component │ • required  │ • watchField     │
│ • disabled  │ • label     │ • email     │ • computeFrom    │
│ • updateOn  │ • sections  │ • validate  │ • enableWhen     │
│ • debounce  │ • layout    │ • applyWhen │ • copyFrom       │
└─────────────┴─────────────┴─────────────┴──────────────────┘
```

---

## Типы

### ModelSchema

```typescript
// src/core/types/model-schema.ts

interface ModelFieldConfig<T> {
  value: T | null;
  disabled?: boolean;
  updateOn?: 'change' | 'blur' | 'submit';
  debounce?: number;
}

type ModelSchema<T> = {
  [K in keyof T]: NonNullable<T[K]> extends string | number | boolean | Date | File
    ? ModelFieldConfig<T[K]>
    : NonNullable<T[K]> extends Array<infer U>
      ? [ModelSchema<U>]
      : ModelSchema<NonNullable<T[K]>>;
};
```

### RenderSchema

```typescript
// src/core/types/render-schema.ts

interface RenderFieldConfig {
  component: ComponentType<any>;
  componentProps?: Record<string, any>;
  label?: string;
  placeholder?: string;
  className?: string;
  span?: number;
  order?: number;
  hidden?: boolean | ((ctx: FormContext) => boolean);
}

interface SectionConfig {
  title: string;
  description?: string;
  fields: string[];
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  className?: string;
}

interface RenderSchema<T> {
  layout?: 'vertical' | 'horizontal' | 'grid';
  columns?: number;
  gap?: string;
  className?: string;

  sections?: SectionConfig[];

  // Опционально - неописанные поля не рендерятся
  fields?: {
    [K in keyof T]?: T[K] extends object
      ? RenderFieldConfig | RenderSchema<T[K]>
      : RenderFieldConfig;
  };
}
```

### FormConfig

```typescript
// src/core/types/form-config.ts

interface FormConfig<T> {
  model: ModelSchema<T>;
  render: RenderSchema<T>;
  validation?: ValidationSchemaFn<T>;
  behavior?: BehaviorSchemaFn<T>;
}
```

---

## Пример использования

```typescript
interface UserForm {
  email: string;
  password: string;
  profile: {
    firstName: string;
    lastName: string;
  };
}

// MODEL (сериализуемо, можно загрузить с сервера)
const model: ModelSchema<UserForm> = {
  email: { value: '' },
  password: { value: '' },
  profile: {
    firstName: { value: '' },
    lastName: { value: '' }
  }
};

// RENDER
const render: RenderSchema<UserForm> = {
  layout: 'grid',
  columns: 2,

  sections: [
    { title: 'Авторизация', fields: ['email', 'password'] },
    { title: 'Профиль', fields: ['profile'], collapsible: true }
  ],

  fields: {
    email: { component: Input, label: 'Email', span: 2 },
    password: { component: PasswordInput, label: 'Пароль' },
    profile: {
      layout: 'horizontal',
      fields: {
        firstName: { component: Input, label: 'Имя' },
        lastName: { component: Input, label: 'Фамилия' }
      }
    }
  }
};

// VALIDATION
const validation: ValidationSchemaFn<UserForm> = (path) => {
  required(path.email);
  email(path.email);
  required(path.password);
  minLength(path.password, 8);
};

// CREATE FORM
const form = createForm<UserForm>({ model, render, validation });

// RENDER (автоматически)
<FormRenderer form={form} />

// ИЛИ вручную
<FormField control={form.email} render={render.fields.email} />
```

---

## FormRenderer

```typescript
// src/core/render/form-renderer.tsx

interface FormRendererProps<T> {
  form: FormProxy<T>;
  render: RenderSchema<T>;
  className?: string;
}

function FormRenderer<T>({ form, render, className }: FormRendererProps<T>) {
  // Если есть sections - рендерим по секциям
  if (render.sections) {
    return (
      <div className={cn(getLayoutClass(render), className)}>
        {render.sections.map(section => (
          <Section key={section.title} config={section}>
            {section.fields.map(fieldName => (
              <RenderField
                key={fieldName}
                control={form[fieldName]}
                config={render.fields?.[fieldName]}
              />
            ))}
          </Section>
        ))}
      </div>
    );
  }

  // Иначе рендерим все поля из render.fields
  return (
    <div className={cn(getLayoutClass(render), className)}>
      {Object.entries(render.fields || {}).map(([name, config]) => (
        <RenderField key={name} control={form[name]} config={config} />
      ))}
    </div>
  );
}
```

---

## Файлы для изменения

### Новые файлы
```
src/core/types/model-schema.ts      # ModelFieldConfig, ModelSchema
src/core/types/render-schema.ts     # RenderFieldConfig, RenderSchema, SectionConfig
src/core/types/form-config.ts       # FormConfig
src/core/render/index.ts            # экспорты
src/core/render/form-renderer.tsx   # FormRenderer компонент
src/core/render/render-field.tsx    # RenderField компонент
src/core/render/section.tsx         # Section компонент
```

### Изменяемые файлы
```
src/core/types/index.ts             # новые экспорты
src/core/types/deep-schema.ts       # deprecated или удалить FieldConfig
src/core/factories/node-factory.ts  # поддержка ModelSchema (без component)
src/core/nodes/field-node.ts        # убрать validators, оставить componentProps
src/core/utils/create-form.ts       # новая сигнатура { model, render, ... }
src/index.ts                        # экспорт FormRenderer
```

---

## Этапы реализации

### Этап 1: Типы (без изменения существующего кода)
- [ ] Создать `model-schema.ts`
- [ ] Создать `render-schema.ts`
- [ ] Создать `form-config.ts`
- [ ] Обновить экспорты

### Этап 2: NodeFactory и FieldNode
- [ ] Обновить `isFieldConfig` - теперь без component
- [ ] Убрать validators из FieldNode конструктора
- [ ] Оставить componentProps сигнал
- [ ] Тесты

### Этап 3: createForm
- [ ] Новая сигнатура `createForm({ model, render, validation, behavior })`
- [ ] Интеграция с ValidationRegistry
- [ ] Тесты

### Этап 4: FormRenderer
- [ ] Компонент FormRenderer
- [ ] Компонент RenderField
- [ ] Компонент Section
- [ ] Поддержка layout (grid/flex)
- [ ] Поддержка hidden условий

### Этап 5: Примеры и документация
- [ ] Обновить playground примеры
- [ ] Обновить документацию
- [ ] Migration guide

---

## Верификация

1. **Unit тесты:**
   - ModelSchema типизация
   - RenderSchema типизация
   - NodeFactory с новым форматом
   - FormRenderer рендеринг

2. **Integration тесты:**
   - Полный цикл: model → render → validation → behavior
   - Динамическое обновление componentProps
   - Условный рендеринг (hidden)

3. **Playground:**
   - Пример с новым API
   - Сравнение со старым подходом
