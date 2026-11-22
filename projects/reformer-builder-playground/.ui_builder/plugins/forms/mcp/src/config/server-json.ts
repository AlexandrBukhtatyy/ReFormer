/**
 * `server.json` сервера-бандла — настройки его запуска.
 *
 * Пока поле одно: `idleSeconds` — сколько воркер живёт без вызовов, прежде чем диспетчер его
 * остановит (`../connection/supervisor`). `0` — останавливать сразу после вызова (лёгкий сервер),
 * больше умолчания — держать дольше (дорогой в запуске). Потолок живых воркеров — общий, здесь
 * его нет: им распоряжается не сервер, а хост.
 *
 * Разбор отвечает значением, а не исключением. Неверное поле — не повод не запускать сервер:
 * действует умолчание, а замечание показывает панель. Неизвестные поля пропускаются — новое
 * поле, понятное следующей версии хоста, не должно ломать эту.
 *
 * @module plugins/forms/mcp/config/server-json
 */

/** Предел `idleSeconds`: час. Дольше держать воркер без вызовов не за чем. */
export const MAX_IDLE_SECONDS = 3600;

export interface ServerSettings {
  readonly idleSeconds?: number;
  /** Что пришлось заменить умолчанием — по фразе на поле. */
  readonly notes: readonly string[];
}

/** Разобрать текст `server.json`; `null` — файла нет. */
export function parseServerJson(text: string | null): ServerSettings {
  if (text === null) return { notes: [] };
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { notes: ['server.json не разбирается как JSON — действуют умолчания'] };
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { notes: ['server.json — не объект — действуют умолчания'] };
  }

  const { idleSeconds } = value as { idleSeconds?: unknown };
  if (idleSeconds === undefined) return { notes: [] };
  if (
    typeof idleSeconds !== 'number' ||
    !Number.isInteger(idleSeconds) ||
    idleSeconds < 0 ||
    idleSeconds > MAX_IDLE_SECONDS
  ) {
    return {
      notes: [`idleSeconds — целое от 0 до ${MAX_IDLE_SECONDS}; действует умолчание`],
    };
  }
  return { idleSeconds, notes: [] };
}
