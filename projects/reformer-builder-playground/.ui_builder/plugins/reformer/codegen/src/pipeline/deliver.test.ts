import { describe, expect, it } from 'vitest';
import { withMarker } from '@reformer/builder-toolkit';
import type { ResourceId } from '@reformer/builder-plugin-api';
import { deliverModule, SourceReadOnlyError } from './deliver';
import type { ModuleFile } from './generate';
import { createFakeHost } from '../testing';

const PARENT = 'src/pages' as ResourceId;

const file = (over: Partial<ModuleFile> & Pick<ModuleFile, 'path'>): ModuleFile => ({
  content: 'тело\n',
  cls: 'derived',
  regenerable: false,
  targetId: `t:${over.path}`,
  origin: 'builtin',
  ...over,
});

describe('доставка модуля', () => {
  it('пишет в рабочую область по адресам, которые строит платформа', async () => {
    const host = createFakeHost();
    const result = await deliverModule(host, PARENT, 'my-form', [file({ path: 'types.ts' })]);
    expect(result.dir).toBe('src/pages/my-form');
    expect(result.written).toEqual(['types.ts']);
    expect(host.written.get('src/pages/my-form/types.ts')).toBe('тело\n');
  });

  it('источник без записи отказывает ДО первой записи', async () => {
    const host = createFakeHost({ write: false });
    await expect(
      deliverModule(host, PARENT, 'my-form', [file({ path: 'types.ts' })])
    ).rejects.toBeInstanceOf(SourceReadOnlyError);
    expect(host.written.size).toBe(0);
  });

  it('производный файл перезаписывается даже если его правили', async () => {
    const host = createFakeHost({ files: { 'src/pages/my-form/types.ts': 'моя правка\n' } });
    const result = await deliverModule(host, PARENT, 'my-form', [file({ path: 'types.ts' })]);
    expect(result.written).toEqual(['types.ts']);
  });

  it('авторский файл не перезаписывается никогда, и пропуск НАЗЫВАЕТСЯ', async () => {
    const host = createFakeHost({ files: { 'src/pages/my-form/api.ts': 'мой бэкенд\n' } });
    const result = await deliverModule(host, PARENT, 'my-form', [
      file({ path: 'api.ts', cls: 'user' }),
    ]);
    expect(result.written).toEqual([]);
    expect(result.skipped).toEqual([{ path: 'api.ts', reason: 'authored' }]);
    expect(host.written.get('src/pages/my-form/api.ts')).toBe('мой бэкенд\n');
  });

  it('выводимый из правил файл перезаписывается, пока маркер сходится', async () => {
    const host = createFakeHost({
      files: { 'src/pages/my-form/validation.ts': withMarker('старое\n') },
    });
    const result = await deliverModule(host, PARENT, 'my-form', [
      file({ path: 'validation.ts', cls: 'user', regenerable: true, content: 'новое\n' }),
    ]);
    expect(result.written).toEqual(['validation.ts']);
    expect(host.written.get('src/pages/my-form/validation.ts')).toBe('новое\n');
  });

  it('правленный руками выводимый файл пропускается с ДРУГОЙ причиной', async () => {
    const host = createFakeHost({
      files: { 'src/pages/my-form/validation.ts': `${withMarker('старое\n')}// моя правка\n` },
    });
    const result = await deliverModule(host, PARENT, 'my-form', [
      file({ path: 'validation.ts', cls: 'user', regenerable: true, content: 'новое\n' }),
    ]);
    expect(result.skipped).toEqual([{ path: 'validation.ts', reason: 'edited' }]);
  });

  it('отказ одной записи не отменяет остальные', async () => {
    const host = createFakeHost();
    const broken = { ...host };
    broken.writeText = async (id, text) => {
      if (id.endsWith('bad.ts')) throw new Error('диск полон');
      await host.writeText(id, text);
    };
    const result = await deliverModule(broken, PARENT, 'my-form', [
      file({ path: 'bad.ts' }),
      file({ path: 'good.ts' }),
    ]);
    expect(result.written).toEqual(['good.ts']);
    expect(result.failed).toEqual([{ path: 'bad.ts', message: 'диск полон' }]);
  });

  it('без save записанное остаётся рабочей копией, и это видно в отчёте', async () => {
    const host = createFakeHost();
    const result = await deliverModule(host, PARENT, 'my-form', [file({ path: 'types.ts' })]);
    expect(result.saved).toBeNull();
  });

  it('с save отправляет в источник ровно записанные адреса', async () => {
    const host = createFakeHost({ withSave: true });
    const result = await deliverModule(host, PARENT, 'my-form', [
      file({ path: 'types.ts' }),
      file({ path: 'model.ts' }),
    ]);
    expect(result.saved).toBe(true);
    expect(host.saved).toEqual(['src/pages/my-form/types.ts', 'src/pages/my-form/model.ts']);
  });
});

describe('доставка: папки шагов, которых нет в модуле', () => {
  const DIR = 'src/pages/my-form';
  const step = (dir: string, name = 'form.validation.ts'): ModuleFile =>
    file({ path: `steps/${dir}/${name}`, cls: 'user', regenerable: true });

  it('называет папку шага на диске, которой нет среди файлов, и НЕ удаляет её', async () => {
    const host = createFakeHost({
      files: {
        [`${DIR}/steps/dannye/validation.ts`]: 'старое\n',
        [`${DIR}/steps/kontakty/validation.ts`]: 'моя валидация\n',
      },
    });
    const result = await deliverModule(host, PARENT, 'my-form', [
      step('dannye'),
      step('adres'),
      file({ path: 'steps/index.ts' }),
    ]);
    expect(result.orphans).toEqual(['steps/kontakty']);
    expect(host.written.get(`${DIR}/steps/kontakty/validation.ts`)).toBe('моя валидация\n');
  });

  it('при записи одной цели сироты считаются по ВСЕМУ модулю', async () => {
    const host = createFakeHost({
      files: { [`${DIR}/steps/dannye/validation.ts`]: 'x\n' },
    });
    const module = [file({ path: 'types.ts' }), step('dannye')];
    const result = await deliverModule(host, PARENT, 'my-form', [module[0]], { module });
    expect(result.orphans).toEqual([]);
  });

  it('простая форма без steps/ сирот не имеет', async () => {
    const host = createFakeHost();
    const result = await deliverModule(host, PARENT, 'my-form', [file({ path: 'types.ts' })]);
    expect(result.orphans).toEqual([]);
    expect(result.legacy).toEqual([]);
  });
});

describe('доставка: прежние имена файлов', () => {
  const DIR = 'src/pages/my-form';
  const render = (content = 'свежий\n'): ModuleFile =>
    file({
      path: 'form.render.ts',
      cls: 'user',
      regenerable: true,
      content,
      legacyPaths: ['renderer.behavior.ts'],
    });

  it('правленный руками старый файл ПЕРЕНОСИТСЯ под новое имя, старый остаётся', async () => {
    const edited = `${withMarker('старое\n')}// моя правка\n`;
    const host = createFakeHost({ files: { [`${DIR}/renderer.behavior.ts`]: edited } });
    const result = await deliverModule(host, PARENT, 'my-form', [render()]);
    expect(result.legacy).toEqual([
      { path: 'renderer.behavior.ts', replacedBy: 'form.render.ts', carried: true },
    ]);
    expect(result.written).toEqual(['form.render.ts']);
    expect(host.written.get(`${DIR}/form.render.ts`)).toBe(edited);
    expect(host.written.get(`${DIR}/renderer.behavior.ts`)).toBe(edited);
  });

  it('нетронутый старый файл НЕ переносится: под новым именем печатается свежий текст', async () => {
    const host = createFakeHost({
      files: { [`${DIR}/renderer.behavior.ts`]: withMarker('старое\n') },
    });
    const result = await deliverModule(host, PARENT, 'my-form', [render()]);
    expect(result.legacy).toEqual([
      { path: 'renderer.behavior.ts', replacedBy: 'form.render.ts', carried: false },
    ]);
    expect(host.written.get(`${DIR}/form.render.ts`)).toBe('свежий\n');
  });

  it('производный файл (схема) печатается заново, даже если старый правили', async () => {
    const host = createFakeHost({ files: { [`${DIR}/renderer.schema.json`]: '{"мой":1}' } });
    const result = await deliverModule(host, PARENT, 'my-form', [
      file({ path: 'form.schema.json', content: '{}', legacyPaths: ['renderer.schema.json'] }),
    ]);
    expect(result.legacy).toEqual([
      { path: 'renderer.schema.json', replacedBy: 'form.schema.json', carried: false },
    ]);
    expect(host.written.get(`${DIR}/form.schema.json`)).toBe('{}');
  });

  it('если новый файл уже есть, старое имя больше не вспоминается', async () => {
    const host = createFakeHost({
      files: {
        [`${DIR}/renderer.behavior.ts`]: 'давнее\n',
        [`${DIR}/form.render.ts`]: withMarker('текущее\n'),
      },
    });
    const result = await deliverModule(host, PARENT, 'my-form', [render()]);
    expect(result.legacy).toEqual([]);
    expect(host.written.get(`${DIR}/form.render.ts`)).toBe('свежий\n');
  });
});
