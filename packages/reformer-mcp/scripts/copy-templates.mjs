#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = resolve(__dirname, '../src/prompts/templates');
const dst = resolve(__dirname, '../dist/prompts/templates');

if (!existsSync(src)) {
  console.warn(`[copy-templates] source missing: ${src} — skipping`);
  process.exit(0);
}

mkdirSync(dst, { recursive: true });
cpSync(src, dst, {
  recursive: true,
  filter: (file) => {
    // copy directories + .md only
    return file.endsWith('.md') || !file.includes('.');
  },
});
console.log(`[copy-templates] ${src} → ${dst}`);
