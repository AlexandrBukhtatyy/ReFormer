#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../..');
const distEntry = resolve(__dirname, '../dist/prompts/index.js');
const distEntryUrl = pathToFileURL(distEntry).href;

// Pin cwd so prompts that read spec files / detect stack are deterministic.
process.chdir(repoRoot);

const outDir = resolve(repoRoot, process.argv[2] ?? '.tmp/baseline');
mkdirSync(outDir, { recursive: true });

const FIXTURES = {
  code: '// SNAPSHOT_FIXTURE_CODE\nconst form = createForm({ name: { value: "" } });',
  requirements: 'SNAPSHOT_FIXTURE_REQS: rule A; rule B.',
  description: 'SNAPSHOT_FIXTURE_DESC: form with name(string), age(number 18+).',
  steps: 'SNAPSHOT_FIXTURE_STEPS: 1=personal; 2=address; 3=review.',
  specPath: 'docs/specs/credit-application-form.md',
  target: 'core',
};

const mod = await import(distEntryUrl);

const cases = [
  ['debug', mod.getDebugPrompt, { code: FIXTURES.code }],
  ['review', mod.getReviewPrompt, { code: FIXTURES.code }],
  [
    'plan-form',
    mod.getPlanFormPrompt,
    { specPath: FIXTURES.specPath, target: FIXTURES.target, projectPath: repoRoot },
  ],
  [
    'create-form',
    mod.getCreateFormPrompt,
    { description: FIXTURES.description, target: FIXTURES.target, projectPath: repoRoot },
  ],
  [
    'add-validation',
    mod.getAddValidationPrompt,
    { code: FIXTURES.code, requirements: FIXTURES.requirements },
  ],
  [
    'add-behavior',
    mod.getAddBehaviorPrompt,
    { code: FIXTURES.code, requirements: FIXTURES.requirements },
  ],
  [
    'add-form-array',
    mod.getAddFormArrayPrompt,
    { code: FIXTURES.code, requirements: FIXTURES.requirements },
  ],
  [
    'add-wizard',
    mod.getAddWizardPrompt,
    { code: FIXTURES.code, steps: FIXTURES.steps },
  ],
  ['to-renderer', mod.getToRendererPrompt, { code: FIXTURES.code }],
  ['to-renderer-json', mod.getToRendererJsonPrompt, { code: FIXTURES.code }],
];

let failures = 0;
for (const [name, fn, args] of cases) {
  if (typeof fn !== 'function') {
    console.error(`[snapshot] missing getter for "${name}"`);
    failures++;
    continue;
  }
  try {
    const result = fn(args);
    const text = result?.messages?.[0]?.content?.text;
    if (typeof text !== 'string') {
      console.error(`[snapshot] "${name}" returned non-string text`);
      failures++;
      continue;
    }
    writeFileSync(resolve(outDir, `${name}.txt`), text, 'utf-8');
    console.log(`[snapshot] ${name}: ${text.length} chars`);
  } catch (err) {
    console.error(`[snapshot] "${name}" threw:`, err);
    failures++;
  }
}

if (failures > 0) {
  console.error(`[snapshot] ${failures} failure(s)`);
  process.exit(1);
}
console.log(`[snapshot] OK → ${outDir}`);
