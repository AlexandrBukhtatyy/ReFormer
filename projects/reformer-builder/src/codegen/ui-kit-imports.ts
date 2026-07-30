/**
 * Резолв имени `$component(Name)` в ui-kit-импорт для сгенерированного `registry.ts`. То же правило
 * имён, что у Runtime-preview (`render-policy`: field → `${name}Field`, иначе `name`). Неизвестные /
 * оверлеи / subpath-only — помечаются под placeholder-компонент (форма всё равно собирается).
 *
 * @module reformer-builder/codegen/ui-kit-imports
 */

import { getCatalogEntry } from '../catalog';
import { OVERLAY_LIMITED, SUBPATH_LIMITED } from '../preview-runtime/render-policy';

export interface CompResolution {
  /** Имя из `$component(...)`. */
  name: string;
  /** Символ импорта из `@reformer/ui-kit`, либо `null` → placeholder. */
  symbol: string | null;
  /** true — не резолвится вживую, регистрируем placeholder-компонент. */
  placeholder: boolean;
  /** Причина placeholder (для TODO-комментария). */
  reason?: string;
}

/** Wizard-семейство: требует FormWizard-shim — в Фазе 1 отдаём placeholder с TODO. */
const NEEDS_SHIM = new Set(['Wizard', 'RendererFormWizard', 'Step', 'FormWizard']);

/** Разрешить имя компонента в импорт ui-kit либо placeholder. */
export function resolveComponent(name: string): CompResolution {
  if (NEEDS_SHIM.has(name))
    return { name, symbol: null, placeholder: true, reason: 'wizard — нужен FormWizard-shim' };
  if (OVERLAY_LIMITED.has(name))
    return { name, symbol: null, placeholder: true, reason: 'оверлей — нужен триггер/портал' };
  if (SUBPATH_LIMITED.has(name))
    return { name, symbol: null, placeholder: true, reason: SUBPATH_LIMITED.get(name) };
  const entry = getCatalogEntry(name);
  if (!entry) return { name, symbol: null, placeholder: true, reason: 'нет в каталоге ui-kit' };
  const symbol = entry.role === 'field' ? `${name}Field` : name;
  return { name, symbol, placeholder: false };
}
