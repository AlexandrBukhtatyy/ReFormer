/**
 * Порт плагина файлов из контекста: что панели и команды получают от служб оболочки.
 *
 * Службы — двойники в объёме, который порт читает; их контракты проверены у оболочки. Здесь
 * проверяется сборка: какая служба на какой вопрос отвечает и что происходит, когда её нет.
 *
 * @module plugins/base/files/host-from-context.test
 */

import { describe, expect, it, vi } from 'vitest';
import {
  DocumentsServiceToken,
  HostMessagesCapability,
  WorkspaceFilesServiceToken,
  WorkspaceTreeCapability,
  type PluginContext,
  type ResourceId,
  type ResourceRef,
} from '@reformer/builder-plugin-api';
import { filesHostFromContext } from './host-from-context';

const FILE: ResourceId = 'fs:forms/contact/form.schema.json';

function ref(path: string): ResourceRef {
  return {
    id: `fs:${path}`,
    sourceId: 'fs',
    path,
    name: path.split('/').pop() ?? path,
    kind: 'file',
    mediaType: 'application/json',
  };
}

function harness(without: readonly string[] = []) {
  const open = vi.fn(() => Promise.resolve());
  const writeText = vi.fn(() => Promise.resolve());
  const Panel = () => null;
  const selected = [ref('forms/contact/form.schema.json')];
  const services = new Map<string, unknown>([
    [
      DocumentsServiceToken.id,
      {
        hasProject: () => true,
        documentOf: (id: ResourceId) => (id === FILE ? { ref: ref('opened.json') } : null),
        open,
        writeText,
      },
    ],
    [WorkspaceFilesServiceToken.id, { projectRoot: () => 'fs:' }],
    [WorkspaceTreeCapability.id, { Panel, selection: () => selected }],
    [
      HostMessagesCapability.id,
      {
        locale: 'ru',
        t: (key: string) => `host:${key}`,
        diagnosticMessage: (code: string) => `находка:${code}`,
        onDidChangeLocale: () => ({ dispose: () => {} }),
      },
    ],
  ]);
  for (const id of without) services.delete(id);
  const ctx = {
    services: { get: (token: { id: string }) => services.get(token.id) },
    i18n: { locale: 'ru', t: (key: string) => key, onDidChangeLocale: () => ({ dispose() {} }) },
  } as unknown as PluginContext;
  return { host: filesHostFromContext(ctx), open, writeText, Panel, selected };
}

describe('дерево проекта', () => {
  it('тело панели, выделение и корень — от служб оболочки', () => {
    const { host, Panel, selected } = harness();

    // Ссылка на компонент — та же: новая на каждый вопрос размонтировала бы дерево.
    expect(host.ResourceTreePanel).toBe(Panel);
    expect(host.treeSelection()).toBe(selected);
    expect(host.treeRoot()).toBe('fs:');
  });

  it('оболочка без дерева: панели нет, выделение пусто — и ничего не падает', () => {
    const { host } = harness([WorkspaceTreeCapability.id, WorkspaceFilesServiceToken.id]);

    expect(host.ResourceTreePanel).toBeUndefined();
    expect(host.treeSelection()).toEqual([]);
    expect(host.treeRoot()).toBeNull();
  });
});

describe('рабочая область', () => {
  it('переход к находке открывает вкладку НЕ в режиме предпросмотра', () => {
    // Человек пришёл чинить, а не посмотреть: вкладка обязана остаться после следующего щелчка.
    const { host, open } = harness();

    host.openResource?.(FILE);

    expect(open).toHaveBeenCalledWith(FILE, { preview: false });
  });

  it('запись идёт в рабочую копию через службу документов', async () => {
    const { host, writeText } = harness();

    await host.writeText(FILE, 'текст');

    expect(writeText).toHaveBeenCalledWith(FILE, 'текст');
  });

  it('без рабочей области запись — отказ, а не тишина', async () => {
    // Правка, ушедшая в никуда, выглядит как сохранённая.
    const { host } = harness([DocumentsServiceToken.id]);

    await expect(host.writeText(FILE, 'x')).rejects.toThrow(/писать некуда/);
    expect(host.hasProject()).toBe(false);
    expect(host.documentOf(FILE)).toBeNull();
    expect(() => host.openResource?.(FILE)).not.toThrow();
  });

  it('имя закрытого ресурса — разбором адреса платформой; неразборчивый адрес остаётся собой', () => {
    const { host } = harness();

    expect(host.nameOf?.('fs:forms/contact/validation.ts')).toEqual({
      name: 'validation.ts',
      path: 'forms/contact/validation.ts',
    });
    expect(host.nameOf?.('не-адрес')).toBeNull();
  });

  it('«читается ли текстом» — правило платформы по медиатипу', () => {
    const { host } = harness();

    expect(host.isTextual('application/json')).toBe(true);
    expect(host.isTextual('image/png')).toBe(false);
  });
});
