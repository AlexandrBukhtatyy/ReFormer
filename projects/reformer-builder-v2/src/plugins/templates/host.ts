/**
 * Порт платформы для шаблонов: ровно то, чем они пользуются, и ничего сверх.
 *
 * ## Два бэкенда — две части порта, и обе необязательные
 *
 * Шаблоны — единственный ресурс билдера, который обслуживают ДВА разных бэкенда: каталог
 * проекта и локальное хранилище браузера. Порт это признаёт прямо: файловая часть
 * (`list`/`readText`/`writeText`) и {@link TemplateKeyValue} объявлены отдельно, и каждая
 * может отсутствовать. Отсутствие любой — не поломка, а меньший набор источников: без проекта
 * остаются встроенные и локальные, без хранилища браузера — встроенные и проектные.
 *
 * ## Записи мимо рабочей области здесь тоже нет
 *
 * Тот же запрет, что у кодогена: `io/template-repo.ts` в v1 принимал `FileSystemDirectoryHandle`
 * и ходил на диск напрямую. Здесь адреса строит платформа, а куда они ведут — решает источник.
 *
 * @module plugins/templates/host
 */

import type { CatalogEntry } from '@/lib/catalog/types';
import type { KitDescriptor } from '@/lib/kits/types';
import type { Disposable, ResourceId, ResourceRef } from '@/sdk';

/** Перевод: ключ и параметры. Совпадает по форме с `I18nService.t`. */
export type Translate = (key: string, params?: Record<string, unknown>) => string;

/** Приёмник словаря: `PluginI18n.contribute` в объёме, которым пользуется плагин. */
export interface MessageSink {
  contribute(locale: string, messages: Readonly<Record<string, string>>): void;
}

/**
 * Ключ-значение для локальных шаблонов.
 *
 * Намеренно НЕ «IndexedDB»: хранилище выбирает композиция, а плагину важно только то, что
 * записанное переживает перезагрузку и не зависит от открытого проекта. В v1 здесь стояло
 * прямое обращение к `idbTx(TEMPLATES_STORE, …)`, и подменить его в тесте было нечем.
 */
export interface TemplateKeyValue {
  keys(): Promise<readonly string[]>;
  get(key: string): Promise<unknown>;
  put(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
}

/** Возможности источника — в объёме одного вопроса: принимает ли он запись. */
export interface TemplatesSourceCapabilities {
  readonly write: boolean;
}

/** Всё, что плагин шаблонов получает от композиции. */
export interface TemplatesHost {
  /** Реактивный перевод в пространстве имён плагина. */
  useTranslate(): Translate;

  /** Документ активной вкладки или `null`: рядом с ним предлагается создать форму. */
  useActiveDocument(): ResourceId | null;

  /** Ссылка на ресурс или `null`. Нужна ради имени и пути — их показывает панель. */
  refOf(id: ResourceId): ResourceRef | null;

  /** Корень открытого проекта или `null`. От него отсчитывается каталог шаблонов. */
  projectRoot(): ResourceId | null;

  /** Каталог ресурса — место, рядом с которым появится новая форма. */
  parentOf(id: ResourceId): ResourceId;

  /** Собрать адрес внутри каталога. Сегменты нормализуются платформой. */
  resolve(dir: ResourceId, ...segments: readonly string[]): ResourceId;

  /** Один уровень каталога. Рекурсию плагин делает сам: правило отбора файлов — его. */
  list(dir: ResourceId): Promise<readonly ResourceRef[]>;

  /** Есть ли такой ресурс. */
  exists(id: ResourceId): Promise<boolean>;

  /** Текст рабочей копии либо `null`, если ресурса нет. */
  readText(id: ResourceId): Promise<string | null>;

  /** Пишет в рабочую копию. В источник не пишет — для этого есть `save`. */
  writeText(id: ResourceId, text: string): Promise<void>;

  /**
   * Удалить ресурс.
   *
   * НЕОБЯЗАТЕЛЕН вынужденно, и это дыра контракта, а не выбор: у рабочей области нет удаления
   * вовсе (`Workspace` умеет `open/close/read/write/stat/list/save/revert`), а `Source.remove`
   * до неё не проброшен. Пока метода нет, проектный шаблон не удаляется из панели — только
   * руками в файловой системе, и панель об этом честно молчать не должна.
   */
  remove?(id: ResourceId): Promise<void>;

  /** Возможности источника ресурса. `null` — источника нет. */
  sourceOf(id: ResourceId): TemplatesSourceCapabilities | null;

  /** Отправляет записанное в источник. Без него созданное остаётся рабочей копией. */
  save?(ids: readonly ResourceId[]): Promise<boolean>;

  /**
   * Забыть прочитанный уровень каталога: его содержимое изменилось.
   *
   * Дерево ресурсов читает уровни ЛЕНИВО и помнит прочитанное — наблюдения за файловой
   * системой у File System Access нет вовсе. Поэтому каталог, созданный записью
   * ({@link TemplatesHost.writeText} + {@link TemplatesHost.save}), в дереве не появляется
   * сам: там всё ещё лежит прошлый листинг родителя. Операции над записями это делают
   * своим `invalidate` (`host/workspace/resource-ops`), а шаблоны пишут в обход них —
   * значит и говорить об этом обязаны сами.
   *
   * Необязателен: без него форма создаётся целиком и правильно, но увидеть её в дереве
   * можно только перечитыванием уровня руками.
   */
  invalidate?(dir: ResourceId): Promise<void>;

  /** Показать ресурс: открыть вкладку или сделать активной уже открытую. */
  openResource?(id: ResourceId): void;

  /** Локальное хранилище. Без него локальных шаблонов просто нет. */
  readonly local?: TemplateKeyValue;

  /** Каталог активного кита — нужен встроенным шаблонам, которые печатает кодоген. */
  catalog(): readonly CatalogEntry[];

  /** Дескриптор активного кита. `null` — встроенных шаблонов не будет: печатать нечем. */
  kit(): KitDescriptor | null;

  /** Кит сменился: встроенные шаблоны надо перечитать — они печатаются под кит. */
  onDidChangeKit(cb: () => void): Disposable;
}
