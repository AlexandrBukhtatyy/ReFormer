/**
 * Резолв имени `$component(Name)` в импорт кита для сгенерированного `registry.ts`.
 *
 * ## Здесь закрывается давняя задача билдера
 *
 * В v1 этот модуль назывался `codegen/ui-kit-imports.ts` и был захардкожен под один кит:
 * спецификатор импорта — литерал `'@reformer/ui-kit'`, списки ограничений — три константы
 * из `kits/legacy-reformer-ui-kit`. Экспорт формы, нарисованной чужим китом, всё равно писал
 * импорт из `@reformer/ui-kit` — то есть выдавал код, который у пользователя не собирается.
 *
 * Теперь все четыре ответа даёт ДЕСКРИПТОР активного кита:
 *
 * | вопрос                             | v1                            | v2                          |
 * | ---------------------------------- | ----------------------------- | --------------------------- |
 * | откуда импортировать               | литерал `'@reformer/ui-kit'`  | `kit.codegen.importSpecifier` |
 * | кому нужен шим                     | `NEEDS_SHIM`                  | `kit.codegen.needsShim`     |
 * | кого нельзя монтировать напрямую   | `OVERLAY_LIMITED`             | `kit.previewPolicy`         |
 * | кого может не оказаться в barrel   | `SUBPATH_LIMITED`             | `kit.unresolvedReason`      |
 *
 * Дескриптор обязателен и не имеет умолчания: кита нет — генерировать нечего. Умолчание
 * («если кита нет, пиши `@reformer/ui-kit`») вернуло бы ровно ту ошибку, ради которой всё это
 * и делалось, только молча.
 *
 * @module lib/codegen/components
 */

import type { CatalogEntry } from '../catalog/types';
import { exportNameFor } from '../kits/descriptor';
import type { KitDescriptor } from '../kits/types';

/** Как разрешилось одно имя компонента. */
export interface ComponentResolution {
  /** Имя из `$component(...)`. */
  readonly name: string;
  /** Символ импорта из кита либо `null` — тогда под именем регистрируется заглушка. */
  readonly symbol: string | null;
  /** `true` — вживую не резолвится, в реестр уходит заглушка. */
  readonly placeholder: boolean;
  /** Причина заглушки — уходит в TODO-комментарий сгенерированного файла. */
  readonly reason?: string;
  /** `true` — символ придёт не из кита, а из соседнего файла-шима. */
  readonly shim: boolean;
}

/** Что кодогену нужно знать о ките и его каталоге. */
export interface KitView {
  readonly kit: KitDescriptor;
  readonly catalog: readonly CatalogEntry[];
}

/** Разрешить имя компонента в импорт кита, шим или заглушку. */
export function resolveComponent(name: string, view: KitView): ComponentResolution {
  const { kit, catalog } = view;

  if (kit.codegen.needsShim.has(name)) {
    return { name, symbol: null, placeholder: false, shim: true };
  }

  const policy = kit.previewPolicy.get(name);
  if (policy?.mode === 'limited') {
    // Ограничение объявлено про живой рендер, но применимо и к экспорту по той же причине:
    // корень оверлея без триггера и портала рисует невидимый узел. Заглушка с TODO честнее
    // компонента, который «зарегистрирован» и ничего не показывает.
    return {
      name,
      symbol: null,
      placeholder: true,
      reason: policy.reason ?? 'компонент требует обвязки',
      shim: false,
    };
  }

  const unresolved = kit.unresolvedReason.get(name);
  if (unresolved !== undefined) {
    return { name, symbol: null, placeholder: true, reason: unresolved, shim: false };
  }

  const entry = catalog.find((e) => e.name === name);
  if (entry === undefined) {
    return {
      name,
      symbol: null,
      placeholder: true,
      reason: `нет в каталоге кита «${kit.label}»`,
      shim: false,
    };
  }

  return { name, symbol: exportNameFor(entry), placeholder: false, shim: false };
}
