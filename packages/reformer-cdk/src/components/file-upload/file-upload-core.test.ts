/**
 * Тесты React-free ядра file-upload: редьюсер, отбор кандидатов, проекции значения.
 *
 * `File` создаётся конструктором (есть в Node 20+ и jsdom) — DOM не нужен.
 */

import { describe, it, expect } from 'vitest';
import {
  fileUploadReducer,
  initialFileUploadState,
  selectFiles,
  projectValue,
  reconcileItems,
  fileItemKey,
  formatFileSize,
  makeFileError,
  type FileUploadState,
} from './file-upload-core';
import type { FileUploadItem, RemoteFileRef } from './types';

function makeFile(name: string, size: number, type = 'text/plain'): File {
  return new File([new Uint8Array(size)], name, { type });
}

const ref = (id: string, name = `${id}.pdf`): RemoteFileRef => ({ id, name });

function stateWith(items: FileUploadItem[]): FileUploadState {
  return { items, rejections: [] };
}

describe('fileUploadReducer', () => {
  const file = makeFile('a.txt', 10);

  it('add: append и replace, rejections замещаются итогом отбора', () => {
    let s = initialFileUploadState();
    s = fileUploadReducer(s, {
      kind: 'add',
      accepted: [file],
      keys: ['k1'],
      rejected: [{ file: makeFile('bad.exe', 5), errors: [makeFileError('fileType')] }],
      replace: false,
    });
    expect(s.items).toEqual([{ key: 'k1', status: 'local', file }]);
    expect(s.rejections).toHaveLength(1);

    const file2 = makeFile('b.txt', 20);
    s = fileUploadReducer(s, {
      kind: 'add',
      accepted: [file2],
      keys: ['k2'],
      rejected: [],
      replace: true,
    });
    expect(s.items).toEqual([{ key: 'k2', status: 'local', file: file2 }]);
    expect(s.rejections).toEqual([]);
  });

  it('полный жизненный цикл: local → uploading → progress → uploaded', () => {
    let s = stateWith([{ key: 'k', status: 'local', file }]);
    s = fileUploadReducer(s, { kind: 'upload-start', key: 'k' });
    expect(s.items[0]).toMatchObject({ status: 'uploading', progress: 0 });

    s = fileUploadReducer(s, { kind: 'upload-progress', key: 'k', percent: 42 });
    expect(s.items[0]).toMatchObject({ status: 'uploading', progress: 42 });

    s = fileUploadReducer(s, { kind: 'upload-success', key: 'k', remote: ref('srv-1') });
    expect(s.items[0]).toMatchObject({ status: 'uploaded', remote: { id: 'srv-1' }, file });
  });

  it('ошибка → retry → снова local; progress сохраняется в error-элементе', () => {
    let s = stateWith([{ key: 'k', status: 'uploading', file, progress: 60 }]);
    s = fileUploadReducer(s, {
      kind: 'upload-error',
      key: 'k',
      error: makeFileError('uploadFailed'),
    });
    expect(s.items[0]).toMatchObject({
      status: 'error',
      progress: 60,
      error: { code: 'uploadFailed' },
    });

    s = fileUploadReducer(s, { kind: 'retry', key: 'k' });
    expect(s.items[0]).toEqual({ key: 'k', status: 'local', file });
  });

  it('события для удалённого/чужого key — no-op с реф-равенством', () => {
    const s = stateWith([{ key: 'k', status: 'local', file }]);
    expect(fileUploadReducer(s, { kind: 'upload-progress', key: 'gone', percent: 10 })).toBe(s);
    // upload-progress на не-uploading тоже no-op
    expect(fileUploadReducer(s, { kind: 'upload-progress', key: 'k', percent: 10 })).toBe(s);
    expect(fileUploadReducer(s, { kind: 'remove', key: 'gone' })).toBe(s);
  });

  it('progress клампится в 0..100', () => {
    let s = stateWith([{ key: 'k', status: 'uploading', file, progress: 0 }]);
    s = fileUploadReducer(s, { kind: 'upload-progress', key: 'k', percent: 150 });
    expect(s.items[0]).toMatchObject({ progress: 100 });
    s = fileUploadReducer(s, { kind: 'upload-progress', key: 'k', percent: -5 });
    expect(s.items[0]).toMatchObject({ progress: 0 });
  });

  it('remove и clear', () => {
    let s = stateWith([{ key: 'k', status: 'local', file }]);
    s = fileUploadReducer(s, { kind: 'remove', key: 'k' });
    expect(s.items).toEqual([]);
    s = fileUploadReducer(stateWith([{ key: 'k', status: 'local', file }]), { kind: 'clear' });
    expect(s).toEqual(initialFileUploadState());
  });
});

describe('selectFiles', () => {
  it('accept применяется к кандидатам (drop-путь, где нативный accept не работает)', () => {
    const img = makeFile('pic.png', 100, 'image/png');
    const exe = makeFile('virus.exe', 100, 'application/x-msdownload');
    const { accepted, rejected } = selectFiles(
      [img, exe],
      { accept: 'image/*', multiple: true },
      []
    );
    expect(accepted).toEqual([img]);
    expect(rejected).toEqual([
      { file: exe, errors: [expect.objectContaining({ code: 'fileType' })] },
    ]);
  });

  it('все нарушения файла собираются в одну rejection', () => {
    const big = makeFile('big.exe', 5000, 'application/x-msdownload');
    const { rejected } = selectFiles(
      [big],
      { accept: 'image/*', maxFileSize: 1000, multiple: true },
      []
    );
    expect(rejected[0].errors.map((e) => e.code).sort()).toEqual(['fileType', 'maxFileSize']);
  });

  it('minFileSize отсеивает пустые файлы', () => {
    const empty = makeFile('empty.txt', 0);
    const { rejected } = selectFiles([empty], { minFileSize: 1, multiple: true }, []);
    expect(rejected[0].errors[0].code).toBe('minFileSize');
  });

  it('maxFiles: лишние отклоняются, а не весь дроп; existing учитывается', () => {
    const existing: FileUploadItem[] = [{ key: 'e', status: 'local', file: makeFile('e.txt', 1) }];
    const a = makeFile('a.txt', 1);
    const b = makeFile('b.txt', 2);
    const { accepted, rejected } = selectFiles([a, b], { multiple: true, maxFiles: 2 }, existing);
    expect(accepted).toEqual([a]);
    expect(rejected[0]).toMatchObject({ file: b, errors: [{ code: 'maxFiles' }] });
  });

  it('multiple: false → лимит один файл', () => {
    const a = makeFile('a.txt', 1);
    const b = makeFile('b.txt', 2);
    const { accepted, rejected } = selectFiles([a, b], {}, []);
    expect(accepted).toEqual([a]);
    expect(rejected[0].errors[0].code).toBe('maxFiles');
  });

  it('maxTotalFileSize: суммарный лимит с учётом existing', () => {
    const existing: FileUploadItem[] = [
      { key: 'e', status: 'local', file: makeFile('e.bin', 800) },
    ];
    const ok = makeFile('ok.bin', 150);
    const over = makeFile('over.bin', 100);
    const { accepted, rejected } = selectFiles(
      [ok, over],
      { multiple: true, maxTotalFileSize: 1000 },
      existing
    );
    expect(accepted).toEqual([ok]);
    expect(rejected[0].errors[0].code).toBe('maxTotalFileSize');
  });

  it('дубликаты по name+size против existing (включая uploaded) и внутри батча', () => {
    const dup = makeFile('a.txt', 10);
    const existing: FileUploadItem[] = [
      { key: 'u', status: 'uploaded', remote: { id: '1', name: 'a.txt', size: 10 } },
    ];
    const { rejected } = selectFiles([dup], { multiple: true }, existing);
    expect(rejected[0].errors[0].code).toBe('fileExists');

    const twice = selectFiles([makeFile('b.txt', 5), makeFile('b.txt', 5)], { multiple: true }, []);
    expect(twice.accepted).toHaveLength(1);
    expect(twice.rejected[0].errors[0].code).toBe('fileExists');

    const allowed = selectFiles([dup], { multiple: true, preventDuplicates: false }, existing);
    expect(allowed.accepted).toEqual([dup]);
  });

  it('кастомный validate добавляет ошибки', () => {
    const f = makeFile('a.txt', 10);
    const { rejected } = selectFiles(
      [f],
      { multiple: true, validate: () => [makeFileError('customRule', { reason: 'x' })] },
      []
    );
    expect(rejected[0].errors[0]).toMatchObject({ code: 'customRule', params: { reason: 'x' } });
  });

  it('невалидный файл не занимает место валидного (коллективные лимиты после индивидуальных)', () => {
    const bad = makeFile('bad.exe', 10, 'application/x-msdownload');
    const good = makeFile('good.png', 10, 'image/png');
    const { accepted } = selectFiles(
      [bad, good],
      { accept: 'image/*', maxFiles: 1, multiple: true },
      []
    );
    expect(accepted).toEqual([good]);
  });
});

describe('projectValue', () => {
  const file = makeFile('a.txt', 10);

  it('local: все файлы; пусто → null', () => {
    expect(projectValue([], 'local')).toBeNull();
    expect(projectValue([{ key: 'k', status: 'local', file }], 'local')).toEqual([file]);
  });

  it('remote: только uploaded-дескрипторы; uploading/error не попадают', () => {
    const items: FileUploadItem[] = [
      { key: 'a', status: 'uploading', file, progress: 50 },
      { key: 'b', status: 'uploaded', file, remote: ref('1') },
      { key: 'c', status: 'error', file, error: makeFileError('uploadFailed') },
    ];
    expect(projectValue(items, 'remote')).toEqual([ref('1')]);
    expect(projectValue([items[0]], 'remote')).toBeNull();
  });
});

describe('reconcileItems', () => {
  const makeKey = (() => {
    let seq = 0;
    return (file: File) => fileItemKey(file, ++seq);
  })();

  it('null/[] → пустой список', () => {
    const items: FileUploadItem[] = [{ key: 'k', status: 'local', file: makeFile('a.txt', 1) }];
    expect(reconcileItems(items, null, 'local', makeKey)).toEqual([]);
    expect(reconcileItems(items, [], 'local', makeKey)).toEqual([]);
  });

  it('local: матч по ссылке File сохраняет key, новые получают новый key', () => {
    const known = makeFile('a.txt', 1);
    const fresh = makeFile('b.txt', 2);
    const items: FileUploadItem[] = [{ key: 'k1', status: 'local', file: known }];
    const next = reconcileItems(items, [known, fresh], 'local', makeKey);
    expect(next[0]).toBe(items[0]); // тот же элемент — превью не пересоздаётся
    expect(next[1]).toMatchObject({ status: 'local', file: fresh });
    expect(next[1].key).not.toBe('k1');
  });

  it('remote: матч по remote.id; незнакомый ref → preloaded uploaded без file', () => {
    const file = makeFile('a.pdf', 1);
    const items: FileUploadItem[] = [
      { key: 'k1', status: 'uploaded', file, remote: ref('1') },
      { key: 'k2', status: 'uploading', file: makeFile('b.pdf', 2), progress: 10 },
    ];
    const next = reconcileItems(items, [ref('1'), ref('2')], 'remote', makeKey);
    expect(next[0]).toBe(items[0]);
    expect(next[1]).toEqual({ key: 'remote:2', status: 'uploaded', remote: ref('2') });
    // незавершённая загрузка выбыла: внешняя запись авторитетна
    expect(next).toHaveLength(2);
  });
});

describe('утилиты', () => {
  it('fileItemKey уникален за счёт seq', () => {
    const f = makeFile('a.txt', 1);
    expect(fileItemKey(f, 1)).not.toBe(fileItemKey(f, 2));
  });

  it('formatFileSize', () => {
    expect(formatFileSize(0)).toBe('0 Б');
    expect(formatFileSize(512)).toBe('512 Б');
    expect(formatFileSize(1536)).toBe('1.5 КБ');
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5 МБ');
    expect(formatFileSize(-1)).toBe('');
  });
});
