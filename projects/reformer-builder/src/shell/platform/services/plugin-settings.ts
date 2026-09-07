/**
 * Настройки одного плагина каталога поверх службы настроек.
 *
 * ## Один ключ на плагин, а не ключ на поле
 *
 * Область настроек всё равно переписывается в хранилище целиком на каждую запись, поэтому
 * дробление ничего не экономит — зато даёт плагину N подписок вместо одной и N шансов
 * разойтись с формой при переименовании поля.
 *
 * ## Почему префикс `workspace.`
 *
 * Не ради красоты: {@link scopeForKey} выводит область из префикса, и с ним «забыть третий
 * аргумент `set`» и уронить настройку плагина в глобальную область физически нельзя. Заодно
 * получается пер-проектность — тем же доводом в этом коде уже выбраны `workspace.plugins.enabled`
 * и `workspace.plugins.dev`: плагин лежит В ПРОЕКТЕ, и его настройка вне проекта бессмысленна,
 * а «база, настроенная в проекте A» не должна подставиться в проекте B.
 *
 * Прежнее соглашение `plugin.<id>.*` (область `user`) остаётся за ВСТРОЕННЫМИ плагинами
 * оболочки — за ними же остаётся и живой пример `plugin.kits.active`.
 *
 * ## Умолчания сюда не входят
 *
 * Их объявляет сам плагин через `SettingsService.registerDefault` в `activate`, и снимаются
 * они вместе с ним. Второй источник умолчаний (например, поле во вкладе) означал бы правило
 * приоритета между ними и отказ включения при повторном объявлении одного ключа.
 *
 * @module shell/platform/services/plugin-settings
 */

import type { Disposable } from '@/shell/platform/primitives/disposable';
import type { SettingsService } from './settings';

/** Ключ настроек плагина каталога. Одна функция на всё приложение: адрес не должен разъехаться. */
export function pluginSettingsKey(pluginId: string): string {
  if (pluginId.trim() === '') {
    throw new Error('pluginSettingsKey: идентификатор плагина не может быть пустым');
  }
  return `workspace.plugin.${pluginId}.settings`;
}

/** Значения формы настроек: то, что кладётся в хранилище как есть. */
export type PluginSettingsValues = Readonly<Record<string, unknown>>;

/** Вид службы настроек «только про этот плагин». */
export interface PluginSettings {
  /**
   * Действующие значения. Синхронно — форма рисуется первым кадром, без промиса на поле.
   *
   * Не-объект в хранилище (положили прошлой версией, поправили руками) считается отсутствием:
   * форма покажет умолчания, а не упадёт на чужой форме данных.
   */
  read(): PluginSettingsValues;
  /** Записывает значения целиком. Отказ пробрасывается: молча потерянная настройка — хуже. */
  write(values: PluginSettingsValues): Promise<void>;
  /**
   * Снимает запись, возвращая значения к умолчаниям плагина.
   *
   * Именно снятие, а не запись пустого объекта: пустой объект перекрыл бы умолчания
   * и «сброс» дал бы форму без единого значения.
   */
  reset(): Promise<void>;
  /** Уведомление о правке МИМО формы: второе окно, сам плагин, смена проекта. */
  onDidChange(listener: () => void): Disposable;
}

/** Собирает вид службы для конкретного плагина. */
export function createPluginSettings(
  settings: Pick<SettingsService, 'get' | 'set' | 'onDidChange'>,
  pluginId: string
): PluginSettings {
  const key = pluginSettingsKey(pluginId);
  return {
    read(): PluginSettingsValues {
      const stored = settings.get<unknown>(key);
      if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) return {};
      return stored as PluginSettingsValues;
    },
    write(values: PluginSettingsValues): Promise<void> {
      return settings.set(key, values);
    },
    reset(): Promise<void> {
      return settings.set(key, undefined);
    },
    onDidChange(listener: () => void): Disposable {
      return settings.onDidChange((changed) => {
        if (changed === key) listener();
      });
    },
  };
}
