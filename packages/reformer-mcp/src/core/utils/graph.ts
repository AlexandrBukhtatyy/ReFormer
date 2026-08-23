/**
 * Поиск циклов в графе зависимостей.
 *
 * Вынесено из `tools/check-behaviors.ts`: тот же алгоритм нужен теперь двум потребителям —
 * проверке объявленных behaviors и кросс-проверке сгенерированного бандла (C7). Держать
 * две копии DFS означало бы, что однажды они разойдутся и один из потребителей начнёт
 * пропускать цикл.
 */

/** Ребро графа: `target` читает поля из `reads`. */
export interface Dependency {
  target: string;
  reads: string[];
}

/**
 * DFS по графу `target → reads`. Возвращает циклический путь (последний элемент повторяет
 * первый) либо `null`, если циклов нет.
 *
 * Обход идёт только по узлам, которые сами являются `target`: поле, которое лишь читают,
 * ничего не пишет и цикл замкнуть не может.
 */
export function findCycle(deps: Dependency[]): string[] | null {
  const graph = new Map<string, string[]>();
  for (const d of deps) {
    const list = graph.get(d.target) ?? [];
    list.push(...d.reads);
    graph.set(d.target, list);
  }

  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  const stack: string[] = [];
  let found: string[] | null = null;

  function dfs(node: string): boolean {
    color.set(node, GRAY);
    stack.push(node);
    for (const next of graph.get(node) ?? []) {
      if (color.get(next) === GRAY) {
        const idx = stack.indexOf(next);
        found = stack.slice(idx).concat(next);
        return true;
      }
      if ((color.get(next) ?? WHITE) === WHITE && graph.has(next)) {
        if (dfs(next)) return true;
      }
    }
    stack.pop();
    color.set(node, BLACK);
    return false;
  }

  for (const target of graph.keys()) {
    if ((color.get(target) ?? WHITE) === WHITE) {
      if (dfs(target)) return found;
    }
  }
  return null;
}
