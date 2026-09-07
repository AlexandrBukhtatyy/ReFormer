/**
 * Реестр фабрик источников: вид источника → как поднять его из дескриптора.
 *
 * **Зачем шов.** Переоткрытие проекта в v1 держится на одном частном свойстве: хэндл каталога
 * File System Access переживает структурное клонирование, поэтому его кладут в IndexedDB
 * как есть. У остальных видов источника такого свойства нет — у HTTP это адрес плюс токен,
 * у плоского хранилища форм это его идентификатор, — и общего способа «сохранить объект»
 * не существует. Общий способ есть у ОПИСАНИЯ: дескриптор сериализуем всегда. Отсюда
 * разделение: в хранилище едет {@link SourceDescriptor}, живой объект собирает фабрика.
 *
 * **Почему реестр, а не `switch`.** Виды источников приносят плагины, а `switch` по видам —
 * это список, который обязан знать про всех заранее. Реестр же позволяет плагину заявить
 * свой вид, а оболочке — восстановить последний открытый проект, ничего о нём не зная.
 *
 * **Только добавление.** Два вклада на один вид — это два разных источника под одним именем,
 * и «последний победил» здесь означает, что проект молча откроется не оттуда. Поэтому
 * занятый вид — ошибка, а не тихая замена (тот же принцип, что у реестра модулей).
 *
 * @module shell/platform/source/registry
 */

import { toDisposable, type Disposable } from '@/shell/platform/primitives/disposable';
import { SourceError } from './errors';
import type { RestoredSource, SourceDescriptor, SourceFactory } from './types';

/** Реестр фабрик. */
export interface SourceRegistry {
  /**
   * Добавляет фабрику. Возвращает снятие вклада — плагин складывает его в свои подписки,
   * и при выключении вид источника исчезает вместе с ним.
   *
   * @throws если вид уже занят.
   */
  register(factory: SourceFactory): Disposable;
  /** Известен ли вид. Проверка без побочных эффектов — для диагностики и интерфейса. */
  has(kind: string): boolean;
  /** Все известные виды, отсортированные. Идёт в текст ошибки «источник недоступен». */
  kinds(): readonly string[];
  /**
   * Поднимает источник по дескриптору.
   *
   * `{ unavailable }` — «восстановить нельзя»: фабрика нашлась, но источника больше нет
   * (`missing`) либо доступ не подтверждён (`denied`). Это ОБЫЧНЫЙ ответ, приложение обязано
   * открыться без проекта; различать эти два случая обязан интерфейс — им соответствуют разные
   * кнопки (см. `SourceUnavailableReason` в `./types`).
   *
   * @throws `unsupported`, если вида нет в реестре. Это ТРЕТИЙ случай: не «не смогли»,
   *   а «нечем даже попробовать» — плагин источника не установлен или выключен. Отказом,
   *   а не третьим значением, потому что чинится он не пользователем и не одной кнопкой,
   *   а составом приложения.
   */
  restore(descriptor: SourceDescriptor): Promise<RestoredSource>;
}

/** Создаёт пустой реестр. */
export function createSourceRegistry(): SourceRegistry {
  const factories = new Map<string, SourceFactory>();

  return {
    register(factory) {
      if (factory.kind === '') throw new Error('вид источника не может быть пустым');
      const occupied = factories.get(factory.kind);
      if (occupied !== undefined) {
        throw new Error(`вид источника уже зарегистрирован: ${factory.kind}`);
      }
      factories.set(factory.kind, factory);
      return toDisposable(() => {
        // Снимаем только СВОЙ вклад: за время жизни подписки слот мог занять другой.
        if (factories.get(factory.kind) === factory) factories.delete(factory.kind);
      });
    },

    has(kind) {
      return factories.has(kind);
    },

    kinds() {
      return [...factories.keys()].sort();
    },

    async restore(descriptor) {
      const factory = factories.get(descriptor.kind);
      if (factory === undefined) {
        const known = [...factories.keys()].sort().join(', ');
        throw new SourceError(
          'unsupported',
          `неизвестный вид источника: ${descriptor.kind}` +
            (known === '' ? '' : ` (известны: ${known})`)
        );
      }
      return factory.restore(descriptor);
    },
  };
}

/**
 * Похоже ли значение на дескриптор источника.
 *
 * Нужен на границе с хранилищем: дескриптор приезжает из IndexedDB как разобранный JSON,
 * то есть как `unknown`, и версия приложения, писавшая его, могла быть другой. Проверка
 * структурная и НЕ полна по видам намеренно: знать все виды заранее реестр как раз и не должен,
 * поэтому здесь проверяется общая часть — объект со строковым непустым `kind`. Достаточно ли
 * остальных полей, решает фабрика вида: только она знает, что ей нужно.
 */
export function isSourceDescriptor(value: unknown): value is SourceDescriptor {
  if (typeof value !== 'object' || value === null) return false;
  const kind = (value as { kind?: unknown }).kind;
  return typeof kind === 'string' && kind !== '';
}
