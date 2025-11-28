---
sidebar_position: 6
---

# Data Prefill

Pre-filling form fields from external data sources like user profiles.

## What We're Building

A smart prefill system that:

- **Loads user profile** from API
- **Selectively prefills** specific fields
- **Smart merging** - doesn't overwrite filled fields
- **Configurable** - choose which fields to prefill
- **Manual trigger** - user controls prefill
- **Preview changes** - show what will be filled
- **Undo prefill** - revert if unwanted

## Why Prefill?

Prefilling improves user experience:

- **Saves time** - No re-typing known information
- **Reduces errors** - Accurate data from profile
- **Convenience** - One-click form population
- **Consistency** - Same data across applications

Example: Credit application can prefill:

- Personal data (name, birth date)
- Contact info (phone, email, address)
- Documents (passport, INN, SNILS)
- Employment (company, position)

## User Profile Data Structure

Define the profile interface:

```typescript title="src/types/user-profile.ts"
/**
 * User profile data
 */
export interface UserProfile {
  /** Personal information */
  personalData: {
    firstName: string;
    lastName: string;
    middleName?: string;
    birthDate: string; // ISO date string
    gender?: 'male' | 'female';
  };

  /** Contact information */
  contacts: {
    phone: string;
    email: string;
    registrationAddress: Address;
    residenceAddress?: Address;
  };

  /** Passport data */
  passport?: {
    series: string;
    number: string;
    issuedBy: string;
    issueDate: string;
    departmentCode: string;
    birthPlace: string;
  };

  /** Tax identification number */
  inn?: string;

  /** Insurance number */
  snils?: string;

  /** Employment information */
  employment?: {
    company: string;
    position: string;
    startDate: string;
    income: number;
  };
}

/**
 * Address structure
 */
export interface Address {
  postalCode: string;
  country: string;
  region: string;
  city: string;
  street: string;
  building: string;
  apartment?: string;
}
```

## Creating User Profile API Service

Create API service for loading user profile:

```bash
touch src/services/api/user-profile.api.ts
```

### Implementation

```typescript title="src/services/api/user-profile.api.ts"
import type { UserProfile } from '@/types/user-profile.types';

/**
 * API base URL for user profile
 */
const API_BASE = '/api/user/profile';

/**
 * Load user profile
 */
export async function loadUserProfile(): Promise<UserProfile> {
  const response = await fetch(API_BASE);

  if (!response.ok) {
    throw new Error(`Failed to load user profile: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Check if user has profile
 */
export async function hasUserProfile(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/exists`);
    const result = await response.json();
    return result.exists;
  } catch {
    return false;
  }
}

/**
 * Get profile completeness percentage
 */
export async function getProfileCompleteness(): Promise<number> {
  try {
    const response = await fetch(`${API_BASE}/completeness`);
    const result = await response.json();
    return result.percentage;
  } catch {
    return 0;
  }
}
```

## Creating the Prefill Service

Create a service to map profile data to form data:

```bash
touch src/services/data-prefill.service.ts
```

### Implementation

```typescript title="src/services/data-prefill.service.ts"
import type { UserProfile } from '@/types/user-profile.types';

/**
 * Prefill options
 */
export interface PrefillOptions {
  /** Specific fields to prefill (if not provided, prefill all) */
  fields?: string[];
  /** Overwrite existing values */
  overwrite?: boolean;
  /** Transform data before prefill */
  transform?: (data: any) => any;
}

/**
 * Prefill result
 */
export interface PrefillResult {
  /** Data to be prefilled */
  data: any;
  /** Fields that will be changed */
  changedFields: string[];
  /** Fields that were skipped (already filled) */
  skippedFields: string[];
}

/**
 * Map user profile to form data
 */
export function mapProfileToFormData(profile: UserProfile): any {
  return {
    // Personal data
    personalData: {
      firstName: profile.personalData.firstName,
      lastName: profile.personalData.lastName,
      middleName: profile.personalData.middleName,
      birthDate: new Date(profile.personalData.birthDate),
      gender: profile.personalData.gender,
    },

    // Contacts
    phoneMain: profile.contacts.phone,
    email: profile.contacts.email,

    // Registration address
    registrationAddress: profile.contacts.registrationAddress,

    // Residence address (if same as registration)
    residenceAddress: profile.contacts.residenceAddress || profile.contacts.registrationAddress,
    isSameAddress: !profile.contacts.residenceAddress,

    // Passport
    ...(profile.passport && {
      passportData: {
        series: profile.passport.series,
        number: profile.passport.number,
        issuedBy: profile.passport.issuedBy,
        issueDate: new Date(profile.passport.issueDate),
        departmentCode: profile.passport.departmentCode,
        birthPlace: profile.passport.birthPlace,
      },
    }),

    // INN
    ...(profile.inn && { inn: profile.inn }),

    // SNILS
    ...(profile.snils && { snils: profile.snils }),

    // Employment
    ...(profile.employment && {
      employment: {
        company: profile.employment.company,
        position: profile.employment.position,
        startDate: new Date(profile.employment.startDate),
        monthlyIncome: profile.employment.income,
      },
    }),
  };
}

/**
 * Calculate prefill result
 */
export function calculatePrefillResult(
  currentData: any,
  profileData: any,
  options: PrefillOptions = {}
): PrefillResult {
  const { fields, overwrite = false } = options;
  const result: PrefillResult = {
    data: {},
    changedFields: [],
    skippedFields: [],
  };

  // Filter fields to prefill
  const fieldsToProcess = fields || Object.keys(profileData);

  for (const field of fieldsToProcess) {
    const profileValue = profileData[field];
    const currentValue = currentData[field];

    // Skip if no profile value
    if (profileValue === undefined || profileValue === null) {
      continue;
    }

    // Check if field is already filled
    const isFieldFilled =
      currentValue !== undefined &&
      currentValue !== null &&
      currentValue !== '' &&
      (typeof currentValue !== 'object' || Object.keys(currentValue).length > 0);

    // Skip if field is filled and overwrite is false
    if (isFieldFilled && !overwrite) {
      result.skippedFields.push(field);
      continue;
    }

    // Add to prefill data
    result.data[field] = profileValue;
    result.changedFields.push(field);
  }

  return result;
}

/**
 * Get field label for display
 */
export function getFieldLabel(fieldPath: string): string {
  const labels: Record<string, string> = {
    personalData: 'Personal Information',
    'personalData.firstName': 'First Name',
    'personalData.lastName': 'Last Name',
    'personalData.middleName': 'Middle Name',
    'personalData.birthDate': 'Birth Date',
    phoneMain: 'Phone Number',
    email: 'Email',
    registrationAddress: 'Registration Address',
    residenceAddress: 'Residence Address',
    passportData: 'Passport Information',
    inn: 'INN (Tax ID)',
    snils: 'SNILS (Insurance Number)',
    employment: 'Employment Information',
  };

  return labels[fieldPath] || fieldPath;
}
```

## Creating the useDataPrefill Hook

Create a hook for prefilling data:

```bash
touch src/hooks/useDataPrefill.ts
```

### Implementation

```typescript title="src/hooks/useDataPrefill.ts"
import { useState, useCallback } from 'react';
import type { FormNode } from 'reformer';
import { loadUserProfile } from '@/services/api/user-profile.api';
import {
  mapProfileToFormData,
  calculatePrefillResult,
  type PrefillOptions,
  type PrefillResult,
} from '@/services/data-prefill.service';

/**
 * Prefill state
 */
export type PrefillState = 'idle' | 'loading' | 'preview' | 'applied' | 'error';

/**
 * Hook return type
 */
export interface UseDataPrefillReturn {
  /** Current state */
  state: PrefillState;
  /** Loading error */
  error: Error | null;
  /** Preview of changes */
  preview: PrefillResult | null;
  /** Load and preview prefill */
  loadPreview: (options?: PrefillOptions) => Promise<void>;
  /** Apply prefill */
  apply: () => void;
  /** Cancel prefill */
  cancel: () => void;
  /** Direct prefill without preview */
  prefill: (options?: PrefillOptions) => Promise<void>;
}

/**
 * Hook for prefilling form data from user profile
 */
export function useDataPrefill(form: FormNode): UseDataPrefillReturn {
  const [state, setState] = useState<PrefillState>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [preview, setPreview] = useState<PrefillResult | null>(null);
  const [pendingOptions, setPendingOptions] = useState<PrefillOptions | null>(null);

  // Load and preview prefill
  const loadPreview = useCallback(
    async (options: PrefillOptions = {}) => {
      setState('loading');
      setError(null);
      setPreview(null);

      try {
        // Load user profile
        const profile = await loadUserProfile();

        // Map to form data
        const profileData = mapProfileToFormData(profile);

        // Calculate what would change
        const currentData = form.value.value;
        const prefillResult = calculatePrefillResult(currentData, profileData, options);

        // Store preview
        setPreview(prefillResult);
        setPendingOptions(options);
        setState('preview');
      } catch (err) {
        console.error('Failed to load prefill preview:', err);
        setError(err as Error);
        setState('error');
      }
    },
    [form]
  );

  // Apply prefill from preview
  const apply = useCallback(() => {
    if (!preview || state !== 'preview') {
      console.warn('No preview to apply');
      return;
    }

    // Apply data to form
    form.patchValue(preview.data);

    setState('applied');

    // Reset after 2 seconds
    setTimeout(() => {
      setState('idle');
      setPreview(null);
      setPendingOptions(null);
    }, 2000);
  }, [form, preview, state]);

  // Cancel prefill
  const cancel = useCallback(() => {
    setState('idle');
    setPreview(null);
    setPendingOptions(null);
  }, []);

  // Direct prefill without preview
  const prefill = useCallback(
    async (options: PrefillOptions = {}) => {
      setState('loading');
      setError(null);

      try {
        // Load user profile
        const profile = await loadUserProfile();

        // Map to form data
        const profileData = mapProfileToFormData(profile);

        // Calculate what to prefill
        const currentData = form.value.value;
        const prefillResult = calculatePrefillResult(currentData, profileData, options);

        // Apply directly
        form.patchValue(prefillResult.data);

        setState('applied');

        // Reset after 2 seconds
        setTimeout(() => {
          setState('idle');
        }, 2000);
      } catch (err) {
        console.error('Failed to prefill form:', err);
        setError(err as Error);
        setState('error');
      }
    },
    [form]
  );

  return {
    state,
    error,
    preview,
    loadPreview,
    apply,
    cancel,
    prefill,
  };
}
```

## Creating Prefill UI Components

Create a button to trigger prefill:

```tsx title="src/components/PrefillButton.tsx"
import { useDataPrefill } from '@/hooks/useDataPrefill';
import type { FormNode } from 'reformer';

interface PrefillButtonProps {
  form: FormNode;
  showPreview?: boolean;
}

export function PrefillButton({ form, showPreview = true }: PrefillButtonProps) {
  const { state, error, loadPreview, prefill } = useDataPrefill(form);

  const handleClick = () => {
    if (showPreview) {
      loadPreview();
    } else {
      prefill();
    }
  };

  const isLoading = state === 'loading';
  const isApplied = state === 'applied';

  return (
    <button onClick={handleClick} disabled={isLoading || isApplied} className="prefill-button">
      {isLoading && <Spinner className="w-4 h-4 mr-2" />}
      {isApplied && <CheckIcon className="w-4 h-4 mr-2" />}
      {!isLoading && !isApplied && <UserIcon className="w-4 h-4 mr-2" />}

      <span>
        {isLoading && 'Loading...'}
        {isApplied && 'Prefilled'}
        {!isLoading && !isApplied && 'Fill from Profile'}
      </span>
    </button>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        fill="none"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
      />
    </svg>
  );
}
```

## Creating Prefill Preview Dialog

Create a dialog to preview prefill changes:

```tsx title="src/components/PrefillPreviewDialog.tsx"
import { getFieldLabel } from '@/services/data-prefill.service';
import type { PrefillResult } from '@/services/data-prefill.service';

interface PrefillPreviewDialogProps {
  preview: PrefillResult;
  onApply: () => void;
  onCancel: () => void;
}

export function PrefillPreviewDialog({ preview, onApply, onCancel }: PrefillPreviewDialogProps) {
  const hasChanges = preview.changedFields.length > 0;

  return (
    <div className="dialog-overlay">
      <div className="dialog prefill-preview-dialog">
        <h2>Prefill from Profile</h2>

        {hasChanges ? (
          <>
            <p className="dialog-description">
              The following fields will be filled with data from your profile:
            </p>

            {/* Changed fields */}
            <div className="changed-fields-list">
              {preview.changedFields.map((field) => (
                <div key={field} className="field-item">
                  <CheckIcon className="w-4 h-4 text-green-600" />
                  <span>{getFieldLabel(field)}</span>
                </div>
              ))}
            </div>

            {/* Skipped fields */}
            {preview.skippedFields.length > 0 && (
              <div className="skipped-fields">
                <p className="text-sm text-gray-600">
                  Skipped {preview.skippedFields.length} field(s) that already have values.
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="dialog-actions">
              <button onClick={onCancel} className="button-secondary">
                Cancel
              </button>
              <button onClick={onApply} className="button-primary">
                Apply
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="dialog-description">
              No fields will be changed. All fields are already filled.
            </p>

            <div className="dialog-actions">
              <button onClick={onCancel} className="button-primary">
                OK
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}
```

## Prefill with Preview Integration

Full integration with preview:

```tsx title="src/components/PrefillWithPreview.tsx"
import { useDataPrefill } from '@/hooks/useDataPrefill';
import { PrefillButton } from '@/components/PrefillButton';
import { PrefillPreviewDialog } from '@/components/PrefillPreviewDialog';
import type { FormNode } from 'reformer';

interface PrefillWithPreviewProps {
  form: FormNode;
}

export function PrefillWithPreview({ form }: PrefillWithPreviewProps) {
  const { state, preview, loadPreview, apply, cancel } = useDataPrefill(form);

  return (
    <>
      <PrefillButton form={form} showPreview={true} />

      {state === 'preview' && preview && (
        <PrefillPreviewDialog preview={preview} onApply={apply} onCancel={cancel} />
      )}
    </>
  );
}
```

## Selective Field Prefill

Prefill only specific fields:

```tsx title="src/components/SelectivePrefill.tsx"
import { useState } from 'react';
import { useDataPrefill } from '@/hooks/useDataPrefill';
import type { FormNode } from 'reformer';

interface SelectivePrefillProps {
  form: FormNode;
}

export function SelectivePrefill({ form }: SelectivePrefillProps) {
  const [selectedFields, setSelectedFields] = useState<string[]>([
    'personalData',
    'phoneMain',
    'email',
  ]);

  const { prefill, state } = useDataPrefill(form);

  const availableFields = [
    { id: 'personalData', label: 'Personal Information' },
    { id: 'phoneMain', label: 'Phone Number' },
    { id: 'email', label: 'Email' },
    { id: 'registrationAddress', label: 'Registration Address' },
    { id: 'passportData', label: 'Passport Data' },
    { id: 'inn', label: 'INN (Tax ID)' },
    { id: 'snils', label: 'SNILS' },
    { id: 'employment', label: 'Employment' },
  ];

  const handleToggleField = (fieldId: string) => {
    setSelectedFields((prev) =>
      prev.includes(fieldId) ? prev.filter((id) => id !== fieldId) : [...prev, fieldId]
    );
  };

  const handlePrefill = () => {
    prefill({
      fields: selectedFields,
      overwrite: false,
    });
  };

  return (
    <div className="selective-prefill">
      <h3>Select Fields to Prefill</h3>

      <div className="field-selection">
        {availableFields.map((field) => (
          <label key={field.id} className="field-checkbox">
            <input
              type="checkbox"
              checked={selectedFields.includes(field.id)}
              onChange={() => handleToggleField(field.id)}
            />
            <span>{field.label}</span>
          </label>
        ))}
      </div>

      <button
        onClick={handlePrefill}
        disabled={selectedFields.length === 0 || state === 'loading'}
        className="button-primary"
      >
        {state === 'loading' ? 'Loading...' : 'Prefill Selected Fields'}
      </button>
    </div>
  );
}
```

## Integration with Form Component

Full integration:

```tsx title="src/components/CreditApplicationForm.tsx"
import { useMemo } from 'react';
import { createCreditApplicationForm } from '@/schemas/create-form';
import { PrefillWithPreview } from '@/components/PrefillWithPreview';
import { AutoSaveIndicator } from '@/components/AutoSaveIndicator';
import { DraftSelector } from '@/components/DraftSelector';
import { ResetControls } from '@/components/ResetControls';

export function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);

  return (
    <div className="form-container">
      {/* Header with controls */}
      <div className="form-header">
        <h1>Credit Application</h1>
        <div className="form-controls">
          <PrefillWithPreview form={form} />
          <AutoSaveIndicator status="idle" />
          <DraftSelector drafts={[]} currentDraftId={null} />
          <ResetControls form={form} />
        </div>
      </div>

      {/* Form */}
      <FormRenderer form={form} />
    </div>
  );
}
```

## Testing Data Prefill

Test these scenarios:

### Scenario 1: Basic Prefill

- [ ] Click "Fill from Profile"
- [ ] See preview dialog
- [ ] Review changed fields
- [ ] Click "Apply"
- [ ] Form is populated

### Scenario 2: Partial Prefill

- [ ] Fill some fields manually
- [ ] Click "Fill from Profile"
- [ ] Filled fields are skipped
- [ ] Empty fields are populated
- [ ] No overwrite happens

### Scenario 3: Prefill with Overwrite

- [ ] Fill some fields
- [ ] Enable overwrite option
- [ ] Click prefill
- [ ] All fields are updated
- [ ] Manual data is replaced

### Scenario 4: Selective Prefill

- [ ] Choose specific fields
- [ ] Click prefill
- [ ] Only selected fields filled
- [ ] Other fields unchanged

### Scenario 5: Cancel Prefill

- [ ] Click "Fill from Profile"
- [ ] See preview
- [ ] Click "Cancel"
- [ ] No changes applied
- [ ] Form unchanged

### Scenario 6: Error Handling

- [ ] Disconnect internet
- [ ] Click prefill
- [ ] See error message
- [ ] Form unchanged
- [ ] Can retry

## Key Takeaways

1. **Smart Merging** - Don't overwrite filled fields by default
2. **Preview Changes** - Let users see what will change
3. **Selective Prefill** - Choose which fields to fill
4. **Error Handling** - Gracefully handle API failures
5. **User Control** - Manual trigger, not automatic
6. **Undo Support** - Can reset if unwanted

## Common Patterns

### Basic Prefill

```typescript
const { prefill } = useDataPrefill(form);
await prefill();
```

### Prefill with Preview

```typescript
const { loadPreview, apply, preview } = useDataPrefill(form);
await loadPreview();
if (preview) apply();
```

### Selective Prefill

```typescript
await prefill({
  fields: ['personalData', 'contacts'],
  overwrite: false,
});
```

### Prefill with Overwrite

```typescript
await prefill({ overwrite: true });
```

## What's Next?

In the next section, we'll add **Data Transformation**:

- Serialize form data for API
- Deserialize API data for form
- Date transformations
- Data normalization
- Remove computed fields
- Custom transformers

We'll ensure data flows correctly between form and API!
