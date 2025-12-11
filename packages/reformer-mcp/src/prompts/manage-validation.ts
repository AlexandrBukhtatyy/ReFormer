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

### Built-in Validators (from '@reformer/core/validators')
- \`required(path, options?)\` - Non-empty value
- \`email(path, options?)\` - Valid email format
- \`minLength(path, n, options?)\` - Minimum string length
- \`maxLength(path, n, options?)\` - Maximum string length
- \`min(path, n, options?)\` - Minimum number value
- \`max(path, n, options?)\` - Maximum number value
- \`pattern(path, regex, options?)\` - Match regex
- \`url(path, options?)\` - Valid URL
- \`phone(path, options?)\` - Valid phone number
- \`number(path, options?)\` - Must be a number
- \`date(path, options?)\` - Valid date

### Array Validators
- \`notEmpty(path, options?)\` - Array must have at least one item
- \`validateItems(arrayPath, itemValidatorsFn)\` - Validate each array item

### Custom Validators
- \`validate(path, fn)\` - Custom sync validator (fn receives value and ctx)
- \`validateAsync(path, fn, options?)\` - Custom async validator
- \`validateTree(fn, options?)\` - Cross-field validation (returns error or null)

### Conditional Validators (IMPORTANT - 3 arguments!)
- \`applyWhen(triggerPath, condition, validatorsFn)\` - Apply validators conditionally
\`\`\`typescript
// Example: require companyName only when type is 'business'
applyWhen(
  path.type,                      // 1st: field to watch
  (type) => type === 'business',  // 2nd: condition on field value
  (p) => {                        // 3rd: validators to apply
    required(p.companyName);
  }
);
\`\`\`

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
