/**
 * Каталог кита — то, что дизайн-система рассказывает о себе: список компонентов и блок `kit`.
 *
 * ## Почему это в SDK
 *
 * Кит больше не под-ось одного стека. Его читают стеки разного устройства: ReFormer строит
 * из каталога палитру и узлы схемы, RJSF — тему, превью — рамку с провайдером кита. А ставит
 * кит внешний плагин, который видит только SDK. Контракт, объявленный внутри одного стека,
 * отрезал бы от кита и других читателей, и тех, кто кит поставляет.
 *
 * Здесь только ДАННЫЕ, как они лежат в `component-catalog.json`. То, что из них выводит
 * конкретный стек (узлы по умолчанию, синтетические записи, категории палитры), — дело стека.
 *
 * ## Версии контракта
 *
 * `1.0` — только записи; `2.0` — блок `kit` и поля записей `exportName`/`subpath`/`preview`/
 * `leaf`/`palette`/`classGroups`; `2.1` — `kit.infra.fieldFrame` и `kit.renderers`. Всё
 * добавленное необязательно, поэтому старшая версия читает младшие без переходников.
 *
 * `3.0` — протокол визарда: символ под `kit.adapters.wizard` — компонент по
 * {@link KitWizardProtocol} (шаги — узлы-дети данными, отрисовка — `renderNode`, форма и поток
 * шагов — из контекста сборки). Шима визарда больше нет, и `kit.codegen.needsShim` смысла не
 * несёт: поле читается из каталогов прежних версий и ни на что не влияет. Мажор — потому что
 * поменялся смысл `adapters.wizard`: визард кита, написанный под шим, без протокола работать
 * перестанет. Кит без визарда (`wizard: null`) не меняется.
 *
 * Модуль — лист графа: только типы и константы, без React и без рантайма платформы.
 *
 * @module @reformer/builder-plugin-api/kits/catalog
 */

/** Текущая версия контракта каталога. Не путать с версией пакета кита (`kit.version`). */
export const CATALOG_CONTRACT_VERSION = '3.0';

/** Версии контракта, которые принимает платформа. `1.0` поддерживается бессрочно. */
export const SUPPORTED_CATALOG_CONTRACT_VERSIONS: readonly string[] = ['1.0', '2.0', '2.1', '3.0'];

/** Роль записи: поле формы (несёт значение), контейнер (держит детей), повторяющийся блок. */
export type CatalogRole = 'field' | 'container' | 'array';

/**
 * JSON Schema редактируемых пропсов компонента.
 *
 * Структуру контракт не навязывает — проверяется только, что это объект. Словарь расширений
 * (`x-doc`, `x-runtimeProps`) принадлежит киту и тем, кто его читает, поэтому тип открытый:
 * сузить его до своей формы обязан читатель.
 */
export type CatalogPropsSchema = { readonly [keyword: string]: unknown };

/**
 * Пространство имён кита — сами компоненты: имя экспорта → значение. Достаточно, чтобы нужный
 * экспорт в объекте был, из главного входа он пришёл или из подпути — неважно.
 */
export type KitNamespace = Record<string, unknown>;

/**
 * Требования кита к общему рантайму хоста. Подсказка, а не проверка: решение об активации
 * принимает проверка символов, а открытые диапазоны (`>=1.0.0`) реальный контракт не выражают.
 */
export type KitPeerRanges = Record<string, string>;

/** Имена компонентов вне палитры, без которых стекам нечем рисовать форму. */
export interface KitInfra {
  /** Обёртка поля (реестр renderer-json зовёт её `FIELD_WRAPPER`). */
  fieldWrapper?: string;
  /** Граница асинхронной загрузки. */
  asyncBoundary?: string;
  /** Обёртка списка, которой схемы адресуют повторяющиеся узлы. */
  list?: string;
  /**
   * Рамка поля: подпись, описание, ошибки вокруг произвольного контрола (контракт `2.1`).
   * Пропсы — {@link KitFieldFrameProps}. Нужна стекам, которые кладут в рамку свой контрол:
   * тема RJSF строит на ней шаблон поля.
   */
  fieldFrame?: string;
}

/**
 * Символ кита под адаптером и подпуть, откуда он импортируется, если его нет в главном входе
 * (смысл тот же, что у `subpath` записи — см. {@link CatalogRecord.subpath}).
 */
export interface KitAdapter {
  symbol: string;
  subpath?: string;
}

/**
 * Узел шага, каким его получает визард: узел скомпилированной схемы формы. Визард читает
 * `selector` (по нему шаг схемы связан с шагом потока `flow.steps[].id`) и `props` (подпись
 * шага); остальное — дело рендерера, узел целиком уходит обратно в `renderNode`.
 */
export interface KitWizardStepNode {
  readonly selector?: string;
  readonly props?: { readonly [prop: string]: unknown };
  readonly children?: readonly unknown[];
}

/**
 * Пропсы, которые рендерер формы передаёт визарду кита по протоколу (контракт `3.0`). Тип
 * отрисованного узла открыт (`unknown`): SDK не тянет React, у кита это `ReactNode`.
 */
export interface KitWizardProps<TNode extends KitWizardStepNode = KitWizardStepNode> {
  /** Узлы шагов — данными, а не отрисованными элементами. */
  readonly children: readonly TNode[];
  /** Отрисовать узел схемы (шаг или его часть) средствами рендерера. */
  readonly renderNode: (node: TNode, key?: string | number) => unknown;
}

/**
 * Протокол визарда кита (контракт `3.0`). Символ под {@link KitAdapters.wizard} — компонент,
 * который:
 *
 * 1. несёт статику `__selfManagedChildren = true` — по ней рендерер отдаёт ему шаги данными,
 *    вместе с `renderNode` ({@link KitWizardProps});
 * 2. форму, проверку шагов и поток берёт из контекста сборки — `useFormBundleContext()` из
 *    `@reformer/core/react` (`bundle.form`, `bundle.flow`, `bundle.validateStep`), а не
 *    из пропсов;
 * 3. связывает шаг схемы с шагом потока по `selector` узла.
 *
 * Реализация-образец — `FormWizard` из `@reformer/ui-kit`. Прежний шим (переходник
 * приложения, которому визард отдавался по имени из `codegen.needsShim`) снят: визард,
 * написанный под него, получит детей отрисованными элементами и шагов не найдёт.
 */
export interface KitWizardProtocol {
  readonly __selfManagedChildren: true;
}

/** Адаптеры поверх компонентов кита. `null` — кит такого не поставляет. */
export interface KitAdapters {
  /**
   * Пошаговая форма — компонент по протоколу {@link KitWizardProtocol} (контракт `3.0`).
   * `null` — визарда у кита нет; узлы с шагами тогда рисуются заглушкой.
   */
  wizard?: KitAdapter | null;
  /** Шаг пошаговой формы. */
  step?: KitAdapter | null;
  /**
   * Обёртка поддерева, без которой компоненты кита рисуются неправильно: тема
   * styled-components, словарь, конфиг портала. Рамка превью кладёт форму внутрь неё.
   */
  provider?: KitAdapter | null;
}

/** Палитра, как её видит сам кит. */
export interface KitPalette {
  /** Имя компонента → раздел палитры. */
  categoryByName?: Record<string, string>;
  /** Порядок разделов. */
  order?: string[];
  /** Имя компонента → текстовый глиф-бейдж. */
  glyphs?: Record<string, string>;
}

/**
 * Группа классов словаря кита. `id` СТАБИЛЕН: на него ссылаются `classGroups` записей
 * и `classGroupsByRole`, поэтому переименование группы ломает каталог.
 */
export interface KitClassGroup {
  id: string;
  label: string;
  classes: string[];
}

/** «Роль записи → разрешённые группы»: `'*'` — без ограничений, массив — только эти. */
export type KitClassGroupsByRole = Partial<Record<CatalogRole, '*' | string[]>>;

/** Как подключаются стили кита и чем разрешено стилизовать его компоненты. */
export interface KitStyles {
  /**
   * `tokens` — кит на стандартном словаре токенов, достаточно переобъявить их значения;
   * `standalone` — кит поставляет самодостаточный CSS со своими утилитами.
   */
  mode?: 'tokens' | 'standalone';
  /** Адрес самодостаточного CSS (только `standalone`). */
  href?: string;
  /** Словарь классов для подсказок `className`, по группам. Нет — подсказок нет. */
  classNames?: KitClassGroup[];
  /** Умолчание «чем стилизовать» по роли записи; `classGroups` записи его перекрывает. */
  classGroupsByRole?: KitClassGroupsByRole;
}

/** Что подставлять в код, выгруженный из билдера. */
export interface KitCodegen {
  /** Спецификатор пакета в `import { … } from '…'`. По умолчанию — `kit.package`. */
  importSpecifier?: string;
  /**
   * Символы, которым нужна прослойка вместо прямого импорта.
   *
   * @deprecated С контракта `3.0` прослойки нет: визард работает по {@link KitWizardProtocol}.
   * Поле читается из каталогов прежних версий; в каталоге `3.0` его не пишут.
   */
  needsShim?: string[];
}

/**
 * Как кит рисуется под RJSF (контракт `2.1`). Всё необязательно: без блока тема строится
 * сопоставлением по умолчанию, блок его уточняет.
 */
export interface KitRjsfRenderers {
  /** Виджет RJSF → имя компонента кита (`TextWidget` → `Input`). */
  widgets?: Record<string, string>;
  /** Шаблоны RJSF → имя компонента кита. */
  templates?: {
    /** Шаблон поля; по умолчанию — `kit.infra.fieldFrame`. */
    field?: string;
    /** Шаблон объекта. */
    object?: string;
    /** Кнопка отправки. */
    submit?: string;
  };
}

/** Подсказки киту для стеков, которые рисуют его своими средствами (контракт `2.1`). */
export interface KitRenderers {
  rjsf?: KitRjsfRenderers;
}

/** Ограничение живого превью записи. */
export interface KitRecordPreview {
  /** `limited` — вместо компонента рисуется подписанная заглушка. */
  mode: 'live' | 'limited';
  /** Причина ограничения — её показывает заглушка. */
  reason?: string;
}

/**
 * Блок `kit` каталога — дескриптор кита, как его поставил кит.
 *
 * Необязательно всё, но кит без `id` платформа принять не может: идентификатор — ключ выбора
 * и попадает в настройки. Недостающее достраивает {@link toDescriptor} умолчаниями платформы.
 */
export interface KitDescriptorJson {
  /** Стабильный идентификатор, независимый от имени пакета (`reformer-ui-kit`). */
  id?: string;
  /** Имя для переключателя китов. */
  label?: string;
  /** Имя npm-пакета. */
  package?: string;
  /** Версия ПАКЕТА кита (версия контракта — поле `version` каталога). */
  version?: string;
  peerRanges?: KitPeerRanges;
  infra?: KitInfra;
  adapters?: KitAdapters;
  palette?: KitPalette;
  styles?: KitStyles;
  codegen?: KitCodegen;
  renderers?: KitRenderers;
}

/** Запись каталога — один компонент кита. */
export interface CatalogRecord {
  /** Имя компонента в схеме формы. */
  name: string;
  role: CatalogRole;
  /** Раздел палитры, если кит назначает его записи сам. */
  category?: string;
  propsSchema: CatalogPropsSchema;
  /** Имя группы вариантов; её умолчание — член, чей `name` совпадает с группой. */
  variantGroup?: string;
  /** Подпись варианта в группе. */
  variant?: string;
  /** Корень составного компонента, частью которого запись является (`AlertTitle` → `Alert`). */
  compoundParent?: string;
  /** Имя экспорта, если оно отличается от `name` (`Checkbox` → `CheckboxWithLabel`). */
  exportName?: string;
  /**
   * Подпуть кита, ОТКУДА ИМПОРТИРУЕТСЯ символ записи, когда его нет в главном входе:
   * `<спецификатор кита>/<subpath>` (`@acme/ds` + `chart` → `@acme/ds/chart`).
   *
   * Больше поле не значит ничего. Кодоген печатает импорт с подпутя; превью рисует компонент
   * вживую, если символ есть в пространстве имён кита, и заглушкой — если нет. Запретить
   * живой рендер умеет только {@link preview}.
   */
  subpath?: string;
  /** Ограничение живого превью. */
  preview?: KitRecordPreview;
  /** Лист: самодостаточный визуал, детей не держит. */
  leaf?: boolean;
  /**
   * `false` — запись ради полноты данных (пропсы для документации и инспектора), а не узел
   * палитры. Отсутствие равно `true`.
   */
  palette?: boolean;
  /**
   * Группы словаря, которыми разрешено стилизовать компонент. Отсутствие НЕ равно `[]`:
   * отсутствие отдаёт решение правилу роли, пустой массив — разрешённых групп нет.
   */
  classGroups?: string[];
}

/** Каталог кита по контракту `component-catalog.schema.json`. */
export interface CatalogJson {
  /** Версия КОНТРАКТА каталога. */
  version: string;
  components: CatalogRecord[];
  kit?: KitDescriptorJson;
}
