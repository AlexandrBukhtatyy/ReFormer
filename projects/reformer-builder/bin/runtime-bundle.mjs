/**
 * Конфиг уровня запуска: чтение с диска и ответ, которым его получает SPA.
 *
 * Конфиг запуска — `.ui_builder/config.json` каталога, где билдер запустили. Отдают его трое:
 * лаунчер (читает один раз при старте), dev-сервер самого билдера и плагин Vite в приложении
 * (оба читают на каждый запрос — правка файла видна после перезагрузки страницы). Адрес
 * и формат ответа у них общие, поэтому живут здесь.
 *
 * Модуль ничего не решает за вызывающего: «файла нет» и «файл битый» возвращаются значением.
 * Лаунчер на битый конфиг завершает процесс, dev-серверы пишут в терминал и работают дальше —
 * это их политика, а не чтения.
 *
 * Zero-dependency и обычным JS: едет в опубликованном пакете рядом с лаунчером.
 *
 * @module bin/runtime-bundle
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/** URL, по которому SPA забирает конфиг (совпадает с RUNTIME_BUNDLE_PATH в shell/boot/runtime-config). */
export const RUNTIME_BUNDLE_URL = '/__reformer-builder/runtime.json';

/** Путь конфига в каталоге запуска, если его не назвали явно. */
export const DEFAULT_CONFIG_FILE = join('.ui_builder', 'config.json');

/**
 * Читает и разбирает файл конфига.
 *
 * Структуру не проверяет: точные сообщения о каждом поле — у SPA (его словарь). Здесь только
 * то, что SPA узнать не может: файла нет, файл не читается, файл — не JSON.
 *
 * @param {string} path
 * @returns {Promise<
 *   | { ok: true, config: unknown }
 *   | { ok: false, reason: 'missing' | 'unreadable' | 'invalid', message: string }
 * >}
 */
export async function readConfigFile(path) {
  let text;
  try {
    text = await readFile(path, 'utf8');
  } catch (error) {
    return {
      ok: false,
      reason: error?.code === 'ENOENT' ? 'missing' : 'unreadable',
      message: error?.message ?? String(error),
    };
  }
  try {
    return { ok: true, config: JSON.parse(text) };
  } catch (error) {
    return { ok: false, reason: 'invalid', message: error?.message ?? String(error) };
  }
}

/**
 * Конфиг для dev-сервера: читается на каждый запрос, отказ не роняет сервер.
 *
 * Нет файла по умолчанию — норма: билдер работает на вшитых дефолтах. Явно названный
 * и битый — ошибка, о которой разработчик узнаёт в терминале, а не догадкой.
 *
 * @param {{ file: string, explicit: boolean, report: (message: string) => void }} options
 * @returns {Promise<unknown>} конфиг либо `null`
 */
export async function readConfigForDevServer({ file, explicit, report }) {
  const result = await readConfigFile(file);
  if (result.ok) return result.config;
  if (explicit || result.reason !== 'missing') {
    report(`[runtime.json] конфиг «${file}» не прочитан: ${result.message}`);
  }
  return null;
}

/**
 * Тело ответа по {@link RUNTIME_BUNDLE_URL}.
 *
 * @param {unknown} config конфиг либо `null`
 * @param {Record<string, unknown>} [extra] что сервер сообщает о себе сверх конфига
 * @returns {Buffer}
 */
export function runtimeBundleBody(config, extra = {}) {
  return Buffer.from(JSON.stringify({ config: config ?? null, ...extra }));
}
