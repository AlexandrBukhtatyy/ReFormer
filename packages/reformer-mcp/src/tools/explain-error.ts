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
}> = [
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
    pattern: /typescript|type error|type.*mismatch/i,
    explanation: 'TypeScript is reporting type errors with your form schema or types.',
    solution:
      'Ensure your type interface matches the schema structure exactly. Use `createForm<YourType>()` for proper type inference. Check that nested objects and arrays match their type definitions.',
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
  for (const { pattern, explanation, solution } of errorPatterns) {
    if (pattern.test(error)) {
      return {
        content: [
          {
            type: 'text',
            text: `## Error Analysis

**Problem:** ${explanation}

**Solution:** ${solution}

---

## Related Documentation

${searchDocs(error.split(' ').slice(0, 3).join(' ')).slice(0, 2).join('\n\n---\n\n') || getTroubleshooting()}`,
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
