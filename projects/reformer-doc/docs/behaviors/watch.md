---
sidebar_position: 5
---

# Watch Behaviors

React to field changes with custom logic.

## watchField

Execute callback when field value changes.

```typescript
import { watchField } from '@reformer/core/behaviors';

behaviors: (path, ctx) => [
  watchField(path.country, (newValue, oldValue) => {
    console.log(`Country changed from ${oldValue} to ${newValue}`);
    // Load cities for new country
    loadCities(newValue);
  }),
];
```

### Example: Dynamic Options

```typescript
const form = new GroupNode({
  form: {
    category: { value: '' },
    subcategory: { value: '' },
  },
  behaviors: (path, ctx) => [
    watchField(path.category, async (category) => {
      // Reset subcategory
      form.controls.subcategory.setValue('');

      // Fetch subcategories
      const options = await fetchSubcategories(category);
      setSubcategoryOptions(options);
    }),
  ],
});
```

### Example: Analytics

```typescript
behaviors: (path, ctx) => [
  watchField(path.step, (step) => {
    analytics.track('form_step_changed', { step });
  }),
];
```

## revalidateWhen

Trigger field revalidation when another field changes.

```typescript
import { revalidateWhen } from '@reformer/core/behaviors';

behaviors: (path, ctx) => [
  // Revalidate confirmPassword when password changes
  revalidateWhen(path.confirmPassword, [path.password]),
];
```

### Example: Date Range

```typescript
import { validate } from '@reformer/core/validators';

const form = new GroupNode({
  form: {
    startDate: { value: '' },
    endDate: { value: '' },
  },
  validation: (path) => {
    validate(path.endDate, (value, ctx) => {
      const start = ctx.root.controls.startDate.value;
      if (start && value && value < start) {
        return { endBeforeStart: true };
      }
      return null;
    });
  },
  behaviors: (path, ctx) => [
    // Revalidate endDate when startDate changes
    revalidateWhen(path.endDate, [path.startDate]),
  ],
});
```

### Example: Cross-Field Validation

```typescript
behaviors: (path, ctx) => [
  // Password strength depends on username (can't contain it)
  revalidateWhen(path.password, [path.username]),

  // Confirm password must match password
  revalidateWhen(path.confirmPassword, [path.password]),
];
```

## Multiple Watchers

Watch multiple fields:

```typescript
behaviors: (path, ctx) => [
  watchField([path.firstName, path.lastName], () => {
    // Called when either changes
    updateDisplayName();
  }),
];
```

## Debounced Watch

Prevent too frequent updates:

```typescript
behaviors: (path, ctx) => [
  watchField(
    path.searchQuery,
    async (query) => {
      const results = await search(query);
      setSearchResults(results);
    },
    { debounce: 300 }
  ),
];
```

## Watch with Cleanup

Return cleanup function:

```typescript
behaviors: (path, ctx) => [
  watchField(path.livePreview, (enabled) => {
    if (enabled) {
      const interval = setInterval(refreshPreview, 1000);
      return () => clearInterval(interval); // Cleanup
    }
  }),
];
```

## Combining Watch with Other Behaviors

```typescript
behaviors: (path, ctx) => [
  // Show premium fields
  enableWhen(path.premiumOptions, () => form.controls.plan.value === 'premium'),

  // Track plan changes
  watchField(path.plan, (plan) => {
    analytics.track('plan_selected', { plan });
  }),

  // Revalidate dependent fields
  revalidateWhen(path.features, [path.plan]),
];
```

## Next Steps

- [Validation](/docs/validation/overview) — Combine with validation
- [React Integration](/docs/react/hooks) — Use in React components
