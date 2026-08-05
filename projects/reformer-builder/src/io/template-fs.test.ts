/**
 * Интеграция шаблонов с файловой системой на in-memory реализации File System Access API:
 * запись каталога шаблона, чтение обратно, удаление. Живой пикер каталога автоматизацией не
 * проходится, поэтому механику round-trip проверяем здесь.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { resetRuntimeState, setRuntimeConfig } from '../config/state';
import { createFileDeep, listFilesDeep, listSubdirectories, readTextFile } from './fs-ops';
import {
  deleteProjectTemplate,
  loadProjectTemplates,
  saveProjectTemplate,
  templatesDir,
  updateProjectManifest,
} from './template-repo';
import { fakeRoot as newRoot } from './__fixtures__/fake-fs';
import type { FormTemplate } from '../templates';

afterEach(resetRuntimeState);

const template = (over: Partial<FormTemplate> = {}): FormTemplate => ({
  id: 'credit-form',
  name: 'Кредитная форма',
  description: 'wizard + валидация',
  source: 'project',
  files: [
    { path: 'index.tsx', content: 'export default function __FormName__Form() {}' },
    { path: 'ui/head.tsx', content: '// __form-name__ head' },
  ],
  requires: { 'index.tsx': ['ui/head.tsx'] },
  createdAt: '2026-08-05T00:00:00.000Z',
  ...over,
});

describe('fs-ops: вложенные пути', () => {
  it('createFileDeep создаёт промежуточные каталоги, readTextFile читает', async () => {
    const root = newRoot();
    await createFileDeep(root, 'forms/profile', 'ui/nested/head.tsx', 'hello');
    expect(await readTextFile(root, 'forms/profile/ui/nested/head.tsx')).toBe('hello');
  });

  it('listFilesDeep рекурсивен и сортирован, отсутствующий каталог — пусто', async () => {
    const root = newRoot();
    await createFileDeep(root, 'a', 'b/second.ts', '2');
    await createFileDeep(root, 'a', 'first.ts', '1');
    expect(await listFilesDeep(root, 'a')).toEqual(['b/second.ts', 'first.ts'].sort());
    expect(await listFilesDeep(root, 'нет-такого')).toEqual([]);
  });

  it('listSubdirectories отдаёт только папки', async () => {
    const root = newRoot();
    await createFileDeep(root, 'x', 'one/a.ts', '');
    await createFileDeep(root, 'x', 'two/b.ts', '');
    await createFileDeep(root, 'x', 'file.ts', '');
    expect(await listSubdirectories(root, 'x')).toEqual(['one', 'two']);
  });
});

describe('template-repo: проектные шаблоны', () => {
  it('round-trip: сохранение → чтение возвращает файлы и метаданные', async () => {
    const root = newRoot();
    const saved = await saveProjectTemplate(root, template(), 'credit-form');
    expect(saved.id).toBe('credit-form');

    const [loaded] = await loadProjectTemplates(root);
    expect(loaded.name).toBe('Кредитная форма');
    expect(loaded.description).toBe('wizard + валидация');
    expect(loaded.source).toBe('project');
    expect(loaded.requires).toEqual({ 'index.tsx': ['ui/head.tsx'] });
    expect(loaded.files.map((f) => f.path)).toEqual(['index.tsx', 'ui/head.tsx']);
    expect(loaded.files[0].content).toContain('__FormName__Form');
  });

  it('манифест не попадает в состав файлов, но лежит рядом с ними', async () => {
    const root = newRoot();
    await saveProjectTemplate(root, template(), 'credit-form');
    const files = await listFilesDeep(root, `${templatesDir()}/credit-form`);
    expect(files).toContain('template.json');
    const manifest = JSON.parse(
      await readTextFile(root, `${templatesDir()}/credit-form/template.json`)
    );
    expect(manifest).toMatchObject({
      version: '1.0',
      name: 'Кредитная форма',
      baseName: 'credit-form',
    });
    const [loaded] = await loadProjectTemplates(root);
    expect(loaded.files.some((f) => f.path === 'template.json')).toBe(false);
  });

  it('второй шаблон с тем же id получает свободную папку', async () => {
    const root = newRoot();
    await saveProjectTemplate(root, template());
    const second = await saveProjectTemplate(root, template({ name: 'Копия' }));
    expect(second.id).toBe('credit-form-2');
    expect((await loadProjectTemplates(root)).map((t) => t.id)).toEqual([
      'credit-form',
      'credit-form-2',
    ]);
  });

  it('шаблон без манифеста читается: имя — из папки', async () => {
    const root = newRoot();
    await createFileDeep(root, `${templatesDir()}/handmade`, 'model.ts', 'export const x = 1;');
    const [loaded] = await loadProjectTemplates(root);
    expect(loaded).toMatchObject({ id: 'handmade', name: 'handmade', source: 'project' });
    expect(loaded.files).toHaveLength(1);
  });

  it('бинарные файлы в каталоге шаблона пропускаются', async () => {
    const root = newRoot();
    await saveProjectTemplate(root, template());
    await createFileDeep(root, `${templatesDir()}/credit-form`, 'logo.png', '<binary>');
    const [loaded] = await loadProjectTemplates(root);
    expect(loaded.files.map((f) => f.path)).toEqual(['index.tsx', 'ui/head.tsx']);
  });

  it('переименование правит только манифест, файлы остаются', async () => {
    const root = newRoot();
    const saved = await saveProjectTemplate(root, template());
    await updateProjectManifest(root, { ...saved, name: 'Новое имя' });
    const [loaded] = await loadProjectTemplates(root);
    expect(loaded.name).toBe('Новое имя');
    expect(loaded.files).toHaveLength(2);
  });

  it('удаление убирает каталог шаблона', async () => {
    const root = newRoot();
    await saveProjectTemplate(root, template());
    await deleteProjectTemplate(root, 'credit-form');
    expect(await loadProjectTemplates(root)).toEqual([]);
  });

  it('каталог шаблонов берётся из конфига проекта', async () => {
    setRuntimeConfig({ project: { templatesDir: 'tools/templates' } });
    const root = newRoot();
    await saveProjectTemplate(root, template());
    expect(await listSubdirectories(root, 'tools/templates')).toEqual(['credit-form']);
  });
});
