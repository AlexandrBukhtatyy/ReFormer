/**
 * Обвязка тестов обеих сторон: хозяин генерации с настоящим стеком ReFormer.
 *
 * Хозяин (`forms/codegen`) и стек (`reformer/codegen`) — разные домены: свои тесты хозяин гоняет
 * на двойнике стека, стек — без хозяина. Здесь — то, что проверяет их вместе: прогон панели,
 * генерацию из дерева, цели из проекта, напечатанные стеком.
 *
 * @module plugins/reformer/integration/codegen-harness
 */

import type { KitView } from '../core/codegen';
import { builtinKit } from '../core/testing';
import type { CodegenStack } from '@reformer/builder-plugin-api';
import { createCodegenStack } from '../codegen/src';
import { stacksOf } from '../../forms/codegen/src/testing';
import type { Stacks } from '../../forms/codegen/src/stacks';

export { BUILTIN_TARGETS } from '../codegen/src';

/** Стек ReFormer с китом; `kit: null` — кита нет. Перевод — сам ключ. */
export function reformerStack(options: { readonly kit?: KitView | null } = {}): CodegenStack {
  const view = options.kit === undefined ? builtinKit() : options.kit;
  return createCodegenStack({
    kit: () => view?.kit ?? null,
    catalog: () => view?.catalog ?? [],
    translate: (key) => key,
  });
}

/** Стеки хозяина — один стек ReFormer, от «плагина» `reformer.plugin`. */
export function reformerStacks(options: { readonly kit?: KitView | null } = {}): Stacks {
  return stacksOf(reformerStack(options));
}
