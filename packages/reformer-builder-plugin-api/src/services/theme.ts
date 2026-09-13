/**
 * Служба темы: что выбрал человек и какая тема действует сейчас.
 *
 * Здесь ОБЪЯВЛЕНИЕ. Класс на корне документа, слежение за системной темой и ключ настройки
 * живут в оболочке билдера: плагин спрашивает тему, а применяет её оболочка.
 *
 * @module @reformer/builder-plugin-api/services/theme
 */

import type { Disposable } from '../primitives/disposable';
import { defineService } from '../primitives/service';

/** Тема, которая реально применена. Третьего состояния у оболочки нет. */
export type ThemeKind = 'light' | 'dark';

/** Что выбрал пользователь. `system` — «следуй за системой», а не «светлая». */
export type ThemePreference = ThemeKind | 'system';

export interface ThemeService {
  /** Применённая тема: то, что сейчас на корневом элементе. */
  readonly theme: ThemeKind;
  /** Выбор пользователя. `system` означает «действующая тема берётся у системы». */
  readonly preference: ThemePreference;
  /** Записывает выбор в настройки; тема применяется сразу, не дожидаясь хранилища. */
  setPreference(preference: ThemePreference): Promise<void>;
  onDidChange(cb: (theme: ThemeKind) => void): Disposable;
}

export const ThemeServiceToken = defineService<ThemeService>('reformer.theme');
