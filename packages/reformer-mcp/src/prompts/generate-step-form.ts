import { getSection, getFullDocs } from '../utils/docs-parser.js';

export const generateStepFormPromptDefinition = {
  name: 'generate-step-form',
  description:
    'Generate a multi-step wizard form with per-step validation schemas, STEP_VALIDATIONS map, and step navigation.',
  arguments: [
    {
      name: 'description',
      description:
        'Description of the multi-step form (e.g., "3-step checkout: shipping info, payment details, confirmation")',
      required: true,
    },
    {
      name: 'steps',
      description:
        'Number of steps or comma-separated list of step names (e.g., "4" or "Basic Info, Personal Data, Contact, Confirmation")',
      required: false,
    },
  ],
};

export function getGenerateStepFormPrompt(args: {
  description: string;
  steps?: string;
}): {
  messages: Array<{ role: 'user'; content: { type: 'text'; text: string } }>;
} {
  const { description, steps } = args;

  const validationSection = getSection('Validation');
  const quickStart = getSection('Quick Start');

  return {
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `You are an expert on ReFormer form library. Generate a complete multi-step form implementation.

## ReFormer Documentation

### Validation
${validationSection}

### Quick Start
${quickStart}

## Multi-Step Form Pattern

### Step-Specific Validation Schemas

\`\`\`typescript
import type { ValidationSchemaFn } from '@reformer/core';
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
\`\`\`

### STEP_VALIDATIONS Map

\`\`\`typescript
// STEP_VALIDATIONS map for useStepForm hook
export const STEP_VALIDATIONS: Record<number, ValidationSchemaFn<MyForm>> = {
  1: step1Validation,
  2: step2Validation,
  3: step3Validation,
};

// Full validation (combines all steps) - used for final submission
export const fullValidation: ValidationSchemaFn<MyForm> = (path) => {
  step1Validation(path);
  step2Validation(path);
  step3Validation(path);
};
\`\`\`

### useStepForm Hook Usage

\`\`\`typescript
const {
  currentStep,
  nextStep,
  prevStep,
  validateCurrentStep,
  isFirstStep,
  isLastStep,
  goToStep
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
};

const handleSubmit = async () => {
  // Validate ALL steps before submit
  await form.validate();
  if (form.valid.value) {
    // Submit form
  }
};
\`\`\`

### Step Component Pattern

\`\`\`typescript
interface StepProps {
  control: GroupNodeWithControls<MyForm>;
}

function Step1BasicInfo({ control }: StepProps) {
  return (
    <div>
      <FormField control={control.loanType} />
      <FormField control={control.loanAmount} />
    </div>
  );
}
\`\`\`

---

## Task

Create a multi-step ReFormer form for: "${description}"
${steps ? `\nSteps: ${steps}` : ''}

Generate the following files:

1. **types.ts** - TypeScript interface for form data
2. **validation.ts** - Per-step validation schemas + STEP_VALIDATIONS map + fullValidation
3. **schema.ts** - Form schema with createForm
4. **steps/Step1.tsx, Step2.tsx, etc.** - Individual step components
5. **MultiStepForm.tsx** - Main form component with navigation

Requirements:
- Each step should have its OWN validation schema file/export
- STEP_VALIDATIONS must map step numbers to validation functions
- Use useStepForm hook for step management
- Include Next/Prev navigation buttons with validation
- Final step should show confirmation and submit button
- Handle loading and error states

Provide complete, working code that follows ReFormer best practices.`,
        },
      },
    ],
  };
}
