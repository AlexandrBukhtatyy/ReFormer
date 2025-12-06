import { getSection, getFullDocs } from '../utils/docs-parser.js';

export const generateArrayFormPromptDefinition = {
  name: 'generate-array-form',
  description:
    'Generate a form with dynamic arrays (e.g., list of items, multiple addresses). Includes array item schema, FormArrayManager, and cleanup behaviors.',
  arguments: [
    {
      name: 'description',
      description:
        'Description of the form with arrays (e.g., "order form with list of products and multiple shipping addresses")',
      required: true,
    },
    {
      name: 'arrays',
      description:
        'Comma-separated list of array fields (e.g., "products, addresses, contacts")',
      required: false,
    },
  ],
};

export function getGenerateArrayFormPrompt(args: {
  description: string;
  arrays?: string;
}): {
  messages: Array<{ role: 'user'; content: { type: 'text'; text: string } }>;
} {
  const { description, arrays } = args;

  const validationSection = getSection('Validation');
  const quickStart = getSection('Quick Start');

  return {
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `You are an expert on ReFormer form library. Generate a complete form with dynamic arrays.

## ReFormer Documentation

### Validation
${validationSection}

### Quick Start
${quickStart}

## Array Form Patterns

### Array Schema Format (CRITICAL)

\`\`\`typescript
// ✅ CORRECT - use tuple format for arrays
interface OrderForm {
  customerName: string;
  products: Array<{
    name: string;
    price: number;
    quantity: number;
  }>;
  hasMultipleAddresses: boolean;
  addresses: Array<{
    street: string;
    city: string;
    zip: string;
  }>;
}

// Schema with tuple format
const schema = {
  customerName: '',
  products: [{ name: '', price: 0, quantity: 1 }] as [typeof productSchema],
  hasMultipleAddresses: false,
  addresses: [{ street: '', city: '', zip: '' }] as [typeof addressSchema],
};
\`\`\`

### Array Item Component

\`\`\`typescript
interface ProductItemProps {
  control: GroupNodeWithControls<Product>;
  index: number;
  onRemove: () => void;
}

function ProductItem({ control, index, onRemove }: ProductItemProps) {
  return (
    <div className="array-item">
      <span>Product #{index + 1}</span>
      <FormField control={control.name} />
      <FormField control={control.price} />
      <FormField control={control.quantity} />
      <button type="button" onClick={onRemove}>Remove</button>
    </div>
  );
}
\`\`\`

### FormArrayManager Pattern

\`\`\`typescript
interface FormArrayManagerProps<T> {
  control: ArrayNode<T>;
  renderItem: (itemControl: GroupNodeWithControls<T>, index: number) => ReactNode;
  onAdd?: () => void;
  addButtonText?: string;
}

function FormArrayManager<T>({ control, renderItem, onAdd, addButtonText }: Props) {
  return (
    <div className="array-container">
      {control.map((itemControl, index) => (
        <div key={itemControl.id}>
          {renderItem(itemControl, index)}
        </div>
      ))}
      <button type="button" onClick={() => onAdd?.() || control.push(defaultItem)}>
        {addButtonText || 'Add Item'}
      </button>
    </div>
  );
}
\`\`\`

### Array Cleanup Behavior (CRITICAL)

\`\`\`typescript
import { watchField } from '@reformer/core/behaviors';

// ✅ CORRECT - cleanup array when checkbox unchecked
const behaviorSchema: BehaviorSchemaFn<OrderForm> = (path) => {
  // Clear addresses array when hasMultipleAddresses is unchecked
  watchField(
    path.hasMultipleAddresses,
    (hasMultiple, ctx) => {
      if (!hasMultiple && ctx.form.addresses) {
        ctx.form.addresses.clear();
      }
    },
    { immediate: false }  // REQUIRED to prevent init issues
  );
};

// ❌ WRONG - no immediate: false
watchField(path.hasItems, (hasItems, ctx) => {
  if (!hasItems) ctx.form.items.clear();  // May crash!
});
\`\`\`

### Array Item Validation

\`\`\`typescript
const validation: ValidationSchemaFn<OrderForm> = (path) => {
  required(path.customerName);

  // Validate each product in array
  // Note: This validates all items, ReFormer handles iteration
  required(path.products.$.name, { message: 'Product name required' });
  min(path.products.$.price, 0, { message: 'Price must be positive' });
  min(path.products.$.quantity, 1, { message: 'Quantity must be at least 1' });

  // Conditional array validation
  applyWhen(
    path.hasMultipleAddresses,
    (hasMultiple) => hasMultiple === true,
    (p) => {
      required(p.addresses.$.street);
      required(p.addresses.$.city);
    }
  );
};
\`\`\`

### Conditional Array Display

\`\`\`typescript
function OrderForm({ form }: Props) {
  const { value: hasMultipleAddresses } = useFormControl(
    form.hasMultipleAddresses as FieldNode<boolean>
  );

  return (
    <div>
      <FormField control={form.customerName} />

      {/* Products array - always visible */}
      <FormArrayManager
        control={form.products}
        renderItem={(item, index) => (
          <ProductItem
            control={item}
            index={index}
            onRemove={() => form.products.removeAt(index)}
          />
        )}
      />

      {/* Checkbox to enable multiple addresses */}
      <FormField control={form.hasMultipleAddresses} />

      {/* Addresses array - conditional */}
      {hasMultipleAddresses && (
        <FormArrayManager
          control={form.addresses}
          renderItem={(item, index) => (
            <AddressItem
              control={item}
              index={index}
              onRemove={() => form.addresses.removeAt(index)}
            />
          )}
        />
      )}
    </div>
  );
}
\`\`\`

---

## Task

Create a ReFormer form with arrays for: "${description}"
${arrays ? `\nArray fields: ${arrays}` : ''}

Generate the following:

1. **types.ts** - TypeScript interfaces for form and array items
2. **schema.ts** - Form schema with proper tuple format for arrays
3. **validation.ts** - Validation including array item validation
4. **behavior.ts** - Behavior with array cleanup watchField
5. **components/[ItemName]Item.tsx** - Array item components
6. **components/FormArrayManager.tsx** - Generic array manager (or use existing)
7. **[FormName]Form.tsx** - Main form component

Requirements:
- Use tuple format \`[itemSchema] as [typeof itemSchema]\` for array schemas
- Include cleanup behavior with \`{ immediate: false }\`
- Per-item validation using \`path.arrayName.$.field\` syntax
- Conditional array display if checkbox controls visibility
- Add/Remove buttons for array items
- Proper TypeScript typing throughout

Provide complete, working code that follows ReFormer best practices.`,
        },
      },
    ],
  };
}
