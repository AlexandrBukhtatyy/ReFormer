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
  when(
    (form) => form.loanType === 'mortgage',
    () => {
      required(path.mortgageDetails.propertyValue);
    }
  );
}`,
    relatedPatterns: ['conditional-validation'],
  },

  'conditional-validation': {
    name: 'Conditional Validation',
    description: 'Apply validation rules only when conditions are met',
    solution: 'Use when() wrapper for conditional validators',
    code: `import { required, when, min } from '@reformer/core/validators';
import type { ValidationSchemaFn } from '@reformer/core';

const validation: ValidationSchemaFn<MyForm> = (path) => {
  // Always required
  required(path.email);

  // Required only when hasPhone is true
  when(
    (form) => form.hasPhone === true,
    () => {
      required(path.phone);
    }
  );

  // Validate age only for specific countries
  when(
    (form) => form.country === 'US',
    () => {
      required(path.age);
      min(path.age, 21, { message: 'Must be 21+ in the US' });
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

const form = createForm<MultiStepForm>({
  form: {
    currentStep: { value: 1 },
    name: { value: '' },
    email: { value: '' },
    address: { value: '' },
    city: { value: '' },
    cardNumber: { value: '' },
    expiry: { value: '' },
  },
  validation: (path) => {
    // Step 1 validation
    when((form) => form.currentStep >= 1, () => {
      required(path.name);
      email(path.email);
    });

    // Step 2 validation
    when((form) => form.currentStep >= 2, () => {
      required(path.address);
      required(path.city);
    });

    // Step 3 validation
    when((form) => form.currentStep >= 3, () => {
      required(path.cardNumber);
      required(path.expiry);
    });
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
