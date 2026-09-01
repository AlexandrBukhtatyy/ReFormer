/**
 * Сервис локализации: поиск ключа, откат на резервную локаль и словари плагинов.
 *
 * Форматирование сообщения живёт отдельно — в `./message-format`. Здесь ровно то, что форматтер
 * делать не обязан и не может: где взять сообщение по ключу, что показать, если его нет, и как
 * не дать двум плагинам перепутать одинаковые ключи.
 *
 * ## Ключ — семантический, а не английская строка
 *
 * `files.panel.title`, а не `Files`. Тогда ни одна локаль не оказывается «главной»: `en` — такой же
 * словарь, как `ru`, и его правка не ломает ключи. Резервной выбран английский, потому что
 * инструмент публикуется в npm и промах должен оставаться читаемым для того, кто не знает русского.
 *
 * ## Промах виден
 *
 * В разработке отсутствующий ключ даёт заметный маркер `⟦files.panel.title⟧` — **даже если резервный
 * словарь его прикрыл бы.** Это и есть смысл режима: непереведённая строка обязана попадаться тому,
 * кто её написал. В сборке — откат на `en`; тихий возврат самого ключа не делается никогда, потому
 * что `files.panel.title` в интерфейсе неотличим от задуманного текста и до баг-репорта не доживает.
 *
 * Маркер — те же математические скобки, что у пропущенного аргумента в форматтере: в тексте
 * интерфейса они не встречаются, и глазом ловятся оба вида промаха одинаково.
 *
 * ## Откуда берётся `pluginId`
 *
 * Тот же приём, что у точки расширения (см. `host/primitives/extension-point`): сервис выдаёт
 * **вид на себя для конкретного плагина**. {@link RootI18nService.forPlugin} возвращает
 * {@link PluginI18n}, который сам приписывает ключам пространство имён плагина. В этом виде нет
 * ни параметра `pluginId`, ни `forPlugin`, поэтому плагин физически не располагает способом
 * прочитать или перезаписать чужой словарь.
 *
 * Пространство имён — **отдельное измерение каталога, а не префикс в ключе.** Разница видна
 * на идентификаторах с точкой: плагин `acme`, внёсший ключ `sub.title`, при хранении «плоским
 * префиксом» занял бы `acme.sub.title` — то есть ключ `title` плагина `acme.sub`. Отдельное
 * измерение делает такое пересечение невыразимым.
 *
 * ## Разбор — на регистрации
 *
 * {@link PluginI18n.contribute} разбирает все сообщения сразу, а не при первом обращении. Ленивый
 * разбор обесценил бы главное свойство формата: отсутствие ветки `other` — ошибка разбора, и ловить
 * её должен CI, прогнавший активацию плагина, а не пользователь, дошедший до редкой панели.
 * Регистрация атомарна: словарь с одним битым сообщением не оставляет пространство имён
 * наполовину заполненным.
 *
 * @module shell/platform/services/i18n/i18n
 */

import type { Disposable } from '@/shell/platform/primitives/disposable';
import { toDisposable } from '@/shell/platform/primitives/disposable';
import { formatPattern, parseMessage, type MessagePattern } from './message-format';

/** Локаль, на которую откатывается сборка при промахе. Обоснование — в шапке модуля. */
export const FALLBACK_LOCALE = 'en';

/** Сервис локализации Host. Ключи — как есть, без пространства имён. */
export interface I18nService {
  readonly locale: string;
  t(key: string, params?: Record<string, unknown>): string;
  setLocale(locale: string): Promise<void>;
  onDidChangeLocale(cb: (locale: string) => void): Disposable;
}

/** Вид сервиса для плагина: ключи автоматически префиксуются его идентификатором. */
export interface PluginI18n {
  t(key: string, params?: Record<string, unknown>): string;
  /**
   * Регистрирует словарь в пространстве имён плагина.
   *
   * Повторный вызов для той же локали **дополняет** словарь, а не заменяет его: плагин вправе
   * везти словарь по частям — например, догружать раздел вместе с панелью.
   *
   * Бросает, если сообщение не разбирается, называя ключ. Ни одно сообщение этого вызова
   * при этом не регистрируется.
   */
  contribute(locale: string, messages: Readonly<Record<string, string>>): void;
}

/**
 * Корневой сервис. Создаётся Host в единственном экземпляре.
 *
 * Метода `contribute` здесь нет вовсе — по той же причине, по которой его нет у корневого реестра
 * вкладов: словарь всегда чей-то. Словарь самого Host приходит загрузчиком (см.
 * {@link I18nServiceOptions.loadHostMessages}), а не вкладом.
 */
export interface RootI18nService extends I18nService {
  /**
   * Вид сервиса для плагина. Повторный вызов с тем же `pluginId` возвращает тот же объект —
   * идентичность стабильна, чтобы вид можно было держать в зависимостях React-хуков.
   */
  forPlugin(pluginId: string): PluginI18n;
}

export interface I18nServiceOptions {
  /**
   * Догрузка словаря Host для локали. Вызывается из {@link I18nService.setLocale} один раз
   * на локаль — для целевой и для резервной, иначе откатываться было бы не на что.
   *
   * Неизвестная локаль — не ошибка: у Host словаря для неё нет, у плагина может быть. Загрузчик
   * по умолчанию отдаёт для такой локали пустой словарь.
   */
  readonly loadHostMessages?: (locale: string) => Promise<Readonly<Record<string, string>>>;
  /**
   * Режим разработки: промах даёт маркер вместо отката на `en`. По умолчанию —
   * `import.meta.env.DEV`.
   *
   * Параметр существует ради тестов: оба поведения — часть контракта, проверять надо оба,
   * а пересобирать пакет в другом режиме ради этого нельзя.
   */
  readonly dev?: boolean;
}

/** Пространство имён Host. Пустая строка невыразима как `pluginId`: `forPlugin` её не принимает. */
const HOST_NAMESPACE = '';

/** Словари Host, поставляемые вместе с ним. Список локалей явный: шаблонный `import()` не типизуем. */
async function loadBundledHostMessages(locale: string): Promise<Readonly<Record<string, string>>> {
  if (locale === 'en') return (await import('./locales/en.json')).default;
  if (locale === 'ru') return (await import('./locales/ru.json')).default;
  return {};
}

/**
 * Создаёт сервис локализации.
 *
 * Создание синхронно, а загрузка словаря — нет, поэтому сервис рождается на резервной локали
 * с пустым словарём: Host обязан зарегистрировать его в реестре до первого `await`. Первое
 * `await setLocale(...)` при старте наполняет словарь; до него `t()` отдаёт маркеры. Это не
 * компромисс, а то же правило видимости промаха: строка, показанная до загрузки словаря,
 * выглядит как промах и им является.
 */
export function createI18nService(options: I18nServiceOptions = {}): RootI18nService {
  const loadHostMessages = options.loadHostMessages ?? loadBundledHostMessages;
  const dev = options.dev ?? import.meta.env.DEV;

  /** пространство имён → локаль → ключ → разобранное сообщение */
  const catalog = new Map<string, Map<string, Map<string, MessagePattern>>>();
  const loadedHostLocales = new Set<string>();
  const views = new Map<string, PluginI18n>();
  const listeners = new Set<(locale: string) => void>();
  let current = FALLBACK_LOCALE;

  const register = (
    namespace: string,
    locale: string,
    messages: Readonly<Record<string, string>>
  ): void => {
    if (locale.trim() === '') throw new Error('i18n: локаль словаря не может быть пустой');

    // Сначала разбираем всё, потом записываем: отказ на пятом ключе не должен оставить
    // зарегистрированными первые четыре.
    const parsed = new Map<string, MessagePattern>();
    for (const [key, source] of Object.entries(messages)) {
      try {
        parsed.set(key, parseMessage(source));
      } catch (error) {
        const owner = namespace === HOST_NAMESPACE ? 'Host' : `плагина «${namespace}»`;
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`словарь ${owner}, локаль «${locale}»: ключ «${key}» — ${reason}`, {
          cause: error,
        });
      }
    }

    let byLocale = catalog.get(namespace);
    if (byLocale === undefined) catalog.set(namespace, (byLocale = new Map()));
    let byKey = byLocale.get(locale);
    if (byKey === undefined) byLocale.set(locale, (byKey = new Map()));
    for (const [key, pattern] of parsed) byKey.set(key, pattern);
  };

  const translate = (
    namespace: string,
    key: string,
    params: Record<string, unknown> = {}
  ): string => {
    const byLocale = catalog.get(namespace);
    const own = byLocale?.get(current)?.get(key);
    if (own !== undefined) return formatPattern(own, params, current);

    if (!dev) {
      const fallback = byLocale?.get(FALLBACK_LOCALE)?.get(key);
      // Форматируется по резервной локали, а не по активной: сообщение английское, и его
      // множественные формы с группировкой чисел обязаны считаться по английским правилам.
      if (fallback !== undefined) return formatPattern(fallback, params, FALLBACK_LOCALE);
    }

    return `⟦${namespace === HOST_NAMESPACE ? key : `${namespace}.${key}`}⟧`;
  };

  /**
   * Догружает словарь Host. Отметка ставится после загрузки: отказ должен быть повторяемым,
   * а гонка двух `setLocale` в худшем случае зарегистрирует один и тот же словарь дважды —
   * для слияния по ключам это безразлично.
   */
  const ensureHostMessages = async (locale: string): Promise<void> => {
    if (loadedHostLocales.has(locale)) return;
    const messages = await loadHostMessages(locale);
    loadedHostLocales.add(locale);
    register(HOST_NAMESPACE, locale, messages);
  };

  /**
   * Уведомляет подписчиков. Политика ошибок — как у точки расширения: падение одного подписчика
   * не мешает остальным и не откатывает уже состоявшуюся смену локали, но и не теряется —
   * `setLocale` отвергается после того, как обойдены все.
   */
  const notify = (locale: string): void => {
    const errors: unknown[] = [];
    for (const cb of [...listeners]) {
      try {
        cb(locale);
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) throw new AggregateError(errors, 'ошибки в подписчиках смены локали');
  };

  return {
    get locale(): string {
      return current;
    },

    t: (key: string, params?: Record<string, unknown>): string =>
      translate(HOST_NAMESPACE, key, params),

    async setLocale(locale: string): Promise<void> {
      if (locale.trim() === '') throw new Error('setLocale: локаль не может быть пустой');

      // Резервный словарь грузится всегда: без него откат в сборке делать не на что.
      await ensureHostMessages(locale);
      if (locale !== FALLBACK_LOCALE) await ensureHostMessages(FALLBACK_LOCALE);

      // Сравнение после загрузки, а не до: `setLocale(i18n.locale)` при старте — это законный
      // способ догрузить словарь текущей локали, и ранний выход сломал бы его.
      if (locale === current) return;
      current = locale;
      notify(locale);
    },

    onDidChangeLocale(cb: (locale: string) => void): Disposable {
      listeners.add(cb);
      return toDisposable(() => {
        listeners.delete(cb);
      });
    },

    forPlugin(pluginId: string): PluginI18n {
      if (pluginId.trim() === '') {
        throw new Error('forPlugin: идентификатор плагина не может быть пустым');
      }
      let view = views.get(pluginId);
      if (view === undefined) {
        view = {
          t: (key: string, params?: Record<string, unknown>): string =>
            translate(pluginId, key, params),
          contribute: (locale: string, messages: Readonly<Record<string, string>>): void => {
            register(pluginId, locale, messages);
          },
        };
        views.set(pluginId, view);
      }
      return view;
    },
  };
}
