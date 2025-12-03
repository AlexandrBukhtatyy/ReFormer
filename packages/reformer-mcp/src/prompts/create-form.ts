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

---

## Task

Create a ReFormer form for: "${description}"

Generate the following:

1. **TypeScript type definition** for the form data
2. **Form schema** using \`createForm<T>()\`
3. **Validation rules** using the validation schema
4. **React component** with proper hooks usage

Follow these guidelines:
- Use proper TypeScript types
- Include appropriate validators (required, email, minLength, etc.)
- Use \`useFormControl\` hook for field subscriptions
- Handle form submission with validation check
- Include error display logic with \`shouldShowError\`

Provide complete, working code that follows ReFormer best practices.`,
        },
      },
    ],
  };
}
