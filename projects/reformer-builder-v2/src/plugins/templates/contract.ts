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

/**
 * Чем шаблон подставляет имя формы.
 *
 * Умолчание (поле не задано) — ТОКЕНЫ: `__FormName__` и три его написания. Оно и остаётся
 * умолчанием, потому что снимок каталога производит именно такие шаблоны, а для чужих
 * файлов проекта (стили, конфиги) подстановка честнее шаблона, который их автор не писал.
 *
 * `'eta'` — тот же шаблонизатор, на котором написаны цели кодогена: циклы, ветвления и,
 * если шаблон несёт схему формы, весь вид генерации. Смеси нет: либо токены, либо движок,
 * иначе в одном файле оказалось бы два правила подстановки и вопрос, что применяется
 * раньше, у которого нет хорошего ответа.
 */
export type TemplateEngine = 'eta';

/**
 * Куда файл шаблона ложится при создании формы.
 *
 * Появилось вместе с фикстурой предпросмотра. Её адрес выводится не из каталога шаблона,
 * а из пути ЗАПИСАННОЙ схемы — до применения неизвестно, куда форму положат. Сегодня этот
 * адрес совпадает с каталогом модуля (фикстура лежит рядом с формой), и всё же путь считается
 * отдельно: место фикстуры — предметное знание `lib/form-fixture`, а не запись в шаблоне.
 *
 * Поэтому размещение — свойство ФАЙЛА, а не всего шаблона: файлы модуля адресуются от каталога
 * формы, фикстура — от пути её схемы.
 */
export type TemplateFileScope =
  /** В каталог создаваемой формы. Умолчание — так ложатся все файлы модуля. */
  | 'form'
  /**
   * Фикстура: адрес считается от пути записанной схемы (`fixtureDirOf`) при ПРИМЕНЕНИИ —
   * до него неизвестно, куда ляжет сама форма.
   */
  | 'fixture';

/** Один файл шаблона. */
export interface TemplateFile {
  /** Путь относительно корня шаблона; может нести плейсхолдеры имени формы. */
  readonly path: string;
  /** Содержимое с плейсхолдерами вместо имени формы. */
  readonly content: string;
  /** Куда его класть; без указания — в каталог формы. */
  readonly scope?: TemplateFileScope;
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
  /** Чем подставляется имя формы. Без указания — токенами. */
  readonly engine?: TemplateEngine;
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
  /** Чем подставляется имя формы. Без указания — токенами. */
  readonly engine?: TemplateEngine;
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

/** Идентификатор плагина: пространство имён во всех реестрах и в словаре. */
export const TEMPLATES_PLUGIN_ID = 'templates';
