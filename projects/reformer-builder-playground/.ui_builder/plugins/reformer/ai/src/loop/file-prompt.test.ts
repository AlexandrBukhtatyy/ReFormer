import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { builtinEntries } from '../../../core/testing';
import { listComponents } from '../model/catalog-digest';
import { fileSystemPrompt } from './file-prompt';

describe('промпт режима файлов', () => {
  it('побайтово один и тот же для одного каталога — иначе кэш префикса не попадает', () => {
    const catalog = builtinEntries();
    expect(fileSystemPrompt(catalog)).toBe(fileSystemPrompt(catalog));
    expect(fileSystemPrompt(builtinEntries())).toBe(fileSystemPrompt(catalog));
  });

  it('имена полей — из каталога кита', () => {
    const catalog = builtinEntries();
    const prompt = fileSystemPrompt(catalog);
    for (const { name } of listComponents(catalog, { role: 'field' }))
      expect(prompt).toContain(name);
  });

  it('учит формату документа и раскладке модуля', () => {
    const prompt = fileSystemPrompt(builtinEntries());
    expect(prompt).toContain('schema/form.schema.json');
    expect(prompt).toContain('"$ref": "./steps/<step>/form.schema.json"');
    expect(prompt).toContain('$model(applicant.email)');
    expect(prompt).toMatch(/rejected and NOT written/);
  });

  it('в исходнике нет ни одного имени кита — только в собранном промпте', () => {
    const source = readFileSync(
      fileURLToPath(new URL('./file-prompt.ts', import.meta.url)),
      'utf8'
    );
    for (const { name } of listComponents(builtinEntries(), { role: 'field' })) {
      expect(source, name).not.toMatch(new RegExp(`\\b${name}\\b`));
    }
  });
});
