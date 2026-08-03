/**
 * Контракт каталога компонентов (спека §5, §15). Билдер ВЛАДЕЕТ JSON Schema контрактом
 * (`component-catalog.schema.json`); клиент (`@reformer/ui-kit`) генерирует под него валидный
 * catalog-JSON (`@reformer/ui-kit/catalog`, команда `generate:catalog`). Здесь: загрузка каталога
 * от клиента ({@link loadCatalogJson}), валидатор против контракта ({@link validateCatalog}) и
 * реконструкция `CatalogEntry[]` с `makeNode` ({@link buildCatalogFromJson}).
 *
 * Категория палитры — забота билдера (клиент её не поставляет): назначается на загрузке по
 * {@link CATEGORY_BY_NAME}. Синтетические `$html`/array-записи добавляет билдер (`synthetic-entries`).
 *
 * @module reformer-builder/catalog/contract
 */

import Ajv, { type ValidateFunction } from 'ajv';
import type { ComponentsConfig } from '../config/types';
import { getClientCatalog, getRuntimeConfig } from '../config/state';
import type { CatalogEntry, CatalogJson, CatalogRecord, CatalogRole } from './types';
import { syntheticRecords } from './synthetic-entries';
import { makeNodeFor } from './make-node';
import catalogSchema from './component-catalog.schema.json';
import uiKitCatalog from '@reformer/ui-kit/catalog';

/** JSON Schema контракта каталога (draft-07). Владелец — билдер; ui-kit генерирует под неё. */
export const CATALOG_SCHEMA = catalogSchema;

/**
 * Имя компонента → категория палитры (§5 `category?`). Категория — забота палитры билдера, ui-kit
 * её не поставляет; назначается на загрузке. Незамапленные падают в default (`categoryOf`).
 */
const CATEGORY_BY_NAME: Record<string, string> = {
  // Поля ввода
  Input: 'Поля ввода',
  InputPassword: 'Поля ввода',
  InputMask: 'Поля ввода',
  InputOTP: 'Поля ввода',
  Textarea: 'Поля ввода',
  DatePicker: 'Поля ввода',
  Calendar: 'Поля ввода',
  FileUpload: 'Поля ввода',
  FileUploadAvatar: 'Поля ввода',
  // Выбор и переключатели
  Select: 'Выбор и переключатели',
  NativeSelect: 'Выбор и переключатели',
  Combobox: 'Выбор и переключатели',
  RadioGroup: 'Выбор и переключатели',
  Checkbox: 'Выбор и переключатели',
  Switch: 'Выбор и переключатели',
  Slider: 'Выбор и переключатели',
  Toggle: 'Выбор и переключатели',
  ToggleGroup: 'Выбор и переключатели',
  // Контейнеры
  Box: 'Контейнеры',
  Section: 'Контейнеры',
  Card: 'Контейнеры',
  Accordion: 'Контейнеры',
  Tabs: 'Контейнеры',
  Collapsible: 'Контейнеры',
  InputGroup: 'Контейнеры',
  ButtonGroup: 'Контейнеры',
  AspectRatio: 'Контейнеры',
  ScrollArea: 'Контейнеры',
  Resizable: 'Контейнеры',
  Sidebar: 'Контейнеры',
  // Действия
  Button: 'Действия',
  // Отображение
  Icon: 'Отображение',
  Label: 'Отображение',
  Badge: 'Отображение',
  Typography: 'Отображение',
  Avatar: 'Отображение',
  Progress: 'Отображение',
  Skeleton: 'Отображение',
  Spinner: 'Отображение',
  Table: 'Отображение',
  Chart: 'Отображение',
  Empty: 'Отображение',
  Kbd: 'Отображение',
  Marker: 'Отображение',
  Alert: 'Отображение',
  Separator: 'Отображение',
  Carousel: 'Отображение',
  // Typography — набор отдельных компонентов (TypographyH1…Muted) → раздел «Типографика» (правило-префикс в categoryOf).
  // Оверлеи
  Dialog: 'Оверлеи',
  AlertDialog: 'Оверлеи',
  Sheet: 'Оверлеи',
  Drawer: 'Оверлеи',
  Popover: 'Оверлеи',
  HoverCard: 'Оверлеи',
  Tooltip: 'Оверлеи',
  Command: 'Оверлеи',
  // Навигация
  DropdownMenu: 'Навигация',
  ContextMenu: 'Навигация',
  Menubar: 'Навигация',
  NavigationMenu: 'Навигация',
  Breadcrumb: 'Навигация',
  Pagination: 'Навигация',
  // Чат
  Bubble: 'Чат',
  Message: 'Чат',
  MessageScroller: 'Чат',
  Attachment: 'Чат',
  Item: 'Чат',
};

function categoryOf(name: string, role: CatalogRole): string {
  // Клиентский конфиг может доопределить/переопределить категорию по имени (сливается поверх дефолта).
  const override = getRuntimeConfig().palette?.categoryByName?.[name];
  if (override) return override;
  // Typography разбит на отдельные компоненты (TypographyH1…Muted) — собственный раздел «Типографика».
  if (name.startsWith('Typography')) return 'Типографика';
  return CATEGORY_BY_NAME[name] ?? (role === 'container' ? 'Контейнеры' : 'Прочее');
}

/** Отфильтровать записи по whitelist/blacklist имён из клиентского конфига (по имени компонента). */
function filterComponents(
  records: CatalogRecord[],
  cfg: ComponentsConfig | undefined
): CatalogRecord[] {
  let out = records;
  if (cfg?.include && cfg.include.length) {
    const inc = new Set(cfg.include);
    out = out.filter((r) => inc.has(r.name));
  }
  if (cfg?.exclude && cfg.exclude.length) {
    const exc = new Set(cfg.exclude);
    out = out.filter((r) => !exc.has(r.name));
  }
  return out;
}

/**
 * Каталог-JSON: источник компонентов + синтетические записи билдера (`$html`/array/wizard).
 * Источник — клиентский каталог (`--catalog` при локальном старте, {@link getClientCatalog}), иначе
 * вшитый `@reformer/ui-kit/catalog`. Конфиг клиента может сузить synthetic-набор и отфильтровать
 * компоненты (include/exclude). Единственная граница источника — смена клиента не трогает остальной код.
 */
export function loadCatalogJson(): CatalogJson {
  const componentsCfg = getRuntimeConfig().components;
  const supplied = getClientCatalog() ?? (uiKitCatalog as unknown as CatalogJson);
  const all = [...supplied.components, ...syntheticRecords(componentsCfg?.synthetic)];
  return { version: supplied.version, components: filterComponents(all, componentsCfg) };
}

/** Реконструировать `CatalogEntry[]` из каталога-JSON (категория палитры + восстановление `makeNode`). */
export function buildCatalogFromJson(json: CatalogJson): CatalogEntry[] {
  return json.components.map((r) => ({
    name: r.name,
    role: r.role,
    category: r.category ?? categoryOf(r.name, r.role),
    propsSchema: r.propsSchema,
    ...(r.variantGroup ? { variantGroup: r.variantGroup } : {}),
    ...(r.variant ? { variant: r.variant } : {}),
    makeNode: () => makeNodeFor(r.name, r.role),
  }));
}

let validateFn: ValidateFunction | null = null;

/** Провалидировать catalog-JSON против контракта (§5: билдер валидирует поставляемый каталог). */
export function validateCatalog(json: unknown): { valid: boolean; errors: string[] } {
  if (!validateFn) {
    const ajv = new Ajv({ allErrors: true, strict: false });
    validateFn = ajv.compile(CATALOG_SCHEMA);
  }
  const valid = validateFn(json);
  const errors = (validateFn.errors ?? []).map((e) =>
    `${e.instancePath || '/'} ${e.message ?? ''}`.trim()
  );
  return { valid: Boolean(valid), errors };
}
