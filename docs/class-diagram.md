# ReFormer Core - Class Diagram

## 1. Node Hierarchy (Core)

```mermaid
classDiagram
    direction TB

    class FormNode~T~ {
        <<abstract>>
        #_touched: Signal~boolean~
        #_dirty: Signal~boolean~
        #_status: Signal~FieldStatus~
        +value: ReadonlySignal~T~*
        +valid: ReadonlySignal~boolean~*
        +errors: ReadonlySignal~ValidationError[]~*
        +getValue() T
        +setValue(value, options?) void
        +validate() Promise~boolean~
        +markAsTouched() void
        +disable() void
        +dispose() void
    }

    class FieldNode~T~ {
        -_value: Signal~T~
        -_errors: Signal~ValidationError[]~
        -_pending: Signal~boolean~
        -initialValue: T
        +value: ReadonlySignal~T~
        +valid: ReadonlySignal~boolean~
        +shouldShowError: ReadonlySignal~boolean~
        +validate() Promise~boolean~
        +watch(callback) Function
    }

    class GroupNode~T~ {
        -_fields: Map~keyof T, FormNode~
        -_submitting: Signal~boolean~
        -_formErrors: Signal~ValidationError[]~
        +value: ReadonlySignal~T~
        +submitting: ReadonlySignal~boolean~
        +getField(key) FormNode
        +getProxy() FormProxy~T~
        +submit(onSubmit) Promise~R~
        +applyValidationSchema(schemaFn) void
        +applyBehaviorSchema(schemaFn) Function
        -buildProxy() FormProxy~T~
    }

    class ArrayNode~T~ {
        -items: Signal~FormNode[]~
        -itemSchema: FormSchema~T~
        +length: ReadonlySignal~number~
        +push(initialValue?) void
        +removeAt(index) void
        +at(index) FormProxy~T~
        +forEach(callback) void
        +map(callback) R[]
    }

    FormNode <|-- FieldNode
    FormNode <|-- GroupNode
    FormNode <|-- ArrayNode
```

## 2. GroupNode Composition

```mermaid
classDiagram
    direction LR

    class GroupNode~T~ {
        -_fields: Map
        -validationRegistry
        -behaviorRegistry
        -validationApplicator
        -pathNavigator
        -nodeFactory
        -disposers
    }

    class ValidationRegistry {
        +beginRegistration()
        +endRegistration(form)
        +registerSync(path, validator)
        +registerAsync(path, validator)
        +registerTree(validator)
    }

    class BehaviorRegistry {
        +beginRegistration()
        +endRegistration(form)
        +register(handler, options)
    }

    class ValidationApplicator {
        +apply(form, validators)
    }

    class FieldPathNavigator {
        +parse(path) PathSegment[]
        +getFieldByPath(form, path)
    }

    class NodeFactory {
        +create(config, key) FormNode
    }

    class SubscriptionManager {
        +add(key, dispose) Function
        +clear() void
    }

    GroupNode *-- ValidationRegistry
    GroupNode *-- BehaviorRegistry
    GroupNode *-- ValidationApplicator
    GroupNode *-- FieldPathNavigator
    GroupNode *-- NodeFactory
    GroupNode *-- SubscriptionManager
```

## 3. Type System

```mermaid
classDiagram
    direction TB

    class FieldConfig~T~ {
        <<interface>>
        +value: T
        +component: ComponentType
        +validators?: ValidatorFn[]
        +asyncValidators?: AsyncValidatorFn[]
        +updateOn?: UpdateOn
    }

    class ArrayConfig~T~ {
        <<interface>>
        +itemSchema: FormSchema~T~
        +initial?: Partial~T~[]
    }

    class GroupNodeConfig~T~ {
        <<interface>>
        +form: FormSchema~T~
        +behavior?: BehaviorSchemaFn~T~
        +validation?: ValidationSchemaFn~T~
    }

    class ValidationError {
        <<interface>>
        +code: string
        +message: string
        +params?: FormFields
        +severity?: ErrorSeverity
    }

    class ValidatorRegistration {
        <<interface>>
        +fieldPath: string
        +type: ValidatorType
        +validator: Function
        +condition?: ConditionConfig
    }

    class FieldStatus {
        <<enumeration>>
        valid
        invalid
        pending
        disabled
    }

    class UpdateOn {
        <<enumeration>>
        change
        blur
        submit
    }
```

## 4. Proxy Types

```mermaid
classDiagram
    direction LR

    class GroupNode~T~ {
        +getProxy()
    }

    class FormProxy~T~ {
        <<type alias>>
        GroupNode + field accessors
    }

    class ArrayNode~T~ {
        +at(index)
    }

    class FormArrayProxy~T~ {
        <<type alias>>
        ArrayNode + item accessors
    }

    GroupNode ..> FormProxy : getProxy()
    ArrayNode ..> FormArrayProxy : at()
```

> **Proxy:** позволяет писать `form.email.setValue()` вместо `form.getField('email').setValue()`

## 5. Signal Flow

```mermaid
flowchart LR
    subgraph Input
        A[setValue]
    end

    subgraph FieldNode
        B[_value.value = x]
        C[computed: valid]
        D[computed: errors]
    end

    subgraph GroupNode
        E[computed: value]
        F[computed: valid]
        G[computed: errors]
    end

    subgraph Output
        H[UI Re-render]
    end

    A --> B
    B --> C & D
    B --> E
    C --> F
    D --> G
    E & F & G --> H
```

## 6. Schema Application Flow

```mermaid
sequenceDiagram
    participant User
    participant GroupNode
    participant Registry
    participant FieldPath
    participant Field

    User->>GroupNode: new GroupNode(config)

    rect rgb(240, 248, 255)
        Note over GroupNode,Field: Validation Schema
        GroupNode->>Registry: beginRegistration()
        GroupNode->>FieldPath: schemaFn(path)
        FieldPath->>Registry: registerSync/Async()
        GroupNode->>Registry: endRegistration()
        Registry->>Field: apply validators
    end

    rect rgb(255, 248, 240)
        Note over GroupNode,Field: Behavior Schema
        GroupNode->>Registry: beginRegistration()
        GroupNode->>FieldPath: schemaFn(path)
        FieldPath->>Registry: register(handler)
        GroupNode->>Registry: endRegistration()
        Registry->>GroupNode: create effects
    end
```

## 7. Node Creation Flow

```mermaid
flowchart TB
    A[FormSchema] --> B{NodeFactory}

    B -->|isFieldConfig| C[FieldNode]
    B -->|isArrayConfig| D[ArrayNode]
    B -->|isGroupConfig| E[GroupNode]

    E -.->|recursive| B
    D -.->|for items| E
```

## Design Patterns

| Pattern | Implementation | Purpose |
|---------|---------------|---------|
| **Template Method** | FormNode with hooks | Subclasses override behavior |
| **Composition** | GroupNode → Registries | Single Responsibility |
| **Factory** | NodeFactory | Centralized node creation |
| **Proxy** | GroupNode.buildProxy() | Type-safe `form.email` access |
| **Registry** | Validation/BehaviorRegistry | Stack-based context isolation |
| **Observer** | Preact Signals | Reactive state management |
