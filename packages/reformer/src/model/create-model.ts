/**
 * `createModel` — публичная фабрика реактивной модели данных (слой M1).
 *
 * Внутреннее представление — дерево узлов (`model-nodes`), зеркалящее форму данных. Наружу
 * отдаются два прокси: value-доступ (`model-value-proxy`) и `$`-сигналы (`model-signals-proxy`).
 *
 * @group Model
 * @module model/create-model
 */

import type { FormModel, PathAwareSignal } from './types';
import { type ModelNode, GroupNode } from './model-nodes';
import { makeFormModel, rootByFacade } from './model-value-proxy';

// ============================================================================
// Обход листьев модели
// ============================================================================

function walkLeaves(node: ModelNode, visit: (signal: PathAwareSignal<unknown>) => void): void {
  if (node.kind === 'leaf') {
    visit(node.signal);
    return;
  }
  if (node.kind === 'group') {
    for (const child of node.children.values()) walkLeaves(child, visit);
    return;
  }
  // array: читаем `items.value` (а не `.peek()`) — внутри effect это подписка на СОСТАВ массива,
  // поэтому добавление/удаление элемента ретригерит обходчика (напр. реактивную стратегию валидации).
  for (const item of node.items.value) walkLeaves(item, visit);
}

/**
 * Обойти ВСЕ листовые сигналы модели (включая элементы массивов), вызвав `visit` на каждом.
 *
 * Внутри реактивного `effect` служит подпиской «любое поле изменилось»: `visit(sig => void sig.value)`
 * подписывает на значения листьев, а обход массивов через `items.value` — на их состав. Так строятся
 * триггеры `change`/`blur` стратегий валидации (см. `createFormValidation`), тем же паттерном, что
 * `revalidateWhen`, но без ручного перечисления зависимостей.
 *
 * @group Model
 */
export function eachLeafSignal<T>(
  model: FormModel<T>,
  visit: (signal: PathAwareSignal<unknown>) => void
): void {
  const root = rootByFacade.get(model as unknown as object);
  if (root) walkLeaves(root, visit);
}

// ============================================================================
// Публичная фабрика
// ============================================================================

/**
 * Создать реактивную модель данных формы (слой M1).
 *
 * @group Model
 * @param initial Начальные значения (объект). Определяют форму данных и initial-снимок.
 * @returns {@link FormModel} с value-доступом, `$`-сигналами и API (get/set/patch/isDirty/reset/signalAt).
 *
 * @example
 * ```typescript
 * const model = createModel<{ email: string; profile: { name: string }; tags: string[] }>({
 *   email: '',
 *   profile: { name: '' },
 *   tags: [],
 * });
 * model.email = 'a@b.c';
 * model.$.email.value;          // 'a@b.c' (сигнал)
 * // вложенная объект-группа — под-модель FormModel (value-доступ + `.$` + API):
 * model.profile.name = 'Ada';   // value-запись
 * model.$.profile.name.value;   // 'Ada' (сигнал; ≡ model.profile.$.name у под-модели)
 * model.profile.get();          // { name: 'Ada' }
 * model.tags.push('x');
 * model.get();                  // { email: 'a@b.c', profile: { name: 'Ada' }, tags: ['x'] }
 * ```
 */
export function createModel<T extends object>(initial: T): FormModel<T> {
  const root = new GroupNode(initial as Record<string, unknown>, '');
  return makeFormModel(root) as FormModel<T>;
}
