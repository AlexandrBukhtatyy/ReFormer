/**
 * Script to generate llms.txt from docs/llms/*.md files
 *
 * Usage: npx tsx scripts/generate-llms.ts
 *
 * This script:
 * 1. Reads all .md files from docs/llms/ directory
 * 2. Sorts them by filename (01-, 02-, etc.)
 * 3. Concatenates them into a single llms.txt file
 * 4. Adds a header with the document title
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DOCS_DIR = join(__dirname, '../docs/llms');
const OUTPUT_FILE = join(__dirname, '../llms.txt');

const HEADER = `# @reformer/cdk - LLM Integration Guide

Headless UI components for @reformer/core forms.

`;

function getMarkdownFiles(): string[] {
  if (!existsSync(DOCS_DIR)) {
    console.error(`Error: docs/llms directory not found at ${DOCS_DIR}`);
    process.exit(1);
  }

  const files = readdirSync(DOCS_DIR)
    .filter((file) => file.endsWith('.md'))
    .sort((a, b) => {
      // Sort by numeric prefix (01-, 02-, etc.)
      const numA = parseInt(a.split('-')[0], 10) || 0;
      const numB = parseInt(b.split('-')[0], 10) || 0;
      return numA - numB;
    });

  return files;
}

function readFileContent(filename: string): string {
  const filepath = join(DOCS_DIR, filename);
  try {
    return readFileSync(filepath, 'utf-8');
  } catch (error) {
    console.error(`Error reading file: ${filename}`, error);
    return '';
  }
}

function generateLlmsTxt(): void {
  console.log('Generating llms.txt...');

  const files = getMarkdownFiles();
  console.log(`Found ${files.length} markdown files:`);
  files.forEach((f) => console.log(`  - ${f}`));

  const sections: string[] = [];

  for (const file of files) {
    const content = readFileContent(file);
    if (content) {
      // Remove any HTML comments (like AUTO-GENERATED markers)
      const cleanContent = content.replace(/<!--[\s\S]*?-->/g, '').trim();
      sections.push(cleanContent);
    }
  }

  const output = HEADER + sections.join('\n\n');

  writeFileSync(OUTPUT_FILE, output, 'utf-8');
  console.log(`\nGenerated: ${OUTPUT_FILE}`);
  console.log(`Total size: ${output.length} characters`);
}

// Run
generateLlmsTxt();
