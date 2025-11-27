import type { CreditApplicationForm } from '@/types/credit-application.types';

const DRAFT_KEY = 'credit-application-draft';
const DRAFT_TIMESTAMP_KEY = 'credit-application-draft-timestamp';

/**
 * Simulated API service for Credit Application
 */
export const creditApplicationService = {
  /**
   * Load draft from localStorage
   */
  loadDraft(): Partial<CreditApplicationForm> | null {
    try {
      const draft = localStorage.getItem(DRAFT_KEY);
      if (draft) {
        return JSON.parse(draft);
      }
    } catch (error) {
      console.error('Failed to load draft:', error);
    }
    return null;
  },

  /**
   * Save draft to localStorage
   */
  saveDraft(data: Partial<CreditApplicationForm>): void {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
      localStorage.setItem(DRAFT_TIMESTAMP_KEY, new Date().toISOString());
      console.log('[Autosave] Draft saved at', new Date().toLocaleTimeString());
    } catch (error) {
      console.error('Failed to save draft:', error);
    }
  },

  /**
   * Get draft timestamp
   */
  getDraftTimestamp(): string | null {
    return localStorage.getItem(DRAFT_TIMESTAMP_KEY);
  },

  /**
   * Clear draft from localStorage
   */
  clearDraft(): void {
    localStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem(DRAFT_TIMESTAMP_KEY);
    console.log('[Draft] Cleared');
  },

  /**
   * Check if draft exists
   */
  hasDraft(): boolean {
    return localStorage.getItem(DRAFT_KEY) !== null;
  },

  /**
   * Simulate API call to submit application
   * Returns a promise that resolves after a delay
   */
  async submitApplication(data: CreditApplicationForm): Promise<{ success: boolean; applicationId: string }> {
    console.log('[API] Submitting application...', data);

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Simulate random failure (10% chance)
    if (Math.random() < 0.1) {
      throw new Error('Network error: Failed to submit application');
    }

    // Clear draft after successful submission
    this.clearDraft();

    // Return mock response
    return {
      success: true,
      applicationId: `APP-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
    };
  },

  /**
   * Simulate loading existing application (for editing)
   */
  async loadApplication(applicationId: string): Promise<Partial<CreditApplicationForm>> {
    console.log('[API] Loading application:', applicationId);

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Return mock data
    return {
      loanType: 'consumer',
      loanAmount: 500000,
      loanTerm: 24,
      loanPurpose: 'Home renovation',
      personalData: {
        lastName: 'Ivanov',
        firstName: 'Ivan',
        middleName: 'Ivanovich',
        birthDate: '1990-05-15',
        birthPlace: 'Moscow',
        gender: 'male',
      },
    };
  },
};

/**
 * Debounce utility for autosave
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };
}
