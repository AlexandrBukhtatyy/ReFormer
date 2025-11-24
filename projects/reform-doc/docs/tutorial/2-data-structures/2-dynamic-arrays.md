---
sidebar_position: 2
---

# Dynamic Arrays

In this lesson, you'll learn how to work with lists of items that users can add, remove, and reorder using `ArrayNode`.

## What You'll Learn

- How to create array fields with `ArrayNode`
- How to add and remove items dynamically
- How to validate array items
- How to work with arrays in React components

## Why Use ArrayNode?

Many forms need to handle lists of items:
- Contact list with multiple phone numbers
- Order form with multiple products
- Resume with multiple work experiences
- Form with multiple file attachments

`ArrayNode` manages these dynamic lists for you.

## Creating an Array Field

Let's create a form for managing a list of phone numbers:

```typescript title="src/components/PhoneListForm/form.ts"
import { GroupNode } from 'reformer';
import { required, pattern } from 'reformer/validators';

interface PhoneNumber {
  type: string;
  number: string;
}

interface ContactFormData {
  name: string;
  phones: PhoneNumber[];
}

const phonePattern = /^\+?[\d\s\-()]+$/;

export const contactForm = new GroupNode<ContactFormData>({
  form: {
    name: { value: '' },
    phones: [{
      type: { value: 'mobile' },
      number: { value: '' },
    }],
  },
  validation: (path) => {
    required(path.name);

    required(path.phones.$each.type);
    required(path.phones.$each.number);
    pattern(path.phones.$each.number, phonePattern);
  },
});
```

### Understanding ArrayNode

- **Array syntax `[{...}]`** — defines the schema for array items
- **Item template** — the object inside `[]` defines the structure of each array item
- **Automatic conversion** — ReFormer converts the array schema to an `ArrayNode` automatically
- **`$each`** — special path segment for validating all array items
- **Each item is a node** — can be a field, group, or even another array

## Adding and Removing Items

`ArrayNode` provides methods to manipulate the array:

```typescript
const phones = contactForm.controls.phones;

// Add a new phone number
phones.push();

// Get array length
console.log(phones.length); // 1

// Access array item
console.log(phones.at(0).value);
// { type: 'mobile', number: '' }

// Remove item at index
phones.removeAt(0);

// Insert item at specific position
phones.insertAt(1);

// Clear all items
phones.clear();
```

## React Component

Let's create a component that allows users to manage phone numbers:

```tsx title="src/components/PhoneListForm/index.tsx"
import { useFormControl } from 'reformer';
import { contactForm } from './form';

export function PhoneListForm() {
  const name = useFormControl(contactForm.controls.name);
  const phones = useFormControl(contactForm.controls.phones);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    contactForm.markAllAsTouched();

    if (!contactForm.valid) {
      return;
    }

    console.log('Contact data:', contactForm.value);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="name">Name</label>
        <input
          id="name"
          value={name.value}
          onChange={(e) => name.setValue(e.target.value)}
          onBlur={() => name.markAsTouched()}
        />
        {name.touched && name.errors?.required && (
          <span className="error">Name is required</span>
        )}
      </div>

      <div>
        <h3>Phone Numbers</h3>

        {phones.items.map((phone, index) => {
          const phoneNode = useFormControl(phone);
          const type = useFormControl(phone.controls.type);
          const number = useFormControl(phone.controls.number);

          return (
            <div key={phone.id} style={{ marginBottom: '1rem', padding: '1rem', border: '1px solid #ccc' }}>
              <div>
                <label>Type</label>
                <select
                  value={type.value}
                  onChange={(e) => type.setValue(e.target.value)}
                >
                  <option value="mobile">Mobile</option>
                  <option value="home">Home</option>
                  <option value="work">Work</option>
                </select>
              </div>

              <div>
                <label>Number</label>
                <input
                  value={number.value}
                  onChange={(e) => number.setValue(e.target.value)}
                  onBlur={() => number.markAsTouched()}
                  placeholder="+1 234 567 8900"
                />
                {number.touched && number.errors?.required && (
                  <span className="error">Number is required</span>
                )}
                {number.touched && number.errors?.pattern && (
                  <span className="error">Invalid phone format</span>
                )}
              </div>

              <button
                type="button"
                onClick={() => phones.removeAt(index)}
              >
                Remove
              </button>
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => phones.push()}
        >
          Add Phone Number
        </button>
      </div>

      <button type="submit" disabled={!contactForm.valid}>
        Save Contact
      </button>
    </form>
  );
}
```

### Working with Array Items

- **`phones.items`** — array of child nodes to iterate over
- **`phone.id`** — unique ID for each array item (use as React key)
- **`useFormControl(phone)`** — subscribe to individual item changes
- **`phones.push()`** — adds a new item
- **`phones.removeAt(index)`** — removes item at index

## Array Validation

You can validate all array items using `$each`:

```typescript
validation: (path) => {
  // Validate each phone number in the array
  required(path.phones.$each.type);
  required(path.phones.$each.number);
  pattern(path.phones.$each.number, phonePattern);
}
```

The `$each` segment tells ReFormer to apply validation to every item in the array.

## Accessing Array Data

```typescript
// Get entire array value
console.log(contactForm.controls.phones.value);
// [
//   { type: 'mobile', number: '+1 234 567 8900' },
//   { type: 'home', number: '+1 987 654 3210' }
// ]

// Get specific item
console.log(contactForm.controls.phones.at(0).value);
// { type: 'mobile', number: '+1 234 567 8900' }

// Get array length
console.log(contactForm.controls.phones.length);
// 2

// Check if array is valid
console.log(contactForm.controls.phones.valid);
// true
```

## Nested Arrays

Arrays can contain any node type, including other arrays or groups:

```typescript
interface OrderFormData {
  items: {
    product: string;
    quantity: number;
    variants: string[];  // Nested array!
  }[];
}

export const orderForm = new GroupNode<OrderFormData>({
  form: {
    items: [{
      product: { value: '' },
      quantity: { value: 1 },
      variants: [{ value: '' }],  // Nested array of strings
    }],
  },
});
```

## Try It Out

1. Click "Add Phone Number" → new phone entry appears
2. Fill in phone details → values update reactively
3. Add multiple phones → see array grow
4. Remove a phone → array updates instantly
5. Try to submit with invalid phone number → see validation

## Key Concepts

- **Array syntax `[{...}]`** — defines array schema with item template
- **Automatic arrays** — ReFormer converts array schemas to `ArrayNode` automatically
- **`push()`** — adds new item to array
- **`removeAt(index)`** — removes item at index
- **`at(index)`** — accesses item at index
- **`items`** — array of child nodes for iteration
- **`$each`** — validates all array items
- **`item.id`** — unique identifier for React keys

## What's Next?

Great work! You've mastered data structures. In the next section, we'll explore **Advanced Features** like computed fields, conditional logic, and async validation.
