---
sidebar_position: 1
---

# Introduction to Behaviors

Adding interactivity and automation to the Credit Application form.

## What are Behaviors?

Behaviors automate common form interactions without manual subscriptions and imperative code. They provide a declarative way to:

- **Compute values** - Automatically calculate fields based on other fields
- **Control visibility** - Show/hide fields based on conditions
- **Control access** - Enable/disable fields dynamically
- **Synchronize data** - Copy values between fields
- **React to changes** - Perform side effects when fields change

## Why Use Behaviors?

Instead of writing imperative subscription code:

```tsx
// ❌ Imperative approach - manual subscriptions
function CreditApplicationForm() {
  const form = useMemo(() => createForm(...), []);

  useEffect(() => {
    // Manually subscribe to loanType changes
    const subscription = form.field('loanType').value.subscribe((value) => {
      // Show/hide mortgage fields
      if (value === 'mortgage') {
        form.field('propertyValue').setVisible(true);
        form.field('initialPayment').setVisible(true);
      } else {
        form.field('propertyValue').setVisible(false);
        form.field('initialPayment').setVisible(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [form]);

  // More subscriptions...
  // This quickly becomes unmanageable!
}
```

Use declarative behaviors:

```tsx
// ✅ Declarative approach - behaviors
export const creditApplicationBehaviors: BehaviorSchemaFn<CreditApplicationForm> = (path) => {
  // Show mortgage fields only when loanType === 'mortgage'
  showWhen(path.propertyValue, path.loanType, (value) => value === 'mortgage');
  showWhen(path.initialPayment, path.loanType, (value) => value === 'mortgage');
};
```

Benefits:
- **Less code** - No manual subscriptions or cleanup
- **Declarative** - Easier to understand intent
- **Maintainable** - Changes are localized
- **Type-safe** - Full TypeScript support
- **Testable** - Easy to test in isolation

## Behavior Types

ReFormer provides several built-in behavior functions:

### Computed Fields

Automatically calculate field values based on other fields:

```typescript
import { computeFrom } from 'reformer/behaviors';

// Calculate total income
computeFrom(
  [path.monthlyIncome, path.additionalIncome],
  path.totalIncome,
  (values) => {
    const main = values.monthlyIncome as number || 0;
    const additional = values.additionalIncome as number || 0;
    return main + additional;
  }
);
```

### Conditional Visibility

Show or hide fields based on conditions:

```typescript
import { showWhen, hideWhen } from 'reformer/behaviors';

// Show mortgage fields only for mortgage loans
showWhen(path.propertyValue, path.loanType, (value) => value === 'mortgage');

// Hide residence address when same as registration
hideWhen(path.residenceAddress, path.sameAsRegistration, (value) => value === true);
```

### Conditional Access

Enable or disable fields based on conditions:

```typescript
import { enableWhen, disableWhen } from 'reformer/behaviors';

// Disable residence address when same as registration
disableWhen(path.residenceAddress, path.sameAsRegistration, (value) => value === true);

// Disable computed fields (always read-only)
disableWhen(path.totalIncome, path.totalIncome, () => true);
```

### Data Synchronization

Copy or sync values between fields:

```typescript
import { copyTo, syncWith } from 'reformer/behaviors';

// Copy registration address to residence address
copyTo(
  path.registrationAddress,
  path.residenceAddress,
  path.sameAsRegistration,
  (shouldCopy) => shouldCopy === true
);
```

### Reactions & Side Effects

React to field changes with custom logic:

```typescript
import { watch } from 'reformer/behaviors';

// Clear mortgage fields when loan type changes
watch(path.loanType, (value, { form }) => {
  if (value !== 'mortgage') {
    form.field(path.propertyValue).setValue(null);
    form.field(path.initialPayment).setValue(null);
  }
});
```

### Revalidation

Trigger validation when related fields change:

```typescript
import { revalidateWhen } from 'reformer/behaviors';

// Revalidate monthly payment when income changes
revalidateWhen(path.monthlyPayment, [path.totalIncome]);
```

## Organizing Behaviors by Steps

For our Credit Application form, we'll organize behaviors by form steps - matching the structure we created in the Rendering section:

```typescript
// src/behaviors/credit-application.behaviors.ts
export const creditApplicationBehaviors: BehaviorSchemaFn<CreditApplicationForm> = (path) => {
  // Step 1: Loan Information
  step1LoanBehaviors(path);

  // Step 2: Personal Information
  step2PersonalBehaviors(path);

  // Step 3: Contact Information
  step3ContactBehaviors(path);

  // Step 4: Employment
  step4EmploymentBehaviors(path);

  // Step 5: Additional Information
  step5AdditionalBehaviors(path);

  // Cross-step behaviors
  crossStepBehaviors(path);
};
```

This organization provides:
- **Clarity** - Easy to find behaviors for a specific step
- **Maintainability** - Changes to one step don't affect others
- **Scalability** - Easy to add new behaviors
- **Reusability** - Step behaviors can be reused in other forms

## File Structure

We'll create the following structure:

```
src/
├── behaviors/
│   ├── steps/
│   │   ├── step-1-loan-info.behaviors.ts
│   │   ├── step-2-personal-info.behaviors.ts
│   │   ├── step-3-contact-info.behaviors.ts
│   │   ├── step-4-employment.behaviors.ts
│   │   └── step-5-additional-info.behaviors.ts
│   ├── cross-step.behaviors.ts
│   └── credit-application.behaviors.ts  (main file)
├── schemas/
│   └── create-form.ts  (behaviors registered here)
└── ...
```

## What We'll Build

By the end of this section, our Credit Application form will have:

### Step 1: Loan Information
- ✅ Auto-calculated interest rate (based on loan type, city, property)
- ✅ Auto-calculated monthly payment (annuity formula)
- ✅ Conditional mortgage/car fields (shown only when relevant)
- ✅ Automatic field reset (when loan type changes)

### Step 2: Personal Information
- ✅ Auto-generated full name (from first, last, middle names)
- ✅ Auto-calculated age (from birth date)
- ✅ Read-only computed fields

### Step 3: Contact Information
- ✅ Conditional residence address (hidden when same as registration)
- ✅ Automatic address copying (registration → residence)
- ✅ Disabled fields when not needed

### Step 4: Employment
- ✅ Conditional employment fields (shown based on status)
- ✅ Auto-calculated total income (main + additional)
- ✅ Automatic field reset (when status changes)

### Step 5: Additional Information
- ✅ Conditional arrays (properties, loans, co-borrowers)
- ✅ Auto-calculated co-borrowers income (sum of all)

### Cross-Step
- ✅ Payment-to-income ratio (uses data from multiple steps)
- ✅ Smart revalidation (triggers when dependencies change)
- ✅ Age-based access control (disables fields if age < 18)
- ✅ Analytics tracking (monitors user behavior)

## Getting Started

Let's start by adding behaviors to Step 1: Loan Information. This step demonstrates the most common behavior patterns you'll use throughout the form.

In the next section, we'll:
1. Create the behavior file for Step 1
2. Implement computed fields for interest rate and monthly payment
3. Add conditional visibility for mortgage/car fields
4. Implement automatic field reset
5. Test the behaviors in action

Ready? Let's begin!