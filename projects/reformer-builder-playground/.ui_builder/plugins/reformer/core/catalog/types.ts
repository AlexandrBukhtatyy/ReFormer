/**
 * Типы каталога компонентов.
 *
 * {@link CatalogEntry} — внутреннее зеркало НОРМАТИВНОЙ записи каталога из спеки MVP §5
 * (`{ name, propsSchema, role, category? }`) плюс builder-only фабрика {@link CatalogEntry.makeNode}
 * (для дропа из палитры; в сериализуемый контракт `component-catalog.schema.json` она не входит).
 *
 * В MVP каталог строится напрямую из `@reformer/ui-kit/meta` `defaultPropSchemas`; JSON-контракт
 * и ui-kit-адаптер с явным `role` — M3 (спека §5/§15). Эта форма — стабильная граница: смена
 * источника (прямой импорт → валидированный catalog-JSON) не меняет тип.
 *
 * @module plugins/reformer/core/catalog/types
 */

import type { JsonNode } from '@reformer/renderer-json';
import type { PropDoc, PropsSchema, PropWidget } from '@reformer/ui-kit/meta';
import type { CatalogRole } from '@reformer/builder-plugin-api';

/**
 * JSON-контракт каталога (`CatalogJson`, `CatalogRecord`, роли, версии) — в SDK: кит общий для
 * всех стеков. Здесь его типы реэкспортируются, чтобы модули стека писались против одного имени.
 */
export type { CatalogJson, CatalogRecord, CatalogRole } from '@reformer/builder-plugin-api';

/** Секция инспектора (из `x-doc.group`). */
export type PropGroup = PropDoc['group'];

/**
 * Запись каталога (зеркало нормативной записи спеки §5).
 * - `name` — имя компонента (`$component(name)`);
 * - `role` — field | container | array;
 * - `category?` — группировка в палитре;
 * - `propsSchema` — JSON Schema редактируемых пропсов (для field — враппер+вариант; `x-runtimeProps`
 *   инспектором скрываются);
 * - `makeNode` — builder-only фабрика узла по умолчанию для дропа из палитры.
 */
export interface CatalogEntry {
  name: string;
  role: CatalogRole;
  category?: string;
  propsSchema: PropsSchema;
  /** Имя группы вариантов (напр. `Input`); члены группы делят его. Дефолт — член, чей `name === variantGroup`. */
  variantGroup?: string;
  /** Человекочитаемая метка варианта в группе (напр. `Пароль`). */
  variant?: string;
  /** Корень compound'а, частью которого запись является (`AlertTitle` → `Alert`); см. `./compound`. */
  compoundParent?: string;
  /** Имя символа в namespace кита, если отличается от `name` (контракт `2.0`). */
  exportName?: string;
  /** Subpath кита, за которым лежит символ, если его нет в barrel (контракт `2.0`). */
  subpath?: string;
  makeNode: () => JsonNode;
}

/**
 * Виджет инспектора: стандартные {@link PropWidget} из ui-kit плюс builder-only `className`
 * (редактор CSS-классов с автодополнением из словаря активного кита). Билдер назначает `className` по ключу пропа
 * поверх `x-doc.kind` (в ui-kit `className` объявлен `readonly` — эта конвенция для ui-kit-доков,
 * а не для билдера).
 */
export type InspectorWidget = PropWidget | 'className' | 'dataSource' | 'icon';

/**
 * Проп для инспектора — производная от `propsSchema` (НЕ часть сериализуемого контракта).
 * Строится {@link '../catalog/widgets'} из стандартных ключей JSON Schema + `x-doc`.
 */
export interface InspectorProp {
  /** Ключ пропа в `componentProps`. */
  key: string;
  /** Человекочитаемая подпись. */
  label: string;
  /** Виджет редактора: boolean→switch, text→input, number→number, enum→select, readonly→серое поле, className→автодополнение из словаря кита. */
  widget: InspectorWidget;
  /** Секция инспектора. */
  group: PropGroup;
  /** Подсказка (`description`). */
  description?: string;
  /** Значение по умолчанию (`default`). */
  default?: unknown;
  /** Варианты для `enum`. */
  options?: Array<string | number>;
  /** Границы/шаг для числовых (`minimum`/`maximum`/`multipleOf`). */
  min?: number;
  max?: number;
  step?: number;
}

/** Секция инспектора: группа + её пропы (в порядке отображения). */
export interface InspectorGroup {
  group: PropGroup;
  props: InspectorProp[];
}
