export const createFormPromptDefinition = {
  name: 'create-form',
  description:
    'Generate a ReFormer form using the step-by-step workflow with quality tools. Creates type definitions, form schema, validation, and behaviors.',
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

  return {
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `You are an expert on ReFormer form library. Create a form following the step-by-step workflow.

## Task

Create a ReFormer form for: "${description}"

## Required Workflow

Follow this exact sequence using the available tools:

### Step 1: Project Structure
Use \`get_recommended_structure\` tool to get the recommended file structure.
Choose complexity: simple (3-5 fields), medium (5-15 fields), or complex (multi-step/nested).

### Step 2: TypeScript Types
Use \`generate_types\` tool to get the template and rules for type definitions.
Create your interface following the rules (no null, no index signatures).

### Step 3: Form Schema
Use \`generate_schema\` tool to get the template and component mapping.
Create FormSchema with proper value initialization and components.

### Step 4: Validation
Use \`generate_validation\` tool to get validators and patterns.
Create ValidationSchemaFn with proper imports from \`@reformer/core/validators\`.

### Step 5: Behaviors (if needed)
Use \`generate_behavior\` tool if the form needs:
- Computed fields
- Conditional fields (show/hide)
- Field watching
Create BehaviorSchemaFn with proper imports from \`@reformer/core/behaviors\`.

### Step 6: Quality Check
Use \`check_code\` tool to verify your generated code.
Fix any errors or warnings reported.

## Guidelines

- Import types from \`@reformer/core\`
- Import validators from \`@reformer/core/validators\`
- Import behaviors from \`@reformer/core/behaviors\`
- Use \`undefined\` instead of \`null\` for optional fields in types
- Use \`null\` for empty numeric values in schema
- Every field config must have a \`value\` property
- Pass options object to validators, not strings: \`{ message: '...' }\`
- Use \`createForm<T>({ form, validation, behavior })\` to create the form

Call the tools in sequence and generate complete, working code.`,
        },
      },
    ],
  };
}
