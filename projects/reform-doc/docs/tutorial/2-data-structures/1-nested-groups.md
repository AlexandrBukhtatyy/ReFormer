---
sidebar_position: 1
---

# Nested Groups

In this lesson, you'll learn how to organize complex forms into sections using nested `GroupNode` structures.

## What You'll Learn

- How to create nested form structures
- How to organize forms into logical sections
- How to access nested field values
- How to validate nested data

## Why Use Nested Groups?

Real-world forms often have logical sections. Instead of one flat structure, you can organize related fields into groups:

```typescript
// Flat structure (harder to maintain)
{
  firstName: string;
  lastName: string;
  street: string;
  city: string;
  zipCode: string;
}

// Nested structure (better organization)
{
  personalInfo: {
    firstName: string;
    lastName: string;
  };
  address: {
    street: string;
    city: string;
    zipCode: string;
  };
}
```

## Creating Nested Groups

Let's create a user profile form with nested sections:

```typescript title="src/components/ProfileForm/form.ts"
import { GroupNode } from 'reformer';
import { required, email, minLength } from 'reformer/validators';

interface ProfileFormData {
  personalInfo: {
    firstName: string;
    lastName: string;
    email: string;
  };
  address: {
    street: string;
    city: string;
    zipCode: string;
  };
}

export const profileForm = new GroupNode<ProfileFormData>({
  form: {
    personalInfo: {
      firstName: { value: '' },
      lastName: { value: '' },
      email: { value: '' },
    },
    address: {
      street: { value: '' },
      city: { value: '' },
      zipCode: { value: '' },
    },
  },
  validation: (path) => {
    // Validate personal info fields
    required(path.personalInfo.firstName);
    minLength(path.personalInfo.firstName, 2);
    required(path.personalInfo.lastName);
    minLength(path.personalInfo.lastName, 2);
    required(path.personalInfo.email);
    email(path.personalInfo.email);

    // Validate address fields
    required(path.address.street);
    required(path.address.city);
    required(path.address.zipCode);
    minLength(path.address.zipCode, 5);
  },
});
```

### Understanding Nested Structure

- **Nested objects become groups** — `personalInfo` and `address` are automatically converted to group nodes
- **Simple configuration** — just nest objects with field configs, no need for explicit `new GroupNode`
- **Type-safe paths** — `path.personalInfo.firstName` provides full type safety
- **Validation spans all levels** — validate any field regardless of nesting

## Accessing Nested Values

You can access nested values at any level:

```typescript
// Get entire form value
console.log(profileForm.value);
// {
//   personalInfo: { firstName: '', lastName: '', email: '' },
//   address: { street: '', city: '', zipCode: '' }
// }

// Get a section value
console.log(profileForm.controls.personalInfo.value);
// { firstName: '', lastName: '', email: '' }

// Get a specific field value
console.log(profileForm.controls.personalInfo.controls.firstName.value);
// ''

// Update nested field
profileForm.controls.personalInfo.controls.firstName.setValue('John');

console.log(profileForm.value);
// {
//   personalInfo: { firstName: 'John', lastName: '', email: '' },
//   address: { street: '', city: '', zipCode: '' }
// }
```

## React Component

Let's create a component that renders the nested form in sections:

```tsx title="src/components/ProfileForm/index.tsx"
import { useFormControl } from 'reformer';
import { profileForm } from './form';

export function ProfileForm() {
  // Personal info fields
  const firstName = useFormControl(profileForm.controls.personalInfo.controls.firstName);
  const lastName = useFormControl(profileForm.controls.personalInfo.controls.lastName);
  const email = useFormControl(profileForm.controls.personalInfo.controls.email);

  // Address fields
  const street = useFormControl(profileForm.controls.address.controls.street);
  const city = useFormControl(profileForm.controls.address.controls.city);
  const zipCode = useFormControl(profileForm.controls.address.controls.zipCode);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    profileForm.markAllAsTouched();

    if (!profileForm.valid) {
      return;
    }

    console.log('Form data:', profileForm.value);
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Personal Information Section */}
      <section>
        <h2>Personal Information</h2>

        <div>
          <label htmlFor="firstName">First Name</label>
          <input
            id="firstName"
            value={firstName.value}
            onChange={(e) => firstName.setValue(e.target.value)}
            onBlur={() => firstName.markAsTouched()}
          />
          {firstName.touched && firstName.errors?.required && (
            <span className="error">First name is required</span>
          )}
        </div>

        <div>
          <label htmlFor="lastName">Last Name</label>
          <input
            id="lastName"
            value={lastName.value}
            onChange={(e) => lastName.setValue(e.target.value)}
            onBlur={() => lastName.markAsTouched()}
          />
          {lastName.touched && lastName.errors?.required && (
            <span className="error">Last name is required</span>
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
          {email.touched && email.errors?.email && (
            <span className="error">Invalid email</span>
          )}
        </div>
      </section>

      {/* Address Section */}
      <section>
        <h2>Address</h2>

        <div>
          <label htmlFor="street">Street</label>
          <input
            id="street"
            value={street.value}
            onChange={(e) => street.setValue(e.target.value)}
            onBlur={() => street.markAsTouched()}
          />
          {street.touched && street.errors?.required && (
            <span className="error">Street is required</span>
          )}
        </div>

        <div>
          <label htmlFor="city">City</label>
          <input
            id="city"
            value={city.value}
            onChange={(e) => city.setValue(e.target.value)}
            onBlur={() => city.markAsTouched()}
          />
          {city.touched && city.errors?.required && (
            <span className="error">City is required</span>
          )}
        </div>

        <div>
          <label htmlFor="zipCode">Zip Code</label>
          <input
            id="zipCode"
            value={zipCode.value}
            onChange={(e) => zipCode.setValue(e.target.value)}
            onBlur={() => zipCode.markAsTouched()}
          />
          {zipCode.touched && zipCode.errors?.minLength && (
            <span className="error">Zip code must be at least 5 characters</span>
          )}
        </div>
      </section>

      <button type="submit" disabled={!profileForm.valid}>
        Save Profile
      </button>
    </form>
  );
}
```

## Section-level Validation

You can check validation state at the section level:

```typescript
// Check if entire section is valid
console.log(profileForm.controls.personalInfo.valid);
// false

// Check section errors
console.log(profileForm.controls.personalInfo.errors);
// { firstName: { required: true }, lastName: { required: true }, ... }

// Mark entire section as touched
profileForm.controls.personalInfo.markAllAsTouched();
```

## Benefits of Nested Groups

1. **Better Organization** — logically group related fields
2. **Easier Maintenance** — changes to one section don't affect others
3. **Reusable Sections** — can extract sections into separate forms
4. **Section-level Operations** — validate, reset, or check validity of entire sections
5. **Clear Data Structure** — mirrors your domain model

## Try It Out

1. Fill in some personal info fields → see how section values update
2. Leave address fields empty → notice section-level validation
3. Submit form → see the complete nested data structure

## Key Concepts

- **Nested objects** — groups can contain other groups through simple nested objects
- **Type-safe access** — `path.section.field` provides full type safety
- **Section operations** — validate/reset/check entire sections
- **Organized structure** — mirrors real-world data models
- **Independent sections** — each section manages its own state

## What's Next?

In the next lesson, we'll learn about **Dynamic Arrays** — how to handle lists of items that users can add or remove.
