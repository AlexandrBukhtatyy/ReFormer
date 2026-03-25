# Архитектура ReFormer

ReFormer — это современная библиотека для работы с формами, построенная на сигналах (Preact Signals) с фокусом на типобезопасность, реактивность и декларативность.

## Общая структура

```mermaid
flowchart TB
    subgraph Input["Конфигурация"]
        FS[FormSchema&lt;T&gt;]
        VS[ValidationSchema]
        BS[BehaviorSchema]
    end

    CF[createForm&lt;T&gt;]

    subgraph Core["Ядро ReFormer"]
        GN[GroupNode&lt;T&gt;]

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

## Ключевые компоненты

### 1. createForm&lt;T&gt;

Точка входа для создания формы. Принимает конфигурацию и возвращает типизированный Proxy.

```typescript
const form = createForm<MyForm>({
  form: { /* FormSchema */ },
  validation: (path) => { /* validators */ },
  behavior: (path) => { /* behaviors */ },
});
```

### 2. FormNode (базовый класс)

Абстрактный класс, от которого наследуются все типы узлов.

### 3. FieldNode&lt;T&gt;

Узел для примитивных значений (строки, числа, булевы).

### 4. GroupNode&lt;T&gt;

Узел для вложенных объектов. Содержит Map дочерних узлов.

### 5. ArrayNode&lt;T&gt;

Узел для массивов. Поддерживает операции push, remove, insert.

---

## Иерархия узлов

```mermaid
classDiagram
    class FormNode~T~ {
        &lt;&lt;abstract&gt;&gt;
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

## Структура пакетов

```
packages/
├── reformer/              # Ядро библиотеки (~15kb gzipped)
│   ├── core/
│   │   ├── nodes/         # FormNode, FieldNode, GroupNode, ArrayNode
│   │   ├── types/         # Типы и интерфейсы
│   │   ├── behavior/      # Система behaviors
│   │   ├── validation/    # Система валидации
│   │   ├── factories/     # NodeFactory
│   │   └── utils/         # Утилиты (signals, registry)
│   ├── hooks/             # React-интеграция
│   └── index.ts           # Public API
├── reformer-zod/          # Адаптер для Zod
├── reformer-yup/          # Адаптер для Yup
└── reformer-valibot/      # Адаптер для Valibot
```

---

## Связанные документы

- [Signals и реактивность](signals.md)
- [Система Behaviors](behaviors.md)
- [Валидация](validation.md)
- [Типобезопасность](type-safety.md)
- [Примеры](examples.md)
