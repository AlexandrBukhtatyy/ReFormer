import { type Page } from '@playwright/test';

/**
 * Web Vitals metrics interface
 */
export interface WebVitalsMetrics {
  /** Largest Contentful Paint (ms) */
  lcp: number | null;
  /** First Input Delay (ms) */
  fid: number | null;
  /** Cumulative Layout Shift */
  cls: number | null;
  /** First Contentful Paint (ms) */
  fcp: number | null;
  /** Time to First Byte (ms) */
  ttfb: number | null;
  /** Interaction to Next Paint (ms) */
  inp: number | null;
}

/**
 * Performance timing interface
 */
export interface PerformanceTiming {
  /** Navigation start timestamp */
  navigationStart: number;
  /** DOM content loaded time (ms) */
  domContentLoaded: number;
  /** Load event time (ms) */
  loadEvent: number;
  /** First paint time (ms) */
  firstPaint: number | null;
  /** First contentful paint time (ms) */
  firstContentfulPaint: number | null;
}

/**
 * Memory usage interface
 */
export interface MemoryUsage {
  /** Used JS heap size (bytes) */
  usedJSHeapSize: number;
  /** Total JS heap size (bytes) */
  totalJSHeapSize: number;
  /** JS heap size limit (bytes) */
  jsHeapSizeLimit: number;
  /** Used heap percentage */
  usedHeapPercentage: number;
}

/**
 * Action measurement result
 */
export interface ActionMeasurement {
  /** Action name */
  name: string;
  /** Duration in milliseconds */
  duration: number;
  /** Start timestamp */
  startTime: number;
  /** End timestamp */
  endTime: number;
}

/**
 * Measure Web Vitals metrics
 * @param page - Playwright page instance
 */
export async function measurePerformance(page: Page): Promise<WebVitalsMetrics> {
  const metrics = await page.evaluate(() => {
    return new Promise<WebVitalsMetrics>((resolve) => {
      const result: WebVitalsMetrics = {
        lcp: null,
        fid: null,
        cls: null,
        fcp: null,
        ttfb: null,
        inp: null,
      };

      // Get FCP from Performance API
      const paintEntries = performance.getEntriesByType('paint');
      const fcpEntry = paintEntries.find((entry) => entry.name === 'first-contentful-paint');
      if (fcpEntry) {
        result.fcp = fcpEntry.startTime;
      }

      // Get TTFB from Navigation Timing
      const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      if (navEntries.length > 0) {
        result.ttfb = navEntries[0].responseStart - navEntries[0].requestStart;
      }

      // Get LCP using PerformanceObserver (if available)
      const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
      if (lcpEntries.length > 0) {
        result.lcp = lcpEntries[lcpEntries.length - 1].startTime;
      }

      // Get CLS from layout-shift entries
      const layoutShiftEntries = performance.getEntriesByType('layout-shift') as Array<
        PerformanceEntry & { hadRecentInput: boolean; value: number }
      >;
      if (layoutShiftEntries.length > 0) {
        result.cls = layoutShiftEntries
          .filter((entry) => !entry.hadRecentInput)
          .reduce((sum, entry) => sum + entry.value, 0);
      }

      resolve(result);
    });
  });

  return metrics;
}

/**
 * Get detailed performance timing
 * @param page - Playwright page instance
 */
export async function getPerformanceTiming(page: Page): Promise<PerformanceTiming> {
  return await page.evaluate(() => {
    const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    const paintEntries = performance.getEntriesByType('paint');

    const navTiming = navEntries[0] || ({} as PerformanceNavigationTiming);
    const firstPaint = paintEntries.find((e) => e.name === 'first-paint');
    const fcp = paintEntries.find((e) => e.name === 'first-contentful-paint');

    return {
      navigationStart: performance.timeOrigin,
      domContentLoaded: navTiming.domContentLoadedEventEnd - navTiming.startTime,
      loadEvent: navTiming.loadEventEnd - navTiming.startTime,
      firstPaint: firstPaint?.startTime ?? null,
      firstContentfulPaint: fcp?.startTime ?? null,
    };
  });
}

/**
 * Measure the duration of an action
 * @param page - Playwright page instance
 * @param actionName - Name of the action for reporting
 * @param action - Async function to measure
 */
export async function measureAction<T>(
  page: Page,
  actionName: string,
  action: () => Promise<T>
): Promise<ActionMeasurement & { result: T }> {
  // Mark start
  const startTime = Date.now();
  await page.evaluate((name) => {
    performance.mark(`${name}-start`);
  }, actionName);

  // Execute action
  const result = await action();

  // Mark end
  const endTime = Date.now();
  await page.evaluate((name) => {
    performance.mark(`${name}-end`);
    performance.measure(name, `${name}-start`, `${name}-end`);
  }, actionName);

  return {
    name: actionName,
    duration: endTime - startTime,
    startTime,
    endTime,
    result,
  };
}

/**
 * Get memory usage (Chrome only)
 * @param page - Playwright page instance
 * @returns Memory usage or null if not available
 */
export async function getMemoryUsage(page: Page): Promise<MemoryUsage | null> {
  return await page.evaluate(() => {
    // @ts-expect-error - memory is Chrome-specific
    const memory = performance.memory;

    if (!memory) {
      return null;
    }

    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      usedHeapPercentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
    };
  });
}

/**
 * Wait for page to be idle (no network activity, no animations)
 * @param page - Playwright page instance
 * @param timeout - Timeout in milliseconds
 */
export async function waitForIdle(page: Page, timeout = 5000): Promise<void> {
  await Promise.all([
    page.waitForLoadState('networkidle', { timeout }),
    page.evaluate(() => {
      return new Promise<void>((resolve) => {
        // Wait for any pending animations
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve();
          });
        });
      });
    }),
  ]);
}

/**
 * Measure render count for a component
 * @param page - Playwright page instance
 * @param componentTestId - data-testid of the component
 * @param action - Action that might trigger re-renders
 */
export async function measureRenderCount(
  page: Page,
  componentTestId: string,
  action: () => Promise<void>
): Promise<{ renderCount: number; duration: number }> {
  // Inject render counter (requires React DevTools or custom implementation)
  await page.evaluate((testId) => {
    const element = document.querySelector(`[data-testid="${testId}"]`);
    if (element) {
      // @ts-expect-error - custom property for tracking
      element.__renderCount = element.__renderCount || 0;

      // Create MutationObserver to track changes
      const observer = new MutationObserver(() => {
        // @ts-expect-error - custom property
        element.__renderCount++;
      });

      observer.observe(element, {
        attributes: true,
        childList: true,
        subtree: true,
        characterData: true,
      });

      // @ts-expect-error - custom property
      element.__observer = observer;
    }
  }, componentTestId);

  const startTime = Date.now();
  await action();
  const duration = Date.now() - startTime;

  // Get render count and cleanup
  const renderCount = await page.evaluate((testId) => {
    const element = document.querySelector(`[data-testid="${testId}"]`);
    if (element) {
      // @ts-expect-error - custom property
      const count = element.__renderCount || 0;
      // @ts-expect-error - custom property
      element.__observer?.disconnect();
      return count;
    }
    return 0;
  }, componentTestId);

  return { renderCount, duration };
}

/**
 * Create a performance report
 */
export function createPerformanceReport(metrics: {
  webVitals: WebVitalsMetrics;
  timing: PerformanceTiming;
  memory: MemoryUsage | null;
  actions: ActionMeasurement[];
}): string {
  const lines: string[] = ['=== Performance Report ===', ''];

  // Web Vitals
  lines.push('Web Vitals:');
  lines.push(`  LCP: ${metrics.webVitals.lcp?.toFixed(2) ?? 'N/A'} ms`);
  lines.push(`  FCP: ${metrics.webVitals.fcp?.toFixed(2) ?? 'N/A'} ms`);
  lines.push(`  CLS: ${metrics.webVitals.cls?.toFixed(4) ?? 'N/A'}`);
  lines.push(`  TTFB: ${metrics.webVitals.ttfb?.toFixed(2) ?? 'N/A'} ms`);
  lines.push('');

  // Timing
  lines.push('Page Timing:');
  lines.push(`  DOM Content Loaded: ${metrics.timing.domContentLoaded.toFixed(2)} ms`);
  lines.push(`  Load Event: ${metrics.timing.loadEvent.toFixed(2)} ms`);
  lines.push(`  First Paint: ${metrics.timing.firstPaint?.toFixed(2) ?? 'N/A'} ms`);
  lines.push('');

  // Memory
  if (metrics.memory) {
    lines.push('Memory Usage:');
    lines.push(`  Used Heap: ${(metrics.memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`);
    lines.push(`  Total Heap: ${(metrics.memory.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`);
    lines.push(`  Usage: ${metrics.memory.usedHeapPercentage.toFixed(2)}%`);
    lines.push('');
  }

  // Actions
  if (metrics.actions.length > 0) {
    lines.push('Action Timings:');
    for (const action of metrics.actions) {
      lines.push(`  ${action.name}: ${action.duration} ms`);
    }
  }

  return lines.join('\n');
}
