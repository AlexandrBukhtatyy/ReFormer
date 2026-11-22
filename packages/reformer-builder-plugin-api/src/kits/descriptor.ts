/**
 * Дескриптор кита: блок `kit` каталога, достроенный умолчаниями платформы, плюс сводки по записям.
 *
 * ## Умолчания — только общие
 *
 * Здесь нет знания ни об одном конкретном ките. Раньше «неявный кит» достраивал каталог без
 * блока `kit` таблицами `@reformer/ui-kit` (категории палитры, оверлеи, листья, прослойки
 * визарда), и кит, не назвавший себя, притворялся встроенным. Теперь встроенный кит объявляет
 * всё это о себе сам, в своём каталоге, а платформа достраивает лишь то, что верно для любого
 * кита: пустые карты, стили на токенах, имена инфраструктуры по соглашению.
 *
 * ## Сводки по записям
 *
 * Политику превью, подпути, листья и группы классов читают на каждом узле формы, поэтому они
 * собираются один раз — картами по имени записи, а не обходом каталога на каждый вопрос.
 *
 * ## Подпуть — это только «откуда импортируется»
 *
 * `subpath` записи отвечает на один вопрос: из какого входа пакета кита берётся её символ
 * (`<спецификатор кита>/<подпуть>`). Что с этим делать, решает потребитель и решает по факту:
 * кодоген печатает импорт с подпутя, превью рисует компонент вживую, если символ ЕСТЬ в
 * пространстве имён кита, и заглушкой — если его там нет. Сам по себе подпуть не делает
 * компонент ни «неразрешимым», ни заглушкой: пространство имён вправе собрать кит из главного
 * входа и любых подпутей, и встроенный кит так и делает для своих полей.
 *
 * @module @reformer/builder-plugin-api/kits/descriptor
 */

import type {
  CatalogJson,
  CatalogRecord,
  KitAdapters,
  KitCodegen,
  KitInfra,
  KitPalette,
  KitPeerRanges,
  KitRecordPreview,
  KitRenderers,
  KitStyles,
} from './catalog.js';

/** Версия кита, когда он её не сообщил: пакет взят из рабочей копии, и номер недостоверен. */
export const UNKNOWN_KIT_VERSION = 'workspace';

/**
 * Имена инфраструктуры по соглашению renderer-json. Кит, назвавший свои компоненты так же,
 * может их не объявлять; кит с другими именами объявляет их в `kit.infra`.
 */
export const CONVENTIONAL_KIT_INFRA: Readonly<Required<KitInfra>> = Object.freeze({
  fieldWrapper: 'FormField',
  asyncBoundary: 'AsyncBoundary',
  list: 'List',
  fieldFrame: 'FieldFrame',
});

/**
 * Разрешённый дескриптор: то же, что блок `kit`, но всё, от чего зависит рантайм, заполнено —
 * потребителю не нужно проверять `undefined` на каждом шагу.
 */
export interface KitDescriptor {
  /** Идентификатор кита. Пустая строка — кит себя не назвал (такой реестр не примет). */
  id: string;
  label: string;
  package: string;
  version: string;
  peerRanges: KitPeerRanges;
  infra: Required<KitInfra>;
  adapters: KitAdapters;
  palette: Required<Pick<KitPalette, 'categoryByName'>> & KitPalette;
  styles: Required<Pick<KitStyles, 'mode' | 'classNames'>> & KitStyles;
  codegen: Required<Pick<KitCodegen, 'importSpecifier'>> & { needsShim: ReadonlySet<string> };
  renderers: KitRenderers;
  /**
   * ЗАПРЕТ живого рендера: имя записи → политика. Проверяется ДО поиска компонента, поэтому
   * оверлей не отрисуется, даже если он есть в пространстве имён: корень без триггера рисует
   * невидимый узел, и подписанная заглушка честнее.
   */
  previewPolicy: ReadonlyMap<string, KitRecordPreview>;
  /**
   * ОТКУДА ИМПОРТИРУЕТСЯ символ записи: имя записи → подпуть кита. Нет ключа — символ лежит
   * в главном входе. Спецификатор импорта — `<codegen.importSpecifier>/<подпуть>`.
   *
   * Это факт о пакете кита, а не решение о рендере: рисовать ли компонент вживую, говорит
   * пространство имён (символ в нём либо есть, либо нет), а не наличие ключа здесь.
   */
  subpaths: ReadonlyMap<string, string>;
  /**
   * @deprecated Прежняя сводка подпутей: имя записи → текст `subpath-only: <подпуть>`. Она
   * читалась как «компонент за подпутём не резолвится», и кодоген по ней печатал заглушку
   * вместо импорта. Подпуть значит только «откуда импортируется» — берите {@link subpaths},
   * а причину заглушки формулируйте по факту отсутствия символа в пространстве имён.
   * Заполняется как прежде, чтобы не ломать читателей.
   */
  unresolvedReason: ReadonlyMap<string, string>;
  /** Имена компонентов-листьев. */
  leafComponents: ReadonlySet<string>;
  /**
   * Имя записи → РАЗРЕШЁННЫЕ группы классов. Нет ключа — ограничений нет (весь словарь кита),
   * пустое множество — разрешённых групп нет.
   */
  classGroupPolicy: ReadonlyMap<string, ReadonlySet<string>>;
}

/** Запреты живого рендера — те, что записи объявили сами. */
function buildPreviewPolicy(
  records: readonly CatalogRecord[]
): ReadonlyMap<string, KitRecordPreview> {
  const map = new Map<string, KitRecordPreview>();
  for (const record of records) {
    if (record.preview) map.set(record.name, record.preview);
  }
  return map;
}

/** Подпути записей: откуда импортируется символ, если не из главного входа. */
function buildSubpaths(records: readonly CatalogRecord[]): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const record of records) {
    if (record.subpath) map.set(record.name, record.subpath);
  }
  return map;
}

/** Прежняя сводка подпутей текстом — для читателей `unresolvedReason` (см. его описание). */
function buildUnresolvedReasons(
  subpaths: ReadonlyMap<string, string>
): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const [name, subpath] of subpaths) map.set(name, `subpath-only: ${subpath}`);
  return map;
}

/** Листья — записи, объявившие себя листом. */
function buildLeafComponents(records: readonly CatalogRecord[]): ReadonlySet<string> {
  const set = new Set<string>();
  for (const record of records) {
    if (record.leaf === true) set.add(record.name);
  }
  return set;
}

/**
 * Разрешённые группы классов: `classGroups` записи, иначе правило роли, иначе ограничений нет.
 *
 * Ключ заводится ТОЛЬКО когда ограничение есть: отсутствие ключа — весь словарь, пустое
 * множество — ничего. Записи, которые стек добавляет к каталогу кита сам, проходят то же
 * правило роли, если стек собирает дескриптор по дополненному каталогу.
 */
function buildClassGroupPolicy(
  records: readonly CatalogRecord[],
  styles: KitStyles | undefined
): ReadonlyMap<string, ReadonlySet<string>> {
  const byRole = styles?.classGroupsByRole ?? {};
  const map = new Map<string, ReadonlySet<string>>();
  for (const record of records) {
    const rule = record.classGroups ?? byRole[record.role];
    if (rule === undefined || rule === '*') continue;
    map.set(record.name, new Set(rule));
  }
  return map;
}

/**
 * Собрать дескриптор кита из его каталога.
 *
 * Чистая функция: ни кэша, ни состояния. Каталог без блока `kit` законен (версия `1.0`) и даёт
 * дескриптор с пустым `id` — принять такой кит реестр откажется, но разобрать его можно.
 */
export function toDescriptor(json: CatalogJson): KitDescriptor {
  const kit = json.kit ?? {};
  const records = json.components ?? [];
  const id = kit.id ?? '';
  const pkg = kit.package ?? '';
  const subpaths = buildSubpaths(records);

  return {
    id,
    label: kit.label ?? id,
    package: pkg,
    version: kit.version ?? UNKNOWN_KIT_VERSION,
    peerRanges: kit.peerRanges ?? {},
    infra: {
      fieldWrapper: kit.infra?.fieldWrapper ?? CONVENTIONAL_KIT_INFRA.fieldWrapper,
      asyncBoundary: kit.infra?.asyncBoundary ?? CONVENTIONAL_KIT_INFRA.asyncBoundary,
      list: kit.infra?.list ?? CONVENTIONAL_KIT_INFRA.list,
      fieldFrame: kit.infra?.fieldFrame ?? CONVENTIONAL_KIT_INFRA.fieldFrame,
    },
    adapters: kit.adapters ?? {},
    palette: {
      categoryByName: kit.palette?.categoryByName ?? {},
      ...(kit.palette?.order ? { order: kit.palette.order } : {}),
      ...(kit.palette?.glyphs ? { glyphs: kit.palette.glyphs } : {}),
    },
    styles: {
      mode: kit.styles?.mode ?? 'tokens',
      // Словарь классов целиком за китом: своего у платформы нет. Пусто — подсказок не будет.
      classNames: kit.styles?.classNames ?? [],
      ...(kit.styles?.href ? { href: kit.styles.href } : {}),
      ...(kit.styles?.classGroupsByRole ? { classGroupsByRole: kit.styles.classGroupsByRole } : {}),
    },
    codegen: {
      // Кит назвал пакет, но не спецификатор импорта — импортируем из пакета.
      importSpecifier: kit.codegen?.importSpecifier ?? pkg,
      needsShim: new Set(kit.codegen?.needsShim ?? []),
    },
    renderers: kit.renderers ?? {},
    previewPolicy: buildPreviewPolicy(records),
    subpaths,
    unresolvedReason: buildUnresolvedReasons(subpaths),
    leafComponents: buildLeafComponents(records),
    classGroupPolicy: buildClassGroupPolicy(records, kit.styles),
  };
}

/**
 * Имя экспорта записи в пространстве имён кита: `exportName`, иначе `name` как есть.
 *
 * Неявного правила «имя + суффикс» контракт не задаёт: запись, чей символ называется иначе
 * (`Checkbox` → `CheckboxWithLabel`), называет его сама.
 */
export function exportNameFor(record: Pick<CatalogRecord, 'name' | 'exportName'>): string {
  return record.exportName ?? record.name;
}
