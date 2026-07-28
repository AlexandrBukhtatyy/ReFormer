/**
 * Политика рендера Runtime-preview (спека §9/§13): для каждой каталожной записи решаем — рисовать
 * ЖИВОЙ `@reformer/ui-kit`-компонент или показать нейтральный стаб «предпросмотр ограничен».
 *
 * Наборы политики — чистые данные (React-free), чтобы `known-names` и тесты работали в node.
 * {@link resolveUiKitComponent}/{@link classify} принимают barrel-namespace аргументом — сам модуль
 * React НЕ импортирует (только `import type`).
 *
 * Единственная РУЧНАЯ ручка системы — два allowlist'а ниже; их полнота стережётся
 * `render-policy.test.ts`, а отсутствие дрейфа с палитрой — `registry-drift.test.ts`.
 *
 * @module reformer-builder/preview-runtime/render-policy
 */

import type { ComponentType } from 'react';
import type { CatalogEntry, CatalogRole } from '../catalog';

/**
 * Настоящие оверлеи: корень Radix без триггера/портала/`open` рендерится в пустоту — живой рендер
 * даёт НЕВИДИМЫЙ узел на canvas, что хуже подписанного стаба. Показываем стаб.
 */
export const OVERLAY_LIMITED: ReadonlySet<string> = new Set([
  'Dialog',
  'AlertDialog',
  'Sheet',
  'Popover',
  'HoverCard',
  'Tooltip',
  'DropdownMenu',
  'ContextMenu',
  'Menubar',
  'NavigationMenu',
]);

/**
 * Subpath-only: компонент есть в каталоге, но НЕ в barrel `@reformer/ui-kit` (тяжёлые optional
 * peer-deps живут за subpath-экспортом) — из barrel-namespace не резолвится. Значение — причина
 * для стаба. `Chart`/`Resizable` дополнительно не имеют экспорта, равного имени каталога
 * (`ChartContainer` / `ResizablePanelGroup`), поэтому не резолвятся даже через subpath.
 */
export const SUBPATH_LIMITED: ReadonlyMap<string, string> = new Map([
  ['Carousel', 'subpath-only: embla-carousel-react'],
  ['Chart', 'subpath-only: recharts (экспорт ChartContainer, не Chart)'],
  ['Command', 'subpath-only: cmdk'],
  ['Drawer', 'subpath-only: vaul'],
  ['MessageScroller', 'subpath-only: @shadcn/react'],
  ['Resizable', 'subpath-only: react-resizable-panels (экспорт ResizablePanelGroup, не Resizable)'],
  ['Sidebar', 'subpath-only'],
]);

/** Namespace-объект barrel `@reformer/ui-kit` (имя экспорта → значение). */
export type UiKitNamespace = Record<string, unknown>;

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

/** Реальный ui-kit-компонент по правилу имён: field → `${name}Field`, иначе `name`. */
export function resolveUiKitComponent(
  name: string,
  role: CatalogRole,
  uiKit: UiKitNamespace
): ComponentType<Record<string, unknown>> | undefined {
  const key = role === 'field' ? `${name}Field` : name;
  const exported = uiKit[key];
  return isComponentType(exported) ? exported : undefined;
}

/**
 * Политика для записи каталога: оверлей → стаб; иначе резолвится живой компонент → `live`;
 * иначе стаб с причиной (subpath-only / не резолвится). Ветка «не резолвится» — растяжка против
 * дрейфа: новое каталожное имя без резолва И без allowlist'а падёт в `render-policy.test.ts`.
 */
export function classify(entry: CatalogEntry, uiKit: UiKitNamespace): RenderPolicy {
  const { name, role } = entry;
  if (OVERLAY_LIMITED.has(name))
    return { policy: 'limited', reason: 'оверлей — нужен триггер/портал' };
  const component = resolveUiKitComponent(name, role, uiKit);
  if (component) return { policy: 'live', component };
  return {
    policy: 'limited',
    reason: SUBPATH_LIMITED.get(name) ?? 'не резолвится в @reformer/ui-kit',
  };
}
