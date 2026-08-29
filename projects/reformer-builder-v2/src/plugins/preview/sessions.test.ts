/**
 * Реестр состояний: состояние принадлежит документу, а не панели.
 *
 * @module plugins/preview/sessions.test
 */

import { describe, expect, it } from 'vitest';
import { createPreviewSessions } from './sessions';
import { createFakeSelectionChannel, type FakeSelectionChannel } from './testing';

describe('createPreviewSessions', () => {
  it('состояние документа переживает переключение вкладки', () => {
    const sessions = createPreviewSessions();
    sessions.storeFor('a').chooseSurface('preview.skeleton');
    sessions.setActive('b');
    sessions.setActive('a');
    expect(sessions.storeFor('a').get().surfaceId).toBe('preview.skeleton');
  });

  it('состояния разных документов не смешиваются', () => {
    const sessions = createPreviewSessions();
    sessions.storeFor('a').chooseSurface('preview.skeleton');
    expect(sessions.storeFor('b').get().surfaceId).toBeNull();
  });

  it('активный документ читается командой, у которой своего документа нет', () => {
    const sessions = createPreviewSessions();
    expect(sessions.activeStore()).toBeNull();
    const store = sessions.storeFor('a');
    sessions.setActive('a');
    expect(sessions.activeStore()).toBe(store);
  });

  it('закрытая вкладка забывается вместе со своим режимом', () => {
    const sessions = createPreviewSessions();
    sessions.storeFor('a').chooseSurface('preview.skeleton');
    sessions.setActive('a');
    sessions.forget('a');
    expect(sessions.active()).toBeNull();
    expect(sessions.storeFor('a').get().surfaceId).toBeNull();
  });

  it('версия меняется на смене активного документа', () => {
    const sessions = createPreviewSessions();
    const before = sessions.version();
    sessions.setActive('a');
    expect(sessions.version()).toBeGreaterThan(before);
    sessions.setActive('a');
    expect(sessions.version()).toBe(before + 1);
  });
});

/**
 * Обе половины канала выделения: превью публикует свой выбор и принимает чужой.
 *
 * Двойник канала живёт в `./testing` и воспроизводит ТРИ свойства службы, а не одно:
 * замещение записи по ресурсу, снятие записи пустым списком и — главное — отсутствие
 * уведомления о совпадающем по содержимому значении. Последнее и есть то, что гасит эхо
 * между двумя отражающими друг друга сторонами; двойник, который его не воспроизводит,
 * показал бы цикл там, где настоящая служба его не допускает.
 */
function fakeChannel(): FakeSelectionChannel {
  return createFakeSelectionChannel();
}

describe('createPreviewSessions — канал выделения', () => {
  it('выбор узла уходит наружу вместе с адресом документа', () => {
    const sessions = createPreviewSessions();
    const channel = fakeChannel();
    sessions.connectSelection(channel);

    sessions.storeFor('a').select(['n1']);

    expect(channel.writes).toContainEqual({ resource: 'a', ids: ['n1'] });
  });

  it('выделения двух документов уходят под разными адресами', () => {
    const sessions = createPreviewSessions();
    const channel = fakeChannel();
    sessions.connectSelection(channel);

    sessions.storeFor('a').select(['n1']);
    sessions.storeFor('b').select(['n2']);

    expect(channel.writes).toContainEqual({ resource: 'a', ids: ['n1'] });
    expect(channel.writes).toContainEqual({ resource: 'b', ids: ['n2'] });
  });

  it('состояние, созданное ДО подключения канала, догоняет его', () => {
    const sessions = createPreviewSessions();
    sessions.storeFor('a').select(['n1']);

    const channel = fakeChannel();
    sessions.connectSelection(channel);

    expect(channel.writes).toContainEqual({ resource: 'a', ids: ['n1'] });
  });

  it('без канала превью работает, просто ничего не публикует', () => {
    const sessions = createPreviewSessions();
    expect(() => {
      sessions.storeFor('a').select(['n1']);
    }).not.toThrow();
    expect(sessions.storeFor('a').get().selection).toEqual(['n1']);
  });

  it('снятие подписки прекращает публикацию', () => {
    const sessions = createPreviewSessions();
    const channel = fakeChannel();
    const subscription = sessions.connectSelection(channel);
    sessions.storeFor('a').select(['n1']);
    const after = channel.writes.length;

    subscription.dispose();
    sessions.storeFor('a').select(['n2']);

    expect(channel.writes.length).toBe(after);
  });

  it('деактивация плагина прекращает публикацию', () => {
    const sessions = createPreviewSessions();
    const channel = fakeChannel();
    sessions.connectSelection(channel);
    sessions.dispose();

    sessions.storeFor('a').select(['n1']);

    expect(channel.writes).toEqual([]);
  });

  it('забытая вкладка не стирает чужую запись в канале', () => {
    const sessions = createPreviewSessions();
    const channel = fakeChannel();
    sessions.connectSelection(channel);
    sessions.storeFor('a').select(['n1']);
    channel.writes.length = 0;

    sessions.forget('a');

    // Ни пустого списка, ни чего-либо ещё: владелец жизни ресурса — не превью.
    expect(channel.writes).toEqual([]);
  });
});

/**
 * Вторая половина: выделение, пришедшее в канал снаружи (щелчок по канвасу редактора схемы).
 *
 * Проверяется не только «доехало», но и «не поехало обратно бесконечно»: две стороны,
 * отражающие выделение друг друга, — ровно та конструкция, которая крутится вечно, если
 * защита от эха хоть где-нибудь обойдена.
 */
describe('createPreviewSessions — приём чужого выделения', () => {
  it('чужой выбор доезжает до состояния документа', () => {
    const sessions = createPreviewSessions();
    const channel = fakeChannel();
    sessions.connectSelection(channel);
    const store = sessions.storeFor('a');

    channel.set('a', ['n1']);

    expect(store.get().selection).toEqual(['n1']);
  });

  it('состояние, рождённое ПОСЛЕ чужого выбора, читает его сразу, а не ждёт следующего', () => {
    const sessions = createPreviewSessions();
    const channel = fakeChannel();
    sessions.connectSelection(channel);
    channel.set('a', ['n1']);

    // Панель открыли только сейчас: выбор сделан до того, как у документа появилось состояние.
    expect(sessions.storeFor('a').get().selection).toEqual(['n1']);
  });

  it('чужой выбор не попадает в состояние соседнего документа', () => {
    const sessions = createPreviewSessions();
    const channel = fakeChannel();
    sessions.connectSelection(channel);
    const other = sessions.storeFor('b');

    channel.set('a', ['n1']);

    expect(other.get().selection).toEqual([]);
  });

  it('отражение затухает: чужая запись не порождает второго круга уведомлений', () => {
    const sessions = createPreviewSessions();
    const channel = fakeChannel();
    sessions.connectSelection(channel);
    sessions.storeFor('a');
    const before = channel.notifications();

    channel.set('a', ['n1']);

    // Ровно одно — сама чужая запись. Публикация принятого значения обратно совпадает
    // с ним по содержимому, и служба на неё не уведомляет: круг закрывается сам.
    expect(channel.notifications()).toBe(before + 1);
  });

  it('свой выбор возвращается в канал ровно один раз', () => {
    const sessions = createPreviewSessions();
    const channel = fakeChannel();
    sessions.connectSelection(channel);
    const before = channel.notifications();

    sessions.storeFor('a').select(['n1']);

    expect(channel.notifications()).toBe(before + 1);
    expect(channel.get('a')).toEqual(['n1']);
  });

  it('снятие подписки прекращает и приём, а не только публикацию', () => {
    const sessions = createPreviewSessions();
    const channel = fakeChannel();
    const subscription = sessions.connectSelection(channel);
    const store = sessions.storeFor('a');
    subscription.dispose();

    channel.set('a', ['n1']);

    expect(store.get().selection).toEqual([]);
  });

  it('деактивация плагина прекращает приём', () => {
    const sessions = createPreviewSessions();
    const channel = fakeChannel();
    sessions.connectSelection(channel);
    const store = sessions.storeFor('a');
    sessions.dispose();

    channel.set('a', ['n1']);

    expect(store.get().selection).toEqual([]);
  });
});
