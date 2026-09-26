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
 * Полей единицы. AJV в пути запуска — это цена чанка ради нескольких проверок; ручной разбор
 * даёт те же точные сообщения бесплатно. Схема `runtime-config.schema.json` при этом существует —
 * для `$schema`-автодополнения в IDE клиента — и НЕ имеет права разойтись с разбором:
 * согласие закреплено тестом (`runtime-config.test.ts`).
 *
 * ## Что действует только на уровне запуска
 *
 * {@link RuntimeConfig.defaults}, {@link RuntimeConfig.preset}, {@link RuntimeConfig.profiles} и
 * {@link RuntimeConfig.plugins} разбираются на обоих уровнях, а применяются только на уровне
 * запуска. Разбор общий намеренно:
 * у двух уровней не может быть двух пониманий формата, и «поле, о котором проектный конфиг
 * не знает вовсе» превратилось бы в «неизвестное поле» — сообщение, уводящее в сторону от
 * настоящей причины. Поэтому поле разбирается, а `boot` говорит словами, что оно не применено
 * (см. `boot`, чтение проектного конфига).
 *
 * @module shell/boot/runtime-config
 */

import type { Source } from '@/shell/platform/source/types';
import type { ThemePreference } from '@reformer/builder-plugin-api/internal';
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
    /**
     * Умолчания любых настроек — ключ настройки → значение: слой «умолчания запуска» службы
     * настроек, между записью человека и умолчанием плагина. Так организация выбирает кит
     * (`"plugin.kits.active": "hexa-ui"`) или включает плагины, не трогая их код. Значение
     * не сверяется с плагином: плагинов при разборе ещё нет, а незнакомый ключ просто никто
     * не прочтёт.
     */
    readonly settings?: Readonly<Record<string, unknown>>;
  };
  /**
   * Имя профиля состава (`application/profiles`): из каких плагинов собрать приложение.
   *
   * Действует ТОЛЬКО на уровне запуска, и причина жёстче, чем у `defaults`: состав фиксируется
   * при СБОРКЕ приложения, до `boot`, а проектный конфиг читается после открытия проекта —
   * когда плагины уже активированы. Пресет из проектного конфига разбором принимается,
   * но не применяется — с внятной строкой в problems, а не молча.
   *
   * Неизвестное имя не роняет запуск: предупреждение и полный профиль.
   */
  readonly preset?: string;
  /**
   * Свои профили состава — те же данные, что у встроенных (`application/profiles`): имя,
   * основа, плагины, выбор провайдеров. Организация описывает сборку под себя здесь и называет
   * её в {@link preset}. Уровень запуска по той же причине, что у `preset`.
   *
   * Разбор проверяет форму; имена плагинов и основы сверяет тот, кто собирает состав: профили
   * и плагины — знание приложения, а не оболочки.
   */
  readonly profiles?: readonly RuntimeProfile[];
  /**
   * Поправки к составу профиля. Уровень тот же и по той же причине, что у {@link preset}.
   *
   * Поправка, а не профиль: «мне сегодня без ассистента» — решение того, кто запускает,
   * а не решение о приложении. `disable` сильнее `enable`.
   */
  readonly plugins?: {
    /** Добавить к составу профиля. */
    readonly enable?: readonly string[];
    /** Убрать из состава профиля. */
    readonly disable?: readonly string[];
  };
  /**
   * Каталог плагинов, которые предлагается ставить.
   *
   * Уровень запуска, а не настройка человека: «куда ходить за списком плагинов» решает тот,
   * кто разворачивает билдер, — у команды это может быть внутренний реестр, а у публичной
   * сборки его может не быть вовсе. Умолчания НЕТ: вписать сюда будущий адрес значило бы
   * ходить в никуда у каждого, кто запустит билдер, а без адреса раздел честно говорит
   * «реестр не настроен».
   */
  readonly marketplace?: {
    /** Адрес каталога-JSON. */
    readonly registry?: string;
  };
}

/** Профиль состава из конфига запуска — форма `ApplicationProfile` приложения. */
export interface RuntimeProfile {
  readonly id: string;
  /** Имя для человека; нет — показывается `id`. */
  readonly name?: string;
  /** Основа — имя встроенного или другого своего профиля. */
  readonly extends?: string;
  readonly plugins: readonly string[];
  /** Выбор провайдера: возможность → плагин. */
  readonly providers?: Readonly<Record<string, string>>;
}

export interface ParsedRuntimeConfig {
  readonly config: RuntimeConfig;
  /** Что в файле не так — по полю на строку. Пустой список = файл чистый. */
  readonly problems: readonly string[];
}

const THEME_VALUES: readonly string[] = ['light', 'dark', 'system'];

/**
 * Что вообще бывает в корне конфига. `$schema` — подсказка IDE, а не поле формата.
 * Экспорт — для сверки со схемой `runtime-config.schema.json`: список один, и схема обязана
 * описывать ровно его.
 */
export const RUNTIME_CONFIG_KEYS: ReadonlySet<string> = new Set([
  '$schema',
  'branding',
  'defaults',
  'preset',
  'profiles',
  'plugins',
  'marketplace',
]);

/** Поля профиля в `profiles`. */
export const RUNTIME_PROFILE_KEYS: ReadonlySet<string> = new Set([
  'id',
  'name',
  'extends',
  'plugins',
  'providers',
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Адрес, по которому можно ходить из браузера: только http и https. */
function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Разбирает содержимое config.json. Чистая функция: и лаунчер-уровень, и проектный файл
 * проходят через неё — у двух уровней не может быть двух пониманий одного формата.
 */
export function parseRuntimeConfig(value: unknown): ParsedRuntimeConfig {
  const problems: string[] = [];
  const config: {
    branding?: RuntimeConfig['branding'];
    defaults?: RuntimeConfig['defaults'];
    preset?: string;
    profiles?: RuntimeConfig['profiles'];
    plugins?: RuntimeConfig['plugins'];
    marketplace?: RuntimeConfig['marketplace'];
  } = {};

  if (!isRecord(value)) {
    return { config: {}, problems: ['конфиг должен быть JSON-объектом'] };
  }

  for (const key of Object.keys(value)) {
    if (!RUNTIME_CONFIG_KEYS.has(key)) problems.push(`неизвестное поле «${key}»`);
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

  if (value.marketplace !== undefined) {
    if (!isRecord(value.marketplace)) {
      problems.push('«marketplace» должен быть объектом');
    } else {
      for (const key of Object.keys(value.marketplace)) {
        if (key !== 'registry') problems.push(`неизвестное поле «marketplace.${key}»`);
      }
      const registry = value.marketplace.registry;
      if (registry !== undefined) {
        // Адрес проверяется РАЗБОРОМ, а не на непустоту: строка, которая не URL, всё равно
        // не сработает, и узнать об этом лучше при чтении конфига, чем при открытии раздела.
        if (typeof registry !== 'string' || !isHttpUrl(registry)) {
          problems.push('«marketplace.registry» должен быть адресом http(s)');
        } else {
          config.marketplace = { registry: registry.trim() };
        }
      }
    }
  }

  if (value.defaults !== undefined) {
    if (!isRecord(value.defaults)) {
      problems.push('«defaults» должен быть объектом');
    } else {
      const defaults: {
        locale?: string;
        theme?: ThemePreference;
        settings?: Readonly<Record<string, unknown>>;
      } = {};
      for (const key of Object.keys(value.defaults)) {
        if (key !== 'locale' && key !== 'theme' && key !== 'settings')
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
      const settings = value.defaults.settings;
      if (settings !== undefined) {
        if (!isRecord(settings)) {
          problems.push('«defaults.settings» должен быть объектом «ключ настройки → значение»');
        } else {
          const accepted: Record<string, unknown> = {};
          for (const [key, setting] of Object.entries(settings)) {
            if (key.trim() === '') problems.push('«defaults.settings»: пустой ключ настройки');
            else accepted[key] = setting;
          }
          if (Object.keys(accepted).length > 0) defaults.settings = Object.freeze(accepted);
        }
      }
      if (
        defaults.locale !== undefined ||
        defaults.theme !== undefined ||
        defaults.settings !== undefined
      ) {
        config.defaults = defaults;
      }
    }
  }

  if (value.preset !== undefined) {
    // Имя профиля НЕ сверяется со списком известных: разбор живёт в оболочке, а профили —
    // в `application/`, и знай он их поимённо, оболочка снова знала бы состав приложения.
    // Неизвестное имя отвергает тот, кто собирает состав, — предупреждением и умолчанием.
    if (typeof value.preset === 'string' && value.preset.trim() !== '') {
      config.preset = value.preset;
    } else {
      problems.push('«preset» должен быть непустой строкой');
    }
  }

  if (value.profiles !== undefined) {
    const profiles = parseProfiles(value.profiles, problems);
    if (profiles.length > 0) config.profiles = profiles;
  }

  if (value.plugins !== undefined) {
    if (!isRecord(value.plugins)) {
      problems.push('«plugins» должен быть объектом');
    } else {
      const section = value.plugins;
      const plugins: { enable?: readonly string[]; disable?: readonly string[] } = {};
      for (const key of Object.keys(section)) {
        if (key !== 'enable' && key !== 'disable')
          problems.push(`неизвестное поле «plugins.${key}»`);
      }
      for (const key of ['enable', 'disable'] as const) {
        const list: unknown = section[key];
        if (list === undefined) continue;
        if (Array.isArray(list) && list.every(isNonEmptyString)) {
          plugins[key] = Object.freeze([...list]);
        } else {
          problems.push(`«plugins.${key}» должен быть списком непустых строк`);
        }
      }
      if (plugins.enable !== undefined || plugins.disable !== undefined) config.plugins = plugins;
    }
  }

  return { config, problems };
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '';

/**
 * Свои профили: форма каждого и уникальность имён. Битый профиль пропускается целиком —
 * собранный наполовину состав хуже названного отказа, — а соседи применяются.
 */
function parseProfiles(value: unknown, problems: string[]): readonly RuntimeProfile[] {
  if (!Array.isArray(value)) {
    problems.push('«profiles» должен быть списком профилей');
    return [];
  }
  const profiles: RuntimeProfile[] = [];
  const seen = new Set<string>();
  value.forEach((entry: unknown, index) => {
    const at = `«profiles[${index}]»`;
    if (!isRecord(entry)) {
      problems.push(`${at} должен быть объектом`);
      return;
    }
    for (const key of Object.keys(entry)) {
      if (!RUNTIME_PROFILE_KEYS.has(key)) problems.push(`неизвестное поле ${at}.${key}`);
    }
    const { id, name, extends: base, plugins, providers } = entry;
    const broken: string[] = [];
    if (!isNonEmptyString(id)) broken.push('id — непустая строка');
    if (name !== undefined && !isNonEmptyString(name)) broken.push('name — непустая строка');
    if (base !== undefined && !isNonEmptyString(base)) broken.push('extends — непустая строка');
    if (!Array.isArray(plugins) || !plugins.every(isNonEmptyString)) {
      broken.push('plugins — список непустых строк');
    }
    const choices =
      providers === undefined
        ? undefined
        : isRecord(providers) && Object.values(providers).every(isNonEmptyString)
          ? (providers as Record<string, string>)
          : null;
    if (choices === null) broken.push('providers — объект «возможность → плагин»');
    if (broken.length > 0) {
      problems.push(`${at} пропущен: ${broken.join(', ')}`);
      return;
    }
    const profileId = (id as string).trim();
    if (seen.has(profileId)) {
      problems.push(`${at} пропущен: профиль «${profileId}» уже описан выше`);
      return;
    }
    seen.add(profileId);
    profiles.push(
      Object.freeze({
        id: profileId,
        ...(name !== undefined ? { name: name as string } : {}),
        ...(base !== undefined ? { extends: (base as string).trim() } : {}),
        plugins: Object.freeze([...(plugins as string[])]),
        ...(choices !== undefined && choices !== null
          ? { providers: Object.freeze({ ...choices }) }
          : {}),
      })
    );
  });
  return profiles;
}

/**
 * Слияние уровней: проект перекрывает запуск по полю, а не по секции.
 *
 * Сливаются ВСЕ поля, включая те, что применяются только на уровне запуска. Слияние отвечает
 * на вопрос «что написано в конфиге», а не «что из этого сработает»: второй вопрос решает тот,
 * кто поле применяет, и он же говорит человеку, что поле не применено.
 */
export function mergeRuntimeConfig(base: RuntimeConfig, over: RuntimeConfig): RuntimeConfig {
  const preset = over.preset ?? base.preset;
  // Профили — списком уровня целиком: слить два списка по имени значило бы собрать профиль,
  // которого не писал никто.
  const profiles = over.profiles ?? base.profiles;
  const settings =
    base.defaults?.settings !== undefined || over.defaults?.settings !== undefined
      ? { ...base.defaults?.settings, ...over.defaults?.settings }
      : undefined;
  return {
    ...(base.branding !== undefined || over.branding !== undefined
      ? { branding: { ...base.branding, ...over.branding } }
      : {}),
    ...(base.defaults !== undefined || over.defaults !== undefined
      ? {
          defaults: {
            ...base.defaults,
            ...over.defaults,
            ...(settings !== undefined ? { settings } : {}),
          },
        }
      : {}),
    ...(preset !== undefined ? { preset } : {}),
    ...(profiles !== undefined ? { profiles } : {}),
    ...(base.plugins !== undefined || over.plugins !== undefined
      ? { plugins: { ...base.plugins, ...over.plugins } }
      : {}),
    ...(base.marketplace !== undefined || over.marketplace !== undefined
      ? { marketplace: { ...base.marketplace, ...over.marketplace } }
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
