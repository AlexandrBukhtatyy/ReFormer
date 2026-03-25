# ReFormer Architecture Diagrams

Visual representation of ReFormer's architecture and data flows.

---

## 1. Node Hierarchy (Class Diagram)

```mermaid
classDiagram
    class FormNode~T~ {
        <<abstract>>
        #_touched: Signal~boolean~
        #_dirty: Signal~boolean~
        #_status: Signal~FieldStatus~
        +touched: ReadonlySignal~boolean~
        +dirty: ReadonlySignal~boolean~
        +value: ReadonlySignal~T~
        +valid: ReadonlySignal~boolean~
        +invalid: ReadonlySignal~boolean~
        +errors: ReadonlySignal~ValidationError[]~
        +markAsTouched()
        +markAsDirty()
        +disable()
        +enable()
        +reset()
        +setValue(value: T)
        +validate(): Promise~boolean~
        #onMarkAsTouched()*
        #onDisable()*
        #onEnable()*
    }

    class FieldNode~T~ {
        -_value: Signal~T~
        -_errors: Signal~ValidationError[]~
        -_componentProps: Signal~Record~
        +shouldShowError: ReadonlySignal~boolean~
        +componentProps: ReadonlySignal~Record~
        +updateComponentProps(props)
    }

    class GroupNode~T~ {
        -_fields: Map~string, FormNode~
        -validationRegistry: ValidationRegistry
        -behaviorRegistry: BehaviorRegistry
        -proxy: FormProxy~T~
        +submit(): Promise~boolean~
        +applyValidationSchema(schema)
        +applyBehaviorSchema(schema)
        +getFieldByPath(path): FormNode
        +getProxy(): FormProxy~T~
        +getValue(): T
        +patchValue(partial: Partial~T~)
    }

    class ArrayNode~T~ {
        -_items: Signal~GroupNode[]~
        -itemSchema: FormSchema
        +length: ReadonlySignal~number~
        +items: ReadonlySignal~GroupNode[]~
        +push(value?: Partial~T~): GroupNode
        +removeAt(index: number)
        +at(index: number): GroupNode
        +clear()
        +map~U~(fn): U[]
    }

    FormNode <|-- FieldNode : extends
    FormNode <|-- GroupNode : extends
    FormNode <|-- ArrayNode : extends
    GroupNode "1" *-- "*" FormNode : contains
    ArrayNode "1" *-- "*" GroupNode : contains
```

---

## 2. Registry Pattern (Class Diagram)

```mermaid
classDiagram
    class AbstractRegistry~TRegistration~ {
        <<abstract>>
        #isRegistering: boolean
        #registrations: TRegistration[]
        -static stacks: Map~string, AbstractRegistry[]~
        +beginRegistration()
        +isActive(): boolean
        +getRegistrations(): TRegistration[]
        #completeRegistration()
        #cancelRegistration(name: string)
        +static getCurrent(name: string): AbstractRegistry
        +static pushToStack(name, registry)
        +static popFromStack(name): AbstractRegistry
    }

    class BehaviorRegistry {
        -handlers: BehaviorHandlerFn[]
        -debounceMs: number
        +static getCurrent(): BehaviorRegistry
        +register(handler, options)
        +endRegistration(form): CleanupFn
        -createEffect(handler, form): CleanupFn
    }

    class ValidationRegistry {
        -contextStack: RegistrationContext[]
        -syncValidators: Map~string, ValidatorFn[]~
        -asyncValidators: Map~string, AsyncValidatorFn[]~
        -treeValidators: TreeValidatorFn[]
        +static getCurrent(): ValidationRegistry
        +registerSync(path, validator, options)
        +registerAsync(path, validator, options)
        +registerTree(validator, options)
        +enterCondition(condition)
        +exitCondition()
        +endRegistration(form): ValidationApplicator
    }

    class RegistrationContext {
        +condition: ConditionFn
        +validators: ValidatorRegistration[]
    }

    AbstractRegistry <|-- BehaviorRegistry : extends
    AbstractRegistry <|-- ValidationRegistry : extends
    ValidationRegistry "1" *-- "*" RegistrationContext : manages
```

---

## 3. Form Initialization (Sequence Diagram)

```mermaid
sequenceDiagram
    participant App
    participant createForm
    participant GroupNode
    participant NodeFactory
    participant BehaviorRegistry
    participant ValidationRegistry

    App->>createForm: createForm<T>(config)
    createForm->>GroupNode: new GroupNode(config.form)

    rect rgb(240, 248, 255)
        Note over GroupNode,NodeFactory: Field Creation Loop
        loop For each field in config.form
            GroupNode->>NodeFactory: createNode(fieldConfig)
            alt isFieldConfig
                NodeFactory-->>GroupNode: new FieldNode(config)
            else isGroupConfig
                NodeFactory-->>GroupNode: new GroupNode(config)
            else isArrayConfig
                NodeFactory-->>GroupNode: new ArrayNode(config)
            end
        end
    end

    rect rgb(255, 248, 240)
        Note over GroupNode,BehaviorRegistry: Behavior Schema Application
        opt config.behavior exists
            GroupNode->>BehaviorRegistry: beginRegistration()
            GroupNode->>App: config.behavior(fieldPath)
            Note right of App: Calls computeFrom, watchField, etc.
            GroupNode->>BehaviorRegistry: endRegistration(this)
            BehaviorRegistry-->>GroupNode: cleanup function
        end
    end

    rect rgb(240, 255, 240)
        Note over GroupNode,ValidationRegistry: Validation Schema Application
        opt config.validation exists
            GroupNode->>ValidationRegistry: beginRegistration()
            GroupNode->>App: config.validation(fieldPath)
            Note right of App: Calls required, email, etc.
            GroupNode->>ValidationRegistry: endRegistration(this)
            ValidationRegistry-->>GroupNode: ValidationApplicator
        end
    end

    GroupNode->>GroupNode: buildFormProxy()
    GroupNode-->>createForm: GroupNode instance
    createForm-->>App: FormProxy<T>
```

---

## 4. setValue Flow (Sequence Diagram)

```mermaid
sequenceDiagram
    participant UI as React Component
    participant Field as FieldNode
    participant Signal as Preact Signal
    participant Effect as Signal Effect
    participant Behavior as BehaviorHandler
    participant Validator as ValidationApplicator

    UI->>Field: setValue(newValue)
    Field->>Signal: _value.value = newValue
    Field->>Field: markAsDirty()

    rect rgb(255, 250, 240)
        Note over Signal,Effect: Signal Notification
        Signal-->>Effect: trigger subscribed effects
    end

    par Behavior Execution
        Effect->>Behavior: computeFrom handler
        Behavior->>Field: setValue(computedValue)
        Note right of Behavior: e.g., total = price * qty
    and Watch Field
        Effect->>Behavior: watchField handler
        Behavior->>Behavior: async fetchData()
        Behavior->>Field: updateComponentProps()
    and React Re-render
        Effect->>UI: useSyncExternalStore callback
        UI->>UI: re-render with new value
    end

    rect rgb(240, 255, 240)
        Note over Field,Validator: Validation (if emitEvent)
        opt emitEvent !== false
            Field->>Validator: validateField()
            Validator->>Validator: run sync validators
            Validator->>Validator: run async validators (debounced)
            Validator-->>Field: update _errors signal
            Field->>Field: update _status signal
        end
    end
```

---

## 5. Package Structure (Component Diagram)

```mermaid
graph TB
    subgraph "@reformer/core"
        subgraph "core/nodes"
            FormNode[FormNode]
            FieldNode[FieldNode]
            GroupNode[GroupNode]
            ArrayNode[ArrayNode]
        end

        subgraph "core/validation"
            ValidationRegistry[ValidationRegistry]
            ValidationApplicator[ValidationApplicator]
            Validators["validators/<br/>required, email, min, max..."]
        end

        subgraph "core/behavior"
            BehaviorRegistry[BehaviorRegistry]
            Behaviors["behaviors/<br/>computeFrom, watchField..."]
        end

        subgraph "core/utils"
            AbstractRegistry[AbstractRegistry]
            NodeFactory[NodeFactory]
            FormProxy[FormProxy Builder]
            FieldPath[FieldPath Navigator]
        end

        subgraph "hooks"
            useFormControl[useFormControl]
            useFormControlValue[useFormControlValue]
        end
    end

    subgraph "@reformer/ui"
        FormArray[FormArray]
        FormNavigation[FormNavigation]
    end

    subgraph "Schema Adapters"
        ZodAdapter["@reformer/zod"]
        YupAdapter["@reformer/yup"]
        ValibotAdapter["@reformer/valibot"]
    end

    subgraph "@reformer/mcp"
        MCPServer[MCP Server]
    end

    %% Dependencies
    FieldNode --> FormNode
    GroupNode --> FormNode
    ArrayNode --> FormNode

    GroupNode --> NodeFactory
    GroupNode --> ValidationRegistry
    GroupNode --> BehaviorRegistry
    GroupNode --> FormProxy

    BehaviorRegistry --> AbstractRegistry
    ValidationRegistry --> AbstractRegistry

    FormArray --> ArrayNode
    FormArray --> GroupNode
    FormNavigation --> GroupNode

    useFormControl --> FieldNode
    useFormControl --> ArrayNode

    ZodAdapter --> ValidationRegistry
    YupAdapter --> ValidationRegistry
    ValibotAdapter --> ValidationRegistry
```

---

## 6. Field Status State Machine

```mermaid
stateDiagram-v2
    [*] --> Valid: Initial state

    Valid --> Invalid: Validation fails
    Invalid --> Valid: Validation passes

    Valid --> Pending: Async validation starts
    Invalid --> Pending: Async validation starts
    Pending --> Valid: Async validation passes
    Pending --> Invalid: Async validation fails

    Valid --> Disabled: disable()
    Invalid --> Disabled: disable()
    Pending --> Disabled: disable()

    Disabled --> Valid: enable() + passes
    Disabled --> Invalid: enable() + fails

    state Valid {
        [*] --> Pristine
        Pristine --> Dirty: setValue()
        Dirty --> Pristine: reset() / markAsPristine()
    }

    state TouchedState {
        [*] --> Untouched
        Untouched --> Touched: markAsTouched() / blur
    }

    note right of Valid
        shouldShowError = touched && invalid
    end note
```

---

## 7. Validation Flow

```mermaid
flowchart TD
    A[setValue called] --> B{emitEvent?}
    B -->|false| Z[Skip validation]
    B -->|true| C[Sync Validators]

    C --> D{All passed?}
    D -->|no| E[Set errors, status = invalid]
    D -->|yes| F[Async Validators]

    F --> G[status = pending]
    G --> H{Debounce active?}
    H -->|yes| I[Wait for debounce]
    H -->|no| J[Run async validators]
    I --> J

    J --> K{All passed?}
    K -->|no| L[Set errors, status = invalid]
    K -->|yes| M[Tree Validators]

    M --> N{All passed?}
    N -->|no| O[Set errors on target field]
    N -->|yes| P[status = valid, errors = []]

    E --> Q[Notify subscribers]
    L --> Q
    O --> Q
    P --> Q

    Q --> R[React re-render]
```

---

## 8. Behavior Execution Flow

```mermaid
flowchart TD
    A[Form Initialization] --> B[Apply Behavior Schema]
    B --> C[BehaviorRegistry.beginRegistration]

    C --> D[Execute schema function]
    D --> E1[computeFrom registration]
    D --> E2[watchField registration]
    D --> E3[enableWhen registration]
    D --> E4[copyFrom registration]

    E1 --> F[BehaviorRegistry.endRegistration]
    E2 --> F
    E3 --> F
    E4 --> F

    F --> G[Create effects for each handler]

    G --> H1[computeFrom effect]
    G --> H2[watchField effect]
    G --> H3[enableWhen effect]
    G --> H4[copyFrom effect]

    H1 --> I[Subscribe to source signals]
    H2 --> I
    H3 --> I
    H4 --> I

    I --> J[On signal change]
    J --> K{Has debounce?}
    K -->|yes| L[Wait debounce period]
    K -->|no| M[Execute handler]
    L --> M

    M --> N[runOutsideEffect]
    N --> O[Handler modifies form]
    O --> P[Trigger dependent effects]

    subgraph Cleanup
        Q[Component unmount] --> R[Call cleanup functions]
        R --> S[Dispose all effects]
    end
```

---

## Usage

These diagrams can be rendered using:

1. **Mermaid Live Editor**: https://mermaid.live
2. **GitHub/GitLab**: Native Mermaid support in markdown
3. **VS Code**: Mermaid Preview extension
4. **Documentation tools**: Docusaurus, VitePress, etc.

For presentations, export as SVG or PNG from Mermaid Live Editor.
