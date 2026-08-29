/**
 * Контракт шаблонов форм: модель шаблона, ХРАНИЛИЩЕ как интерфейс и точка расширения хранилищ.
 *
 * ## Здесь поднят до интерфейса единственный ресурс билдера с двумя бэкендами
 *
 * В v1 шаблоны обслуживали два разных бэкенда — каталог проекта и IndexedDB, — и это было
 * единственное такое место во всём билдере. Общего у них было ровно всё: одна модель
 * {@link FormTemplate}, один дискриминатор `source`, один набор операций. Общим не было
 * НИЧЕГО в коде: `io/template-repo.ts` объявлял шесть свободных функций с суффиксами
 * (`loadProjectTemplates`/`loadLocalTemplates`, `saveProjectTemplate`/`saveLocalTemplate`,
 * `deleteProjectTemplate`/`deleteLocalTemplate`), а выбирал между ними `if (source === 'project')`
 * в четырёх местах `app/template-actions.ts` — каждый со своей проверкой «а проект-то открыт».
 *
 * Цена такой раскладки видна на третьем бэкенде: чтобы добавить шаблоны из общего репозитория
 * команды, пришлось бы дописать шестую пару функций и пятый `if`. Здесь третий бэкенд — это
 * вклад в точку расширения, и ни одна существующая строка не меняется.
 *
 * ## Запись выражена наличием методов, а не флагом
 *
 * `writable: boolean` рядом с необязательными методами дал бы два источника истины и класс
 * ошибок «флаг есть, метода нет». Поэтому доступность записи — это ПРИСУТСТВИЕ методов,
 * а {@link isWritable} — сужение типа, а не проверка настроения.
 *
 * @module plugins/templates/contract
 */

/** Откуда шаблон: напечатан билдером, лежит в каталоге проекта, сохранён локально в браузере. */
export type TemplateSource = 'builtin' | 'project' | 'local';

/** Один файл шаблона. */
export interface TemplateFile {
  /** Путь относительно корня шаблона; может нести плейсхолдеры имени формы. */
  readonly path: string;
  /** Содержимое с плейсхолдерами вместо имени формы. */
  readonly content: string;
}

/** Шаблон формы. */
export interface FormTemplate {
  /** Имя каталога (project), ключ хранилища (local), фиксированный slug (builtin). */
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly source: TemplateSource;
  readonly files: readonly TemplateFile[];
  /**
   * Зависимости между файлами: отметка файла в диалоге тянет перечисленные. Есть у встроенных
   * (страница не соберётся без модели и реестра); пользовательские обычно без ограничений.
   */
  readonly requires?: Readonly<Record<string, readonly string[]>>;
  /** Человеческие подписи файлов; без записи показывается сам путь. */
  readonly labels?: Readonly<Record<string, string>>;
  /** ISO-время создания — для сортировки; у встроенных отсутствует. */
  readonly createdAt?: string;
}

/** Метаданные шаблона в проекте — файл рядом с файлами шаблона. */
export interface TemplateManifest {
  readonly version: string;
  readonly name: string;
  readonly description?: string;
  /** Имя, по которому проставлялись плейсхолдеры — справочно, для правки шаблона руками. */
  readonly baseName?: string;
  readonly createdAt?: string;
  readonly requires?: Record<string, string[]>;
}

/** Имя файла-манифеста в каталоге шаблона (в состав файлов шаблона не входит). */
export const TEMPLATE_MANIFEST = 'template.json';

/** Текущая версия формата манифеста. */
export const TEMPLATE_MANIFEST_VERSION = '1.0';

/**
 * Хранилище шаблонов — один бэкенд одного вида.
 *
 * Читать умеют все, писать — не все, и это выражено типом. Отказ хранилища (проект не открыт,
 * IndexedDB недоступна) — это ПУСТОЙ список, а не бросок: панель, падающая из-за закрытого
 * проекта, не показала бы и встроенные шаблоны.
 */
export interface TemplateStore {
  /** Вид, к которому относятся его шаблоны. Он же — заголовок группы в панели. */
  readonly source: TemplateSource;
  /** Доступно ли хранилище прямо сейчас (проект открыт, движок есть). */
  available(): boolean;
  list(): Promise<readonly FormTemplate[]>;
  save?(template: FormTemplate, baseName?: string): Promise<FormTemplate>;
  update?(template: FormTemplate): Promise<void>;
  remove?(id: string): Promise<void>;
}

/**
 * Три отдельные проверки вместо одного `writable`, и разница не косметическая.
 *
 * Проектное хранилище УМЕЕТ сохранять и переименовывать, но НЕ умеет удалять: у рабочей области
 * нет удаления вовсе, а `Source.remove` до неё не проброшен (см. `./host`). Один флаг заставил
 * бы соврать в любую сторону — либо спрятать работающее сохранение, либо предложить удаление,
 * которое отказывает нажатием. Возможности разные, значит и вопросов три.
 */
export type SavingStore = TemplateStore & Required<Pick<TemplateStore, 'save'>>;
export type UpdatingStore = TemplateStore & Required<Pick<TemplateStore, 'update'>>;
export type RemovingStore = TemplateStore & Required<Pick<TemplateStore, 'remove'>>;

/** Принимает ли хранилище новые шаблоны. */
export function canSave(store: TemplateStore): store is SavingStore {
  return typeof store.save === 'function';
}

/** Умеет ли переписывать метаданные (переименование, описание). */
export function canUpdate(store: TemplateStore): store is UpdatingStore {
  return typeof store.update === 'function';
}

/** Умеет ли удалять. */
export function canRemove(store: TemplateStore): store is RemovingStore {
  return typeof store.remove === 'function';
}

/**
 * Типизированное имя точки расширения — структурная копия `host/primitives/extension-point`.
 *
 * Та же минимальная копия, что в контракте кодогена, и по той же причине: `@/sdk` точки не
 * отдаёт, `defineExtensionPoint` оттуда не экспортируется, а реестр ключуется по `id`.
 */
export interface ExtensionPointRef<T> {
  readonly id: string;
  readonly __type?: T;
}

/**
 * Точка расширения хранилищ шаблонов.
 *
 * Именно она отвечает на вопрос «а что если бэкендов станет три»: они уже три, и добавление
 * четвёртого — вклад, а не правка.
 */
export const TemplateStorePoint: ExtensionPointRef<TemplateStore> = Object.freeze({
  id: 'templates.store',
});
