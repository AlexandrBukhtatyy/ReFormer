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
import type { KitDescriptorJson, KitRecordPreview } from '../kits/types';

/**
 * Текущая версия контракта каталога. `2.0` добавила опциональный блок `kit` (дескриптор кита) и
 * per-record поля `exportName`/`subpath`/`preview`/`leaf`.
 *
 * Обе версии обрабатываются одинаково: всё добавленное опционально, каталог `1.0` достраивается
 * дефолтами билдера до «неявного кита» ({@link '../kits/descriptor'}).
 */
export const CATALOG_CONTRACT_VERSION = '2.0';

/** Версии контракта, которые билдер принимает. `1.0` поддерживается бессрочно. */
export const SUPPORTED_CATALOG_CONTRACT_VERSIONS: readonly string[] = ['1.0', '2.0'];

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
  /** Имя группы вариантов (напр. `Input`); члены группы делят его. Дефолт — член, чей `name === variantGroup`. */
  variantGroup?: string;
  /** Человекочитаемая метка варианта в группе (напр. `Пароль`). */
  variant?: string;
  /** Корень compound'а, частью которого запись является (`AlertTitle` → `Alert`); см. `./compound`. */
  compoundParent?: string;
  /** Точечный override имени экспорта в namespace кита (контракт `2.0`). */
  exportName?: string;
  /** Subpath кита, за которым лежит символ, если его нет в barrel (контракт `2.0`). */
  subpath?: string;
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
  variantGroup?: string;
  variant?: string;
  /** Корень compound'а, частью которого запись является (`AlertTitle` → `Alert`). */
  compoundParent?: string;
  /**
   * Ниже — необязательные поля контракта `2.0`: то, что кит может рассказать о записи сверх
   * нормативного минимума. Отсутствие любого = сегодняшнее поведение (дефолты билдера).
   */
  /** Точечный override правила резолва, когда `${name}${fieldSuffix}` не подходит. */
  exportName?: string;
  /** Subpath кита, за которым лежит символ (когда его нет в barrel). */
  subpath?: string;
  /** Ограничение живого превью — переносит `OVERLAY_LIMITED`/`SUBPATH_LIMITED` из билдера в кит. */
  preview?: KitRecordPreview;
  /** Компонент-лист: самодостаточный визуал, вложенных компонентов не держит. */
  leaf?: boolean;
}

/** Каталог-JSON по контракту `component-catalog.schema.json` (§5). */
export interface CatalogJson {
  version: string;
  components: CatalogRecord[];
  /**
   * Дескриптор кита (контракт `2.0`, опционален). Отсутствие блока = «неявный кит»: билдер
   * достраивает дескриптор своими дефолтами и ведёт себя ровно как до введения контракта.
   */
  kit?: KitDescriptorJson;
}

/**
 * Виджет инспектора: стандартные {@link PropWidget} из ui-kit плюс builder-only `className`
 * (редактор CSS-классов с автодополнением Tailwind). Билдер назначает `className` по ключу пропа
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
