/**
 * Открытые вкладки переживают перезагрузку страницы.
 *
 * ## Почему это композиция, а не хранилище вкладок
 *
 * Вкладки (`host/ui/tabs`) знают ряд и активную; метаданные рабочей области
 * (`host/workspace/storage/idb`) знают, что переживает перезагрузку. Ни один из двоих
 * не вправе знать второго: стор вкладок с обращениями к IndexedDB перестал бы быть
 * состоянием интерфейса, а хранилище метаданных, дёргающее `open`, перестало бы быть
 * хранилищем. Встретиться им можно только здесь — и место записи (стор `opened`) для этого
 * уже было заведено, но не подключено ни к чему.
 *
 * ## Что именно восстанавливается
 *
 * Ряд, его порядок, временная вкладка и активная. Содержимое приходит само: рабочая копия
 * лежит в OPFS, поэтому возвращаются и несохранённые правки — вкладка с точкой
 * несохранённого после перезагрузки остаётся такой же.
 *
 * НЕ восстанавливается прокрутка и позиция каретки. Это `viewState`, он объявлен у редактора
 * (`EditorContribution.saveViewState`), но снимать его надо в момент ухода со вкладки,
 * а такого канала у оболочки пока нет. Поле в записи под него есть и остаётся пустым —
 * лучше пустое поле, чем восстановленный не тот вид.
 *
 * ## Запись идёт по ЗНАЧИМОЙ проекции, а не на каждое изменение
 *
 * Подписка на вкладки дёргается и от правки текста (у вкладки меняется признак
 * несохранённого), а он к составу ряда отношения не имеет. Поэтому сравнивается проекция
 * «адрес + порядок + временная + активная»: одна строка вместо обхода IndexedDB на каждое
 * нажатие клавиши.
 *
 * @module app/opened-tabs
 */

import type { Disposable } from '@/shell/platform/primitives/disposable';
import type { ResourceId } from '@/shell/platform/primitives/resource';
import type { DocumentTabsStore } from '@/shell/platform/ui/state/tabs';
import type { OpenedRecord, WorkspaceMetaStore } from '@/shell/platform/workspace/storage/idb';

/** Хранилище метаданных в объёме, которым пользуются вкладки. */
export type OpenedTabsMeta = Pick<WorkspaceMetaStore, 'listOpened' | 'putOpened' | 'removeOpened'>;

/** Вкладки в объёме, которым пользуется восстановление. */
export type OpenedTabsDocuments = Pick<
  DocumentTabsStore,
  'get' | 'subscribe' | 'open' | 'activate' | 'move'
>;

export interface OpenedTabsOptions {
  readonly workspaceId: string;
  readonly documents: OpenedTabsDocuments;
  readonly meta: OpenedTabsMeta;
  /** Часы. Параметром ради тестов: `activatedAt` обязан быть предсказуемым. */
  readonly now?: () => number;
  /** Куда сообщать об отказе хранилища. Восстановление и запись не роняют сессию. */
  readonly onError?: (error: unknown) => void;
}

function defaultOnError(error: unknown): void {
  console.warn('[shell] вкладки: состояние ряда не сохранено', error);
}

/** Строка, по которой видно, изменился ли СОСТАВ ряда, а не содержимое документов. */
function keyOf(documents: OpenedTabsDocuments): string {
  const state = documents.get();
  const tabs = state.tabs.map((tab) => `${tab.ref.id}:${tab.preview ? 'p' : 'f'}`).join('|');
  return `${tabs}#${state.activeId ?? ''}`;
}

/**
 * Синхронизирует записи об открытых вкладках с рядом.
 *
 * Пишет ряд целиком, а не разницу по полям: вкладок единицы, и «переписать всё» здесь
 * дешевле и надёжнее вычисления того, что именно сдвинулось при перестановке.
 */
export function watchOpenedTabs(options: OpenedTabsOptions): Disposable {
  const { workspaceId, documents, meta } = options;
  const now = options.now ?? Date.now;
  const onError = options.onError ?? defaultOnError;

  /** Когда вкладка открыта впервые: у пережившей перезагрузку время не обновляется. */
  const openedAt = new Map<ResourceId, number>();
  let known = new Set<ResourceId>();
  let key = keyOf(documents);

  const sync = (): void => {
    const state = documents.get();
    const stamp = now();
    const present = new Set<ResourceId>();

    const writes: Promise<void>[] = [];
    state.tabs.forEach((tab, order) => {
      const id = tab.ref.id;
      present.add(id);
      const since = openedAt.get(id) ?? stamp;
      openedAt.set(id, since);
      const record: OpenedRecord = {
        workspaceId,
        resourceId: id,
        order,
        // Закреплённая — это НЕ временная: временной вкладке следующее открытие в дереве
        // придёт на смену, и после перезагрузки она обязана остаться такой же.
        pinned: !tab.preview,
        openedAt: since,
        // Время активации нужно ровно затем, чтобы вернуть активную вкладку: у остальных
        // оно хранит, когда на них смотрели в последний раз.
        activatedAt: state.activeId === id ? stamp : (openedAt.get(id) ?? stamp),
      };
      writes.push(meta.putOpened(record));
    });

    for (const id of known) {
      if (present.has(id)) continue;
      openedAt.delete(id);
      writes.push(meta.removeOpened(workspaceId, id));
    }
    known = present;

    void Promise.all(writes).catch(onError);
  };

  const subscription = documents.subscribe(() => {
    const next = keyOf(documents);
    if (next === key) return;
    key = next;
    sync();
  });

  // Первый снимок сразу: ряд мог быть восстановлен до подписки, и без этого записи
  // не появились бы до первого щелчка.
  sync();

  return {
    dispose: () => {
      subscription.dispose();
    },
  };
}

/**
 * Открывает вкладки, сохранённые прошлым сеансом.
 *
 * Порядок восстановления не совпадает с порядком ряда, и это вынужденно: временная вкладка
 * при открытии ЗАМЕЩАЕТ прежнюю временную, поэтому её открывают последней, а затем ставят
 * на место. Иначе каждая следующая вкладка съедала бы предыдущую.
 *
 * Исчезнувший файл — обычное дело между сеансами (переименовали, удалили мимо билдера).
 * Он не должен ни ронять восстановление, ни оставаться в записях: их чистит тот, кто узнал
 * об исчезновении.
 */
export async function restoreOpenedTabs(options: OpenedTabsOptions): Promise<void> {
  const { workspaceId, documents, meta } = options;
  const onError = options.onError ?? defaultOnError;

  let records: readonly OpenedRecord[];
  try {
    records = await meta.listOpened(workspaceId);
  } catch (error) {
    onError(error);
    return;
  }
  if (records.length === 0) return;

  const ordered = [...records].sort((a, b) => a.order - b.order);
  const restored: OpenedRecord[] = [];

  const open = async (record: OpenedRecord): Promise<void> => {
    try {
      await documents.open(record.resourceId, { preview: !record.pinned });
      restored.push(record);
    } catch {
      // Молча пропускаем и убираем запись: сообщать человеку о вкладке, которую он
      // не открывал в этом сеансе, — шум, а восстановить её всё равно нечем.
      await meta.removeOpened(workspaceId, record.resourceId).catch(onError);
    }
  };

  for (const record of ordered) {
    if (!record.pinned) continue;
    await open(record);
  }
  for (const record of ordered) {
    if (record.pinned) continue;
    await open(record);
    // Вернуть временную вкладку на её место в ряду: открытие всегда добавляет в конец.
    if (restored.includes(record)) documents.move(record.resourceId, record.order);
  }

  const active = restored.reduce<OpenedRecord | null>(
    (best, record) => (best === null || record.activatedAt > best.activatedAt ? record : best),
    null
  );
  if (active !== null) documents.activate(active.resourceId);
}
