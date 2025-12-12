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
      code: {
        type: 'string',
        description: 'The problematic code snippet (optional)',
      },
      category: {
        type: 'string',
        enum: ['schema', 'validation', 'behavior', 'react', 'types', 'other'],
        description: 'Category of the issue',
      },
    },
    required: ['error', 'solution'],
  },
};

interface ReportIssueArgs {
  error: string;
  solution: string;
  code?: string;
  category?: 'schema' | 'validation' | 'behavior' | 'react' | 'types' | 'other';
}

export async function reportIssueTool(args: ReportIssueArgs): Promise<{
  content: Array<{ type: 'text'; text: string }>;
}> {
  const { error, solution, code, category } = args;

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
    code: code || null,
    category: category || 'other',
  };

  // Append to JSONL file
  const issuesFile = join(reformerDir, 'issues.jsonl');
  appendFileSync(issuesFile, JSON.stringify(issue) + '\n', 'utf-8');

  return {
    content: [
      {
        type: 'text',
        text: `Issue reported successfully.\n\nCategory: ${issue.category}\nStored in: ${issuesFile}`,
      },
    ],
  };
}
