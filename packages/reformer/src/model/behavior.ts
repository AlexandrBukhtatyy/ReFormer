/**
 * Поведение — именованное правило над сигналами любых уровней (модель, форма, тема, язык,
 * таблица): подключается к контексту и снимается одной отпиской.
 *
 * Поведение формы (`defineFormBehavior` из `@reformer/core/behaviors`) знает про ноды и схему.
 * Это — общее: контекст задаёт автор, а уровни не знают друг о друге — их связывает правило.
 *
 * @module model/behavior
 */

import { createScope, type Scope } from './scope';

/**
 * Правило, которое можно подключить к контексту.
 *
 * @typeParam Ctx - Контекст правила: уровни и сигналы, которые оно связывает.
 *
 * @group Model
 */
export interface Behavior<Ctx> {
  /** Имя правила — для отладки и сообщений об ошибках. */
  readonly name: string | undefined;
  /**
   * Подключить правило. Всё, что `setup` создал (операторы модели, `scope.effect`, уровни,
   * `onScopeDispose`), снимается возвращённой отпиской. Повторный вызов отписки — no-op.
   *
   * Внутри `createStore` или `scope.run` правило принадлежит текущей области и снимается вместе
   * с ней.
   */
  attach(ctx: Ctx): () => void;
}

/**
 * Описать правило между уровнями.
 *
 * `setup` выполняется в собственной области при каждом `attach`. Операторы модели
 * (`watchField`, `computeFrom`, `copyFrom`, …) и `scope.effect`, созданные внутри, принадлежат
 * этой области. Если `setup` бросил — созданное до ошибки снимается, ошибка летит дальше.
 *
 * Чтение между уровнями удобнее строить на `computed` и привязке к полям модели; правило нужно
 * для побочных эффектов и записи в чужой уровень.
 *
 * @param setup - Тело правила. Получает контекст и область правила.
 * @param options - `name` — имя для отладки.
 * @returns Правило с методом `attach`.
 *
 * @example
 * ```typescript
 * import { defineBehavior, watchField } from '@reformer/core/model';
 *
 * // Серверная таблица сортирует коллацией сервера: при смене языка перезапросить страницу.
 * export const reloadOnLanguage = defineBehavior<{ language: Language; table: Table<Order> }>(
 *   ({ language, table }) => {
 *     watchField(language.code, () => table.reload());
 *   },
 *   { name: 'reloadOnLanguage' }
 * );
 *
 * const stop = reloadOnLanguage.attach({ language, table: orders });
 * stop(); // правило снято
 * ```
 *
 * @group Model
 */
export function defineBehavior<Ctx>(
  setup: (ctx: Ctx, scope: Scope) => void,
  options: { name?: string } = {}
): Behavior<Ctx> {
  return Object.freeze({
    name: options.name,
    attach(ctx: Ctx): () => void {
      // Дочерняя к активной области: внутри createStore правило снимется вместе со стором.
      const scope = createScope();
      try {
        scope.run(() => setup(ctx, scope));
      } catch (error) {
        // Сборка упала — снять то, что setup успел создать: снять это потом некому.
        scope.dispose();
        throw error;
      }
      return () => scope.dispose();
    },
  });
}
