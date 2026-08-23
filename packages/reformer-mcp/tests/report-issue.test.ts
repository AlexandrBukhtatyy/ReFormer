/**
 * Unit tests for the report_issue tool (defect 77).
 *
 * The tool writes one JSON file per report into `<project>/.reformer/issue_reports`,
 * overridable via REFORMER_ISSUE_REPORTS_DIR. Tests stay hermetic by pointing that env
 * var (or cwd) at a temp directory, and cover the happy path, the project-root default,
 * name collisions and the degraded fs-failure result.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { reportIssueTool } from '../src/core/tools/report-issue';
import { ISSUE_REPORTS_DIR_ENV } from '../src/platform/cli/issue-sink.js';
import { cliKnowledge } from '../src/platform/cli/knowledge.js';

/** Знание процесса: тесты гоняются в Node, поэтому источники — те же, что у сервера. */
const k = cliKnowledge();

describe('reportIssueTool (defect 77)', () => {
  let base: string;
  let cwdBefore: string;
  let envBefore: string | undefined;

  beforeEach(() => {
    base = mkdtempSync(join(tmpdir(), 'reformer-issue-'));
    cwdBefore = process.cwd();
    envBefore = process.env[ISSUE_REPORTS_DIR_ENV];
  });

  afterEach(() => {
    process.chdir(cwdBefore);
    if (envBefore === undefined) delete process.env[ISSUE_REPORTS_DIR_ENV];
    else process.env[ISSUE_REPORTS_DIR_ENV] = envBefore;
    rmSync(base, { recursive: true, force: true });
  });

  it(`writes one JSON report into ${ISSUE_REPORTS_DIR_ENV} and reports success`, async () => {
    const dir = join(base, 'custom-reports');
    process.env[ISSUE_REPORTS_DIR_ENV] = dir;

    const res = await reportIssueTool(
      {
        error: 'boom',
        solution: 'fixed it',
        tags: ['category:validation', 'agent:claude'],
      },
      k
    );

    expect(res.content[0].text).toContain('Issue reported successfully');
    expect(res.content[0].text).toContain('Category: validation');

    const files = readdirSync(dir);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^\d{4}-\d{2}-\d{2}T[\d-]+Z-boom\.json$/);

    const rec = JSON.parse(readFileSync(join(dir, files[0]), 'utf-8'));
    expect(rec.error).toBe('boom');
    expect(rec.solution).toBe('fixed it');
    expect(rec.tags).toEqual(['category:validation', 'agent:claude']);
    expect(typeof rec.timestamp).toBe('string');
  });

  it('defaults to <project root>/.reformer/issue_reports when the env var is unset', async () => {
    delete process.env[ISSUE_REPORTS_DIR_ENV];
    writeFileSync(
      join(base, 'package.json'),
      JSON.stringify({ name: 'host-app', dependencies: { react: '^19.0.0' } }),
      'utf-8'
    );
    mkdirSync(join(base, 'src'), { recursive: true });
    process.chdir(join(base, 'src'));
    // chdir resolves symlinks (macOS /var → /private/var), so take the root from cwd.
    const projectRoot = join(process.cwd(), '..');

    const res = await reportIssueTool({ error: 'no env var', solution: 's' }, k);

    const dir = join(projectRoot, '.reformer', 'issue_reports');
    const files = readdirSync(dir);
    expect(files).toHaveLength(1);
    expect(res.content[0].text).toContain(join(dir, files[0]));
  });

  it('does not overwrite an existing report with the same name', async () => {
    const dir = join(base, 'reports');
    process.env[ISSUE_REPORTS_DIR_ENV] = dir;

    // Frozen clock → identical timestamp + slug → the same base name for both reports.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-22T10:14:05.123Z'));
    try {
      await reportIssueTool({ error: 'same error', solution: 'first' }, k);
      await reportIssueTool({ error: 'same error', solution: 'second' }, k);
    } finally {
      vi.useRealTimers();
    }

    const files = readdirSync(dir).sort();
    expect(files).toEqual([
      '2026-08-22T10-14-05-123Z-same-error-2.json',
      '2026-08-22T10-14-05-123Z-same-error.json',
    ]);
    const solutions = files
      .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf-8')).solution)
      .sort();
    expect(solutions).toEqual(['first', 'second']);
  });

  it('returns a friendly message instead of throwing when the directory cannot be created', async () => {
    // Make the parent of the reports dir a *file*, so mkdirSync fails.
    const blocker = join(base, 'blocked');
    writeFileSync(blocker, 'not a dir', 'utf-8');
    process.env[ISSUE_REPORTS_DIR_ENV] = join(blocker, 'issue_reports');

    const res = await reportIssueTool({ error: 'e', solution: 's' }, k);

    expect(res.content[0].text).toMatch(/could not write the issue report/i);
    expect(res.content[0].text).toContain(ISSUE_REPORTS_DIR_ENV);
  });
});
