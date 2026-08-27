/**
 * Синхронизация схем формы на диск.
 *
 * Проверяется то, чего раньше не было вовсе: изменённый файл рабочей копии ДОЕЗЖАЕТ до диска, а
 * совпавший — не трогается. Прежний путь (экспорт со skip-if-exists) на оба вопроса отвечал
 * одинаково — «пропустить», и правки правил на диск не попадали никогда.
 */

import { describe, expect, it } from 'vitest';
import { fakeRoot } from './__fixtures__/fake-fs';
import { createFileDeep, readTextFile } from './fs-ops';
import { commitSourcesSave, describePlan, planSourcesSave } from './save-sources';

const FILES = ['validation.ts', 'form.behavior.ts', 'renderer.behavior.ts'] as const;
const FORM = 'src/forms/loan/renderer.schema.json';

async function withDisk(files: Record<string, string>): Promise<FileSystemDirectoryHandle> {
  const root = fakeRoot();
  for (const [name, content] of Object.entries(files)) {
    await createFileDeep(root, 'src/forms/loan', name, content);
  }
  return root;
}

describe('planSourcesSave', () => {
  it('совпавший с диском файл не попадает в план', async () => {
    const root = await withDisk({ 'validation.ts': 'одно и то же' });
    const plan = await planSourcesSave(root, FORM, { 'validation.ts': 'одно и то же' }, FILES);
    expect(plan.changes).toEqual([]);
    expect(plan.unchanged).toEqual(['validation.ts']);
  });

  it('изменённый файл попадает со счётчиком строк', async () => {
    const root = await withDisk({ 'validation.ts': 'было\nдве строки' });
    const plan = await planSourcesSave(root, FORM, { 'validation.ts': 'стало\nдве строки' }, FILES);
    expect(plan.changes).toHaveLength(1);
    expect(plan.changes[0]).toMatchObject({
      name: 'validation.ts',
      created: false,
      added: 1,
      removed: 1,
    });
  });

  it('отсутствующий на диске файл помечается созданием, а не правкой', async () => {
    const root = await withDisk({});
    const plan = await planSourcesSave(root, FORM, { 'validation.ts': 'новый' }, FILES);
    expect(plan.changes[0]).toMatchObject({ created: true, oldText: '' });
  });

  it('файлы вне списка не синхронизируются', async () => {
    // Рабочая копия содержит модуль целиком; тащить на диск `types.ts` и `registry.ts` значило бы
    // перезаписывать пользователю то, чего он не просил.
    const root = await withDisk({});
    const plan = await planSourcesSave(
      root,
      FORM,
      { 'validation.ts': 'a', 'types.ts': 'b', 'registry.ts': 'c' },
      FILES
    );
    expect(plan.changes.map((c) => c.name)).toEqual(['validation.ts']);
  });

  it('каталог берётся из пути формы', async () => {
    const root = await withDisk({});
    const plan = await planSourcesSave(root, FORM, { 'validation.ts': 'a' }, FILES);
    expect(plan.dir).toBe('src/forms/loan');
  });
});

describe('commitSourcesSave', () => {
  it('записывает запланированное и ничего сверх', async () => {
    const root = await withDisk({ 'validation.ts': 'старое', 'form.behavior.ts': 'не трогать' });
    const plan = await planSourcesSave(
      root,
      FORM,
      { 'validation.ts': 'новое', 'form.behavior.ts': 'не трогать' },
      FILES
    );
    const written = await commitSourcesSave(root, plan);

    expect(written).toEqual(['validation.ts']);
    expect(await readTextFile(root, 'src/forms/loan/validation.ts')).toBe('новое');
    expect(await readTextFile(root, 'src/forms/loan/form.behavior.ts')).toBe('не трогать');
  });

  it('создаёт файл, которого не было', async () => {
    const root = await withDisk({});
    const plan = await planSourcesSave(root, FORM, { 'renderer.behavior.ts': 'x' }, FILES);
    await commitSourcesSave(root, plan);
    expect(await readTextFile(root, 'src/forms/loan/renderer.behavior.ts')).toBe('x');
  });
});

describe('describePlan', () => {
  it('называет каждый файл и что с ним будет', async () => {
    const root = await withDisk({ 'validation.ts': 'a' });
    const plan = await planSourcesSave(
      root,
      FORM,
      { 'validation.ts': 'b', 'form.behavior.ts': 'c' },
      FILES
    );
    const text = describePlan(plan);
    expect(text).toContain('validation.ts');
    expect(text).toContain('form.behavior.ts — создать');
  });
});
