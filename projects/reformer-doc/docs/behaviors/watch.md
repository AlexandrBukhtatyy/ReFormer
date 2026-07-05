---
sidebar_position: 5
---

# Watch Behaviors

React to field changes with custom logic.

## watchField

Execute callback when field value changes.

```typescript
import { defineFormBehavior, watchField } from '@reformer/core/behaviors';

const behavior = defineFormBehavior(({ model }) => {
  watchField(model.$.country, (country) => {
    console.log(`Country changed to ${country}`);
    // Load cities for new country
    loadCities(country);
  });
});
```

### Example: Dynamic Options

```typescript
import { createModel, createForm } from '@reformer/core';
import { defineFormBehavior, watchField } from '@reformer/core/behaviors';

interface CategoryForm {
  category: string;
  subcategory: string;
}

const model = createModel<CategoryForm>({ category: '', subcategory: '' });

const behavior = defineFormBehavior<CategoryForm>(({ model, form }) => {
  watchField(model.$.category, async (category) => {
    // Reset subcategory
    model.subcategory = '';

    // Fetch subcategories
    const options = await fetchSubcategories(category);
    form.subcategory.updateComponentProps({ options });
  });
});

// `schema` binds the fields to components (see Quick Start).
const form = createForm<CategoryForm>({ model, schema, behavior });
```

### Example: Analytics

```typescript
const behavior = defineFormBehavior(({ model }) => {
  watchField(model.$.step, (step) => {
    analytics.track('form_step_changed', { step });
  });
});
```

## revalidateWhen

Trigger field revalidation when another field changes. Under M1 validation is
on-demand, so the revalidate callback re-runs `validateFormModel(model, schema)`.

```typescript
import { defineFormBehavior, revalidateWhen } from '@reformer/core/behaviors';
import { validateFormModel } from '@reformer/core';

const behavior = defineFormBehavior(({ model }) => {
  // Revalidate the schema when password changes (confirmPassword rule re-checks)
  revalidateWhen([model.$.password], () => {
    void validateFormModel(model, schema);
  });
});
```

### Example: Date Range

```typescript
import { createModel, createForm } from '@reformer/core';
import type { ModelValidator } from '@reformer/core';
import { validateFormModel } from '@reformer/core';
import { defineFormBehavior, revalidateWhen } from '@reformer/core/behaviors';
import { Input } from '@reformer/ui-kit';

interface DateRangeForm {
  startDate: string;
  endDate: string;
}

const model = createModel<DateRangeForm>({ startDate: '', endDate: '' });

// Cross-field rule: endDate must not be before startDate (reads root)
const endAfterStart: ModelValidator<string, unknown, DateRangeForm> = (value, _schema, root) =>
  root.startDate && value && value < root.startDate
    ? { code: 'endBeforeStart', message: 'End date is before start date' }
    : null;

const schema = {
  startDate: { value: model.$.startDate, component: Input },
  endDate: { value: model.$.endDate, component: Input, validators: [endAfterStart] },
};

const behavior = defineFormBehavior<DateRangeForm>(({ model }) => {
  // Revalidate endDate when startDate changes
  revalidateWhen([model.$.startDate], () => {
    void validateFormModel(model, schema);
  });
});

const form = createForm<DateRangeForm>({ model, schema, behavior });
```

### Example: Cross-Field Validation

```typescript
const behavior = defineFormBehavior(({ model }) => {
  // Password strength depends on username (can't contain it)
  revalidateWhen([model.$.username], () => void validateFormModel(model, schema));

  // Confirm password must match password
  revalidateWhen([model.$.password], () => void validateFormModel(model, schema));
});
```

## Multiple Watchers

Watch multiple fields:

```typescript
const behavior = defineFormBehavior(({ model }) => {
  // Called when either changes
  watchField(model.$.firstName, () => updateDisplayName());
  watchField(model.$.lastName, () => updateDisplayName());
});
```

## Debounced Watch

Prevent too frequent updates with `onChange` (debounce + AbortSignal):

```typescript
import { defineFormBehavior, onChange } from '@reformer/core/behaviors';

const behavior = defineFormBehavior(({ model }) => {
  onChange(
    model.$.searchQuery,
    async (query, { signal }) => {
      const results = await search(query, { signal });
      setSearchResults(results);
    },
    { debounce: 300 }
  );
});
```

## Watch with Cleanup

Clean up on the next change via the abort signal:

```typescript
import { defineFormBehavior, onChange } from '@reformer/core/behaviors';

const behavior = defineFormBehavior(({ model }) => {
  onChange(model.$.livePreview, (enabled, { signal }) => {
    if (enabled) {
      const interval = setInterval(refreshPreview, 1000);
      // signal aborts on the next change — clean up the interval
      signal.addEventListener('abort', () => clearInterval(interval));
    }
  });
});
```

## Combining Watch with Other Behaviors

```typescript
import {
  defineFormBehavior,
  enableWhen,
  watchField,
  revalidateWhen,
} from '@reformer/core/behaviors';
import { validateFormModel } from '@reformer/core';

const behavior = defineFormBehavior(({ model }) => {
  // Show premium fields
  enableWhen(model.$.premiumOptions, () => model.plan === 'premium');

  // Track plan changes
  watchField(model.$.plan, (plan) => {
    analytics.track('plan_selected', { plan });
  });

  // Revalidate dependent fields
  revalidateWhen([model.$.plan], () => void validateFormModel(model, schema));
});
```

## Next Steps

- [Validation](/docs/validation/overview) — Combine with validation
- [React Integration](/docs/react/hooks) — Use in React components
