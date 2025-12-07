import { getSection, getExamples } from '../utils/docs-parser.js';

export const createFormPromptDefinition = {
  name: 'create-form',
  description:
    'Generate a ReFormer form schema based on a description. Creates type definitions, form schema, validation, and behaviors.',
  arguments: [
    {
      name: 'description',
      description:
        'Description of the form to create (e.g., "user registration form with email, password, and confirm password")',
      required: true,
    },
  ],
};

export function getCreateFormPrompt(args: { description: string }): {
  messages: Array<{ role: 'user'; content: { type: 'text'; text: string } }>;
} {
  const { description } = args;

  const formSchemaSection = getSection('Form Schema');
  const validationSection = getSection('Validation');
  const quickStart = getSection('Quick Start');
  const examples = getExamples('form');

  return {
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `You are an expert on ReFormer form library. Generate a complete form implementation based on the description.

## ReFormer Documentation

### Form Schema
${formSchemaSection}

### Validation
${validationSection}

### Quick Start
${quickStart}

### Examples
${examples}

### Project Structure

Follow this structure based on form complexity:

#### Simple Form (1-5 fields, no conditional logic)
\`\`\`
forms/
└── contact/
    └── ContactForm.tsx     # Schema, validation, behaviors, component in one file
\`\`\`

#### Medium Form (6-15 fields, some conditional logic)
\`\`\`
forms/
└── registration/
    ├── type.ts             # TypeScript interface
    ├── schema.ts           # Form schema with field config
    ├── validators.ts       # Validation rules
    ├── behaviors.ts        # Computed fields, conditional logic
    └── RegistrationForm.tsx
\`\`\`

#### Complex Multi-Step Form (multiple steps, sub-forms)
\`\`\`
forms/
└── credit-application/
    ├── type.ts             # Main type (combines step types)
    ├── schema.ts           # Main schema (combines step schemas)
    ├── validators.ts       # Validators (steps + cross-step)
    ├── behaviors.ts        # Behaviors (steps + cross-step)
    ├── CreditApplicationForm.tsx
    ├── steps/
    │   └── [step-name]/
    │       ├── type.ts
    │       ├── schema.ts
    │       ├── validators.ts
    │       ├── behaviors.ts
    │       └── StepForm.tsx
    └── sub-forms/
        └── [subform-name]/
            ├── type.ts
            ├── schema.ts
            └── SubForm.tsx
\`\`\`

### Key Files Description

| File | Purpose |
|------|---------|
| \`type.ts\` | TypeScript interface for form data |
| \`schema.ts\` | Form schema with field configuration (value, component, componentProps) |
| \`validators.ts\` | Validation rules using ValidationSchemaFn |
| \`behaviors.ts\` | Computed fields, enableWhen, disableWhen using BehaviorSchemaFn |
| \`*Form.tsx\` | React component with useFormControl hooks |

---

## Task

Create a ReFormer form for: "${description}"

**Determine form complexity and generate appropriate structure:**

**For simple forms** (1-5 fields, no conditional logic):
- Single file with type, schema, validation, and component

**For medium forms** (6-15 fields, some conditional logic):
- Separate files: type.ts, schema.ts, validators.ts, behaviors.ts, Form.tsx

**For complex multi-step forms**:
- Full colocation structure with steps/ and sub-forms/
- Step-specific validators using ValidationSchemaFn
- Root aggregators that combine step schemas/validators

Generate the following for each file:

1. **type.ts** — TypeScript interface for the form data
2. **schema.ts** — Form schema using field configuration
3. **validators.ts** — Validation rules using ValidationSchemaFn
4. **behaviors.ts** — Computed fields and conditional logic (if needed)
5. **Form.tsx** — React component with createForm and useFormControl

Follow these guidelines:
- Use proper TypeScript types
- Include appropriate validators (required, email, minLength, etc.)
- Use \`useFormControl\` hook for field subscriptions
- Use \`useMemo\` for createForm inside components for stable reference
- Handle form submission with validation check
- Include error display logic with \`shouldShowError\`
- For multi-step forms, use \`validateForm(form, stepValidation)\` for step validation

Provide complete, working code that follows ReFormer best practices.`,
        },
      },
    ],
  };
}
