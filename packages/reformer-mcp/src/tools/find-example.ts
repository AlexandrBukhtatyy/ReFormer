import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { findSymbol, getPublicSymbols } from '../utils/symbols-parser.js';
import { KNOWN_PACKAGES } from '../utils/docs-parser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Mapping of scenario keywords to playground example files (relative to repo root).
 * The first match wins; multiple keywords can point to the same file.
 */
const SCENARIO_MAP: Record<string, { path: string; title: string }> = {
  // Wizard / multi-step
  wizard: {
    path: 'projects/react-playground/src/pages/examples/complex-multy-step-form/CreditApplicationForm.tsx',
    title: 'Multi-step wizard with FormArray (TS RenderSchema)',
  },
  'multi-step': {
    path: 'projects/react-playground/src/pages/examples/complex-multy-step-form/CreditApplicationForm.tsx',
    title: 'Multi-step wizard with FormArray',
  },
  // FormArray
  array: {
    path: 'projects/react-playground/src/pages/examples/complex-multy-step-form/CreditApplicationForm.tsx',
    title: 'FormArray inside multi-step wizard',
  },
  'form-array': {
    path: 'projects/react-playground/src/pages/examples/complex-multy-step-form/CreditApplicationForm.tsx',
    title: 'FormArray usage',
  },
  // Renderer (TS)
  renderer: {
    path: 'projects/react-playground/src/pages/examples/complex-multy-step-form-renderer/CreditApplicationFormRenderer.tsx',
    title: 'Form rendered through @reformer/renderer-react',
  },
  'renderer-react': {
    path: 'projects/react-playground/src/pages/examples/complex-multy-step-form-renderer/CreditApplicationFormRenderer.tsx',
    title: 'Form rendered through @reformer/renderer-react',
  },
  // Renderer (JSON)
  json: {
    path: 'projects/react-playground/src/pages/examples/complex-multy-step-form-renderer-json/CreditApplicationFormRendererJson.tsx',
    title: 'Form built from JSON schema',
  },
  'renderer-json': {
    path: 'projects/react-playground/src/pages/examples/complex-multy-step-form-renderer-json/CreditApplicationFormRendererJson.tsx',
    title: 'Form built from JSON schema',
  },
  'json-schema': {
    path: 'projects/react-playground/src/pages/examples/complex-multy-step-form-renderer-json/json-schema.ts',
    title: 'JSON schema definition for renderer-json',
  },
  // Simple form
  simple: {
    path: 'projects/react-playground/src/pages/examples/simple-form/RegistrationForm.tsx',
    title: 'Simple registration form',
  },
  basic: {
    path: 'projects/react-playground/src/pages/examples/simple-form/RegistrationForm.tsx',
    title: 'Basic form',
  },
  // Behaviors
  behavior: {
    path: 'projects/react-playground/src/pages/examples/behaviors/BehaviorsExamples.tsx',
    title: 'Form behaviors gallery',
  },
  behaviors: {
    path: 'projects/react-playground/src/pages/examples/behaviors/BehaviorsExamples.tsx',
    title: 'Form behaviors gallery',
  },
  // Validation
  validation: {
    path: 'projects/react-playground/src/pages/examples/validation/ValidationExamples.tsx',
    title: 'Validation showcase',
  },
  'async-validation': {
    path: 'projects/react-playground/src/pages/examples/simple-form/RegistrationForm.tsx',
    title: 'Async validation in registration form',
  },
};

export const findExampleToolDefinition = {
  name: 'find_example',
  description:
    'Find a reference example in projects/react-playground for a given scenario (wizard, array, renderer, json, simple, behaviors, validation, async-validation). Falls back to JSDoc @example blocks of public symbols if no playground match exists. Returns a file reference and a snippet/excerpt agents can copy.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      scenario: {
        type: 'string',
        description:
          'Scenario keyword. Built-in: wizard, multi-step, array, form-array, renderer, renderer-react, json, renderer-json, json-schema, simple, basic, behavior(s), validation, async-validation. Anything else is matched against public symbol names across all @reformer/* packages.',
      },
      maxLines: {
        type: 'number',
        description: 'Limit lines of the returned snippet. Default 200.',
      },
    },
    required: ['scenario'],
  },
};

export interface FindExampleArgs {
  scenario: string;
  maxLines?: number;
}

export async function findExampleTool(
  args: FindExampleArgs,
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const key = args.scenario.toLowerCase().trim();
  const limit = Math.max(20, Math.min(args.maxLines ?? 200, 1000));

  const direct = SCENARIO_MAP[key];
  if (direct) {
    const repoRoot = locateRepoRoot();
    const abs = resolve(repoRoot, direct.path);
    if (existsSync(abs)) {
      const text = readFileSync(abs, 'utf-8');
      return {
        content: [
          {
            type: 'text',
            text:
              `# ${direct.title}\n\n` +
              `**Source:** ${direct.path}\n\n` +
              '```tsx\n' +
              truncateLines(text, limit) +
              '\n```',
          },
        ],
      };
    }
  }

  // Fallback: try to match scenario against a public symbol name and return its @example.
  const sym = findSymbol(args.scenario);
  if (sym) {
    const examples = sym.tags.filter((t) => t.tag === 'example');
    if (examples.length > 0) {
      return {
        content: [
          {
            type: 'text',
            text:
              `# ${sym.name} — JSDoc @example (${sym.package})\n\n` +
              `**Source:** ${sym.sourcePath}\n\n` +
              examples.map((e) => e.text).join('\n\n---\n\n'),
          },
        ],
      };
    }
  }

  // Fallback 2: list known scenarios + symbol-search hint.
  const known = Object.keys(SCENARIO_MAP).join(', ');
  const symbolNames = KNOWN_PACKAGES.flatMap((p) => getPublicSymbols(p))
    .map((s) => s.name)
    .slice(0, 15)
    .join(', ');
  return {
    content: [
      {
        type: 'text',
        text:
          `No example found for "${args.scenario}".\n\n` +
          `Known scenarios: ${known}.\n` +
          `Or pass a public symbol name. Sample symbols: ${symbolNames}, ...`,
      },
    ],
  };
}

function truncateLines(text: string, limit: number): string {
  const lines = text.split(/\r?\n/);
  if (lines.length <= limit) return text;
  return lines.slice(0, limit).join('\n') + `\n// … (truncated, ${lines.length - limit} more lines)`;
}

function locateRepoRoot(): string {
  // dist/tools/find-example.js → ../../../.. = repo root (packages/reformer-mcp/dist/tools/ → repo).
  let dir = __dirname;
  for (let i = 0; i < 6; i++) {
    if (existsSync(resolve(dir, 'package.json'))) {
      try {
        const pkg = JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf-8'));
        if (pkg.name === 'reformer-monorepo' || pkg.workspaces) return dir;
      } catch {
        // ignore
      }
    }
    dir = dirname(dir);
  }
  // Fallback to cwd if we're invoked from inside the repo.
  return process.cwd();
}
