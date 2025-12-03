import { getTroubleshooting, getSection } from '../utils/docs-parser.js';

export const debugFormPromptDefinition = {
  name: 'debug-form',
  description:
    'Help debug issues with a ReFormer form. Analyzes code and provides solutions for common problems.',
  arguments: [
    {
      name: 'code',
      description: 'The form code that has issues (paste the relevant code)',
      required: true,
    },
  ],
};

export function getDebugFormPrompt(args: { code: string }): {
  messages: Array<{ role: 'user'; content: { type: 'text'; text: string } }>;
} {
  const { code } = args;

  const faq = getTroubleshooting();
  const reactIntegration = getSection('React Integration');
  const apiReference = getSection('API Reference');

  return {
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `You are an expert debugger for ReFormer forms. Analyze the code and identify issues.

## Common Issues & Solutions

${faq}

## React Integration Reference

${reactIntegration}

## API Reference

${apiReference}

---

## Code to Debug

\`\`\`typescript
${code}
\`\`\`

---

## Analysis Tasks

Please analyze the code above and:

1. **Identify Issues**: List any problems, bugs, or anti-patterns you find
2. **Root Cause**: Explain why each issue occurs
3. **Solutions**: Provide fixed code for each issue
4. **Best Practices**: Suggest improvements even if code works

Common things to check:
- [ ] Is \`createForm\` wrapped in \`useMemo\`?
- [ ] Are \`useFormControl\` hooks used for subscriptions?
- [ ] Is the type definition matching the schema?
- [ ] Are validators properly imported and applied?
- [ ] Is \`markAsTouched()\` called on blur?
- [ ] Is form validation checked before submission?
- [ ] Are signals accessed correctly (\`.value\` vs \`.value.value\`)?

Provide clear explanations and working code fixes.`,
        },
      },
    ],
  };
}
