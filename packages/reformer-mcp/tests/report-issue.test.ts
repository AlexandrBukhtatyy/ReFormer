/**
 * Unit tests for the report_issue tool (defect 77).
 * The tool appends to ~/.reformer/issues.jsonl. We redirect os.homedir() to a temp
 * directory to keep the test hermetic, verify the happy-path write, and verify that
 * an fs failure degrades to a friendly text result instead of throwing.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Reassigned per-test; the vi.mock factory reads it lazily. Prefixed with `mock`
// so vitest allows the out-of-scope reference inside the hoisted factory.
let mockHome = '';
vi.mock('os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('os')>();
  return { ...actual, homedir: () => mockHome };
});

import { reportIssueTool } from '../src/tools/report-issue';

describe('reportIssueTool (defect 77)', () => {
  let base: string;

  beforeEach(() => {
    base = mkdtempSync(join(tmpdir(), 'reformer-issue-'));
    mockHome = base;
  });

  afterEach(() => {
    mockHome = '';
    rmSync(base, { recursive: true, force: true });
  });

  it('appends the issue to ~/.reformer/issues.jsonl and reports success', async () => {
    const res = await reportIssueTool({
      error: 'boom',
      solution: 'fixed it',
      tags: ['category:validation', 'agent:claude'],
    });

    expect(res.content[0].text).toContain('Issue reported successfully');
    expect(res.content[0].text).toContain('Category: validation');

    const file = join(base, '.reformer', 'issues.jsonl');
    expect(existsSync(file)).toBe(true);

    const rec = JSON.parse(readFileSync(file, 'utf-8').trim());
    expect(rec.error).toBe('boom');
    expect(rec.solution).toBe('fixed it');
    expect(rec.tags).toEqual(['category:validation', 'agent:claude']);
    expect(typeof rec.timestamp).toBe('string');
  });

  it('returns a friendly message instead of throwing when the log path cannot be written', async () => {
    // Make ".reformer" a *file*, so appendFileSync to ".reformer/issues.jsonl" fails.
    writeFileSync(join(base, '.reformer'), 'not a dir', 'utf-8');

    const res = await reportIssueTool({ error: 'e', solution: 's' });

    expect(res.content[0].text).toMatch(/could not write the issue/i);
    expect(res.content[0].text).toContain('issues.jsonl');
  });
});
