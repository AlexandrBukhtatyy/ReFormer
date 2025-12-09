export const generateTypesToolDefinition = {
  name: 'generate_types',
  description:
    'Get template and rules for generating TypeScript interfaces for ReFormer forms. Provides correct type patterns, examples, and common mistakes to avoid.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      formDescription: {
        type: 'string',
        description:
          'Description of the form fields and their types (e.g., "user registration with name, email, password")',
      },
    },
    required: [],
  },
};

const RULES = [
  {
    rule: 'Use `undefined` instead of `null` for optional values',
    wrong: 'amount: number | null;',
    correct: 'amount: number | undefined;  // or amount?: number;',
    reason: 'ReFormer uses undefined for empty field values. Null breaks type inference.',
  },
  {
    rule: 'Never use index signatures',
    wrong: '[key: string]: unknown;',
    correct: 'Define each field explicitly',
    reason: 'Index signatures break TypeScript inference for field paths.',
  },
  {
    rule: 'Use union types for enums',
    wrong: "type: string; // 'credit' | 'debit'",
    correct: "type LoanType = 'credit' | 'debit';\ntype: LoanType;",
    reason: 'Union types provide autocomplete and type safety.',
  },
  {
    rule: 'Use nested interfaces for groups',
    wrong: 'addressStreet: string;\naddressCity: string;',
    correct: 'address: {\n  street: string;\n  city: string;\n};',
    reason: 'Nested structures map directly to GroupNode in ReFormer.',
  },
  {
    rule: 'Use arrays for dynamic lists',
    wrong: 'item1: Item;\nitem2: Item;',
    correct: 'items: Item[];',
    reason: 'Arrays map to ArrayNode with push/pop/map methods.',
  },
];

const EXAMPLES = {
  simple: `// Simple form type
interface ContactForm {
  name: string;
  email: string;
  message: string;
  subscribe: boolean;
}`,

  withEnums: `// Form with enum types
type LoanType = 'consumer' | 'mortgage' | 'car';
type EmploymentStatus = 'employed' | 'selfEmployed' | 'unemployed' | 'retired';

interface LoanApplicationForm {
  loanType: LoanType;
  loanAmount: number;
  loanTerm: number;
  employmentStatus: EmploymentStatus;
  monthlyIncome: number;
}`,

  withOptional: `// Form with optional fields
interface ProfileForm {
  // Required fields
  username: string;
  email: string;

  // Optional fields - use ? or | undefined
  phone?: string;
  bio?: string;
  website: string | undefined;

  // DO NOT use null
  // avatar: string | null;  // WRONG!
}`,

  withNested: `// Form with nested structure
interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

interface PersonalData {
  firstName: string;
  lastName: string;
  birthDate: string;  // ISO date string
}

interface RegistrationForm {
  // Nested groups
  personalData: PersonalData;
  address: Address;

  // Simple fields
  email: string;
  password: string;
  acceptTerms: boolean;
}`,

  withArrays: `// Form with dynamic arrays
interface Contact {
  type: 'phone' | 'email' | 'social';
  value: string;
  isPrimary: boolean;
}

interface Property {
  type: 'house' | 'apartment' | 'land';
  value: number;
  address: string;
}

interface ApplicationForm {
  name: string;

  // Array of simple objects
  contacts: Contact[];

  // Array of nested forms
  properties: Property[];

  // Optional array
  references?: Array<{
    name: string;
    phone: string;
  }>;
}`,

  withComputed: `// Form with computed fields (readonly)
interface OrderForm {
  // User input
  items: Array<{
    name: string;
    price: number;
    quantity: number;
  }>;
  discount: number;

  // Computed fields (will be set by behaviors)
  subtotal: number;
  tax: number;
  total: number;
}`,

  complex: `// Complex multi-step form
type LoanType = 'consumer' | 'mortgage' | 'car';
type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed';

interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
}

interface PersonalData {
  firstName: string;
  middleName?: string;
  lastName: string;
  birthDate: string;
  gender: 'male' | 'female' | 'other';
}

interface CoBorrower {
  personalData: PersonalData;
  relationship: 'spouse' | 'parent' | 'other';
  monthlyIncome: number;
}

interface CreditApplicationForm {
  // Step 1: Loan Info
  loanType: LoanType;
  loanAmount: number;
  loanTerm: number;
  loanPurpose: string;

  // Step 2: Personal Info
  personalData: PersonalData;
  maritalStatus: MaritalStatus;
  dependents: number;

  // Step 3: Address
  registrationAddress: Address;
  sameAsRegistration: boolean;
  residenceAddress: Address;

  // Step 4: Employment
  isEmployed: boolean;
  companyName: string;
  position: string;
  monthlyIncome: number;
  additionalIncome?: number;

  // Step 5: Additional
  hasCoBorrower: boolean;
  coBorrowers: CoBorrower[];

  // Step 6: Confirmation
  agreeTerms: boolean;
  agreePrivacy: boolean;

  // Computed fields
  totalIncome: number;
  monthlyPayment: number;
  interestRate: number;
}`,
};

export async function generateTypesTool(args: {
  formDescription?: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  let response = `# Generate TypeScript Types for ReFormer Forms\n\n`;

  // Template section
  response += `## Template\n\n`;
  response += `\`\`\`typescript\n`;
  response += `// 1. Define enum types first
type FieldType = 'option1' | 'option2' | 'option3';

// 2. Define nested structures
interface NestedGroup {
  field1: string;
  field2: number;
}

// 3. Define main form interface
interface MyForm {
  // Required fields
  requiredField: string;

  // Optional fields (use ? or | undefined)
  optionalField?: string;

  // Enum fields
  enumField: FieldType;

  // Nested groups (becomes GroupNode)
  nestedGroup: NestedGroup;

  // Arrays (becomes ArrayNode)
  items: Array<{ name: string; value: number }>;

  // Computed fields (set by behaviors)
  computedField: number;
}
\`\`\`\n\n`;

  // Rules section
  response += `## Rules\n\n`;
  for (const r of RULES) {
    response += `### ${r.rule}\n\n`;
    response += `**Why:** ${r.reason}\n\n`;
    response += `\`\`\`typescript\n`;
    response += `// ❌ Wrong\n${r.wrong}\n\n`;
    response += `// ✅ Correct\n${r.correct}\n`;
    response += `\`\`\`\n\n`;
  }

  // Examples section
  response += `## Examples\n\n`;

  if (args.formDescription) {
    response += `### Based on your description: "${args.formDescription}"\n\n`;
    response += `Analyze your form requirements and use the patterns below.\n\n`;
  }

  response += `### Simple Form\n\n\`\`\`typescript\n${EXAMPLES.simple}\n\`\`\`\n\n`;
  response += `### Form with Enums\n\n\`\`\`typescript\n${EXAMPLES.withEnums}\n\`\`\`\n\n`;
  response += `### Form with Optional Fields\n\n\`\`\`typescript\n${EXAMPLES.withOptional}\n\`\`\`\n\n`;
  response += `### Form with Nested Groups\n\n\`\`\`typescript\n${EXAMPLES.withNested}\n\`\`\`\n\n`;
  response += `### Form with Arrays\n\n\`\`\`typescript\n${EXAMPLES.withArrays}\n\`\`\`\n\n`;
  response += `### Complex Multi-Step Form\n\n\`\`\`typescript\n${EXAMPLES.complex}\n\`\`\`\n\n`;

  // Common mistakes
  response += `## Common Mistakes\n\n`;
  response += `\`\`\`typescript\n`;
  response += `// ❌ WRONG: Using null
interface BadForm {
  name: string | null;  // Use undefined or optional instead
}

// ❌ WRONG: Index signature
interface BadForm {
  [key: string]: unknown;  // Breaks field path inference
  name: string;
}

// ❌ WRONG: Generic object
interface BadForm {
  data: object;  // Use specific interface instead
}

// ❌ WRONG: any type
interface BadForm {
  value: any;  // Always use specific types
}
\`\`\`\n\n`;

  response += `## Next Steps\n\n`;
  response += `After creating your type:\n`;
  response += `1. Use \`generate_schema\` to create the FormSchema\n`;
  response += `2. Use \`generate_validation\` to add validation rules\n`;
  response += `3. Use \`generate_behavior\` to add computed fields and conditions\n`;

  return {
    content: [{ type: 'text', text: response }],
  };
}
