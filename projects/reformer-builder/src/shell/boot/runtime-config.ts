/**
 * Конфиг билдера из каталога разработчика: чтение, разбор, слияние двух уровней.
 *
 * Уровней два, и у каждого свой момент чтения:
 *
 * - **уровень запуска** — `<cwd>/.ui_builder/config.json` (или `--config`) читает ЛАУНЧЕР
 *   (`bin/reformer-builder.mjs`) и отдаёт по {@link RUNTIME_BUNDLE_PATH}; SPA забирает его
 *   ДО сборки приложения ({@link fetchRuntimeConfig} в `main.tsx`), потому что дефолты темы
 *   и локали применяются при регистрации умолчаний настроек — а она синхронная и однократная;
 * - **уровень проекта** — `.ui_builder/config.json` ОТКРЫТОГО проекта читается через Source
 *   при каждом открытии ({@link readProjectRuntimeConfig}) и перекрывает уровень запуска.
 *
 * ## Битый конфиг не роняет билдер
 *
 * v1 на невалидном конфиге показывал экран ошибки (fail visible). Здесь принцип оболочки
 * сильнее: «приложение обязано открыться даже с недогруженными настройками» (`main.tsx`).
 * Поэтому разбор собирает {@link problems} по полям, применяет валидную часть и отдаёт
 * список наружу — композиция показывает его уведомлением. Молча не глотается ничего.
 *
 * ## Почему разбор ручной, а не AJV
 *
 * Полей три. AJV в пути запуска — это цена чанка ради трёх проверок; ручной разбор даёт
 * те же точные сообщения бесплатно. Схема `runtime-config.schema.json` при этом существует —
 * для `$schema`-автодополнения в IDE клиента — и НЕ имеет права разойтись с разбором:
 * согласие закреплено тестом (`runtime-config.test.ts`).
 *
 * @module shell/boot/runtime-config
 */

import type { Source } from '@/shell/platform/source/types';
import type { ThemePreference } from '@/shell/platform/services/theme';
import { SUPPORTED_LOCALES } from './settings-sections';

/** URL, по которому лаунчер отдаёт конфиг (относительно корня; совпадает с bin). */
export const RUNTIME_BUNDLE_PATH = '/__reformer-builder/runtime.json';

/** Путь конфига в каталоге ОТКРЫТОГО проекта. */
export const PROJECT_CONFIG_PATH = '.ui_builder/config.json';

export interface RuntimeConfig {
  readonly branding?: {
    /** Заголовок окна. Показывается вместо «reformer-builder v2». */
    readonly title?: string;
  };
  /**
   * Дефолты настроек — «значение, пока человек не выбрал сам». Применяются регистрацией
   * умолчаний, поэтому действуют ТОЛЬКО на уровне запуска: умолчание объявляется один раз
   * при сборке приложения. Дефолт из проектного конфига разбором принимается, но
   * не применяется — с внятной строкой в problems, а не молча.
   */
  readonly defaults?: {
    /** Локаль до первого выбора человеком: ru | en. */
    readonly locale?: string;
    /** Тема до первого выбора человеком: light | dark | system. */
    readonly theme?: ThemePreference;
  };
}

export interface ParsedRuntimeConfig {
  readonly config: RuntimeConfig;
  /** Что в файле не так — по полю на строку. Пустой список = файл чистый. */
  readonly problems: readonly string[];
}

const THEME_VALUES: readonly string[] = ['light', 'dark', 'system'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Разбирает содержимое config.json. Чистая функция: и лаунчер-уровень, и проектный файл
 * проходят через неё — у двух уровней не может быть двух пониманий одного формата.
 */
export function parseRuntimeConfig(value: unknown): ParsedRuntimeConfig {
  const problems: string[] = [];
  const config: { branding?: RuntimeConfig['branding']; defaults?: RuntimeConfig['defaults'] } = {};

  if (!isRecord(value)) {
    return { config: {}, problems: ['конфиг должен быть JSON-объектом'] };
  }

  for (const key of Object.keys(value)) {
    if (key !== 'branding' && key !== 'defaults' && key !== '$schema') {
      problems.push(`неизвестное поле «${key}»`);
    }
  }

  if (value.branding !== undefined) {
    if (!isRecord(value.branding)) {
      problems.push('«branding» должен быть объектом');
    } else {
      const branding: { title?: string } = {};
      for (const key of Object.keys(value.branding)) {
        if (key !== 'title') problems.push(`неизвестное поле «branding.${key}»`);
      }
      const title = value.branding.title;
      if (title !== undefined) {
        if (typeof title === 'string' && title.trim() !== '') branding.title = title;
        else problems.push('«branding.title» должен быть непустой строкой');
      }
      if (branding.title !== undefined) config.branding = branding;
    }
  }

  if (value.defaults !== undefined) {
    if (!isRecord(value.defaults)) {
      problems.push('«defaults» должен быть объектом');
    } else {
      const defaults: { locale?: string; theme?: ThemePreference } = {};
      for (const key of Object.keys(value.defaults)) {
        if (key !== 'locale' && key !== 'theme')
          problems.push(`неизвестное поле «defaults.${key}»`);
      }
      const locale = value.defaults.locale;
      if (locale !== undefined) {
        if (typeof locale === 'string' && SUPPORTED_LOCALES.includes(locale)) {
          defaults.locale = locale;
        } else {
          problems.push(`«defaults.locale» должен быть одним из: ${SUPPORTED_LOCALES.join(', ')}`);
        }
      }
      const theme = value.defaults.theme;
      if (theme !== undefined) {
        if (typeof theme === 'string' && THEME_VALUES.includes(theme)) {
          defaults.theme = theme as ThemePreference;
        } else {
          problems.push(`«defaults.theme» должен быть одним из: ${THEME_VALUES.join(', ')}`);
        }
      }
      if (defaults.locale !== undefined || defaults.theme !== undefined) {
        config.defaults = defaults;
      }
    }
  }

  return { config, problems };
}

/** Слияние уровней: проект перекрывает запуск по полю, а не по секции. */
export function mergeRuntimeConfig(base: RuntimeConfig, over: RuntimeConfig): RuntimeConfig {
  return {
    ...(base.branding !== undefined || over.branding !== undefined
      ? { branding: { ...base.branding, ...over.branding } }
      : {}),
    ...(base.defaults !== undefined || over.defaults !== undefined
      ? { defaults: { ...base.defaults, ...over.defaults } }
      : {}),
  };
}

/**
 * Забирает конфиг уровня запуска у лаунчера. Лаунчера может не быть вовсе (vite dev,
 * раздача с другого сервера) — тогда ответ не JSON или не 200, и это НЕ ошибка:
 * билдер работает на вшитых дефолтах, как v1 без файлов.
 */
export async function fetchRuntimeConfig(
  fetchFn: typeof fetch = fetch
): Promise<ParsedRuntimeConfig | null> {
  let payload: unknown;
  try {
    const response = await fetchFn(RUNTIME_BUNDLE_PATH, { cache: 'no-cache' });
    if (!response.ok) return null;
    payload = await response.json();
  } catch {
    return null;
  }
  if (!isRecord(payload) || payload.config === null || payload.config === undefined) return null;
  return parseRuntimeConfig(payload.config);
}

/**
 * Читает конфиг открытого проекта. Отсутствие файла — норма (null), битый JSON — проблема
 * СЛОВАМИ, а не исключением: файл положил человек, и сказать ему, что не так, — наша работа.
 */
export async function readProjectRuntimeConfig(
  source: Pick<Source, 'read'>
): Promise<ParsedRuntimeConfig | null> {
  let text: string;
  try {
    text = (await source.read(PROJECT_CONFIG_PATH)).text;
  } catch {
    return null;
  }
  try {
    return parseRuntimeConfig(JSON.parse(text) as unknown);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { config: {}, problems: [`невалидный JSON: ${reason}`] };
  }
}
