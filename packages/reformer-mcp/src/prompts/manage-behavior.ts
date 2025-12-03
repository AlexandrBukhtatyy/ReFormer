import { getSection, getExamples } from '../utils/docs-parser.js';

export const manageBehaviorPromptDefinition = {
  name: 'manage-behavior',
  description:
    'Add, modify, or remove reactive behaviors in a ReFormer form. Helps with computed fields, conditional visibility, field synchronization, and custom behaviors.',
  arguments: [
    {
      name: 'task',
      description:
        'Description of the behavior task (e.g., "calculate total from price and quantity", "disable shipping when pickup is selected", "sync billing and shipping address")',
      required: true,
    },
  ],
};

export function getManageBehaviorPrompt(args: { task: string }): {
  messages: Array<{ role: 'user'; content: { type: 'text'; text: string } }>;
} {
  const { task } = args;

  const behaviorsSection = getSection('Behaviors');
  const behaviorExamples = getExamples('behavior');

  return {
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `You are an expert on ReFormer behaviors. Help with the following behavior task.

## ReFormer Behaviors Documentation

${behaviorsSection}

### Behavior Examples
${behaviorExamples}

---

## Available Behaviors (from 'reformer/behaviors')

### computeFrom
Calculate field value from other fields:
\`\`\`typescript
computeFrom(
  [path.price, path.quantity],  // Watch these fields
  path.total,                    // Update this field
  ({ price, quantity }) => price * quantity
);
\`\`\`

### enableWhen / disableWhen
Conditional field enable/disable:
\`\`\`typescript
enableWhen(path.discount, (form) => form.total > 500);
disableWhen(path.shipping, (form) => form.deliveryMethod === 'pickup');
\`\`\`

### watchField
React to field changes:
\`\`\`typescript
watchField(path.country, async (value, ctx) => {
  const cities = await fetchCities(value);
  ctx.form.city.updateComponentProps({ options: cities });
}, { debounce: 300 });
\`\`\`

### copyFrom
Copy values between fields/groups:
\`\`\`typescript
copyFrom(path.billingAddress, path.shippingAddress, {
  when: (form) => form.sameAsShipping === true,
  fields: 'all',
});
\`\`\`

### syncFields
Two-way synchronization:
\`\`\`typescript
syncFields(path.field1, path.field2);
\`\`\`

### resetWhen
Reset field when condition is met:
\`\`\`typescript
resetWhen(path.city, [path.country]);
\`\`\`

### revalidateWhen
Trigger revalidation:
\`\`\`typescript
revalidateWhen(path.confirmPassword, [path.password]);
\`\`\`

---

## Task

${task}

Provide:
1. The behavior code to add/modify/remove
2. Explanation of what the behavior does
3. Where to place the code in the behavior schema
4. Any related changes needed (imports, dependencies, etc.)

Use proper ReFormer patterns and imports.`,
        },
      },
    ],
  };
}
