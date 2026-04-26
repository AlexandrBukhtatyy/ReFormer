import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Known @reformer/* packages with `llms.txt`. Order matters for default
 * "all-packages" iteration: core first, dependents after.
 */
export const KNOWN_PACKAGES = [
  '@reformer/core',
  '@reformer/cdk',
  '@reformer/ui-kit',
  '@reformer/renderer-react',
  '@reformer/renderer-json',
  '@reformer/mcp',
] as const;

export type ReformerPackage = (typeof KNOWN_PACKAGES)[number];

/** Default package used by legacy single-package APIs. */
export const DEFAULT_PACKAGE: ReformerPackage = '@reformer/core';

// Cache for documentation content, keyed by package name.
const docsCache = new Map<string, string>();

/**
 * Map @reformer/<name> → directory name in monorepo packages/.
 * The packages folder uses different naming for some entries.
 */
function packageDirName(pkg: string): string {
  const tail = pkg.replace(/^@reformer\//, '');
  if (tail === 'core') return 'reformer';
  return `reformer-${tail}`;
}

/**
 * Possible paths to find llms.txt for a given package.
 */
function getDocsPaths(pkg: string): string[] {
  const dir = packageDirName(pkg);
  return [
    // In node_modules (when installed as dependency)
    resolve(process.cwd(), 'node_modules', pkg, 'llms.txt'),
    // In monorepo (during development) — relative to this file
    resolve(__dirname, '../../../', dir, 'llms.txt'),
    // Relative to current working directory (cwd inside repo)
    resolve(process.cwd(), 'packages', dir, 'llms.txt'),
  ];
}

/**
 * Get full documentation content for a single package.
 *
 * @param pkg - Package name like "@reformer/cdk". Defaults to "@reformer/core".
 */
export function getFullDocs(pkg: string = DEFAULT_PACKAGE): string {
  const cached = docsCache.get(pkg);
  if (cached !== undefined) return cached;

  for (const p of getDocsPaths(pkg)) {
    if (existsSync(p)) {
      try {
        const content = readFileSync(p, 'utf-8');
        docsCache.set(pkg, content);
        return content;
      } catch {
        continue;
      }
    }
  }

  const fallback = `${pkg} documentation not found. Please ensure ${pkg} is installed or built (run npm run generate:llms).`;
  docsCache.set(pkg, fallback);
  return fallback;
}

/**
 * Concatenate llms.txt of every known package that has it on disk.
 * Useful when an agent asks for "all docs" without a package filter.
 */
export function getAllDocs(): string {
  const parts: string[] = [];
  for (const pkg of KNOWN_PACKAGES) {
    const docs = getFullDocs(pkg);
    if (!docs.startsWith(`${pkg} documentation not found`)) {
      parts.push(`# ===== ${pkg} =====\n\n${docs}`);
    }
  }
  return parts.join('\n\n');
}

/**
 * Return the subset of KNOWN_PACKAGES that actually have llms.txt accessible
 * (file exists and is readable, regardless of its content).
 */
export function listAvailablePackages(): ReformerPackage[] {
  const result: ReformerPackage[] = [];
  for (const pkg of KNOWN_PACKAGES) {
    for (const p of getDocsPaths(pkg)) {
      if (existsSync(p)) {
        result.push(pkg);
        break;
      }
    }
  }
  return result;
}

/**
 * Clear documentation cache (useful for testing).
 */
export function clearDocsCache(): void {
  docsCache.clear();
}

/**
 * Section names in llms.txt
 */
export type SectionName =
  | 'Installation'
  | 'Quick Start'
  | 'Architecture'
  | 'Form Schema'
  | 'Node Types'
  | 'Validation'
  | 'Behaviors'
  | 'React Integration'
  | 'API Reference'
  | 'Common Patterns'
  | 'Troubleshooting / FAQ';

/**
 * Get a specific section from documentation.
 *
 * @param name - Section header to match (case-insensitive substring).
 * @param pkg  - Package to read from. Defaults to "@reformer/core". Pass `'*'` to search across all packages.
 */
export function getSection(name: SectionName | string, pkg: string = DEFAULT_PACKAGE): string {
  const docs = pkg === '*' ? getAllDocs() : getFullDocs(pkg);
  const lines = docs.split('\n');
  const result: string[] = [];
  let inSection = false;
  let sectionLevel = 0;

  for (const line of lines) {
    const headerMatch = line.match(/^(#{1,3})\s+(.+)$/);

    if (headerMatch) {
      const [, hashes, title] = headerMatch;
      const level = hashes.length;

      if (title.toLowerCase().includes(name.toLowerCase())) {
        inSection = true;
        sectionLevel = level;
        result.push(line);
        continue;
      }

      if (inSection && level <= sectionLevel) {
        break;
      }
    }

    if (inSection) {
      result.push(line);
    }
  }

  if (result.length === 0) {
    return `Section "${name}" not found in ${pkg === '*' ? 'any package' : pkg} documentation.`;
  }

  return result.join('\n').trim();
}

/**
 * Search documentation for a query.
 *
 * @param query - Substring to look for (case-insensitive).
 * @param pkg   - Package to search in. Pass `'*'` for all packages.
 */
export function searchDocs(query: string, pkg: string = '*'): string[] {
  const docs = pkg === '*' ? getAllDocs() : getFullDocs(pkg);
  const lines = docs.split('\n');
  const results: string[] = [];
  const queryLower = query.toLowerCase();

  let currentSection: string[] = [];
  let currentSectionTitle = '';

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (
        currentSection.length > 0 &&
        currentSection.some((l) => l.toLowerCase().includes(queryLower))
      ) {
        results.push(currentSection.join('\n'));
      }

      currentSectionTitle = line;
      currentSection = [line];
      continue;
    }

    if (currentSectionTitle) {
      currentSection.push(line);
    }
  }

  if (
    currentSection.length > 0 &&
    currentSection.some((l) => l.toLowerCase().includes(queryLower))
  ) {
    results.push(currentSection.join('\n'));
  }

  return results;
}

/**
 * Get API reference for a specific method/type.
 *
 * @param methodName - Method name to look up. If omitted, returns the entire API Reference section.
 * @param pkg        - Package. Pass `'*'` to scan all packages.
 */
export function getApiMethod(methodName?: string, pkg: string = '*'): string {
  const apiSection = getSection('API Reference', pkg);

  if (!methodName) {
    return apiSection;
  }

  const lines = apiSection.split('\n');
  const result: string[] = [];
  let inMethod = false;
  let methodLevel = 0;

  for (const line of lines) {
    const headerMatch = line.match(/^(#{1,4})\s+(.+)$/);

    if (headerMatch) {
      const [, hashes, title] = headerMatch;
      const level = hashes.length;

      if (title.toLowerCase().includes(methodName.toLowerCase())) {
        inMethod = true;
        methodLevel = level;
        result.push(line);
        continue;
      }

      if (inMethod && level <= methodLevel) {
        break;
      }
    }

    if (inMethod) {
      result.push(line);
    }
  }

  if (result.length === 0) {
    return `Method "${methodName}" not found in API reference of ${pkg === '*' ? 'any package' : pkg}.`;
  }

  return result.join('\n').trim();
}

/**
 * Get examples by topic.
 *
 * @param topic - Topic keyword (validation, behaviors, hooks, …). Without a topic,
 *                returns up to 10 first code blocks from all docs.
 * @param pkg   - Package to search. Pass `'*'` for all (default).
 */
export function getExamples(topic?: string, pkg: string = '*'): string {
  const docs = pkg === '*' ? getAllDocs() : getFullDocs(pkg);

  if (!topic) {
    const codeBlocks: string[] = [];
    const codeBlockRegex = /```[\s\S]*?```/g;
    let match;

    while ((match = codeBlockRegex.exec(docs)) !== null) {
      codeBlocks.push(match[0]);
    }

    return codeBlocks.slice(0, 10).join('\n\n---\n\n');
  }

  const topicLower = topic.toLowerCase();
  const relevantSections: string[] = [];

  const topicMap: Record<string, string[]> = {
    validation: ['Validation', 'Custom Validator', 'Async Validation', 'Cross-field'],
    behavior: ['Behaviors', 'computeFrom', 'enableWhen', 'watchField'],
    behaviors: ['Behaviors', 'computeFrom', 'enableWhen', 'watchField'],
    array: ['ArrayNode', 'Dynamic Array', 'FormArray'],
    arrays: ['ArrayNode', 'Dynamic Array', 'FormArray'],
    wizard: ['FormWizard', 'Multi-step'],
    form: ['Form Schema', 'Quick Start', 'createForm'],
    react: ['React Integration', 'useFormControl'],
    hook: ['useFormControl', 'useFormControlValue'],
    hooks: ['useFormControl', 'useFormControlValue'],
  };

  const sectionsToSearch = topicMap[topicLower] || [topic];

  for (const sectionName of sectionsToSearch) {
    const section = getSection(sectionName, pkg);
    if (!section.includes('not found')) {
      relevantSections.push(section);
    }
  }

  if (relevantSections.length === 0) {
    const searchResults = searchDocs(topic, pkg);
    return searchResults.join('\n\n---\n\n') || `No examples found for "${topic}".`;
  }

  return relevantSections.join('\n\n---\n\n');
}

/**
 * Get FAQ/troubleshooting information.
 *
 * @param pkg - Package. Pass `'*'` (default) to merge troubleshooting from all packages.
 */
export function getTroubleshooting(pkg: string = '*'): string {
  return getSection('Troubleshooting / FAQ', pkg);
}
