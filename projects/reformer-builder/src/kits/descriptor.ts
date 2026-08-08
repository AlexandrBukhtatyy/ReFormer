/**
 * Нормализация catalog-JSON в {@link KitDescriptor}: блок `kit` (если кит его поставил) кладётся
 * поверх дефолтов билдера ({@link './legacy-reformer-ui-kit'}).
 *
 * КЛЮЧЕВОЙ ИНВАРИАНТ — «неявный кит»: каталог БЕЗ блока `kit` (сегодняшний
 * `@reformer/ui-kit/catalog` и любой клиентский `--catalog`) даёт дескриптор, эквивалентный
 * захардкоженному поведению билдера. Это закреплено `descriptor.test.ts`, чтобы этап 2 (перевод
 * потребителей на дескриптор) не мог тихо изменить поведение.
 *
 * Слияние — НЕ замена: дефолты билдера остаются базой, а кит переопределяет точечно. Иначе кит,
 * который завёл блок `kit`, но ещё не перенёс в записи `preview`, внезапно начал бы рисовать
 * оверлеи вживую (то есть невидимыми узлами на canvas).
 *
 * @module reformer-builder/kits/descriptor
 */

import type { CatalogJson, CatalogRecord } from '../catalog/types';
import type { KitDescriptor, KitDescriptorJson, KitRecordPreview, KitStyles } from './types';
import {
  LEAF_COMPONENT_NAMES,
  LEGACY_KIT,
  NEEDS_SHIM,
  legacyPreviewPolicy,
  legacyUnresolvedReasons,
} from './legacy-reformer-ui-kit';

/** Версия кита, когда он её не сообщил: пакет взят из workspace/бандла, номер недостоверен. */
const UNKNOWN_KIT_VERSION = 'workspace';

/**
 * Жёсткие запреты живого рендера: дефолты билдера (оверлеи) плюс per-record `preview`, который
 * побеждает — в том числе явным `mode: 'live'`, снимающим запрет.
 */
function buildPreviewPolicy(records: CatalogRecord[]): ReadonlyMap<string, KitRecordPreview> {
  const map = legacyPreviewPolicy();
  for (const r of records) {
    if (r.preview) map.set(r.name, r.preview);
  }
  return map;
}

/**
 * Причины «компонента нет в namespace»: дефолты билдера (subpath-only записи ui-kit) плюс записи,
 * объявившие `subpath` — раз символ живёт за subpath, понятно, почему его нет в barrel.
 */
function buildUnresolvedReasons(records: CatalogRecord[]): ReadonlyMap<string, string> {
  const map = legacyUnresolvedReasons();
  for (const r of records) {
    if (r.subpath) map.set(r.name, `subpath-only: ${r.subpath}`);
  }
  return map;
}

/**
 * Множество компонентов-листьев: дефолты билдера плюс per-record `leaf`. Явный `leaf: false`
 * убирает запись из множества — так кит может сказать, что его `Progress` детей всё-таки держит.
 */
function buildLeafComponents(records: CatalogRecord[]): ReadonlySet<string> {
  const set = new Set(LEAF_COMPONENT_NAMES);
  for (const r of records) {
    if (r.leaf === true) set.add(r.name);
    else if (r.leaf === false) set.delete(r.name);
  }
  return set;
}

/**
 * Разрешённые группы классов по записям: точечный `classGroups` записи, иначе правило роли
 * `kit.styles.classGroupsByRole`, иначе ограничений нет.
 *
 * Ключ заводится ТОЛЬКО когда ограничение есть: отсутствие ключа = весь словарь кита, пустое
 * множество = разрешённых групп нет. Синтетические записи билдера (`$html(*)`, `FormArray`,
 * `Wizard`, `Step`) приходят сюда наравне с записями кита и проходят то же правило — своего
 * `classGroups` у них нет, а роли `container`/`array` при типовом `'*'` ключа не создают.
 */
function buildClassGroupPolicy(
  records: CatalogRecord[],
  styles: KitStyles | undefined
): ReadonlyMap<string, ReadonlySet<string>> {
  const byRole = styles?.classGroupsByRole ?? {};
  const map = new Map<string, ReadonlySet<string>>();
  for (const r of records) {
    const rule = r.classGroups ?? byRole[r.role];
    if (rule === undefined || rule === '*') continue;
    map.set(r.name, new Set(rule));
  }
  return map;
}

/**
 * Собрать дескриптор активного кита из каталога-JSON.
 *
 * @param json каталог по контракту `component-catalog.schema.json` (версии `1.0` — без блока
 *   `kit` — и `2.0` обрабатываются одинаково: отсутствующие поля берутся из дефолтов).
 */
export function toDescriptor(json: CatalogJson): KitDescriptor {
  const kit: KitDescriptorJson = json.kit ?? {};
  const records = json.components ?? [];

  const pkg = kit.package ?? LEGACY_KIT.package;

  return {
    id: kit.id ?? LEGACY_KIT.id,
    label: kit.label ?? LEGACY_KIT.label,
    package: pkg,
    version: kit.version ?? UNKNOWN_KIT_VERSION,
    peerRanges: kit.peerRanges ?? {},
    resolve: {
      fieldSuffix: kit.resolve?.fieldSuffix ?? LEGACY_KIT.resolve.fieldSuffix!,
    },
    infra: {
      fieldWrapper: kit.infra?.fieldWrapper ?? LEGACY_KIT.infra.fieldWrapper!,
      asyncBoundary: kit.infra?.asyncBoundary ?? LEGACY_KIT.infra.asyncBoundary!,
      list: kit.infra?.list ?? LEGACY_KIT.infra.list!,
    },
    adapters: kit.adapters ?? LEGACY_KIT.adapters,
    palette: {
      // Категории кит владеет целиком: смешивать карту чужого кита с картой ui-kit бессмысленно.
      // Клиентский конфиг (`palette.categoryByName`) по-прежнему накладывается сверху в `contract`.
      categoryByName: kit.palette?.categoryByName ?? LEGACY_KIT.palette.categoryByName!,
      ...(kit.palette?.order ? { order: kit.palette.order } : {}),
      ...(kit.palette?.glyphs ? { glyphs: kit.palette.glyphs } : {}),
    },
    styles: {
      mode: kit.styles?.mode ?? LEGACY_KIT.styles.mode!,
      // Словарь классов целиком за китом: своего у билдера нет. Пусто = подсказок не будет.
      classNames: kit.styles?.classNames ?? [],
      ...(kit.styles?.href ? { href: kit.styles.href } : {}),
      ...(kit.styles?.classGroupsByRole ? { classGroupsByRole: kit.styles.classGroupsByRole } : {}),
    },
    codegen: {
      // Если кит назвал пакет, но не назвал спецификатор импорта — импортируем из пакета.
      importSpecifier: kit.codegen?.importSpecifier ?? pkg,
      needsShim: kit.codegen?.needsShim ? new Set(kit.codegen.needsShim) : NEEDS_SHIM,
    },
    previewPolicy: buildPreviewPolicy(records),
    unresolvedReason: buildUnresolvedReasons(records),
    leafComponents: buildLeafComponents(records),
    classGroupPolicy: buildClassGroupPolicy(records, kit.styles),
    // Перенос COMPOUND_TEMPLATES из `catalog/make-node` в дескриптор — этап 2.
    // `undefined` означает «использовать встроенные шаблоны билдера».
    compoundTemplates: undefined,
  };
}

/**
 * Имя экспорта в namespace кита для записи каталога: точечный `exportName` побеждает, иначе
 * правило кита (`${name}${fieldSuffix}` для полей, имя как есть — для остального).
 *
 * Единый источник правды для превью (`render-policy`) и кодогена (`codegen/ui-kit-imports`),
 * которые сегодня дублируют это правило литералом `${name}Field`.
 */
export function exportNameFor(
  record: Pick<CatalogRecord, 'name' | 'role' | 'exportName'>,
  descriptor: Pick<KitDescriptor, 'resolve'>
): string {
  if (record.exportName) return record.exportName;
  return record.role === 'field' ? `${record.name}${descriptor.resolve.fieldSuffix}` : record.name;
}
