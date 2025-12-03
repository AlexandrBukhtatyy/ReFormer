import { getTroubleshooting, searchDocs } from '../utils/docs-parser.js';

export const explainErrorToolDefinition = {
  name: 'explain_error',
  description:
    'Explain a ReFormer error or issue. Provides troubleshooting guidance based on the error message or description.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      error: {
        type: 'string',
        description: 'The error message or description of the issue',
      },
    },
    required: ['error'],
  },
};

// Common error patterns and their explanations
const errorPatterns: Array<{
  pattern: RegExp;
  explanation: string;
  solution: string;
  example?: { wrong: string; correct: string };
}> = [
  // TypeScript type errors - most common
  {
    pattern:
      /string.*not assignable.*\{ *message\??: *string|Argument of type 'string' is not assignable/i,
    explanation:
      'You are passing a string directly as the second argument to a validator, but it expects an options object.',
    solution: 'Wrap the message in an options object: `{ message: "your message" }`',
    example: {
      wrong: "required(path.email, 'Email is required')",
      correct: "required(path.email, { message: 'Email is required' })",
    },
  },
  {
    pattern: /null.*not assignable.*undefined|Type 'null' is not assignable/i,
    explanation:
      'ReFormer uses `undefined` for absent values, not `null`. Your type definition uses `null` which is incompatible.',
    solution:
      'Change your type definitions from `| null` to `| undefined` or use optional properties (`?`).',
    example: {
      wrong: 'amount: number | null;',
      correct: 'amount: number | undefined;\n// or\namount?: number;',
    },
  },
  {
    pattern:
      /no exported member.*ValidationSchemaFn|no exported member.*BehaviorSchemaFn|Module.*has no exported member/i,
    explanation:
      'You are trying to import types from a submodule, but types are exported from the main module.',
    solution:
      'Import types from `@reformer/core`, not from `/validators` or `/behaviors` submodules.',
    example: {
      wrong: "import { ValidationSchemaFn } from '@reformer/core/validators';",
      correct: "import type { ValidationSchemaFn } from '@reformer/core';",
    },
  },
  {
    pattern: /FieldPathNode.*not assignable.*FieldPathNode|cross.*level|different.*level/i,
    explanation:
      'You are using computeFrom with fields at different nesting levels. TypeScript infers the type from source paths, making the target incompatible.',
    solution:
      'Use `watchField` with `ctx.setFieldValue` instead of `computeFrom` for cross-level field computation.',
    example: {
      wrong: 'computeFrom([path.nested.a, path.nested.b], path.root, ...)',
      correct: `watchField(path.nested.a, (_, ctx) => {
  ctx.setFieldValue('root', computedValue);
});`,
    },
  },
  {
    pattern: /FormFields\[\]|value.*FormFields/i,
    explanation:
      'The useFormControl hook is returning `FormFields[]` instead of your expected type. This happens with complex generic inference or index signatures.',
    solution:
      'Use type assertion with `FieldNode<T>`: `useFormControl(form.field as FieldNode<YourType>)`',
    example: {
      wrong: 'const { value } = useFormControl(form.loanType);',
      correct: 'const { value } = useFormControl(form.loanType as FieldNode<LoanType>);',
    },
  },
  {
    pattern: /index signature|key.*string.*unknown/i,
    explanation:
      'Adding an index signature `[key: string]: unknown` to your form interface breaks type inference for all fields.',
    solution: 'Remove the index signature from your form interface. Define all fields explicitly.',
    example: {
      wrong: 'interface MyForm {\n  [key: string]: unknown;\n  name: string;\n}',
      correct: 'interface MyForm {\n  name: string;\n  email: string;\n}',
    },
  },
  {
    pattern:
      /FieldPathNode.*\[\].*not assignable.*\(form.*\).*boolean|Array.*not assignable.*function/i,
    explanation:
      'You are passing an array of paths to a function that expects a condition function. This often happens with resetWhen.',
    solution:
      'Pass a condition function `(form) => boolean` instead of an array. Or use `enableWhen` with `resetOnDisable: true`.',
    example: {
      wrong: 'resetWhen(path.field, [path.dependency]);',
      correct: 'enableWhen(path.field, (form) => form.condition, { resetOnDisable: true });',
    },
  },

  // Runtime errors
  {
    pattern: /field not updating|not re-?rendering/i,
    explanation:
      'The component is not re-rendering when the field value changes. This usually happens when not using the useFormControl hook.',
    solution:
      'Make sure you are using `useFormControl(field)` hook to subscribe to field changes. Direct signal access (`.value.value`) will not trigger React re-renders.',
  },
  {
    pattern: /validation not (trigger|running|work)/i,
    explanation:
      'Validation is not being triggered when expected. This could be due to the `updateOn` setting.',
    solution:
      'Check the `updateOn` option in your field config. Default is "change". For blur-triggered validation, use `updateOn: "blur"`. Also ensure validators are properly registered in the validation schema.',
  },
  {
    pattern: /form.*recreated|re-?created.*every.*render/i,
    explanation: 'The form instance is being recreated on every render, causing state loss.',
    solution:
      'Wrap `createForm()` in `useMemo()`: `const form = useMemo(() => createForm<MyForm>({ form: schema }), []);`',
  },
  {
    pattern: /cannot.*read.*property|undefined.*value/i,
    explanation: 'Trying to access a property on an undefined field or node.',
    solution:
      'Check that the field path is correct. Use `form.getFieldByPath("path.to.field")` for dynamic access. Ensure the field exists in your schema before accessing it.',
  },
  {
    pattern: /array.*index|out of bounds/i,
    explanation: 'Attempting to access an array element that does not exist.',
    solution:
      'Use `array.at(index)` to safely access array items. Check `array.length` before accessing elements. Remember that array indices are 0-based.',
  },
];

export async function explainErrorTool(args: {
  error: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const { error } = args;

  if (!error || error.trim().length === 0) {
    return {
      content: [
        {
          type: 'text',
          text: 'Please provide an error message or description of the issue.',
        },
      ],
    };
  }

  // Check against known error patterns
  for (const { pattern, explanation, solution, example } of errorPatterns) {
    if (pattern.test(error)) {
      let response = `## Error Analysis

**Problem:** ${explanation}

**Solution:** ${solution}`;

      if (example) {
        response += `

### Example

❌ **Wrong:**
\`\`\`typescript
${example.wrong}
\`\`\`

✅ **Correct:**
\`\`\`typescript
${example.correct}
\`\`\``;
      }

      response += `

---

## Related Documentation

${searchDocs(error.split(' ').slice(0, 3).join(' ')).slice(0, 2).join('\n\n---\n\n') || getTroubleshooting()}`;

      return {
        content: [
          {
            type: 'text',
            text: response,
          },
        ],
      };
    }
  }

  // Fallback to FAQ and search
  const faq = getTroubleshooting();
  const searchResults = searchDocs(error.split(' ').slice(0, 5).join(' '));

  let response = `## Troubleshooting: "${error}"\n\n`;

  if (searchResults.length > 0) {
    response += `### Related Documentation\n\n${searchResults.slice(0, 2).join('\n\n---\n\n')}\n\n`;
  }

  response += `### FAQ\n\n${faq}`;

  return {
    content: [
      {
        type: 'text',
        text: response,
      },
    ],
  };
}
