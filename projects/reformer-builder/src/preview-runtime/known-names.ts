/**
 * Имена, известные дефолтному реестру preview — выводятся ДАННЫМИ из каталога (спека §9), тем же
 * источником, что и палитра, поэтому расходиться с ней не могут. Чистые данные (React-free):
 * каталог не тянет React (`contract.ts` — ajv + JSON), поэтому unknown-детект (`unknown.ts`)
 * работает в node/тестах.
 *
 * Ключи `KNOWN_COMPONENT_NAME_SET` совпадают с ключами {@link KNOWN_COMPONENTS} по построению
 * (тот же `getCatalog()` + тот же `isRegistrable` + те же {@link INFRA_NAMES}).
 *
 * @module reformer-builder/preview-runtime/known-names
 */

import { getCatalog } from '../catalog';
import { isRegistrable } from './render-policy';

/**
 * INFRA-имена ВНЕ палитрового каталога, но зарегистрированные в реестре (см. known-components):
 * враппер поля (`FormField` = `FIELD_WRAPPER`) и граница async. Единый источник —
 * `known-components` строит для них компоненты по этому списку.
 *
 * `Wizard`/`Step` сюда НЕ входят — они палитровые (синтетические записи каталога, см.
 * `synthetic-entries`), поэтому попадают в реестр обычным путём каталога.
 */
export const INFRA_NAMES = ['FormField', 'AsyncBoundary'] as const;

/** Каталожные компоненты, попадающие в реестр как `$component(name)` (без array и `$html`). */
function catalogComponentNames(): string[] {
  return getCatalog()
    .filter(isRegistrable)
    .map((e) => e.name);
}

/** Компоненты, покрытые дефолтным реестром preview (каталог + INFRA). */
export const KNOWN_COMPONENT_NAMES: readonly string[] = [
  ...catalogComponentNames(),
  ...INFRA_NAMES,
];

/** Множество известных имён (для быстрого unknown-детекта). */
export const KNOWN_COMPONENT_NAME_SET: ReadonlySet<string> = new Set(KNOWN_COMPONENT_NAMES);
