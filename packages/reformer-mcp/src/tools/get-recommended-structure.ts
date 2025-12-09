export const getRecommendedStructureToolDefinition = {
  name: 'get_recommended_structure',
  description:
    'Get recommended project structure for ReFormer forms based on complexity level. Returns folder structure, file templates, and best practices.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      complexity: {
        type: 'string',
        enum: ['simple', 'medium', 'complex'],
        description:
          'Form complexity: simple (single file), medium (separate files), complex (full colocation with steps/sub-forms)',
      },
    },
    required: ['complexity'],
  },
};

interface StructureTemplate {
  description: string;
  structure: string;
  files: Array<{
    name: string;
    template: string;
  }>;
  tips: string[];
}

const structures: Record<string, StructureTemplate> = {
  simple: {
    description: 'Single file form - all code in one component file',
    structure: `forms/
└── contact/
    └── ContactForm.tsx     # Schema, validation, behaviors, component`,
    files: [
      {
        name: 'ContactForm.tsx',
        template: `import { useMemo } from 'react';
import { createForm, useFormControl } from '@reformer/core';
import type { FormSchema, ValidationSchemaFn, FieldNode } from '@reformer/core';
import { required, email } from '@reformer/core/validators';
import { Input } from '@/components/ui/input';

// ============ Type ============
interface ContactForm {
  name: string;
  email: string;
  message: string;
}

// ============ Schema ============
const contactSchema: FormSchema<ContactForm> = {
  name: {
    value: '',
    component: Input,
    componentProps: { label: 'Name', placeholder: 'Your name' },
  },
  email: {
    value: '',
    component: Input,
    componentProps: { label: 'Email', type: 'email', placeholder: 'your@email.com' },
  },
  message: {
    value: '',
    component: Input,
    componentProps: { label: 'Message', placeholder: 'Your message' },
  },
};

// ============ Validation ============
const contactValidation: ValidationSchemaFn<ContactForm> = (path) => {
  required(path.name, { message: 'Name is required' });
  required(path.email, { message: 'Email is required' });
  email(path.email, { message: 'Invalid email format' });
  required(path.message, { message: 'Message is required' });
};

// ============ Component ============
export function ContactForm() {
  const form = useMemo(
    () => createForm<ContactForm>({
      form: contactSchema,
      validation: contactValidation,
    }),
    []
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await form.validate();
    if (form.valid.value) {
      console.log('Form data:', form.value.value);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <FormField control={form.name} />
      <FormField control={form.email} />
      <FormField control={form.message} />
      <button type="submit">Send</button>
    </form>
  );
}`,
      },
    ],
    tips: [
      'Use for forms with 3-5 fields',
      'Good for prototyping and quick forms',
      'Extract to medium structure when form grows',
    ],
  },

  medium: {
    description: 'Separate files for type, schema, validation, behaviors',
    structure: `forms/
└── registration/
    ├── type.ts              # TypeScript interface
    ├── schema.ts            # FormSchema
    ├── validators.ts        # ValidationSchemaFn
    ├── behaviors.ts         # BehaviorSchemaFn (optional)
    └── RegistrationForm.tsx # React component`,
    files: [
      {
        name: 'type.ts',
        template: `export interface RegistrationForm {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
}`,
      },
      {
        name: 'schema.ts',
        template: `import type { FormSchema } from '@reformer/core';
import { Input } from '@/components/ui/input';
import { InputPassword } from '@/components/ui/input-password';
import { Checkbox } from '@/components/ui/checkbox';
import type { RegistrationForm } from './type';

export const registrationSchema: FormSchema<RegistrationForm> = {
  username: {
    value: '',
    component: Input,
    componentProps: { label: 'Username', placeholder: 'Enter username' },
  },
  email: {
    value: '',
    component: Input,
    componentProps: { label: 'Email', type: 'email', placeholder: 'your@email.com' },
  },
  password: {
    value: '',
    component: InputPassword,
    componentProps: { label: 'Password', placeholder: 'Enter password' },
  },
  confirmPassword: {
    value: '',
    component: InputPassword,
    componentProps: { label: 'Confirm Password', placeholder: 'Repeat password' },
  },
  acceptTerms: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'I accept the terms and conditions' },
  },
};`,
      },
      {
        name: 'validators.ts',
        template: `import type { ValidationSchemaFn } from '@reformer/core';
import { required, email, minLength, validate } from '@reformer/core/validators';
import type { RegistrationForm } from './type';

export const registrationValidation: ValidationSchemaFn<RegistrationForm> = (path) => {
  // Username
  required(path.username, { message: 'Username is required' });
  minLength(path.username, 3, { message: 'Minimum 3 characters' });

  // Email
  required(path.email, { message: 'Email is required' });
  email(path.email, { message: 'Invalid email format' });

  // Password
  required(path.password, { message: 'Password is required' });
  minLength(path.password, 8, { message: 'Minimum 8 characters' });

  // Confirm password - cross-field validation
  required(path.confirmPassword, { message: 'Please confirm password' });
  validate(path.confirmPassword, (value, ctx) => {
    if (value !== ctx.form.password.value.value) {
      return { code: 'mismatch', message: 'Passwords do not match' };
    }
    return null;
  });

  // Terms
  validate(path.acceptTerms, (value) => {
    if (!value) {
      return { code: 'required', message: 'You must accept the terms' };
    }
    return null;
  });
};`,
      },
      {
        name: 'behaviors.ts',
        template: `import type { BehaviorSchemaFn } from '@reformer/core';
import { watchField } from '@reformer/core/behaviors';
import type { RegistrationForm } from './type';

export const registrationBehavior: BehaviorSchemaFn<RegistrationForm> = (path) => {
  // Clear confirmPassword when password changes
  watchField(path.password, (_, ctx) => {
    const confirmValue = ctx.form.confirmPassword.value.value;
    if (confirmValue) {
      ctx.form.confirmPassword.setValue('', { emitEvent: false });
    }
  });
};`,
      },
      {
        name: 'RegistrationForm.tsx',
        template: `import { useMemo } from 'react';
import { createForm } from '@reformer/core';
import { registrationSchema } from './schema';
import { registrationValidation } from './validators';
import { registrationBehavior } from './behaviors';
import type { RegistrationForm as RegistrationFormType } from './type';
import { FormField } from '@/components/ui/FormField';

export function RegistrationForm() {
  const form = useMemo(
    () => createForm<RegistrationFormType>({
      form: registrationSchema,
      validation: registrationValidation,
      behavior: registrationBehavior,
    }),
    []
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await form.validate();
    if (form.valid.value) {
      console.log('Registration data:', form.value.value);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <FormField control={form.username} />
      <FormField control={form.email} />
      <FormField control={form.password} />
      <FormField control={form.confirmPassword} />
      <FormField control={form.acceptTerms} />
      <button type="submit" disabled={!form.valid.value}>
        Register
      </button>
    </form>
  );
}`,
      },
    ],
    tips: [
      'Use for forms with 5-15 fields',
      'Good separation of concerns',
      'Easy to test validation and behaviors separately',
      'Scale to complex when adding steps or sub-forms',
    ],
  },

  complex: {
    description: 'Full colocation with steps, sub-forms, and utilities',
    structure: `forms/
└── credit-application/
    ├── type.ts                    # Main form type (combines step types)
    ├── schema.ts                  # Main schema (combines step schemas)
    ├── validators.ts              # Validators (steps + cross-step)
    ├── behaviors.ts               # Behaviors (steps + cross-step)
    ├── CreditApplicationForm.tsx  # Main form component
    │
    ├── steps/                     # Step modules (wizard)
    │   ├── loan-info/
    │   │   ├── type.ts            # Step-specific types
    │   │   ├── schema.ts          # Step schema
    │   │   ├── validators.ts      # Step validators
    │   │   ├── behaviors.ts       # Step behaviors
    │   │   └── LoanInfoForm.tsx   # Step component
    │   │
    │   ├── personal-info/
    │   │   ├── type.ts
    │   │   ├── schema.ts
    │   │   ├── validators.ts
    │   │   └── PersonalInfoForm.tsx
    │   │
    │   └── confirmation/
    │       ├── type.ts
    │       ├── schema.ts
    │       ├── validators.ts
    │       └── ConfirmationForm.tsx
    │
    ├── sub-forms/                 # Reusable sub-form modules
    │   ├── address/
    │   │   ├── type.ts
    │   │   ├── schema.ts
    │   │   ├── validators.ts
    │   │   └── AddressForm.tsx
    │   │
    │   └── personal-data/
    │       ├── type.ts
    │       ├── schema.ts
    │       ├── validators.ts
    │       └── PersonalDataForm.tsx
    │
    ├── services/                  # API services
    │   └── api.ts
    │
    └── utils/                     # Form utilities
        ├── compute/               # Computed field functions
        │   └── compute-total.ts
        └── validators/            # Custom validators
            └── validate-age.ts`,
    files: [
      {
        name: 'type.ts (root)',
        template: `// Re-export types from steps and sub-forms
export type { LoanInfoStep } from './steps/loan-info/type';
export type { PersonalInfoStep } from './steps/personal-info/type';
export type { Address } from './sub-forms/address/type';
export type { PersonalData } from './sub-forms/personal-data/type';

// Enums
export type LoanType = 'consumer' | 'mortgage' | 'car';
export type EmploymentStatus = 'employed' | 'selfEmployed' | 'unemployed';

// Main form interface
export interface CreditApplicationForm {
  // Step 1: Loan Info
  loanType: LoanType;
  loanAmount: number;
  loanTerm: number;

  // Step 2: Personal Info
  personalData: PersonalData;
  address: Address;

  // Step 3: Confirmation
  agreeTerms: boolean;
  agreePrivacy: boolean;

  // Computed fields
  monthlyPayment: number;
  interestRate: number;
}`,
      },
      {
        name: 'validators.ts (root)',
        template: `import type { ValidationSchemaFn } from '@reformer/core';
import { validate } from '@reformer/core/validators';
import type { CreditApplicationForm } from './type';

// Import step validators
import { loanInfoValidation } from './steps/loan-info/validators';
import { personalInfoValidation } from './steps/personal-info/validators';
import { confirmationValidation } from './steps/confirmation/validators';

// Cross-step validation
const crossStepValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // Example: Validate loan amount based on income
  validate(path.loanAmount, (value, ctx) => {
    // Cross-step logic here
    return null;
  });
};

// Combine all validators
export const creditApplicationValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  loanInfoValidation(path);
  personalInfoValidation(path);
  confirmationValidation(path);
  crossStepValidation(path);
};`,
      },
      {
        name: 'steps/loan-info/type.ts',
        template: `import type { LoanType } from '../../type';

export interface LoanInfoStep {
  loanType: LoanType;
  loanAmount: number;
  loanTerm: number;
  loanPurpose?: string;
}`,
      },
      {
        name: 'sub-forms/address/type.ts',
        template: `export interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}`,
      },
    ],
    tips: [
      'Use for wizard/multi-step forms',
      'Enables parallel work by different team members',
      'Each step can be validated independently',
      'Sub-forms are reusable across different forms',
      'Use useMemo for stable form instance',
      'Cross-step validation in root validators.ts',
    ],
  },
};

export async function getRecommendedStructureTool(args: {
  complexity: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const { complexity } = args;
  const template = structures[complexity];

  if (!template) {
    const available = Object.keys(structures).join(', ');
    return {
      content: [
        {
          type: 'text',
          text: `Unknown complexity level: "${complexity}"\n\nAvailable levels: ${available}`,
        },
      ],
    };
  }

  let response = `# Recommended Structure: ${complexity.toUpperCase()}\n\n`;
  response += `${template.description}\n\n`;

  response += `## Folder Structure\n\n\`\`\`\n${template.structure}\n\`\`\`\n\n`;

  response += `## File Templates\n\n`;
  for (const file of template.files) {
    response += `### ${file.name}\n\n`;
    response += `\`\`\`typescript\n${file.template}\n\`\`\`\n\n`;
  }

  response += `## Tips\n\n`;
  for (const tip of template.tips) {
    response += `- ${tip}\n`;
  }

  response += `\n## Key Principles\n\n`;
  response += `1. **Colocation** - Keep related files together (type, schema, validators, behaviors)\n`;
  response += `2. **Root Aggregators** - Root-level files combine all step modules\n`;
  response += `3. **Type Safety** - Always define TypeScript interfaces first\n`;
  response += `4. **Imports** - Types from \`@reformer/core\`, validators from \`/validators\`, behaviors from \`/behaviors\`\n`;

  return {
    content: [{ type: 'text', text: response }],
  };
}
