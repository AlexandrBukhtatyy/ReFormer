import { getSection, getExamples } from '../utils/docs-parser.js';

export const manageValidationPromptDefinition = {
  name: 'manage-validation',
  description:
    'Add, modify, or remove validation rules in a ReFormer form. Helps with sync/async validators, cross-field validation, and custom validators.',
  arguments: [
    {
      name: 'task',
      description:
        'Description of the validation task (e.g., "add email validation to the email field", "create custom password strength validator", "remove required from optional field")',
      required: true,
    },
  ],
};

export function getManageValidationPrompt(args: { task: string }): {
  messages: Array<{ role: 'user'; content: { type: 'text'; text: string } }>;
} {
  const { task } = args;

  const validationSection = getSection('Validation');
  const validationExamples = getExamples('validation');

  return {
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `You are an expert on ReFormer validation. Help with the following validation task.

## ReFormer Validation Documentation

${validationSection}

### Validation Examples
${validationExamples}

---

## Available Validators

### Built-in Validators (from 'reformer/validators')
- \`required(path)\` - Non-empty value
- \`email(path)\` - Valid email format
- \`minLength(path, n)\` - Minimum string length
- \`maxLength(path, n)\` - Maximum string length
- \`min(path, n)\` - Minimum number value
- \`max(path, n)\` - Maximum number value
- \`pattern(path, regex)\` - Match regex
- \`url(path)\` - Valid URL
- \`phone(path)\` - Valid phone number
- \`number(path)\` - Must be a number
- \`date(path)\` - Valid date

### Custom Validators
- \`validate(path, fn)\` - Custom sync validator
- \`validateAsync(path, fn, options?)\` - Custom async validator
- \`validateTree(fn)\` - Cross-field validation

---

## Task

${task}

Provide:
1. The validation code to add/modify/remove
2. Explanation of what the validation does
3. Where to place the code in the validation schema
4. Any related changes needed (imports, types, etc.)

Use proper ReFormer patterns and imports.`,
        },
      },
    ],
  };
}
