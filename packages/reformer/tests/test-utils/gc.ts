/**
 * Ручной сборщик мусора — для тестов утечек: отпущен ли объект, видно только по слабой ссылке
 * (`WeakRef`) после сборки.
 *
 * Флаг `--expose-gc` включается на лету (`node:v8`), а функцию `gc` отдаёт контекст, созданный уже
 * после этого (`node:vm`), — запускать vitest с флагом не нужно.
 *
 * Как писать такой тест:
 * - всё, что держит проверяемый объект, создавайте внутри отдельной функции, а наружу отдавайте
 *   только слабые ссылки: ссылка, оставшаяся в переменной теста, держит объект сама;
 * - цель `WeakRef`, к которой обращались в текущем задании, живёт до его конца, поэтому между
 *   попытками сборки нужен макротаск — это делает {@link collectUntilReleased};
 * - после сборки проверяйте, что живая часть (форма, сборка) действительно жива: иначе «отпущено»
 *   может значить «собрано всё вместе с владельцем».
 *
 * @example
 * ```ts
 * const refs = removeFirstRow(bundle); // внутри: [new WeakRef(row), …] и removeAt(0)
 * await collectUntilReleased(refs);
 * expect(refs.map((ref) => ref.deref())).toEqual([undefined]);
 * expect(bundle.form.rows.length).toBe(1);
 * ```
 *
 * @module test-utils/gc
 */

import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';
import { tick } from './async';

/** Полная сборка мусора — сейчас, синхронно. */
export function collectGarbage(): void {
  setFlagsFromString('--expose_gc');
  (runInNewContext('gc') as () => void)();
}

/**
 * Собирать мусор, пока все слабые ссылки не отпущены, — не больше `attempts` попыток, с макротаском
 * перед каждой. Отпущены ли ссылки, тест проверяет сам: так в сообщении падения видно, какая
 * осталась.
 *
 * @param refs - Слабые ссылки на объекты, которые должны уйти.
 * @param attempts - Сколько раз пробовать.
 */
export async function collectUntilReleased(
  refs: readonly WeakRef<object>[],
  attempts = 10
): Promise<void> {
  for (
    let attempt = 0;
    attempt < attempts && refs.some((ref) => ref.deref() !== undefined);
    attempt++
  ) {
    await tick();
    collectGarbage();
  }
}
