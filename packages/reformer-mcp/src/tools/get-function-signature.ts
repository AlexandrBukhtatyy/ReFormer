export const getFunctionSignatureToolDefinition = {
  name: 'get_function_signature',
  description:
    'Get the exact TypeScript signature for a ReFormer function, including parameters, types, and usage examples.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      functionName: {
        type: 'string',
        description: 'Name of the function (e.g., "required", "computeFrom", "enableWhen")',
      },
    },
    required: ['functionName'],
  },
};

interface FunctionSignature {
  name: string;
  module: string;
  signature: string;
  parameters: Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
  }>;
  returns?: string;
  examples: string[];
  commonMistakes?: Array<{
    wrong: string;
    correct: string;
    explanation: string;
  }>;
}

const functionSignatures: Record<string, FunctionSignature> = {
  // Validators
  required: {
    name: 'required',
    module: '@reformer/core/validators',
    signature: 'required<T>(path: FieldPathNode<T>, options?: { message?: string }): void',
    parameters: [
      {
        name: 'path',
        type: 'FieldPathNode<T>',
        required: true,
        description: 'Path to the form field',
      },
      {
        name: 'options',
        type: '{ message?: string }',
        required: false,
        description: 'Validation options with custom error message',
      },
    ],
    examples: ['required(path.email)', "required(path.email, { message: 'Email is required' })"],
    commonMistakes: [
      {
        wrong: "required(path.email, 'Email is required')",
        correct: "required(path.email, { message: 'Email is required' })",
        explanation: 'Message must be passed via options object, not as a direct string',
      },
    ],
  },
  min: {
    name: 'min',
    module: '@reformer/core/validators',
    signature:
      'min<T>(path: FieldPathNode<T, number>, value: number, options?: { message?: string }): void',
    parameters: [
      {
        name: 'path',
        type: 'FieldPathNode<T, number>',
        required: true,
        description: 'Path to the numeric field',
      },
      {
        name: 'value',
        type: 'number',
        required: true,
        description: 'Minimum allowed value',
      },
      {
        name: 'options',
        type: '{ message?: string }',
        required: false,
        description: 'Validation options',
      },
    ],
    examples: [
      'min(path.age, 18)',
      "min(path.amount, 1000, { message: 'Minimum amount is 1000' })",
    ],
    commonMistakes: [
      {
        wrong: "min(path.age, 18, 'Must be at least 18')",
        correct: "min(path.age, 18, { message: 'Must be at least 18' })",
        explanation: 'Message must be passed via options object',
      },
    ],
  },
  max: {
    name: 'max',
    module: '@reformer/core/validators',
    signature:
      'max<T>(path: FieldPathNode<T, number>, value: number, options?: { message?: string }): void',
    parameters: [
      {
        name: 'path',
        type: 'FieldPathNode<T, number>',
        required: true,
        description: 'Path to the numeric field',
      },
      {
        name: 'value',
        type: 'number',
        required: true,
        description: 'Maximum allowed value',
      },
      {
        name: 'options',
        type: '{ message?: string }',
        required: false,
        description: 'Validation options',
      },
    ],
    examples: ['max(path.quantity, 100)', "max(path.age, 120, { message: 'Invalid age' })"],
  },
  minLength: {
    name: 'minLength',
    module: '@reformer/core/validators',
    signature:
      'minLength<T>(path: FieldPathNode<T, string>, length: number, options?: { message?: string }): void',
    parameters: [
      {
        name: 'path',
        type: 'FieldPathNode<T, string>',
        required: true,
        description: 'Path to the string field',
      },
      {
        name: 'length',
        type: 'number',
        required: true,
        description: 'Minimum string length',
      },
      {
        name: 'options',
        type: '{ message?: string }',
        required: false,
        description: 'Validation options',
      },
    ],
    examples: [
      'minLength(path.password, 8)',
      "minLength(path.name, 2, { message: 'Name too short' })",
    ],
  },
  maxLength: {
    name: 'maxLength',
    module: '@reformer/core/validators',
    signature:
      'maxLength<T>(path: FieldPathNode<T, string>, length: number, options?: { message?: string }): void',
    parameters: [
      {
        name: 'path',
        type: 'FieldPathNode<T, string>',
        required: true,
        description: 'Path to the string field',
      },
      {
        name: 'length',
        type: 'number',
        required: true,
        description: 'Maximum string length',
      },
      {
        name: 'options',
        type: '{ message?: string }',
        required: false,
        description: 'Validation options',
      },
    ],
    examples: ['maxLength(path.comment, 500)', 'maxLength(path.title, 100)'],
  },
  email: {
    name: 'email',
    module: '@reformer/core/validators',
    signature: 'email<T>(path: FieldPathNode<T, string>, options?: { message?: string }): void',
    parameters: [
      {
        name: 'path',
        type: 'FieldPathNode<T, string>',
        required: true,
        description: 'Path to the email field',
      },
      {
        name: 'options',
        type: '{ message?: string }',
        required: false,
        description: 'Validation options',
      },
    ],
    examples: ['email(path.email)', "email(path.contactEmail, { message: 'Invalid email' })"],
  },
  validate: {
    name: 'validate',
    module: '@reformer/core/validators',
    signature:
      'validate<T, V>(path: FieldPathNode<T, V>, validator: (value: V) => ValidationError | null): void',
    parameters: [
      {
        name: 'path',
        type: 'FieldPathNode<T, V>',
        required: true,
        description: 'Path to the field',
      },
      {
        name: 'validator',
        type: '(value: V) => ValidationError | null',
        required: true,
        description: 'Custom validation function returning error or null',
      },
    ],
    examples: [
      `validate(path.age, (value) => {
  if (value < 18) return { key: 'underage', message: 'Must be 18+' };
  return null;
})`,
    ],
  },
  validateTree: {
    name: 'validateTree',
    module: '@reformer/core/validators',
    signature:
      'validateTree<T>(validator: (ctx: ValidationContext<T>) => ValidationError | null): void',
    parameters: [
      {
        name: 'validator',
        type: '(ctx: ValidationContext<T>) => ValidationError | null',
        required: true,
        description: 'Cross-field validation function with access to full form context',
      },
    ],
    examples: [
      `validateTree((ctx) => {
  const password = ctx.form.password.value.value;
  const confirm = ctx.form.confirmPassword.value.value;
  if (password !== confirm) {
    ctx.setError('confirmPassword', { key: 'mismatch', message: 'Passwords must match' });
  }
  return null;
})`,
    ],
  },

  // Behaviors
  enableWhen: {
    name: 'enableWhen',
    module: '@reformer/core/behaviors',
    signature:
      'enableWhen<T>(path: FieldPathNode<T>, condition: (form: T) => boolean, options?: { resetOnDisable?: boolean }): void',
    parameters: [
      {
        name: 'path',
        type: 'FieldPathNode<T>',
        required: true,
        description: 'Path to the field to enable/disable',
      },
      {
        name: 'condition',
        type: '(form: T) => boolean',
        required: true,
        description: 'Function returning true when field should be enabled',
      },
      {
        name: 'options',
        type: '{ resetOnDisable?: boolean }',
        required: false,
        description: 'Options - resetOnDisable clears value when disabled',
      },
    ],
    examples: [
      "enableWhen(path.mortgageDetails, (form) => form.loanType === 'mortgage')",
      `enableWhen(path.otherReason, (form) => form.reason === 'other', {
  resetOnDisable: true
})`,
    ],
  },
  disableWhen: {
    name: 'disableWhen',
    module: '@reformer/core/behaviors',
    signature: 'disableWhen<T>(path: FieldPathNode<T>, condition: (form: T) => boolean): void',
    parameters: [
      {
        name: 'path',
        type: 'FieldPathNode<T>',
        required: true,
        description: 'Path to the field to disable',
      },
      {
        name: 'condition',
        type: '(form: T) => boolean',
        required: true,
        description: 'Function returning true when field should be disabled',
      },
    ],
    examples: ['disableWhen(path.discount, (form) => form.isStandardPricing)'],
  },
  computeFrom: {
    name: 'computeFrom',
    module: '@reformer/core/behaviors',
    signature:
      'computeFrom<T, S extends FieldPathNode<T>[], R>(sources: S, target: FieldPathNode<T, R>, compute: (values: SourceValues<S>) => R): void',
    parameters: [
      {
        name: 'sources',
        type: 'FieldPathNode<T>[]',
        required: true,
        description: 'Array of source field paths to watch',
      },
      {
        name: 'target',
        type: 'FieldPathNode<T, R>',
        required: true,
        description: 'Target field path to set computed value',
      },
      {
        name: 'compute',
        type: '(values: SourceValues<S>) => R',
        required: true,
        description: 'Function to compute target value from source values',
      },
    ],
    examples: [
      `computeFrom(
  [path.price, path.quantity],
  path.total,
  ({ price, quantity }) => price * quantity
)`,
    ],
    commonMistakes: [
      {
        wrong: 'computeFrom([path.nested.a, path.nested.b], path.root, ...)',
        correct: `watchField(path.nested.a, (_, ctx) => {
  ctx.setFieldValue('root', computed);
})`,
        explanation:
          'computeFrom requires all paths at the same nesting level. For cross-level computation, use watchField with ctx.setFieldValue',
      },
    ],
  },
  watchField: {
    name: 'watchField',
    module: '@reformer/core/behaviors',
    signature:
      'watchField<T, V>(path: FieldPathNode<T, V>, callback: (value: V, ctx: WatchContext<T>) => void): void',
    parameters: [
      {
        name: 'path',
        type: 'FieldPathNode<T, V>',
        required: true,
        description: 'Path to the field to watch',
      },
      {
        name: 'callback',
        type: '(value: V, ctx: WatchContext<T>) => void',
        required: true,
        description:
          'Callback with current value and context for accessing form and setting values',
      },
    ],
    examples: [
      `watchField(path.country, (country, ctx) => {
  if (country === 'US') {
    ctx.setFieldValue('phonePrefix', '+1');
  }
})`,
      `// Cross-level computation
watchField(path.personalData.lastName, (_, ctx) => {
  const last = ctx.form.personalData.lastName.value.value || '';
  const first = ctx.form.personalData.firstName.value.value || '';
  ctx.setFieldValue('fullName', \`\${last} \${first}\`.trim());
})`,
    ],
  },
  copyFrom: {
    name: 'copyFrom',
    module: '@reformer/core/behaviors',
    signature:
      'copyFrom<T>(source: FieldPathNode<T>, target: FieldPathNode<T>, options?: CopyOptions): void',
    parameters: [
      {
        name: 'source',
        type: 'FieldPathNode<T>',
        required: true,
        description: 'Source field path',
      },
      {
        name: 'target',
        type: 'FieldPathNode<T>',
        required: true,
        description: 'Target field path',
      },
      {
        name: 'options',
        type: '{ when?: (form: T) => boolean; fields?: string[]; transform?: (value) => value }',
        required: false,
        description: 'Options for conditional copy, field selection, or transformation',
      },
    ],
    examples: [
      `copyFrom(path.billingAddress, path.shippingAddress, {
  when: (form) => form.sameAsShipping
})`,
    ],
  },
  syncFields: {
    name: 'syncFields',
    module: '@reformer/core/behaviors',
    signature:
      'syncFields<T>(paths: FieldPathNode<T>[], options?: { bidirectional?: boolean }): void',
    parameters: [
      {
        name: 'paths',
        type: 'FieldPathNode<T>[]',
        required: true,
        description: 'Array of field paths to synchronize',
      },
      {
        name: 'options',
        type: '{ bidirectional?: boolean }',
        required: false,
        description: 'Options - bidirectional syncs in both directions',
      },
    ],
    examples: ['syncFields([path.email, path.confirmEmail])'],
  },
};

export async function getFunctionSignatureTool(args: {
  functionName: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const { functionName } = args;
  const normalized = functionName.toLowerCase().trim();

  const signature = functionSignatures[normalized] || functionSignatures[functionName];

  if (!signature) {
    const available = Object.keys(functionSignatures).join(', ');
    return {
      content: [
        {
          type: 'text',
          text: `Function "${functionName}" not found.\n\nAvailable functions: ${available}`,
        },
      ],
    };
  }

  let response = `## ${signature.name}\n\n`;
  response += `**Module:** \`${signature.module}\`\n\n`;
  response += `**Signature:**\n\`\`\`typescript\n${signature.signature}\n\`\`\`\n\n`;

  response += `### Parameters\n\n`;
  for (const param of signature.parameters) {
    response += `- **${param.name}**${param.required ? '' : ' (optional)'}: \`${param.type}\`\n`;
    response += `  ${param.description}\n\n`;
  }

  if (signature.returns) {
    response += `### Returns\n\n\`${signature.returns}\`\n\n`;
  }

  response += `### Examples\n\n`;
  for (const example of signature.examples) {
    response += `\`\`\`typescript\n${example}\n\`\`\`\n\n`;
  }

  if (signature.commonMistakes && signature.commonMistakes.length > 0) {
    response += `### ⚠️ Common Mistakes\n\n`;
    for (const mistake of signature.commonMistakes) {
      response += `❌ **Wrong:**\n\`\`\`typescript\n${mistake.wrong}\n\`\`\`\n\n`;
      response += `✅ **Correct:**\n\`\`\`typescript\n${mistake.correct}\n\`\`\`\n\n`;
      response += `**Why:** ${mistake.explanation}\n\n---\n\n`;
    }
  }

  return {
    content: [{ type: 'text', text: response }],
  };
}
