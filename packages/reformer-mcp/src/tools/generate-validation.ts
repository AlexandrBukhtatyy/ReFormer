export const generateValidationToolDefinition = {
  name: 'generate_validation',
  description:
    'Get template and rules for generating ValidationSchemaFn for ReFormer forms. Provides built-in validators, custom validation, conditional validation, and cross-field validation examples.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      validationType: {
        type: 'string',
        description:
          'Type of validation needed (e.g., "basic", "conditional", "cross-field", "async")',
      },
    },
    required: [],
  },
};

const BUILT_IN_VALIDATORS = [
  {
    name: 'required',
    usage: "required(path.field, { message: '...' })",
    description: 'Field must have a value',
  },
  {
    name: 'min',
    usage: "min(path.field, 10, { message: '...' })",
    description: 'Minimum value for numbers',
  },
  {
    name: 'max',
    usage: "max(path.field, 100, { message: '...' })",
    description: 'Maximum value for numbers',
  },
  {
    name: 'minLength',
    usage: "minLength(path.field, 3, { message: '...' })",
    description: 'Minimum string length',
  },
  {
    name: 'maxLength',
    usage: "maxLength(path.field, 50, { message: '...' })",
    description: 'Maximum string length',
  },
  {
    name: 'email',
    usage: "email(path.field, { message: '...' })",
    description: 'Valid email format',
  },
  {
    name: 'pattern',
    usage: "pattern(path.field, /^[A-Z]/, { message: '...' })",
    description: 'Regex pattern match',
  },
  { name: 'url', usage: "url(path.field, { message: '...' })", description: 'Valid URL format' },
];

const RULES = [
  {
    rule: 'Import validators from @reformer/core/validators',
    wrong: "import { required } from '@reformer/core';",
    correct: "import { required, email, min } from '@reformer/core/validators';",
    reason: 'Validators are in a separate subpath for tree-shaking.',
  },
  {
    rule: 'Pass options object for custom message',
    wrong: "required(path.email, 'Email is required');",
    correct: "required(path.email, { message: 'Email is required' });",
    reason: 'Validators expect options object, not string.',
  },
  {
    rule: 'Use validate() for custom validation',
    wrong: 'if (value < 10) setError(...)',
    correct:
      "validate(path.field, (value) => value < 10 ? { code: 'min', message: '...' } : null);",
    reason: 'Custom validators must return ValidationError or null.',
  },
  {
    rule: 'Use ctx.form for cross-field validation',
    wrong: 'validate(path.confirm, (value) => value !== password ? error : null)',
    correct:
      'validate(path.confirm, (value, ctx) => value !== ctx.form.password.value.value ? error : null)',
    reason: 'Access other fields via ctx.form proxy.',
  },
  {
    rule: 'Use when() for conditional validation',
    wrong: 'if (form.type === "business") required(path.companyName)',
    correct: 'when((form) => form.type === "business", () => { required(path.companyName) })',
    reason: 'when() ensures validators are applied reactively.',
  },
];

const EXAMPLES = {
  basic: `import type { ValidationSchemaFn } from '@reformer/core';
import { required, email, minLength, maxLength } from '@reformer/core/validators';
import type { ContactForm } from './type';

export const contactValidation: ValidationSchemaFn<ContactForm> = (path) => {
  // Required fields
  required(path.name, { message: 'Name is required' });
  required(path.email, { message: 'Email is required' });
  required(path.message, { message: 'Message is required' });

  // Format validation
  email(path.email, { message: 'Invalid email format' });

  // Length validation
  minLength(path.name, 2, { message: 'Name must be at least 2 characters' });
  maxLength(path.message, 500, { message: 'Message must be under 500 characters' });
};`,

  custom: `import type { ValidationSchemaFn } from '@reformer/core';
import { required, validate } from '@reformer/core/validators';
import type { ProfileForm } from './type';

export const profileValidation: ValidationSchemaFn<ProfileForm> = (path) => {
  required(path.username);

  // Custom validation with validate()
  validate(path.username, (value) => {
    if (!value) return null;  // Let required handle empty

    // Check format
    if (!/^[a-zA-Z0-9_]+$/.test(value)) {
      return {
        code: 'invalidFormat',
        message: 'Username can only contain letters, numbers, and underscores',
      };
    }

    // Check reserved names
    const reserved = ['admin', 'root', 'system'];
    if (reserved.includes(value.toLowerCase())) {
      return {
        code: 'reserved',
        message: 'This username is reserved',
      };
    }

    return null;
  });

  // Age validation
  validate(path.age, (value) => {
    if (value === null || value === undefined) return null;

    if (value < 18) {
      return { code: 'tooYoung', message: 'Must be at least 18 years old' };
    }
    if (value > 120) {
      return { code: 'invalid', message: 'Please enter a valid age' };
    }

    return null;
  });
};`,

  crossField: `import type { ValidationSchemaFn } from '@reformer/core';
import { required, validate } from '@reformer/core/validators';
import type { RegistrationForm } from './type';

export const registrationValidation: ValidationSchemaFn<RegistrationForm> = (path) => {
  required(path.password, { message: 'Password is required' });
  required(path.confirmPassword, { message: 'Please confirm your password' });

  // Cross-field validation: passwords must match
  validate(path.confirmPassword, (value, ctx) => {
    const password = ctx.form.password.value.value;

    // Skip if either is empty
    if (!value || !password) return null;

    if (value !== password) {
      return {
        code: 'mismatch',
        message: 'Passwords do not match',
      };
    }
    return null;
  });

  // Date range validation
  validate(path.endDate, (value, ctx) => {
    const startDate = ctx.form.startDate.value.value;

    if (!value || !startDate) return null;

    if (new Date(value) < new Date(startDate)) {
      return {
        code: 'invalidRange',
        message: 'End date must be after start date',
      };
    }
    return null;
  });

  // Amount validation based on another field
  validate(path.initialPayment, (value, ctx) => {
    const propertyValue = ctx.form.propertyValue.value.value;

    if (!value || !propertyValue) return null;

    const minPayment = propertyValue * 0.2;  // 20% minimum
    if (value < minPayment) {
      return {
        code: 'tooLow',
        message: \`Initial payment must be at least \${minPayment.toLocaleString()}\`,
      };
    }
    return null;
  });
};`,

  conditional: `import type { ValidationSchemaFn } from '@reformer/core';
import { required, when, min, email } from '@reformer/core/validators';
import type { ApplicationForm } from './type';

export const applicationValidation: ValidationSchemaFn<ApplicationForm> = (path) => {
  // Always required
  required(path.name);
  required(path.applicationType);

  // Conditional: only for business applications
  when(
    (form) => form.applicationType === 'business',
    () => {
      required(path.companyName, { message: 'Company name is required for business applications' });
      required(path.taxId, { message: 'Tax ID is required for business applications' });
    }
  );

  // Conditional: only for individual applications
  when(
    (form) => form.applicationType === 'individual',
    () => {
      required(path.socialSecurityNumber);
      required(path.birthDate);
    }
  );

  // Conditional: validate additionalIncome only if hasAdditionalIncome is true
  when(
    (form) => form.hasAdditionalIncome === true,
    () => {
      required(path.additionalIncomeSource, { message: 'Please specify income source' });
      min(path.additionalIncomeAmount, 1, { message: 'Amount must be greater than 0' });
    }
  );

  // Conditional: mortgage-specific validation
  when(
    (form) => form.loanType === 'mortgage',
    () => {
      required(path.propertyAddress);
      required(path.propertyValue);
      required(path.downPayment);
    }
  );
};`,

  async: `import type { ValidationSchemaFn } from '@reformer/core';
import { required, validateAsync } from '@reformer/core/validators';
import type { RegistrationForm } from './type';

// API functions (implement these)
const checkUsernameAvailable = async (username: string): Promise<boolean> => {
  // Call your API
  const response = await fetch(\`/api/check-username?username=\${username}\`);
  const data = await response.json();
  return data.available;
};

const checkEmailAvailable = async (email: string): Promise<boolean> => {
  const response = await fetch(\`/api/check-email?email=\${email}\`);
  const data = await response.json();
  return data.available;
};

export const registrationValidation: ValidationSchemaFn<RegistrationForm> = (path) => {
  required(path.username);
  required(path.email);

  // Async validation: check username availability
  validateAsync(
    path.username,
    async (value) => {
      if (!value || value.length < 3) return null;

      const available = await checkUsernameAvailable(value);
      if (!available) {
        return {
          code: 'taken',
          message: 'This username is already taken',
        };
      }
      return null;
    },
    { debounce: 500 }  // Wait 500ms after typing stops
  );

  // Async validation: check email availability
  validateAsync(
    path.email,
    async (value) => {
      if (!value) return null;

      const available = await checkEmailAvailable(value);
      if (!available) {
        return {
          code: 'taken',
          message: 'This email is already registered',
        };
      }
      return null;
    },
    { debounce: 500 }
  );
};`,

  stepByStep: `import type { ValidationSchemaFn } from '@reformer/core';
import { required, when, email } from '@reformer/core/validators';
import type { MultiStepForm } from './type';

// Step 1 validation
export const step1Validation: ValidationSchemaFn<MultiStepForm> = (path) => {
  required(path.firstName);
  required(path.lastName);
  required(path.email);
  email(path.email);
};

// Step 2 validation
export const step2Validation: ValidationSchemaFn<MultiStepForm> = (path) => {
  required(path.address.street);
  required(path.address.city);
  required(path.address.zip);
};

// Step 3 validation
export const step3Validation: ValidationSchemaFn<MultiStepForm> = (path) => {
  required(path.agreeTerms, { message: 'You must accept the terms' });
};

// Combined validation (all steps)
export const multiStepValidation: ValidationSchemaFn<MultiStepForm> = (path) => {
  step1Validation(path);
  step2Validation(path);
  step3Validation(path);
};

// Alternative: validate based on current step
export const currentStepValidation: ValidationSchemaFn<MultiStepForm> = (path) => {
  when((form) => form.currentStep >= 1, () => step1Validation(path));
  when((form) => form.currentStep >= 2, () => step2Validation(path));
  when((form) => form.currentStep >= 3, () => step3Validation(path));
};`,
};

export async function generateValidationTool(args: {
  validationType?: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  let response = `# Generate ValidationSchemaFn for ReFormer\n\n`;

  // Template
  response += `## Template\n\n`;
  response += `\`\`\`typescript
import type { ValidationSchemaFn } from '@reformer/core';
import { required, email, min, max, minLength, maxLength, pattern, validate, when, validateAsync } from '@reformer/core/validators';
import type { MyForm } from './type';

export const myFormValidation: ValidationSchemaFn<MyForm> = (path) => {
  // Basic required
  required(path.field, { message: 'Field is required' });

  // Format validators
  email(path.emailField, { message: 'Invalid email' });
  pattern(path.field, /^[A-Z]/, { message: 'Must start with uppercase' });

  // Range validators
  min(path.numberField, 0, { message: 'Must be positive' });
  max(path.numberField, 100, { message: 'Maximum is 100' });
  minLength(path.textField, 3, { message: 'At least 3 characters' });

  // Custom validation
  validate(path.field, (value, ctx) => {
    if (someCondition) {
      return { code: 'custom', message: 'Error message' };
    }
    return null;
  });

  // Conditional validation
  when(
    (form) => form.type === 'special',
    () => {
      required(path.specialField);
    }
  );

  // Async validation
  validateAsync(path.field, async (value) => {
    const result = await checkSomething(value);
    return result.ok ? null : { code: 'error', message: 'Failed' };
  }, { debounce: 500 });
};
\`\`\`\n\n`;

  // Built-in validators table
  response += `## Built-in Validators\n\n`;
  response += `| Validator | Usage | Description |\n`;
  response += `|-----------|-------|-------------|\n`;
  for (const v of BUILT_IN_VALIDATORS) {
    response += `| \`${v.name}\` | \`${v.usage}\` | ${v.description} |\n`;
  }
  response += `\n`;

  // Rules
  response += `## Rules\n\n`;
  for (const r of RULES) {
    response += `### ${r.rule}\n\n`;
    response += `**Why:** ${r.reason}\n\n`;
    response += `\`\`\`typescript\n`;
    response += `// ❌ Wrong\n${r.wrong}\n\n`;
    response += `// ✅ Correct\n${r.correct}\n`;
    response += `\`\`\`\n\n`;
  }

  // Examples based on type
  response += `## Examples\n\n`;

  const type = args.validationType?.toLowerCase();

  if (!type || type === 'basic') {
    response += `### Basic Validation\n\n\`\`\`typescript\n${EXAMPLES.basic}\n\`\`\`\n\n`;
  }

  if (!type || type === 'custom') {
    response += `### Custom Validation\n\n\`\`\`typescript\n${EXAMPLES.custom}\n\`\`\`\n\n`;
  }

  if (!type || type === 'cross-field' || type === 'crossfield') {
    response += `### Cross-Field Validation\n\n\`\`\`typescript\n${EXAMPLES.crossField}\n\`\`\`\n\n`;
  }

  if (!type || type === 'conditional') {
    response += `### Conditional Validation\n\n\`\`\`typescript\n${EXAMPLES.conditional}\n\`\`\`\n\n`;
  }

  if (!type || type === 'async') {
    response += `### Async Validation\n\n\`\`\`typescript\n${EXAMPLES.async}\n\`\`\`\n\n`;
  }

  if (!type || type === 'step' || type === 'multi-step') {
    response += `### Multi-Step Form Validation\n\n\`\`\`typescript\n${EXAMPLES.stepByStep}\n\`\`\`\n\n`;
  }

  // Common mistakes
  response += `## Common Mistakes\n\n`;
  response += `\`\`\`typescript
// ❌ WRONG: String instead of options object
required(path.email, 'Email is required');
// ✅ CORRECT
required(path.email, { message: 'Email is required' });

// ❌ WRONG: Direct field comparison
validate(path.confirm, (v) => v !== password ? err : null);
// ✅ CORRECT: Use ctx.form
validate(path.confirm, (v, ctx) => v !== ctx.form.password.value.value ? err : null);

// ❌ WRONG: Imperative condition
if (form.type === 'x') required(path.y);
// ✅ CORRECT: Use when()
when((f) => f.type === 'x', () => required(path.y));

// ❌ WRONG: Forgot null return
validate(path.field, (v) => { if (bad) return error; });
// ✅ CORRECT: Always return
validate(path.field, (v) => bad ? error : null);
\`\`\`\n\n`;

  response += `## Next Steps\n\n`;
  response += `After creating validation:\n`;
  response += `1. Use \`generate_behavior\` to add computed fields and conditions\n`;
  response += `2. Use \`check_code\` to verify your validation code\n`;

  return {
    content: [{ type: 'text', text: response }],
  };
}
