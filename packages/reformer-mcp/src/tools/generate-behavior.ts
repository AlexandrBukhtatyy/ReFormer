export const generateBehaviorToolDefinition = {
  name: 'generate_behavior',
  description:
    'Get template and rules for generating BehaviorSchemaFn for ReFormer forms. Provides computed fields, conditional fields, field watching, and sync behaviors.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      behaviorType: {
        type: 'string',
        description: 'Type of behavior needed (e.g., "computed", "conditional", "watch", "sync")',
      },
    },
    required: [],
  },
};

const BUILT_IN_BEHAVIORS = [
  {
    name: 'computeFrom',
    usage: 'computeFrom([path.a, path.b], path.result, ({ a, b }) => a + b)',
    description: 'Compute field from other fields (same level only!)',
  },
  {
    name: 'watchField',
    usage: 'watchField(path.field, (value, ctx) => { ... })',
    description: 'React to field changes (use for cross-level computation)',
  },
  {
    name: 'enableWhen',
    usage: 'enableWhen(path.field, (form) => condition)',
    description: 'Enable field conditionally',
  },
  {
    name: 'disableWhen',
    usage: 'disableWhen(path.field, (form) => condition)',
    description: 'Disable field conditionally',
  },
  {
    name: 'copyFrom',
    usage: 'copyFrom(path.source, path.target)',
    description: 'Copy value from one field to another',
  },
  {
    name: 'syncFields',
    usage: 'syncFields(path.a, path.b)',
    description: 'Keep two fields in sync',
  },
  {
    name: 'resetWhen',
    usage: 'resetWhen(path.field, (form) => condition)',
    description: 'Reset field when condition is met',
  },
];

const RULES = [
  {
    rule: 'Import behaviors from @reformer/core/behaviors',
    wrong: "import { computeFrom } from '@reformer/core';",
    correct: "import { computeFrom, watchField, enableWhen } from '@reformer/core/behaviors';",
    reason: 'Behaviors are in a separate subpath for tree-shaking.',
  },
  {
    rule: 'computeFrom only works for same nesting level',
    wrong: 'computeFrom([path.nested.field], path.rootField, ...)',
    correct:
      'Use watchField for cross-level: watchField(path.nested.field, (_, ctx) => ctx.setFieldValue("rootField", ...))',
    reason: 'computeFrom has TypeScript limitation - source and target must be at same level.',
  },
  {
    rule: 'Never nest watchField calls',
    wrong: 'watchField(path.a, () => { watchField(path.b, ...) })',
    correct: 'Create separate watchField calls at the top level',
    reason: 'Nested watchField creates memory leaks and duplicate subscriptions.',
  },
  {
    rule: 'Use ctx.setFieldValue for side effects in watchField',
    wrong: 'watchField(path.a, (_, ctx) => { ctx.form.b.setValue(...) })',
    correct: 'watchField(path.a, (_, ctx) => { ctx.setFieldValue("b", newValue) })',
    reason: 'setFieldValue is the safe way to update fields from behaviors.',
  },
  {
    rule: 'enableWhen with resetOnDisable for clean UX',
    wrong: 'enableWhen(path.field, condition)',
    correct: 'enableWhen(path.field, condition, { resetOnDisable: true })',
    reason: 'Resetting disabled fields prevents stale data in hidden fields.',
  },
];

const EXAMPLES = {
  computed: `import type { BehaviorSchemaFn } from '@reformer/core';
import { computeFrom } from '@reformer/core/behaviors';
import type { OrderForm } from './type';

export const orderBehavior: BehaviorSchemaFn<OrderForm> = (path) => {
  // Compute subtotal from price and quantity
  computeFrom(
    [path.price, path.quantity],
    path.subtotal,
    ({ price, quantity }) => (price || 0) * (quantity || 1)
  );

  // Compute tax (10%)
  computeFrom(
    [path.subtotal],
    path.tax,
    ({ subtotal }) => (subtotal || 0) * 0.1
  );

  // Compute total
  computeFrom(
    [path.subtotal, path.tax, path.discount],
    path.total,
    ({ subtotal, tax, discount }) => {
      const sub = subtotal || 0;
      const t = tax || 0;
      const d = discount || 0;
      return sub + t - d;
    }
  );
};`,

  computedNested: `import type { BehaviorSchemaFn, WatchContext } from '@reformer/core';
import { watchField } from '@reformer/core/behaviors';
import type { RegistrationForm } from './type';

export const registrationBehavior: BehaviorSchemaFn<RegistrationForm> = (path) => {
  // ⚠️ computeFrom does NOT work for cross-level fields!
  // Use watchField instead

  // Helper function to update fullName
  const updateFullName = (ctx: WatchContext<RegistrationForm>) => {
    const firstName = ctx.form.personalData.firstName.value.value || '';
    const lastName = ctx.form.personalData.lastName.value.value || '';
    ctx.setFieldValue('fullName', \`\${firstName} \${lastName}\`.trim());
  };

  // Watch each source field separately
  watchField(path.personalData.firstName, (_, ctx) => updateFullName(ctx));
  watchField(path.personalData.lastName, (_, ctx) => updateFullName(ctx));

  // Another example: compute age from birthDate
  watchField(path.personalData.birthDate, (birthDate, ctx) => {
    if (!birthDate) {
      ctx.setFieldValue('age', null);
      return;
    }
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    ctx.setFieldValue('age', age);
  });
};`,

  conditional: `import type { BehaviorSchemaFn } from '@reformer/core';
import { enableWhen, disableWhen } from '@reformer/core/behaviors';
import type { ApplicationForm } from './type';

export const applicationBehavior: BehaviorSchemaFn<ApplicationForm> = (path) => {
  // Show mortgage fields only for mortgage type
  enableWhen(
    path.mortgageDetails,
    (form) => form.loanType === 'mortgage',
    { resetOnDisable: true }  // Clear values when hidden
  );

  // Show car fields only for car loan
  enableWhen(
    path.carDetails,
    (form) => form.loanType === 'car',
    { resetOnDisable: true }
  );

  // Show "other" text field when reason is "other"
  enableWhen(
    path.otherReason,
    (form) => form.reason === 'other',
    { resetOnDisable: true }
  );

  // Disable submit until terms accepted
  disableWhen(
    path.submitButton,
    (form) => !form.agreeTerms
  );

  // Enable spouse info only for married
  enableWhen(
    path.spouseInfo,
    (form) => form.maritalStatus === 'married',
    { resetOnDisable: true }
  );
};`,

  watch: `import type { BehaviorSchemaFn } from '@reformer/core';
import { watchField } from '@reformer/core/behaviors';
import type { CheckoutForm } from './type';

export const checkoutBehavior: BehaviorSchemaFn<CheckoutForm> = (path) => {
  // Copy billing address to shipping when checkbox is checked
  watchField(path.sameAsBilling, (sameAsBilling, ctx) => {
    if (sameAsBilling) {
      const billing = ctx.form.billingAddress.value.value;
      ctx.setFieldValue('shippingAddress.street', billing.street);
      ctx.setFieldValue('shippingAddress.city', billing.city);
      ctx.setFieldValue('shippingAddress.zip', billing.zip);
    }
  });

  // Also update shipping when billing changes (if sameAsBilling is true)
  watchField(path.billingAddress.street, (street, ctx) => {
    if (ctx.form.sameAsBilling.value.value) {
      ctx.setFieldValue('shippingAddress.street', street);
    }
  });

  watchField(path.billingAddress.city, (city, ctx) => {
    if (ctx.form.sameAsBilling.value.value) {
      ctx.setFieldValue('shippingAddress.city', city);
    }
  });

  // Clear password confirmation when password changes
  watchField(path.password, (_, ctx) => {
    const confirmValue = ctx.form.confirmPassword.value.value;
    if (confirmValue) {
      ctx.form.confirmPassword.setValue('', { emitEvent: false });
    }
  });

  // Auto-format phone number
  watchField(path.phone, (phone, ctx) => {
    if (!phone) return;
    // Remove non-digits
    const digits = phone.replace(/\\D/g, '');
    // Format as (XXX) XXX-XXXX
    if (digits.length === 10) {
      const formatted = \`(\${digits.slice(0,3)}) \${digits.slice(3,6)}-\${digits.slice(6)}\`;
      if (formatted !== phone) {
        ctx.setFieldValue('phone', formatted);
      }
    }
  });
};`,

  sync: `import type { BehaviorSchemaFn } from '@reformer/core';
import { copyFrom, syncFields, enableWhen, watchField } from '@reformer/core/behaviors';
import type { ProfileForm } from './type';

export const profileBehavior: BehaviorSchemaFn<ProfileForm> = (path) => {
  // One-way copy: displayName defaults to username
  copyFrom(path.username, path.displayName);

  // Two-way sync: keep email and contactEmail in sync
  syncFields(path.email, path.contactEmail);

  // Enable duplicate email checkbox
  enableWhen(
    path.sameEmail,
    (form) => !!form.email
  );

  // When sameEmail is checked, copy email to alternateEmail
  watchField(path.sameEmail, (sameEmail, ctx) => {
    if (sameEmail) {
      const email = ctx.form.email.value.value;
      ctx.setFieldValue('alternateEmail', email);
    }
  });
};`,

  complex: `import type { BehaviorSchemaFn, WatchContext } from '@reformer/core';
import { computeFrom, watchField, enableWhen } from '@reformer/core/behaviors';
import type { LoanApplicationForm } from './type';

export const loanApplicationBehavior: BehaviorSchemaFn<LoanApplicationForm> = (path) => {
  // ========== Conditional Fields ==========

  // Mortgage-specific fields
  enableWhen(path.propertyValue, (form) => form.loanType === 'mortgage', { resetOnDisable: true });
  enableWhen(path.downPayment, (form) => form.loanType === 'mortgage', { resetOnDisable: true });

  // Car-specific fields
  enableWhen(path.carBrand, (form) => form.loanType === 'car', { resetOnDisable: true });
  enableWhen(path.carModel, (form) => form.loanType === 'car', { resetOnDisable: true });

  // Employment fields
  enableWhen(path.companyName, (form) => form.isEmployed, { resetOnDisable: true });
  enableWhen(path.position, (form) => form.isEmployed, { resetOnDisable: true });

  // ========== Same-Level Computed Fields ==========

  // Total income (same level)
  computeFrom(
    [path.monthlyIncome, path.additionalIncome],
    path.totalIncome,
    ({ monthlyIncome, additionalIncome }) =>
      (monthlyIncome || 0) + (additionalIncome || 0)
  );

  // ========== Cross-Level Computed Fields ==========

  // Interest rate based on loan type (cross-level: loanType -> interestRate)
  watchField(path.loanType, (loanType, ctx) => {
    const rates: Record<string, number> = {
      consumer: 15.5,
      mortgage: 9.5,
      car: 12.0,
    };
    ctx.setFieldValue('interestRate', rates[loanType] || 15.5);
  });

  // Monthly payment calculation
  const calculateMonthlyPayment = (ctx: WatchContext<LoanApplicationForm>) => {
    const amount = ctx.form.loanAmount.value.value || 0;
    const term = ctx.form.loanTerm.value.value || 12;
    const rate = ctx.form.interestRate.value.value || 15;

    if (amount <= 0 || term <= 0) {
      ctx.setFieldValue('monthlyPayment', 0);
      return;
    }

    const monthlyRate = rate / 100 / 12;
    const payment = (amount * monthlyRate * Math.pow(1 + monthlyRate, term)) /
                   (Math.pow(1 + monthlyRate, term) - 1);

    ctx.setFieldValue('monthlyPayment', Math.round(payment));
  };

  watchField(path.loanAmount, (_, ctx) => calculateMonthlyPayment(ctx));
  watchField(path.loanTerm, (_, ctx) => calculateMonthlyPayment(ctx));
  watchField(path.interestRate, (_, ctx) => calculateMonthlyPayment(ctx));

  // Full name from nested personalData
  const updateFullName = (ctx: WatchContext<LoanApplicationForm>) => {
    const first = ctx.form.personalData.firstName.value.value || '';
    const last = ctx.form.personalData.lastName.value.value || '';
    ctx.setFieldValue('fullName', \`\${first} \${last}\`.trim());
  };

  watchField(path.personalData.firstName, (_, ctx) => updateFullName(ctx));
  watchField(path.personalData.lastName, (_, ctx) => updateFullName(ctx));

  // ========== Address Copy ==========

  watchField(path.sameAsRegistration, (same, ctx) => {
    if (same) {
      const reg = ctx.form.registrationAddress;
      ctx.setFieldValue('residenceAddress.street', reg.street.value.value);
      ctx.setFieldValue('residenceAddress.city', reg.city.value.value);
      ctx.setFieldValue('residenceAddress.zip', reg.zip.value.value);
    }
  });
};`,
};

export async function generateBehaviorTool(args: {
  behaviorType?: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  let response = `# Generate BehaviorSchemaFn for ReFormer\n\n`;

  // Template
  response += `## Template\n\n`;
  response += `\`\`\`typescript
import type { BehaviorSchemaFn, WatchContext } from '@reformer/core';
import { computeFrom, watchField, enableWhen, disableWhen, copyFrom, syncFields } from '@reformer/core/behaviors';
import type { MyForm } from './type';

export const myFormBehavior: BehaviorSchemaFn<MyForm> = (path) => {
  // Computed field (same level only!)
  computeFrom(
    [path.price, path.quantity],
    path.total,
    ({ price, quantity }) => (price || 0) * (quantity || 1)
  );

  // Cross-level computed (use watchField)
  watchField(path.nested.field, (value, ctx) => {
    ctx.setFieldValue('rootField', computedValue);
  });

  // Conditional field
  enableWhen(
    path.conditionalField,
    (form) => form.showField === true,
    { resetOnDisable: true }
  );

  // Watch and react
  watchField(path.sourceField, (value, ctx) => {
    // Do something when field changes
  });
};
\`\`\`\n\n`;

  // Built-in behaviors table
  response += `## Built-in Behaviors\n\n`;
  response += `| Behavior | Usage | Description |\n`;
  response += `|----------|-------|-------------|\n`;
  for (const b of BUILT_IN_BEHAVIORS) {
    response += `| \`${b.name}\` | \`${b.usage}\` | ${b.description} |\n`;
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

  // Examples based on type
  response += `## Examples\n\n`;

  const type = args.behaviorType?.toLowerCase();

  if (!type || type === 'computed') {
    response += `### Computed Fields (Same Level)\n\n\`\`\`typescript\n${EXAMPLES.computed}\n\`\`\`\n\n`;
  }

  if (!type || type === 'computed-nested' || type === 'nested') {
    response += `### Computed Fields (Cross-Level with watchField)\n\n\`\`\`typescript\n${EXAMPLES.computedNested}\n\`\`\`\n\n`;
  }

  if (!type || type === 'conditional') {
    response += `### Conditional Fields (enableWhen/disableWhen)\n\n\`\`\`typescript\n${EXAMPLES.conditional}\n\`\`\`\n\n`;
  }

  if (!type || type === 'watch') {
    response += `### Watch and React (watchField)\n\n\`\`\`typescript\n${EXAMPLES.watch}\n\`\`\`\n\n`;
  }

  if (!type || type === 'sync') {
    response += `### Sync and Copy Fields\n\n\`\`\`typescript\n${EXAMPLES.sync}\n\`\`\`\n\n`;
  }

  if (!type || type === 'complex') {
    response += `### Complex Form Behaviors\n\n\`\`\`typescript\n${EXAMPLES.complex}\n\`\`\`\n\n`;
  }

  // Common mistakes
  response += `## Common Mistakes\n\n`;
  response += `\`\`\`typescript
// ❌ WRONG: computeFrom with cross-level paths
computeFrom([path.nested.field], path.rootField, ...);
// ✅ CORRECT: Use watchField for cross-level
watchField(path.nested.field, (_, ctx) => ctx.setFieldValue('rootField', ...));

// ❌ WRONG: Nested watchField (memory leak!)
watchField(path.a, () => {
  watchField(path.b, () => { ... });  // Creates new subscription every time!
});
// ✅ CORRECT: Separate top-level watchField calls
watchField(path.a, () => { ... });
watchField(path.b, () => { ... });

// ❌ WRONG: Direct setValue in watchField
watchField(path.a, (_, ctx) => {
  ctx.form.b.setValue(newValue);
});
// ✅ CORRECT: Use ctx.setFieldValue
watchField(path.a, (_, ctx) => {
  ctx.setFieldValue('b', newValue);
});

// ❌ WRONG: enableWhen without reset
enableWhen(path.field, condition);
// ✅ CORRECT: Reset hidden fields
enableWhen(path.field, condition, { resetOnDisable: true });
\`\`\`\n\n`;

  response += `## Decision Guide: computeFrom vs watchField\n\n`;
  response += `| Scenario | Use |\n`;
  response += `|----------|-----|\n`;
  response += `| Same nesting level | \`computeFrom\` |\n`;
  response += `| Cross-level (nested → root) | \`watchField\` |\n`;
  response += `| Cross-level (root → nested) | \`watchField\` |\n`;
  response += `| Side effects needed | \`watchField\` |\n`;
  response += `| Multiple sources, one target | \`computeFrom\` (same level) or multiple \`watchField\` |\n`;
  response += `\n`;

  response += `## Next Steps\n\n`;
  response += `After creating behaviors:\n`;
  response += `1. Use \`check_code\` to verify your code\n`;
  response += `2. Create the form with \`createForm({ form, validation, behavior })\`\n`;

  return {
    content: [{ type: 'text', text: response }],
  };
}
