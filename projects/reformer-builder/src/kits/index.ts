/**
 * Слой китов: дескриптор активной дизайн-системы и дефолты билдера для «неявного кита».
 *
 * Барел намеренно РЕАКТ-FREE: здесь нет ни `./runtime`, ни `./adapters/*`. Иначе импорт вида
 * `import { getActiveDescriptor } from '../kits'` из `model/node-kind` или
 * `preview-runtime/render-policy` молча утянул бы за собой `@reformer/ui-kit` и React — а эти
 * модули обязаны работать в node-тестах. Namespace активного кита импортируется явным путём
 * (`../kits/runtime`) и только из React-слоя.
 *
 * Границы слоя: `kits/*` — почти лист графа зависимостей. Отсюда импортируют `catalog/*`,
 * `preview-runtime/*`, `model/*` и `codegen/*`; обратных импортов значений нет, только `import type`.
 *
 * @module reformer-builder/kits
 */

export type {
  KitDescriptor,
  KitDescriptorJson,
  KitAdapter,
  KitAdapters,
  KitClassGroup,
  KitClassGroupsByRole,
  KitCodegen,
  KitInfra,
  KitNamespace,
  KitPalette,
  KitPeerRanges,
  KitRecordExt,
  KitRecordPreview,
  KitResolveRule,
  KitStyles,
} from './types';
export { KIT_CONTRACT_VERSION } from './types';
export { toDescriptor, exportNameFor } from './descriptor';
export { getActiveDescriptor, setActiveDescriptor, resetActiveDescriptor } from './active';
export {
  CATEGORY_BY_NAME,
  INFRA_NAMES,
  LEAF_COMPONENT_NAMES,
  LEGACY_KIT,
  NEEDS_SHIM,
  OVERLAY_LIMITED,
  SUBPATH_LIMITED,
  legacyPreviewPolicy,
  legacyUnresolvedReasons,
} from './legacy-reformer-ui-kit';
