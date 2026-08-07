/**
 * Дескриптор UI-kit'а — «что это за кит и как его рендерить» (план `docs/plans/ui-builder-deep-sun.md` §3.4).
 *
 * Отвечает на вопросы, ответы на которые сегодня захардкожены в билдере под конкретный
 * `@reformer/ui-kit`: как из имени каталога получить символ экспорта, какие компоненты нельзя
 * рисовать вживую, какие имена нужны рендереру вне палитры, в какую категорию класть запись.
 *
 * Две разные сущности, которые нельзя смешивать:
 * - **дескриптор** (этот модуль) — поставляется КИТОМ, живёт опциональным блоком `kit` внутри
 *   catalog-JSON;
 * - **реестр китов** — «между какими китами пользователь может выбирать», поставляется билдером и
 *   клиентским конфигом (этап 3).
 *
 * ВСЕ поля опциональны: каталог без блока `kit` (сегодняшний `component-catalog.json` и любой
 * клиентский `--catalog`) достраивается дефолтами билдера до «неявного кита» и ведёт себя ровно
 * как раньше — см. {@link './descriptor'}.
 *
 * Модуль — ЛИСТ графа зависимостей (только `import type`), чтобы его можно было тянуть из любого
 * слоя без циклов: `catalog/*`, `preview-runtime/*`, `model/*` и `codegen/*` импортируют отсюда,
 * а `kits/*` из них — нет.
 *
 * @module reformer-builder/kits/types
 */

import type { JsonNode } from '@reformer/renderer-json';
import type { CatalogRole } from '../catalog/types';

/** Версия контракта ДЕСКРИПТОРА (владелец — билдер). Не путать с версией пакета кита. */
export const KIT_CONTRACT_VERSION = '1.0';

/**
 * Плоская карта «имя экспорта → значение» из модулей кита. Именно по ней резолвятся компоненты:
 * достаточно, чтобы нужный экспорт (`InputField`, `Table`, `FormWizard`, …) в объекте присутствовал,
 * из barrel он пришёл или из subpath — неважно.
 */
export type KitNamespace = Record<string, unknown>;

/**
 * Требования кита к shared-рантайму хоста. Информационная подсказка: решение об активации
 * принимает СИМВОЛЬНАЯ проверка, а не semver — спайк S1 показал, что открытые диапазоны
 * (`">=1.0.0"`) реальный контракт не выражают и жёсткий ESM link error не предотвращают.
 */
export type KitPeerRanges = Record<string, string>;

/** Правило «имя записи каталога → имя экспорта в namespace кита». */
export interface KitResolveRule {
  /**
   * Суффикс символа для записей с `role: 'field'` (у `@reformer/ui-kit` — `Field`:
   * `Input` → `InputField`). Контейнеры резолвятся по имени как есть.
   */
  fieldSuffix?: string;
}

/** Имена компонентов ВНЕ палитрового каталога, но обязательные для рендерера. */
export interface KitInfra {
  /** Враппер поля (он же `FIELD_WRAPPER` реестра renderer-json). */
  fieldWrapper?: string;
  /** Граница асинхронной загрузки. */
  asyncBoundary?: string;
  /** Обёртка display-списка, которой схемы адресуют array-узлы. */
  list?: string;
}

/** Адаптер пошаговой формы: какой символ кита под ним лежит и за каким subpath его искать. */
export interface KitAdapter {
  symbol: string;
  subpath?: string;
}

/** Builder-адаптеры поверх компонентов кита (визард/шаг). `null` — кит такого не поставляет. */
export interface KitAdapters {
  wizard?: KitAdapter | null;
  step?: KitAdapter | null;
  /**
   * Компонент-обёртка, в который надо завернуть поддерево превью. Нужен китам, чей рендер требует
   * контекста: тема styled-components, i18n-провайдер, конфиг портала. Например HexaUI — это
   * styled-components, и без `ConfigProvider` его компоненты рисуются без темы.
   *
   * `null`/отсутствие — киту обёртка не нужна (так у `@reformer/ui-kit`: он на Tailwind-токенах).
   */
  provider?: KitAdapter | null;
}

/** Настройки палитры, которые знает сам кит (билдер держит их как дефолт). */
export interface KitPalette {
  /** Имя компонента → категория палитры. */
  categoryByName?: Record<string, string>;
  /** Порядок разделов палитры. */
  order?: string[];
  /** Имя компонента → текстовый глиф-бейдж. */
  glyphs?: Record<string, string>;
}

/** Как подключаются стили кита (план §3.3). */
export interface KitStyles {
  /**
   * `tokens` — кит использует стандартный словарь токенов, достаточно переобъявить их значения на
   * контейнере превью (проверено спайком S3);
   * `standalone` — кит поставляет самодостаточный CSS со своими утилитами, подключается `<link>`.
   */
  mode?: 'tokens' | 'standalone';
  /** URL самодостаточного CSS (только для `standalone`). */
  href?: string;
}

/** Что подставлять в сгенерированный `registry.ts` при экспорте примера. */
export interface KitCodegen {
  /** Спецификатор пакета в `import { … } from '…'`. */
  importSpecifier?: string;
  /** Символы, которым нужен shim вместо прямого импорта (у ui-kit — wizard-семейство). */
  needsShim?: string[];
}

/** Политика превью для одной записи каталога. */
export interface KitRecordPreview {
  /** `limited` — рисуем подписанный стаб вместо живого компонента. */
  mode: 'live' | 'limited';
  /** Причина ограничения (показывается в стабе). */
  reason?: string;
}

/**
 * Поля записи каталога, которые кит МОЖЕТ доопределить сверх нормативных
 * (`name`/`role`/`propsSchema`/…). Отсутствие любого — поведение как сегодня.
 */
export interface KitRecordExt {
  /** Точечный override правила резолва, когда `${name}${fieldSuffix}` не подходит. */
  exportName?: string;
  /** Subpath кита, за которым лежит символ (когда его нет в barrel). */
  subpath?: string;
  /** Ограничение живого превью (переносит `OVERLAY_LIMITED`/`SUBPATH_LIMITED` из билдера в кит). */
  preview?: KitRecordPreview;
  /** Компонент-лист: самодостаточный визуал, вложенных компонентов не держит. */
  leaf?: boolean;
}

/**
 * Дескриптор кита — то, что кит поставляет о себе сам (блок `kit` в catalog-JSON).
 * Всё опционально: недостающее берётся из дефолтов билдера ({@link './legacy-reformer-ui-kit'}).
 */
export interface KitDescriptorJson {
  /** Стабильный идентификатор, независимый от npm-алиаса (`reformer-ui-kit`). */
  id?: string;
  /** Человекочитаемое имя для переключателя китов. */
  label?: string;
  /** Имя npm-пакета. */
  package?: string;
  /** Версия пакета кита (НЕ версия контракта каталога). */
  version?: string;
  peerRanges?: KitPeerRanges;
  resolve?: KitResolveRule;
  infra?: KitInfra;
  adapters?: KitAdapters;
  palette?: KitPalette;
  styles?: KitStyles;
  codegen?: KitCodegen;
}

/**
 * Разрешённый дескриптор: то же, что {@link KitDescriptorJson}, но все ветки, от которых зависит
 * рантайм, уже заполнены дефолтами — потребителю не нужно проверять `undefined` на каждом шагу.
 */
export interface KitDescriptor {
  id: string;
  label: string;
  package: string;
  version: string;
  peerRanges: KitPeerRanges;
  resolve: Required<KitResolveRule>;
  infra: Required<KitInfra>;
  adapters: KitAdapters;
  palette: Required<Pick<KitPalette, 'categoryByName'>> & KitPalette;
  styles: Required<Pick<KitStyles, 'mode'>> & KitStyles;
  codegen: Required<Pick<KitCodegen, 'importSpecifier'>> & { needsShim: ReadonlySet<string> };
  /**
   * ЖЁСТКИЙ запрет живого рендера: имя записи → политика. Проверяется ДО резолва компонента,
   * поэтому оверлей не отрисуется, даже если в namespace он есть (Radix-корень без триггера рисует
   * невидимый узел — стаб честнее). Собирается из дефолтов билдера + per-record `preview`.
   */
  previewPolicy: ReadonlyMap<string, KitRecordPreview>;
  /**
   * ДИАГНОСТИКА, а не запрет: имя записи → причина, которую показать, если компонент не нашёлся в
   * namespace. Так ведут себя subpath-only компоненты — они не запрещены, их просто нет в barrel.
   * Если кит их всё-таки поставит в namespace, они отрисуются вживую, и это правильно.
   */
  unresolvedReason: ReadonlyMap<string, string>;
  /** Имена компонентов-листьев. */
  leafComponents: ReadonlySet<string>;
  /**
   * Композиции compound'ов по умолчанию. `undefined` — использовать встроенные шаблоны билдера
   * (`catalog/make-node`); перенос самих шаблонов в дескриптор — этап 2.
   */
  compoundTemplates?: Record<string, () => JsonNode>;
}

/** Роль записи каталога — реэкспорт, чтобы потребители дескриптора не тянули `catalog/types`. */
export type { CatalogRole };
