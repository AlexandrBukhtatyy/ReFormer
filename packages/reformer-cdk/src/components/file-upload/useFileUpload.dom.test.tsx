// @vitest-environment happy-dom
/**
 * Ручной запуск загрузки (`autoUpload: false`): файлы ждут в `local`, пока их не отправит
 * `upload()`. Без него режим был тупиком — ни очередь, ни API загрузку не запускали.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useFileUpload } from './useFileUpload';
import type { FileUploadUploader, UseFileUploadOptions } from './types';

afterEach(cleanup);

const file = (name: string) => new File([new Uint8Array(4)], name, { type: 'text/plain' });

/** Загрузчик, который не завершается: состояние `uploading` остаётся для проверки. */
const pendingUploader = () => vi.fn<FileUploadUploader>(() => new Promise(() => {}));

function setup(options: UseFileUploadOptions) {
  return renderHook((props: UseFileUploadOptions) => useFileUpload(props), {
    initialProps: options,
  });
}

describe('useFileUpload — ручной запуск загрузки (autoUpload: false)', () => {
  it('принятые файлы ждут в local, upload() отправляет все ожидающие', () => {
    const uploader = pendingUploader();
    const { result } = setup({ uploader, autoUpload: false, multiple: true });

    act(() => result.current.addFiles([file('a.txt'), file('b.txt')]));
    expect(uploader).not.toHaveBeenCalled();
    expect(result.current.items.map((i) => i.status)).toEqual(['local', 'local']);

    act(() => result.current.upload());
    expect(uploader).toHaveBeenCalledTimes(2);
    expect(result.current.items.map((i) => i.status)).toEqual(['uploading', 'uploading']);
  });

  it('upload(key) отправляет только указанный файл; повторный вызов не дублирует загрузку', () => {
    const uploader = pendingUploader();
    const { result } = setup({ uploader, autoUpload: false, multiple: true });
    act(() => result.current.addFiles([file('a.txt'), file('b.txt')]));
    const [first] = result.current.items;

    act(() => result.current.upload(first.key));
    act(() => result.current.upload(first.key));
    expect(uploader).toHaveBeenCalledTimes(1);
    expect(result.current.items.map((i) => i.status)).toEqual(['uploading', 'local']);
  });

  it('retry в ручном режиме сразу перезапускает загрузку', async () => {
    const uploader = vi.fn<FileUploadUploader>(() => Promise.reject(new Error('net')));
    const { result } = setup({ uploader, autoUpload: false });
    act(() => result.current.addFiles([file('a.txt')]));
    await act(async () => result.current.upload());
    expect(result.current.items[0].status).toBe('error');

    uploader.mockImplementation(() => new Promise(() => {}));
    act(() => result.current.retry(result.current.items[0].key));
    expect(uploader).toHaveBeenCalledTimes(2);
    expect(result.current.items[0].status).toBe('uploading');
  });

  it('без uploader upload() ничего не делает', () => {
    const { result } = setup({ autoUpload: false });
    act(() => result.current.addFiles([file('a.txt')]));
    act(() => result.current.upload());
    expect(result.current.items[0].status).toBe('local');
  });

  it('с autoUpload (по умолчанию) загрузка стартует сама', () => {
    const uploader = pendingUploader();
    const { result } = setup({ uploader });
    act(() => result.current.addFiles([file('a.txt')]));
    expect(uploader).toHaveBeenCalledTimes(1);
  });
});
