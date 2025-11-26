---
sidebar_position: 4
---

# Draft Management

Creating, loading, and managing multiple form drafts.

## What We're Building

A complete draft management system:

- **Create** named drafts
- **List** all saved drafts
- **Load** specific draft
- **Update** current draft
- **Delete** unwanted drafts
- **Auto-save** to active draft
- **Switch** between drafts

## Why Draft Management?

Users often need to:
- **Save progress** before leaving
- **Resume later** from any device
- **Compare options** by saving multiple scenarios
- **Share drafts** with co-applicants
- **Track history** of changes

Example: A user might create drafts for:
- "Conservative Loan" - Lower amount, safer
- "Aggressive Loan" - Higher amount, riskier
- "With Co-Borrower" - Joint application
- "Solo Application" - Individual application

## Draft Data Structure

First, define the draft interface:

```typescript title="src/types/draft.types.ts"
/**
 * Draft metadata and data
 */
export interface Draft {
  /** Unique draft ID */
  id: string;
  /** User-provided name */
  name: string;
  /** Form data */
  data: any;
  /** Creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
  /** Optional description */
  description?: string;
  /** Draft status */
  status?: 'draft' | 'submitted';
}

/**
 * Draft creation input
 */
export interface CreateDraftInput {
  name: string;
  data: any;
  description?: string;
}

/**
 * Draft update input
 */
export interface UpdateDraftInput {
  name?: string;
  data?: any;
  description?: string;
}
```

## Enhanced Draft Storage Service

Extend the localStorage service with full CRUD operations:

```typescript title="src/services/storage/draft.storage.ts"
import type { Draft, CreateDraftInput, UpdateDraftInput } from '@/types/draft.types';

const DRAFTS_KEY = 'credit-application-drafts';
const CURRENT_DRAFT_ID_KEY = 'credit-application-current-draft-id';

/**
 * Get all drafts
 */
export function getAllDrafts(): Draft[] {
  try {
    const data = localStorage.getItem(DRAFTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to get drafts:', error);
    return [];
  }
}

/**
 * Get draft by ID
 */
export function getDraftById(id: string): Draft | null {
  const drafts = getAllDrafts();
  return drafts.find(d => d.id === id) || null;
}

/**
 * Create new draft
 */
export function createDraft(input: CreateDraftInput): Draft {
  const drafts = getAllDrafts();

  const newDraft: Draft = {
    id: generateDraftId(),
    name: input.name,
    data: input.data,
    description: input.description,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: 'draft',
  };

  drafts.push(newDraft);
  saveDrafts(drafts);

  return newDraft;
}

/**
 * Update existing draft
 */
export function updateDraft(id: string, input: UpdateDraftInput): Draft | null {
  const drafts = getAllDrafts();
  const index = drafts.findIndex(d => d.id === id);

  if (index === -1) {
    return null;
  }

  const draft = drafts[index];
  drafts[index] = {
    ...draft,
    ...input,
    updatedAt: Date.now(),
  };

  saveDrafts(drafts);
  return drafts[index];
}

/**
 * Delete draft
 */
export function deleteDraft(id: string): boolean {
  const drafts = getAllDrafts();
  const filtered = drafts.filter(d => d.id !== id);

  if (filtered.length === drafts.length) {
    return false; // Draft not found
  }

  saveDrafts(filtered);

  // Clear current draft ID if deleted
  if (getCurrentDraftId() === id) {
    clearCurrentDraftId();
  }

  return true;
}

/**
 * Get current draft ID
 */
export function getCurrentDraftId(): string | null {
  return localStorage.getItem(CURRENT_DRAFT_ID_KEY);
}

/**
 * Set current draft ID
 */
export function setCurrentDraftId(id: string): void {
  localStorage.setItem(CURRENT_DRAFT_ID_KEY, id);
}

/**
 * Clear current draft ID
 */
export function clearCurrentDraftId(): void {
  localStorage.removeItem(CURRENT_DRAFT_ID_KEY);
}

/**
 * Get current draft
 */
export function getCurrentDraft(): Draft | null {
  const id = getCurrentDraftId();
  return id ? getDraftById(id) : null;
}

/**
 * Save drafts array to storage
 */
function saveDrafts(drafts: Draft[]): void {
  try {
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
  } catch (error) {
    console.error('Failed to save drafts:', error);
    throw error;
  }
}

/**
 * Generate unique draft ID
 */
function generateDraftId(): string {
  return `draft-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Duplicate draft
 */
export function duplicateDraft(id: string, newName: string): Draft | null {
  const original = getDraftById(id);
  if (!original) {
    return null;
  }

  return createDraft({
    name: newName,
    data: { ...original.data },
    description: `Copy of ${original.name}`,
  });
}

/**
 * Search drafts by name
 */
export function searchDrafts(query: string): Draft[] {
  const drafts = getAllDrafts();
  const lowerQuery = query.toLowerCase();

  return drafts.filter(draft =>
    draft.name.toLowerCase().includes(lowerQuery) ||
    draft.description?.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get drafts sorted by update time
 */
export function getDraftsSortedByUpdate(): Draft[] {
  const drafts = getAllDrafts();
  return drafts.sort((a, b) => b.updatedAt - a.updatedAt);
}
```

## Creating the useDraftManager Hook

Create a comprehensive hook for draft management:

```typescript title="src/hooks/useDraftManager.ts"
import { useState, useEffect, useCallback } from 'react';
import type { FormNode } from 'reformer';
import type { Draft, CreateDraftInput, UpdateDraftInput } from '@/types/draft.types';
import {
  getAllDrafts,
  getDraftById,
  createDraft,
  updateDraft,
  deleteDraft,
  getCurrentDraftId,
  setCurrentDraftId,
  clearCurrentDraftId,
  duplicateDraft,
  getDraftsSortedByUpdate,
} from '@/services/storage/draft.storage';

/**
 * Hook return type
 */
export interface UseDraftManagerReturn {
  /** All drafts */
  drafts: Draft[];
  /** Currently active draft ID */
  currentDraftId: string | null;
  /** Currently active draft */
  currentDraft: Draft | null;
  /** Create new draft */
  create: (name: string, description?: string) => Draft;
  /** Load draft into form */
  load: (id: string) => void;
  /** Update current draft */
  updateCurrent: (input: UpdateDraftInput) => void;
  /** Delete draft */
  remove: (id: string) => void;
  /** Duplicate draft */
  duplicate: (id: string, newName: string) => Draft | null;
  /** Refresh drafts list */
  refresh: () => void;
  /** Save current form as new draft */
  saveAsNew: (name: string, description?: string) => Draft;
  /** Clear current draft */
  clearCurrent: () => void;
}

/**
 * Hook for managing form drafts
 */
export function useDraftManager(form: FormNode): UseDraftManagerReturn {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [currentDraftId, setCurrentDraftIdState] = useState<string | null>(null);

  // Load drafts on mount
  useEffect(() => {
    refresh();
    setCurrentDraftIdState(getCurrentDraftId());
  }, []);

  // Refresh drafts list
  const refresh = useCallback(() => {
    setDrafts(getDraftsSortedByUpdate());
  }, []);

  // Get current draft
  const currentDraft = drafts.find(d => d.id === currentDraftId) || null;

  // Create new draft from current form data
  const create = useCallback((name: string, description?: string): Draft => {
    const draft = createDraft({
      name,
      data: form.value.value,
      description,
    });

    setCurrentDraftId(draft.id);
    setCurrentDraftIdState(draft.id);
    refresh();

    return draft;
  }, [form, refresh]);

  // Load draft into form
  const load = useCallback((id: string) => {
    const draft = getDraftById(id);
    if (!draft) {
      console.error('Draft not found:', id);
      return;
    }

    form.patchValue(draft.data);
    setCurrentDraftId(id);
    setCurrentDraftIdState(id);
  }, [form]);

  // Update current draft
  const updateCurrent = useCallback((input: UpdateDraftInput) => {
    if (!currentDraftId) {
      console.warn('No current draft to update');
      return;
    }

    updateDraft(currentDraftId, input);
    refresh();
  }, [currentDraftId, refresh]);

  // Delete draft
  const remove = useCallback((id: string) => {
    const success = deleteDraft(id);
    if (success) {
      if (currentDraftId === id) {
        setCurrentDraftIdState(null);
      }
      refresh();
    }
  }, [currentDraftId, refresh]);

  // Duplicate draft
  const duplicateHandler = useCallback((id: string, newName: string): Draft | null => {
    const newDraft = duplicateDraft(id, newName);
    if (newDraft) {
      refresh();
    }
    return newDraft;
  }, [refresh]);

  // Save current form as new draft
  const saveAsNew = useCallback((name: string, description?: string): Draft => {
    return create(name, description);
  }, [create]);

  // Clear current draft
  const clearCurrent = useCallback(() => {
    clearCurrentDraftId();
    setCurrentDraftIdState(null);
  }, []);

  return {
    drafts,
    currentDraftId,
    currentDraft,
    create,
    load,
    updateCurrent,
    remove,
    duplicate: duplicateHandler,
    refresh,
    saveAsNew,
    clearCurrent,
  };
}
```

## Creating Draft Selector UI

Create a component for selecting and managing drafts:

```tsx title="src/components/DraftSelector.tsx"
import { useState } from 'react';
import type { Draft } from '@/types/draft.types';

interface DraftSelectorProps {
  drafts: Draft[];
  currentDraftId: string | null;
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string, newName: string) => void;
  onCreateNew: (name: string, description?: string) => void;
}

export function DraftSelector({
  drafts,
  currentDraftId,
  onLoad,
  onDelete,
  onDuplicate,
  onCreateNew,
}: DraftSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  return (
    <div className="draft-selector">
      {/* Current draft display */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="draft-selector-button"
      >
        <FolderIcon className="w-5 h-5" />
        <span>
          {currentDraftId
            ? drafts.find(d => d.id === currentDraftId)?.name || 'Untitled'
            : 'No draft selected'}
        </span>
        <ChevronIcon className={`w-4 h-4 transition ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="draft-selector-menu">
          {/* Draft list */}
          <div className="draft-list">
            {drafts.length === 0 ? (
              <div className="empty-state">
                <p>No saved drafts</p>
              </div>
            ) : (
              drafts.map(draft => (
                <DraftItem
                  key={draft.id}
                  draft={draft}
                  isActive={draft.id === currentDraftId}
                  onLoad={() => {
                    onLoad(draft.id);
                    setIsOpen(false);
                  }}
                  onDelete={() => {
                    if (confirm(`Delete draft "${draft.name}"?`)) {
                      onDelete(draft.id);
                    }
                  }}
                  onDuplicate={() => {
                    const newName = prompt('Enter name for duplicate:', `${draft.name} (copy)`);
                    if (newName) {
                      onDuplicate(draft.id, newName);
                    }
                  }}
                />
              ))
            )}
          </div>

          {/* Create new button */}
          <div className="draft-selector-footer">
            <button
              onClick={() => setShowCreateDialog(true)}
              className="create-draft-button"
            >
              <PlusIcon className="w-4 h-4" />
              <span>Save as new draft</span>
            </button>
          </div>
        </div>
      )}

      {/* Create draft dialog */}
      {showCreateDialog && (
        <CreateDraftDialog
          onConfirm={(name, description) => {
            onCreateNew(name, description);
            setShowCreateDialog(false);
            setIsOpen(false);
          }}
          onCancel={() => setShowCreateDialog(false)}
        />
      )}
    </div>
  );
}

interface DraftItemProps {
  draft: Draft;
  isActive: boolean;
  onLoad: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

function DraftItem({ draft, isActive, onLoad, onDelete, onDuplicate }: DraftItemProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className={`draft-item ${isActive ? 'active' : ''}`}>
      <button onClick={onLoad} className="draft-item-button">
        <div className="draft-item-content">
          <div className="draft-item-name">{draft.name}</div>
          {draft.description && (
            <div className="draft-item-description">{draft.description}</div>
          )}
          <div className="draft-item-meta">
            <span>{formatDate(draft.updatedAt)}</span>
          </div>
        </div>
      </button>

      {/* Actions menu */}
      <div className="draft-item-actions">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="draft-item-menu-button"
        >
          <DotsIcon className="w-4 h-4" />
        </button>

        {showMenu && (
          <div className="draft-item-menu">
            <button onClick={onDuplicate}>
              <CopyIcon className="w-4 h-4" />
              <span>Duplicate</span>
            </button>
            <button onClick={onDelete} className="text-red-600">
              <TrashIcon className="w-4 h-4" />
              <span>Delete</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface CreateDraftDialogProps {
  onConfirm: (name: string, description?: string) => void;
  onCancel: () => void;
}

function CreateDraftDialog({ onConfirm, onCancel }: CreateDraftDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onConfirm(name.trim(), description.trim() || undefined);
    }
  };

  return (
    <div className="dialog-overlay">
      <div className="dialog">
        <h2>Save Draft</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="draft-name">Draft Name</label>
            <input
              id="draft-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Conservative Loan"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="draft-description">Description (optional)</label>
            <textarea
              id="draft-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional notes about this draft"
              rows={3}
            />
          </div>

          <div className="dialog-actions">
            <button type="button" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" disabled={!name.trim()}>
              Save Draft
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Utility functions
function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

  return date.toLocaleDateString();
}

// Icon components (use your preferred icon library)
function FolderIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>;
}

function ChevronIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>;
}

function PlusIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>;
}

function DotsIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="5" r="1" fill="currentColor" /><circle cx="12" cy="19" r="1" fill="currentColor" /></svg>;
}

function CopyIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" strokeWidth={2} /><path strokeWidth={2} d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>;
}

function TrashIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
}
```

## Integration with Auto-Save

Integrate draft management with auto-save:

```tsx title="src/components/CreditApplicationForm.tsx"
import { useMemo, useEffect } from 'react';
import { createCreditApplicationForm } from '@/schemas/create-form';
import { useDataLoader } from '@/hooks/useDataLoader';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useDraftManager } from '@/hooks/useDraftManager';
import { AutoSaveIndicator } from '@/components/AutoSaveIndicator';
import { DraftSelector } from '@/components/DraftSelector';

export function CreditApplicationForm() {
  // Create form
  const form = useMemo(() => createCreditApplicationForm(), []);

  // Draft management
  const draftManager = useDraftManager(form);

  // Auto-save to current draft
  const { status } = useAutoSave(form, {
    debounce: 30000,
    saveFn: async (data) => {
      if (draftManager.currentDraftId) {
        // Update existing draft
        draftManager.updateCurrent({ data });
      } else {
        // Create new draft with timestamp name
        const name = `Auto-saved ${new Date().toLocaleString()}`;
        draftManager.create(name);
      }
    },
  });

  // Load initial draft on mount
  useEffect(() => {
    if (draftManager.currentDraftId) {
      draftManager.load(draftManager.currentDraftId);
    }
  }, []);

  return (
    <div className="form-container">
      {/* Header with controls */}
      <div className="form-header">
        <h1>Credit Application</h1>
        <div className="form-controls">
          <AutoSaveIndicator status={status} />
          <DraftSelector
            drafts={draftManager.drafts}
            currentDraftId={draftManager.currentDraftId}
            onLoad={draftManager.load}
            onDelete={draftManager.remove}
            onDuplicate={draftManager.duplicate}
            onCreateNew={draftManager.create}
          />
        </div>
      </div>

      {/* Form */}
      <FormRenderer form={form} />
    </div>
  );
}
```

## Testing Draft Management

Test these scenarios:

### Scenario 1: Create Draft
- [ ] Fill form with data
- [ ] Click "Save as new draft"
- [ ] Enter draft name
- [ ] Draft appears in list
- [ ] Draft is set as current

### Scenario 2: Load Draft
- [ ] Have multiple drafts
- [ ] Select draft from list
- [ ] Form loads with draft data
- [ ] Current draft indicator updates

### Scenario 3: Update Draft
- [ ] Load a draft
- [ ] Modify form data
- [ ] Wait for auto-save
- [ ] Reload page
- [ ] Changes are preserved

### Scenario 4: Delete Draft
- [ ] Select draft
- [ ] Click delete
- [ ] Confirm deletion
- [ ] Draft removed from list
- [ ] Current draft cleared if deleted

### Scenario 5: Duplicate Draft
- [ ] Select draft
- [ ] Click duplicate
- [ ] Enter new name
- [ ] New draft created
- [ ] Both drafts in list

### Scenario 6: Switch Drafts
- [ ] Have draft A loaded
- [ ] Fill some fields
- [ ] Switch to draft B
- [ ] Form updates with draft B data
- [ ] Switch back to draft A
- [ ] Original data restored

## Key Takeaways

1. **CRUD Operations** - Create, Read, Update, Delete drafts
2. **Current Draft** - Track which draft is active
3. **Auto-Save Integration** - Auto-save updates current draft
4. **UI Components** - User-friendly draft management
5. **localStorage** - Persistent client-side storage
6. **Draft Metadata** - Names, descriptions, timestamps

## Common Patterns

### Create Draft
```typescript
const draft = draftManager.create('My Draft', 'Optional description');
```

### Load Draft
```typescript
draftManager.load(draftId);
```

### Update Current Draft
```typescript
draftManager.updateCurrent({ data: form.value.value });
```

### Delete Draft
```typescript
draftManager.remove(draftId);
```

### Get All Drafts
```typescript
const drafts = draftManager.drafts;
```

## What's Next?

In the next section, we'll add **Reset & Clear** functionality:
- Reset to initial values
- Clear all form data
- Reset specific steps
- Confirmation dialogs
- Integration with drafts

Users will be able to reset their work and start fresh!
