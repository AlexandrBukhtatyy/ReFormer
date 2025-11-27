import { useEffect, useState, useCallback } from 'react';
import type { GroupNodeWithControls } from 'reformer';
import type { CreditApplicationForm } from '@/types/credit-application.types';
import { creditApplicationService } from '@/services/credit-application.service';

interface UseLoadDraftResult {
  /** Whether a draft exists */
  hasDraft: boolean;
  /** Draft timestamp */
  draftTimestamp: string | null;
  /** Load the draft into the form */
  loadDraft: () => void;
  /** Discard the draft */
  discardDraft: () => void;
  /** Whether draft was loaded */
  draftLoaded: boolean;
}

/**
 * Hook for loading draft data into form
 */
export function useLoadDraft(
  form: GroupNodeWithControls<CreditApplicationForm>
): UseLoadDraftResult {
  const [hasDraft, setHasDraft] = useState(false);
  const [draftTimestamp, setDraftTimestamp] = useState<string | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);

  // Check for existing draft on mount
  useEffect(() => {
    const exists = creditApplicationService.hasDraft();
    setHasDraft(exists);
    if (exists) {
      setDraftTimestamp(creditApplicationService.getDraftTimestamp());
    }
  }, []);

  // Load draft into form
  const loadDraft = useCallback(() => {
    const draft = creditApplicationService.loadDraft();
    if (draft) {
      // Use patchValue to partially update the form
      // This preserves any fields not in the draft
      form.patchValue(draft as Partial<CreditApplicationForm>);
      setDraftLoaded(true);
      console.log('[Draft] Loaded into form');
    }
  }, [form]);

  // Discard the draft
  const discardDraft = useCallback(() => {
    creditApplicationService.clearDraft();
    setHasDraft(false);
    setDraftTimestamp(null);
    console.log('[Draft] Discarded');
  }, []);

  return {
    hasDraft,
    draftTimestamp,
    loadDraft,
    discardDraft,
    draftLoaded,
  };
}
