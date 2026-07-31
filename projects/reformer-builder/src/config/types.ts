/**
 * Контракт runtime-конфигурации UI-Builder. Клиент передаёт `reformer-builder.config.json` при
 * локальном старте (`npx reformer-builder --config <path>`); launcher отдаёт его SPA, который на
 * бутстрапе валидирует (по {@link './runtime-config.schema.json'}) и применяет. Все секции
 * ОПЦИОНАЛЬНЫ: отсутствующий/пустой конфиг ⇒ поведение 1:1 как со вшитыми дефолтами.
 *
 * Модуль — лист графа зависимостей (не импортирует `store`/`catalog`), чтобы его можно было тянуть
 * из `config/load` до инициализации графа приложения. Строковые union'ы UI продублированы намеренно
 * (не импортируем `store/types`), чтобы не создавать связь с графом стора.
 *
 * @module reformer-builder/config/types
 */

import type { JsonFormSchema } from '@reformer/renderer-json';

/** Брендинг оболочки (шапка + вкладка браузера). */
export interface BrandingConfig {
  /** Название продукта в шапке (замещает «ReFormer Builder»). */
  productName?: string;
  /** `document.title` вкладки браузера. */
  title?: string;
  /** URL/`data:`-URI логотипа (замещает дефолтную иконку-глиф). */
  logoUrl?: string;
}

/** Настройки палитры компонентов (группировка/порядок/подписи). */
export interface PaletteConfig {
  /** Имя компонента → категория (сливается поверх дефолтной карты `CATEGORY_BY_NAME`). */
  categoryByName?: Record<string, string>;
  /** Порядок разделов палитры (замещает дефолтный `CATEGORY_ORDER`, если задан). */
  order?: string[];
  /** Разделы, свёрнутые по умолчанию (замещает дефолт, если задан). */
  collapsedByDefault?: string[];
  /** Имя компонента → текстовый глиф-бейдж (сливается поверх дефолтов). */
  glyphs?: Record<string, string>;
}

/** Тоглы синтетических записей билдера (не из каталога клиента). */
export interface SyntheticConfig {
  /** Включать презентационные `$html(...)`-блоки (деф. true). */
  html?: boolean;
  /** Ограничить набор HTML-тегов (деф. — все известные билдеру теги). */
  htmlTags?: string[];
  /** Включать `FormArray` (деф. true). */
  formArray?: boolean;
  /** Включать `Wizard` + `Step` (деф. true). */
  wizard?: boolean;
}

/** Ограничение набора компонентов в палитре. */
export interface ComponentsConfig {
  /** Whitelist по имени: если задан — в каталоге остаются только эти компоненты. */
  include?: string[];
  /** Blacklist по имени: перечисленные компоненты убираются из каталога. */
  exclude?: string[];
  /** Тоглы синтетических записей билдера. */
  synthetic?: SyntheticConfig;
}

/** Дефолты UI-оболочки при старте (замещают литералы `initialUi()`). */
export interface UiConfig {
  theme?: 'light' | 'dark';
  /** Открытая левая панель (`null` — сайдбар свёрнут). */
  leftPanel?: 'files' | 'palette' | null;
  rightOpen?: boolean;
  preview?: 'wire' | 'runtime' | 'code';
  bottomTab?: 'raw' | 'model';
  hideDivWrappers?: boolean;
}

/** Настройки работы с проектом клиента (Mode B discovery + стартовая схема Mode A). */
export interface ProjectConfig {
  /** Маркеры мета-схемы формы в `$schema` (объединяются с дефолтными). */
  formSchemaMarkers?: string[];
  /** Каталоги, не сканируемые при обходе проекта (объединяются с дефолтными). */
  ignoreDirs?: string[];
  /** Файлы-исключения при сканировании (объединяются с дефолтными). */
  skipFiles?: string[];
  /**
   * Стартовая схема Mode A: объект — кастомный seed; `null` — пустая форма; поле отсутствует —
   * встроенная демо-схема.
   */
  seedSchema?: JsonFormSchema | null;
}

/**
 * Runtime-конфигурация билдера. Все секции опциональны. Владелец контракта — билдер
 * ({@link './runtime-config.schema.json'}); клиент генерирует под него.
 */
export interface RuntimeConfig {
  /** Версия контракта конфига (информационно). */
  version?: string;
  branding?: BrandingConfig;
  palette?: PaletteConfig;
  components?: ComponentsConfig;
  ui?: UiConfig;
  project?: ProjectConfig;
}
