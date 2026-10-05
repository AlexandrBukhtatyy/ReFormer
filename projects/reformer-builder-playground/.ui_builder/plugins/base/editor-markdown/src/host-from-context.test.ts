/**
 * Порт предпросмотра markdown из контекста: что он получает от служб оболочки.
 *
 * Службы — двойники в объёме, который порт читает. Проверяется сборка: какая служба на какой
 * вопрос отвечает и что происходит, когда её нет.
 *
 * @module plugins/base/editor-markdown/host-from-context.test
 */

import { describe, expect, it, vi } from 'vitest';
import {
  DocumentsServiceToken,
  WorkspaceFilesServiceToken,
  type PluginContext,
  type ResourceId,
} from '@reformer/builder-plugin-api';
import type { MarkdownDocument } from './host';
import { markdownHostFromContext } from './host-from-context';

const README: ResourceId = 'fs:docs/README.md';

const document: MarkdownDocument = {
  ref: {
    id: README,
    sourceId: 'fs',
    path: 'docs/README.md',
    name: 'README.md',
    kind: 'file',
    mediaType: 'text/markdown',
  },
  getText: () => '# заголовок',
  onDidChangeContent: () => ({ dispose: () => {} }),
};

function harness(without: readonly string[] = []) {
  const open = vi.fn(() => Promise.resolve());
  const bytes = new Uint8Array([1, 2, 3]);
  const services = new Map<string, unknown>([
    [
      DocumentsServiceToken.id,
      {
        activeResource: () => README,
        documentOf: (id: ResourceId) => (id === README ? document : null),
        open,
      },
    ],
    [
      WorkspaceFilesServiceToken.id,
      {
        readBytes: (id: ResourceId) => Promise.resolve(id === 'fs:docs/logo.png' ? bytes : null),
        fromRoot: (_anchor: ResourceId, path: string): ResourceId => `fs:${path}`,
      },
    ],
  ]);
  for (const id of without) services.delete(id);
  const ctx = {
    services: { get: (token: { id: string }) => services.get(token.id) },
  } as unknown as PluginContext;
  return { host: markdownHostFromContext(ctx), open, bytes };
}

describe('порт предпросмотра из контекста', () => {
  it('активная вкладка и её документ — от службы документов', () => {
    const { host } = harness();

    expect(host.activeDocument?.()).toBe(README);
    expect(host.documentOf(README)).toBe(document);
    expect(host.documentOf('fs:other.md')).toBeNull();
  });

  it('адрес по пути от корня собирает платформа, байты читает служба записей', async () => {
    const { host, bytes } = harness();

    const logo = host.resourceAt(document, 'docs/logo.png');

    expect(logo).toBe('fs:docs/logo.png');
    await expect(host.readBytes(logo)).resolves.toBe(bytes);
    // Картинки, которой нет, в чужом README сколько угодно: это состояние показа.
    await expect(host.readBytes('fs:docs/нет.png')).resolves.toBeNull();
  });

  it('переход по ссылке открывает вкладку НЕ в режиме предпросмотра', () => {
    // Человек перешёл по ссылке, чтобы читать дальше: следующий переход не должен занимать
    // ту же вкладку.
    const { host, open } = harness();

    host.openResource?.('fs:docs/guide.md');

    expect(open).toHaveBeenCalledWith('fs:docs/guide.md', { preview: false });
  });

  it('без службы записей ссылки остаются текстом, а картинка — без байтов', async () => {
    // Собрать адрес нечем: перехода нет вовсе (видно на глаз, а не выглядит поломкой),
    // а кэш картинок ловит отказ и показывает подпись вместо изображения.
    const { host } = harness([WorkspaceFilesServiceToken.id]);

    expect(host.openResource).toBeUndefined();
    expect(() => host.resourceAt(document, 'docs/logo.png')).toThrow(/адрес/);
    await expect(host.readBytes('fs:docs/logo.png')).resolves.toBeNull();
  });

  it('без рабочей области порт отвечает пустотой, а не падает', () => {
    const { host } = harness([DocumentsServiceToken.id]);

    expect(host.activeDocument?.()).toBeNull();
    expect(host.documentOf(README)).toBeNull();
    expect(host.openResource).toBeUndefined();
  });
});
