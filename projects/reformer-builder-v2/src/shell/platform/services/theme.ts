/**
 * Тема оболочки — светлая и тёмная, класс на корневом элементе.
 *
 * Три вещи, которые здесь решены явно:
 *
 * 1. **Умолчание — системное предпочтение, но явный выбор его перекрывает.** Пока пользователь
 *    ничего не выбирал, оболочка следует за системой и переключается вместе с ней. Как только
 *    выбор сделан, он записан в настройки и переживает перезагрузку; система на него не влияет.
 *    Различие выражено третьим значением предпочтения — `system`, а не отдельным флагом
 *    «выбирал ли пользователь»: флаг рассинхронизировался бы со значением при первой же правке
 *    настроек снаружи.
 * 2. **Оболочка прибита к встроенному киту.** Активный кит превью темой оболочки не управляет:
 *    превью рисует чужие компоненты, и позволить им перекрасить интерфейс инструмента значит
 *    отдать оболочку тому, кого мы как раз проверяем.
 * 3. **DOM и системное предпочтение внедряются.** Служба не обращается ни к `document`,
 *    ни к `matchMedia` напрямую — иначе её нельзя было бы проверить без браузера, а
 *    «системное предпочтение как умолчание» — ровно то свойство, которое обязано быть в тестах.
 *
 * @module host/services/theme
 */

import { disposeAll, toDisposable, type Disposable } from '../primitives/disposable';
import { createEventBus, defineEvent } from '../primitives/event';
import { defineService } from '../primitives/service';
import type { SettingsService } from './settings';

/** Тема, которая реально применена. Третьего состояния у оболочки нет. */
export type ThemeKind = 'light' | 'dark';

/** Что выбрал пользователь. `system` — «следуй за системой», а не «светлая». */
export type ThemePreference = ThemeKind | 'system';

/** Ключ настройки. Область — `user`: тема принадлежит человеку, а не проекту. */
export const THEME_SETTINGS_KEY = 'host.theme';

/**
 * Класс тёмной темы на корневом элементе.
 *
 * Имя не наше: `@reformer/ui-kit` объявляет вариант как `&:is(.dark *, [data-theme='dark'] *)`,
 * и переключение любым другим классом просто не подхватит токены кита. Светлая тема — это
 * отсутствие класса, а не парный `light`: светлая палитра лежит в `:root`, и второй класс
 * был бы мёртвым весом, за которым надо следить.
 */
export const DARK_CLASS = 'dark';

/**
 * Корневой элемент в объёме, который нужен службе.
 *
 * Своя форма вместо `HTMLElement` — чтобы подставной корень в тесте не изображал весь DOM;
 * `document.documentElement` подходит под неё структурно.
 */
export interface ThemeRoot {
  readonly classList: {
    add(token: string): void;
    remove(token: string): void;
  };
}

/** Источник системного предпочтения — `prefers-color-scheme` за минимальным интерфейсом. */
export interface SystemTheme {
  current(): ThemeKind;
  /** Система переключилась (например, по расписанию ОС). */
  subscribe(cb: (theme: ThemeKind) => void): Disposable;
}

export interface ThemeService {
  /** Применённая тема: то, что сейчас на корневом элементе. */
  readonly theme: ThemeKind;
  /** Выбор пользователя. `system` означает «действующая тема берётся у системы». */
  readonly preference: ThemePreference;
  /** Записывает выбор в настройки; тема применяется сразу, не дожидаясь хранилища. */
  setPreference(preference: ThemePreference): Promise<void>;
  onDidChange(cb: (theme: ThemeKind) => void): Disposable;
}

/**
 * Вид службы для Host: служба держит подписки на настройки и на систему, и кто-то обязан
 * их отпустить. Плагину `dispose` не виден — иначе один плагин мог бы выключить тему всем.
 */
export interface HostThemeService extends ThemeService, Disposable {}

export const ThemeServiceToken = defineService<ThemeService>('host.theme');

const ThemeDidChange = defineEvent<ThemeKind>('theme.didChange');

function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

export interface ThemeServiceOptions {
  readonly settings: SettingsService;
  readonly system: SystemTheme;
  /** Куда вешать класс. `null` — среда без DOM (тесты, воркер): служба считает тему, но не рисует. */
  readonly root?: ThemeRoot | null;
}

/**
 * Создаёт службу темы и сразу применяет действующую тему к корню.
 *
 * Умолчание настройки (`system`) объявляется здесь же: тема — вклад Host, а умолчание
 * объявляет тот, кто вносит настройку. Поэтому панель настроек увидит «по умолчанию — как
 * в системе», не зная про эту службу ничего.
 */
export function createThemeService(options: ThemeServiceOptions): HostThemeService {
  const { settings, system } = options;
  const root = options.root ?? null;
  const bus = createEventBus();

  const readPreference = (): ThemePreference => {
    const stored = settings.get<unknown>(THEME_SETTINGS_KEY);
    // В хранилище лежит то, что записала прошлая версия приложения, и доверять этому нельзя:
    // непонятное значение — это «следуй за системой», а не отказ отрисовать оболочку.
    return isThemePreference(stored) ? stored : 'system';
  };

  const resolve = (preference: ThemePreference): ThemeKind =>
    preference === 'system' ? system.current() : preference;

  const apply = (theme: ThemeKind): void => {
    if (root === null) return;
    if (theme === 'dark') root.classList.add(DARK_CLASS);
    else root.classList.remove(DARK_CLASS);
  };

  const defaultRegistration = settings.registerDefault<ThemePreference>(
    THEME_SETTINGS_KEY,
    'system'
  );

  let preference = readPreference();
  let theme = resolve(preference);
  apply(theme);

  /**
   * Пересчитывает тему из настроек и системы.
   *
   * Один путь на все источники изменения (запись настройки, правка настройки снаружи,
   * переключение системы) — иначе появились бы две ветки, применяющие класс по-разному,
   * и расхождение между ними всплыло бы как «тема применилась, но подписчики не узнали».
   */
  const recompute = (): void => {
    preference = readPreference();
    const next = resolve(preference);
    if (next === theme) return;
    theme = next;
    apply(theme);
    bus.emit(ThemeDidChange, theme);
  };

  const subscriptions: Disposable[] = [
    defaultRegistration,
    settings.onDidChange((key) => {
      if (key === THEME_SETTINGS_KEY) recompute();
    }),
    // Подписку на систему держим всегда, а не только при `system`: иначе возврат к «как
    // в системе» требовал бы завести её заново, и до первого переключения ОС тема осталась
    // бы прежней.
    system.subscribe(() => {
      recompute();
    }),
  ];

  return {
    get theme(): ThemeKind {
      return theme;
    },
    get preference(): ThemePreference {
      return preference;
    },

    async setPreference(next: ThemePreference): Promise<void> {
      // Применение делает не эта строка, а подписка на настройки: запись обновляет кэш
      // и уведомляет синхронно, до ожидания хранилища. Так у переключателя один путь
      // с любой другой правкой той же настройки.
      await settings.set<ThemePreference>(THEME_SETTINGS_KEY, next);
    },

    onDidChange(cb: (theme: ThemeKind) => void): Disposable {
      return bus.on(ThemeDidChange, cb);
    },

    dispose(): void {
      // Класс с корня не снимаем: снятие — это «стало светло», а выключение службы
      // не означает смену темы. Оболочка уходит вместе с документом.
      disposeAll(subscriptions);
    },
  };
}

/**
 * Системное предпочтение из браузера.
 *
 * Отсутствие `matchMedia` (тесты, старая среда, воркер) — не отказ: считаем, что система
 * предпочитает светлую тему. Инструмент обязан открыться и там, где спросить некого.
 */
export function createBrowserSystemTheme(): SystemTheme {
  const query =
    typeof globalThis.matchMedia === 'function'
      ? globalThis.matchMedia('(prefers-color-scheme: dark)')
      : null;

  return {
    current(): ThemeKind {
      return query !== null && query.matches ? 'dark' : 'light';
    },
    subscribe(cb: (theme: ThemeKind) => void): Disposable {
      if (query === null) return toDisposable(() => {});
      const handler = (event: MediaQueryListEvent): void => {
        cb(event.matches ? 'dark' : 'light');
      };
      query.addEventListener('change', handler);
      return toDisposable(() => {
        query.removeEventListener('change', handler);
      });
    },
  };
}

/**
 * Постоянное системное предпочтение — для тестов и сред без `matchMedia`.
 *
 * `set` имитирует переключение системы: это единственный способ проверить, что оболочка
 * следует за системой, пока пользователь не выбрал сам.
 */
export function createFixedSystemTheme(initial: ThemeKind = 'light'): SystemTheme & {
  set(theme: ThemeKind): void;
} {
  let current = initial;
  const listeners = new Set<(theme: ThemeKind) => void>();

  return {
    current: () => current,
    subscribe(cb: (theme: ThemeKind) => void): Disposable {
      listeners.add(cb);
      return toDisposable(() => {
        listeners.delete(cb);
      });
    },
    set(theme: ThemeKind): void {
      if (theme === current) return;
      current = theme;
      for (const cb of [...listeners]) cb(theme);
    },
  };
}
