---
sidebar_position: 3
---

# Async Validation

In this lesson, you'll learn how to validate fields against server-side data, such as checking username availability or validating email addresses.

## What You'll Learn

- How to create async validators
- How to handle loading states during validation
- How to debounce async validation
- How to display async validation errors

## Why Use Async Validation?

Some validations require server communication:

- Check if username is already taken
- Verify email address exists
- Validate coupon code against database
- Check if phone number is registered

## Creating an Async Validator

Let's create a registration form that checks if a username is available:

```typescript title="src/components/RegistrationForm/form.ts"
import { GroupNode } from 'reformer';
import { required, minLength } from 'reformer/validators';

interface RegistrationFormData {
  username: string;
  email: string;
  password: string;
}

// Async validator function
async function checkUsernameAvailability(username: string): Promise<{ available: boolean }> {
  const response = await fetch(`/api/check-username?username=${encodeURIComponent(username)}`);
  return response.json();
}

// Create async validator
function usernameAvailable() {
  return async (value: string) => {
    if (!value) return null; // Skip if empty (handled by required)

    try {
      const result = await checkUsernameAvailability(value);
      return result.available ? null : { usernameTaken: true };
    } catch (error) {
      return { serverError: true };
    }
  };
}

export const registrationForm = new GroupNode<RegistrationFormData>({
  form: {
    username: { value: '' },
    email: { value: '' },
    password: { value: '' },
  },
  validation: (path, { validateAsync }) => {
    required(path.username);
    minLength(path.username, 3);
    required(path.email);
    required(path.password);
    minLength(path.password, 8);

    // Async validation
    validateAsync(path.username, usernameAvailable(), {
      debounce: 500, // Wait 500ms after user stops typing
    });
  },
});
```

### Understanding Async Validation

- **`validateAsync(path, validator, options)`** — applies async validation
- **`validator`** — async function that returns errors or null
- **`debounce`** — delay in ms before running validation (avoids excessive API calls)
- **Return null** — validation passes
- **Return error object** — validation fails with errors

## Handling Loading State

Fields have a `validating` property to indicate async validation in progress:

```typescript
const username = registrationForm.controls.username;

console.log(username.validating); // true - validation in progress
console.log(username.validating); // false - validation complete
```

## React Component

```tsx title="src/components/RegistrationForm/index.tsx"
import { useFormControl } from 'reformer';
import { registrationForm } from './form';

export function RegistrationForm() {
  const username = useFormControl(registrationForm.controls.username);
  const email = useFormControl(registrationForm.controls.email);
  const password = useFormControl(registrationForm.controls.password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    registrationForm.markAsTouched();

    // Wait for async validation to complete
    await registrationForm.validateAsync();

    if (!registrationForm.valid) {
      return;
    }

    console.log('Registration data:', registrationForm.value);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="username">Username</label>
        <input
          id="username"
          value={username.value}
          onChange={(e) => username.setValue(e.target.value)}
          onBlur={() => username.markAsTouched()}
        />
        {username.validating && <span className="info">Checking availability...</span>}
        {username.touched && username.errors?.required && (
          <span className="error">Username is required</span>
        )}
        {username.touched && username.errors?.minLength && (
          <span className="error">Username must be at least 3 characters</span>
        )}
        {username.touched && username.errors?.usernameTaken && (
          <span className="error">Username is already taken</span>
        )}
        {username.touched && username.errors?.serverError && (
          <span className="error">Server error, please try again</span>
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
      </div>

      <div>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password.value}
          onChange={(e) => password.setValue(e.target.value)}
          onBlur={() => password.markAsTouched()}
        />
        {password.touched && password.errors?.minLength && (
          <span className="error">Password must be at least 8 characters</span>
        )}
      </div>

      <button type="submit" disabled={!registrationForm.valid || username.validating}>
        Register
      </button>
    </form>
  );
}
```

### Key Points

- **`field.validating`** — true while async validation runs
- **`form.validateAsync()`** — manually trigger async validation
- **Debouncing** — prevents API spam while user is typing
- **Disable submit** — while async validation is in progress

## Multiple Async Validators

You can have multiple async validators:

```typescript
validateAsync(path.email, emailExists(), { debounce: 500 }),
validateAsync(path.domain, domainAvailable(), { debounce: 1000 }),
```

## Async Validation Flow

1. **User types** → field value changes
2. **Debounce timer starts** → waits for user to stop typing
3. **Timer expires** → async validator runs
4. **`validating = true`** → show loading indicator
5. **API call completes** → validation result returned
6. **`validating = false`** → show errors or success
7. **Form validity updates** → enable/disable submit button

## Error Handling

Always handle errors in async validators:

```typescript
async function myAsyncValidator() {
  return async (value: string) => {
    try {
      const result = await apiCall(value);
      return result.valid ? null : { customError: true };
    } catch (error) {
      console.error('Validation error:', error);
      return { serverError: true }; // Return error, don't throw
    }
  };
}
```

## Try It Out

1. Type a username → see "Checking availability..." message
2. Type slowly → validation waits for you to finish
3. Try "admin" (if your API recognizes it) → see "already taken" error
4. Submit button stays disabled during validation

## Key Concepts

- **`validateAsync(path, validator, options)`** — async validation
- **`debounce`** — delay before running validation
- **`field.validating`** — indicates validation in progress
- **`form.validateAsync()`** — manually trigger validation
- **Error handling** — always catch and return errors
- **Loading indicators** — show while validating
- **Disable submit** — prevent submission during validation

## What's Next?

Excellent! You've mastered advanced features. In the final section, we'll put everything together in a **Real-world Example** — a complete loan application form that demonstrates all the concepts you've learned.
