---
sidebar_position: 3
---

# Form Composition

Compose complex forms from simple, reusable parts.

## Why Compose Forms?

Form composition helps you:

- Break large forms into manageable pieces
- Reuse form sections across different forms
- Create multi-step wizards
- Build dynamic forms that adapt to user input
- Maintain and test smaller form units

## Basic Composition

Combine simple schemas into a complex form:

```typescript title="forms/registration-form.ts"
import { GroupNode } from 'reformer';
import { personSchema, type Person } from '../schemas/person-schema';
import { addressSchema, type Address } from '../schemas/address-schema';
import { validatePerson } from '../validators/person-validators';
import { validateAddress } from '../validators/address-validators';

interface RegistrationForm {
  personalInfo: Person;
  mailingAddress: Address;
  billingAddress: Address;
  sameAsMailingAddress: boolean;
}

export const createRegistrationForm = () =>
  new GroupNode<RegistrationForm>({
    form: {
      personalInfo: personSchema(),
      mailingAddress: addressSchema(),
      billingAddress: addressSchema(),
      sameAsMailingAddress: { value: true },
    },
    validation: (path) => {
      validatePerson(path.personalInfo);
      validateAddress(path.mailingAddress);

      // Only validate billing if different
      when(
        () => !form.controls.sameAsMailingAddress.value.value,
        (path) => validateAddress(path.billingAddress)
      );
    },
    behaviors: (path, { use }) => [
      // Copy mailing to billing when checkbox is checked
      use({
        key: 'syncAddresses',
        paths: [path.mailingAddress, path.sameAsMailingAddress],
        run: (values, ctx) => {
          if (values.sameAsMailingAddress) {
            const mailing = ctx.form.mailingAddress.getValue();
            ctx.form.billingAddress.setValue(mailing);
          }
        },
      }),
    ],
  });
```

## Multi-Step Wizard

Create a multi-step form with navigation:

```typescript title="forms/multi-step-wizard.ts"
import { GroupNode } from 'reformer';
import { signal } from '@preact/signals-core';

interface Step1Data {
  firstName: string;
  lastName: string;
  email: string;
}

interface Step2Data {
  company: string;
  position: string;
  experience: number;
}

interface Step3Data {
  street: string;
  city: string;
  zipCode: string;
}

interface WizardForm {
  step1: Step1Data;
  step2: Step2Data;
  step3: Step3Data;
}

export const createWizardForm = () => {
  const currentStep = signal(1);
  const completedSteps = signal<number[]>([]);

  const form = new GroupNode<WizardForm>({
    form: {
      step1: {
        firstName: { value: '' },
        lastName: { value: '' },
        email: { value: '' },
      },
      step2: {
        company: { value: '' },
        position: { value: '' },
        experience: { value: 0 },
      },
      step3: {
        street: { value: '' },
        city: { value: '' },
        zipCode: { value: '' },
      },
    },
    validation: (path) => {
      // Step 1 validation
      required(path.step1.firstName);
      required(path.step1.lastName);
      required(path.step1.email);
      email(path.step1.email);

      // Step 2 validation
      required(path.step2.company);
      required(path.step2.position);
      min(path.step2.experience, 0);

      // Step 3 validation
      required(path.step3.street);
      required(path.step3.city);
      required(path.step3.zipCode);
      pattern(path.step3.zipCode, /^\d{5}$/, 'Invalid ZIP');
    },
  });

  const nextStep = () => {
    const stepKey = `step${currentStep.value}` as keyof WizardForm;
    const stepNode = form.controls[stepKey];

    // Mark step fields as touched
    stepNode.markAsTouched();

    // Validate current step
    if (stepNode.valid.value) {
      completedSteps.value = [...completedSteps.value, currentStep.value];
      currentStep.value = Math.min(currentStep.value + 1, 3);
    }
  };

  const prevStep = () => {
    currentStep.value = Math.max(currentStep.value - 1, 1);
  };

  const goToStep = (step: number) => {
    if (completedSteps.value.includes(step - 1) || step === 1) {
      currentStep.value = step;
    }
  };

  return {
    form,
    currentStep,
    completedSteps,
    nextStep,
    prevStep,
    goToStep,
  };
};
```

### Wizard UI Component

```tsx title="components/WizardForm.tsx"
import { useFormControl } from 'reformer';
import { useSignal } from '@preact/signals-react';
import { createWizardForm } from '../forms/multi-step-wizard';

export function WizardForm() {
  const wizard = useMemo(() => createWizardForm(), []);
  const { form, currentStep, nextStep, prevStep, goToStep } = wizard;

  const step1 = useFormControl(form.controls.step1);
  const step2 = useFormControl(form.controls.step2);
  const step3 = useFormControl(form.controls.step3);

  return (
    <div className="wizard">
      {/* Step indicator */}
      <div className="wizard__steps">
        {[1, 2, 3].map((step) => (
          <button
            key={step}
            onClick={() => goToStep(step)}
            className={currentStep.value === step ? 'active' : ''}
          >
            Step {step}
          </button>
        ))}
      </div>

      {/* Step 1: Personal Info */}
      {currentStep.value === 1 && (
        <div className="wizard__step">
          <h2>Personal Information</h2>
          <TextField field={step1.firstName} label="First Name" />
          <TextField field={step1.lastName} label="Last Name" />
          <TextField field={step1.email} label="Email" type="email" />
        </div>
      )}

      {/* Step 2: Professional Info */}
      {currentStep.value === 2 && (
        <div className="wizard__step">
          <h2>Professional Information</h2>
          <TextField field={step2.company} label="Company" />
          <TextField field={step2.position} label="Position" />
          <NumberField field={step2.experience} label="Years of Experience" />
        </div>
      )}

      {/* Step 3: Address */}
      {currentStep.value === 3 && (
        <div className="wizard__step">
          <h2>Address</h2>
          <TextField field={step3.street} label="Street" />
          <TextField field={step3.city} label="City" />
          <TextField field={step3.zipCode} label="ZIP Code" />
        </div>
      )}

      {/* Navigation */}
      <div className="wizard__navigation">
        {currentStep.value > 1 && <button onClick={prevStep}>Previous</button>}
        {currentStep.value < 3 && <button onClick={nextStep}>Next</button>}
        {currentStep.value === 3 && (
          <button onClick={() => console.log(form.getValue())}>Submit</button>
        )}
      </div>
    </div>
  );
}
```

## Dynamic Form Sections

Add/remove form sections dynamically:

```typescript title="forms/dynamic-education-form.ts"
import { GroupNode } from 'reformer';

interface Education {
  institution: string;
  degree: string;
  startDate: Date | null;
  endDate: Date | null;
}

interface EducationForm {
  educations: Education[];
}

export const createEducationForm = () =>
  new GroupNode<EducationForm>({
    form: {
      educations: [
        {
          institution: { value: '' },
          degree: { value: '' },
          startDate: { value: null },
          endDate: { value: null },
        },
      ],
    },
    validation: (path) => {
      required(path.educations.$each.institution);
      required(path.educations.$each.degree);
      required(path.educations.$each.startDate);
    },
  });
```

### Dynamic Sections UI

```tsx title="components/EducationForm.tsx"
import { useFormControl } from 'reformer';
import { createEducationForm } from '../forms/dynamic-education-form';

export function EducationForm() {
  const form = useMemo(() => createEducationForm(), []);
  const educations = useFormControl(form.controls.educations);

  const addEducation = () => {
    form.controls.educations.push({
      institution: '',
      degree: '',
      startDate: null,
      endDate: null,
    });
  };

  const removeEducation = (index: number) => {
    form.controls.educations.removeAt(index);
  };

  return (
    <div className="education-form">
      <h2>Education</h2>

      {educations.controls.map((education, index) => (
        <div key={education.id} className="education-form__item">
          <h3>Education {index + 1}</h3>
          <TextField field={education.controls.institution} label="Institution" />
          <TextField field={education.controls.degree} label="Degree" />
          <DateField field={education.controls.startDate} label="Start Date" />
          <DateField field={education.controls.endDate} label="End Date" />

          {educations.controls.length > 1 && (
            <button onClick={() => removeEducation(index)}>Remove</button>
          )}
        </div>
      ))}

      <button onClick={addEducation}>Add Education</button>
    </div>
  );
}
```

## Nested Tab Forms

Create tabbed forms with nested sections:

```typescript title="forms/settings-form.ts"
import { GroupNode } from 'reformer';

interface ProfileSettings {
  displayName: string;
  bio: string;
  avatar: string;
}

interface NotificationSettings {
  email: boolean;
  push: boolean;
  sms: boolean;
}

interface PrivacySettings {
  profileVisibility: 'public' | 'private' | 'friends';
  showEmail: boolean;
  showPhone: boolean;
}

interface SettingsForm {
  profile: ProfileSettings;
  notifications: NotificationSettings;
  privacy: PrivacySettings;
}

export const createSettingsForm = () =>
  new GroupNode<SettingsForm>({
    form: {
      profile: {
        displayName: { value: '' },
        bio: { value: '' },
        avatar: { value: '' },
      },
      notifications: {
        email: { value: true },
        push: { value: false },
        sms: { value: false },
      },
      privacy: {
        profileVisibility: { value: 'public' },
        showEmail: { value: false },
        showPhone: { value: false },
      },
    },
    validation: (path) => {
      required(path.profile.displayName);
      minLength(path.profile.displayName, 3);
      maxLength(path.profile.bio, 500);
    },
  });
```

### Tabbed Settings UI

```tsx title="components/SettingsForm.tsx"
import { useState, useMemo } from 'react';
import { useFormControl } from 'reformer';
import { createSettingsForm } from '../forms/settings-form';

type Tab = 'profile' | 'notifications' | 'privacy';

export function SettingsForm() {
  const form = useMemo(() => createSettingsForm(), []);
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  const profile = useFormControl(form.controls.profile);
  const notifications = useFormControl(form.controls.notifications);
  const privacy = useFormControl(form.controls.privacy);

  const handleSave = () => {
    form.markAsTouched();
    if (form.valid.value) {
      console.log('Saving:', form.getValue());
    }
  };

  return (
    <div className="settings-form">
      {/* Tabs */}
      <div className="settings-form__tabs">
        <button
          onClick={() => setActiveTab('profile')}
          className={activeTab === 'profile' ? 'active' : ''}
        >
          Profile
        </button>
        <button
          onClick={() => setActiveTab('notifications')}
          className={activeTab === 'notifications' ? 'active' : ''}
        >
          Notifications
        </button>
        <button
          onClick={() => setActiveTab('privacy')}
          className={activeTab === 'privacy' ? 'active' : ''}
        >
          Privacy
        </button>
      </div>

      {/* Content */}
      <div className="settings-form__content">
        {activeTab === 'profile' && (
          <div>
            <TextField field={profile.displayName} label="Display Name" />
            <TextareaField field={profile.bio} label="Bio" />
            <FileUploadField field={profile.avatar} label="Avatar" />
          </div>
        )}

        {activeTab === 'notifications' && (
          <div>
            <Checkbox field={notifications.email} label="Email Notifications" />
            <Checkbox field={notifications.push} label="Push Notifications" />
            <Checkbox field={notifications.sms} label="SMS Notifications" />
          </div>
        )}

        {activeTab === 'privacy' && (
          <div>
            <Select
              field={privacy.profileVisibility}
              label="Profile Visibility"
              options={[
                { value: 'public', label: 'Public' },
                { value: 'private', label: 'Private' },
                { value: 'friends', label: 'Friends Only' },
              ]}
            />
            <Checkbox field={privacy.showEmail} label="Show Email" />
            <Checkbox field={privacy.showPhone} label="Show Phone" />
          </div>
        )}
      </div>

      <button onClick={handleSave}>Save Settings</button>
    </div>
  );
}
```

## Conditional Sections

Show/hide form sections based on conditions:

```typescript title="forms/job-application-form.ts"
import { GroupNode } from 'reformer';

interface JobApplication {
  hasExperience: boolean;
  experience?: {
    years: number;
    companies: string[];
  };
  needsVisa: boolean;
  visaInfo?: {
    country: string;
    type: string;
  };
}

export const createJobApplicationForm = () =>
  new GroupNode<JobApplication>({
    form: {
      hasExperience: { value: false },
      experience: {
        years: { value: 0 },
        companies: [{ value: '' }],
      },
      needsVisa: { value: false },
      visaInfo: {
        country: { value: '' },
        type: { value: '' },
      },
    },
    validation: (path) => {
      // Conditional validation
      when(
        () => form.controls.hasExperience.value.value,
        (path) => {
          required(path.experience.years);
          min(path.experience.years, 1);
          required(path.experience.companies.$each);
        }
      );

      when(
        () => form.controls.needsVisa.value.value,
        (path) => {
          required(path.visaInfo.country);
          required(path.visaInfo.type);
        }
      );
    },
    behaviors: (path, { use }) => [
      // Show/hide experience section
      use({
        key: 'toggleExperience',
        paths: [path.hasExperience],
        run: (values, ctx) => {
          const visible = values.hasExperience;
          ctx.form.experience.setVisible(visible);
        },
      }),

      // Show/hide visa section
      use({
        key: 'toggleVisa',
        paths: [path.needsVisa],
        run: (values, ctx) => {
          const visible = values.needsVisa;
          ctx.form.visaInfo.setVisible(visible);
        },
      }),
    ],
  });
```

## Form Extension Pattern

Extend base forms with additional fields:

```typescript title="forms/base-user-form.ts"
import { GroupNode, FormSchema } from 'reformer';

export interface BaseUser {
  email: string;
  firstName: string;
  lastName: string;
}

export const baseUserSchema = (): FormSchema<BaseUser> => ({
  email: { value: '' },
  firstName: { value: '' },
  lastName: { value: '' },
});

export function createBaseUserForm() {
  return new GroupNode<BaseUser>({
    form: baseUserSchema(),
    validation: (path) => {
      required(path.email);
      email(path.email);
      required(path.firstName);
      required(path.lastName);
    },
  });
}
```

```typescript title="forms/admin-user-form.ts"
import { GroupNode } from 'reformer';
import { baseUserSchema, type BaseUser } from './base-user-form';

interface AdminUser extends BaseUser {
  role: 'admin' | 'superadmin';
  permissions: string[];
}

export function createAdminUserForm() {
  return new GroupNode<AdminUser>({
    form: {
      ...baseUserSchema(),
      role: { value: 'admin' },
      permissions: [{ value: '' }],
    },
    validation: (path) => {
      // Base validation
      required(path.email);
      email(path.email);
      required(path.firstName);
      required(path.lastName);

      // Admin-specific validation
      required(path.role);
      required(path.permissions.$each);
    },
  });
}
```

## Shared State Between Forms

Share data between multiple forms:

```typescript title="forms/checkout-forms.ts"
import { GroupNode } from 'reformer';
import { signal } from '@preact/signals-core';

// Shared state
const sharedCheckoutData = signal({
  customerEmail: '',
  saveForLater: false,
});

// Step 1: Shipping form
export function createShippingForm() {
  return new GroupNode({
    form: {
      email: { value: sharedCheckoutData.value.customerEmail },
      address: {
        street: { value: '' },
        city: { value: '' },
        zipCode: { value: '' },
      },
    },
    behaviors: (path, { use }) => [
      // Save email to shared state
      use({
        key: 'syncEmail',
        paths: [path.email],
        run: (values) => {
          sharedCheckoutData.value = {
            ...sharedCheckoutData.value,
            customerEmail: values.email,
          };
        },
      }),
    ],
  });
}

// Step 2: Payment form
export function createPaymentForm() {
  return new GroupNode({
    form: {
      email: { value: sharedCheckoutData.value.customerEmail },
      cardNumber: { value: '' },
      expiryDate: { value: '' },
      cvv: { value: '' },
    },
  });
}
```

## Best Practices

### 1. Keep Form Modules Small

```typescript
// ✅ Good - focused modules
import { personalInfoSchema } from './schemas/personal-info';
import { addressSchema } from './schemas/address';
import { paymentSchema } from './schemas/payment';

// ❌ Bad - everything in one file
const massiveSchema = {
  // 500 lines of schema definitions
};
```

### 2. Use Composition Over Duplication

```typescript
// ✅ Good - compose from reusable parts
const registrationForm = {
  personal: personSchema(),
  contact: contactSchema(),
  address: addressSchema(),
};

// ❌ Bad - repeat schema definitions
const registrationForm = {
  firstName: { value: '' },
  lastName: { value: '' },
  email: { value: '' },
  phone: { value: '' },
  // ... repeated fields
};
```

### 3. Separate Concerns

```typescript
// ✅ Good - separate files
// schema.ts - form structure
// validators.ts - validation logic
// behaviors.ts - reactive logic
// index.ts - public API

// ❌ Bad - everything mixed together
const form = new GroupNode({
  form: {
    // 100 lines of schema
  },
  validation: () => {
    // 100 lines of validation
  },
  behaviors: () => {
    // 100 lines of behaviors
  },
});
```

### 4. Type Your Composed Forms

```typescript
// ✅ Good - typed composition
interface RegistrationForm {
  personal: Person;
  contact: ContactInfo;
  address: Address;
}

const form = new GroupNode<RegistrationForm>({
  form: {
    personal: personSchema(),
    contact: contactSchema(),
    address: addressSchema(),
  },
});

// Full type safety
const email: string = form.controls.contact.controls.email.value.value;
```

### 5. Document Composition

```typescript
/**
 * Registration form with three sections:
 * - Personal: firstName, lastName, birthDate
 * - Contact: email, phone, preferredContact
 * - Address: street, city, state, zipCode
 *
 * Behaviors:
 * - Auto-format phone number
 * - Validate email availability (async)
 */
export function createRegistrationForm() {
  // ...
}
```

## Next Steps

- [Reusable Schemas](/docs/patterns/reusable-schemas) — Create reusable form parts
- [Validation Strategies](/docs/validation/validation-strategies) — Advanced validation patterns
- [Custom Behaviors](/docs/behaviors/custom) — Add reactive logic to composed forms
