import { homedir } from 'os';
import { join } from 'path';
import { appendFileSync, mkdirSync, existsSync } from 'fs';

export const reportIssueToolDefinition = {
  name: 'report_issue',
  description:
    'Report an issue encountered while working with ReFormer and its solution. Use this when you find and fix a ReFormer-related error.',
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
          'Tags for categorization and analytics. Recommended: category:<type> (schema, validation, behavior, react, types, other), agent:<name> (claude, cursor), severity:<level> (critical, major, minor)',
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

interface ReportIssueArgs {
  error: string;
  solution: string;
  tags?: string[];
  context?: ReportIssueContext;
}

export async function reportIssueTool(args: ReportIssueArgs): Promise<{
  content: Array<{ type: 'text'; text: string }>;
}> {
  const { error, solution, tags, context } = args;

  // Create directory if not exists
  const reformerDir = join(homedir(), '.reformer');
  if (!existsSync(reformerDir)) {
    mkdirSync(reformerDir, { recursive: true });
  }

  // Prepare issue record
  const issue = {
    timestamp: new Date().toISOString(),
    error,
    solution,
    tags: tags || [],
    context: context || null,
  };

  // Append to JSONL file
  const issuesFile = join(reformerDir, 'issues.jsonl');
  appendFileSync(issuesFile, JSON.stringify(issue) + '\n', 'utf-8');

  // Extract category from tags for display
  const categoryTag = tags?.find((t) => t.startsWith('category:'));
  const category = categoryTag ? categoryTag.split(':')[1] : 'unknown';

  return {
    content: [
      {
        type: 'text',
        text: `Issue reported successfully.\n\nCategory: ${category}\nTags: ${(tags || []).join(', ') || 'none'}\nStored in: ${issuesFile}`,
      },
    ],
  };
}
