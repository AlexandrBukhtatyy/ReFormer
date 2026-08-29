/**
 * Изолированное хранилище плагина и его секреты.
 *
 * Два разных API, потому что у них разные умолчания по времени жизни: обычные данные плагин
 * кладёт, чтобы они пережили перезагрузку страницы, а секрет — чтобы он **не** пережил её,
 * пока не сказано обратное.
 *
 * ## `localStorage` не используется нигде
 *
 * В v1 в `localStorage` лежит ключ AI-провайдера — это ровно та ошибка, которую здесь
 * не повторяем: `localStorage` синхронный (то есть блокирует поток на каждом обращении),
 * общий на весь источник (то есть без пространств имён) и доступен любому скрипту на странице
 * без единого рубежа. Постоянное хранилище — IndexedDB, и оно приходит сюда бэкендом.
 *
 * ## Почему бэкенд внедряется, а не импортируется
 *
 * Слой IndexedDB — соседняя работа (`host/workspace/storage/`). Если бы этот модуль импортировал
 * его напрямую, изолированное хранилище нельзя было бы проверить без базы, а тест пространств
 * имён превратился бы в тест IDB. Поэтому здесь объявлен минимальный контракт
 * {@link PluginStorageBackend}, зеркалящий поверхность хранилища плюс пространство имён,
 * и есть его памятная реализация {@link createMemoryStorageBackend}. Настоящий бэкенд подключает
 * композиция, ничего в этом файле не меняя.
 *
 * ## Пространство имён — идентификатор плагина
 *
 * Честная оговорка из контракта: пока весь код на странице наш, изоляция пространств — гигиена,
 * а не граница безопасности. Дотянуться до чужого пространства можно, и рантайм этому помешать
 * не в состоянии. Ценность в другом: секрет не протечёт в будущий плагин по недосмотру, а XSS
 * в одном месте не достанет ключ из другого. Подделать пространство плагин при этом не может:
 * `pluginId` связывается в момент создания хранилища рантаймом — тем же приёмом, что
 * `ExtensionRegistry.forPlugin`.
 *
 * @module host/plugin/storage
 */

/** Данные плагина. Переживают перезагрузку страницы — если бэкенд постоянный. */
export interface PluginStorage {
  /**
   * Значение по ключу или `undefined`.
   *
   * `T` — обещание вызывающего, а не проверка: бэкенд хранит то, что положили, и после
   * перезагрузки страницы там может лежать значение прежней версии плагина. Прочитанное
   * проверяет тот, кто читает.
   */
  get<T>(key: string): Promise<T | undefined>;
  /** Значение обязано быть структурно клонируемым: бэкенд — IndexedDB, а не JSON. */
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  /** Только ключи своего пространства имён. */
  keys(): Promise<readonly string[]>;
}

/**
 * Секреты плагина: токены, ключи провайдеров.
 *
 * Умолчание — память сессии. Это решение, а не недоделка: секрет, который переживает
 * перезагрузку, обязан быть положен туда сознательным `persist`, потому что цена ошибки
 * несимметрична — забытый в памяти секрет стоит одного повторного ввода, забытый на диске
 * живёт до тех пор, пока о нём не вспомнят.
 */
export interface SecretStorage {
  get(key: string): Promise<string | undefined>;
  /** По умолчанию — только память сессии. `persist` пишет в изолированное пространство. */
  set(key: string, value: string, opts?: { persist?: boolean }): Promise<void>;
  delete(key: string): Promise<void>;
}

/**
 * Контракт постоянного хранилища, поверх которого работают {@link PluginStorage}
 * и постоянная половина {@link SecretStorage}.
 *
 * Поверхность повторяет `PluginStorage` с добавленным пространством имён — и это осознанно.
 * Более узкий контракт (скажем, только `get`/`set`) заставил бы этот модуль вести собственный
 * указатель ключей, то есть дублировать работу, которую IndexedDB делает одним курсором,
 * и держать его в согласии с данными при каждом отказе записи.
 *
 * Реализация обязана держать пространства раздельно: записанное в `a` не видно из `b`.
 */
export interface PluginStorageBackend {
  get(namespace: string, key: string): Promise<unknown>;
  set(namespace: string, key: string, value: unknown): Promise<void>;
  delete(namespace: string, key: string): Promise<void>;
  keys(namespace: string): Promise<readonly string[]>;
}

/**
 * Память сессии для секретов.
 *
 * Синхронная, потому что это `Map`: асинхронность была бы имитацией ради единообразия
 * с бэкендом, а платит за неё каждый вызывающий.
 */
export interface SecretSessionStore {
  get(namespace: string, key: string): string | undefined;
  set(namespace: string, key: string, value: string): void;
  delete(namespace: string, key: string): void;
}

/**
 * Пространство имён данных плагина.
 *
 * Разделение с пространством секретов держится на суффиксе: `plugin:<id>:data` и
 * `plugin:<id>:secrets` не совпадут ни при каком `id`, потому что различаются концом строки.
 * Без суффикса плагин с именем вида `acme:secrets` попал бы в чужое пространство.
 */
function dataNamespace(pluginId: string): string {
  return `plugin:${pluginId}:data`;
}

/** Пространство имён постоянных секретов плагина. См. {@link dataNamespace}. */
function secretNamespace(pluginId: string): string {
  return `plugin:${pluginId}:secrets`;
}

function assertPluginId(pluginId: string, where: string): void {
  if (pluginId.trim() === '') {
    throw new Error(`${where}: идентификатор плагина не может быть пустым`);
  }
}

/**
 * Пустой ключ — отказ, а не запись под именем «».
 *
 * Такой ключ почти всегда означает неинициализированную переменную у вызывающего; записанное
 * молча под ним потом никто не найдёт, потому что искать будут по осмысленному имени.
 */
function assertKey(key: string, where: string): void {
  if (key.trim() === '') {
    throw new Error(`${where}: ключ не может быть пустым`);
  }
}

/**
 * Создаёт изолированное хранилище плагина поверх бэкенда.
 *
 * `pluginId` связывается здесь и в API хранилища не появляется: плагин не может ни указать
 * чужое пространство, ни забыть указать своё.
 */
export function createPluginStorage(
  pluginId: string,
  backend: PluginStorageBackend
): PluginStorage {
  assertPluginId(pluginId, 'createPluginStorage');
  const namespace = dataNamespace(pluginId);

  return {
    async get<T>(key: string): Promise<T | undefined> {
      assertKey(key, 'PluginStorage.get');
      // Единственное приведение в модуле: бэкенд типизирован `unknown` намеренно — соответствие
      // `T` он проверить не может, в базе лежит то, что положила прежняя версия плагина.
      return (await backend.get(namespace, key)) as T | undefined;
    },

    async set<T>(key: string, value: T): Promise<void> {
      assertKey(key, 'PluginStorage.set');
      await backend.set(namespace, key, value);
    },

    async delete(key: string): Promise<void> {
      assertKey(key, 'PluginStorage.delete');
      await backend.delete(namespace, key);
    },

    async keys(): Promise<readonly string[]> {
      return await backend.keys(namespace);
    },
  };
}

/**
 * Создаёт хранилище секретов плагина.
 *
 * ## Что где лежит
 *
 * `set` без `persist` кладёт значение только в {@link SecretSessionStore} — перезагрузка
 * страницы его теряет. `set` с `persist: true` пишет в бэкенд **и** в память сессии: иначе
 * чтение сразу после записи шло бы в базу без надобности.
 *
 * ## Почему `set` без `persist` снимает прежнюю постоянную копию
 *
 * Иначе получилась бы худшая из возможных форм: плагин однажды сохранил ключ навсегда, потом
 * заменил его сеансовым, а после перезагрузки страницы вернулся бы **старый** ключ — и выглядело
 * бы это как «приложение помнит то, что я стёр». Просьба «только на сессию» трактуется буквально:
 * постоянной копии этого ключа после неё не остаётся.
 *
 * ## Почему память сессии внедряется, а не заводится модульной переменной
 *
 * По времени жизни это ровно «память модуля» из контракта: она переживает деактивацию
 * и перезагрузку плагина, но не перезагрузку страницы. Модульная переменная дала бы то же самое,
 * но её нельзя ни сбросить между тестами, ни завести два независимых Host в одном процессе —
 * а именно так устроены тесты рантайма. Поэтому владелец памяти — реестр плагинов, который
 * живёт ровно столько же, сколько модуль.
 */
export function createSecretStorage(
  pluginId: string,
  deps: { readonly session: SecretSessionStore; readonly backend: PluginStorageBackend }
): SecretStorage {
  assertPluginId(pluginId, 'createSecretStorage');
  const namespace = secretNamespace(pluginId);
  const { session, backend } = deps;

  return {
    async get(key: string): Promise<string | undefined> {
      assertKey(key, 'SecretStorage.get');
      const fromSession = session.get(namespace, key);
      if (fromSession !== undefined) return fromSession;

      const stored = await backend.get(namespace, key);
      // Не строка — значит в пространстве секретов лежит чужое или испорченное. Отдать это
      // как секрет хуже, чем не найти: вызывающий подставит его в заголовок запроса.
      return typeof stored === 'string' ? stored : undefined;
    },

    async set(key: string, value: string, opts?: { persist?: boolean }): Promise<void> {
      assertKey(key, 'SecretStorage.set');
      session.set(namespace, key, value);
      if (opts?.persist === true) {
        await backend.set(namespace, key, value);
        return;
      }
      await backend.delete(namespace, key);
    },

    async delete(key: string): Promise<void> {
      assertKey(key, 'SecretStorage.delete');
      session.delete(namespace, key);
      await backend.delete(namespace, key);
    },
  };
}

/**
 * Создаёт память сессии для секретов. Один экземпляр на рантайм плагинов.
 *
 * Карта карт, а не одна карта со склеенным ключом: любой разделитель рано или поздно
 * встретится внутри самого ключа, и тогда пространства двух плагинов пересеклись бы в одной
 * записи — ровно то, что этот модуль обязан исключить.
 */
export function createSecretSessionStore(): SecretSessionStore {
  const spaces = new Map<string, Map<string, string>>();

  return {
    get: (namespace, key) => spaces.get(namespace)?.get(key),
    set: (namespace, key, value) => {
      let space = spaces.get(namespace);
      if (space === undefined) {
        space = new Map<string, string>();
        spaces.set(namespace, space);
      }
      space.set(key, value);
    },
    delete: (namespace, key) => {
      spaces.get(namespace)?.delete(key);
    },
  };
}

/**
 * Памятный бэкенд: рабочее умолчание до появления IDB и подставной в тестах.
 *
 * ## Почему значения клонируются
 *
 * IndexedDB отдаёт структурный клон, а не ссылку: плагин, изменивший полученный объект,
 * хранимое состояние этим не меняет. Памятный бэкенд без клонирования вёл бы себя иначе,
 * и разница вылезла бы не здесь, а при переезде на настоящую базу — в виде «в тестах работало».
 * `structuredClone` заодно повторяет и отказ IDB на неклонируемом значении (функция, DOM-узел),
 * то есть такая ошибка находится там же, где нашлась бы в бою.
 */
export function createMemoryStorageBackend(): PluginStorageBackend {
  const spaces = new Map<string, Map<string, unknown>>();

  const spaceOf = (namespace: string): Map<string, unknown> => {
    let space = spaces.get(namespace);
    if (space === undefined) {
      space = new Map<string, unknown>();
      spaces.set(namespace, space);
    }
    return space;
  };

  return {
    get(namespace: string, key: string): Promise<unknown> {
      const stored = spaces.get(namespace)?.get(key);
      return Promise.resolve(stored === undefined ? undefined : structuredClone(stored));
    },

    set(namespace: string, key: string, value: unknown): Promise<void> {
      spaceOf(namespace).set(key, structuredClone(value));
      return Promise.resolve();
    },

    delete(namespace: string, key: string): Promise<void> {
      spaces.get(namespace)?.delete(key);
      return Promise.resolve();
    },

    keys(namespace: string): Promise<readonly string[]> {
      const space = spaces.get(namespace);
      return Promise.resolve(space === undefined ? [] : [...space.keys()]);
    },
  };
}
