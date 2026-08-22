import { join, resolve } from 'path';
import { writeFileSync, mkdirSync } from 'fs';
import { detectProjectStack } from '../utils/project-detector.js';

/** Env var overriding where reports are written. Value may be relative — resolved against cwd. */
export const ISSUE_REPORTS_DIR_ENV = 'REFORMER_ISSUE_REPORTS_DIR';

/** Default location, relative to the detected project root (cwd when detection fails). */
const DEFAULT_DIR_SEGMENTS = ['.reformer', 'issue_reports'];

export const reportIssueToolDefinition = {
  name: 'report_issue',
  // Описание держим коротким сознательно: `tools/list` платится за каждый символ при КАЖДОМ
  // подключении клиента. Подробности (формат файла, резолв корня проекта, коллизии имён) —
  // в `reformer://docs/mcp`, куда агент идёт только когда они ему нужны.
  description:
    'Record a ReFormer problem and its fix as a JSON report on disk ' +
    '(`<project>/.reformer/issue_reports`, override REFORMER_ISSUE_REPORTS_DIR). ' +
    'Not aggregated, not fed back into other tools.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      error: {
        type: 'string',
        description: 'The error message or problem description',
      },
      solution: {
        type: 'string',
        description: 'The solution or fix that resolved the issue',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Tags for categorization. Recommended: category:<type> (schema, validation, behavior, react, types, other), agent:<name> (claude, cursor), severity:<level> (critical, major, minor)',
      },
      context: {
        type: 'object',
        description: 'Additional context for the issue',
        properties: {
          examples: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                description: { type: 'string' },
                code: { type: 'string' },
              },
              required: ['description', 'code'],
            },
            description: 'Code examples showing wrong/correct approaches',
          },
          relatedFiles: {
            type: 'array',
            items: { type: 'string' },
            description: 'Paths to related files',
          },
          notes: {
            type: 'string',
            description: 'Additional notes or observations',
          },
        },
      },
    },
    required: ['error', 'solution'],
  },
};

interface ContextExample {
  description: string;
  code: string;
}

interface ReportIssueContext {
  examples?: ContextExample[];
  relatedFiles?: string[];
  notes?: string;
}

export interface ReportIssueArgs {
  error: string;
  solution: string;
  tags?: string[];
  context?: ReportIssueContext;
}

/**
 * Where report files go: `REFORMER_ISSUE_REPORTS_DIR` when set (relative values are
 * resolved against cwd), otherwise `<project root>/.reformer/issue_reports`. The project
 * root is the nearest package.json with dependencies above cwd; when there is none — cwd
 * itself, so reports never land somewhere the caller cannot see.
 */
export function resolveIssueReportsDir(): string {
  const fromEnv = process.env[ISSUE_REPORTS_DIR_ENV]?.trim();
  if (fromEnv) return resolve(fromEnv);

  const root = detectProjectStack().projectRoot ?? process.cwd();
  return join(root, ...DEFAULT_DIR_SEGMENTS);
}

/** Filesystem-safe ISO stamp: `2026-08-22T10-14-05-123Z` (no `:` — Windows forbids it). */
function fileStamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-');
}

/** Short kebab tail for the file name, so a directory listing is readable. */
function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '');
  return slug || 'issue';
}

export async function reportIssueTool(args: ReportIssueArgs): Promise<{
  content: Array<{ type: 'text'; text: string }>;
}> {
  const { error, solution, tags, context } = args;

  const issue = {
    timestamp: new Date().toISOString(),
    error,
    solution,
    tags: tags || [],
    context: context || null,
  };

  const reportsDir = resolveIssueReportsDir();
  const baseName = `${fileStamp(new Date(issue.timestamp))}-${slugify(error)}`;
  const payload = JSON.stringify(issue, null, 2) + '\n';

  // fs can fail (read-only project, permissions, disk full, path collision). Degrade to a
  // friendly text result like the neighbouring tools instead of throwing an unhandled
  // exception out of the CallTool handler.
  let reportFile = join(reportsDir, `${baseName}.json`);
  try {
    mkdirSync(reportsDir, { recursive: true });
    // `wx` fails on an existing file, so two reports filed in the same millisecond with the
    // same slug get distinct names instead of one overwriting the other.
    for (let attempt = 1; ; attempt++) {
      reportFile = join(
        reportsDir,
        attempt === 1 ? `${baseName}.json` : `${baseName}-${attempt}.json`
      );
      try {
        writeFileSync(reportFile, payload, { encoding: 'utf-8', flag: 'wx' });
        break;
      } catch (err) {
        if ((err as NodeJS.ErrnoException)?.code === 'EEXIST' && attempt < 100) continue;
        throw err;
      }
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return {
      content: [
        {
          type: 'text',
          text:
            `Could not write the issue report to ${reportFile}: ${reason}\n` +
            `Set ${ISSUE_REPORTS_DIR_ENV} to a writable directory to change the location.`,
        },
      ],
    };
  }

  // Extract category from tags for display
  const categoryTag = tags?.find((t) => t.startsWith('category:'));
  const category = categoryTag ? categoryTag.split(':')[1] : 'unknown';

  return {
    content: [
      {
        type: 'text',
        text: `Issue reported successfully.\n\nCategory: ${category}\nTags: ${(tags || []).join(', ') || 'none'}\nStored in: ${reportFile}`,
      },
    ],
  };
}
