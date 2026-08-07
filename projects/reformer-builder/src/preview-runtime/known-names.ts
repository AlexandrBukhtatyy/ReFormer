/**
 * Имена, известные дефолтному реестру preview — выводятся ДАННЫМИ из каталога (спека §9), тем же
 * источником, что и палитра, поэтому расходиться с ней не могут. Чистые данные (React-free):
 * каталог не тянет React (`contract.ts` — ajv + JSON), поэтому unknown-детект (`unknown.ts`)
 * работает в node/тестах.
 *
 * Результат совпадает с ключами {@link '../preview-runtime/known-components'.knownComponents} по
 * построению (тот же `getCatalog()` + тот же `isRegistrable` + те же {@link INFRA_NAMES}).
 *
 * Раньше это были `const`, вычисляемые на импорте модуля. Теперь — функции с мемо: каталог зависит
 * от активного кита, а тот на этапе 3 станет переключаемым, и значение, «застывшее» в момент
 * загрузки модуля, молча разошлось бы с реальным реестром.
 *
 * @module reformer-builder/preview-runtime/known-names
 */

import { getCatalog } from '../catalog';
import { isRegistrable } from './render-policy';
import { INFRA_NAMES } from '../kits/legacy-reformer-ui-kit';

/**
 * INFRA-имена ВНЕ палитрового каталога, но зарегистрированные в реестре (см. known-components):
 * враппер поля (`FormField` = `FIELD_WRAPPER`), граница async и `List` — обёртка display-списка,
 * которой схемы адресуют array-узлы (`{ array, component: '$component(List)', item.$template }`).
 *
 * Это КЛЮЧИ РЕЕСТРА, а не имена экспортов кита: под какими символами кит их поставляет, знает
 * `descriptor.infra`. Схемы адресуют компоненты этими именами, поэтому они не меняются со сменой
 * кита.
 *
 * `Wizard`/`Step` сюда НЕ входят — они палитровые (синтетические записи каталога, см.
 * `synthetic-entries`), поэтому попадают в реестр обычным путём каталога.
 */
export { INFRA_NAMES };

/** Каталожные компоненты, попадающие в реестр как `$component(name)` (без array и `$html`). */
function catalogComponentNames(): string[] {
  return getCatalog()
    .filter(isRegistrable)
    .map((e) => e.name);
}

let namesCache: readonly string[] | null = null;
let setCache: ReadonlySet<string> | null = null;

/** Компоненты, покрытые дефолтным реестром preview (каталог + INFRA). */
export function knownComponentNames(): readonly string[] {
  return (namesCache ??= [...catalogComponentNames(), ...INFRA_NAMES]);
}

/** Множество известных имён (для быстрого unknown-детекта). */
export function knownComponentNameSet(): ReadonlySet<string> {
  return (setCache ??= new Set(knownComponentNames()));
}

/** Сбросить мемо (тесты; смена активного кита — этап 3). */
export function resetKnownNames(): void {
  namesCache = null;
  setCache = null;
}
