---
sidebar_position: 1
---

# Introduction to Data Flow

Managing the complete lifecycle of form data from loading to saving.

## What is Data Flow?

Data Flow manages how data moves through your form's lifecycle:

- **Loading** - Loading initial data from API or storage
- **Auto-Save** - Automatically saving progress
- **Draft Management** - Creating, loading, and managing drafts
- **Reset/Clear** - Resetting form to initial or empty state
- **Prefill** - Pre-filling from external sources (user profile)
- **Transformation** - Converting data between formats

## Why Manage Data Flow?

Instead of manually handling every data operation:

```tsx
// ❌ Imperative approach - manual data management
function CreditApplicationForm() {
  const [form] = useState(() => createForm(...));

  // Loading data manually
  useEffect(() => {
    fetch('/api/application/123')
      .then(res => res.json())
      .then(data => {
        // Manually set each field
        form.field('loanAmount').setValue(data.loanAmount);
        form.field('loanTerm').setValue(data.loanTerm);
        form.field('loanType').setValue(data.loanType);
        // ... for every field
      });
  }, []);

  // Auto-save manually
  useEffect(() => {
    const interval = setInterval(() => {
      const data = {
        loanAmount: form.field('loanAmount').value.value,
        loanTerm: form.field('loanTerm').value.value,
        // ... extract every field
      };
      fetch('/api/save', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // This quickly becomes unmanageable!
}
```

Use built-in data flow mechanisms:

```tsx
// ✅ Declarative approach - structured data flow
function CreditApplicationForm({ applicationId }) {
  const form = useMemo(() => createCreditApplicationForm(), []);

  // Loading data
  useEffect(() => {
    if (applicationId) {
      loadApplication(applicationId).then((data) => {
        form.patchValue(data);
      });
    }
  }, [applicationId]);

  // Auto-save
  useAutoSave(form, {
    saveFn: (data) => saveDraft(data),
    debounce: 30000,
  });

  return <FormRenderer form={form} />;
}
```

Benefits:
- **Less Code** - No manual field-by-field operations
- **Type-Safe** - Full TypeScript support
- **Automatic** - Behaviors recalculate, validation re-runs
- **Efficient** - Only changed fields are updated
- **Reliable** - Handles edge cases automatically

## Data Flow Scenarios

Our credit application form has several real-world scenarios:

### 1. New Application
- Form starts empty
- User fills from scratch
- Auto-save preserves progress
- Can be saved as draft

### 2. Edit Draft
- Load saved draft
- User continues filling
- Auto-save updates draft
- Can submit when complete

### 3. Edit Submitted Application
- Load submitted application
- Some fields may be read-only
- Changes update the application
- Audit trail maintained

### 4. Prefill from Profile
- Load user's profile data
- Auto-fill personal details
- Auto-fill contact information
- User can modify any field

## What We'll Implement

By the end of this section, our form will have:

### Loading
- ✅ Load application from API
- ✅ Load draft from localStorage
- ✅ Handle loading states (loading, error, success)
- ✅ Priority: API > localStorage > default

### Auto-Save
- ✅ Save every 30 seconds automatically
- ✅ Save on page unload
- ✅ Show save status indicator
- ✅ Save to localStorage and/or API

### Draft Management
- ✅ Create new draft
- ✅ List all drafts
- ✅ Load specific draft
- ✅ Update current draft
- ✅ Delete draft

### Reset & Clear
- ✅ Reset to initial values
- ✅ Clear all data
- ✅ Reset specific step
- ✅ Confirmation dialogs

### Prefill
- ✅ Load from user profile
- ✅ Selective field prefill
- ✅ Smart merge (don't overwrite filled fields)
- ✅ Manual prefill trigger

### Transformation
- ✅ Serialize for API (Date → ISO string)
- ✅ Deserialize from API (ISO string → Date)
- ✅ Normalize data (trim, lowercase, format)
- ✅ Remove computed fields

## Form Data Lifecycle

Understanding the complete data flow:

```
┌─────────────────────────────────────────────────────────────┐
│                    Form Data Lifecycle                       │
└─────────────────────────────────────────────────────────────┘

1. LOAD
   ├─ API: Load submitted/draft application
   ├─ localStorage: Load saved draft
   ├─ Profile: Prefill from user data
   └─ Default: Empty form
                ↓
2. TRANSFORM (Deserialize)
   ├─ ISO strings → Date objects
   ├─ Format phone numbers for display
   └─ Prepare for form consumption
                ↓
3. PATCH FORM
   ├─ form.patchValue(data)
   ├─ Behaviors recalculate
   └─ Validation runs
                ↓
4. USER EDITS
   ├─ Field changes
   ├─ Behaviors react
   └─ Validation checks
                ↓
5. AUTO-SAVE
   ├─ Debounced (every 30s)
   ├─ Transform (Serialize)
   └─ Save to localStorage/API
                ↓
6. SUBMIT
   ├─ Validate all
   ├─ Transform (Serialize)
   └─ Send to API
```

## File Structure

We'll create this structure:

```
src/
├── services/
│   ├── api/
│   │   ├── application.api.ts       # Application CRUD operations
│   │   └── user-profile.api.ts      # User profile API
│   ├── storage/
│   │   └── draft.storage.ts         # localStorage for drafts
│   ├── auto-save.service.ts         # Auto-save service
│   └── data-transform.service.ts    # Data transformation
│
├── hooks/
│   ├── useAutoSave.ts               # Auto-save hook
│   ├── useDraftManager.ts           # Draft management hook
│   ├── useDataLoader.ts             # Data loading hook
│   ├── useFormReset.ts              # Reset/clear hook
│   └── useDataPrefill.ts            # Prefill hook
│
└── components/
    ├── CreditApplicationForm.tsx    # Main form with data flow
    ├── AutoSaveIndicator.tsx        # Save status UI
    ├── DraftSelector.tsx            # Draft list UI
    └── ControlPanel.tsx             # Form controls UI
```

## Core Concepts

### 1. patchValue vs setValue

```typescript
// patchValue - updates multiple fields at once
form.patchValue({
  loanAmount: 500000,
  loanTerm: 120,
  loanType: 'mortgage'
});

// setValue - updates single field
form.field('loanAmount').setValue(500000);
```

### 2. Observable Subscriptions

```typescript
// Subscribe to form value changes
const subscription = form.value.subscribe((value) => {
  console.log('Form changed:', value);
});

// Clean up
return () => subscription.unsubscribe();
```

### 3. Form State

```typescript
form.value.value      // Current form data
form.isDirty.value    // Has form been modified?
form.isValid.value    // Is form valid?
form.errors.value     // All validation errors
```

### 4. Transformers

```typescript
const transformer = {
  serialize: (formData) => apiData,      // Form → API
  deserialize: (apiData) => formData,    // API → Form
};
```

## Integration with Behaviors & Validation

Data flow works seamlessly with what we've already built:

### After Loading Data

```typescript
// Load data
form.patchValue(applicationData);

// Behaviors automatically:
// - Calculate interest rate
// - Calculate monthly payment
// - Show/hide conditional fields
// - Compute total income

// Validation automatically:
// - Checks all loaded values
// - Shows errors for invalid data
// - Re-validates on dependencies
```

### During Auto-Save

```typescript
// Get current form state
const data = form.value.value;

// Computed fields are included automatically
// - fullName (from firstName + lastName)
// - age (from birthDate)
// - totalIncome (from income + additionalIncome)

// We'll filter them out during transformation
```

## Getting Started

Let's start with **Loading Initial Data** - the foundation of data flow. This covers:
- Creating API services
- Loading application data
- Loading drafts from localStorage
- Handling loading states
- Choosing data source priority

In the next section, we'll:
1. Create API service for applications
2. Create hook for loading data
3. Integrate with form component
4. Handle loading, error, and success states
5. Test loading scenarios

Ready? Let's begin!
