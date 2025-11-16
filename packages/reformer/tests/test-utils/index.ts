/**
 * Common test utilities and helpers for ReFormer tests
 */

/**
 * Mock component for testing
 * Used as a placeholder when testing form logic without actual UI components
 */
export const mockComponent = null as unknown;

/**
 * Common test interfaces
 */
export interface TestFormBasic {
  name: string;
  email: string;
  age: number;
}

export interface TestFormNested {
  user: {
    firstName: string;
    lastName: string;
    email: string;
  };
  settings: {
    theme: string;
    notifications: boolean;
  };
}

export interface TestFormWithArray {
  title: string;
  items: Array<{
    name: string;
    price: number;
  }>;
}

/**
 * Helper to create a delay for async tests
 */
export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Helper to wait for next tick
 */
export const nextTick = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Mock async validator that always succeeds
 */
export const mockAsyncValidatorSuccess = async (_value: unknown) => {
  await delay(10);
  return null;
};

/**
 * Mock async validator that always fails
 */
export const mockAsyncValidatorFail = async (_value: unknown) => {
  await delay(10);
  return { code: 'mock_error', message: 'Mock validation error' };
};

/**
 * Creates a mock async validator with configurable delay and result
 */
export const createMockAsyncValidator = (
  delayMs: number,
  result: unknown | null,
  shouldThrow = false
) => {
  return async (_value: unknown) => {
    await delay(delayMs);
    if (shouldThrow) {
      throw new Error('Mock validator error');
    }
    return result;
  };
};
