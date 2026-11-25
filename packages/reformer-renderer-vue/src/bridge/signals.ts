/**
 * Мост сигналов ядра в реактивность Vue.
 *
 * Состояние формы живёт в сигналах `@preact/signals-core`: Vue о них не знает, и чтение сигнала в
 * рендер-функции компонент на него не подписывает. Мост читает сигналы в effect ядра и кладёт
 * результат в `shallowRef` — на него рендер-функция подписывается обычным способом.
 *
 * Только `shallowRef`: глубокая реактивность Vue оборачивает объект в прокси, а ноды формы, ручки
 * модели и сами сигналы ядро сопоставляет по ссылке (реестр нод, области схемы). Прокси вместо
 * исходного объекта эту связь рвёт молча.
 *
 * @module renderer-vue/bridge/signals
 */

import { effect } from '@reformer/core/signals';
import { getCurrentScope, onScopeDispose, shallowRef, type ShallowRef } from 'vue';

/**
 * Значение, вычисленное из сигналов ядра, как `shallowRef` Vue.
 *
 * `read` исполняется в effect ядра: каждый прочитанный в ней сигнал становится зависимостью, и
 * смена любого пересчитывает значение. Первое значение готово сразу — effect ядра синхронный.
 * Подписка снимается вместе с областью, в которой вызван мост (`setup` компонента, `effectScope`).
 *
 * Значение с той же ссылкой перерисовку не вызывает: `read`, которая возвращает примитив или
 * неизменившийся объект, компонент не беспокоит.
 *
 * @param read - Чтение сигналов ядра. Реактивные значения Vue внутри неё зависимостями не станут.
 * @returns Ссылка только для чтения; пишет в неё один мост.
 *
 * @example
 * ```ts
 * setup(props) {
 *   const value = useSignalValue(() => props.control.value.value);
 *   return () => h('span', String(value.value));
 * }
 * ```
 */
export function useSignalValue<T>(read: () => T): Readonly<ShallowRef<T>> {
  const target = shallowRef<T>(undefined as T);
  const dispose = effect(() => {
    target.value = read();
  });
  if (getCurrentScope()) onScopeDispose(dispose);
  return target;
}
