# План: Наглядная демонстрация принципов работы ReFormer

## Цель

Создать документацию в формате Markdown + Mermaid для наглядной демонстрации всех ключевых концепций ReFormer.

---

## 1. Структура документации

```
docs/
├── architecture.md      # Общая архитектура
├── signals.md           # Signals и реактивность
├── behaviors.md         # Система behaviors
├── validation.md        # Валидация
├── type-safety.md       # Типобезопасность
└── examples.md          # Полные примеры
```

---

## 2. Архитектура (architecture.md)

### 2.1 Общая структура

```mermaid
flowchart TB
    subgraph Input["Конфигурация"]
        FS[FormSchema<T>]
        VS[ValidationSchema]
        BS[BehaviorSchema]
    end

    CF[createForm<T>]

    subgraph Core["Ядро ReFormer"]
        GN[GroupNode<T>]

        subgraph Nodes["Узлы"]
            FN1[FieldNode<br/>email]
            FN2[FieldNode<br/>password]
            GN2[GroupNode<br/>address]
            AN[ArrayNode<br/>items]
        end

        subgraph Registries["Реестры"]
            VR[ValidationRegistry]
            BR[BehaviorRegistry]
        end
    end

    subgraph Signals["Signals Layer"]
        S1[value]
        S2[errors]
        S3[touched]
        S4[valid]
        S5[pending]
    end

    subgraph React["React Integration"]
        UFC[useFormControl]
        UFCV[useFormControlValue]
        RC[React Components]
    end

    FS --> CF
    VS --> CF
    BS --> CF
    CF --> GN
    GN --> Nodes
    GN --> Registries
    Nodes --> Signals
    Signals --> React
```

### 2.2 Иерархия узлов

```mermaid
classDiagram
    class FormNode~T~ {
        <<abstract>>
        +value: Signal~T~
        +errors: Signal~ValidationError[]~
        +touched: Signal~boolean~
        +dirty: Signal~boolean~
        +valid: Signal~boolean~
        +pending: Signal~boolean~
        +disabled: Signal~boolean~
        +setValue(value: T)
        +validate()
        +markAsTouched()
        +reset()
    }

    class FieldNode~T~ {
        -_value: Signal~T~
        -validators: Validator[]
        -asyncValidators: AsyncValidator[]
        +component: Component
        +componentProps: Signal
        +shouldShowError: Signal~boolean~
    }

    class GroupNode~T~ {
        -_fields: Map~string, FormNode~
        +getFieldByPath(path): FormNode
        +getValue(): T
        +patchValue(partial: Partial~T~)
    }

    class ArrayNode~T~ {
        -_items: Signal~GroupNode[]~
        +push(item: T)
        +remove(index: number)
        +insert(index: number, item: T)
        +map(fn): Result[]
    }

    FormNode <|-- FieldNode
    FormNode <|-- GroupNode
    FormNode <|-- ArrayNode
    GroupNode *-- FormNode : contains
    ArrayNode *-- GroupNode : contains
```

---

## 3. Signals и реактивность (signals.md)

### 3.1 Как работают Signals

```mermaid
sequenceDiagram
    participant User as Пользователь
    participant Input as Input Component
    participant FN as FieldNode
    participant Signal as Signal<T>
    participant Computed as Computed Signals
    participant React as React Component

    User->>Input: Вводит "test@mail.com"
    Input->>FN: setValue("test@mail.com")
    FN->>Signal: _value.value = "test@mail.com"
    Signal-->>Computed: Уведомление об изменении
    Computed->>Computed: Пересчёт valid, dirty
    Signal-->>React: Подписчик получает новое значение
    React->>React: Re-render ТОЛЬКО этого компонента
```

### 3.2 Сравнение подходов

```mermaid
flowchart LR
    subgraph Traditional["Традиционный подход"]
        direction TB
        T1[Изменение поля email]
        T2[Re-render всей формы]
        T3[Re-render email]
        T4[Re-render password]
        T5[Re-render submit]
        T1 --> T2
        T2 --> T3
        T2 --> T4
        T2 --> T5
    end

    subgraph ReFormer["ReFormer (Signals)"]
        direction TB
        R1[Изменение поля email]
        R2[Обновление signal]
        R3[Re-render ТОЛЬКО email]
        R1 --> R2
        R2 --> R3
    end
```

### 3.3 Агрегация состояния

```mermaid
flowchart BT
    subgraph Fields["Поля"]
        E_valid[email.valid = true]
        P_valid[password.valid = false]
        N_valid[name.valid = true]
    end

    subgraph Form["Форма"]
        F_valid["form.valid = computed(() =>
            email.valid && password.valid && name.valid)
            = false"]
    end

    E_valid --> F_valid
    P_valid --> F_valid
    N_valid --> F_valid
```

---

## 4. Система Behaviors (behaviors.md)

### 4.1 computeFrom

```mermaid
flowchart LR
    subgraph Sources["Источники"]
        price[price: 100]
        quantity[quantity: 3]
    end

    subgraph Behavior["computeFrom"]
        fn["(values) =>
        values.price * values.quantity"]
    end

    subgraph Target["Результат"]
        total[total: 300]
    end

    price -->|watch| Behavior
    quantity -->|watch| Behavior
    Behavior -->|setValue| total
```

**Код:**

```typescript
computeFrom([path.price, path.quantity], path.total, (values) => values.price * values.quantity, {
  debounce: 100,
});
```

### 4.2 enableWhen

```mermaid
stateDiagram-v2
    [*] --> Disabled: hasDiscount = false
    Disabled --> Enabled: hasDiscount = true
    Enabled --> Disabled: hasDiscount = false

    Enabled: discountPercent поле активно
    Disabled: discountPercent поле disabled
```

**Код:**

```typescript
enableWhen(path.discountPercent, (form) => form.hasDiscount, { resetOnDisable: true });
```

### 4.3 watchField

```mermaid
sequenceDiagram
    participant User as Пользователь
    participant Country as country field
    participant Watch as watchField effect
    participant API as External API
    participant City as city field

    User->>Country: Выбирает "Russia"
    Country->>Watch: Signal изменился
    Note over Watch: debounce 300ms
    Watch->>API: fetchCities("Russia")
    API-->>Watch: ["Moscow", "SPb", ...]
    Watch->>City: updateComponentProps({ options })
    Watch->>City: setValue(null)
```

**Код:**

```typescript
watchField(
  path.country,
  async (country, ctx) => {
    const cities = await fetchCities(country);
    ctx.updateComponentProps(path.city, { options: cities });
    ctx.form.city.setValue(null);
  },
  { debounce: 300 }
);
```

### 4.4 Все behaviors

```mermaid
mindmap
  root((Behaviors))
    Вычисления
      computeFrom
      transformValue
    Условия
      enableWhen
      disableWhen
      resetWhen
    Синхронизация
      copyFrom
      syncFields
    Отслеживание
      watchField
      revalidateWhen
```

---

## 5. Валидация (validation.md)

### 5.1 Pipeline валидации

```mermaid
flowchart TB
    subgraph Trigger["Триггер"]
        SV[setValue]
        MT[markAsTouched]
        V[validate]
    end

    subgraph SyncPhase["Sync фаза"]
        S1[required]
        S2[email]
        S3[minLength]
        SE{Есть ошибки?}
    end

    subgraph AsyncPhase["Async фаза"]
        D[debounce 500ms]
        AC[AbortController]
        A1[checkEmailExists]
        AE{Есть ошибки?}
    end

    subgraph Result["Результат"]
        Valid[✓ valid]
        Invalid[✗ invalid]
    end

    Trigger --> SyncPhase
    S1 --> S2 --> S3 --> SE
    SE -->|Да| Invalid
    SE -->|Нет| AsyncPhase
    D --> AC
    AC --> A1
    A1 --> AE
    AE -->|Да| Invalid
    AE -->|Нет| Valid
```

### 5.2 Async валидация с отменой

```mermaid
sequenceDiagram
    participant User as Пользователь
    participant FN as FieldNode
    participant AC as AbortController
    participant API as API

    User->>FN: setValue("a")
    FN->>AC: new AbortController()
    Note over FN: debounce 500ms

    User->>FN: setValue("ab")
    FN->>AC: abort() предыдущий
    FN->>AC: new AbortController()
    Note over FN: debounce 500ms

    FN->>API: checkEmail("ab", { signal })
    API-->>FN: { exists: false }
    FN->>FN: errors = []
```

### 5.3 Условная валидация

```mermaid
flowchart TB
    subgraph Condition["Условие"]
        HC{hasCompany?}
    end

    subgraph Active["Если true"]
        R1[required companyName]
        R2[required companyVAT]
    end

    subgraph Inactive["Если false"]
        Skip[Валидаторы не применяются]
    end

    HC -->|true| Active
    HC -->|false| Inactive
```

**Код:**

```typescript
validators.applyWhen(
  (form) => form.hasCompany,
  (path) => {
    required(path.companyName);
    required(path.companyVAT);
  }
);
```

---

## 6. Типобезопасность (type-safety.md)

### 6.1 FieldPath Proxy

```mermaid
flowchart LR
    subgraph TypeScript["TypeScript"]
        I["interface Form {
          email: string
          address: {
            city: string
          }
        }"]
    end

    subgraph FieldPath["FieldPath<Form>"]
        P1["path.email → 'email'"]
        P2["path.address.city → 'address.city'"]
        P3["path.invalid ❌ TS Error"]
    end

    TypeScript --> FieldPath
```

### 6.2 FormProxy

```mermaid
flowchart TB
    subgraph Create["Создание"]
        CF["const form = createForm<MyForm>(config)"]
    end

    subgraph Access["Типизированный доступ"]
        A1["form.email → FieldNode<string>"]
        A2["form.address → GroupNode<Address>"]
        A3["form.address.city → FieldNode<string>"]
        A4["form.items → ArrayNode<Item>"]
    end

    subgraph Methods["Методы с типами"]
        M1["form.email.setValue(123) ❌"]
        M2["form.email.setValue('test') ✓"]
    end

    Create --> Access --> Methods
```

---

## 7. Полный пример (examples.md)

### 7.1 Жизненный цикл формы

```mermaid
sequenceDiagram
    participant Dev as Разработчик
    participant RF as ReFormer
    participant VR as ValidationRegistry
    participant BR as BehaviorRegistry
    participant React as React

    Dev->>RF: createForm(config)

    rect rgb(200, 220, 255)
        Note over RF: Инициализация
        RF->>RF: Создание узлов (FieldNode, GroupNode)
        RF->>VR: beginRegistration()
        RF->>VR: Регистрация валидаторов
        RF->>VR: endRegistration()
        RF->>VR: apply(form)
    end

    rect rgb(220, 255, 200)
        Note over RF: Behaviors
        RF->>BR: beginRegistration()
        RF->>BR: Регистрация behaviors
        RF->>BR: endRegistration()
        RF->>BR: apply(form) → effects
    end

    RF-->>Dev: FormProxy<T>

    rect rgb(255, 220, 200)
        Note over React: Runtime
        React->>RF: useFormControl(form.email)
        RF-->>React: { value, errors, ... }
        React->>RF: setValue("test")
        RF-->>React: Signal update
        React->>React: Re-render
    end
```

### 7.2 Пример: Форма регистрации

```typescript
interface RegistrationForm {
  email: string;
  password: string;
  confirmPassword: string;
  profile: {
    firstName: string;
    lastName: string;
  };
}

const form = createForm<RegistrationForm>({
  form: {
    email: { value: '', component: Input },
    password: { value: '', component: PasswordInput },
    confirmPassword: { value: '', component: PasswordInput },
    profile: {
      firstName: { value: '', component: Input },
      lastName: { value: '', component: Input },
    },
  },

  validation: (path) => {
    required(path.email);
    email(path.email);

    required(path.password);
    minLength(path.password, 8);

    required(path.confirmPassword);
    validators.validate(path.confirmPassword, (value, ctx) =>
      value !== ctx.form.password.value.value
        ? { code: 'mismatch', message: 'Пароли не совпадают' }
        : null
    );
  },

  behavior: (path) => {
    // Перевалидировать confirmPassword при изменении password
    revalidateWhen(path.confirmPassword, [path.password]);
  },
});
```

---

## 8. План реализации

### Файлы для создания

| Файл                                         | Описание                        |
| -------------------------------------------- | ------------------------------- |
| [docs/architecture.md](docs/architecture.md) | Общая архитектура с диаграммами |
| [docs/signals.md](docs/signals.md)           | Signals и реактивность          |
| [docs/behaviors.md](docs/behaviors.md)       | Система behaviors               |
| [docs/validation.md](docs/validation.md)     | Валидация                       |
| [docs/type-safety.md](docs/type-safety.md)   | Типобезопасность                |
| [docs/examples.md](docs/examples.md)         | Полные примеры                  |

### Порядок работы

1. Создать базовую структуру документации
2. Написать architecture.md с общими диаграммами
3. Детализировать каждую концепцию в отдельных файлах
4. Добавить примеры кода с комментариями
5. Проверить рендеринг Mermaid диаграмм

---

## Верификация

- Проверить рендеринг Mermaid в GitHub/GitLab
- Убедиться что все ссылки между документами работают
- Проверить примеры кода на актуальность с текущим API
