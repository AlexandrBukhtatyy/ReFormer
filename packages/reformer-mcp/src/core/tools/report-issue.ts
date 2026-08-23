/**
 * Tool `report_issue` — записать найденную проблему и её решение отчётом.
 *
 * Единственный инструмент, который что-то СОХРАНЯЕТ, поэтому единственный, которому нужен
 * сток (`IssueSink`). Где именно окажется отчёт, инструмент не знает: на диске это файл в
 * каталоге проекта, в среде без записи — сток отказывает, и отказ превращается в дружелюбный
 * текст, а не в исключение из обработчика `CallTool`.
 *
 * @module reformer-mcp/core/tools/report-issue
 */

import type { Knowledge } from '../knowledge.js';
import { fileStamp, slugifyIssue } from '../issues/sink.js';

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

export async function reportIssueTool(
  args: ReportIssueArgs,
  k: Knowledge
): Promise<{
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

  const baseName = `${fileStamp(new Date(issue.timestamp))}-${slugifyIssue(error)}`;
  const payload = JSON.stringify(issue, null, 2) + '\n';

  // Сток может отказать (только чтение, права, диск полон, среда без записи). Деградируем
  // текстом, как соседние инструменты, вместо необработанного исключения.
  let storedIn: string;
  try {
    storedIn = k.issues.write(baseName, payload);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return {
      content: [
        {
          type: 'text',
          text:
            `Could not write the issue report to ${k.issues.location()}: ${reason}\n` +
            `Set REFORMER_ISSUE_REPORTS_DIR to a writable directory to change the location.`,
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
        text: `Issue reported successfully.\n\nCategory: ${category}\nTags: ${(tags || []).join(', ') || 'none'}\nStored in: ${storedIn}`,
      },
    ],
  };
}
