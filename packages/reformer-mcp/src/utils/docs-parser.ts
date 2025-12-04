import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Cache for documentation content
let docsCache: string | null = null;

/**
 * Possible paths to find llms.txt
 */
function getDocsPaths(): string[] {
  return [
    // In node_modules (when installed as dependency)
    resolve(process.cwd(), 'node_modules/@reformer/core/llms.txt'),
    // In monorepo (during development)
    resolve(__dirname, '../../../reformer/llms.txt'),
    // Relative to current working directory
    resolve(process.cwd(), 'packages/reformer/llms.txt'),
  ];
}

/**
 * Get full documentation content
 */
export function getFullDocs(): string {
  if (docsCache) {
    return docsCache;
  }

  const paths = getDocsPaths();

  for (const p of paths) {
    if (existsSync(p)) {
      try {
        docsCache = readFileSync(p, 'utf-8');
        return docsCache;
      } catch {
        continue;
      }
    }
  }

  return 'ReFormer documentation not found. Please ensure @reformer/core is installed.';
}

/**
 * Clear documentation cache (useful for testing)
 */
export function clearDocsCache(): void {
  docsCache = null;
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
 * Get a specific section from documentation
 */
export function getSection(name: SectionName | string): string {
  const docs = getFullDocs();
  const lines = docs.split('\n');
  const result: string[] = [];
  let inSection = false;
  let sectionLevel = 0;

  for (const line of lines) {
    // Check for section headers (## Section Name)
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

      // End section when we hit same or higher level header
      if (inSection && level <= sectionLevel) {
        break;
      }
    }

    if (inSection) {
      result.push(line);
    }
  }

  if (result.length === 0) {
    return `Section "${name}" not found in documentation.`;
  }

  return result.join('\n').trim();
}

/**
 * Search documentation for a query
 */
export function searchDocs(query: string): string[] {
  const docs = getFullDocs();
  const lines = docs.split('\n');
  const results: string[] = [];
  const queryLower = query.toLowerCase();

  let currentSection: string[] = [];
  let currentSectionTitle = '';

  for (const line of lines) {
    // Track section headers
    if (line.startsWith('## ')) {
      // Save previous section if it matched
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

  // Check last section
  if (
    currentSection.length > 0 &&
    currentSection.some((l) => l.toLowerCase().includes(queryLower))
  ) {
    results.push(currentSection.join('\n'));
  }

  return results;
}

/**
 * Get API reference for a specific method/type
 */
export function getApiMethod(methodName?: string): string {
  const apiSection = getSection('API Reference');

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
    return `Method "${methodName}" not found in API reference.`;
  }

  return result.join('\n').trim();
}

/**
 * Get examples by topic
 */
export function getExamples(topic?: string): string {
  const docs = getFullDocs();

  if (!topic) {
    // Return all code examples
    const codeBlocks: string[] = [];
    const codeBlockRegex = /```[\s\S]*?```/g;
    let match;

    while ((match = codeBlockRegex.exec(docs)) !== null) {
      codeBlocks.push(match[0]);
    }

    return codeBlocks.slice(0, 10).join('\n\n---\n\n');
  }

  // Search for examples related to topic
  const topicLower = topic.toLowerCase();
  const relevantSections: string[] = [];

  // Map topics to sections
  const topicMap: Record<string, string[]> = {
    validation: ['Validation', 'Custom Validator', 'Async Validation', 'Cross-field'],
    behavior: ['Behaviors', 'computeFrom', 'enableWhen', 'watchField'],
    behaviors: ['Behaviors', 'computeFrom', 'enableWhen', 'watchField'],
    array: ['ArrayNode', 'Dynamic Array'],
    arrays: ['ArrayNode', 'Dynamic Array'],
    form: ['Form Schema', 'Quick Start', 'createForm'],
    react: ['React Integration', 'useFormControl'],
    hook: ['useFormControl', 'useFormControlValue'],
    hooks: ['useFormControl', 'useFormControlValue'],
  };

  const sectionsToSearch = topicMap[topicLower] || [topic];

  for (const sectionName of sectionsToSearch) {
    const section = getSection(sectionName);
    if (!section.includes('not found')) {
      relevantSections.push(section);
    }
  }

  if (relevantSections.length === 0) {
    // Fallback to search
    const searchResults = searchDocs(topic);
    return searchResults.join('\n\n---\n\n') || `No examples found for "${topic}".`;
  }

  return relevantSections.join('\n\n---\n\n');
}

/**
 * Get FAQ/troubleshooting information
 */
export function getTroubleshooting(): string {
  return getSection('Troubleshooting / FAQ');
}
