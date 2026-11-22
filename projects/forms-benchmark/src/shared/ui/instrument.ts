/**
 * Инструментирование общих примитивов — одинаково для всех библиотек.
 *
 * 1. Счётчик исполнений: каждый примитив на рендер вызывает `countRender(name)`. Это ловит и
 *    «исполнился, но React выбросил результат» (bailout после вызова), чего не видит обход fiber по
 *    флагу PerformedWork. Включается только когда e2e выставил `__benchPrimitiveRenders` до загрузки
 *    страницы; иначе — одна проверка свойства.
 * 2. Реестр идентичности: множество функций-примитивов в `__benchPrimitiveTypes`. Счётчик fiber
 *    классифицирует компоненты по `fiber.type`, а не по именам, которые минификатор стирает.
 */

type Counts = Record<string, number>;

interface BenchGlobals {
  __benchPrimitiveRenders?: Counts;
  __benchPrimitiveTypes?: Map<unknown, string>;
}

const g = globalThis as BenchGlobals;

export function countRender(name: string): void {
  const counts = g.__benchPrimitiveRenders;
  if (counts) counts[name] = (counts[name] ?? 0) + 1;
}

export function registerPrimitives(primitives: Record<string, unknown>): void {
  const registry = (g.__benchPrimitiveTypes ??= new Map());
  for (const [name, type] of Object.entries(primitives)) registry.set(type, name);
}
