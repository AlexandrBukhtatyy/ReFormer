import { useEffect, useRef, useCallback, useState } from 'react';
import type { GroupNodeWithControls } from 'reformer';
import type { CreditApplicationForm } from '@/types/credit-application.types';
import { creditApplicationService, debounce } from '@/services/credit-application.service';

interface UseAutosaveOptions {
  /** Delay in ms before autosave triggers (default: 2000) */
  delay?: number;
  /** Enable/disable autosave (default: true) */
  enabled?: boolean;
}

interface UseAutosaveResult {
  /** Last saved timestamp */
  lastSaved: string | null;
  /** Whether currently saving */
  isSaving: boolean;
  /** Manually trigger save */
  saveNow: () => void;
  /** Clear the draft */
  clearDraft: () => void;
}

/**
 * Hook for autosaving form data to localStorage
 */
export function useAutosave(
  form: GroupNodeWithControls<CreditApplicationForm>,
  options: UseAutosaveOptions = {}
): UseAutosaveResult {
  const { delay = 2000, enabled = true } = options;

  const [lastSaved, setLastSaved] = useState<string | null>(
    creditApplicationService.getDraftTimestamp()
  );
  const [isSaving, setIsSaving] = useState(false);
  const previousValueRef = useRef<string>('');

  // Debounced save function
  const debouncedSave = useRef(
    debounce((data: CreditApplicationForm) => {
      setIsSaving(true);
      creditApplicationService.saveDraft(data);
      setLastSaved(new Date().toISOString());
      setIsSaving(false);
    }, delay)
  ).current;

  // Manual save
  const saveNow = useCallback(() => {
    const data = form.getValue();
    creditApplicationService.saveDraft(data);
    setLastSaved(new Date().toISOString());
  }, [form]);

  // Clear draft
  const clearDraft = useCallback(() => {
    creditApplicationService.clearDraft();
    setLastSaved(null);
  }, []);

  // Subscribe to form changes
  useEffect(() => {
    if (!enabled) return;

    // Use effect to monitor form value changes
    const checkForChanges = () => {
      const currentValue = JSON.stringify(form.getValue());
      if (currentValue !== previousValueRef.current) {
        previousValueRef.current = currentValue;
        debouncedSave(form.getValue());
      }
    };

    // Check periodically for changes (since we can't easily subscribe to all fields)
    const intervalId = setInterval(checkForChanges, 500);

    return () => {
      clearInterval(intervalId);
    };
  }, [form, enabled, debouncedSave]);

  return {
    lastSaved,
    isSaving,
    saveNow,
    clearDraft,
  };
}
