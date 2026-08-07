/**
 * Активный кит: NAMESPACE (React-компоненты). Отделён от {@link './active'} намеренно — дескриптор
 * читают React-free модули (`model/node-kind`, `preview-runtime/render-policy`, node-тесты), и
 * тянуть за ними ui-kit с React нельзя.
 *
 * По умолчанию — встроенный `@reformer/ui-kit`. На этапе 3 сюда будет класть namespace бутстрап,
 * загрузив адаптер выбранного кита через `import()` ДО инициализации графа приложения.
 *
 * @module reformer-builder/kits/runtime
 */

import { REFORMER_UI_KIT_NAMESPACE } from './adapters/reformer-ui-kit';
import type { KitNamespace } from './types';

let active: KitNamespace | null = null;

/** Namespace активного кита; до явной установки — встроенный `@reformer/ui-kit`. */
export function getActiveNamespace(): KitNamespace {
  return active ?? REFORMER_UI_KIT_NAMESPACE;
}

/** Положить namespace активного кита (бутстрап; смена кита — этап 3). */
export function setActiveNamespace(namespace: KitNamespace): void {
  active = namespace;
}

/** Вернуться к встроенному киту (тесты). */
export function resetActiveNamespace(): void {
  active = null;
}
