/**
 * Обвязка тестов обеих сторон: хозяин генерации с настоящим стеком ReFormer.
 *
 * Хозяин и стек — разные стороны будущего раскола: свои тесты хозяин гоняет на двойнике стека
 * (`../testing`), стек — без хозяина. Здесь — то, что проверяет их вместе: прогон панели, генерацию
 * из дерева, цели из проекта, напечатанные стеком.
 *
 * @module plugins/reformer/codegen/cross/harness
 */

import type { KitView } from '../../../core/codegen';
import { builtinKit } from '../../../core/testing';
import type { CodegenStack } from '@reformer/builder-plugin-api';
import { createCodegenStack } from '../stack/stack';
import { stacksOf } from '../testing';
import type { Stacks } from '../stacks';

export { BUILTIN_TARGETS } from '../stack/targets';

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
