/**
 * Корневой реестр точек расширения — то, что заводит оболочка.
 *
 * Объявление точки (`ExtensionPoint`, `defineExtensionPoint`), вклад и вид реестра для плагина
 * живут в пакете `@reformer/builder-plugin-api`. Там же записано, откуда берётся `pluginId`:
 * реестр выдаёт ВИД на себя, и подставить чужое имя плагину нечем.
 *
 * Метода `contribute` у корневого реестра нет, и это делает проверяемым правило «ни одна
 * точка расширения не заполняется самим Host» — не соглашением, а отсутствием пути.
 *
 * @module shell/platform/primitives/extension-point
 */

import {
  toDisposable,
  type Contribution,
  type ContributionMeta,
  type Disposable,
  type ExtensionPoint,
  type ExtensionRegistry,
} from '@reformer/builder-plugin-api/internal';

/**
 * Корневой реестр. Создаётся Host в единственном экземпляре.
 *
 * Читать может, писать — нет: запись доступна только через {@link forPlugin}.
 */
export interface RootExtensionRegistry {
  /**
   * Вид реестра для плагина. Повторный вызов с тем же `pluginId` возвращает тот же объект —
   * идентичность стабильна, чтобы вид можно было держать в зависимостях React-хуков.
   */
  forPlugin(pluginId: string): ExtensionRegistry;
  get<T>(point: ExtensionPoint<T>): readonly Contribution<T>[];
  observe<T>(point: ExtensionPoint<T>, cb: () => void): Disposable;
}

interface Entry {
  readonly contribution: Contribution<unknown>;
  /** Номер регистрации: разрыв равенства по `order`, не зависящий от стабильности sort. */
  readonly seq: number;
}

interface PointState {
  readonly entries: Entry[];
  readonly observers: Set<() => void>;
  /** Отсортированный снимок; `null` — устарел и будет пересчитан при первом чтении. */
  snapshot: readonly Contribution<unknown>[] | null;
}

/** Общий пустой результат: одна ссылка на все точки без вкладов — см. кэш снимков ниже. */
const EMPTY: readonly Contribution<unknown>[] = Object.freeze([]);

/**
 * Создаёт корневой реестр вкладов.
 *
 * ## Почему `get` отдаёт кэшированный снимок
 *
 * Между изменениями `get` возвращает **ту же** ссылку на массив. Это не оптимизация:
 * основной потребитель — `useSyncExternalStore`, который требует стабильного `getSnapshot`
 * и падает с «The result of getSnapshot should be cached», если каждый вызов даёт новый
 * массив. Снимок сбрасывается при добавлении и снятии вклада — ровно тогда же, когда
 * вызываются наблюдатели.
 */
export function createExtensionRegistry(): RootExtensionRegistry {
  const points = new Map<string, PointState>();
  const views = new Map<string, ExtensionRegistry>();
  let nextSeq = 0;

  const stateOf = (pointId: string): PointState => {
    let state = points.get(pointId);
    if (state === undefined) {
      state = { entries: [], observers: new Set(), snapshot: null };
      points.set(pointId, state);
    }
    return state;
  };

  /**
   * Уведомляет наблюдателей точки.
   *
   * Копия набора — на случай, если наблюдатель в ответ вносит или снимает вклад: без неё
   * это была бы мутация коллекции во время обхода. Ошибка одного наблюдателя не мешает
   * остальным и не откатывает уже совершённое изменение реестра — политика та же, что
   * у `disposeAll`, чтобы не заводить в примитивах двух разных.
   */
  const notify = (state: PointState): void => {
    const errors: unknown[] = [];
    for (const cb of [...state.observers]) {
      try {
        cb();
      } catch (err) {
        errors.push(err);
      }
    }
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) {
      throw new AggregateError(errors, 'ошибки в наблюдателях точки расширения');
    }
  };

  const get = <T>(point: ExtensionPoint<T>): readonly Contribution<T>[] => {
    const state = points.get(point.id);
    if (state === undefined) return EMPTY as readonly Contribution<T>[];
    if (state.snapshot === null) {
      state.snapshot = Object.freeze(
        [...state.entries]
          .sort((a, b) => a.contribution.order - b.contribution.order || a.seq - b.seq)
          .map((entry) => entry.contribution)
      );
    }
    return state.snapshot as readonly Contribution<T>[];
  };

  const observe = <T>(point: ExtensionPoint<T>, cb: () => void): Disposable => {
    const state = stateOf(point.id);
    state.observers.add(cb);
    return toDisposable(() => {
      state.observers.delete(cb);
    });
  };

  const contribute = <T>(
    pluginId: string,
    point: ExtensionPoint<T>,
    item: T,
    meta?: ContributionMeta
  ): Disposable => {
    const state = stateOf(point.id);
    const seq = nextSeq++;
    const id = meta?.id ?? `${pluginId}:${point.id}#${seq}`;

    // Уникальность проверяем только для явного id: сгенерированный уникален по построению.
    // Проверка не косметическая — вклады рисуются списком, и совпадение id означает
    // одинаковые React-ключи, то есть перепутанное состояние соседних панелей.
    if (meta?.id !== undefined && state.entries.some((e) => e.contribution.id === id)) {
      throw new Error(
        `вклад с id «${id}» уже есть в точке «${point.id}». Идентификатор вклада уникален ` +
          'в пределах точки: снимите прежний вклад или задайте другой id'
      );
    }

    const contribution: Contribution<unknown> = Object.freeze({
      id,
      pluginId,
      order: meta?.order ?? 0,
      value: item as unknown,
    });
    state.entries.push({ contribution, seq });
    state.snapshot = null;
    notify(state);

    return toDisposable(() => {
      const index = state.entries.findIndex((e) => e.contribution === contribution);
      if (index < 0) return;
      state.entries.splice(index, 1);
      state.snapshot = null;
      notify(state);
    });
  };

  return {
    forPlugin(pluginId: string): ExtensionRegistry {
      if (pluginId.trim() === '') {
        throw new Error('forPlugin: идентификатор плагина не может быть пустым');
      }
      let view = views.get(pluginId);
      if (view === undefined) {
        view = {
          contribute: <T>(point: ExtensionPoint<T>, item: T, meta?: ContributionMeta): Disposable =>
            contribute(pluginId, point, item, meta),
          get,
          observe,
        };
        views.set(pluginId, view);
      }
      return view;
    },
    get,
    observe,
  };
}
