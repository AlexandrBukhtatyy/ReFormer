/**
 * Реестр состояний превью: по одному на документ, плюс ответ на вопрос «на что смотрят сейчас».
 *
 * ## Почему состояние по документу, а не по панели
 *
 * Панель превью одна, а документов много. Держи она состояние у себя — переключение вкладки
 * теряло бы и выбор поверхности, и находки сборки, и человек возвращался бы к форме, которую
 * только что смотрел, в другом режиме. Это ровно тот дефект v1, из-за которого состояние
 * вида в v2 адресуется парой «редактор + документ».
 *
 * ## Активный документ приходит от панели, а не от реестра
 *
 * Реестр не может узнать активную вкладку сам: вкладки принадлежат рабочей области, а плагину
 * её не дают. Поэтому панель, отрисовавшись, СООБЩАЕТ реестру, на что смотрит, — тем же приёмом,
 * которым сеанс редактора схемы становится активным при монтировании тела редактора. Читает это
 * команда переключения поверхности: у неё своего документа нет.
 *
 * ## Выделение ходит через канал отсюда, а не из панели — и в обе стороны
 *
 * Клик по превью обязан дойти до канваса, а выбранный на канвасе узел — подсветиться здесь;
 * канвас — в чужом плагине, куда импорта нет.
 * Мост — служба выделения платформы, и подключается он ЗДЕСЬ по одной причине: реестр —
 * единственное место, которое знает и адрес документа, и его состояние. У поверхности есть
 * состояние, но нет адреса (`ctx.select(ids)` его не несёт), у панели есть адрес, но она
 * размонтирована, как только человек ушёл на другую вкладку, — а выбор, сделанный до ухода,
 * обязан остаться прочитанным. Подписка на стор ловит ВСЕХ, кто меняет выделение, а не только
 * `ctx.select`: команда, правящая состояние документа мимо панели, публиковалась бы иначе
 * по отдельному правилу, и правила разошлись бы.
 *
 * @module plugins/preview/sessions
 */

import type { Disposable, ResourceId, SelectionService } from '@/sdk';
import { createPreviewStore, type PreviewStore } from './store';

/**
 * Канал выделения в объёме, которым пользуется превью: читать, писать, следить.
 *
 * Здесь стояла только запись, и довод был верный ровно до тех пор, пока читать было некому:
 * подсветку превью рисует по своему состоянию, и `get` без потребителя означал бы второй
 * источник истины. Потребитель появился — редактор схемы публикует выбранный на канвасе узел,
 * и подсветить его превью может только прочитав канал. Отсюда и три половины: `get` — потому
 * что состояние документа могло родиться ПОСЛЕ чужого щелчка и обязано прочитать текущее,
 * а не ждать следующего; `onDidChange` — потому что обе панели живут одновременно; `set` —
 * как и раньше.
 */
export type SelectionChannel = Pick<SelectionService, 'get' | 'set' | 'onDidChange'>;

export interface PreviewSessions {
  /** Состояние документа; создаётся при первом обращении. */
  storeFor(id: ResourceId): PreviewStore;
  /** Документ, на который смотрит панель, либо `null`. */
  active(): ResourceId | null;
  setActive(id: ResourceId | null): void;
  /** Состояние активного документа либо `null` — то, с чем работают команды. */
  activeStore(): PreviewStore | null;
  /** Версия реестра: меняется на смене активного документа. Снимок для `useSyncExternalStore`. */
  version(): number;
  subscribe(cb: () => void): Disposable;
  /**
   * Связывает выделение всех документов с общим каналом — в ОБЕ стороны.
   *
   * Зовётся из `activate`, потому что раньше службы просто нет: реестр создаётся вместе
   * с плагином, а сервисы приходят с контекстом. Возвращённый `Disposable` кладут
   * в `ctx.subscriptions` — деактивация плагина обязана перестать писать в чужой канал.
   *
   * Подключение задним числом покрывает и уже созданные состояния: панель могла отрисоваться
   * раньше, чем композиция дошла до регистрации службы, и сделанный до этого выбор не должен
   * пропасть.
   */
  connectSelection(channel: SelectionChannel): Disposable;
  /** Забыть документ: вкладку закрыли, помнить её режим больше незачем. */
  forget(id: ResourceId): void;
  dispose(): void;
}

export function createPreviewSessions(): PreviewSessions {
  const stores = new Map<ResourceId, PreviewStore>();
  const listeners = new Set<() => void>();
  /** Подписка «стор → канал» по документу. Пусто, пока канал не подключён. */
  const publishing = new Map<ResourceId, Disposable>();
  let channel: SelectionChannel | null = null;
  /** Подписка «канал → стор». Одна на все документы: канал называет ресурс в событии. */
  let watching: Disposable | null = null;
  let activeId: ResourceId | null = null;
  let version = 0;

  const notify = (): void => {
    version += 1;
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch (error) {
        console.error('[preview] подписчик реестра состояний упал', error);
      }
    }
  };

  /**
   * Отправляет выделение документа в канал.
   *
   * Служба сама гасит повтор совпадающего значения, поэтому подписка на ВЕСЬ снимок стора
   * (а он меняется и от выбора поверхности, и от находок сборки) не даёт лишних уведомлений
   * снаружи — только лишний вызов, который дешевле второго правила «на что публиковать».
   */
  const publish = (id: ResourceId, store: PreviewStore): void => {
    channel?.set(id, store.get().selection);
  };

  /**
   * Принимает выделение, пришедшее в канал снаружи — с канваса редактора схемы.
   *
   * Отражение здесь не зацикливается по двум независимым причинам, и обе принадлежат не
   * этому месту: стор не уведомляет о совпадающем по содержимому выборе, а служба не
   * уведомляет о совпадающей по содержимому записи. Поэтому «принял → опубликовал то же
   * самое → услышал своё» затухает на первом же круге.
   */
  const adopt = (id: ResourceId): void => {
    const store = stores.get(id);
    if (channel === null || store === undefined) return;
    store.select(channel.get(id));
  };

  /**
   * Согласование при появлении состояния или канала.
   *
   * Направление решает наличие записи: чужой выбор старше (человек щёлкнул на канвасе,
   * а превью открыл после), своё уходит наружу, только когда в канале ничего нет.
   */
  const reconcile = (id: ResourceId, store: PreviewStore): void => {
    if (channel === null) return;
    if (channel.get(id).length > 0) adopt(id);
    else publish(id, store);
  };

  /** Начинает следить за состоянием документа, если канал подключён. */
  const attach = (id: ResourceId, store: PreviewStore): void => {
    if (channel === null || publishing.has(id)) return;
    publishing.set(
      id,
      store.subscribe(() => {
        publish(id, store);
      })
    );
  };

  const detach = (id: ResourceId): void => {
    publishing.get(id)?.dispose();
    publishing.delete(id);
  };

  return {
    storeFor(id) {
      let store = stores.get(id);
      if (store === undefined) {
        store = createPreviewStore();
        stores.set(id, store);
        attach(id, store);
        // Состояние родилось позже щелчка по канвасу: прочитать текущее выделение —
        // единственный способ подсветить узел, выбранный до открытия панели.
        reconcile(id, store);
      }
      return store;
    },

    active: () => activeId,

    setActive(id) {
      if (id === activeId) return;
      activeId = id;
      notify();
    },

    activeStore: () => (activeId === null ? null : (stores.get(activeId) ?? null)),

    version: () => version,

    subscribe(cb) {
      listeners.add(cb);
      return {
        dispose(): void {
          listeners.delete(cb);
        },
      };
    },

    connectSelection(next) {
      watching?.dispose();
      channel = next;
      watching = next.onDidChange((resource) => {
        adopt(resource);
      });
      for (const [id, store] of stores) {
        attach(id, store);
        // Догоняющее согласование: выбор, сделанный до подключения канала, иначе остался бы
        // виден только внутри превью, и «клик не дошёл до канваса» вернулось бы — просто
        // в редком порядке запуска, то есть в самом дорогом для отладки виде.
        reconcile(id, store);
      }
      return {
        dispose(): void {
          if (channel !== next) return;
          watching?.dispose();
          watching = null;
          channel = null;
          for (const id of [...publishing.keys()]) detach(id);
        },
      };
    },

    forget(id) {
      if (!stores.delete(id)) return;
      detach(id);
      // Запись в канале НЕ снимается: там уже может лежать выделение, поставленное редактором
      // схемы, а закрытие панели превью — не повод стирать чужой выбор. Владелец записи —
      // тот, кто владеет жизнью ресурса, а не одна из показывающих его сторон.
      if (activeId === id) activeId = null;
      notify();
    },

    dispose() {
      for (const id of [...publishing.keys()]) detach(id);
      watching?.dispose();
      watching = null;
      channel = null;
      stores.clear();
      listeners.clear();
      activeId = null;
    },
  };
}
