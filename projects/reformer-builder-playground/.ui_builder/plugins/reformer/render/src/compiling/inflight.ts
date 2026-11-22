/**
 * Метка незавершённой сборки формы — выход из петли зависаний (ReFormer-tv4z).
 *
 * Превью исполняет код формы в главном потоке, и бесконечный цикл в нём вешает вкладку. Хуже
 * того, зависание повторяется после перезагрузки: рабочие копии лежат в OPFS, рабочая область
 * восстанавливается, а в живом виде конструктора форма на экране всегда — тот же код исполнится
 * снова раньше, чем человек успеет открыть файл и исправить его. Подробно —
 * `docs/plans/builder-preview-hang-protection.md`.
 *
 * Перед сборкой формы ставится метка, после — снимается. Осталась метка, которую поставила не эта
 * загрузка страницы, — значит, прошлая сборка этой формы не завершилась: вкладку убили. Тогда
 * превью не собирает форму само, а ждёт человека.
 *
 * ## Почему `localStorage`
 *
 * Запись обязана завершиться ДО того, как исполнится код формы, а повиснуть он может в той же
 * задаче. `localStorage` пишет синхронно. IndexedDB асинхронна: транзакция зависшей задачи не
 * зафиксируется, и метки после перезагрузки не будет. `sessionStorage` теряется вместе со
 * вкладкой, а зависшую вкладку именно закрывают. Хранилище недоступно (приватный режим,
 * запрет) — защиты нет, но и сбоя нет: превью работает как раньше.
 *
 * ## Почему метка несёт загрузку страницы и счётчик
 *
 * Одну форму могут собирать две поверхности сразу (живой вид и вкладка превью), а пересборка
 * начинается, пока прежняя ещё идёт. Счётчик внутри страницы держит метку, пока жива хоть одна
 * сборка, — иначе завершившаяся снимала бы метку из-под той, что как раз повисла. Загрузка
 * страницы в метке отличает свою незавершённую сборку от чужой: своя — это просто идущая.
 *
 * @module plugins/reformer/render/compiling/inflight
 */

/** Та часть `Storage`, которой пользуется метка. */
export type MarkStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Метки сборок одной загрузки страницы. */
export interface InflightMarks {
  /** Осталась ли метка формы от сборки, которая не завершилась, — не этой загрузки страницы. */
  stale(key: string): boolean;
  /** Сборка формы началась. Отдаёт снятие ровно этой сборки; повторный вызов ничего не делает. */
  begin(key: string): () => void;
  /** Снять метку формы — человек исправил код и велел собрать снова. */
  clear(key: string): void;
  /**
   * Снять метки всех идущих сборок: страница уходит штатно (`pagehide`). Зависшая страница
   * этого события не получает — её метки остаются, ради чего всё и заведено.
   */
  abandon(): void;
}

/** Префикс ключа в хранилище: метки превью не путаются с чужими записями того же origin. */
export const INFLIGHT_PREFIX = 'reformer.preview.inflight:';

interface StoredMark {
  readonly page: string;
  readonly at: number;
}

function newPageId(): string {
  const random = globalThis.crypto?.randomUUID?.();
  return random ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Создаёт метки над хранилищем.
 *
 * @param storage - Хранилище; функцией, потому что сам доступ к `localStorage` может бросить.
 * @param page - Идентификатор загрузки страницы; по умолчанию — свежий.
 */
export function createInflightMarks(
  storage: () => MarkStorage | null,
  page: string = newPageId()
): InflightMarks {
  const running = new Map<string, number>();
  const itemOf = (key: string): string => `${INFLIGHT_PREFIX}${key}`;

  // Любой сбой хранилища — «защиты нет», а не исключение посреди сборки формы.
  const read = (key: string): string | null => {
    try {
      return storage()?.getItem(itemOf(key)) ?? null;
    } catch {
      return null;
    }
  };
  const write = (key: string): void => {
    try {
      const mark: StoredMark = { page, at: Date.now() };
      storage()?.setItem(itemOf(key), JSON.stringify(mark));
    } catch {
      // Переполнено или запрещено: сборка идёт без метки.
    }
  };
  const remove = (key: string): void => {
    try {
      storage()?.removeItem(itemOf(key));
    } catch {
      // Снять нечем — значит, и ставить было некуда.
    }
  };

  return {
    stale(key) {
      const raw = read(key);
      if (raw === null) return false;
      try {
        const mark = JSON.parse(raw) as Partial<StoredMark> | null;
        return mark?.page !== page;
      } catch {
        // Испорченная запись — не своя. Лишний раз спросить человека дешевле, чем зависнуть.
        return true;
      }
    },

    begin(key) {
      const count = running.get(key) ?? 0;
      running.set(key, count + 1);
      if (count === 0) write(key);
      let released = false;
      return () => {
        if (released) return;
        released = true;
        const left = (running.get(key) ?? 1) - 1;
        if (left > 0) {
          running.set(key, left);
          return;
        }
        running.delete(key);
        remove(key);
      };
    },

    clear(key) {
      remove(key);
    },

    abandon() {
      for (const key of running.keys()) remove(key);
      running.clear();
    },
  };
}

const browserStorage = (): MarkStorage | null =>
  typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage;

let shared: InflightMarks | undefined;

/**
 * Метки этой загрузки страницы — одни на все поверхности превью.
 *
 * Одни, потому что счётчик обязан видеть все сборки формы, а загрузка страницы — одна. Снятие на
 * `pagehide` подписывается при первом обращении.
 */
export function inflightMarks(): InflightMarks {
  if (shared === undefined) {
    const marks = createInflightMarks(browserStorage);
    shared = marks;
    if (typeof globalThis.addEventListener === 'function') {
      globalThis.addEventListener('pagehide', () => marks.abandon());
    }
  }
  return shared;
}
