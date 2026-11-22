/**
 * Генерация кода формы: цели, стеки и то, что хозяин генерации берёт у стека.
 *
 * ## Почему это контракт, а не объявления одного плагина
 *
 * Панель «Экспорт формы», запись модуля с маркером происхождения, цели из каталога проекта,
 * выгрузка шаблона и генерация по заказу ассистента одинаковы для любого формата формы. Что такое
 * форма документа, из каких файлов состоит её модуль и где он лежит — знает стек. Пока стек был
 * один, всё жило в одном плагине; второй стек повторил бы генерацию целиком. Поэтому хозяин
 * генерации спрашивает точку {@link CodegenStackPoint}, а стеки вносят в неё себя — тот же приём,
 * что у поверхностей превью (`./preview`) и стеков ассистента (`../assistant/form-stack`).
 *
 * ## Цель — вклад, а не строка в модуле
 *
 * Состав модуля — список целей {@link CodegenTargetPoint}: добавить файл может любой плагин, снять
 * его — выключение плагина. Цель ЧИСТАЯ: она видит только контекст эмиссии своего стека и
 * возвращает текст; записью занимается хозяин, и выйти за каталог модуля цель не может.
 *
 * ## Контекст эмиссии здесь `unknown`, и это решение
 *
 * Контекст, по которому цели печатают файлы, собирает стек и он же их печатает; хозяин цели только
 * собирает (свои, чужие, из проекта) и отдаёт стеку. Сузь контракт до контекста одного стека —
 * второй не смог бы внести свои цели, не соврав в типе.
 *
 * ## Тексты стека — ключами его словаря
 *
 * Отказы и заметки стека ({@link CodegenRefusal}, {@link CodegenNote}) приходят ключами ЕГО
 * словаря: панель хозяина переводит их {@link CodegenStack.translate}, уведомления —
 * `pluginMessageKey(<плагин стека>, ключ)`. Свой словарь хозяин на чужие слова не тратит.
 *
 * @module @reformer/builder-plugin-api/services/codegen
 */

import { defineExtensionPoint, type ExtensionPoint } from '../primitives/extension-point.js';
import type { ResourceId, ResourceRef } from '../primitives/resource.js';

// ── Цель ────────────────────────────────────────────────────────────────────────────────────

/** Класс файла модуля: `derived` перезаписывается всегда, `user` пишется один раз. */
export type CodegenFileClass = 'derived' | 'user';

/** Откуда цель приехала: встроенная стека, файл проекта либо чужой плагин. */
export type CodegenTargetOrigin = 'builtin' | 'user' | 'plugin';

/**
 * Одна цель генерации — один файл модуля формы.
 *
 * `Ctx` — контекст эмиссии стека, которому цель принадлежит. Члены, которые его принимают,
 * объявлены МЕТОДАМИ: так цель стека (`CodegenTarget<EmitContext>`) вносится в точку
 * `CodegenTarget<unknown>`, а хозяин, не знающий контекста, держит их одним списком.
 */
export interface CodegenTarget<Ctx = unknown> {
  /** Уникален в пределах точки; он же адрес цели в отчёте о генерации. */
  readonly id: string;
  /**
   * Путь файла ОТНОСИТЕЛЬНО каталога модуля — шаблон с токенами стека (`{Type}.tsx`,
   * `validation/{step}.ts`). Абсолютные пути и `..` отвергаются отбором целей.
   */
  readonly path: string;
  /**
   * Размножить цель: `'step'` — по файлу на каждый шаг визарда. Декларативно, а не функцией:
   * цели из проекта приезжают файлами-шаблонами с заголовком, и функцию туда не положить.
   */
  readonly each?: 'step';
  /** Прежние имена файла цели — шаблоны с теми же токенами. Запись переносит файл под новое имя. */
  readonly legacyPaths?: readonly string[];
  /**
   * Ключ заголовка для меню — в словаре ВЛАДЕЛЬЦА цели. Без него пункт подписывается
   * {@link CodegenTarget.title}, а без того — путём.
   */
  readonly titleKey?: string;
  /** Подпись ТЕКСТОМ — для целей без словаря (файл в `.ui_builder/codegen/`). */
  readonly title?: string;
  /**
   * Идентификатор цели, которую эта ЗАМЕНЯЕТ. Явным полем, а не совпадением `id`: реестр вкладов
   * бросает на повторный `id`.
   */
  readonly overrides?: string;
  /** Откуда цель приехала. Ставит её не автор, а тот, кто цель собрал. Нет — встроенная. */
  readonly origin?: CodegenTargetOrigin;
  /**
   * Стек, чей модуль печатает цель (`CodegenStack.id`). Нет — цель годится любому стеку.
   *
   * Цель из проекта, заменяющая чужую, наследует её стек: она пишется по виду того же стека.
   */
  readonly stack?: string;
  readonly cls: CodegenFileClass;
  /**
   * `user`-файл, который производится из правил и потому несёт маркер происхождения:
   * перезаписывается, только если его не правили руками.
   */
  readonly regenerable?: boolean;
  /**
   * Применима ли цель к этой форме. Без ответа — применима всегда. У цели с
   * {@link CodegenTarget.each} вопрос задаётся по каждому шагу.
   */
  applies?(ctx: Ctx): boolean;
  /**
   * Применимость над ВИДОМ шаблона (`it`), а не над контекстом эмиссии: так её выражает цель из
   * проекта — выражением заголовка, которое компилирует хозяин. Стек зовёт её с тем же видом,
   * который увидел бы шаблон. Вместе с {@link CodegenTarget.applies} — применима, если обе «да».
   */
  appliesView?(view: object): boolean;
  /** Текст файла КОДОМ. Ровно одно из `emit` и `template`. */
  emit?(ctx: Ctx): string;
  /** Текст файла ШАБЛОНОМ на Eta — исходник, а не путь. Вид (`it`) собирает стек. */
  readonly template?: string;
  /** Частные данные цели — ложатся в вид отдельным полем `it.local`. */
  view?(ctx: Ctx): object;
}

/** Точка расширения целей генерации. Заполняется только вкладами. */
export const CodegenTargetPoint: ExtensionPoint<CodegenTarget> =
  defineExtensionPoint<CodegenTarget>('codegen.target');

// ── Модуль ──────────────────────────────────────────────────────────────────────────────────

/** Файл напечатанного модуля вместе с тем, что записи нужно знать о его происхождении. */
export interface CodegenFile {
  /** Путь от корня модуля. */
  readonly path: string;
  readonly content: string;
  readonly cls: CodegenFileClass;
  /** `user`-файл, который производится из правил: перезаписывается, если его не правили. */
  readonly regenerable: boolean;
  /** Кто напечатал — для отчёта и выгрузки шаблона. */
  readonly targetId: string;
  /** Номер шага визарда (с единицы) у файлов, размноженных по шагам. */
  readonly step?: number;
  /** Прежние имена этого файла (токены подставлены) — для переноса под новое имя. */
  readonly legacyPaths?: readonly string[];
  readonly origin: CodegenTargetOrigin;
  /**
   * Точечная правка авторского файла, который уже лежит на диске: текст после правки либо
   * `null` — не трогать. Без неё такой файл пропускается (`authored`), как всегда.
   *
   * Так новые записи доезжают до файла человека, не перепечатывая его: текст замечания — в его
   * словарь, значение источника — в его константы.
   */
  readonly merge?: (current: string) => string | null;
}

/** Почему цель не напечатала файл либо почему замена не действует. */
export type CodegenProblemReason =
  | 'threw'
  | 'duplicate-path'
  | 'escaping-path'
  | 'no-body'
  | 'both-bodies'
  /** Шаблон пути не сходится с целью: токен шага не у той цели либо токен неизвестен. */
  | 'bad-pattern'
  /** Файл цели из проекта не разбирается: битый заголовок либо `applies`. */
  | 'template-invalid'
  /** Цель заменяет другую, но печатает не то и не туда либо заменяет цель, которой больше нет. */
  | 'override-path-drift';

/** Отказ одной цели. Данные, а не исключение: генерация продолжается. */
export interface CodegenProblem {
  readonly targetId: string;
  readonly path: string;
  readonly reason: CodegenProblemReason;
  readonly message: string;
}

/** Форматирование: тексты в порядке входа. Без него файлы уезжают как напечатаны. */
export type CodegenFormatter = (
  files: readonly { path: string; content: string }[]
) => Promise<readonly string[]>;

// ── Стек ────────────────────────────────────────────────────────────────────────────────────

/** Текст стека: ключ ЕГО словаря и подстановки. */
export interface CodegenText {
  readonly key: string;
  readonly params?: Readonly<Record<string, string | number>>;
}

/** Отказ стека: форма его, но печатать нельзя. Показывает хозяин, переводит стек. */
export interface CodegenRefusal {
  readonly refusal: CodegenText;
  /** Подробность, которую ключ не передаёт: какой файл шага не собрался. */
  readonly detail?: string;
}

/**
 * Заметка о модуле на диске после записи: файлы, которых в модуле нет (сироты шагов, файлы
 * прежней раскладки). Запись их не трогает — только называет.
 */
export interface CodegenNote {
  /** Различает заметки в панели (`data-testid="codegen-<id>"`). */
  readonly id: string;
  /** Пути от корня модуля. */
  readonly paths: readonly string[];
  readonly title: CodegenText;
  readonly detail: CodegenText;
  /** Текст уведомления — у генерации из дерева панели нет. */
  readonly notify: CodegenText;
}

/** Открытый документ — в объёме, нужном стеку. */
export interface CodegenDocument {
  readonly id: ResourceId;
  readonly ref: ResourceRef;
  /**
   * Вид ресурса — как `activeResourceKind`: провайдер модели у модельного документа, тип
   * содержимого у текстового. По нему выбирается стек ({@link CodegenStack.kinds}).
   */
  readonly resourceKind: string;
  getText(): string;
  /** Модель, СОГЛАСОВАННАЯ с буфером, либо `undefined`. */
  model(): unknown;
  /** Раскладка документа из нескольких файлов: модель уже собрана. `undefined` — одним файлом. */
  composition?(): { readonly layout: unknown } | undefined;
}

/** Чтение рабочей области, которое хозяин даёт стеку. Писать стек не может: пишет хозяин. */
export interface CodegenReader {
  /** Документ открытой вкладки — в нём текст, который человек видит сейчас. */
  documentOf(id: ResourceId): CodegenDocument | null;
  readText(id: ResourceId): Promise<string | null>;
  exists(id: ResourceId): Promise<boolean>;
  /** Один уровень каталога. Нет — среда без листинга: генерация из дерева отказывает. */
  list?(dir: ResourceId): Promise<readonly ResourceRef[]>;
  parentOf(id: ResourceId): ResourceId;
  resolve(dir: ResourceId, ...segments: readonly string[]): ResourceId;
}

/** Что печатать: цели стека (хозяин уже снял заменённые) и имя формы. */
export interface CodegenPrintRequest {
  readonly targets: readonly CodegenTarget[];
  /** Имя формы — непустое: введённое человеком либо {@link CodegenForm.formName}. */
  readonly formName: string;
  readonly format?: CodegenFormatter;
  /**
   * Вход заказчика генерации для этого стека (`GenerateRequest.stackInput`) — как есть; форму
   * его определяет и проверяет сам стек. Нет — печать по одному документу и диску.
   */
  readonly input?: unknown;
}

/** Напечатанный модуль. */
export interface CodegenModule {
  readonly files: readonly CodegenFile[];
  readonly problems: readonly CodegenProblem[];
  /** Вид, который видели шаблоны (`it`), — для инспектора в панели. */
  readonly view: object | null;
  /** Сниппет регистрации формы в приложении: вставляет человек, не запись. Пусто — нет. */
  readonly snippet: string;
  /**
   * Перед записью: отказ, если запись испортила бы модуль на диске.
   *
   * @param delivered - Файлы, которые пишутся в этот раз, когда пишется не весь модуль
   *   (`GenerateRequest.only`); нет — пишется весь.
   */
  check?(delivered?: readonly CodegenFile[]): Promise<CodegenRefusal | null>;
  /** После записи: заметки о файлах на диске, которых в модуле нет. */
  inspect?(): Promise<readonly CodegenNote[]>;
}

/** Форма, найденная стеком: где лежит её модуль и как его напечатать. */
export interface CodegenForm {
  /** Корень модуля в рабочей области — туда пишет хозяин. */
  readonly root: ResourceId;
  /** Он же путём от корня проекта — для отчёта заказчику. */
  readonly rootPath: string;
  /** Имя формы по умолчанию. */
  readonly formName: string;
  print(request: CodegenPrintRequest): Promise<CodegenModule>;
}

/** Ответ стека на «вот документ/каталог»: форма, отказ либо `null` — «не моя форма». */
export type CodegenOpenResult = CodegenForm | CodegenRefusal | null;

/** Стек генерации кода: что такое форма документа и как из неё печатается модуль. */
export interface CodegenStack {
  /** Совпадает с {@link CodegenTarget.stack} у целей стека. */
  readonly id: string;
  /**
   * Виды ресурса (провайдер модели либо тип содержимого), чьи документы стек печатает: по ним
   * видна панель и выбирается стек документа.
   */
  readonly kinds: readonly string[];
  /** Перевод ключа словаря стека — отказы, заметки. */
  translate(key: string, params?: Readonly<Record<string, unknown>>): string;
  /** Имя формы по умолчанию — из пути документа. */
  formNameOf(path: string): string;
  /** Форма открытого документа: прочитать её (части, сопутствующие файлы), решить место модуля. */
  open(document: CodegenDocument, reader: CodegenReader): Promise<CodegenOpenResult>;
  /** Форма в каталоге — генерация из дерева. Нет — стек из дерева не генерирует. */
  find?(dir: ResourceId, reader: CodegenReader): Promise<CodegenOpenResult>;
  /**
   * Замена устарела: написана под прежний контракт стека и печатать её нельзя. Текст причины —
   * панель покажет его рядом с отказами целей; `null` — замена годна.
   *
   * `replaced` — заменяемая цель; `undefined` — такой цели больше нет.
   */
  staleOverride?(target: CodegenTarget, replaced: CodegenTarget | undefined): string | null;
}

/** Точка расширения стеков генерации. */
export const CodegenStackPoint: ExtensionPoint<CodegenStack> =
  defineExtensionPoint<CodegenStack>('codegen.stack');

/** Отказ ли это стека, а не форма. */
export function isCodegenRefusal(result: CodegenOpenResult): result is CodegenRefusal {
  return result !== null && 'refusal' in result;
}
