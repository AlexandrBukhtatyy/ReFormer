/**
 * Шаблоны форм: модель шаблона, хранилища и то, что хозяин шаблонов берёт у стека.
 *
 * ## Почему это контракт, а не объявления одного плагина
 *
 * Панель шаблонов, хранилища (каталог проекта, локальное), снимок каталога в шаблон, подстановка
 * имени формы и запись новой формы одинаковы для любого формата формы. Что такое документ формы
 * среди файлов шаблона, как назвать модуль, что видит шаблон на движке и какие шаблоны встроены —
 * знает стек. Поэтому хозяин шаблонов спрашивает точку {@link TemplateStackPoint}, а стеки вносят в
 * неё себя — тот же приём, что у генерации кода (`./codegen`) и ассистента.
 *
 * ## Хранилище — вклад, а не ветка `if (source === …)`
 *
 * Бэкендов шаблонов уже три (встроенные, каталог проекта, браузер), и четвёртый — вклад в точку
 * {@link TemplateStorePoint}, а не правка. Встроенные шаблоны вносит стек: это затравки его формы,
 * напечатанные его генератором.
 *
 * @module @reformer/builder-plugin-api/services/form-templates
 */

import { defineExtensionPoint, type ExtensionPoint } from '../primitives/extension-point.js';
import type { TemplateSourceKind } from './form-authoring.js';

/**
 * Чем шаблон подставляет имя формы. Умолчание (поле не задано) — ТОКЕНЫ: `__FormName__` и три его
 * написания. `'eta'` — шаблонизатор: циклы, ветвления и, если шаблон несёт форму стека, её вид.
 */
export type FormTemplateEngine = 'eta';

/**
 * Куда файл шаблона ложится при создании формы: `form` (умолчание) — в каталог создаваемой формы;
 * `fixture` — фикстура предпросмотра, её каталог стек выводит из пути документа формы
 * ({@link TemplateStack.fixtureDirOf}).
 */
export type FormTemplateFileScope = 'form' | 'fixture';

/** Один файл шаблона. */
export interface FormTemplateFile {
  /** Путь относительно корня шаблона; может нести плейсхолдеры имени формы. */
  readonly path: string;
  /** Содержимое с плейсхолдерами вместо имени формы. */
  readonly content: string;
  /** Куда его класть; без указания — в каталог формы. */
  readonly scope?: FormTemplateFileScope;
}

/**
 * Печать модуля под имя формы — у шаблона, который не лежит текстом, а ПЕЧАТАЕТСЯ (встроенные):
 * раскладка строк зависит от имён модуля, и подстановка токенов её не воспроизводит. Пути — от
 * корня модуля, уже с именами формы; пустой список — печатать нечем.
 */
export type FormTemplatePrint = (formName: string) => Promise<readonly FormTemplateFile[]>;

/** Шаблон формы. */
export interface FormTemplate {
  /** Имя каталога (project), ключ хранилища (local), фиксированный slug (builtin). */
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly source: TemplateSourceKind;
  readonly files: readonly FormTemplateFile[];
  /** Зависимости между файлами: отметка файла тянет перечисленные, по цепочке. */
  readonly requires?: Readonly<Record<string, readonly string[]>>;
  /** Человеческие подписи файлов; без записи показывается сам путь. */
  readonly labels?: Readonly<Record<string, string>>;
  /** ISO-время создания — для сортировки; у встроенных отсутствует. */
  readonly createdAt?: string;
  /** Чем подставляется имя формы. Без указания — токенами. */
  readonly engine?: FormTemplateEngine;
  /** Печать модуля под имя формы ({@link FormTemplatePrint}); есть только у печатаемых. */
  readonly print?: FormTemplatePrint;
}

/**
 * Хранилище шаблонов — один бэкенд одного вида.
 *
 * Читать умеют все, писать — не все, и это выражено присутствием методов, а не флагом. Отказ
 * хранилища (проект не открыт, IndexedDB недоступна) — ПУСТОЙ список, а не бросок.
 */
export interface FormTemplateStore {
  /** Вид, к которому относятся его шаблоны. Он же — заголовок группы в панели. */
  readonly source: TemplateSourceKind;
  /** Доступно ли хранилище прямо сейчас (проект открыт, печатник есть). */
  available(): boolean;
  list(): Promise<readonly FormTemplate[]>;
  save?(template: FormTemplate, baseName?: string): Promise<FormTemplate>;
  update?(template: FormTemplate): Promise<void>;
  remove?(id: string): Promise<void>;
}

/** Точка расширения хранилищ шаблонов. Порядок вкладов — порядок групп в панели. */
export const TemplateStorePoint: ExtensionPoint<FormTemplateStore> =
  defineExtensionPoint<FormTemplateStore>('templates.store');

/**
 * Стек шаблонов: что знает о шаблоне формат формы.
 *
 * Хуки чистые и работают с ГОТОВЫМИ файлами — уже после подстановки имени, если не сказано иное.
 * Необязательный хук без ответа значит «стек об этом ничего не говорит»: хозяин берёт своё
 * правило (документа нет — после создания ничего не открывается; места модуля нет — новая форма
 * встаёт рядом с документом).
 */
export interface TemplateStack {
  readonly id: string;
  /** Его ли это шаблон: в наборе файлов есть документ формы стека. */
  owns(files: readonly FormTemplateFile[]): boolean;
  /** Документ формы в наборе — его открыть после создания и от него считать вид; `null` — нет. */
  documentOf(files: readonly FormTemplateFile[]): FormTemplateFile | null;
  /** Файлы, приведённые к текущему формату стека; прочие — теми же объектами. */
  upgrade?(files: readonly FormTemplateFile[]): readonly FormTemplateFile[];
  /**
   * Вид формы для шаблона на движке (`it.form`) — по файлам шаблона ДО отрисовки; `null` —
   * рассказать нечего (документа нет, кита нет).
   */
  view?(files: readonly FormTemplateFile[], formName: string): object | null;
  /** Токены имён модуля и их значения для формы: `{ '__FormType__': 'LoanForm' }`. */
  tokens?(formName: string): Readonly<Record<string, string>>;
  /** Шаблон пустой формы — создание формы без шаблона. */
  empty?(): FormTemplate;
  /**
   * Глубина документа в модуле: `0` — документ в корне модуля, `1` — в его папке; `null` — у
   * документа нет модуля (новая форма встаёт рядом с ним).
   */
  moduleDepthOf?(documentPath: string): number | null;
  /** Каталог фикстуры от корня новой формы по пути документа в шаблоне; `null` — в корень. */
  fixtureDirOf?(documentPath: string): string | null;
}

/** Точка расширения стеков шаблонов. */
export const TemplateStackPoint: ExtensionPoint<TemplateStack> =
  defineExtensionPoint<TemplateStack>('templates.stack');
