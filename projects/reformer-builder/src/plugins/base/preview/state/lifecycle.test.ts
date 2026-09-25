/**
 * Жизненный цикл состояний превью: не дольше открытых файлов каталога формы.
 *
 * Проверяется шов между рабочей областью и реестром состояний — тот же, что раньше жил
 * в порту композиции (`shell/boot/ports/preview`) и проверялся там же. Двойник теперь
 * не проект, а служба документов: перевешивание подписки на вкладки при смене проекта —
 * забота службы (`shell/boot/ports/documents`), а не правила жизни. Здесь проверяется само
 * правило, и «проект закрыли» выглядит как «открытых документов не осталось».
 *
 * @module plugins/base/preview/state/lifecycle.test
 */

import { describe, expect, it } from 'vitest';
import {
  attachPreviewLifecycle,
  type PreviewLifecycleDocuments,
  type PreviewLifecycleFiles,
} from './lifecycle';
import { createPreviewSessions } from './sessions';

/** Рабочая область в объёме правила: список открытых, каталог адреса и одно уведомление. */
function fakeDocuments() {
  const listeners = new Set<() => void>();
  let open: string[] = [];

  const documents: PreviewLifecycleDocuments = {
    openDocuments: () => open,
    onDidChange: (cb) => {
      listeners.add(cb);
      return {
        dispose: () => {
          listeners.delete(cb);
        },
      };
    },
  };

  /** Та же арифметика, что у службы: до последнего «/», без подъёма выше корня источника. */
  const files: PreviewLifecycleFiles = {
    parentOf: (id) => {
      const at = id.lastIndexOf('/');
      return at === -1 ? id : id.slice(0, at);
    },
  };

  return {
    documents,
    files,
    subscribers: () => listeners.size,
    setOpen(next: string[]): void {
      open = next;
      for (const cb of [...listeners]) cb();
    },
  };
}

describe('attachPreviewLifecycle', () => {
  it('закрытая вкладка забывает своё состояние, открытые остаются', () => {
    const sessions = createPreviewSessions();
    const w = fakeDocuments();
    w.setOpen(['src:a/form.json', 'src:b/form.json']);
    attachPreviewLifecycle(w.documents, w.files, sessions);
    sessions.storeFor('src:a/form.json').select(['a1b2c3d4']);
    sessions.storeFor('src:b/form.json');

    w.setOpen(['src:b/form.json']);

    expect(sessions.ids()).toEqual(['src:b/form.json']);
    // Новое обращение к «a» даёт свежее состояние — выбор закрытой вкладки не переживает её.
    expect(sessions.storeFor('src:a/form.json').get().selection).toEqual([]);
  });

  it('состояние формы живёт, пока открыт хоть один файл её каталога', () => {
    // Одиночный щелчок по сайдкару в дереве замещает вкладку предпросмотра формы: человек
    // пошёл чинить validation.ts, и находки формы обязаны пережить этот щелчок.
    const sessions = createPreviewSessions();
    const w = fakeDocuments();
    w.setOpen(['src:credit/form.json']);
    attachPreviewLifecycle(w.documents, w.files, sessions);
    sessions.storeFor('src:credit/form.json');

    w.setOpen(['src:credit/validation.ts']);
    expect(sessions.ids()).toEqual(['src:credit/form.json']);

    w.setOpen(['src:other/readme.md']);
    expect(sessions.ids()).toEqual([]);
  });

  it('без открытых документов забывается всё: проект закрыли', () => {
    const sessions = createPreviewSessions();
    const w = fakeDocuments();
    w.setOpen(['src:a/form.json']);
    attachPreviewLifecycle(w.documents, w.files, sessions);
    sessions.storeFor('src:a/form.json');

    w.setOpen([]);

    expect(sessions.ids()).toEqual([]);
  });

  it('сводит СРАЗУ, а не ждёт первого уведомления', () => {
    // Плагин поднимается позже рабочей области, и состояние могло пережить перезагрузку
    // плагина: без немедленного сведения оно висело бы до следующего движения вкладок.
    const sessions = createPreviewSessions();
    const w = fakeDocuments();
    sessions.storeFor('src:a/form.json');

    attachPreviewLifecycle(w.documents, w.files, sessions);

    expect(sessions.ids()).toEqual([]);
  });

  it('снятие прекращает слежение, но состояний не трогает', () => {
    const sessions = createPreviewSessions();
    const w = fakeDocuments();
    w.setOpen(['src:a/form.json']);
    const lifecycle = attachPreviewLifecycle(w.documents, w.files, sessions);
    sessions.storeFor('src:a/form.json');

    lifecycle.dispose();
    w.setOpen([]);

    expect(w.subscribers()).toBe(0);
    expect(sessions.ids()).toEqual(['src:a/form.json']);
  });
});
