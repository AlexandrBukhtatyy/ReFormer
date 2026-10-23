import { describe, expect, it } from 'vitest';
import { withMarker } from '@reformer/builder-toolkit';
import type { CodegenFile, CodegenNote, ResourceId } from '@reformer/builder-plugin-api';
import { deliverInto, DeliveryRefusedError, SourceReadOnlyError } from './deliver';
import { createFakeHost } from '../testing';

const MODULE = 'src/pages/my-form' as ResourceId;

const file = (over: Partial<CodegenFile> & Pick<CodegenFile, 'path'>): CodegenFile => ({
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
    const result = await deliverInto(host, MODULE, [file({ path: 'types/my-form.ts' })]);
    expect(result.dir).toBe('src/pages/my-form');
    expect(result.written).toEqual(['types/my-form.ts']);
    expect(host.written.get('src/pages/my-form/types/my-form.ts')).toBe('тело\n');
  });

  it('источник без записи отказывает ДО первой записи', async () => {
    const host = createFakeHost({ write: false });
    await expect(
      deliverInto(host, MODULE, [file({ path: 'types/my-form.ts' })])
    ).rejects.toBeInstanceOf(SourceReadOnlyError);
    expect(host.written.size).toBe(0);
  });

  it('производный файл перезаписывается даже если его правили', async () => {
    const host = createFakeHost({
      files: { 'src/pages/my-form/types/my-form.ts': 'моя правка\n' },
    });
    const result = await deliverInto(host, MODULE, [file({ path: 'types/my-form.ts' })]);
    expect(result.written).toEqual(['types/my-form.ts']);
  });

  it('авторский файл не перезаписывается никогда, и пропуск НАЗЫВАЕТСЯ', async () => {
    const host = createFakeHost({ files: { 'src/pages/my-form/api/index.ts': 'мой бэкенд\n' } });
    const result = await deliverInto(host, MODULE, [file({ path: 'api/index.ts', cls: 'user' })]);
    expect(result.written).toEqual([]);
    expect(result.skipped).toEqual([{ path: 'api/index.ts', reason: 'authored' }]);
    expect(host.written.get('src/pages/my-form/api/index.ts')).toBe('мой бэкенд\n');
  });

  it('выводимый из правил файл перезаписывается, пока маркер сходится', async () => {
    const host = createFakeHost({
      files: { 'src/pages/my-form/validation/form.ts': withMarker('старое\n') },
    });
    const result = await deliverInto(host, MODULE, [
      file({ path: 'validation/form.ts', cls: 'user', regenerable: true, content: 'новое\n' }),
    ]);
    expect(result.written).toEqual(['validation/form.ts']);
    expect(host.written.get('src/pages/my-form/validation/form.ts')).toBe('новое\n');
  });

  it('правленный руками выводимый файл пропускается с ДРУГОЙ причиной', async () => {
    const host = createFakeHost({
      files: { 'src/pages/my-form/validation/form.ts': `${withMarker('старое\n')}// моя правка\n` },
    });
    const result = await deliverInto(host, MODULE, [
      file({ path: 'validation/form.ts', cls: 'user', regenerable: true, content: 'новое\n' }),
    ]);
    expect(result.skipped).toEqual([{ path: 'validation/form.ts', reason: 'edited' }]);
  });

  it('отказ одной записи не отменяет остальные', async () => {
    const host = createFakeHost();
    const broken = { ...host };
    broken.writeText = async (id, text) => {
      if (id.endsWith('bad.ts')) throw new Error('диск полон');
      await host.writeText(id, text);
    };
    const result = await deliverInto(broken, MODULE, [
      file({ path: 'bad.ts' }),
      file({ path: 'good.ts' }),
    ]);
    expect(result.written).toEqual(['good.ts']);
    expect(result.failed).toEqual([{ path: 'bad.ts', message: 'диск полон' }]);
  });

  it('без save записанное остаётся рабочей копией, и это видно в отчёте', async () => {
    const host = createFakeHost();
    const result = await deliverInto(host, MODULE, [file({ path: 'types/my-form.ts' })]);
    expect(result.saved).toBeNull();
  });

  it('с save отправляет в источник ровно записанные адреса', async () => {
    const host = createFakeHost({ withSave: true });
    const result = await deliverInto(host, MODULE, [
      file({ path: 'types/my-form.ts' }),
      file({ path: 'model/model.ts' }),
    ]);
    expect(result.saved).toBe(true);
    expect(host.saved).toEqual([
      'src/pages/my-form/types/my-form.ts',
      'src/pages/my-form/model/model.ts',
    ]);
  });
});

describe('доставка: прежние имена файлов', () => {
  // Механизм общий: цель объявляет прежние имена своего файла (`legacyPaths`), и доставка
  // переносит под новое имя то, что человек правил под старым. Встроенные цели пользуются им
  // для одного файла — документа формы (`renderer.schema.json`): только там контракт файла
  // прежний, а сменилось одно имя. Здесь он проверен на цели со своим авторским файлом.
  const DIR = 'src/pages/my-form';
  const notes = (content = 'свежий\n'): CodegenFile =>
    file({
      path: 'docs/notes.ts',
      cls: 'user',
      regenerable: true,
      content,
      legacyPaths: ['notes.ts'],
    });

  it('правленный руками старый файл ПЕРЕНОСИТСЯ под новое имя, старый остаётся', async () => {
    const edited = `${withMarker('старое\n')}// моя правка\n`;
    const host = createFakeHost({ files: { [`${DIR}/notes.ts`]: edited } });
    const result = await deliverInto(host, MODULE, [notes()]);
    expect(result.legacy).toEqual([
      { path: 'notes.ts', replacedBy: 'docs/notes.ts', carried: true },
    ]);
    expect(result.written).toEqual(['docs/notes.ts']);
    expect(host.written.get(`${DIR}/docs/notes.ts`)).toBe(edited);
    expect(host.written.get(`${DIR}/notes.ts`)).toBe(edited);
  });

  it('нетронутый старый файл НЕ переносится: под новым именем печатается свежий текст', async () => {
    const host = createFakeHost({
      files: { [`${DIR}/notes.ts`]: withMarker('старое\n') },
    });
    const result = await deliverInto(host, MODULE, [notes()]);
    expect(result.legacy).toEqual([
      { path: 'notes.ts', replacedBy: 'docs/notes.ts', carried: false },
    ]);
    expect(host.written.get(`${DIR}/docs/notes.ts`)).toBe('свежий\n');
  });

  it('производный файл (схема) печатается заново, даже если старый правили', async () => {
    const host = createFakeHost({
      files: { [`${DIR}/schema/renderer.schema.json`]: '{"мой":1}' },
    });
    const result = await deliverInto(host, MODULE, [
      file({
        path: 'schema/form.schema.json',
        content: '{}',
        legacyPaths: ['schema/renderer.schema.json'],
      }),
    ]);
    expect(result.legacy).toEqual([
      {
        path: 'schema/renderer.schema.json',
        replacedBy: 'schema/form.schema.json',
        carried: false,
      },
    ]);
    expect(host.written.get(`${DIR}/schema/form.schema.json`)).toBe('{}');
  });

  it('если новый файл уже есть, старое имя больше не вспоминается', async () => {
    const host = createFakeHost({
      files: {
        [`${DIR}/notes.ts`]: 'давнее\n',
        [`${DIR}/docs/notes.ts`]: withMarker('текущее\n'),
      },
    });
    const result = await deliverInto(host, MODULE, [notes()]);
    expect(result.legacy).toEqual([]);
    expect(host.written.get(`${DIR}/docs/notes.ts`)).toBe('свежий\n');
  });
});

describe('доставка: крючки стека', () => {
  it('отказ стека перед записью — ничего не записано, отказ доезжает как был', async () => {
    const host = createFakeHost({ withSave: true });
    const refusal = {
      refusal: { key: 'error.kit-mismatch', params: { module: 'a', active: 'b' } },
    };
    const delivery = deliverInto(host, MODULE, [file({ path: 'types/my-form.ts' })], {
      check: async () => refusal,
    });

    await expect(delivery).rejects.toBeInstanceOf(DeliveryRefusedError);
    await expect(delivery).rejects.toMatchObject({ refusal });
    expect(host.written.size).toBe(0);
    expect(host.saved).toEqual([]);
  });

  it('право источника проверяется раньше стека: без записи стек не спрашивают', async () => {
    const host = createFakeHost({ write: false });
    let asked = false;
    await expect(
      deliverInto(host, MODULE, [file({ path: 'x.ts' })], {
        check: async () => {
          asked = true;
          return null;
        },
      })
    ).rejects.toBeInstanceOf(SourceReadOnlyError);
    expect(asked).toBe(false);
  });

  it('заметки стека спрашиваются ПОСЛЕ записи и уезжают в отчёт как есть', async () => {
    const host = createFakeHost();
    const seen: number[] = [];
    const note: CodegenNote = {
      id: 'orphans',
      paths: ['validation/old.ts'],
      title: { key: 'orphans.title' },
      detail: { key: 'orphans.detail' },
      notify: { key: 'notify.orphans', params: { count: 1 } },
    };
    const result = await deliverInto(host, MODULE, [file({ path: 'types/my-form.ts' })], {
      inspect: async () => {
        seen.push(host.written.size);
        return [note];
      },
    });
    expect(seen).toEqual([1]);
    expect(result.notes).toEqual([note]);
  });

  it('без крючков — заметок нет', async () => {
    const result = await deliverInto(createFakeHost(), MODULE, [file({ path: 'types/x.ts' })]);
    expect(result.notes).toEqual([]);
    expect(result.legacy).toEqual([]);
  });
});
