export const checkCodeToolDefinition = {
  name: 'check_code',
  description:
    'Analyze ReFormer form code for quality issues. Returns a list of errors, warnings, and suggestions with explanations on how to fix them. Does NOT auto-fix - only provides diagnostics.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      code: {
        type: 'string',
        description: 'TypeScript code to analyze (form schema, validation, or behavior)',
      },
    },
    required: ['code'],
  },
};

interface Issue {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  fix: string;
  line?: number;
}

interface QualityReport {
  score: number;
  grade: string;
  issues: Issue[];
  summary: string;
}

// Quality rules
const rules = [
  // Import rules
  {
    pattern: /import\s+\{[^}]*\}\s+from\s+['"]@reformer\/core['"]/,
    antiPattern:
      /import\s+\{[^}]*(required|email|min|max|minLength|maxLength|pattern|validate|when|validateAsync)[^}]*\}\s+from\s+['"]@reformer\/core['"]/,
    check: (code: string) => {
      const match = code.match(/import\s+\{([^}]*)\}\s+from\s+['"]@reformer\/core['"]/g);
      if (!match) return null;
      const validators = [
        'required',
        'email',
        'min',
        'max',
        'minLength',
        'maxLength',
        'pattern',
        'validate',
        'when',
        'validateAsync',
        'validateTree',
      ];
      for (const m of match) {
        for (const v of validators) {
          if (m.includes(v)) {
            return {
              severity: 'error' as const,
              code: 'wrong-validator-import',
              message: `Validator "${v}" imported from wrong path`,
              fix: `Import validators from '@reformer/core/validators', not '@reformer/core'\n\nChange:\nimport { ${v}, ... } from '@reformer/core';\n\nTo:\nimport { ${v}, ... } from '@reformer/core/validators';`,
            };
          }
        }
      }
      return null;
    },
  },
  {
    check: (code: string) => {
      const match = code.match(/import\s+\{([^}]*)\}\s+from\s+['"]@reformer\/core['"]/g);
      if (!match) return null;
      const behaviors = [
        'computeFrom',
        'watchField',
        'enableWhen',
        'disableWhen',
        'copyFrom',
        'syncFields',
        'resetWhen',
      ];
      for (const m of match) {
        for (const b of behaviors) {
          if (m.includes(b)) {
            return {
              severity: 'error' as const,
              code: 'wrong-behavior-import',
              message: `Behavior "${b}" imported from wrong path`,
              fix: `Import behaviors from '@reformer/core/behaviors', not '@reformer/core'\n\nChange:\nimport { ${b}, ... } from '@reformer/core';\n\nTo:\nimport { ${b}, ... } from '@reformer/core/behaviors';`,
            };
          }
        }
      }
      return null;
    },
  },

  // Type rules
  {
    check: (code: string) => {
      if (/:\s*(string|number|boolean|Date)\s*\|\s*null/.test(code)) {
        return {
          severity: 'error' as const,
          code: 'null-instead-of-undefined',
          message: 'Using `| null` in type definition',
          fix: `ReFormer uses undefined for empty values, not null.\n\nChange:\nfieldName: string | null;\n\nTo:\nfieldName: string | undefined;\n// Or simply:\nfieldName?: string;`,
        };
      }
      return null;
    },
  },
  {
    check: (code: string) => {
      if (/\[key:\s*string\]:\s*(unknown|any)/.test(code)) {
        return {
          severity: 'error' as const,
          code: 'index-signature',
          message: 'Index signature breaks TypeScript inference',
          fix: `Remove [key: string]: unknown from your interface.\n\nThis breaks ReFormer's field path inference. Define each field explicitly instead.`,
        };
      }
      return null;
    },
  },

  // Schema rules
  {
    check: (code: string) => {
      // Check for field config without value
      const matches = code.match(/\w+:\s*\{[^}]+\}/g);
      if (matches) {
        for (const m of matches) {
          if (m.includes('component:') && !m.includes('value:') && !m.includes('value :')) {
            return {
              severity: 'error' as const,
              code: 'missing-value',
              message: 'Field config missing `value` property',
              fix: `Every field in FormSchema must have a 'value' property.\n\nChange:\nfieldName: {\n  component: Input,\n  componentProps: { ... }\n}\n\nTo:\nfieldName: {\n  value: '',  // or null for numbers\n  component: Input,\n  componentProps: { ... }\n}`,
            };
          }
        }
      }
      return null;
    },
  },
  {
    check: (code: string) => {
      // Check for value: 0 on numeric fields (might be intentional but often wrong)
      if (/value:\s*0\s*,\s*component:\s*Input/.test(code) && /type:\s*['"]number['"]/.test(code)) {
        return {
          severity: 'warning' as const,
          code: 'zero-initial-value',
          message: 'Initial value 0 for numeric field - is this intentional?',
          fix: `If 0 is a valid "empty" state, this is fine.\nIf you want the field to be truly empty initially, use null instead:\n\nvalue: null,`,
        };
      }
      return null;
    },
  },

  // Validation rules
  {
    check: (code: string) => {
      // Check for string argument instead of options object
      if (/required\(\s*path\.\w+\s*,\s*['"][^'"]+['"]\s*\)/.test(code)) {
        return {
          severity: 'error' as const,
          code: 'string-instead-of-options',
          message: 'Passing string to validator instead of options object',
          fix: `Validators expect an options object, not a string.\n\nChange:\nrequired(path.field, 'Field is required');\n\nTo:\nrequired(path.field, { message: 'Field is required' });`,
        };
      }
      return null;
    },
  },
  {
    check: (code: string) => {
      // Check for validate() without null return
      const validateCalls = code.match(/validate\([^)]+,\s*\([^)]*\)\s*=>\s*\{[^}]+\}/g);
      if (validateCalls) {
        for (const call of validateCalls) {
          if (!call.includes('return null') && !call.includes('return;')) {
            return {
              severity: 'warning' as const,
              code: 'missing-null-return',
              message: 'Custom validator might be missing `return null`',
              fix: `Custom validators must return null when validation passes.\n\nvalidate(path.field, (value) => {\n  if (badCondition) {\n    return { code: 'error', message: '...' };\n  }\n  return null;  // <-- Don't forget this!\n});`,
            };
          }
        }
      }
      return null;
    },
  },

  // Behavior rules
  {
    check: (code: string) => {
      // Check for computeFrom with cross-level paths (heuristic)
      const computeFromCalls = code.match(/computeFrom\(\s*\[[^\]]+\]\s*,\s*path\.[^,]+,/g);
      if (computeFromCalls) {
        for (const call of computeFromCalls) {
          // Count dots in source vs target
          const sources = call.match(/path\.\w+(\.\w+)*/g) || [];
          const hasDifferentLevels = sources.some((s, i, arr) => {
            const level = (s.match(/\./g) || []).length;
            return arr.some((other) => (other.match(/\./g) || []).length !== level);
          });
          if (hasDifferentLevels) {
            return {
              severity: 'error' as const,
              code: 'cross-level-computeFrom',
              message: 'computeFrom with paths at different nesting levels',
              fix: `computeFrom only works when all paths are at the same nesting level.\n\nFor cross-level computation, use watchField instead:\n\n// Instead of:\ncomputeFrom([path.nested.field], path.rootField, ...);\n\n// Use:\nwatchField(path.nested.field, (value, ctx) => {\n  ctx.setFieldValue('rootField', computedValue);\n});`,
            };
          }
        }
      }
      return null;
    },
  },
  {
    check: (code: string) => {
      // Check for nested watchField (memory leak)
      if (/watchField\([^)]+,\s*\([^)]*\)\s*=>\s*\{[^}]*watchField\(/.test(code)) {
        return {
          severity: 'error' as const,
          code: 'nested-watchField',
          message: 'Nested watchField causes memory leak',
          fix: `Never nest watchField calls - this creates a new subscription every time the outer field changes!\n\n// BAD:\nwatchField(path.a, () => {\n  watchField(path.b, () => { ... });  // Memory leak!\n});\n\n// GOOD:\nwatchField(path.a, () => { ... });\nwatchField(path.b, () => { ... });`,
        };
      }
      return null;
    },
  },
  {
    check: (code: string) => {
      // Check for enableWhen without resetOnDisable
      if (/enableWhen\([^)]+\)/.test(code) && !/resetOnDisable/.test(code)) {
        return {
          severity: 'info' as const,
          code: 'enableWhen-no-reset',
          message: 'enableWhen without resetOnDisable option',
          fix: `Consider using { resetOnDisable: true } to clear field values when hidden.\n\nenableWhen(\n  path.conditionalField,\n  (form) => form.showField === true,\n  { resetOnDisable: true }  // Clears value when field is hidden\n);`,
        };
      }
      return null;
    },
  },
  {
    check: (code: string) => {
      // Check for direct setValue in watchField instead of setFieldValue
      if (
        /watchField\([^)]+,\s*\([^)]*ctx[^)]*\)\s*=>\s*\{[^}]*ctx\.form\.\w+\.setValue\(/.test(code)
      ) {
        return {
          severity: 'warning' as const,
          code: 'direct-setValue-in-watch',
          message: 'Using ctx.form.field.setValue() instead of ctx.setFieldValue()',
          fix: `In watchField callbacks, prefer ctx.setFieldValue() for consistency:\n\n// Instead of:\nwatchField(path.a, (_, ctx) => {\n  ctx.form.b.setValue(newValue);\n});\n\n// Use:\nwatchField(path.a, (_, ctx) => {\n  ctx.setFieldValue('b', newValue);\n});`,
        };
      }
      return null;
    },
  },

  // General code quality
  {
    check: (code: string) => {
      if (/:\s*any\b/.test(code)) {
        return {
          severity: 'warning' as const,
          code: 'any-type',
          message: 'Using `any` type - consider using specific type',
          fix: `Avoid using 'any' - it disables TypeScript checking.\n\nUse specific types or 'unknown' with type guards instead.`,
        };
      }
      return null;
    },
  },

  // createForm API misuse
  {
    check: (code: string) => {
      if (/form(?:Instance)?\.controls\b/.test(code)) {
        return {
          severity: 'error' as const,
          code: 'createForm-controls',
          message: 'Using .controls on createForm result - this returns undefined',
          fix: `createForm() returns GroupNodeWithControls<T> directly (a Proxy), NOT an object with .controls property.\n\nChange:\nconst form = createForm<MyForm>({...});\n<MyComponent control={form.controls} />  // undefined!\n\nTo:\nconst form = createForm<MyForm>({...});\n<MyComponent control={form} />  // Correct`,
        };
      }
      return null;
    },
  },

  // useFormControlValue requirement for reactive rendering
  {
    check: (code: string) => {
      // Check for direct .value access in JSX-like context
      if (
        /\{.*control\.\w+\.value\s*===/.test(code) ||
        /\{.*control\.\w+\.value\s*!==/.test(code)
      ) {
        return {
          severity: 'error' as const,
          code: 'missing-useFormControlValue',
          message: 'Reading control.field.value directly in JSX - not reactive',
          fix: `Use useFormControlValue hook for reactive rendering in React:\n\n// Wrong (not reactive):\n{control.loanType.value === 'mortgage' && <Fields />}\n\n// Correct:\nimport { useFormControlValue } from "@reformer/core";\nconst loanType = useFormControlValue(control.loanType);\n{loanType === 'mortgage' && <Fields />}`,
        };
      }
      return null;
    },
  },

  // Double .value.value in ValidationContext (WRONG)
  {
    check: (code: string) => {
      // Look for ValidationSchemaFn context and double .value.value
      if (/ValidationSchemaFn|validation.*=.*\(path\)/.test(code)) {
        if (/ctx\.form\.\w+\.value\.value/.test(code)) {
          return {
            severity: 'error' as const,
            code: 'double-value-in-validation',
            message: 'Using double .value.value in ValidationContext - should be single .value',
            fix: `In ValidationContext, use single .value to access field values:\n\n// Wrong:\nconst val = ctx.form.fieldName.value.value;\n\n// Correct:\nconst val = ctx.form.fieldName.value;`,
          };
        }
      }
      return null;
    },
  },

  // Single .value in BehaviorContext (WRONG - should be double)
  {
    check: (code: string) => {
      // Look for BehaviorSchemaFn context and single .value (not followed by another .value)
      if (/BehaviorSchemaFn|behavior.*=.*\(path\)|watchField/.test(code)) {
        // Match ctx.form.field.value that is NOT followed by .value
        const matches = code.match(/ctx\.form\.\w+(?:\.\w+)*\.value(?!\s*\.value)/g);
        if (matches) {
          // Filter out false positives (like ctx.form.field.value.value which would match partially)
          const problematic = matches.filter((m) => {
            const idx = code.indexOf(m);
            const nextChar = code[idx + m.length];
            return nextChar !== '.';
          });
          if (problematic.length > 0) {
            return {
              severity: 'error' as const,
              code: 'single-value-in-behavior',
              message: 'Using single .value in BehaviorContext - should be double .value.value',
              fix: `In BehaviorContext (watchField callbacks), use double .value.value:\n\n// Wrong (returns Signal object):\nconst val = ctx.form.fieldName.value;\n\n// Correct (returns actual value):\nconst val = ctx.form.fieldName.value.value;\n\nNOTE: This is DIFFERENT from ValidationContext which uses single .value!`,
            };
          }
        }
      }
      return null;
    },
  },

  // Incomplete Russian document masks
  {
    check: (code: string) => {
      // INN mask checks
      const innMatch = code.match(/inn[^:]*:\s*\{[^}]*mask:\s*['"](\d+)['"]/i);
      if (innMatch) {
        const digits = innMatch[1].replace(/9/g, '').length === 0 ? innMatch[1].length : 0;
        if (digits > 0 && digits !== 10 && digits !== 12) {
          return {
            severity: 'error' as const,
            code: 'invalid-inn-mask',
            message: `INN mask has ${digits} digits - should be 10 (company) or 12 (person)`,
            fix: `Russian INN masks:\n- Personal INN: "999999999999" (12 digits)\n- Company INN: "9999999999" (10 digits)`,
          };
        }
      }
      return null;
    },
  },
  {
    check: (code: string) => {
      // Phone mask checks - looking for incomplete phone masks
      const phoneMatch = code.match(
        /phone[^:]*:\s*\{[^}]*mask:\s*['"]\+7\s*\(\d+\)\s*\d+-\d+-(\d+)['"]/i
      );
      if (phoneMatch && phoneMatch[1].length < 2) {
        return {
          severity: 'error' as const,
          code: 'incomplete-phone-mask',
          message: 'Phone mask is incomplete - missing digits at the end',
          fix: `Russian phone mask should be:\nmask: "+7 (999) 999-99-99"\n\nNot:\nmask: "+7 (999) 999-99-9"  // Missing last digit!`,
        };
      }
      return null;
    },
  },
  {
    check: (code: string) => {
      // Postal code mask checks
      const postalMatch = code.match(/postal[^:]*:\s*\{[^}]*mask:\s*['"](\d+)['"]/i);
      if (postalMatch) {
        const digits = postalMatch[1].replace(/9/g, '').length === 0 ? postalMatch[1].length : 0;
        if (digits > 0 && digits !== 6) {
          return {
            severity: 'error' as const,
            code: 'invalid-postal-mask',
            message: `Postal code mask has ${digits} digits - should be 6 for Russia`,
            fix: `Russian postal code mask:\nmask: "999999"  // 6 digits\nplaceholder: "000000"`,
          };
        }
      }
      return null;
    },
  },
  {
    check: (code: string) => {
      // SMS code mask checks
      const smsMatch = code.match(
        /(?:sms|code|verification)[^:]*:\s*\{[^}]*mask:\s*['"](\d+)['"]/i
      );
      if (smsMatch) {
        const digits = smsMatch[1].replace(/9/g, '').length === 0 ? smsMatch[1].length : 0;
        if (digits > 0 && digits < 6) {
          return {
            severity: 'warning' as const,
            code: 'short-sms-mask',
            message: `SMS/verification code mask has ${digits} digits - typically 6`,
            fix: `Standard SMS verification code is usually 6 digits:\nmask: "999999"`,
          };
        }
      }
      return null;
    },
  },

  // Inconsistent rounding formulas
  {
    check: (code: string) => {
      // Look for rounding patterns that don't follow Math.round(x * 100) / 100
      if (
        /Math\.round\([^)]+\*\s*10\s*\)\s*\/\s*100/.test(code) ||
        /Math\.round\([^)]+\*\s*100\s*\)\s*\/\s*10(?!0)/.test(code)
      ) {
        return {
          severity: 'warning' as const,
          code: 'inconsistent-rounding',
          message: 'Inconsistent rounding formula detected',
          fix: `Use consistent rounding for percentages and decimals:\n\n// Wrong:\nMath.round(ratio * 10) / 100\nMath.round(ratio * 100) / 10\n\n// Correct (2 decimal places):\nMath.round(ratio * 100) / 100`,
        };
      }
      return null;
    },
  },
];

function analyzeCode(code: string): QualityReport {
  const issues: Issue[] = [];

  // Run all rules
  for (const rule of rules) {
    const issue = rule.check(code);
    if (issue) {
      issues.push(issue);
    }
  }

  // Calculate score
  let score = 100;
  for (const issue of issues) {
    switch (issue.severity) {
      case 'error':
        score -= 20;
        break;
      case 'warning':
        score -= 10;
        break;
      case 'info':
        score -= 2;
        break;
    }
  }
  score = Math.max(0, score);

  // Determine grade
  let grade: string;
  if (score >= 90) grade = 'A';
  else if (score >= 80) grade = 'B';
  else if (score >= 70) grade = 'C';
  else if (score >= 60) grade = 'D';
  else grade = 'F';

  // Generate summary
  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;
  const infoCount = issues.filter((i) => i.severity === 'info').length;

  let summary: string;
  if (issues.length === 0) {
    summary = 'No issues found. Code looks good!';
  } else {
    summary = `Found ${errorCount} error(s), ${warningCount} warning(s), ${infoCount} suggestion(s).`;
  }

  return { score, grade, issues, summary };
}

export async function checkCodeTool(args: {
  code: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const { code } = args;

  if (!code || code.trim().length === 0) {
    return {
      content: [
        {
          type: 'text',
          text: 'Please provide code to analyze.',
        },
      ],
    };
  }

  const report = analyzeCode(code);

  let response = `# Code Quality Report\n\n`;

  // Score and grade
  response += `## Score: ${report.score}/100 (Grade ${report.grade})\n\n`;
  response += `${report.summary}\n\n`;

  if (report.issues.length === 0) {
    response += `Your code follows ReFormer best practices.\n\n`;
    response += `## Checklist\n\n`;
    response += `- [x] Correct import paths\n`;
    response += `- [x] Type definitions\n`;
    response += `- [x] Schema structure\n`;
    response += `- [x] Validation patterns\n`;
    response += `- [x] Behavior patterns\n`;
  } else {
    // Group issues by severity
    const errors = report.issues.filter((i) => i.severity === 'error');
    const warnings = report.issues.filter((i) => i.severity === 'warning');
    const infos = report.issues.filter((i) => i.severity === 'info');

    if (errors.length > 0) {
      response += `## Errors (must fix)\n\n`;
      for (const issue of errors) {
        response += `### ${issue.message}\n\n`;
        response += `**Code:** \`${issue.code}\`\n\n`;
        response += `**How to fix:**\n\n\`\`\`typescript\n${issue.fix}\n\`\`\`\n\n`;
      }
    }

    if (warnings.length > 0) {
      response += `## Warnings (should fix)\n\n`;
      for (const issue of warnings) {
        response += `### ${issue.message}\n\n`;
        response += `**Code:** \`${issue.code}\`\n\n`;
        response += `**How to fix:**\n\n\`\`\`typescript\n${issue.fix}\n\`\`\`\n\n`;
      }
    }

    if (infos.length > 0) {
      response += `## Suggestions (nice to have)\n\n`;
      for (const issue of infos) {
        response += `### ${issue.message}\n\n`;
        response += `**Code:** \`${issue.code}\`\n\n`;
        response += `**Suggestion:**\n\n\`\`\`typescript\n${issue.fix}\n\`\`\`\n\n`;
      }
    }
  }

  response += `## Quality Rules Applied\n\n`;
  response += `- **Import paths**: Validators from \`/validators\`, behaviors from \`/behaviors\`\n`;
  response += `- **Types**: \`undefined\` not \`null\`, no index signatures\n`;
  response += `- **Schema**: Every field has \`value\` property\n`;
  response += `- **Validation**: Options object not string, return null for valid, single \`.value\`\n`;
  response += `- **Behaviors**: No nested watchField, double \`.value.value\` for field access\n`;
  response += `- **React**: Use \`useFormControlValue\` hook, no \`.controls\` on createForm result\n`;
  response += `- **Masks**: INN (10/12 digits), phone (10 digits), postal (6 digits)\n`;

  return {
    content: [{ type: 'text', text: response }],
  };
}
