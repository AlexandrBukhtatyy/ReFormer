---
sidebar_position: 3
---

# Form Submission

In this lesson, you'll learn how to handle form submission, validate the entire form, and manage the submission process.

## What You'll Learn

- How to handle form submit events
- How to validate all fields before submission
- How to manage loading and error states
- How to reset the form after successful submission

## Basic Form Submission

Let's add form submission to our registration form:

```tsx title="src/components/RegistrationForm/index.tsx"
import { useState } from 'react';
import { useFormControl } from 'reformer';
import { registrationForm } from './form';

export function RegistrationForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const name = useFormControl(registrationForm.controls.name);
  const email = useFormControl(registrationForm.controls.email);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Mark all fields as touched to show validation errors
    registrationForm.markAsTouched();

    // Check if form is valid
    if (!registrationForm.valid) {
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError(null);

      // Get form data
      const formData = registrationForm.value;

      // Send to API
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Registration failed');
      }

      // Success!
      alert('Registration successful!');

      // Reset form
      registrationForm.reset();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="name">Name</label>
        <input
          id="name"
          type="text"
          value={name.value}
          onChange={(e) => name.setValue(e.target.value)}
          onBlur={() => name.markAsTouched()}
          disabled={isSubmitting}
        />
        {name.touched && name.errors?.required && <span className="error">Name is required</span>}
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
          disabled={isSubmitting}
        />
        {email.touched && email.errors?.required && (
          <span className="error">Email is required</span>
        )}
        {email.touched && email.errors?.email && (
          <span className="error">Invalid email format</span>
        )}
      </div>

      {submitError && <div className="error">{submitError}</div>}

      <button type="submit" disabled={!registrationForm.valid || isSubmitting}>
        {isSubmitting ? 'Registering...' : 'Register'}
      </button>
    </form>
  );
}
```

## Key Methods for Submission

### markAsTouched()

Shows validation errors for all fields:

```typescript
// Before submission, mark all fields as touched
registrationForm.markAsTouched();

// Now all validation errors will be visible
// even for fields the user hasn't interacted with
```

### Checking Validity

Always check form validity before submitting:

```typescript
if (!registrationForm.valid) {
  // Form has validation errors
  return;
}

// Safe to submit
const data = registrationForm.value;
```

### Getting Form Data

The `value` property contains the complete form data:

```typescript
const formData = registrationForm.value;
// { name: 'John', email: 'john@example.com' }

// Send to API
await api.register(formData);
```

### Resetting the Form

After successful submission, reset the form to its initial state:

```typescript
registrationForm.reset();

// All fields return to their initial values
// All validation errors are cleared
// All fields are marked as untouched
```

## Managing Submission States

Use React state to manage the submission process:

```typescript
const [isSubmitting, setIsSubmitting] = useState(false);
const [submitError, setSubmitError] = useState<string | null>(null);

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  try {
    setIsSubmitting(true);
    setSubmitError(null);

    // Perform submission...
  } catch (error) {
    setSubmitError(error.message);
  } finally {
    setIsSubmitting(false);
  }
};
```

## Disabling During Submission

Disable inputs and buttons during submission to prevent double-submission:

```tsx
<input
  value={name.value}
  onChange={(e) => name.setValue(e.target.value)}
  disabled={isSubmitting}
/>

<button type="submit" disabled={!registrationForm.valid || isSubmitting}>
  {isSubmitting ? 'Registering...' : 'Register'}
</button>
```

## Complete Submission Flow

Here's the complete submission flow:

1. **User clicks submit** → `handleSubmit` is called
2. **Mark all fields as touched** → show all validation errors
3. **Check validity** → return early if invalid
4. **Set submitting state** → disable form
5. **Get form data** → `registrationForm.value`
6. **Send to API** → await the request
7. **Handle success** → reset form, show success message
8. **Handle error** → show error message
9. **Clear submitting state** → re-enable form

## Try It Out

1. Click submit with empty fields → see all validation errors
2. Fill only the name field → submit button stays disabled
3. Fill both fields with valid data → submit button becomes enabled
4. Click submit → form sends data and resets

## Key Concepts

- **`markAsTouched()`** — shows validation errors for all fields
- **`valid`** — check before submission
- **`value`** — contains complete form data
- **`reset()`** — resets form to initial state
- **`isSubmitting`** — tracks submission state
- **Disable during submission** — prevents double-submission

## What's Next?

Great job! You've completed the fundamentals. In the next section, we'll explore **Data Structures** and learn how to work with nested groups and dynamic arrays.
