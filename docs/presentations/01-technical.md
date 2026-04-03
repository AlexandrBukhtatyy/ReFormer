---
marp: true
theme: default
paginate: true
title: ReFormer Architecture - Technical Deep Dive
---

# ReFormer Architecture

## Technical Deep Dive

Signals-based Form State Management for React

---

# Node Hierarchy

```
FormNode<T> (abstract)
├── FieldNode<T>    - single value with validation
├── GroupNode<T>    - nested fields (object)
└── ArrayNode<T[]>  - dynamic array of forms
```

**Template Method Pattern:**

- Base class defines algorithm skeleton
- Subclasses override protected hooks

---

# FormNode - Base Class

```typescript
abstract class FormNode<T> {
  // Protected signals (for subclass override)
  protected _touched = signal(false);
  protected _dirty = signal(false);
  protected _status = signal<FieldStatus>('valid');

  // Public readonly computed
  readonly touched = computed(() => this._touched.value);
  readonly dirty = computed(() => this._dirty.value);
  readonly valid = computed(() => this._status.value === 'valid');

  // Template Method hooks
  protected onMarkAsTouched(): void {}
  protected onDisable(): void {}
  protected onEnable(): void {}
}
```

---

# Preact Signals Reactivity

```typescript
// FieldNode implementation
class FieldNode<T> extends FormNode<T> {
  private _value = signal<T>(initialValue);
  private _errors = signal<ValidationError[]>([]);

  // Computed derived state
  readonly shouldShowError = computed(() => this._touched.value && this._errors.value.length > 0);

  setValue(value: T, options?: SetValueOptions): void {
    this._value.value = value;
    this._dirty.value = true;
    // Triggers all subscribed effects
  }
}
```

---

# React Integration

```typescript
// useSyncExternalStore for React compatibility
function useFormControl<T>(node: FieldNode<T>) {
  const subscribe = useCallback(
    (onStoreChange) => {
      // Subscribe to multiple signals
      return effect(() => {
        node.value.value;
        node.errors.value;
        node.touched.value;
        onStoreChange();
      });
    },
    [node]
  );

  return useSyncExternalStore(subscribe, getSnapshot);
}
```

---

# Factory Method Pattern

```typescript
class NodeFactory {
  createNode(config: unknown): FormNode<unknown> {
    // 1. Array config → ArrayNode
    if (Array.isArray(config)) {
      return new ArrayNode(config[0], config.slice(1));
    }

    // 2. Field config → FieldNode
    if (isFieldConfig(config)) {
      return new FieldNode(config);
    }

    // 3. Object config → GroupNode (recursive)
    return new GroupNode(config);
  }
}
```

---

# AbstractRegistry Pattern

```typescript
abstract class AbstractRegistry<T> {
  private static stack: AbstractRegistry[] = [];

  beginRegistration(): void {
    AbstractRegistry.stack.push(this);
  }

  endRegistration(): void {
    AbstractRegistry.stack.pop();
  }

  static getCurrent(): AbstractRegistry {
    return this.stack[this.stack.length - 1];
  }
}
```

**Purpose:** Isolate forms, prevent race conditions

---

# BehaviorRegistry

```typescript
class BehaviorRegistry extends AbstractRegistry {
  private handlers: BehaviorHandlerFn[] = [];

  register(handler: BehaviorHandlerFn): void {
    this.handlers.push(handler);
  }

  apply(form: GroupNode): () => void {
    const cleanups = this.handlers.map((handler) => {
      return effect(() => handler(form));
    });

    return () => cleanups.forEach((c) => c());
  }
}
```

---

# ValidationRegistry

```typescript
class ValidationRegistry extends AbstractRegistry {
  private syncValidators = new Map<string, ValidatorFn[]>();
  private asyncValidators = new Map<string, AsyncValidatorFn[]>();
  private treeValidators: TreeValidatorFn[] = [];

  registerSync(path: string, validator: ValidatorFn): void {
    this.syncValidators.get(path)?.push(validator);
  }

  registerAsync(path: string, validator: AsyncValidatorFn): void {
    this.asyncValidators.get(path)?.push(validator);
  }
}
```

---

# Behaviors System

```typescript
// computeFrom - reactive computed fields
computeFrom([path.price, path.quantity], path.total, (values) => values.price * values.quantity);

// enableWhen - conditional fields
enableWhen(path.spouseInfo, (form) => form.maritalStatus === 'married');

// watchField - side effects
watchField(
  path.country,
  async (country, ctx) => {
    const cities = await fetchCities(country);
    ctx.form.city.updateComponentProps({ options: cities });
  },
  { debounce: 300 }
);
```

---

# Validation System

```typescript
// Field-level validation
validate(path.email, (ctx) => {
  if (!ctx.value()) return { code: 'required' };
  if (!isValidEmail(ctx.value())) return { code: 'email' };
  return null;
});

// Cross-field validation
validateTree(
  (ctx) => {
    if (ctx.form.password.value !== ctx.form.confirmPassword.value) {
      return { code: 'mismatch', message: 'Passwords must match' };
    }
    return null;
  },
  { targetField: 'confirmPassword' }
);
```

---

# FormProxy - Type-safe Access

```typescript
function buildFormProxy<T>(node: GroupNode<T>): FormProxy<T> {
  return new Proxy(node, {
    get(target, prop: string) {
      const child = target.getFieldByPath(prop);

      if (child instanceof GroupNode) {
        return buildFormProxy(child); // Recursive proxy
      }

      return child; // FieldNode or ArrayNode
    },
  });
}

// Usage: form.address.city.setValue('Moscow')
```

---

# Data Flow

```
┌─────────────────────────────────────────────────┐
│ createForm(config)                              │
│ ├─ GroupNode constructor                        │
│ │  ├─ NodeFactory.createNode() for each field  │
│ │  ├─ buildFormProxy()                         │
│ │  └─ apply validation & behavior schemas      │
│ └─ return FormProxy<T>                         │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ setValue(newValue)                              │
│ ├─ _value.value = newValue                     │
│ ├─ Signals notify all subscribers              │
│ ├─ Behaviors execute (computeFrom, watchField) │
│ ├─ Validation runs (sync → async → tree)       │
│ └─ React components re-render                  │
└─────────────────────────────────────────────────┘
```

---

# Headless UI Components

```typescript
// FormArray - Compound Component Pattern
<FormArray.Root control={form.items}>
  <FormArray.List>
    {(item, index) => (
      <ItemForm key={index} item={item}>
        <FormArray.RemoveButton index={index} />
      </ItemForm>
    )}
  </FormArray.List>
  <FormArray.AddButton>Add Item</FormArray.AddButton>
  <FormArray.Empty>No items</FormArray.Empty>
</FormArray.Root>
```

---

# Key Design Decisions

| Decision             | Rationale                                      |
| -------------------- | ---------------------------------------------- |
| Preact Signals       | Fine-grained reactivity, no re-render cascades |
| Template Method      | Consistent behavior, extensible hooks          |
| Stack-based Registry | Form isolation, no global state conflicts      |
| Proxy access         | Type-safe, intuitive API                       |
| Headless UI          | Framework-agnostic, full customization         |

---

# Architecture Summary

```
@reformer/core
├── nodes/          FormNode → FieldNode, GroupNode, ArrayNode
├── behavior/       BehaviorRegistry + built-in behaviors
├── validation/     ValidationRegistry + built-in validators
├── utils/          AbstractRegistry, NodeFactory, FormProxy
└── hooks/          useFormControl, useFormControlValue

@reformer/ui        Headless components (FormArray, FormWizard)
@reformer/zod       Schema adapter for Zod
@reformer/yup       Schema adapter for Yup
@reformer/valibot   Schema adapter for Valibot
```

---

# Questions?

GitHub: github.com/anthropics/reformer
Docs: reformer.dev
