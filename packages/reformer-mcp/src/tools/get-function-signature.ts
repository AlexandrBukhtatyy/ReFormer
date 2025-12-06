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
  applyWhen: {
    name: 'applyWhen',
    module: '@reformer/core/validators',
    signature:
      'applyWhen<T, V>(fieldPath: FieldPathNode<T, V>, condition: (fieldValue: V) => boolean, validatorsFn: (path: FieldPath<T>) => void): void',
    parameters: [
      {
        name: 'fieldPath',
        type: 'FieldPathNode<T, V>',
        required: true,
        description: 'Path to the field that controls the condition',
      },
      {
        name: 'condition',
        type: '(fieldValue: V) => boolean',
        required: true,
        description: 'Function that returns true when validators should apply',
      },
      {
        name: 'validatorsFn',
        type: '(path: FieldPath<T>) => void',
        required: true,
        description: 'Function that registers conditional validators',
      },
    ],
    examples: [
      `applyWhen(
  path.hasAddress,
  (hasAddress) => hasAddress === true,
  (p) => {
    required(p.address.street);
    required(p.address.city);
  }
)`,
      `// Conditional validation based on enum
applyWhen(
  path.loanType,
  (type) => type === 'mortgage',
  (p) => {
    required(p.mortgageDetails.propertyValue);
    min(p.mortgageDetails.downPayment, 20000);
  }
)`,
    ],
  },

  // Array methods
  clear: {
    name: 'clear',
    module: '@reformer/core',
    signature: 'ArrayNode<T>.clear(): void',
    parameters: [],
    returns: 'void',
    examples: [
      `// Clear all items from array
form.items.clear();`,
      `// Clear array when checkbox unchecked
watchField(
  path.hasItems,
  (hasItems, ctx) => {
    if (!hasItems && ctx.form.items) {
      ctx.form.items.clear();
    }
  },
  { immediate: false }
);`,
    ],
    commonMistakes: [
      {
        wrong: `watchField(path.hasItems, (hasItems, ctx) => {
  if (!hasItems) ctx.form.items.clear(); // May crash on init!
});`,
        correct: `watchField(
  path.hasItems,
  (hasItems, ctx) => {
    if (!hasItems && ctx.form.items) {
      ctx.form.items.clear();
    }
  },
  { immediate: false }
);`,
        explanation:
          'Always use immediate: false and null check when clearing arrays in watchField to prevent initialization issues',
      },
    ],
  },
  push: {
    name: 'push',
    module: '@reformer/core',
    signature: 'ArrayNode<T>.push(item: T): void',
    parameters: [
      {
        name: 'item',
        type: 'T',
        required: true,
        description: 'Item to add to the end of the array',
      },
    ],
    returns: 'void',
    examples: [
      `// Add new item to array
form.products.push({ name: '', price: 0, quantity: 1 });`,
      `// Add item with default values
const defaultProduct = { name: '', price: 0, quantity: 1 };
form.products.push(defaultProduct);`,
    ],
  },
  removeAt: {
    name: 'removeAt',
    module: '@reformer/core',
    signature: 'ArrayNode<T>.removeAt(index: number): void',
    parameters: [
      {
        name: 'index',
        type: 'number',
        required: true,
        description: 'Zero-based index of the item to remove',
      },
    ],
    returns: 'void',
    examples: [
      `// Remove item at specific index
form.products.removeAt(index);`,
      `// In array item component
<button onClick={() => form.products.removeAt(index)}>
  Remove
</button>`,
    ],
  },
  at: {
    name: 'at',
    module: '@reformer/core',
    signature: 'ArrayNode<T>.at(index: number): GroupNodeWithControls<T> | undefined',
    parameters: [
      {
        name: 'index',
        type: 'number',
        required: true,
        description: 'Zero-based index of the item to access',
      },
    ],
    returns: 'GroupNodeWithControls<T> | undefined',
    examples: [
      `// Access specific array item
const firstProduct = form.products.at(0);
if (firstProduct) {
  console.log(firstProduct.name.value.value);
}`,
    ],
  },
  map: {
    name: 'map',
    module: '@reformer/core',
    signature:
      'ArrayNode<T>.map<R>(callback: (item: GroupNodeWithControls<T>, index: number) => R): R[]',
    parameters: [
      {
        name: 'callback',
        type: '(item: GroupNodeWithControls<T>, index: number) => R',
        required: true,
        description: 'Function to execute for each array item',
      },
    ],
    returns: 'R[]',
    examples: [
      `// Render array items
{form.products.map((item, index) => (
  <ProductItem
    key={item.id}
    control={item}
    index={index}
    onRemove={() => form.products.removeAt(index)}
  />
))}`,
    ],
    commonMistakes: [
      {
        wrong: `{form.products.map((item, index) => (
  <ProductItem key={index} ... />
))}`,
        correct: `{form.products.map((item, index) => (
  <ProductItem key={item.id} ... />
))}`,
        explanation: 'Use item.id as key, not index. Each array item has a stable id property.',
      },
    ],
  },
  length: {
    name: 'length',
    module: '@reformer/core',
    signature: 'ArrayNode<T>.length: number',
    parameters: [],
    returns: 'number',
    examples: [
      `// Check array length
if (form.products.length === 0) {
  console.log('No products');
}`,
      `// Disable remove button for single item
<button
  disabled={form.products.length <= 1}
  onClick={() => form.products.removeAt(index)}
>
  Remove
</button>`,
    ],
  },

  // Field methods
  updateComponentProps: {
    name: 'updateComponentProps',
    module: '@reformer/core',
    signature: 'FieldNode<T>.updateComponentProps(props: Partial<ComponentProps>): void',
    parameters: [
      {
        name: 'props',
        type: 'Partial<ComponentProps>',
        required: true,
        description: 'Props to merge with existing component props (e.g., options for select)',
      },
    ],
    returns: 'void',
    examples: [
      `// Update select options dynamically
watchField(
  path.region,
  async (region, ctx) => {
    if (!region) return;

    try {
      const { data } = await fetchCities(region);
      ctx.form.city.updateComponentProps({ options: data });
    } catch (error) {
      console.error('Failed to fetch cities:', error);
      ctx.form.city.updateComponentProps({ options: [] });
    }
  },
  { immediate: false, debounce: 300 }
);`,
    ],
    commonMistakes: [
      {
        wrong: `watchField(path.region, async (region, ctx) => {
  const { data } = await fetchCities(region);
  ctx.form.city.updateComponentProps({ options: data });
});`,
        correct: `watchField(
  path.region,
  async (region, ctx) => {
    if (!region) return;
    try {
      const { data } = await fetchCities(region);
      ctx.form.city.updateComponentProps({ options: data });
    } catch (error) {
      ctx.form.city.updateComponentProps({ options: [] });
    }
  },
  { immediate: false, debounce: 300 }
);`,
        explanation:
          'Always use immediate: false, debounce, guard clause, and try-catch with async operations',
      },
    ],
  },
  setValue: {
    name: 'setValue',
    module: '@reformer/core',
    signature: 'FieldNode<T>.setValue(value: T): void',
    parameters: [
      {
        name: 'value',
        type: 'T',
        required: true,
        description: 'New value to set for the field',
      },
    ],
    returns: 'void',
    examples: [
      `// Set field value programmatically
form.email.setValue('user@example.com');`,
      `// Reset field to default
form.status.setValue('pending');`,
    ],
  },
  markAsTouched: {
    name: 'markAsTouched',
    module: '@reformer/core',
    signature: 'FieldNode<T>.markAsTouched(): void',
    parameters: [],
    returns: 'void',
    examples: [
      `// Mark field as touched to show validation errors
form.email.markAsTouched();`,
      `// Mark all fields as touched before submit
const markAllTouched = (node: FormNode) => {
  if ('markAsTouched' in node) {
    node.markAsTouched();
  }
  // Recursively mark children
};`,
    ],
  },
  reset: {
    name: 'reset',
    module: '@reformer/core',
    signature: 'FormNode.reset(): void',
    parameters: [],
    returns: 'void',
    examples: [
      `// Reset entire form to initial values
form.reset();`,
      `// Reset specific field group
form.address.reset();`,
    ],
  },

  // Form methods
  validate: {
    name: 'validate',
    module: '@reformer/core',
    signature: 'Form<T>.validate(): Promise<boolean>',
    parameters: [],
    returns: 'Promise<boolean>',
    examples: [
      `// Validate form before submit
const handleSubmit = async () => {
  await form.validate();
  if (form.valid.value) {
    // Submit form data
    const data = form.toJSON();
    await submitForm(data);
  }
};`,
    ],
  },
  toJSON: {
    name: 'toJSON',
    module: '@reformer/core',
    signature: 'Form<T>.toJSON(): T',
    parameters: [],
    returns: 'T',
    examples: [
      `// Get form data as plain object
const data = form.toJSON();
console.log(data);`,
      `// Submit form data
const handleSubmit = async () => {
  await form.validate();
  if (form.valid.value) {
    await api.post('/submit', form.toJSON());
  }
};`,
    ],
  },

  // Hooks
  useFormControl: {
    name: 'useFormControl',
    module: '@reformer/core',
    signature:
      'useFormControl<T>(field: FieldNode<T>): { value: T; error: ValidationError | null; touched: boolean; disabled: boolean }',
    parameters: [
      {
        name: 'field',
        type: 'FieldNode<T>',
        required: true,
        description: 'Field node to subscribe to',
      },
    ],
    returns: '{ value: T; error: ValidationError | null; touched: boolean; disabled: boolean }',
    examples: [
      `const { value, error, touched } = useFormControl(form.email);`,
      `// With type assertion for complex fields
const { value } = useFormControl(form.loanType as FieldNode<LoanType>);`,
    ],
    commonMistakes: [
      {
        wrong: `// Direct signal access - won't trigger re-render
const value = form.email.value.value;`,
        correct: `// Hook subscription - triggers re-render
const { value } = useFormControl(form.email);`,
        explanation:
          'Always use useFormControl hook to subscribe to field changes. Direct signal access will not trigger React re-renders.',
      },
    ],
  },
  useStepForm: {
    name: 'useStepForm',
    module: '@reformer/core',
    signature:
      'useStepForm<T>(form: Form<T>, options: StepFormOptions<T>): StepFormResult',
    parameters: [
      {
        name: 'form',
        type: 'Form<T>',
        required: true,
        description: 'Form instance',
      },
      {
        name: 'options',
        type: '{ stepSchemas: Record<number, ValidationSchemaFn<T>>; totalSteps: number }',
        required: true,
        description: 'Configuration with step validation schemas',
      },
    ],
    returns:
      '{ currentStep: number; nextStep: () => void; prevStep: () => void; validateCurrentStep: () => Promise<boolean>; isFirstStep: boolean; isLastStep: boolean; goToStep: (step: number) => void }',
    examples: [
      `const STEP_VALIDATIONS = {
  1: step1Validation,
  2: step2Validation,
  3: step3Validation,
};

const {
  currentStep,
  nextStep,
  prevStep,
  validateCurrentStep,
  isFirstStep,
  isLastStep,
} = useStepForm(form, {
  stepSchemas: STEP_VALIDATIONS,
  totalSteps: 3,
});

const handleNext = async () => {
  const isValid = await validateCurrentStep();
  if (isValid) nextStep();
};`,
    ],
  },

  // Additional validators
  pattern: {
    name: 'pattern',
    module: '@reformer/core/validators',
    signature: 'pattern(path: FieldPathNode<T, string>, regex: RegExp, options?: { message?: string }): void',
    parameters: [
      { name: 'path', type: 'FieldPathNode<T, string>', required: true, description: 'Path to the string field' },
      { name: 'regex', type: 'RegExp', required: true, description: 'Regular expression to match against' },
      { name: 'options', type: '{ message?: string }', required: false, description: 'Validation options with custom message' },
    ],
    examples: [
      `pattern(path.phone, /^\\+7\\d{10}$/, { message: 'Invalid phone format' });`,
      `pattern(path.zipCode, /^\\d{5}(-\\d{4})?$/, { message: 'Invalid ZIP code' });`,
    ],
  },
  url: {
    name: 'url',
    module: '@reformer/core/validators',
    signature: 'url(path: FieldPathNode<T, string>, options?: { message?: string }): void',
    parameters: [
      { name: 'path', type: 'FieldPathNode<T, string>', required: true, description: 'Path to the URL field' },
      { name: 'options', type: '{ message?: string }', required: false, description: 'Validation options' },
    ],
    examples: [
      `url(path.website, { message: 'Please enter a valid URL' });`,
    ],
  },
  phone: {
    name: 'phone',
    module: '@reformer/core/validators',
    signature: 'phone(path: FieldPathNode<T, string>, options?: { message?: string; format?: PhoneFormat }): void',
    parameters: [
      { name: 'path', type: 'FieldPathNode<T, string>', required: true, description: 'Path to the phone field' },
      { name: 'options', type: '{ message?: string; format?: PhoneFormat }', required: false, description: 'Validation options with optional format' },
    ],
    examples: [
      `phone(path.mobile, { message: 'Invalid phone number' });`,
      `phone(path.mobile, { format: 'RU', message: 'Invalid Russian phone' });`,
    ],
  },
  number: {
    name: 'number',
    module: '@reformer/core/validators',
    signature: 'number(path: FieldPathNode<T, string | number>, options?: { message?: string }): void',
    parameters: [
      { name: 'path', type: 'FieldPathNode<T, string | number>', required: true, description: 'Path to the field' },
      { name: 'options', type: '{ message?: string }', required: false, description: 'Validation options' },
    ],
    examples: [
      `number(path.amount, { message: 'Must be a valid number' });`,
    ],
  },
  date: {
    name: 'date',
    module: '@reformer/core/validators',
    signature: 'date(path: FieldPathNode<T, string | Date>, options?: { message?: string; minAge?: number; maxAge?: number; noFuture?: boolean; noPast?: boolean }): void',
    parameters: [
      { name: 'path', type: 'FieldPathNode<T, string | Date>', required: true, description: 'Path to the date field' },
      { name: 'options', type: '{ message?: string; minAge?: number; maxAge?: number; noFuture?: boolean; noPast?: boolean }', required: false, description: 'Validation options with age and date restrictions' },
    ],
    examples: [
      `date(path.birthDate, { minAge: 18, message: 'Must be 18 or older' });`,
      `date(path.startDate, { noPast: true, message: 'Date cannot be in the past' });`,
      `date(path.endDate, { noFuture: true });`,
    ],
  },
  notEmpty: {
    name: 'notEmpty',
    module: '@reformer/core/validators',
    signature: 'notEmpty(path: FieldPathNode<T, T[]>, options?: { message?: string }): void',
    parameters: [
      { name: 'path', type: 'FieldPathNode<T, T[]>', required: true, description: 'Path to the array field' },
      { name: 'options', type: '{ message?: string }', required: false, description: 'Validation options' },
    ],
    examples: [
      `notEmpty(path.contacts, { message: 'Add at least one contact' });`,
      `// With conditional validation
applyWhen(
  path.hasItems,
  (hasItems) => hasItems === true,
  (p) => {
    notEmpty(p.items, { message: 'Items required' });
  }
);`,
    ],
  },
  validateItems: {
    name: 'validateItems',
    module: '@reformer/core/validators',
    signature: 'validateItems<T>(arrayPath: FieldPathNode<Form, T[]>, itemValidatorsFn: (itemPath: FieldPath<T>) => void): void',
    parameters: [
      { name: 'arrayPath', type: 'FieldPathNode<Form, T[]>', required: true, description: 'Path to the array field' },
      { name: 'itemValidatorsFn', type: '(itemPath: FieldPath<T>) => void', required: true, description: 'Function that registers validators for each array item' },
    ],
    examples: [
      `validateItems(path.contacts, (itemPath) => {
  required(itemPath.name, { message: 'Name required' });
  email(itemPath.email, { message: 'Invalid email' });
});`,
    ],
  },

  // Additional behaviors
  resetWhen: {
    name: 'resetWhen',
    module: '@reformer/core/behaviors',
    signature: 'resetWhen(path: FieldPathNode<T, V>, condition: (form: T) => boolean, options?: { toValue?: V }): void',
    parameters: [
      { name: 'path', type: 'FieldPathNode<T, V>', required: true, description: 'Path to the field to reset' },
      { name: 'condition', type: '(form: T) => boolean', required: true, description: 'Condition when to reset' },
      { name: 'options', type: '{ toValue?: V }', required: false, description: 'Options with optional reset value' },
    ],
    examples: [
      `resetWhen(path.city, (form) => form.country !== previousCountry);`,
      `resetWhen(path.amount, (form) => form.type === 'free', { toValue: 0 });`,
    ],
  },
  revalidateWhen: {
    name: 'revalidateWhen',
    module: '@reformer/core/behaviors',
    signature: 'revalidateWhen(triggerPath: FieldPathNode<T, V1>, targetPath: FieldPathNode<T, V2>): void',
    parameters: [
      { name: 'triggerPath', type: 'FieldPathNode<T, V1>', required: true, description: 'Path to field that triggers revalidation' },
      { name: 'targetPath', type: 'FieldPathNode<T, V2>', required: true, description: 'Path to field to revalidate' },
    ],
    examples: [
      `// Revalidate confirmPassword when password changes
revalidateWhen(path.password, path.confirmPassword);`,
      `// Revalidate endDate when startDate changes
revalidateWhen(path.startDate, path.endDate);`,
    ],
  },
  transformValue: {
    name: 'transformValue',
    module: '@reformer/core/behaviors',
    signature: 'transformValue(path: FieldPathNode<T, V>, transformer: (value: V) => V, options?: { on?: "change" | "blur" }): void',
    parameters: [
      { name: 'path', type: 'FieldPathNode<T, V>', required: true, description: 'Path to the field' },
      { name: 'transformer', type: '(value: V) => V', required: true, description: 'Function to transform the value' },
      { name: 'options', type: '{ on?: "change" | "blur" }', required: false, description: 'When to apply transform' },
    ],
    examples: [
      `// Transform to uppercase on blur
transformValue(path.code, (v) => v?.toUpperCase() || '', { on: 'blur' });`,
      `// Using built-in transformers
import { transformers } from '@reformer/core/behaviors';

transformValue(path.email, transformers.trim);
transformValue(path.name, transformers.toUpperCase);`,
    ],
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
