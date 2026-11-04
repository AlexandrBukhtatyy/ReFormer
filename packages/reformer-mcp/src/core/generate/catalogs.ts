/**
 * Что генератор знает о ките и ядре: компоненты `@reformer/ui-kit` из его каталога и операторы
 * `@reformer/core` из его индекса. Оба источника — JSON, сгенерированный самими пакетами; копий у
 * сервера нет.
 *
 * Генератор синхронный, поэтому справочники собираются один раз на входе инструмента
 * ({@link catalogsOf}) и передаются вниз параметром. Чего не нашлось — пустой справочник
 * (`found: false`): генератор работает и без него, но имена не сверяет.
 *
 * @module reformer-mcp/core/generate/catalogs
 */

import { memoize, type Knowledge } from '../knowledge.js';
import { coreOperatorsFromIndex, NO_CORE_OPERATORS, type CoreOperators } from './core-operators.js';
import { NO_UI_KIT, uiKitFromCatalog, type UiKitComponents } from './ui-kit-components.js';

export interface FormCatalogs {
  /** Компоненты кита. */
  readonly uiKit: UiKitComponents;
  /** Фабрики правил и имена операторов ядра. */
  readonly core: CoreOperators;
}

export const NO_CATALOGS: FormCatalogs = { uiKit: NO_UI_KIT, core: NO_CORE_OPERATORS };

/** Операторы ядра из индекса знания — синхронно, один раз на экземпляр. */
export function coreOperatorsOf(k: Knowledge): CoreOperators {
  return memoize(k, 'core-operators', () => coreOperatorsFromIndex(k.index));
}

/** Справочники генератора для знания: каталог кита читается один раз на экземпляр. */
export function catalogsOf(k: Knowledge): Promise<FormCatalogs> {
  return memoize(k, 'form-catalogs', async () => {
    let uiKit = NO_UI_KIT;
    try {
      uiKit = uiKitFromCatalog(await k.uiKitCatalog?.());
    } catch {
      // Битый или недоступный каталог — то же, что его отсутствие: генератор не сверяет имена.
    }
    return { uiKit, core: coreOperatorsOf(k) };
  });
}
