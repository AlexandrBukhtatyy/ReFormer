import { test as base, type Page, type Route } from '@playwright/test';
import { CreditFormPage } from '../pages/complex-multy-step-form/credit-form-page.pom';

/**
 * Project metadata interface for type safety
 */
export interface ProjectMetadata {
  basePath?: string;
  variant?: 'compound' | 'renderer' | 'json';
}

/**
 * Extended test fixtures
 */
export interface TestFixtures {
  /** Credit form page object with configured basePath from project metadata */
  creditForm: CreditFormPage;
  /** Auto-mocked APIs */
  mockApis: MockApisFixture;
}

/**
 * Mock APIs fixture interface
 */
export interface MockApisFixture {
  /** Mock a specific API endpoint */
  mockEndpoint: (
    url: string | RegExp,
    response: unknown,
    options?: { status?: number; delay?: number }
  ) => Promise<void>;
  /** Mock form submission endpoint */
  mockSubmission: (
    response?: unknown,
    options?: { status?: number; delay?: number }
  ) => Promise<void>;
  /** Mock validation endpoint */
  mockValidation: (
    response?: unknown,
    options?: { status?: number; delay?: number }
  ) => Promise<void>;
  /** Get all mocked routes */
  getMockedRoutes: () => Route[];
}

/**
 * Get project metadata with type safety
 */
function getProjectMetadata(testInfo: { project: { metadata?: unknown } }): ProjectMetadata {
  return (testInfo.project.metadata as ProjectMetadata) || {};
}

/**
 * Create mock APIs helper
 */
function createMockApis(page: Page): MockApisFixture {
  const mockedRoutes: Route[] = [];

  return {
    async mockEndpoint(
      url: string | RegExp,
      response: unknown,
      options: { status?: number; delay?: number } = {}
    ): Promise<void> {
      const { status = 200, delay = 0 } = options;

      await page.route(url, async (route) => {
        mockedRoutes.push(route);

        if (delay > 0) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }

        await route.fulfill({
          status,
          contentType: 'application/json',
          body: JSON.stringify(response),
        });
      });
    },

    async mockSubmission(
      response: unknown = { success: true, applicationId: 'TEST-123' },
      options: { status?: number; delay?: number } = {}
    ): Promise<void> {
      await this.mockEndpoint(/\/api\/submit/, response, options);
    },

    async mockValidation(
      response: unknown = { valid: true },
      options: { status?: number; delay?: number } = {}
    ): Promise<void> {
      await this.mockEndpoint(/\/api\/validate/, response, options);
    },

    getMockedRoutes(): Route[] {
      return mockedRoutes;
    },
  };
}

/**
 * Extended Playwright test with custom fixtures
 */
export const test = base.extend<TestFixtures>({
  /**
   * Credit form page object with basePath and variant from project metadata
   */
  creditForm: async ({ page }, use, testInfo) => {
    const metadata = getProjectMetadata(testInfo);
    const creditForm = new CreditFormPage(page, {
      basePath: metadata.basePath,
      variant: metadata.variant,
    });

    await use(creditForm);
  },

  /**
   * Auto-mocked APIs fixture
   */
  mockApis: async ({ page }, use) => {
    const mockApis = createMockApis(page);
    await use(mockApis);
  },
});

/**
 * Re-export expect for convenience
 */
export { expect } from '@playwright/test';

/**
 * Helper to create a test with specific variant
 */
export function createVariantTest(variant: 'compound' | 'renderer' | 'json') {
  return test.extend<TestFixtures>({
    creditForm: async ({ page }, use) => {
      const creditForm = new CreditFormPage(page);
      const basePathByVariant: Record<typeof variant, string> = {
        compound: '/examples/complex',
        renderer: '/examples/complex-renderer',
        json: '/examples/json-renderer',
      };
      const basePath = basePathByVariant[variant];

      Object.defineProperty(creditForm, 'baseUrl', {
        value: basePath,
        writable: false,
      });

      await use(creditForm);
    },
  });
}

/**
 * Helper to run the same test across all variants
 */
export function describeForAllVariants(
  name: string,
  fn: (variant: 'compound' | 'renderer' | 'json') => void
): void {
  const variants: Array<'compound' | 'renderer' | 'json'> = ['compound', 'renderer', 'json'];

  for (const variant of variants) {
    test.describe(`${name} [${variant}]`, () => {
      fn(variant);
    });
  }
}

/**
 * @deprecated Use describeForAllVariants instead
 */
export function describeForBothVariants(
  name: string,
  fn: (variant: 'compound' | 'renderer') => void
): void {
  const variants: Array<'compound' | 'renderer'> = ['compound', 'renderer'];

  for (const variant of variants) {
    test.describe(`${name} [${variant}]`, () => {
      fn(variant);
    });
  }
}
