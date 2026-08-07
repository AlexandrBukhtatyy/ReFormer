/**
 * Политика рендера Runtime-preview (спека §9/§13): для каждой каталожной записи решаем — рисовать
 * ЖИВОЙ компонент активного кита или показать нейтральный стаб «предпросмотр ограничен».
 *
 * React-free (только `import type`), чтобы `known-names` и тесты работали в node. Namespace кита
 * приходит аргументом, дескриптор — из {@link getActiveDescriptor}; сам модуль ни того, ни другого
 * не импортирует статически.
 *
 * Раньше здесь жили два захардкоженных allowlist'а под `@reformer/ui-kit` — «единственная ручная
 * ручка системы». Теперь это данные кита ({@link '../kits/legacy-reformer-ui-kit'} для встроенного,
 * блок `kit` в каталоге для остальных), а модуль стал чистой логикой. Их полнота по-прежнему
 * стережётся `render-policy.test.ts`, а отсутствие дрейфа с палитрой — `registry-drift.test.ts`.
 *
 * @module reformer-builder/preview-runtime/render-policy
 */

import type { ComponentType } from 'react';
import type { CatalogEntry, CatalogRole } from '../catalog';
import { getActiveDescriptor } from '../kits/active';
import { exportNameFor } from '../kits/descriptor';
import { OVERLAY_LIMITED, SUBPATH_LIMITED } from '../kits/legacy-reformer-ui-kit';
import type { KitDescriptor, KitNamespace } from '../kits/types';

/**
 * Дефолты встроенного кита реэкспортируются для потребителей, ещё не переведённых на дескриптор
 * (`codegen/ui-kit-imports` — этап 6) и для `render-policy.test.ts`.
 */
export { OVERLAY_LIMITED, SUBPATH_LIMITED };

/** Namespace кита (имя экспорта → значение). Исторический алиас для {@link KitNamespace}. */
export type UiKitNamespace = KitNamespace;

/** Решение политики для одной записи каталога. */
export type RenderPolicy =
  | { policy: 'live'; component: ComponentType<Record<string, unknown>> }
  | { policy: 'limited'; reason: string };

/** Является ли значение React-компонентом (функция ИЛИ forwardRef/memo-объект с `$$typeof`). */
function isComponentType(x: unknown): x is ComponentType<Record<string, unknown>> {
  return typeof x === 'function' || (typeof x === 'object' && x !== null && '$$typeof' in x);
}

/**
 * Запись каталога попадает в `$component`-реестр? Синтетика `$html(...)` (op `html`) и `FormArray`
 * (`array`/`item`) рендерятся нативно, минуя реестр, — их исключаем. Правило — единый источник для
 * `known-components` и `known-names`, чтобы карта и множество имён не разошлись.
 */
export function isRegistrable(entry: Pick<CatalogEntry, 'name' | 'role'>): boolean {
  return entry.role !== 'array' && !entry.name.startsWith('$html(');
}

/**
 * Реальный компонент кита для записи каталога. Имя экспорта считает {@link exportNameFor}: правило
 * кита (`${name}${fieldSuffix}` для полей) с точечным override через `exportName` записи.
 */
export function resolveKitComponent(
  entry: Pick<CatalogEntry, 'name' | 'role' | 'exportName'>,
  uiKit: UiKitNamespace,
  descriptor: Pick<KitDescriptor, 'resolve'> = getActiveDescriptor()
): ComponentType<Record<string, unknown>> | undefined {
  const exported = uiKit[exportNameFor(entry, descriptor)];
  return isComponentType(exported) ? exported : undefined;
}

/** Резолв по имени и роли (без записи каталога) — для вызовов, у которых записи нет под рукой. */
export function resolveUiKitComponent(
  name: string,
  role: CatalogRole,
  uiKit: UiKitNamespace
): ComponentType<Record<string, unknown>> | undefined {
  return resolveKitComponent({ name, role }, uiKit);
}

/**
 * Политика для записи каталога, в порядке убывания приоритета:
 *
 * 1. **Жёсткий запрет** (`descriptor.previewPolicy`) — проверяется ДО резолва: оверлей нельзя
 *    рисовать вживую, даже если он есть в namespace (Radix-корень без триггера даёт невидимый узел,
 *    что хуже подписанного стаба). Часть compound'а наследует запрет корня: `DialogTitle` без
 *    своего `Dialog` рисуется в пустоту ровно так же.
 * 2. **Резолв** в namespace → `live`.
 * 3. **Не нашлось** → стаб с причиной из `descriptor.unresolvedReason` (subpath-only и т.п.), иначе
 *    общей. Эта ветка — растяжка против дрейфа: новое каталожное имя без резолва И без объявленной
 *    причины падёт в `render-policy.test.ts`.
 */
export function classify(
  entry: CatalogEntry,
  uiKit: UiKitNamespace,
  descriptor: KitDescriptor = getActiveDescriptor()
): RenderPolicy {
  const { name, compoundParent } = entry;

  const limit =
    descriptor.previewPolicy.get(name) ??
    (compoundParent ? descriptor.previewPolicy.get(compoundParent) : undefined);
  // Явный `preview: { mode: 'live' }` у записи снимает запрет, в том числе унаследованный от корня.
  if (limit?.mode === 'limited')
    return { policy: 'limited', reason: limit.reason ?? 'предпросмотр ограничен' };

  const component = resolveKitComponent(entry, uiKit, descriptor);
  if (component) return { policy: 'live', component };

  return {
    policy: 'limited',
    reason:
      descriptor.unresolvedReason.get(name) ??
      (compoundParent ? descriptor.unresolvedReason.get(compoundParent) : undefined) ??
      `не резолвится в ${descriptor.package}`,
  };
}
