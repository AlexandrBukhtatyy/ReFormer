import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { classifyFormSchema, isIgnoredDir, shouldScanFile } from './discovery';

const here = path.dirname(fileURLToPath(import.meta.url));
const exampleDir = path.resolve(
  here,
  '../../../react-playground/src/pages/examples/complex-multy-step-form-renderer-json'
);
const readJson = (p: string) => JSON.parse(readFileSync(p, 'utf8'));

describe('classifyFormSchema — дискриминатор meta-vs-form (§7.2)', () => {
  it('реальная json-schema.json → форма, high (есть $schema→form-schema)', () => {
    const json = readJson(path.join(exampleDir, 'json-schema.json'));
    expect(classifyFormSchema(json)).toEqual({ isForm: true, confidence: 'high' });
  });

  it('form-schema.schema.json (draft-07 JSON Schema) → НЕ форма', () => {
    const json = readJson(path.join(exampleDir, 'form-schema.schema.json'));
    expect(classifyFormSchema(json).isForm).toBe(false);
  });

  it('package.json → НЕ форма', () => {
    const json = readJson(path.resolve(here, '../../package.json'));
    expect(classifyFormSchema(json).isForm).toBe(false);
  });

  it('форма без $schema → medium (эвристика по shape)', () => {
    const json = {
      version: '1.0',
      root: { component: '$component(Box)', children: [{ value: '$model(a)' }] },
    };
    expect(classifyFormSchema(json)).toEqual({ isForm: true, confidence: 'medium' });
  });
});

describe('фильтры сканирования', () => {
  it('isIgnoredDir', () => {
    expect(isIgnoredDir('node_modules')).toBe(true);
    expect(isIgnoredDir('.git')).toBe(true);
    expect(isIgnoredDir('src')).toBe(false);
  });

  it('shouldScanFile', () => {
    expect(shouldScanFile('credit.form.json')).toBe(true);
    expect(shouldScanFile('json-schema.json')).toBe(true);
    expect(shouldScanFile('package.json')).toBe(false);
    expect(shouldScanFile('package-lock.json')).toBe(false);
    expect(shouldScanFile('main.tsx')).toBe(false);
  });
});
