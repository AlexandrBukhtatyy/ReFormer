/**
 * Выгрузка встроенного шаблона в проект.
 *
 * @module plugins/codegen/eject.test
 */

import { describe, expect, it } from 'vitest';
import { parseTargetFile } from '@/lib/codegen';
import type { CodegenTarget } from './contract';
import { ejectTemplate, slugOf } from './eject';
import { createFakeHost } from './testing';
import { USER_TARGETS_DIR } from './user-targets';

const ROOT = 'fake:';
const DIR = [ROOT, ...USER_TARGETS_DIR].join('/');

const registryTarget: CodegenTarget & { readonly order: number } = {
  id: 'codegen.registry',
  path: 'registry.ts',
  cls: 'derived',
  order: 40,
  template: '// registry.ts\n<%= it.registry.fieldWrapper %>\n',
};

const codeTarget: CodegenTarget = {
  id: 'codegen.schema',
  path: 'renderer.schema.json',
  cls: 'derived',
  emit: () => '{}',
};

const deps = (host: ReturnType<typeof createFakeHost>, targets: readonly CodegenTarget[]) => ({
  host,
  targets: () => targets,
});

describe('имя файла', () => {
  it('выводится из хвоста идентификатора', () => {
    expect(slugOf('codegen.registry')).toBe('registry');
    expect(slugOf('user.my-thing')).toBe('my-thing');
  });

  it('небезопасное для имени файла вычищается, пустое не остаётся', () => {
    expect(slugOf('плагин.a/b:c')).toBe('a-b-c');
    expect(slugOf('...')).toBe('target');
  });
});

describe('выгрузка', () => {
  it('пишет файл с заголовком, который разбирается обратно', async () => {
    const host = createFakeHost({ root: ROOT, withSave: true });
    const outcome = await ejectTemplate(deps(host, [registryTarget]), 'codegen.registry');

    expect(outcome).toMatchObject({ kind: 'written', name: 'registry.eta' });
    if (outcome.kind !== 'written') return;

    const text = host.written.get(`${DIR}/registry.eta`) ?? '';
    const parsed = parseTargetFile(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    // Заголовок заполнен так, чтобы файл СРАЗУ заменял исходную цель: иначе человек получил бы
    // вторую цель на тот же путь и отказ `duplicate-path` вместо работающей правки.
    expect(parsed.meta).toMatchObject({
      id: 'user.registry',
      overrides: 'codegen.registry',
      path: 'registry.ts',
      cls: 'derived',
      order: 40,
    });
    // Тело — ровно тот текст, который печатает билдер: в этом весь смысл «скопируй и правь».
    expect(parsed.body).toBe(registryTarget.template);
  });

  it('отправляет записанное в источник, если композиция это умеет', async () => {
    const host = createFakeHost({ root: ROOT, withSave: true });
    await ejectTemplate(deps(host, [registryTarget]), 'codegen.registry');
    expect(host.saved).toEqual([`${DIR}/registry.eta`]);
  });

  it('занятое имя не перезаписывается — подбирается свободное', async () => {
    const host = createFakeHost({
      root: ROOT,
      files: { [`${DIR}/registry.eta`]: 'чужая работа' },
    });
    const outcome = await ejectTemplate(deps(host, [registryTarget]), 'codegen.registry');

    expect(outcome).toMatchObject({ kind: 'written', name: 'registry-2.eta' });
    expect(host.written.get(`${DIR}/registry.eta`)).toBe('чужая работа');
  });
});

describe('отказы называются', () => {
  it('цель печатается кодом — выгружать нечего', async () => {
    const host = createFakeHost({ root: ROOT });
    const outcome = await ejectTemplate(deps(host, [codeTarget]), 'codegen.schema');
    expect(outcome).toMatchObject({ kind: 'not-a-template' });
    expect(host.written.size).toBe(0);
  });

  it('неизвестная цель — тот же отказ, а не бросок', async () => {
    const host = createFakeHost({ root: ROOT });
    expect(await ejectTemplate(deps(host, []), 'нет-такой')).toMatchObject({
      kind: 'not-a-template',
    });
  });

  it('проект не открыт — выгружать некуда', async () => {
    const host = createFakeHost({});
    expect(await ejectTemplate(deps(host, [registryTarget]), 'codegen.registry')).toMatchObject({
      kind: 'no-project',
    });
  });

  it('источник только для чтения — отказ ДО первой записи', async () => {
    const host = createFakeHost({ root: ROOT, write: false });
    expect(await ejectTemplate(deps(host, [registryTarget]), 'codegen.registry')).toMatchObject({
      kind: 'read-only',
    });
    expect(host.written.size).toBe(0);
  });
});
