/**
 * Tool `check_behaviors` — статическая проверка декларации зависимостей
 * behaviors на циклы (бесконечные `compute`/`copyFrom`-петли).
 *
 * Работает по ДЕКЛАРАЦИИ зависимостей, не по сырому коду (надёжнее, без
 * AST-дрейфа): агент перечисляет для каждого вычисляемого/копируемого поля
 * (`target`), какие поля оно читает (`reads`). Tool строит граф `target → reads`
 * и ищет цикл (DFS). Цикл `a → b → a` = compute-петля, которую рантайм поймает
 * как "Cycle detected" — лучше отловить заранее.
 *
 * См. рецепт `find_recipe cycle` (core `22-cycle-detection.md`).
 */

import { findCycle, type Dependency } from '../utils/graph.js';
import { invalidCall } from './tool-result.js';

export interface CheckBehaviorsArgs {
  dependencies: Dependency[];
}

export async function checkBehaviorsTool(
  args: CheckBehaviorsArgs
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const deps = Array.isArray(args.dependencies) ? args.dependencies : [];
  if (deps.length === 0) {
    return invalidCall('Argument "dependencies" is required and must be a non-empty array.');
  }
  // MCP Server не валидирует args по inputSchema — вход приходит как cast. Проверяем форму каждого
  // элемента, иначе `d.reads.includes(...)` / `list.push(...d.reads)` падают на отсутствующем/не-массиве.
  const malformed = deps.some(
    (d) =>
      typeof d?.target !== 'string' ||
      !Array.isArray(d?.reads) ||
      d.reads.some((r) => typeof r !== 'string')
  );
  if (malformed) {
    return text('Each dependency needs a string `target` and a string[] `reads`.');
  }

  const warnings: string[] = [];
  for (const d of deps) {
    if (d.reads.includes(d.target)) {
      warnings.push(
        `\`${d.target}\` reads itself — a behavior must read OTHER fields and write its own (self-read is an immediate cycle).`
      );
    }
  }

  const cycle = findCycle(deps);

  const lines: string[] = [];
  if (cycle) {
    lines.push(`# check_behaviors — ❌ cycle detected`);
    lines.push('');
    lines.push(`Dependency cycle: \`${cycle.join(' → ')}\``);
    lines.push('');
    lines.push(
      'Break it: a computed field must not (transitively) depend on itself. ' +
        'Recompute from independent sources, or use `watchField(..., { immediate: false })` / ' +
        'guard writes. See `find_recipe cycle`.'
    );
  } else {
    lines.push(`# check_behaviors — ✅ no cycles`);
    lines.push('');
    lines.push(
      `${deps.length} declared dependenc${deps.length === 1 ? 'y' : 'ies'}, no cyclic path.`
    );
  }

  if (warnings.length > 0) {
    lines.push('');
    lines.push('**Warnings:**');
    for (const w of warnings) lines.push(`- ${w}`);
  }

  return text(lines.join('\n'));
}

function text(message: string): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text', text: message }] };
}
