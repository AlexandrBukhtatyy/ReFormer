/**
 * Контекстные ключи: условие применимости как данные, а не как предикат плагина.
 *
 * Здесь ОБЪЯВЛЕНИЕ. Сама служба, зарезервированные ключи и сборка контекста условия из стека
 * областей живут в оболочке билдера.
 *
 * @module @reformer/builder-plugin-api/services/context-keys
 */

import type { Disposable } from '../primitives/disposable.js';
import { defineService } from '../primitives/service.js';
import { type WhenContext } from '../primitives/when-context.js';

/** Снимок состояния: одно значение, две проекции. */
export interface ContextKeySnapshot {
  /** Чтение любого ключа — платформенного, областного, плагинного. */
  read(key: string): unknown;
  /**
   * Проекция на пять полей — для `CommandRegistry.execute` и `isEnabled`, которые по
   * контракту принимают {@link WhenContext}. Один снимок обслуживает обоих, поэтому
   * предикат и условие видят одно и то же состояние, а не два соседних во времени.
   */
  whenContext(): WhenContext;
}

export interface ContextKeyReader {
  /** Значение ключа. Неизвестный ключ — `undefined`, и это норма, а не отказ. */
  read(key: string): unknown;
  /** Снимок. Ссылка стабильна между изменениями — требование `useSyncExternalStore`. */
  snapshot(): ContextKeySnapshot;
  /**
   * Подписка на изменения. Уведомление НЕСЁТ имена изменившихся ключей: подписчик, который
   * знает читаемые ключи своих условий, сравнивает пересечение и молчит, если оно пусто.
   * Ради этого свойства `WhenExpr.keys` и считается один раз при разборе.
   */
  subscribe(listener: (changed: ReadonlySet<string>) => void): Disposable;
}

/** Объявленный ключ. `dispose()` снимает объявление — на этом держится выключение плагина. */
export interface ContextKey<T> extends Disposable {
  readonly key: string;
  get(): T;
  set(value: T): void;
  /** Возвращает начальное значение, с которым ключ объявлен. */
  reset(): void;
}

export interface ContextKeyInfo {
  readonly key: string;
  /** Идентификатор плагина либо `host`. */
  readonly owner: string;
}

export interface ContextKeyService extends ContextKeyReader {
  /**
   * Объявляет ключ.
   *
   * @throws Error если имя зарезервировано платформой либо ключ уже объявлен. Повторное
   * объявление — отказ, а не замена, по тому же доводу, что у умолчаний настроек: две
   * записи одного ключа означали бы, что действующее значение зависит от порядка активации
   * плагинов, а он по контракту рантайма ничего не значит.
   */
  createKey<T>(key: string, initial: T, owner?: string): ContextKey<T>;
  /** Объявленные ключи — редактору клавиш для подсказки и диагностике «такого ключа нет». */
  declared(): readonly ContextKeyInfo[];
}

export const ContextKeyServiceToken = defineService<ContextKeyService>('reformer.context-keys');
