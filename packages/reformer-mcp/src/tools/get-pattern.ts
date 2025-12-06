export const getPatternToolDefinition = {
  name: 'get_pattern',
  description:
    'Get a usage pattern for common ReFormer scenarios. Returns problem description, solution, and working code.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      pattern: {
        type: 'string',
        description:
          'Pattern name or description (e.g., "computed-nested", "conditional-fields", "cross-validation")',
      },
    },
    required: ['pattern'],
  },
};

interface Pattern {
  name: string;
  description: string;
  problem?: string;
  solution: string;
  code: string;
  relatedPatterns?: string[];
}

const patterns: Record<string, Pattern> = {
  'computed-nested': {
    name: 'Computed Field from Nested Fields',
    description: 'Compute a root-level field from nested object fields',
    problem:
      'computeFrom does not work when source paths are from a nested structure and target is at the root level. TypeScript infers wrong types.',
    solution: 'Use watchField with ctx.setFieldValue for cross-level computations',
    code: `// ❌ This won't work - cross-level paths
computeFrom(
  [path.personalData.lastName, path.personalData.firstName],
  path.fullName, // root level - incompatible with nested sources
  ({ lastName, firstName }) => \`\${lastName} \${firstName}\`
);

// ✅ Solution: Use watchField
import { watchField } from '@reformer/core/behaviors';

// Watch each source field
watchField(path.personalData.lastName, (_value, ctx) => {
  updateFullName(ctx);
});

watchField(path.personalData.firstName, (_value, ctx) => {
  updateFullName(ctx);
});

function updateFullName(ctx: WatchContext<MyForm>) {
  const lastName = ctx.form.personalData.lastName.value.value || '';
  const firstName = ctx.form.personalData.firstName.value.value || '';
  ctx.setFieldValue('fullName', \`\${lastName} \${firstName}\`.trim());
}`,
    relatedPatterns: ['watch-multiple', 'computed-same-level'],
  },

  'computed-same-level': {
    name: 'Computed Field from Same Level',
    description: 'Compute a field from other fields at the same nesting level',
    solution: 'Use computeFrom when all paths are at the same level',
    code: `import { computeFrom } from '@reformer/core/behaviors';

// All paths at root level - works perfectly
computeFrom(
  [path.price, path.quantity],
  path.total,
  ({ price, quantity }) => (price || 0) * (quantity || 0)
);

// All paths nested in same object - also works
computeFrom(
  [path.address.city, path.address.street],
  path.address.fullAddress,
  ({ city, street }) => \`\${street}, \${city}\`
);`,
  },

  'conditional-fields': {
    name: 'Conditional Fields with Auto-Reset',
    description: 'Show/hide fields based on condition and reset when hidden',
    solution: 'Use enableWhen with resetOnDisable option',
    code: `import { enableWhen } from '@reformer/core/behaviors';

// Show mortgage fields only when loanType is 'mortgage'
// Reset values when the field becomes disabled
enableWhen(
  path.mortgageDetails,
  (form) => form.loanType === 'mortgage',
  { resetOnDisable: true }
);

// Show 'other' text field when reason is 'other'
enableWhen(
  path.otherReason,
  (form) => form.reason === 'other',
  { resetOnDisable: true }
);

// In validation - only validate when enabled
validation: (path) => {
  applyWhen(
    path.loanType,
    (type) => type === 'mortgage',
    (p) => {
      required(p.mortgageDetails.propertyValue);
    }
  );
}`,
    relatedPatterns: ['conditional-validation'],
  },

  'conditional-validation': {
    name: 'Conditional Validation',
    description: 'Apply validation rules only when conditions are met',
    solution: 'Use applyWhen() for conditional validators',
    code: `import { required, applyWhen, min } from '@reformer/core/validators';
import type { ValidationSchemaFn } from '@reformer/core';

const validation: ValidationSchemaFn<MyForm> = (path) => {
  // Always required
  required(path.email);

  // Required only when hasPhone is true
  applyWhen(
    path.hasPhone,
    (hasPhone) => hasPhone === true,
    (p) => {
      required(p.phone);
    }
  );

  // Validate age only for specific countries
  applyWhen(
    path.country,
    (country) => country === 'US',
    (p) => {
      required(p.age);
      min(p.age, 21, { message: 'Must be 21+ in the US' });
    }
  );
};`,
    relatedPatterns: ['conditional-fields', 'cross-validation'],
  },

  'cross-validation': {
    name: 'Cross-Field Validation',
    description: 'Validate one field based on another field value',
    solution: 'Use validateTree for cross-field validation',
    code: `import { validateTree, required } from '@reformer/core/validators';
import type { ValidationSchemaFn } from '@reformer/core';

const validation: ValidationSchemaFn<MyForm> = (path) => {
  required(path.password);
  required(path.confirmPassword);

  // Cross-field validation
  validateTree((ctx) => {
    const password = ctx.form.password.value.value;
    const confirm = ctx.form.confirmPassword.value.value;

    if (password && confirm && password !== confirm) {
      ctx.setError('confirmPassword', {
        key: 'passwordMismatch',
        message: 'Passwords do not match',
      });
    }
    return null;
  });

  // Date range validation
  validateTree((ctx) => {
    const start = ctx.form.startDate.value.value;
    const end = ctx.form.endDate.value.value;

    if (start && end && new Date(start) > new Date(end)) {
      ctx.setError('endDate', {
        key: 'dateRange',
        message: 'End date must be after start date',
      });
    }
    return null;
  });
};`,
    relatedPatterns: ['conditional-validation'],
  },

  'type-safe-control': {
    name: 'Type-Safe useFormControl',
    description: 'Get proper TypeScript types from useFormControl',
    problem:
      'useFormControl returns FormFields[] instead of the expected type due to complex generics',
    solution: 'Use type assertion with FieldNode<T>',
    code: `import { useFormControl } from '@reformer/core';
import type { FieldNode } from '@reformer/core';

// ❌ Problem: value might be typed as FormFields[]
const { value: loanType } = useFormControl(form.loanType);
if (loanType === 'mortgage') { ... } // Type error!

// ✅ Solution: Use type assertion
const { value: loanType } = useFormControl(
  form.loanType as FieldNode<LoanType>
);
if (loanType === 'mortgage') { ... } // OK!

// For complex forms, create a typed wrapper
function useTypedControl<T>(field: FieldNode<T>) {
  return useFormControl(field as FieldNode<T>);
}

const { value } = useTypedControl<LoanType>(form.loanType);`,
    relatedPatterns: ['form-types'],
  },

  'form-types': {
    name: 'Form Type Definitions',
    description: 'Define form types correctly for ReFormer',
    problem: 'Using null instead of undefined, or adding index signatures breaks types',
    solution: 'Use undefined for optional values, avoid index signatures',
    code: `// ❌ WRONG - using null
interface MyForm {
  amount: number | null;
  date: string | null;
}

// ❌ WRONG - index signature breaks field types
interface MyForm {
  [key: string]: unknown;
  name: string;
  age: number;
}

// ✅ CORRECT - use undefined for optional
interface MyForm {
  amount: number | undefined;
  date: string | undefined;
  // Or simply optional
  amount?: number;
  date?: string;
}

// ✅ CORRECT - no index signature
interface MyForm {
  name: string;
  age: number;
  email: string;
}

// For enums/unions
type LoanType = 'personal' | 'mortgage' | 'auto';

interface LoanForm {
  loanType: LoanType;
  amount: number;
}`,
    relatedPatterns: ['type-safe-control'],
  },

  'watch-multiple': {
    name: 'Watch Multiple Fields',
    description: 'React to changes in multiple fields',
    solution: 'Create multiple watchField calls or use a shared handler',
    code: `import { watchField } from '@reformer/core/behaviors';

// Option 1: Separate watchers with shared handler
const updateTotal = (ctx: WatchContext<MyForm>) => {
  const price = ctx.form.price.value.value || 0;
  const quantity = ctx.form.quantity.value.value || 0;
  const discount = ctx.form.discount.value.value || 0;

  const total = price * quantity * (1 - discount / 100);
  ctx.setFieldValue('total', total);
};

watchField(path.price, (_, ctx) => updateTotal(ctx));
watchField(path.quantity, (_, ctx) => updateTotal(ctx));
watchField(path.discount, (_, ctx) => updateTotal(ctx));

// Option 2: For same-level fields, use computeFrom
computeFrom(
  [path.price, path.quantity, path.discount],
  path.total,
  ({ price, quantity, discount }) => {
    return (price || 0) * (quantity || 0) * (1 - (discount || 0) / 100);
  }
);`,
    relatedPatterns: ['computed-nested', 'computed-same-level'],
  },

  'nested-forms': {
    name: 'Nested Form Structure',
    description: 'Create forms with nested objects',
    solution: 'Define nested structure in schema with proper types',
    code: `// Type definition
interface UserForm {
  name: string;
  email: string;
  address: {
    street: string;
    city: string;
    zip: string;
  };
  contacts: Array<{
    type: 'phone' | 'email';
    value: string;
  }>;
}

// Form creation
const form = createForm<UserForm>({
  form: {
    name: { value: '' },
    email: { value: '' },
    address: {
      street: { value: '' },
      city: { value: '' },
      zip: { value: '' },
    },
    contacts: [],
  },
  validation: (path) => {
    required(path.name);
    email(path.email);
    required(path.address.city);
  },
});

// Access nested fields
const { value: city } = useFormControl(form.address.city);

// Add array item
form.contacts.push({
  type: { value: 'phone' },
  value: { value: '' },
});`,
    relatedPatterns: ['form-types'],
  },

  'multi-step': {
    name: 'Multi-Step Form',
    description: 'Create multi-step wizard forms',
    solution: 'Use a single form with step-based validation and visibility',
    code: `interface MultiStepForm {
  currentStep: number;
  // Step 1
  name: string;
  email: string;
  // Step 2
  address: string;
  city: string;
  // Step 3
  cardNumber: string;
  expiry: string;
}

// Step-specific validation schemas
const step1Validation: ValidationSchemaFn<MultiStepForm> = (path) => {
  required(path.name);
  email(path.email);
};

const step2Validation: ValidationSchemaFn<MultiStepForm> = (path) => {
  required(path.address);
  required(path.city);
};

const step3Validation: ValidationSchemaFn<MultiStepForm> = (path) => {
  required(path.cardNumber);
  required(path.expiry);
};

// STEP_VALIDATIONS map for useStepForm hook
const STEP_VALIDATIONS = {
  1: step1Validation,
  2: step2Validation,
  3: step3Validation,
};

const form = createForm<MultiStepForm>({
  form: {
    currentStep: { value: 1, component: Input },
    name: { value: '', component: Input },
    email: { value: '', component: Input },
    address: { value: '', component: Input },
    city: { value: '', component: Input },
    cardNumber: { value: '', component: Input },
    expiry: { value: '', component: Input },
  },
  // Full validation combines all steps
  validation: (path) => {
    step1Validation(path);
    step2Validation(path);
    step3Validation(path);
  },
});

// Navigate steps
const goToStep = (step: number) => {
  form.currentStep.setValue(step);
};

// Validate current step before proceeding
const validateAndNext = async () => {
  await form.validate();
  if (form.valid.value) {
    goToStep(form.currentStep.value.value + 1);
  }
};`,
    relatedPatterns: ['conditional-validation'],
  },

  'async-watchfield': {
    name: 'Async watchField with Error Handling',
    description: 'Properly handle async operations in watchField with error handling and guards',
    problem:
      'Missing immediate: false causes initialization loops. Missing error handling causes silent failures. Missing guard clause causes unnecessary API calls.',
    solution: 'Always use immediate: false, add try-catch, add guard clause for empty values',
    code: `import { watchField } from '@reformer/core/behaviors';

// ✅ CORRECT - async watchField with all safeguards
watchField(
  path.parentField,
  async (value, ctx) => {
    // Guard clause - skip if value is empty
    if (!value) return;

    try {
      const { data } = await fetchDependentData(value);
      ctx.form.dependentField.updateComponentProps({ options: data });
    } catch (error) {
      console.error('Failed to fetch data:', error);
      // Reset to empty state on error
      ctx.form.dependentField.updateComponentProps({ options: [] });
    }
  },
  { immediate: false, debounce: 300 }
);

// ❌ WRONG - missing safeguards
watchField(path.parentField, async (value, ctx) => {
  // No guard - will call API with empty value
  // No try-catch - errors silently ignored
  // No immediate: false - may cause initialization loop
  // No debounce - excessive API calls
  const { data } = await fetchDependentData(value);
  ctx.form.dependentField.updateComponentProps({ options: data });
});

// ✅ Example: Loading car models based on selected brand
watchField(
  path.carBrand,
  async (brand, ctx) => {
    if (!brand) {
      ctx.form.carModel.updateComponentProps({ options: [], disabled: true });
      return;
    }

    try {
      ctx.form.carModel.updateComponentProps({ disabled: true }); // Show loading
      const { data: models } = await fetchCarModels(brand);
      ctx.form.carModel.updateComponentProps({
        options: models,
        disabled: false
      });
    } catch (error) {
      console.error('Failed to load car models:', error);
      ctx.form.carModel.updateComponentProps({
        options: [],
        disabled: false,
        error: 'Failed to load models'
      });
    }
  },
  { immediate: false, debounce: 300 }
);`,
    relatedPatterns: ['dynamic-options', 'watch-multiple'],
  },

  'array-cleanup': {
    name: 'Array Cleanup on Condition Change',
    description: 'Clear array items when a checkbox or condition becomes false',
    problem:
      'Without immediate: false, cleanup runs during initialization. Without null check, accessing array methods fails.',
    solution: 'Use watchField with immediate: false and null check for array',
    code: `import { watchField } from '@reformer/core/behaviors';

// ✅ CORRECT - cleanup array when checkbox unchecked
watchField(
  path.hasProperties,
  (hasProperties, ctx) => {
    if (!hasProperties && ctx.form.properties) {
      ctx.form.properties.clear();
    }
  },
  { immediate: false }
);

// ❌ WRONG - no immediate: false, no null check
watchField(path.hasProperties, (hasProperties, ctx) => {
  if (!hasProperties) ctx.form.properties.clear(); // May fail!
});

// ✅ Multiple arrays cleanup pattern
const setupArrayCleanup = (path: FieldPath<MyForm>) => {
  // Properties array
  watchField(
    path.hasProperties,
    (hasProperties, ctx) => {
      if (!hasProperties && ctx.form.properties) {
        ctx.form.properties.clear();
      }
    },
    { immediate: false }
  );

  // Existing loans array
  watchField(
    path.hasExistingLoans,
    (hasLoans, ctx) => {
      if (!hasLoans && ctx.form.existingLoans) {
        ctx.form.existingLoans.clear();
      }
    },
    { immediate: false }
  );

  // Co-borrowers array
  watchField(
    path.hasCoBorrowers,
    (hasCoBorrowers, ctx) => {
      if (!hasCoBorrowers && ctx.form.coBorrowers) {
        ctx.form.coBorrowers.clear();
      }
    },
    { immediate: false }
  );
};`,
    relatedPatterns: ['conditional-fields', 'async-watchfield'],
  },

  'dynamic-options': {
    name: 'Dynamic Options Loading',
    description: 'Load select/dropdown options based on another field value',
    problem:
      'Need to fetch options from API when parent field changes. Must handle loading states and errors.',
    solution: 'Use watchField with async callback, proper loading states, and error handling',
    code: `import { watchField } from '@reformer/core/behaviors';

// ✅ Complete pattern for dynamic options
const setupDynamicOptions = (path: FieldPath<MyForm>) => {
  // Region -> City cascade
  watchField(
    path.region,
    async (region, ctx) => {
      // Reset dependent field
      ctx.form.city.setValue('');

      if (!region) {
        ctx.form.city.updateComponentProps({
          options: [],
          disabled: true,
          placeholder: 'Select region first'
        });
        return;
      }

      try {
        // Show loading state
        ctx.form.city.updateComponentProps({
          disabled: true,
          placeholder: 'Loading cities...'
        });

        const { data: cities } = await fetchCitiesByRegion(region);

        ctx.form.city.updateComponentProps({
          options: cities.map(c => ({ value: c.id, label: c.name })),
          disabled: false,
          placeholder: 'Select city'
        });
      } catch (error) {
        console.error('Failed to load cities:', error);
        ctx.form.city.updateComponentProps({
          options: [],
          disabled: false,
          placeholder: 'Failed to load cities'
        });
      }
    },
    { immediate: false, debounce: 300 }
  );
};

// ✅ With initial value handling
watchField(
  path.country,
  async (country, ctx) => {
    if (!country) return;

    const currentCity = ctx.form.city.value.value;
    const { data: cities } = await fetchCities(country);

    ctx.form.city.updateComponentProps({ options: cities });

    // Keep current value if still valid
    if (currentCity && !cities.find(c => c.value === currentCity)) {
      ctx.form.city.setValue('');
    }
  },
  { immediate: true } // Run on init to load initial options
);`,
    relatedPatterns: ['async-watchfield', 'conditional-fields'],
  },

  'multi-step-validation': {
    name: 'Multi-Step Form with Separate Validations',
    description: 'Create multi-step form with per-step validation schemas',
    problem:
      'Using single validation schema makes it hard to validate only current step fields',
    solution: 'Create separate validation schemas per step and use STEP_VALIDATIONS map',
    code: `import type { ValidationSchemaFn } from '@reformer/core';
import { required, email, min, pattern } from '@reformer/core/validators';

// Step 1: Basic Info
const step1Validation: ValidationSchemaFn<MyForm> = (path) => {
  required(path.loanType, { message: 'Select loan type' });
  required(path.loanAmount, { message: 'Enter loan amount' });
  min(path.loanAmount, 10000, { message: 'Minimum amount is 10,000' });
};

// Step 2: Personal Data
const step2Validation: ValidationSchemaFn<MyForm> = (path) => {
  required(path.personalData.firstName);
  required(path.personalData.lastName);
  required(path.personalData.birthDate);
};

// Step 3: Contact Info
const step3Validation: ValidationSchemaFn<MyForm> = (path) => {
  required(path.email);
  email(path.email);
  required(path.phone);
  pattern(path.phone, /^\\+7\\d{10}$/, { message: 'Invalid phone format' });
};

// STEP_VALIDATIONS map for useStepForm hook
export const STEP_VALIDATIONS: Record<number, ValidationSchemaFn<MyForm>> = {
  1: step1Validation,
  2: step2Validation,
  3: step3Validation,
};

// Full validation (combines all steps)
export const fullValidation: ValidationSchemaFn<MyForm> = (path) => {
  step1Validation(path);
  step2Validation(path);
  step3Validation(path);
};

// Usage with useStepForm hook
const {
  currentStep,
  nextStep,
  prevStep,
  validateCurrentStep,
  isFirstStep,
  isLastStep
} = useStepForm(form, {
  stepSchemas: STEP_VALIDATIONS,
  totalSteps: Object.keys(STEP_VALIDATIONS).length,
});

// Navigate with validation
const handleNext = async () => {
  const isValid = await validateCurrentStep();
  if (isValid) {
    nextStep();
  }
};`,
    relatedPatterns: ['multi-step', 'conditional-validation'],
  },

  'nested-form-composition': {
    name: 'Nested Form Composition',
    description: 'Compose reusable sub-forms into a larger form',
    problem:
      'Using apply() in behavior schema may cause "Cycle detected" error. Validation composition works but behavior composition is limited.',
    solution: 'Inline behaviors for nested forms, use apply() only for validation',
    code: `import type { ValidationSchemaFn, BehaviorSchemaFn } from '@reformer/core';
import { required, email } from '@reformer/core/validators';
import { watchField, enableWhen } from '@reformer/core/behaviors';

// ===== Reusable Address Sub-Form =====

// Address validation (can be composed)
export const addressValidation: ValidationSchemaFn<Address> = (path) => {
  required(path.region);
  required(path.city);
  required(path.street);
};

// Address behavior (inline, do not use apply())
export const setupAddressBehavior = (
  path: FieldPath<Address>,
  ctx: BehaviorContext
) => {
  // Dynamic city loading
  watchField(
    path.region,
    async (region, ctx) => {
      if (!region) return;
      const cities = await fetchCities(region);
      ctx.form.city.updateComponentProps({ options: cities });
    },
    { immediate: false, debounce: 300 }
  );
};

// ===== Main Form Composition =====

interface MainForm {
  personalData: PersonalData;
  registrationAddress: Address;
  residenceAddress: Address;
  sameAsRegistration: boolean;
}

// Validation - use apply() for composition
const mainValidation: ValidationSchemaFn<MainForm> = (path) => {
  // Apply address validation to both address fields
  apply(addressValidation, path.registrationAddress);

  applyWhen(
    path.sameAsRegistration,
    (same) => !same,
    (p) => apply(addressValidation, p.residenceAddress)
  );
};

// Behavior - inline nested behaviors (no apply!)
const mainBehavior: BehaviorSchemaFn<MainForm> = (path) => {
  // Setup address behaviors inline
  setupAddressBehavior(path.registrationAddress, ctx);

  enableWhen(
    path.residenceAddress,
    (form) => !form.sameAsRegistration,
    { resetOnDisable: true }
  );

  // Only setup residence behavior when enabled
  watchField(path.sameAsRegistration, (same, ctx) => {
    if (!same) {
      setupAddressBehavior(path.residenceAddress, ctx);
    }
  }, { immediate: false });
};`,
    relatedPatterns: ['nested-forms', 'conditional-fields'],
  },

  'project-structure': {
    name: 'Recommended Project Structure',
    description: 'Organize forms using colocation pattern for scalability and maintainability',
    problem:
      'Forms become hard to maintain when files are scattered across folders by type (all types in /types, all validators in /validators, etc.)',
    solution: 'Use colocation - keep related files together in form-specific folders',
    code: `// ===== RECOMMENDED STRUCTURE (COLOCATION) =====

src/
├── components/
│   └── ui/                              # Reusable UI components
│       ├── FormField.tsx                # Field wrapper
│       ├── FormArrayManager.tsx         # Dynamic arrays manager
│       └── ...                          # Input, Select, Checkbox, etc.
│
├── forms/
│   └── [form-name]/                     # Form module
│       ├── type.ts                      # Main form type (combines step types)
│       ├── schema.ts                    # Main schema (combines step schemas)
│       ├── validators.ts                # Validators (steps + cross-step)
│       ├── behaviors.ts                 # Behaviors (steps + cross-step)
│       ├── [FormName]Form.tsx           # Main form component
│       │
│       ├── steps/                       # Step modules (wizard)
│       │   ├── loan-info/
│       │   │   ├── type.ts              # Step types
│       │   │   ├── schema.ts            # Step schema
│       │   │   ├── validators.ts        # Step validators
│       │   │   ├── behaviors.ts         # Step behaviors
│       │   │   └── LoanInfoForm.tsx     # Step component
│       │   │
│       │   ├── personal-info/
│       │   │   ├── type.ts
│       │   │   ├── schema.ts
│       │   │   ├── validators.ts
│       │   │   ├── behaviors.ts
│       │   │   └── PersonalInfoForm.tsx
│       │   │
│       │   └── confirmation/
│       │       ├── type.ts
│       │       ├── schema.ts
│       │       ├── validators.ts
│       │       └── ConfirmationForm.tsx
│       │
│       ├── sub-forms/                   # Reusable sub-form modules
│       │   ├── address/
│       │   │   ├── type.ts
│       │   │   ├── schema.ts
│       │   │   ├── validators.ts
│       │   │   └── AddressForm.tsx
│       │   │
│       │   └── personal-data/
│       │       ├── type.ts
│       │       ├── schema.ts
│       │       ├── validators.ts
│       │       └── PersonalDataForm.tsx
│       │
│       ├── services/                    # API services
│       │   └── api.ts
│       │
│       └── utils/                       # Form utilities
│           └── formTransformers.ts
│
└── lib/                                 # Shared utilities

// ===== KEY FILES =====

// forms/credit-application/type.ts
export type { LoanInfoStep } from './steps/loan-info/type';
export type { PersonalInfoStep } from './steps/personal-info/type';
export type { Address } from './sub-forms/address/type';

export interface CreditApplicationForm {
  // Step 1: Loan Info
  loanType: LoanType;
  loanAmount: number;
  loanTerm: number;
  // ... other step fields
}

// forms/credit-application/schema.ts
import { loanInfoSchema } from './steps/loan-info/schema';
import { personalInfoSchema } from './steps/personal-info/schema';

export const creditApplicationSchema = {
  ...loanInfoSchema,
  ...personalInfoSchema,
  // Root-level computed fields
  monthlyPayment: { value: 0, disabled: true },
};

// forms/credit-application/validators.ts
import { loanValidation } from './steps/loan-info/validators';
import { personalValidation } from './steps/personal-info/validators';

// Cross-step validation
const crossStepValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  validate(path.initialPayment, (value, ctx) => {
    if (ctx.form.loanType.value.value !== 'mortgage') return null;
    const propertyValue = ctx.form.propertyValue.value.value;
    if (!propertyValue || !value) return null;
    const minPayment = propertyValue * 0.2;
    if (value < minPayment) {
      return { code: 'minInitialPayment', message: \`Minimum: \${minPayment}\` };
    }
    return null;
  });
};

// Combine all validators
export const creditApplicationValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  loanValidation(path);
  personalValidation(path);
  crossStepValidation(path);
};

// forms/credit-application/CreditApplicationForm.tsx
import { useMemo } from 'react';
import { createForm } from '@reformer/core';
import { creditApplicationSchema } from './schema';
import { creditApplicationBehaviors } from './behaviors';
import { creditApplicationValidation } from './validators';
import type { CreditApplicationForm as CreditApplicationFormType } from './type';

function CreditApplicationForm() {
  // Create form instance with useMemo for stable reference
  const form = useMemo(
    () =>
      createForm<CreditApplicationFormType>({
        form: creditApplicationSchema,
        behavior: creditApplicationBehaviors,
        validation: creditApplicationValidation,
      }),
    []
  );

  return (
    // ... render form steps
  );
}

// ===== SCALING: SIMPLE TO COMPLEX =====

// Simple form (single file)
forms/
└── contact/
    └── ContactForm.tsx     # Schema, validation, behaviors, component

// Medium form (separate files)
forms/
└── registration/
    ├── type.ts
    ├── schema.ts
    ├── validators.ts
    ├── behaviors.ts
    └── RegistrationForm.tsx

// Complex multi-step form (full colocation)
forms/
└── credit-application/
    ├── type.ts
    ├── schema.ts
    ├── validators.ts
    ├── behaviors.ts
    ├── CreditApplicationForm.tsx
    ├── steps/
    │   ├── loan-info/
    │   ├── personal-info/
    │   ├── contact-info/
    │   ├── employment/
    │   ├── additional-info/
    │   └── confirmation/
    ├── sub-forms/
    │   ├── address/
    │   ├── personal-data/
    │   ├── passport-data/
    │   ├── property/
    │   ├── existing-loan/
    │   └── co-borrower/
    ├── services/
    │   └── api.ts
    └── utils/
        └── formTransformers.ts`,
    relatedPatterns: ['multi-step', 'nested-form-composition', 'multi-step-validation'],
  },

  'form-schema': {
    name: 'Correct FormSchema Format',
    description: 'Define form schema with required value and component properties',
    problem:
      'Using simple values like { name: "" } causes TypeScript errors. FormSchema requires FieldConfig structure with value and component.',
    solution: 'Every field must have { value, component, componentProps? }',
    code: `import { Input, Select, Checkbox } from '@/components/ui';
import type { FormSchema } from '@reformer/core';

// ❌ WRONG - This will NOT compile
const wrongSchema = {
  name: '',           // Missing { value, component }
  email: '',          // Missing { value, component }
};

// ✅ CORRECT - Every field needs value and component
const schema: FormSchema<MyForm> = {
  // String field
  name: {
    value: '',                    // Initial value (REQUIRED)
    component: Input,             // React component (REQUIRED)
    componentProps: {
      label: 'Name',
      placeholder: 'Enter name',
    },
  },

  // Number field (use undefined for optional)
  age: {
    value: undefined,             // Use undefined, NOT null
    component: Input,
    componentProps: { type: 'number', label: 'Age' },
  },

  // Boolean field
  agree: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'I agree to terms' },
  },

  // Enum/Select field
  status: {
    value: 'active',
    component: Select,
    componentProps: {
      label: 'Status',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
      ],
    },
  },

  // Nested object
  address: {
    street: { value: '', component: Input, componentProps: { label: 'Street' } },
    city: { value: '', component: Input, componentProps: { label: 'City' } },
  },

  // Array (tuple format with one template item)
  items: [{
    id: { value: '', component: Input },
    name: { value: '', component: Input },
  }],
};`,
    relatedPatterns: ['form-types', 'nested-forms'],
  },

  'array-validation': {
    name: 'Array Field Validation',
    description: 'Validate array fields using notEmpty and validateItems',
    problem:
      'Array fields need special validation: checking if array is not empty and validating each item',
    solution: 'Use notEmpty() for required arrays, validateItems() for item validation',
    code: `import { notEmpty, validateItems, required, email, applyWhen } from '@reformer/core/validators';
import type { ValidationSchemaFn } from '@reformer/core';

interface MyForm {
  hasContacts: boolean;
  contacts: Array<{
    name: string;
    email: string;
    phone?: string;
  }>;
}

const validation: ValidationSchemaFn<MyForm> = (path) => {
  // Conditional: validate array only when checkbox is checked
  applyWhen(
    path.hasContacts,
    (hasContacts) => hasContacts === true,
    (p) => {
      // Array must have at least one item
      notEmpty(p.contacts, { message: 'Add at least one contact' });

      // Validate each item in array
      validateItems(p.contacts, (itemPath) => {
        required(itemPath.name, { message: 'Contact name is required' });
        email(itemPath.email, { message: 'Invalid email format' });
      });
    }
  );
};

// ===== Array Operations =====

// Add new item
form.contacts.push({
  name: { value: '', component: Input },
  email: { value: '', component: Input },
  phone: { value: '', component: Input },
});

// Remove item at index
form.contacts.removeAt(index);

// Clear all items
form.contacts.clear();

// Get array length
const count = form.contacts.length;

// Render items (use item.id as key, not index!)
{form.contacts.map((item, index) => (
  <ContactItem
    key={item.id}  // ✅ Use item.id, NOT index
    control={item}
    onRemove={() => form.contacts.removeAt(index)}
  />
))}`,
    relatedPatterns: ['array-cleanup', 'conditional-validation', 'form-schema'],
  },
};

// Pattern aliases for flexible matching
const patternAliases: Record<string, string> = {
  'computed-from-nested': 'computed-nested',
  'cross-level-computed': 'computed-nested',
  'nested-computed': 'computed-nested',
  'conditional-field': 'conditional-fields',
  'show-hide': 'conditional-fields',
  'enable-disable': 'conditional-fields',
  'cross-field': 'cross-validation',
  'password-confirm': 'cross-validation',
  'date-range': 'cross-validation',
  'type-assertion': 'type-safe-control',
  'useformcontrol-types': 'type-safe-control',
  types: 'form-types',
  'null-undefined': 'form-types',
  'index-signature': 'form-types',
  wizard: 'multi-step',
  steps: 'multi-step',
  // New aliases for added patterns
  'async-watch': 'async-watchfield',
  'watchfield-async': 'async-watchfield',
  'fetch-in-watchfield': 'async-watchfield',
  'api-call-watchfield': 'async-watchfield',
  'array-clear': 'array-cleanup',
  'clear-array': 'array-cleanup',
  'checkbox-array': 'array-cleanup',
  'dynamic-select': 'dynamic-options',
  'cascade-select': 'dynamic-options',
  'dependent-options': 'dynamic-options',
  'load-options': 'dynamic-options',
  'step-validation': 'multi-step-validation',
  'per-step-validation': 'multi-step-validation',
  'step-schemas': 'multi-step-validation',
  'compose-forms': 'nested-form-composition',
  'sub-form': 'nested-form-composition',
  'reusable-form': 'nested-form-composition',
  'cycle-detected': 'nested-form-composition',
  // FormSchema aliases
  schema: 'form-schema',
  'field-config': 'form-schema',
  'formschema-format': 'form-schema',
  'schema-format': 'form-schema',
  'value-component': 'form-schema',
  // Array validation aliases
  'validate-array': 'array-validation',
  'notempty': 'array-validation',
  'validateitems': 'array-validation',
  'array-items': 'array-validation',
  // Project structure aliases
  structure: 'project-structure',
  'folder-structure': 'project-structure',
  'file-structure': 'project-structure',
  colocation: 'project-structure',
  organization: 'project-structure',
  'form-organization': 'project-structure',
  'form-structure': 'project-structure',
  architecture: 'project-structure',
  'best-practices': 'project-structure',
};

export async function getPatternTool(args: {
  pattern: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const { pattern } = args;
  const normalized = pattern.toLowerCase().trim().replace(/\s+/g, '-');

  // Check direct match or alias
  const patternKey = patterns[normalized] ? normalized : patternAliases[normalized];
  const foundPattern = patternKey ? patterns[patternKey] : null;

  if (!foundPattern) {
    // Try fuzzy search
    const matches = Object.keys(patterns).filter(
      (key) =>
        key.includes(normalized) ||
        patterns[key].name.toLowerCase().includes(pattern.toLowerCase()) ||
        patterns[key].description.toLowerCase().includes(pattern.toLowerCase())
    );

    if (matches.length > 0) {
      let response = `Pattern "${pattern}" not found exactly. Did you mean:\n\n`;
      for (const match of matches) {
        response += `- **${patterns[match].name}** (\`${match}\`)\n`;
        response += `  ${patterns[match].description}\n\n`;
      }
      return { content: [{ type: 'text', text: response }] };
    }

    const available = Object.keys(patterns)
      .map((k) => `\`${k}\``)
      .join(', ');
    return {
      content: [
        {
          type: 'text',
          text: `Pattern "${pattern}" not found.\n\nAvailable patterns: ${available}`,
        },
      ],
    };
  }

  let response = `## ${foundPattern.name}\n\n`;
  response += `${foundPattern.description}\n\n`;

  if (foundPattern.problem) {
    response += `### ⚠️ Problem\n\n${foundPattern.problem}\n\n`;
  }

  response += `### Solution\n\n${foundPattern.solution}\n\n`;

  response += `### Code\n\n\`\`\`typescript\n${foundPattern.code}\n\`\`\`\n\n`;

  if (foundPattern.relatedPatterns && foundPattern.relatedPatterns.length > 0) {
    response += `### Related Patterns\n\n`;
    for (const related of foundPattern.relatedPatterns) {
      if (patterns[related]) {
        response += `- **${patterns[related].name}** (\`${related}\`)\n`;
      }
    }
  }

  return {
    content: [{ type: 'text', text: response }],
  };
}
