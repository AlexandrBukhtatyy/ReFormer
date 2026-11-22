import { describe, expect, it, vi } from 'vitest';

import { createAssetCache, type BlobFactory } from './assets';
import type { MarkdownDocument, MarkdownHost } from '../host';

const DOCUMENT: MarkdownDocument = {
  ref: {
    id: 'fs:docs/guide.md',
    sourceId: 'fs',
    path: 'docs/guide.md',
    name: 'guide.md',
    kind: 'file',
    mediaType: 'text/markdown',
  },
  getText: () => '',
  onDidChangeContent: () => ({ dispose: () => undefined }),
};

/** Ссылки-двойник: считает выданные и отозванные — настоящий `URL` в `node` их не даёт. */
function fakeBlobs(): BlobFactory & { readonly issued: string[]; readonly revoked: string[] } {
  const issued: string[] = [];
  const revoked: string[] = [];
  let next = 0;
  return {
    issued,
    revoked,
    create: () => {
      const url = `blob:${++next}`;
      issued.push(url);
      return url;
    },
    revoke: (url) => {
      revoked.push(url);
    },
  };
}

function harness(options: { bytes?: Uint8Array | null; fail?: boolean } = {}) {
  const reads: string[] = [];
  const host: Pick<MarkdownHost, 'readBytes' | 'resourceAt'> = {
    readBytes: (id) => {
      reads.push(id);
      if (options.fail === true) return Promise.reject(new Error('нет прав'));
      return Promise.resolve(options.bytes === undefined ? new Uint8Array([1, 2]) : options.bytes);
    },
    resourceAt: (document, projectPath) => `${document.ref.sourceId}:${projectPath}`,
  };
  const blobs = fakeBlobs();
  return { cache: createAssetCache({ host, document: DOCUMENT, blobs }), reads, blobs };
}

describe('кэш картинок', () => {
  it('относительный путь считается от каталога документа', async () => {
    const h = harness();

    await h.cache.get('./img/logo.png');

    expect(h.reads).toEqual(['fs:docs/img/logo.png']);
  });

  it('повторный запрос той же ссылки не перечитывает файл', async () => {
    const h = harness();

    await h.cache.get('./img/logo.png');
    await h.cache.get('./img/logo.png');

    expect(h.reads).toHaveLength(1);
  });

  it('путь за пределами проекта не читается вовсе', async () => {
    const h = harness();

    expect(await h.cache.get('../../etc/passwd')).toBeNull();
    expect(h.reads).toEqual([]);
  });

  it('отсутствующая картинка — состояние показа, а не сбой', async () => {
    const missing = harness({ bytes: null });
    const broken = harness({ fail: true });

    expect(await missing.cache.get('./nope.png')).toBeNull();
    expect(await broken.cache.get('./nope.png')).toBeNull();
  });

  it('сброс освобождает выданные ссылки и не мешает работать дальше', async () => {
    const h = harness();

    const first = await h.cache.get('./img/logo.png');
    h.cache.dispose();
    await vi.waitFor(() => {
      expect(h.blobs.revoked).toEqual([first]);
    });

    // После сброса кэш обязан снова работать: React монтирует компоненты повторно.
    await h.cache.get('./img/logo.png');
    expect(h.reads).toHaveLength(2);
  });

  it('чтение, начатое до сброса, отзывает свою ссылку само', async () => {
    let release: (bytes: Uint8Array) => void = () => undefined;
    const blobs = fakeBlobs();
    const cache = createAssetCache({
      host: {
        readBytes: () =>
          new Promise<Uint8Array>((resolve) => {
            release = resolve;
          }),
        resourceAt: (document, projectPath) => `${document.ref.sourceId}:${projectPath}`,
      },
      document: DOCUMENT,
      blobs,
    });

    const pending = cache.get('./img/logo.png');
    cache.dispose();
    release(new Uint8Array([1]));

    // Ссылка выдана уже после сброса, и отзывать её больше некому — кроме самого чтения.
    expect(await pending).toBeNull();
    expect(blobs.revoked).toEqual(blobs.issued);
  });
});
