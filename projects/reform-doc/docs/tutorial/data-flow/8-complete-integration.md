---
sidebar_position: 8
---

# Complete Integration

Bringing all Data Flow features together into a production-ready form.

## What We've Built

Throughout this section, we've created:

1. **Loading Initial Data** - Load from API, localStorage, with priorities
2. **Auto-Save** - Automatic saving with debounce and status indication
3. **Draft Management** - Create, load, update, delete drafts
4. **Reset & Clear** - Reset to initial values or clear all data
5. **Data Prefill** - Pre-fill from user profile with smart merging
6. **Data Transformation** - Bidirectional conversion between form and API formats

Now we'll integrate everything into a complete, production-ready form component.

## Complete Form Component

Here's the full integration:

```tsx title="src/components/CreditApplicationForm.tsx"
import { useMemo, useState, useEffect } from 'react';
import { createCreditApplicationForm } from '@/schemas/create-form';
import { useDataLoader } from '@/hooks/useDataLoader';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useDraftManager } from '@/hooks/useDraftManager';
import { useFormReset } from '@/hooks/useFormReset';
import { useDataPrefill } from '@/hooks/useDataPrefill';
import { useFormSubmission } from '@/hooks/useFormSubmission';
import { creditApplicationTransformer } from '@/services/transformers/credit-application.transformer';
import { draftTransformer } from '@/services/transformers/draft.transformer';
import { AutoSaveIndicator } from '@/components/AutoSaveIndicator';
import { DraftSelector } from '@/components/DraftSelector';
import { ResetControls } from '@/components/ResetControls';
import { PrefillWithPreview } from '@/components/PrefillWithPreview';
import { LoadingBoundary } from '@/components/LoadingBoundary';
import { FormRenderer } from '@/components/FormRenderer';

interface CreditApplicationFormProps {
  /** Application ID for editing existing application */
  applicationId?: string;
  /** Draft ID for loading saved draft */
  draftId?: string;
  /** Called when form is successfully submitted */
  onSubmitSuccess?: (data: any) => void;
  /** Called when user cancels */
  onCancel?: () => void;
}

export function CreditApplicationForm({
  applicationId,
  draftId,
  onSubmitSuccess,
  onCancel,
}: CreditApplicationFormProps) {
  // ============================================
  // 1. FORM CREATION
  // ============================================
  const form = useMemo(() => createCreditApplicationForm(), []);

  // ============================================
  // 2. DATA LOADING
  // ============================================
  const { loading, error: loadError } = useDataLoader(form, applicationId);

  // Load draft if provided
  useEffect(() => {
    if (draftId && !applicationId) {
      const draft = getDraftById(draftId);
      if (draft) {
        const formData = draftTransformer.deserialize(draft.data);
        form.patchValue(formData);
      }
    }
  }, [draftId, applicationId, form]);

  // ============================================
  // 3. DRAFT MANAGEMENT
  // ============================================
  const draftManager = useDraftManager(form);

  // ============================================
  // 4. AUTO-SAVE
  // ============================================
  const {
    status: saveStatus,
    pause: pauseAutoSave,
    resume: resumeAutoSave,
  } = useAutoSave(form, {
    debounce: 30000, // 30 seconds
    saveFn: async (formData) => {
      // Serialize with draft transformer (keeps computed fields)
      const draftData = draftTransformer.serialize(formData);

      // Update current draft or create new one
      if (draftManager.currentDraftId) {
        draftManager.updateCurrent({ data: draftData });
      } else {
        const timestamp = new Date().toLocaleString();
        draftManager.create(`Auto-saved ${timestamp}`, 'Automatically saved');
      }
    },
  });

  // ============================================
  // 5. RESET & CLEAR
  // ============================================
  const { reset, clear } = useFormReset(form);

  const handleReset = async () => {
    const success = await reset();
    if (success) {
      // Optionally clear current draft
      if (!applicationId) {
        draftManager.clearCurrent();
      }
    }
  };

  const handleClear = async () => {
    const success = await clear();
    if (success) {
      draftManager.clearCurrent();
    }
  };

  // ============================================
  // 6. DATA PREFILL
  // ============================================
  const {
    state: prefillState,
    preview,
    loadPreview,
    apply: applyPrefill,
    cancel: cancelPrefill,
  } = useDataPrefill(form);

  // ============================================
  // 7. FORM SUBMISSION
  // ============================================
  const { submit, submitting, error: submitError } = useFormSubmission(form);

  const handleSubmit = async () => {
    // Pause auto-save during submission
    pauseAutoSave();

    try {
      const success = await submit();

      if (success) {
        // Clear draft after successful submission
        if (draftManager.currentDraftId) {
          draftManager.remove(draftManager.currentDraftId);
        }

        // Notify parent
        onSubmitSuccess?.(form.value.value);
      }
    } finally {
      // Resume auto-save
      resumeAutoSave();
    }
  };

  // ============================================
  // 8. DRAFT OPERATIONS
  // ============================================
  const handleLoadDraft = (id: string) => {
    // Pause auto-save while loading
    pauseAutoSave();

    // Load draft
    draftManager.load(id);

    // Resume auto-save
    setTimeout(() => resumeAutoSave(), 100);
  };

  const handleSaveAsNewDraft = (name: string, description?: string) => {
    // Create new draft
    const draft = draftManager.create(name, description);

    // Show success message
    console.log('Draft saved:', draft.name);
  };

  // ============================================
  // 9. RENDER
  // ============================================

  return (
    <LoadingBoundary loading={loading} error={loadError}>
      <div className="credit-application-form">
        {/* ========== HEADER ========== */}
        <header className="form-header">
          <div className="form-title">
            <h1>{applicationId ? 'Edit Credit Application' : 'New Credit Application'}</h1>
            {draftManager.currentDraft && (
              <span className="draft-badge">Draft: {draftManager.currentDraft.name}</span>
            )}
          </div>

          {/* Control Panel */}
          <div className="form-controls">
            {/* Prefill Button */}
            <PrefillWithPreview form={form} />

            {/* Auto-Save Indicator */}
            <AutoSaveIndicator status={saveStatus} />

            {/* Draft Selector */}
            <DraftSelector
              drafts={draftManager.drafts}
              currentDraftId={draftManager.currentDraftId}
              onLoad={handleLoadDraft}
              onDelete={draftManager.remove}
              onDuplicate={draftManager.duplicate}
              onCreateNew={handleSaveAsNewDraft}
            />

            {/* Reset Controls */}
            <ResetControls form={form} onReset={handleReset} onClear={handleClear} />
          </div>
        </header>

        {/* ========== FORM CONTENT ========== */}
        <div className="form-content">
          <FormRenderer form={form} />
        </div>

        {/* ========== FOOTER ========== */}
        <footer className="form-footer">
          <div className="form-actions">
            {/* Cancel Button */}
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="button-secondary"
                disabled={submitting}
              >
                Cancel
              </button>
            )}

            {/* Save Draft Button */}
            <button
              type="button"
              onClick={() => {
                const name = prompt('Enter draft name:');
                if (name) {
                  handleSaveAsNewDraft(name);
                }
              }}
              className="button-secondary"
              disabled={submitting}
            >
              Save as Draft
            </button>

            {/* Submit Button */}
            <button
              type="button"
              onClick={handleSubmit}
              className="button-primary"
              disabled={submitting || !form.isValid.value}
            >
              {submitting ? 'Submitting...' : 'Submit Application'}
            </button>
          </div>

          {/* Submit Error */}
          {submitError && (
            <div className="error-message">
              <ErrorIcon className="w-5 h-5" />
              <span>{submitError.message}</span>
            </div>
          )}

          {/* Form Status */}
          <div className="form-status">
            <span className={form.isDirty.value ? 'text-orange-600' : 'text-gray-500'}>
              {form.isDirty.value ? 'Unsaved changes' : 'No changes'}
            </span>
            <span className="separator">•</span>
            <span className={form.isValid.value ? 'text-green-600' : 'text-red-600'}>
              {form.isValid.value ? 'Valid' : 'Invalid'}
            </span>
          </div>
        </footer>

        {/* ========== PREFILL PREVIEW DIALOG ========== */}
        {prefillState === 'preview' && preview && (
          <PrefillPreviewDialog
            preview={preview}
            onApply={() => {
              applyPrefill();
            }}
            onCancel={cancelPrefill}
          />
        )}
      </div>
    </LoadingBoundary>
  );
}

function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <circle cx="12" cy="12" r="10" strokeWidth={2} />
      <path strokeLinecap="round" strokeWidth={2} d="M12 8v4m0 4h.01" />
    </svg>
  );
}
```

## Control Panel Component

Extract the control panel for reusability:

```tsx title="src/components/ControlPanel.tsx"
import { AutoSaveIndicator } from './AutoSaveIndicator';
import { DraftSelector } from './DraftSelector';
import { ResetControls } from './ResetControls';
import { PrefillButton } from './PrefillButton';
import type { FormNode } from 'reformer';
import type { SaveStatus } from '@/hooks/useAutoSave';
import type { UseDraftManagerReturn } from '@/hooks/useDraftManager';

interface ControlPanelProps {
  form: FormNode;
  saveStatus: SaveStatus;
  draftManager: UseDraftManagerReturn;
  onReset: () => void;
  onClear: () => void;
}

export function ControlPanel({
  form,
  saveStatus,
  draftManager,
  onReset,
  onClear,
}: ControlPanelProps) {
  return (
    <div className="control-panel">
      {/* Prefill */}
      <div className="control-group">
        <label>Data</label>
        <PrefillButton form={form} />
      </div>

      {/* Auto-Save */}
      <div className="control-group">
        <label>Auto-Save</label>
        <AutoSaveIndicator status={saveStatus} />
      </div>

      {/* Drafts */}
      <div className="control-group">
        <label>Drafts</label>
        <DraftSelector
          drafts={draftManager.drafts}
          currentDraftId={draftManager.currentDraftId}
          onLoad={draftManager.load}
          onDelete={draftManager.remove}
          onDuplicate={draftManager.duplicate}
          onCreateNew={draftManager.create}
        />
      </div>

      {/* Reset */}
      <div className="control-group">
        <label>Reset</label>
        <ResetControls form={form} onReset={onReset} onClear={onClear} />
      </div>
    </div>
  );
}
```

## Usage Examples

### Example 1: New Application

```tsx
<CreditApplicationForm
  onSubmitSuccess={(data) => {
    console.log('Application submitted:', data);
    navigate('/success');
  }}
  onCancel={() => {
    navigate('/dashboard');
  }}
/>
```

### Example 2: Edit Existing Application

```tsx
<CreditApplicationForm
  applicationId="app-123"
  onSubmitSuccess={(data) => {
    console.log('Application updated:', data);
    navigate('/applications');
  }}
/>
```

### Example 3: Load Draft

```tsx
<CreditApplicationForm
  draftId="draft-456"
  onSubmitSuccess={(data) => {
    console.log('Draft submitted:', data);
    navigate('/success');
  }}
/>
```

### Example 4: With Router Integration

```tsx
import { useParams, useNavigate } from 'react-router-dom';

function ApplicationPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <CreditApplicationForm
      applicationId={id}
      onSubmitSuccess={() => navigate('/success')}
      onCancel={() => navigate('/dashboard')}
    />
  );
}
```

## Complete Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    CREDIT APPLICATION FORM                       │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                     DATA SOURCES                          │  │
│  │                                                            │  │
│  │  1. API (applicationId)                                   │  │
│  │     ├─> Load existing application                         │  │
│  │     └─> Transform: deserialize                            │  │
│  │                                                            │  │
│  │  2. localStorage (draftId)                                │  │
│  │     ├─> Load saved draft                                  │  │
│  │     └─> Transform: deserialize                            │  │
│  │                                                            │  │
│  │  3. User Profile                                          │  │
│  │     ├─> Prefill personal data                             │  │
│  │     └─> Smart merge (don't overwrite)                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                     FORM STATE                            │  │
│  │                                                            │  │
│  │  • Value Observable                                       │  │
│  │  • Validation Observable                                  │  │
│  │  • Dirty State Observable                                 │  │
│  │  • Behaviors (computed fields)                            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    USER ACTIONS                           │  │
│  │                                                            │  │
│  │  • Fill/Edit Fields                                       │  │
│  │  • Reset/Clear                                            │  │
│  │  • Load Draft                                             │  │
│  │  • Prefill from Profile                                   │  │
│  │  • Save as Draft                                          │  │
│  │  • Submit                                                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   AUTO-SAVE (30s)                         │  │
│  │                                                            │  │
│  │  • Debounced save                                         │  │
│  │  • Transform: serialize (draft)                           │  │
│  │  • Save to localStorage                                   │  │
│  │  • Show status indicator                                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   DATA DESTINATIONS                       │  │
│  │                                                            │  │
│  │  1. localStorage (Auto-Save)                              │  │
│  │     └─> Draft with all fields                             │  │
│  │                                                            │  │
│  │  2. API (Submit)                                          │  │
│  │     ├─> Transform: serialize                              │  │
│  │     ├─> Remove computed fields                            │  │
│  │     ├─> Normalize data                                    │  │
│  │     └─> Submit to server                                  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Testing Complete Integration

Comprehensive testing checklist:

### New Application Flow

- [ ] Open form without IDs
- [ ] Form starts empty
- [ ] Fill some fields
- [ ] Auto-save creates draft
- [ ] See "saving" → "saved" status
- [ ] Reload page
- [ ] Draft persists in selector
- [ ] Load draft
- [ ] Data restored
- [ ] Continue editing
- [ ] Submit form
- [ ] Draft deleted after submit

### Edit Existing Application Flow

- [ ] Open form with applicationId
- [ ] See loading spinner
- [ ] Form loads with data
- [ ] Behaviors calculated
- [ ] Modify fields
- [ ] Auto-save updates
- [ ] Submit changes
- [ ] API receives updates

### Prefill Flow

- [ ] Open new form
- [ ] Click "Fill from Profile"
- [ ] See preview dialog
- [ ] Review changes
- [ ] Apply prefill
- [ ] Form populated
- [ ] Can edit prefilled data
- [ ] Save as draft
- [ ] Draft includes prefilled data

### Reset Flow

- [ ] Load draft or application
- [ ] Modify fields
- [ ] Click "Reset"
- [ ] Confirm dialog
- [ ] Form restores original
- [ ] Dirty state cleared
- [ ] Can edit again

### Draft Management Flow

- [ ] Create multiple drafts
- [ ] Switch between drafts
- [ ] Each draft preserves data
- [ ] Duplicate draft
- [ ] Both drafts exist
- [ ] Delete draft
- [ ] Draft removed
- [ ] Other drafts unaffected

### Error Handling

- [ ] Network error during load
- [ ] See error message
- [ ] Can retry
- [ ] Network error during save
- [ ] Auto-save shows error
- [ ] Retries automatically
- [ ] Submit validation errors
- [ ] Form shows errors
- [ ] Can fix and resubmit

## Performance Considerations

### 1. Debouncing

```typescript
// Auto-save debounce
useAutoSave(form, {
  debounce: 30000, // 30 seconds - balance between safety and performance
});
```

### 2. Memoization

```typescript
// Memoize form creation
const form = useMemo(() => createCreditApplicationForm(), []);

// Memoize expensive calculations
const transformedData = useMemo(() => transformer.serialize(formData), [formData]);
```

### 3. Lazy Loading

```typescript
// Lazy load draft list
const [drafts, setDrafts] = useState<Draft[]>([]);
const [draftsLoaded, setDraftsLoaded] = useState(false);

const loadDrafts = useCallback(() => {
  if (!draftsLoaded) {
    setDrafts(getAllDrafts());
    setDraftsLoaded(true);
  }
}, [draftsLoaded]);
```

### 4. Cleanup

```typescript
useEffect(() => {
  const autoSave = createAutoSave(form, options);

  return () => {
    // Cleanup on unmount
    autoSave.destroy();
  };
}, [form]);
```

## Best Practices

### 1. Error Handling

- Always handle loading and error states
- Show user-friendly error messages
- Provide retry mechanisms
- Log errors for debugging

### 2. User Feedback

- Show loading indicators
- Display save status
- Confirm destructive actions
- Celebrate successes

### 3. Data Integrity

- Validate before submission
- Transform consistently
- Handle edge cases
- Test round-trips

### 4. Performance

- Debounce expensive operations
- Memoize calculations
- Lazy load when possible
- Clean up subscriptions

### 5. User Experience

- Auto-save frequently
- Don't block user input
- Preserve work on errors
- Make actions reversible

## File Structure Review

Final file structure:

```
src/
├── components/
│   ├── CreditApplicationForm.tsx       # Main form component
│   ├── ControlPanel.tsx                # Control panel
│   ├── AutoSaveIndicator.tsx           # Save status
│   ├── DraftSelector.tsx               # Draft management UI
│   ├── ResetControls.tsx               # Reset buttons
│   ├── PrefillButton.tsx               # Prefill trigger
│   ├── PrefillPreviewDialog.tsx        # Prefill preview
│   ├── LoadingBoundary.tsx             # Loading states
│   ├── ConfirmDialog.tsx               # Confirmations
│   └── FormRenderer.tsx                # Form rendering
│
├── hooks/
│   ├── useDataLoader.ts                # Data loading
│   ├── useAutoSave.ts                  # Auto-save
│   ├── useDraftManager.ts              # Draft management
│   ├── useFormReset.ts                 # Reset/clear
│   ├── useDataPrefill.ts               # Prefill
│   └── useFormSubmission.ts            # Submission
│
├── services/
│   ├── api/
│   │   ├── application.api.ts          # Application API
│   │   └── user-profile.api.ts         # Profile API
│   ├── storage/
│   │   └── draft.storage.ts            # localStorage
│   ├── transformers/
│   │   ├── credit-application.transformer.ts
│   │   ├── draft.transformer.ts
│   │   └── submission.transformer.ts
│   ├── auto-save.service.ts            # Auto-save logic
│   └── data-transform.service.ts       # Transform utils
│
└── types/
    ├── draft.ts                  # Draft interfaces
    ├── transformer.ts            # Transformer interfaces
    └── user-profile.ts           # Profile interfaces
```

## Summary

We've built a complete, production-ready form with:

### Data Loading

- Multiple sources (API, localStorage, profile)
- Priority-based loading
- Loading state management
- Error handling

### Auto-Save

- Debounced saving
- Status indication
- Save on page unload
- Dual storage (localStorage + API)

### Draft Management

- Create, read, update, delete
- Multiple drafts support
- Draft switching
- Auto-save integration

### Reset & Clear

- Reset to initial values
- Clear all data
- Step-level reset
- Field-level reset
- Confirmation dialogs

### Data Prefill

- Load from user profile
- Smart merging
- Preview changes
- Selective prefill

### Data Transformation

- Bidirectional conversion
- Date handling
- Data normalization
- Computed field removal

### Form Submission

- Validation before submit
- Transform for API
- Error handling
- Success callbacks

## What's Next?

You now have a complete understanding of Data Flow in ReFormer! Here are suggested next steps:

1. **Explore Validation** - Learn about advanced validation patterns
2. **Study Behaviors** - Deep dive into computed fields and dependencies
3. **Build Custom Hooks** - Create domain-specific data flow hooks
4. **Add Analytics** - Track form interactions and abandonment
5. **Implement Audit Trail** - Log all changes for compliance
6. **Add Conflict Resolution** - Handle simultaneous edits
7. **Optimize Performance** - Profile and improve bottlenecks

## Congratulations!

You've completed the Data Flow tutorial. You can now:

- Load data from any source
- Auto-save user progress
- Manage multiple drafts
- Reset and clear forms
- Prefill from profiles
- Transform data formats
- Submit forms reliably

Your credit application form is now production-ready with enterprise-grade data flow management!
