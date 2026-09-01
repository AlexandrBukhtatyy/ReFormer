/**
 * Хранилище настроек поверх IndexedDB — то, что подставляется в {@link createSettingsService}.
 *
 * ## Почему не `localStorage`, хотя он проще
 *
 * Правило проекта — «`localStorage` не используем нигде», и до появления этого модуля оно
 * нарушалось сознательно и временно: без какого бы то ни было хранилища ширины панелей
 * не переживали перезагрузку вовсе. Временное исключение закрыто здесь.
 *
 * ## Синхронное чтение при асинхронном хранилище
 *
 * `settings.get` зовётся из отрисовки и обязан быть синхронным, а IndexedDB асинхронна.
 * Разрешено это НЕ здесь: службa настроек держит кэш в памяти, заполняет его один раз
 * (`hydrate`) и до загрузки отдаёт умолчание вклада. Этому хранилищу остаются ровно три
 * операции — прочитать область целиком, записать ключ, снять ключ, — и все три асинхронны
 * честно.
 *
 * **Запись идёт «в фоне» на уровне службы, а не здесь.** `set` кладёт значение в кэш и
 * уведомляет подписчиков ДО того, как хранилище подтвердит запись, а при отказе откатывает
 * кэш. Поэтому `write` здесь обязан дожидаться КОММИТА и отвергаться при отказе: разреши он
 * себе «принято, потом запишу» — откатывать стало бы нечего, и отказ записи стал бы
 * неотличим от успеха.
 *
 * **Что с записью, не успевшей уйти до закрытия вкладки.** Она теряется, и это осознанно.
 * Ни таймера-дебаунса, ни дозаписи на `pagehide` здесь нет:
 *
 * - дебаунс превратил бы окно потери из одного коммита (миллисекунды) в целый его интервал,
 *   то есть увеличил бы ровно то, что должен был уменьшить;
 * - на `pagehide` браузер не обещает довести транзакцию IndexedDB до конца, а синхронной
 *   записи в IndexedDB нет вовсе. Обещание, которое сдержать нечем, хуже его отсутствия.
 *
 * Цена ограничена по построению: область пишется ЦЕЛИКОМ и последняя запись побеждает,
 * поэтому недоехавший коммит теряет только самое последнее изменение, а не содержимое
 * области. Кто хочет знать, что запись легла, — дожидается промиса `settings.set`.
 *
 * ## Область `workspace` — пер-проектная
 *
 * Настройки области живут в {@link WorkspaceRecord.settings} той рабочей области, которая
 * открыта СЕЙЧАС ({@link IdbSettingsBackend.useWorkspace}). Прежняя одна глобальная запись
 * делала список включённых плагинов общим на все проекты — при том, что плагины лежат
 * В ПРОЕКТЕ. Пока проект не открыт, записывать область некуда: `write` отвергается, `read`
 * отдаёт пустоту (не отказ — служба обязана суметь загрузиться без проекта).
 *
 * ## Деградация обязательна
 *
 * Нет IndexedDB (приватное окно, запрет, заблокированное открытие) — настройки живут в памяти
 * сессии. Это то же решение, что у хранилища хэндлов (`app/fs-handles`) и у рабочей области:
 * инструмент обязан открыться, а несохранённая ширина панели не повод для белого экрана.
 * Признак деградации не выясняется отдельной пробой окружения, а берётся из ОТВЕТА хранилища:
 * код `idb-unavailable` — это и есть «его здесь нет». Остальные отказы (квота) пробрасываются:
 * их вызывающий обязан различать.
 *
 * @module host/services/settings-idb
 */

import { isStorageError } from '@/shell/platform/workspace/storage/errors';
import type { WorkspaceMetaStore } from '@/shell/platform/workspace/storage/idb';
import type { SettingsBackend, SettingsScope } from './settings';

/**
 * Хранилище, каким его видят настройки: четыре метода из {@link WorkspaceMetaStore}.
 *
 * `Pick` от настоящего типа, а не своя копия сигнатур: копия разъехалась бы с оригиналом
 * на первом же его изменении. `import type` при этом стирается на сборке — служба настроек
 * не тянет за собой слой рабочей области, а получает его от композиции.
 */
export type SettingsMetaStore = Pick<
  WorkspaceMetaStore,
  'getAppSettings' | 'putAppSettings' | 'getWorkspaceSettings' | 'putWorkspaceSettings'
>;

/** Имя области настроек приложения в хранилище. Совпадает с именем области службы. */
const APP_SCOPE = 'user';

/** Хранилище настроек, знающее про открытый проект. */
export interface IdbSettingsBackend extends SettingsBackend {
  /**
   * Сообщает, какая рабочая область открыта сейчас. `null` — проекта нет.
   *
   * Зовёт композиция на смену проекта, ДО того как перечитает настройки: иначе перечитывание
   * взяло бы записи прежнего проекта.
   */
  useWorkspace(id: string | null): void;
}

/** Куда пишется и откуда читается одна область — снимок, взятый в момент вызова. */
interface Target {
  /** Ключ бага в памяти: `user` либо `workspace:<id>`. */
  readonly key: string;
  read(): Promise<Readonly<Record<string, unknown>>>;
  write(values: Readonly<Record<string, unknown>>): Promise<void>;
}

/**
 * Создаёт хранилище настроек над метаданными рабочих областей.
 *
 * @param store - Хранилище метаданных. Создаёт его композиция: у слоя IndexedDB свой владелец,
 *   и заводить второе соединение ради настроек незачем.
 */
export function createIdbSettingsBackend(store: SettingsMetaStore): IdbSettingsBackend {
  /** Копии областей в памяти. Они же — всё хранилище, если IndexedDB недоступна. */
  const bags = new Map<string, Record<string, unknown>>();
  let workspaceId: string | null = null;
  let persist = true;

  /**
   * Очередь: все обращения к хранилищу идут по одному.
   *
   * Без неё чтение, назначенное после записи, могло бы обогнать её коммит и вернуть значение,
   * которое пользователь уже сменил. Отказ предыдущей работы очередь не рвёт — иначе одна
   * неудачная запись выключала бы настройки до перезагрузки.
   */
  let chain: Promise<unknown> = Promise.resolve();
  const enqueue = <T>(job: () => Promise<T>): Promise<T> => {
    const next = chain.then(job, job);
    chain = next.catch(() => undefined);
    return next;
  };

  const targetOf = (scope: SettingsScope): Target | null => {
    if (scope === 'user') {
      return {
        key: APP_SCOPE,
        read: () => store.getAppSettings(APP_SCOPE),
        write: (values) => store.putAppSettings(APP_SCOPE, values),
      };
    }
    // Идентификатор снимается ЗДЕСЬ, а не в теле работы: пока та ждёт очереди, проект могут
    // сменить, и запись ушла бы в чужую рабочую область.
    const id = workspaceId;
    if (id === null) return null;
    return {
      key: `workspace:${id}`,
      read: () => store.getWorkspaceSettings(id),
      write: (values) => store.putWorkspaceSettings(id, values),
    };
  };

  const local = (key: string): Record<string, unknown> => {
    const known = bags.get(key);
    if (known !== undefined) return known;
    const fresh: Record<string, unknown> = {};
    bags.set(key, fresh);
    return fresh;
  };

  /** Отказ означает «IndexedDB здесь нет»? Тогда дальше живём в памяти. */
  const degraded = (error: unknown): boolean => {
    if (!isStorageError(error, 'idb-unavailable')) return false;
    if (persist) {
      persist = false;
      console.warn('[settings] IndexedDB недоступна: настройки живут в памяти сессии', error);
    }
    return true;
  };

  /** Поднять область в память. Отдаёт саму ячейку — её же правит запись. */
  const pull = async (target: Target): Promise<Record<string, unknown>> => {
    if (!persist) return local(target.key);
    try {
      const stored = await target.read();
      const bag = { ...stored };
      bags.set(target.key, bag);
      return bag;
    } catch (error) {
      if (!degraded(error)) throw error;
      return local(target.key);
    }
  };

  const push = async (target: Target, bag: Record<string, unknown>): Promise<void> => {
    if (!persist) return;
    try {
      await target.write({ ...bag });
    } catch (error) {
      // Квота и «области нет» — не деградация: вызывающий обязан узнать, что не сохранилось.
      if (!degraded(error)) throw error;
    }
  };

  /** Правка одного ключа: область целиком, последняя запись побеждает. */
  const edit = (
    scope: SettingsScope,
    apply: (bag: Record<string, unknown>) => void
  ): Promise<void> => {
    const target = targetOf(scope);
    if (target === null) {
      return Promise.reject(
        new Error('settings: настройки рабочей области некуда записать — проект не открыт')
      );
    }
    return enqueue(async () => {
      // Область могли ни разу не прочитать (запись раньше загрузки). Поднимаем её здесь,
      // иначе запись «целиком» затёрла бы то, чего мы не видели.
      const bag = bags.get(target.key) ?? (await pull(target));
      const before = { ...bag };
      apply(bag);
      try {
        await push(target, bag);
      } catch (error) {
        // Не прошло — значит и в памяти этого нет. Иначе следующая запись, которая пишет
        // область ЦЕЛИКОМ, унесла бы с собой отвергнутое значение, а служба его к тому
        // времени уже откатила: хранилище и кэш разошлись бы молча.
        bags.set(target.key, before);
        throw error;
      }
    });
  };

  return {
    useWorkspace(id) {
      workspaceId = id;
    },

    read(scope) {
      const target = targetOf(scope);
      // Проекта нет — записей области нет. Это не отказ: служба обязана загрузиться и до того,
      // как проект восстановлен, а восстановление идёт после отрисовки.
      if (target === null) return Promise.resolve({});
      return enqueue(async () => ({ ...(await pull(target)) }));
    },

    write(scope, key, value) {
      return edit(scope, (bag) => {
        bag[key] = value;
      });
    },

    remove(scope, key) {
      return edit(scope, (bag) => {
        delete bag[key];
      });
    },
  };
}
