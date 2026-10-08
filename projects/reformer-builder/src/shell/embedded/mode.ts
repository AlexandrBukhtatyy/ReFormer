/**
 * Режим билдера: включён он на этой странице или нет.
 *
 * ## Состояние переживает перезагрузку страницы — и только её
 *
 * Хранится в `sessionStorage`: dev-сервер приложения вправе перезагрузить страницу после записи
 * файла, и человек, правивший форму, обязан вернуться в билдер, а не на страницу приложения.
 * Дольше вкладки состояние не живёт намеренно: билдер включают под задачу, и вчерашнее «включён»
 * в новой вкладке означало бы, что приложение открылось не приложением.
 *
 * ## Новая вкладка открывается без билдера
 *
 * Окно, открытое из страницы, наследует копию `sessionStorage` — если только оно не открыто
 * без связи с открывшим. Поэтому «приложение в отдельной вкладке» открывают с `noopener`
 * (см. панель превью): там нужно приложение как оно есть.
 *
 * Хранилище внедряется: в приватном окне и в тестах его может не быть, и это не отказ —
 * режим тогда живёт в памяти страницы.
 *
 * @module shell/embedded/mode
 */

/** Ключ записи. Пространство имён билдера: хранилище общее с приложением. */
export const MODE_STORAGE_KEY = 'reformer-builder.mode';

const ON = 'on';

/** Хранилище в объёме, который нужен режиму. `sessionStorage` подходит структурно. */
export interface ModeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface ModeStore {
  /** Включён ли режим билдера. */
  get(): boolean;
  set(on: boolean): void;
  subscribe(listener: () => void): () => void;
}

export function createModeStore(storage: ModeStorage | null): ModeStore {
  const read = (): boolean => {
    try {
      return storage?.getItem(MODE_STORAGE_KEY) === ON;
    } catch {
      // Хранилище есть, но недоступно (запрещено политикой): режим просто не восстановится.
      return false;
    }
  };

  let on = read();
  const listeners = new Set<() => void>();

  return {
    get: () => on,

    set(next) {
      if (next === on) return;
      on = next;
      try {
        if (next) storage?.setItem(MODE_STORAGE_KEY, ON);
        else storage?.removeItem(MODE_STORAGE_KEY);
      } catch {
        // Запись не удалась — режим действует до перезагрузки страницы, и этого достаточно.
      }
      for (const listener of [...listeners]) listener();
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** `sessionStorage` страницы либо `null`, если его нет или к нему нет доступа. */
export function browserModeStorage(): ModeStorage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}
