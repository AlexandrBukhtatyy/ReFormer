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
 * @module reformer-builder/catalog/types
 */

import type { JsonNode } from '@reformer/renderer-json';
import type { PropDoc, PropsSchema, PropWidget } from '@reformer/ui-kit/meta';

/** Версия контракта каталога — закладывается сразу (спека §11), даже до JSON-контракта (M3). */
export const CATALOG_CONTRACT_VERSION = '1.0';

/** Роль записи каталога — определяет размещение узла (спека §5). */
export type CatalogRole = 'field' | 'container' | 'array';

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
  makeNode: () => JsonNode;
}

/**
 * Сериализуемая запись каталога (без builder-only `makeNode`) — ровно нормативная запись §5.
 * Из неё состоит каталог-JSON по контракту; билдер восстанавливает `makeNode` по `role`/`name`.
 */
export interface CatalogRecord {
  name: string;
  role: CatalogRole;
  category?: string;
  propsSchema: PropsSchema;
}

/** Каталог-JSON по контракту `component-catalog.schema.json` (§5). */
export interface CatalogJson {
  version: string;
  components: CatalogRecord[];
}

/**
 * Виджет инспектора: стандартные {@link PropWidget} из ui-kit плюс builder-only `className`
 * (редактор CSS-классов с автодополнением Tailwind). Билдер назначает `className` по ключу пропа
 * поверх `x-doc.kind` (в ui-kit `className` объявлен `readonly` — эта конвенция для ui-kit-доков,
 * а не для билдера).
 */
export type InspectorWidget = PropWidget | 'className' | 'dataSource';

/**
 * Проп для инспектора — производная от `propsSchema` (НЕ часть сериализуемого контракта).
 * Строится {@link '../catalog/widgets'} из стандартных ключей JSON Schema + `x-doc`.
 */
export interface InspectorProp {
  /** Ключ пропа в `componentProps`. */
  key: string;
  /** Человекочитаемая подпись. */
  label: string;
  /** Виджет редактора: boolean→switch, text→input, number→number, enum→select, readonly→серое поле, className→автодополнение Tailwind. */
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
