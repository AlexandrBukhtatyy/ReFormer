export const generateSchemaToolDefinition = {
  name: 'generate_schema',
  description:
    'Get template and rules for generating FormSchema for ReFormer forms. Provides component mapping, structure rules, and examples from real projects.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      formType: {
        type: 'string',
        description: 'Type of form (e.g., "registration", "checkout", "settings")',
      },
    },
    required: [],
  },
};

const COMPONENT_MAPPING = [
  { type: 'string', component: 'Input', props: "{ label: '...', placeholder: '...' }" },
  { type: 'string (email)', component: 'Input', props: "{ label: '...', type: 'email' }" },
  { type: 'string (password)', component: 'InputPassword', props: "{ label: '...' }" },
  { type: 'string (multiline)', component: 'Textarea', props: "{ label: '...', rows: 4 }" },
  {
    type: 'string (phone)',
    component: 'InputMask',
    props: "{ label: '...', mask: '+7 (999) 999-99-99' }",
  },
  { type: 'number', component: 'Input', props: "{ label: '...', type: 'number' }" },
  { type: 'boolean', component: 'Checkbox', props: "{ label: '...' }" },
  {
    type: 'enum (few options)',
    component: 'RadioGroup',
    props: "{ label: '...', options: [...] }",
  },
  { type: 'enum (many options)', component: 'Select', props: "{ label: '...', options: [...] }" },
  { type: 'Date', component: 'DatePicker', props: "{ label: '...' }" },
  { type: 'File', component: 'FileInput', props: "{ label: '...', accept: 'image/*' }" },
];

// Справочник стандартных масок для документов РФ
const RF_DOCUMENT_MASKS = {
  phone: {
    mask: '+7 (999) 999-99-99',
    placeholder: '+7 (___) ___-__-__',
    description: 'Телефон РФ (11 цифр)',
  },
  innPerson: {
    mask: '999999999999',
    placeholder: '123456789012',
    description: 'ИНН физлица (12 цифр)',
  },
  innCompany: {
    mask: '9999999999',
    placeholder: '1234567890',
    description: 'ИНН юрлица (10 цифр)',
  },
  snils: {
    mask: '999-999-999 99',
    placeholder: '123-456-789 01',
    description: 'СНИЛС (11 цифр)',
  },
  postalCode: {
    mask: '999999',
    placeholder: '123456',
    description: 'Почтовый индекс РФ (6 цифр)',
  },
  passportSeries: {
    mask: '99 99',
    placeholder: '00 00',
    description: 'Серия паспорта (4 цифры)',
  },
  passportNumber: {
    mask: '999999',
    placeholder: '123456',
    description: 'Номер паспорта (6 цифр)',
  },
  departmentCode: {
    mask: '999-999',
    placeholder: '123-456',
    description: 'Код подразделения (6 цифр)',
  },
  smsCode: {
    mask: '999999',
    placeholder: '123456',
    description: 'SMS-код подтверждения (6 цифр)',
  },
  smsCode4: {
    mask: '9999',
    placeholder: '1234',
    description: 'SMS-код подтверждения (4 цифры)',
  },
};

const REACT_RULES = [
  {
    rule: 'createForm returns GroupNodeWithControls directly (NOT an object with .controls)',
    wrong: `const form = createForm<MyForm>({...});
<MyComponent control={form.controls} />  // undefined!`,
    correct: `const form = createForm<MyForm>({...});
<MyComponent control={form} />  // Correct!`,
    reason: 'createForm() returns a Proxy that IS the controls. There is no .controls property.',
  },
  {
    rule: 'Use useFormControlValue hook for reactive rendering in React',
    wrong: `{control.loanType.value === 'mortgage' && <MortgageFields />}`,
    correct: `import { useFormControlValue } from "@reformer/core";
const loanType = useFormControlValue(control.loanType);
{loanType === 'mortgage' && <MortgageFields />}`,
    reason:
      'control.field.value returns a Signal object, not the actual value. useFormControlValue subscribes to changes and triggers re-render.',
  },
];

const RULES = [
  {
    rule: 'Every field must have a `value` property',
    wrong: 'name: { component: Input }',
    correct: "name: { value: '', component: Input }",
    reason: 'Value defines the initial state of the field.',
  },
  {
    rule: 'Use `null` for empty numeric/date fields, empty string for text',
    wrong: 'amount: { value: 0, ... }  // 0 is a valid value!',
    correct: 'amount: { value: null, ... }',
    reason: 'Null clearly indicates "not filled" vs actual zero.',
  },
  {
    rule: 'Nested groups are objects with field configs',
    wrong: "address: { value: { street: '', city: '' } }",
    correct: "address: { street: { value: '', ... }, city: { value: '', ... } }",
    reason: 'Each nested field needs its own configuration.',
  },
  {
    rule: 'Arrays use tuple syntax [schema]',
    wrong: 'items: { value: [], component: ... }',
    correct: "items: [{ name: { value: '', ... }, price: { value: null, ... } }]",
    reason: 'Tuple [schema] tells ReFormer this is an ArrayNode.',
  },
  {
    rule: 'Computed fields should be disabled',
    wrong: 'total: { value: 0, component: Input }',
    correct:
      'total: { value: 0, component: Input, componentProps: { disabled: true, readonly: true } }',
    reason: 'Users should not edit computed fields.',
  },
];

const EXAMPLES = {
  simple: `import type { FormSchema } from '@reformer/core';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import type { ContactForm } from './type';

export const contactSchema: FormSchema<ContactForm> = {
  name: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Name',
      placeholder: 'Your name',
    },
  },
  email: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Email',
      type: 'email',
      placeholder: 'your@email.com',
    },
  },
  message: {
    value: '',
    component: Textarea,
    componentProps: {
      label: 'Message',
      placeholder: 'Your message',
      rows: 4,
    },
  },
  subscribe: {
    value: false,
    component: Checkbox,
    componentProps: {
      label: 'Subscribe to newsletter',
    },
  },
};`,

  withEnums: `import type { FormSchema } from '@reformer/core';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { RadioGroup } from '@/components/ui/radio-group';
import type { LoanForm } from './type';

// Options for selects/radios
const LOAN_TYPES = [
  { value: 'consumer', label: 'Consumer Loan' },
  { value: 'mortgage', label: 'Mortgage' },
  { value: 'car', label: 'Car Loan' },
];

const TERMS = [
  { value: 12, label: '12 months' },
  { value: 24, label: '24 months' },
  { value: 36, label: '36 months' },
];

export const loanSchema: FormSchema<LoanForm> = {
  loanType: {
    value: 'consumer',
    component: RadioGroup,
    componentProps: {
      label: 'Loan Type',
      options: LOAN_TYPES,
    },
  },
  loanAmount: {
    value: null,  // null for empty number
    component: Input,
    componentProps: {
      label: 'Loan Amount',
      type: 'number',
      min: 10000,
      max: 5000000,
      step: 1000,
    },
  },
  loanTerm: {
    value: 12,
    component: Select,
    componentProps: {
      label: 'Loan Term',
      options: TERMS,
    },
  },
};`,

  withNested: `import type { FormSchema } from '@reformer/core';
import { Input } from '@/components/ui/input';
import { InputMask } from '@/components/ui/input-mask';
import type { RegistrationForm, Address, PersonalData } from './type';

// Sub-schema for Address (reusable)
export const addressSchema: FormSchema<Address> = {
  street: {
    value: '',
    component: Input,
    componentProps: { label: 'Street', placeholder: 'Street address' },
  },
  city: {
    value: '',
    component: Input,
    componentProps: { label: 'City', placeholder: 'City' },
  },
  zip: {
    value: '',
    component: InputMask,
    componentProps: { label: 'ZIP', mask: '99999' },
  },
};

// Sub-schema for PersonalData
export const personalDataSchema: FormSchema<PersonalData> = {
  firstName: {
    value: '',
    component: Input,
    componentProps: { label: 'First Name' },
  },
  lastName: {
    value: '',
    component: Input,
    componentProps: { label: 'Last Name' },
  },
  birthDate: {
    value: null,
    component: Input,
    componentProps: { label: 'Birth Date', type: 'date' },
  },
};

// Main schema combining sub-schemas
export const registrationSchema: FormSchema<RegistrationForm> = {
  // Nested group - use spread or reference
  personalData: personalDataSchema,
  address: addressSchema,

  // Regular fields
  email: {
    value: '',
    component: Input,
    componentProps: { label: 'Email', type: 'email' },
  },
};`,

  withArrays: `import type { FormSchema } from '@reformer/core';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { ApplicationForm, Contact } from './type';

// Schema for array item
const contactItemSchema: FormSchema<Contact> = {
  type: {
    value: 'phone',
    component: Select,
    componentProps: {
      label: 'Type',
      options: [
        { value: 'phone', label: 'Phone' },
        { value: 'email', label: 'Email' },
      ],
    },
  },
  value: {
    value: '',
    component: Input,
    componentProps: { label: 'Value', placeholder: 'Enter value' },
  },
};

export const applicationSchema: FormSchema<ApplicationForm> = {
  name: {
    value: '',
    component: Input,
    componentProps: { label: 'Name' },
  },

  // Array field - use tuple syntax [schema]
  contacts: [contactItemSchema],

  // Usage in component:
  // form.contacts.push({ type: { value: 'phone' }, value: { value: '' } });
  // form.contacts.map((item, index) => <ContactRow key={index} control={item} />);
};`,

  withComputed: `import type { FormSchema } from '@reformer/core';
import { Input } from '@/components/ui/input';
import type { OrderForm } from './type';

export const orderSchema: FormSchema<OrderForm> = {
  // User input
  price: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Price',
      type: 'number',
      min: 0,
    },
  },
  quantity: {
    value: 1,
    component: Input,
    componentProps: {
      label: 'Quantity',
      type: 'number',
      min: 1,
    },
  },
  discount: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Discount (%)',
      type: 'number',
      min: 0,
      max: 100,
    },
  },

  // Computed fields - disabled and readonly
  subtotal: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Subtotal',
      type: 'number',
      disabled: true,
      readonly: true,
    },
  },
  total: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Total',
      type: 'number',
      disabled: true,
      readonly: true,
    },
  },
};

// In behaviors.ts:
// computeFrom([path.price, path.quantity], path.subtotal,
//   ({ price, quantity }) => (price || 0) * (quantity || 1)
// );`,
};

export async function generateSchemaTool(args: {
  formType?: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  let response = `# Generate FormSchema for ReFormer\n\n`;

  // Template
  response += `## Template\n\n`;
  response += `\`\`\`typescript
import type { FormSchema } from '@reformer/core';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import type { MyForm } from './type';

export const myFormSchema: FormSchema<MyForm> = {
  // Text field
  textField: {
    value: '',  // Empty string for text
    component: Input,
    componentProps: {
      label: 'Text Field',
      placeholder: 'Enter text',
    },
  },

  // Number field
  numberField: {
    value: null,  // null for empty number
    component: Input,
    componentProps: {
      label: 'Number Field',
      type: 'number',
      min: 0,
      max: 100,
    },
  },

  // Boolean field
  booleanField: {
    value: false,
    component: Checkbox,
    componentProps: {
      label: 'Check this box',
    },
  },

  // Enum field
  enumField: {
    value: 'option1',  // Default option
    component: Select,
    componentProps: {
      label: 'Select Option',
      options: [
        { value: 'option1', label: 'Option 1' },
        { value: 'option2', label: 'Option 2' },
      ],
    },
  },

  // Nested group
  nestedGroup: {
    field1: { value: '', component: Input, componentProps: { label: 'Field 1' } },
    field2: { value: '', component: Input, componentProps: { label: 'Field 2' } },
  },

  // Array (dynamic list)
  items: [{
    name: { value: '', component: Input, componentProps: { label: 'Name' } },
    value: { value: null, component: Input, componentProps: { label: 'Value', type: 'number' } },
  }],
};
\`\`\`\n\n`;

  // Component mapping table
  response += `## Component Mapping\n\n`;
  response += `| Type | Component | Props |\n`;
  response += `|------|-----------|-------|\n`;
  for (const m of COMPONENT_MAPPING) {
    response += `| ${m.type} | \`${m.component}\` | \`${m.props}\` |\n`;
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

  // Examples
  response += `## Examples\n\n`;

  if (args.formType) {
    response += `### For "${args.formType}" form\n\n`;
    response += `See patterns below and adapt to your needs.\n\n`;
  }

  response += `### Simple Form\n\n\`\`\`typescript\n${EXAMPLES.simple}\n\`\`\`\n\n`;
  response += `### Form with Enums (Select/RadioGroup)\n\n\`\`\`typescript\n${EXAMPLES.withEnums}\n\`\`\`\n\n`;
  response += `### Form with Nested Groups\n\n\`\`\`typescript\n${EXAMPLES.withNested}\n\`\`\`\n\n`;
  response += `### Form with Arrays\n\n\`\`\`typescript\n${EXAMPLES.withArrays}\n\`\`\`\n\n`;
  response += `### Form with Computed Fields\n\n\`\`\`typescript\n${EXAMPLES.withComputed}\n\`\`\`\n\n`;

  // RF Document Masks
  response += `## Стандартные маски для документов РФ\n\n`;
  response += `При генерации форм для российских документов используйте эти маски:\n\n`;
  response += `| Документ | Маска | Placeholder | Описание |\n`;
  response += `|----------|-------|-------------|----------|\n`;
  for (const [key, value] of Object.entries(RF_DOCUMENT_MASKS)) {
    response += `| ${key} | \`${value.mask}\` | \`${value.placeholder}\` | ${value.description} |\n`;
  }
  response += `\n`;

  response += `### Пример использования масок\n\n`;
  response += `\`\`\`typescript
// ИНН физлица (12 цифр)
inn: {
  value: '',
  component: InputMask,
  componentProps: {
    label: 'ИНН',
    mask: '999999999999',
    placeholder: '123456789012',
  },
},

// ИНН юрлица (10 цифр)
companyInn: {
  value: null,
  component: InputMask,
  componentProps: {
    label: 'ИНН компании',
    mask: '9999999999',
    placeholder: '1234567890',
  },
},

// Почтовый индекс (6 цифр)
postalCode: {
  value: '',
  component: InputMask,
  componentProps: {
    label: 'Индекс',
    mask: '999999',
    placeholder: '123456',
  },
},
\`\`\`\n\n`;

  // Common mistakes
  response += `## Common Mistakes\n\n`;
  response += `\`\`\`typescript
// ❌ WRONG: Missing value
email: { component: Input }

// ❌ WRONG: Using 0 for empty number
amount: { value: 0, ... }  // Is 0 empty or actual value?

// ❌ WRONG: Object value for nested
address: { value: { street: '', city: '' } }

// ❌ WRONG: Array without tuple
contacts: { value: [], component: ContactList }

// ❌ WRONG: Editable computed field
total: { value: 0, component: Input }  // Should be disabled

// ❌ WRONG: Incomplete mask for INN (should be 12 digits for person)
inn: { mask: '999999' }  // Missing 6 digits!

// ❌ WRONG: Incomplete mask for phone
phone: { mask: '+7 (999) 999-99-9' }  // Missing last digit!

// ❌ WRONG: Postal code with 5 digits (RF uses 6)
postalCode: { mask: '99999' }  // Should be '999999'
\`\`\`\n\n`;

  // React usage rules
  response += `## React Usage (CRITICAL!)\n\n`;
  for (const r of REACT_RULES) {
    response += `### ${r.rule}\n\n`;
    response += `**Why:** ${r.reason}\n\n`;
    response += `\`\`\`typescript\n`;
    response += `// ❌ Wrong\n${r.wrong}\n\n`;
    response += `// ✅ Correct\n${r.correct}\n`;
    response += `\`\`\`\n\n`;
  }

  response += `### Complete React Component Example\n\n`;
  response += `\`\`\`typescript
import { useMemo } from "react";
import { createForm, useFormControlValue } from "@reformer/core";
import type { GroupNodeWithControls } from "@reformer/core";
import { FormField } from "./FormField";
import { schema } from "./schema";
import { validation } from "./validation";
import { behavior } from "./behaviors";
import type { MyForm } from "./types";

// Create form instance (outside component or in useMemo)
const form = createForm<MyForm>({ form: schema, validation, behavior });

// Step component with conditional rendering
interface StepProps {
  control: GroupNodeWithControls<MyForm>;
}

export function MyStep({ control }: StepProps) {
  // ✅ Use hook for reactive value access
  const loanType = useFormControlValue(control.loanType);
  const showDetails = useFormControlValue(control.showDetails);

  return (
    <div>
      <FormField control={control.loanType} />

      {/* ✅ Conditional rendering with hook value */}
      {loanType === 'mortgage' && (
        <div>
          <FormField control={control.propertyValue} />
        </div>
      )}

      {showDetails && (
        <FormField control={control.details} />
      )}
    </div>
  );
}

// Main form component
export function MyFormComponent() {
  const formInstance = useMemo(() => form, []);

  return (
    // ✅ Pass form directly, NOT form.controls
    <MyStep control={formInstance} />
  );
}
\`\`\`\n\n`;

  response += `## Next Steps\n\n`;
  response += `After creating your schema:\n`;
  response += `1. Use \`generate_validation\` to add validation rules\n`;
  response += `2. Use \`generate_behavior\` to add computed fields and conditions\n`;
  response += `3. Create the form with \`createForm({ form: schema, validation, behavior })\`\n`;

  return {
    content: [{ type: 'text', text: response }],
  };
}
