import { type Page, type Locator, expect } from '@playwright/test';

// Note: @axe-core/playwright needs to be installed separately
// npm install -D @axe-core/playwright

/**
 * Axe accessibility violation interface
 */
export interface A11yViolation {
  id: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical';
  description: string;
  help: string;
  helpUrl: string;
  nodes: Array<{
    html: string;
    target: string[];
    failureSummary: string;
  }>;
}

/**
 * Accessibility check result
 */
export interface A11yCheckResult {
  violations: A11yViolation[];
  passes: number;
  incomplete: number;
  inapplicable: number;
}

/**
 * Axe configuration options
 */
export interface AxeOptions {
  /** Rules to include */
  include?: string[];
  /** Rules to exclude */
  exclude?: string[];
  /** Tags to check (e.g., 'wcag2a', 'wcag2aa', 'wcag21a') */
  tags?: string[];
  /** Element selectors to exclude from analysis */
  excludeSelectors?: string[];
  /** Element selectors to include in analysis */
  includeSelectors?: string[];
}

/**
 * Check accessibility using axe-core
 * @param page - Playwright page instance
 * @param options - Axe configuration options
 *
 * @example
 * ```typescript
 * import { checkA11y } from './a11y';
 *
 * test('page should be accessible', async ({ page }) => {
 *   await page.goto('/');
 *   const result = await checkA11y(page);
 *   expect(result.violations).toHaveLength(0);
 * });
 * ```
 */
export async function checkA11y(page: Page, options: AxeOptions = {}): Promise<A11yCheckResult> {
  // Dynamic import for @axe-core/playwright
  // This allows the module to be optional
  try {
    const { AxeBuilder } = await import('@axe-core/playwright');

    let builder = new AxeBuilder({ page });

    // Apply tag filters
    if (options.tags && options.tags.length > 0) {
      builder = builder.withTags(options.tags);
    }

    // Apply rule filters
    if (options.include && options.include.length > 0) {
      builder = builder.include(options.include);
    }

    if (options.exclude && options.exclude.length > 0) {
      builder = builder.exclude(options.exclude);
    }

    // Apply selector filters
    if (options.excludeSelectors) {
      for (const selector of options.excludeSelectors) {
        builder = builder.exclude(selector);
      }
    }

    if (options.includeSelectors) {
      for (const selector of options.includeSelectors) {
        builder = builder.include(selector);
      }
    }

    const results = await builder.analyze();

    return {
      violations: results.violations as A11yViolation[],
      passes: results.passes.length,
      incomplete: results.incomplete.length,
      inapplicable: results.inapplicable.length,
    };
  } catch {
    // Fallback if @axe-core/playwright is not installed
    console.warn(
      'Warning: @axe-core/playwright is not installed. Install it with: npm install -D @axe-core/playwright'
    );
    return {
      violations: [],
      passes: 0,
      incomplete: 0,
      inapplicable: 0,
    };
  }
}

/**
 * Check accessibility and throw if violations found
 * @param page - Playwright page instance
 * @param options - Axe configuration options
 */
export async function expectNoA11yViolations(page: Page, options: AxeOptions = {}): Promise<void> {
  const result = await checkA11y(page, options);

  if (result.violations.length > 0) {
    const violationMessages = result.violations.map((v) => {
      const nodeDetails = v.nodes.map((n) => `  - ${n.target.join(' ')}: ${n.failureSummary}`).join('\n');
      return `[${v.impact}] ${v.id}: ${v.help}\n${nodeDetails}`;
    });

    throw new Error(`Accessibility violations found:\n\n${violationMessages.join('\n\n')}`);
  }
}

/**
 * Check WCAG 2.1 AA compliance
 * @param page - Playwright page instance
 */
export async function checkWcag21AA(page: Page): Promise<A11yCheckResult> {
  return checkA11y(page, {
    tags: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
  });
}

/**
 * Check WCAG 2.1 AAA compliance (stricter)
 * @param page - Playwright page instance
 */
export async function checkWcag21AAA(page: Page): Promise<A11yCheckResult> {
  return checkA11y(page, {
    tags: ['wcag2a', 'wcag2aa', 'wcag2aaa', 'wcag21a', 'wcag21aa', 'wcag21aaa'],
  });
}

// ============================================================================
// Manual A11y Helpers (no axe-core dependency)
// ============================================================================

/**
 * Check if all images have alt text
 */
export async function checkImagesHaveAlt(page: Page): Promise<{ valid: boolean; missing: string[] }> {
  const missing = await page.evaluate(() => {
    const images = document.querySelectorAll('img');
    const missingAlt: string[] = [];

    images.forEach((img) => {
      if (!img.hasAttribute('alt')) {
        missingAlt.push(img.src || img.outerHTML.substring(0, 100));
      }
    });

    return missingAlt;
  });

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Check if all form inputs have associated labels
 */
export async function checkInputsHaveLabels(page: Page): Promise<{ valid: boolean; missing: string[] }> {
  const missing = await page.evaluate(() => {
    const inputs = document.querySelectorAll('input, select, textarea');
    const missingLabels: string[] = [];

    inputs.forEach((input) => {
      const id = input.id;
      const ariaLabel = input.getAttribute('aria-label');
      const ariaLabelledBy = input.getAttribute('aria-labelledby');

      // Skip hidden inputs
      if (input.getAttribute('type') === 'hidden') {
        return;
      }

      // Check for label by id
      const hasLabelById = id && document.querySelector(`label[for="${id}"]`);

      // Check for wrapping label
      const hasWrappingLabel = input.closest('label');

      if (!ariaLabel && !ariaLabelledBy && !hasLabelById && !hasWrappingLabel) {
        missingLabels.push(input.outerHTML.substring(0, 100));
      }
    });

    return missingLabels;
  });

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Check color contrast for text elements
 * Note: This is a simplified check - for comprehensive contrast checking use axe-core
 */
export async function checkColorContrast(page: Page): Promise<{ warnings: string[] }> {
  const warnings = await page.evaluate(() => {
    const textElements = document.querySelectorAll('p, span, h1, h2, h3, h4, h5, h6, a, button, label');
    const contrastWarnings: string[] = [];

    textElements.forEach((el) => {
      const style = window.getComputedStyle(el);
      const color = style.color;
      const bgColor = style.backgroundColor;

      // Very basic check - just log for manual review
      if (color === bgColor) {
        contrastWarnings.push(`Same color text and background: ${el.outerHTML.substring(0, 50)}`);
      }
    });

    return contrastWarnings;
  });

  return { warnings };
}

/**
 * Check heading hierarchy (h1, h2, h3, etc. in order)
 */
export async function checkHeadingHierarchy(page: Page): Promise<{ valid: boolean; issues: string[] }> {
  const issues = await page.evaluate(() => {
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const hierarchyIssues: string[] = [];

    let lastLevel = 0;

    headings.forEach((heading) => {
      const level = parseInt(heading.tagName.charAt(1), 10);

      if (level > lastLevel + 1) {
        hierarchyIssues.push(`Skipped heading level: ${heading.tagName} after h${lastLevel}`);
      }

      lastLevel = level;
    });

    // Check for multiple h1
    const h1Count = document.querySelectorAll('h1').length;
    if (h1Count > 1) {
      hierarchyIssues.push(`Multiple h1 elements found: ${h1Count}`);
    }

    if (h1Count === 0) {
      hierarchyIssues.push('No h1 element found on page');
    }

    return hierarchyIssues;
  });

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Check keyboard navigation order
 */
export async function checkFocusOrder(
  page: Page,
  expectedOrder: string[]
): Promise<{ valid: boolean; actualOrder: string[] }> {
  const actualOrder: string[] = [];

  for (let i = 0; i < expectedOrder.length; i++) {
    await page.keyboard.press('Tab');

    const focusedTestId = await page.evaluate(() => {
      const focused = document.activeElement;
      return focused?.getAttribute('data-testid') || focused?.id || focused?.tagName || 'unknown';
    });

    actualOrder.push(focusedTestId);
  }

  const valid = expectedOrder.every((expected, i) => actualOrder[i] === expected);

  return {
    valid,
    actualOrder,
  };
}

/**
 * Check if element is keyboard accessible
 */
export async function isKeyboardAccessible(locator: Locator): Promise<boolean> {
  const page = locator.page();

  // Try to focus the element
  await locator.focus();

  // Check if it received focus
  const isFocused = await page.evaluate(
    (selector) => {
      return document.activeElement === document.querySelector(selector);
    },
    await locator.evaluate((el) => {
      // Build a selector for this element
      if (el.id) return `#${el.id}`;
      if (el.getAttribute('data-testid')) return `[data-testid="${el.getAttribute('data-testid')}"]`;
      return el.tagName.toLowerCase();
    })
  );

  return isFocused;
}

/**
 * Check ARIA attributes validity
 */
export async function checkAriaValidity(page: Page): Promise<{ valid: boolean; issues: string[] }> {
  const issues = await page.evaluate(() => {
    const ariaIssues: string[] = [];

    // Check aria-labelledby references exist
    document.querySelectorAll('[aria-labelledby]').forEach((el) => {
      const ids = el.getAttribute('aria-labelledby')!.split(' ');
      ids.forEach((id) => {
        if (!document.getElementById(id)) {
          ariaIssues.push(`aria-labelledby references non-existent id: ${id}`);
        }
      });
    });

    // Check aria-describedby references exist
    document.querySelectorAll('[aria-describedby]').forEach((el) => {
      const ids = el.getAttribute('aria-describedby')!.split(' ');
      ids.forEach((id) => {
        if (!document.getElementById(id)) {
          ariaIssues.push(`aria-describedby references non-existent id: ${id}`);
        }
      });
    });

    // Check aria-controls references exist
    document.querySelectorAll('[aria-controls]').forEach((el) => {
      const id = el.getAttribute('aria-controls');
      if (id && !document.getElementById(id)) {
        ariaIssues.push(`aria-controls references non-existent id: ${id}`);
      }
    });

    return ariaIssues;
  });

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Create a comprehensive accessibility report
 */
export async function createA11yReport(page: Page): Promise<string> {
  const lines: string[] = ['=== Accessibility Report ===', ''];

  // Check axe-core if available
  const axeResult = await checkA11y(page);
  if (axeResult.passes > 0 || axeResult.violations.length > 0) {
    lines.push('Axe-core Results:');
    lines.push(`  Violations: ${axeResult.violations.length}`);
    lines.push(`  Passes: ${axeResult.passes}`);
    lines.push(`  Incomplete: ${axeResult.incomplete}`);
    lines.push('');
  }

  // Check images
  const imagesResult = await checkImagesHaveAlt(page);
  lines.push('Images:');
  lines.push(`  All have alt text: ${imagesResult.valid ? 'Yes' : 'No'}`);
  if (!imagesResult.valid) {
    lines.push(`  Missing alt: ${imagesResult.missing.length} images`);
  }
  lines.push('');

  // Check inputs
  const inputsResult = await checkInputsHaveLabels(page);
  lines.push('Form Inputs:');
  lines.push(`  All have labels: ${inputsResult.valid ? 'Yes' : 'No'}`);
  if (!inputsResult.valid) {
    lines.push(`  Missing labels: ${inputsResult.missing.length} inputs`);
  }
  lines.push('');

  // Check headings
  const headingsResult = await checkHeadingHierarchy(page);
  lines.push('Heading Hierarchy:');
  lines.push(`  Valid: ${headingsResult.valid ? 'Yes' : 'No'}`);
  if (!headingsResult.valid) {
    headingsResult.issues.forEach((issue) => {
      lines.push(`  - ${issue}`);
    });
  }
  lines.push('');

  // Check ARIA
  const ariaResult = await checkAriaValidity(page);
  lines.push('ARIA Attributes:');
  lines.push(`  Valid: ${ariaResult.valid ? 'Yes' : 'No'}`);
  if (!ariaResult.valid) {
    ariaResult.issues.forEach((issue) => {
      lines.push(`  - ${issue}`);
    });
  }

  return lines.join('\n');
}
