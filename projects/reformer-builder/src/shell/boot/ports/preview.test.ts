/**
 * Жизненный цикл состояний превью: не дольше вкладок.
 *
 * Проверяется шов между проектом и реестром состояний: закрытая вкладка забывается,
 * смена проекта перевешивает подписку, закрытие проекта забывает всё.
 *
 * @module shell/boot/ports/preview.test
 */

import { describe, expect, it } from 'vitest';
import type { Disposable } from '@/shell/platform/primitives/disposable';
import type { ResourceId, ResourceRef } from '@/shell/platform/primitives/resource';
import { createServiceRegistry } from '@/shell/platform/primitives/service';
import { createI18nService } from '@/shell/platform/services/i18n/i18n';
import { createPreviewSessions } from '@/plugins/preview';
import type { ProjectHost } from '@/shell/boot/project/project';
import { attachPreviewLifecycle, createPreviewHost } from './preview';

describe('createPreviewHost: соседи документа', () => {
  /** Проект с рабочей областью, которая запоминает, какой каталог у неё спросили. */
  function projectListing(): {
    readonly project: ProjectHost;
    readonly asked: ResourceId[];
  } {
    const asked: ResourceId[] = [];
    const project = {
      get: () => ({
        workspace: {
          list: (dir: ResourceId): Promise<readonly ResourceRef[]> => {
            asked.push(dir);
            return Promise.resolve([]);
          },
        },
      }),
      subscribe: () => ({ dispose: () => undefined }),
    } as unknown as ProjectHost;
    return { project, asked };
  }

  it('спрашивает каталог документа — и для файла в корне источника тоже', async () => {
    const { project, asked } = projectListing();
    const host = createPreviewHost({
      project,
      i18n: createI18nService(),
      services: createServiceRegistry(),
    });

    await host.siblings('src:forms/credit/form.json');
    // Форма в корне: обрезка по последнему «/» давала здесь `src:form.jso`, и сайдкары
    // такой формы превью не находило вовсе.
    await host.siblings('src:form.json');

    expect(asked).toEqual(['src:forms/credit', 'src:']);
  });
});

/** Проект с вкладками в объёме, который трогает жизненный цикл. */
function fakeProject() {
  const projectListeners = new Set<() => void>();
  let tabListeners = new Set<() => void>();
  let tabs: string[] = [];
  let opened = false;

  const session = {
    documents: {
      get: () => ({ tabs: tabs.map((id) => ({ ref: { id } })) }),
      subscribe: (cb: () => void): Disposable => {
        tabListeners.add(cb);
        return { dispose: () => tabListeners.delete(cb) };
      },
    },
  };

  const project = {
    get: () => (opened ? session : null),
    subscribe: (cb: () => void): Disposable => {
      projectListeners.add(cb);
      return { dispose: () => projectListeners.delete(cb) };
    },
  } as unknown as Pick<ProjectHost, 'get' | 'subscribe'>;

  return {
    project,
    open(initial: string[]): void {
      opened = true;
      tabs = initial;
      tabListeners = new Set();
      for (const cb of projectListeners) cb();
    },
    close(): void {
      opened = false;
      for (const cb of projectListeners) cb();
    },
    setTabs(next: string[]): void {
      tabs = next;
      for (const cb of tabListeners) cb();
    },
    tabSubscribers: () => tabListeners.size,
  };
}

describe('attachPreviewLifecycle', () => {
  it('закрытая вкладка забывает своё состояние, открытые остаются', () => {
    const sessions = createPreviewSessions();
    const p = fakeProject();
    p.open(['src:a/form.json', 'src:b/form.json']);
    attachPreviewLifecycle(p.project, sessions);
    sessions.storeFor('src:a/form.json').select(['a1b2c3d4']);
    sessions.storeFor('src:b/form.json');

    p.setTabs(['src:b/form.json']);

    expect(sessions.ids()).toEqual(['src:b/form.json']);
    // Новое обращение к «a» даёт свежее состояние — выбор закрытой вкладки не переживает её.
    expect(sessions.storeFor('src:a/form.json').get().selection).toEqual([]);
  });

  it('состояние формы живёт, пока открыт хоть один файл её каталога', () => {
    // Одиночный щелчок по сайдкару в дереве замещает вкладку предпросмотра формы: человек
    // пошёл чинить validation.ts, и находки формы обязаны пережить этот щелчок.
    const sessions = createPreviewSessions();
    const p = fakeProject();
    p.open(['src:credit/form.json']);
    attachPreviewLifecycle(p.project, sessions);
    sessions.storeFor('src:credit/form.json');

    p.setTabs(['src:credit/validation.ts']);
    expect(sessions.ids()).toEqual(['src:credit/form.json']);

    p.setTabs(['src:other/readme.md']);
    expect(sessions.ids()).toEqual([]);
  });

  it('закрытие проекта забывает всё: открытых вкладок больше нет', () => {
    const sessions = createPreviewSessions();
    const p = fakeProject();
    p.open(['src:a/form.json']);
    attachPreviewLifecycle(p.project, sessions);
    sessions.storeFor('src:a/form.json');

    p.close();

    expect(sessions.ids()).toEqual([]);
  });

  it('смена проекта перевешивает подписку на вкладки', () => {
    const sessions = createPreviewSessions();
    const p = fakeProject();
    attachPreviewLifecycle(p.project, sessions);
    expect(p.tabSubscribers()).toBe(0);

    p.open(['src:a/form.json']);
    expect(p.tabSubscribers()).toBe(1);
    sessions.storeFor('src:a/form.json');

    p.open(['other:c/form.json']);
    expect(p.tabSubscribers()).toBe(1);
    // Вкладки нового проекта — другие; состояние прежнего забыто при сведении.
    expect(sessions.ids()).toEqual([]);
  });

  it('снятие жизненного цикла прекращает слежение, но состояний не трогает', () => {
    const sessions = createPreviewSessions();
    const p = fakeProject();
    p.open(['src:a/form.json']);
    const lifecycle = attachPreviewLifecycle(p.project, sessions);
    sessions.storeFor('src:a/form.json');

    lifecycle.dispose();
    p.setTabs([]);

    expect(p.tabSubscribers()).toBe(0);
    expect(sessions.ids()).toEqual(['src:a/form.json']);
  });
});

describe('createPreviewHost: правки файлов', () => {
  it('наружу уходят адреса, чей текст изменился или исчез, — не «загрузился» и не «сохранился»', () => {
    const captured: { emit: ((event: unknown) => void) | null } = { emit: null };
    const project = {
      get: () => ({
        workspace: {
          onDidChange: (cb: (event: unknown) => void): Disposable => {
            captured.emit = cb;
            return { dispose: () => (captured.emit = null) };
          },
        },
      }),
      subscribe: () => ({ dispose: () => undefined }),
    } as unknown as ProjectHost;
    const host = createPreviewHost({
      project,
      i18n: createI18nService(),
      services: createServiceRegistry(),
    });
    const seen: (readonly ResourceId[])[] = [];
    host.onDidChangeFiles?.((changed) => {
      seen.push(changed);
    });

    captured.emit?.({
      changes: [
        { id: 'src:form/validation.ts', type: 'written' },
        { id: 'src:form/model.ts', type: 'saved' },
        { id: 'src:form/api.ts', type: 'materialized' },
        { id: 'src:form/old.ts', type: 'removed' },
      ],
    });

    expect(seen).toEqual([['src:form/validation.ts', 'src:form/old.ts']]);
  });
});
