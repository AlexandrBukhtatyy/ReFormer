/**
 * Резолв имени `$component(Name)` в импорт кита для сгенерированного `schema/registry.ts`.
 *
 * ## Здесь закрывается давняя задача билдера
 *
 * В v1 этот модуль назывался `codegen/ui-kit-imports.ts` и был захардкожен под один кит:
 * спецификатор импорта — литерал `'@reformer/ui-kit'`, списки ограничений — три константы
 * «неявного кита» билдера. Экспорт формы, нарисованной чужим китом, всё равно писал
 * импорт из `@reformer/ui-kit` — то есть выдавал код, который у пользователя не собирается.
 *
 * Теперь все четыре ответа даёт ДЕСКРИПТОР активного кита — то, что кит объявил о себе сам:
 *
 * | вопрос                             | v1                            | v2                          |
 * | ---------------------------------- | ----------------------------- | --------------------------- |
 * | откуда импортировать               | литерал `'@reformer/ui-kit'`  | `kit.codegen.importSpecifier` |
 * | кого кит не отдаёт напрямую        | `NEEDS_SHIM`                  | `kit.codegen.needsShim`     |
 * | кого нельзя монтировать напрямую   | `OVERLAY_LIMITED`             | `kit.previewPolicy`         |
 * | кто лежит не в главном входе       | `SUBPATH_LIMITED`             | `kit.subpaths`              |
 *
 * ## Подпуть — это импорт, а не заглушка
 *
 * Прежде запись с подпутём уходила в заглушку с причиной `subpath-only`: подпуть читался как
 * «компонент не резолвится». Это не так — он лишь говорит, из какого входа пакета берётся
 * символ. Поэтому резолв отдаёт символ ВМЕСТЕ с подпутём, а строку импорта
 * (`<спецификатор кита>/<подпуть>`) собирает `view/registry`. Запись без подпутя импортируется
 * из главного входа, как и раньше.
 *
 * Про `needsShim`: переходников приложения кодоген больше не печатает. Визард и тело шага
 * регистрирует `view/registry` — символом адаптера кита (`kit.adapters.wizard`) и `Step` из
 * `@reformer/cdk/form-wizard`, — до этого резолва они не доходят. Остальные имена из набора
 * уходят в заглушку с причиной. Сам контракт кита здесь не меняется.
 *
 * Дескриптор обязателен и не имеет умолчания: кита нет — генерировать нечего. Умолчание
 * («если кита нет, пиши `@reformer/ui-kit`») вернуло бы ровно ту ошибку, ради которой всё это
 * и делалось, только молча.
 *
 * @module plugins/reformer/core/codegen/components
 */

import type { CatalogEntry } from '../catalog/types';
import { exportNameFor, type KitDescriptor } from '@reformer/builder-plugin-api';

/** Как разрешилось одно имя компонента. */
export interface ComponentResolution {
  /** Имя из `$component(...)`. */
  readonly name: string;
  /** Символ импорта из кита либо `null` — тогда под именем регистрируется заглушка. */
  readonly symbol: string | null;
  /**
   * Подпуть кита, откуда импортируется символ. Нет — символ лежит в главном входе. У заглушки
   * не бывает: импортировать ей нечего.
   */
  readonly subpath?: string;
  /** `true` — вживую не резолвится, в реестр уходит заглушка. */
  readonly placeholder: boolean;
  /** Причина заглушки — уходит в TODO-комментарий сгенерированного файла. */
  readonly reason?: string;
  /**
   * `true` — кит объявил, что имя напрямую из него не импортируется (`needsShim`). Что с ним
   * делать, решает вызывающий: визард и шаг регистрируются библиотечными символами, прочее —
   * заглушкой.
   */
  readonly shim: boolean;
}

/** Что кодогену нужно знать о ките и его каталоге. */
export interface KitView {
  readonly kit: KitDescriptor;
  readonly catalog: readonly CatalogEntry[];
}

/** Разрешить имя компонента в импорт кита, пометку «не из кита напрямую» или заглушку. */
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

  // Подпуть — факт о пакете кита: откуда брать символ. Заглушкой он запись не делает.
  const subpath = kit.subpaths.get(name);
  return {
    name,
    symbol: exportNameFor(entry),
    ...(subpath === undefined ? {} : { subpath }),
    placeholder: false,
    shim: false,
  };
}
