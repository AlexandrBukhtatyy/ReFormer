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
 * ## Модель — контракт SDK
 *
 * Встроенные шаблоны вносит стек формы (затравки его формата, напечатанные его генератором),
 * поэтому модель шаблона и хранилища у хозяина и стека обязана быть одна — она в SDK
 * (`services/form-templates`). Здесь — короткие имена, которыми пользуется плагин.
 *
 * ## Запись выражена наличием методов, а не флагом
 *
 * `writable: boolean` рядом с необязательными методами дал бы два источника истины и класс
 * ошибок «флаг есть, метода нет». Поэтому доступность записи — это ПРИСУТСТВИЕ методов,
 * а {@link canSave}, {@link canUpdate}, {@link canRemove} — сужение типа, а не проверка настроения.
 *
 * @module plugins/reformer/templates/contract
 */

import {
  TemplateStorePoint,
  type FormTemplate,
  type FormTemplateEngine,
  type FormTemplateFile,
  type FormTemplateFileScope,
  type FormTemplatePrint,
  type FormTemplateStore,
  type TemplateSourceKind,
} from '@reformer/builder-plugin-api';
import manifest from './manifest.json';

export type { FormTemplate };

/** Откуда шаблон: напечатан стеком, лежит в каталоге проекта, сохранён локально в браузере. */
export type TemplateSource = TemplateSourceKind;

/**
 * Чем шаблон подставляет имя формы. Умолчание (поле не задано) — ТОКЕНЫ: снимок каталога
 * производит именно такие шаблоны, а для чужих файлов проекта (стили, конфиги) подстановка
 * честнее шаблона, который их автор не писал. `'eta'` — шаблонизатор целей кодогена; смеси нет:
 * два правила подстановки в одном файле дали бы вопрос «что раньше» без хорошего ответа.
 */
export type TemplateEngine = FormTemplateEngine;

/**
 * Куда файл шаблона ложится при создании формы. Размещение — свойство ФАЙЛА, а не шаблона: файлы
 * модуля адресуются от каталога формы, фикстура — от пути её документа (`fixtureDirOf` стека),
 * который до применения неизвестен.
 */
export type TemplateFileScope = FormTemplateFileScope;

/** Один файл шаблона. */
export type TemplateFile = FormTemplateFile;

/**
 * Печать модуля под имя формы — у шаблона, который не лежит текстом, а ПЕЧАТАЕТСЯ (встроенные):
 * генератор раскладывает строки под ширину, ширина зависит от имён модуля, и текст, напечатанный
 * под одно имя и переведённый на другое заменой токенов, перестаёт проходить форматтер проекта.
 */
export type TemplatePrint = FormTemplatePrint;

/**
 * Хранилище шаблонов — один бэкенд одного вида. Отказ хранилища (проект не открыт, IndexedDB
 * недоступна) — ПУСТОЙ список, а не бросок: панель, падающая из-за закрытого проекта, не показала
 * бы и встроенные шаблоны.
 */
export type TemplateStore = FormTemplateStore;

/**
 * Точка расширения хранилищ — SDK. Именно она отвечает на вопрос «а что если бэкендов станет
 * три»: они уже три, и добавление четвёртого — вклад, а не правка.
 */
export { TemplateStorePoint };

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

/** Идентификатор плагина: пространство имён во всех реестрах и в словаре. */
export const TEMPLATES_PLUGIN_ID = manifest.id;
