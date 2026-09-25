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
    // У потребителя нет записи о .reformer/ в .gitignore — каталог игнорирует себя сам.
    expect(readFileSync(join(projectRoot, '.reformer', '.gitignore'), 'utf-8')).toBe('*\n');
  });

  it('запуск из node_modules/@reformer/mcp (npx) пишет в корень приложения, а не в пакет', async () => {
    delete process.env[ISSUE_REPORTS_DIR_ENV];
    const write = (dir: string, json: object): void => {
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'package.json'), JSON.stringify(json), 'utf-8');
    };
    write(base, { name: 'host-app', dependencies: { react: '^19.0.0' } });
    const pkg = join(base, 'node_modules', '@reformer', 'mcp');
    write(pkg, { name: '@reformer/mcp', dependencies: { zod: '^3.0.0' } });
    process.chdir(pkg);
    const appRoot = join(process.cwd(), '..', '..', '..');

    await reportIssueTool({ error: 'from npx', solution: 's' }, k);

    expect(readdirSync(join(appRoot, '.reformer', 'issue_reports'))).toHaveLength(1);
    expect(readdirSync(pkg)).toEqual(['package.json']);
  });

  it('каталог из переменной окружения не получает чужой .gitignore', async () => {
    const dir = join(base, 'mine', 'reports');
    process.env[ISSUE_REPORTS_DIR_ENV] = dir;
    await reportIssueTool({ error: 'e', solution: 's' }, k);
    expect(readdirSync(join(base, 'mine'))).toEqual(['reports']);
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

  /**
   * В замере 5 отчётов из 15 приехали без `solution`, и на все пять сервер ответил
   * «Issue reported successfully». Половина ценности отчёта — именно разбор: без него
   * остаётся жалоба, которой нельзя воспользоваться. Инструмент не проверял вход вовсе:
   * вызывающий кастовал `args` к типу и объявлял гарантию, которой нет.
   */
  it('пустой solution записывается, но ответ об этом говорит', async () => {
    const res = await reportIssueTool({ error: 'что-то сломалось' }, k);
    expect(res.content[0].text).toMatch(/solution/i);
    expect(res.content[0].text).not.toMatch(/successfully/i);
  });

  it('без error отчёт не пишется — по нему отчёт именуется и ищется', async () => {
    const res = await reportIssueTool({ solution: 'починил' }, k);
    expect(res.content[0].text).toMatch(/`error` обязателен/);
    expect(res.content[0].text).toMatch(/не записан/);
  });

  it('tags строкой разбираются по запятым, а не теряются', async () => {
    const res = await reportIssueTool(
      { error: 'e', solution: 's', tags: 'category:validation, agent:claude' },
      k
    );
    const text = res.content[0].text;
    expect(text).toContain('Category: validation');
    expect(text).toContain('category:validation, agent:claude');
    expect(text, 'о расхождении с контрактом надо сказать').toMatch(/строкой/);
  });

  it('вызов без аргументов не роняет инструмент', async () => {
    const res = await reportIssueTool(undefined, k);
    expect(res.content[0].text).toMatch(/`error` обязателен/);
  });

  it('error не строкой (число, null) — отказ текстом, а не исключение из CallTool', async () => {
    for (const error of [123, null]) {
      const res = await reportIssueTool({ error, solution: 's' }, k);
      expect(res.content[0].text).toMatch(/`error` обязателен/);
    }
  });

  it('нестроковые теги отбрасываются ДО записи — клиент не получает ошибку после записи', async () => {
    // Прежде нестроковый тег ронял обработчик уже ПОСЛЕ записи файла: клиент видел ошибку,
    // повторял вызов и плодил дубликаты отчётов.
    process.env[ISSUE_REPORTS_DIR_ENV] = base;
    const res = await reportIssueTool(
      { error: 'e', solution: 's', tags: [1, 'category:schema', null] },
      k
    );
    const text = res.content[0].text;
    expect(text).toContain('Category: schema');
    expect(text).toMatch(/нестроковых элементов в `tags`: 2/);
    expect(readdirSync(base)).toHaveLength(1);
  });
});
