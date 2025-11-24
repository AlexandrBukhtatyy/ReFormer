---
sidebar_position: 2
---

# Validation

In this lesson, you'll learn how to validate form data to ensure users enter correct information.

## What You'll Learn

- How to add validation rules to fields
- How to use built-in validators
- How to display validation errors
- How to check form validity state

## Adding Validation

Let's add validation to our registration form. We'll make both fields required and validate the email format:

```typescript title="src/components/RegistrationForm/form.ts"
import { GroupNode } from 'reformer';
import { required, email, minLength } from 'reformer/validators';

interface RegistrationFormData {
  name: string;
  email: string;
}

export const registrationForm = new GroupNode<RegistrationFormData>({
  form: {
    name: { value: '' },
    email: { value: '' },
  },
  validation: (path) => {
    required(path.name);
    minLength(path.name, 2);

    required(path.email);
    email(path.email);
  },
});
```

### Understanding Validation

- **`validation`** — function that defines validation rules for the form
- **`path`** — provides typed access to field paths
- **Validators** — functions like `required()`, `email()` that check field values
- **Multiple validators per field** — you can apply several validators to one field

## Built-in Validators

ReFormer provides common validators out of the box:

- **`required()`** — field must have a value
- **`email()`** — must be a valid email address
- **`minLength(n)`** — minimum length requirement
- **`maxLength(n)`** — maximum length requirement
- **`pattern(regex)`** — must match a regular expression
- **`min(n)`** / **`max(n)`** — numeric range validation

## Displaying Errors

Now let's update our component to show validation errors:

```tsx title="src/components/RegistrationForm/index.tsx"
import { useFormControl } from 'reformer';
import { registrationForm } from './form';

export function RegistrationForm() {
  const name = useFormControl(registrationForm.controls.name);
  const email = useFormControl(registrationForm.controls.email);

  return (
    <form>
      <div>
        <label htmlFor="name">Name</label>
        <input
          id="name"
          type="text"
          value={name.value}
          onChange={(e) => name.setValue(e.target.value)}
          onBlur={() => name.markAsTouched()}
        />
        {name.touched && name.errors?.required && (
          <span className="error">Name is required</span>
        )}
        {name.touched && name.errors?.minLength && (
          <span className="error">Name must be at least 2 characters</span>
        )}
      </div>

      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email.value}
          onChange={(e) => email.setValue(e.target.value)}
          onBlur={() => email.markAsTouched()}
        />
        {email.touched && email.errors?.required && (
          <span className="error">Email is required</span>
        )}
        {email.touched && email.errors?.email && (
          <span className="error">Invalid email format</span>
        )}
      </div>

      <button type="submit" disabled={!registrationForm.valid}>
        Register
      </button>
    </form>
  );
}
```

### Key Properties

- **`touched`** — indicates if the user has interacted with the field
- **`errors`** — object containing validation errors (or `null` if valid)
- **`valid`** — `true` if the field/form passes all validation
- **`markAsTouched()`** — marks the field as touched by the user

## Validation States

Fields have several validation-related states:

```typescript
const field = registrationForm.controls.name;

// Initially
console.log(field.touched);  // false
console.log(field.valid);    // false
console.log(field.errors);   // { required: true }

// After user interaction
field.markAsTouched();
console.log(field.touched);  // true

// After valid input
field.setValue('John');
console.log(field.valid);    // true
console.log(field.errors);   // null
```

## Form-level Validation

The form automatically aggregates validation from all fields:

```typescript
console.log(registrationForm.valid);
// false - form is invalid until all fields are valid

console.log(registrationForm.errors);
// { name: { required: true }, email: { required: true } }
```

## Validation on Change vs on Blur

ReFormer validates **on every change** by default, but errors are typically shown only after the field is `touched`:

- **Validation runs immediately** — `valid` and `errors` always reflect current state
- **Display errors conditionally** — use `touched` to avoid showing errors too early

```tsx
{/* Show error only after user has interacted with the field */}
{name.touched && name.errors?.required && (
  <span className="error">Name is required</span>
)}
```

## Try It Out

1. Leave the name field empty and click outside → see required error
2. Type "a" in the name field → see minLength error
3. Type "abc" → error disappears
4. Enter invalid email like "test@" → see email format error
5. Notice the submit button is disabled until the form is valid

## Key Concepts

- **`validation`** — function defining validation rules
- **Validators** — functions like `required(path)`, `email(path)`, `minLength(path, n)`
- **Built-in validators** — `required`, `email`, `minLength`, etc.
- **`touched`** — tracks user interaction with field
- **`errors`** — object with validation errors or `null`
- **`valid`** — boolean indicating validation state
- **`markAsTouched()`** — marks field as interacted with

## What's Next?

In the next lesson, we'll handle **form submission** and learn how to validate the entire form before sending data.
