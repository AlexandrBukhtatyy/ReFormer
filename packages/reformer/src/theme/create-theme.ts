/**
 * Уровень темы над моделью: выбор пользователя, системная тема и действующая тема — сигналами.
 *
 * @module theme/create-theme
 */

import { computed, signal, type ReadonlySignal, type Signal } from '@preact/signals-core';
import { OwnedSignal } from '../model/owned-signal';
import { createStore } from '../model/scope';
import { signalFrom } from '../model/signal-from';
import { bindStorage, type StorageAdapter } from '../levels/storage';
import {
  documentTheme,
  isThemePreference,
  mediaQuerySystemTheme,
  type SystemThemeSource,
  type ThemeKind,
  type ThemePreference,
  type ThemeTarget,
} from './adapters';

/**
 * Настройки {@link createTheme}.
 *
 * @group Theme
 */
export interface ThemeOptions {
  /**
   * Поле модели с выбором пользователя (`app.$.settings.theme`): форма настроек над этим полем
   * переключает тему без всякого клея. Без привязки уровень заводит свой сигнал.
   */
  preference?: Signal<ThemePreference>;
  /** Выбор на старте без привязки. По умолчанию `'system'`. */
  initial?: ThemePreference;
  /** Системная тема. По умолчанию {@link mediaQuerySystemTheme}; `null` — система светлая. */
  system?: SystemThemeSource | null;
  /** Куда применять тему. По умолчанию {@link documentTheme}; `null` — DOM не трогать. */
  target?: ThemeTarget | null;
  /** Где помнить выбор пользователя. Без хранилища выбор живёт до перезагрузки. */
  storage?: StorageAdapter | null;
  /** Ключ в хранилище. По умолчанию `'reformer.theme'`. */
  storageKey?: string;
}

/**
 * Уровень темы.
 *
 * @group Theme
 */
export interface Theme {
  /** Выбор пользователя. Непонятное значение в привязанном поле читается как `'system'`. */
  readonly preference: ReadonlySignal<ThemePreference>;
  /** Тема системы. */
  readonly system: ReadonlySignal<ThemeKind>;
  /** Действующая тема: выбор пользователя, а при `'system'` — тема системы. */
  readonly resolved: ReadonlySignal<ThemeKind>;
  /** Выбрать тему или «как в системе». */
  set(preference: ThemePreference): void;
  /** Переключить действующую тему на противоположную (выбор становится явным). */
  toggle(): void;
  /** Снять подписки (система, хранилище) и перестать применять тему. Маркер с корня не снимается. */
  dispose(): void;
}

/**
 * Создать уровень темы.
 *
 * Действующая тема — `computed` из выбора пользователя и темы системы; каждая её смена
 * применяется к цели (по умолчанию — класс `dark` на `<html>`, как ждут стили `@reformer/ui-kit`).
 * Уровень принадлежит текущей области (`createStore`) и снимается вместе с ней.
 *
 * @param options - См. {@link ThemeOptions}.
 * @returns Уровень темы.
 *
 * @example Тема из настроек приложения
 * ```typescript
 * import { createModel, createStore } from '@reformer/core/model';
 * import { createTheme, webStorage } from '@reformer/core/theme';
 *
 * const app = createStore(() => {
 *   const model = createModel({ settings: { theme: 'system' as ThemePreference } });
 *   const theme = createTheme({ preference: model.$.settings.theme, storage: webStorage() });
 *   return { model, theme };
 * });
 *
 * app.model.settings.theme = 'dark'; // <html class="dark">
 * app.theme.toggle(); // 'light'
 * ```
 *
 * @group Theme
 */
export function createTheme(options: ThemeOptions = {}): Theme {
  return createStore((scope) => {
    const raw = options.preference ?? signal<ThemePreference>(options.initial ?? 'system');
    if (options.storage) {
      bindStorage(raw, options.storage, options.storageKey ?? 'reformer.theme', (value) =>
        isThemePreference(value) ? value : undefined
      );
    }
    // В привязанном поле может оказаться что угодно (старая версия, ручная правка): непонятное
    // значение — «как в системе», а не отказ отрисовать интерфейс.
    const preference = computed<ThemePreference>(() =>
      isThemePreference(raw.value) ? raw.value : 'system'
    );

    const source = options.system === undefined ? mediaQuerySystemTheme() : options.system;
    const system: ReadonlySignal<ThemeKind> = source
      ? signalFrom(
          () => source.current(),
          (onChange) => source.subscribe(onChange)
        )
      : new OwnedSignal<ThemeKind>('light');

    const resolved = computed<ThemeKind>(() =>
      preference.value === 'system' ? system.value : preference.value
    );

    const target = options.target === undefined ? documentTheme() : options.target;
    if (target) scope.effect(() => target.apply(resolved.value));

    return {
      preference,
      system,
      resolved,
      set(next: ThemePreference): void {
        raw.value = next;
      },
      toggle(): void {
        raw.value = resolved.peek() === 'dark' ? 'light' : 'dark';
      },
    };
  });
}
