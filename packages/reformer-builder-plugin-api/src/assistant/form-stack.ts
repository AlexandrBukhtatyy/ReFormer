/**
 * Стек форм в ассистенте: что ассистент берёт у стека, чтобы править его формы.
 *
 * ## Почему это контракт, а не объявления ассистента
 *
 * Ассистент — общий плагин: канал к модели, лента, вопросы человеку, отмена хода и «Восстановить»
 * одинаковы для любого формата формы. Что такое форма, как её разобрать, какие у модели
 * инструменты, какой системный промпт и что значит «правка легла» — знает стек. Пока стек был один,
 * всё это жило в одном плагине; второй стек повторил бы ассистента целиком. Поэтому ассистент
 * спрашивает точку {@link FormAssistantStackPoint}, а стеки вносят в неё себя — тот же приём, что
 * у поверхностей превью (`./services/preview`).
 *
 * ## Модель формы здесь `unknown`, и это решение
 *
 * Разобранный документ, черновик хода и правила формы стек держит в `state` и в своих наборах
 * изменений; ассистент их только носит и возвращает тому же стеку. Сузь контракт до одной схемы —
 * второй стек не смог бы внести себя, не соврав в типе.
 *
 * ## Два режима правки
 *
 * - **Структурный** ({@link FormStructuredMode}): инструменты правят черновик в памяти, правка
 *   ложится одной записью в конце хода; до того её можно показать человеку и отклонить.
 * - **Файлы** ({@link FormFilesMode}): модель правит файлы модуля формы, каждая принятая запись —
 *   сразу в рабочей копии. Режим необязателен: стек без модуля на диске его не даёт.
 *
 * Оба режима проводит ассистент — поток модели, очередь вызовов, вторая попытка, лента; стек
 * отвечает за то, что видит модель (промпт, затравка, инструменты) и что остаётся после хода.
 *
 * @module @reformer/builder-plugin-api/assistant/form-stack
 */

import { defineExtensionPoint, type ExtensionPoint } from '../primitives/extension-point.js';
import type { ResourceId, ResourceRef } from '../primitives/resource.js';
import type { DocumentRef } from '../services/validation/types.js';
import type { AssistantWriteRefusal } from './tools.js';

// ── Инструмент и его ответ ──────────────────────────────────────────────────────────────────

/**
 * Код ошибки инструмента. Коды существуют, чтобы модель чинилась САМА: по коду и `suggestions` она
 * понимает, что поправить, вместо «что-то пошло не так».
 */
export type FormToolErrorCode =
  /** Имени нет в каталоге. `suggestions` — похожие имена. */
  | 'UNKNOWN_COMPONENT'
  /** Свойства не прошли схему компонента. */
  | 'INVALID_PROPS'
  /** Адрес никуда не ведёт либо ведёт не в тот узел. */
  | 'STALE_POINTER'
  /** Родитель не принимает детей либо слот не существует. */
  | 'INVALID_PARENT'
  /** Результат не прошёл строгий гейт валидации. */
  | 'SCHEMA_INVALID'
  /** Аргументы вызова не соответствуют `inputSchema`. */
  | 'INVALID_PARAMS'
  /** Инструмента с таким именем нет. `suggestions` — похожие имена. */
  | 'UNKNOWN_TOOL'
  /** Инструмент бросил исключение. Ход продолжается: модель получает ошибку и пробует иначе. */
  | 'TOOL_FAILED'
  /** Путь выводит за модуль формы. */
  | 'PATH_REFUSED'
  /** Файла нет. `suggestions` — похожие пути модуля. */
  | 'FILE_NOT_FOUND'
  /** Правка не нашла свой текст в файле либо нашла не один раз. */
  | 'EDIT_MISMATCH'
  /** Файл не читали в этой попытке хода или его изменили после чтения. */
  | 'STALE_FILE'
  /** Код правки не прошёл проверку. */
  | 'CODE_INVALID'
  /** Ресурса или записи нет. `suggestions` — похожие адреса. */
  | 'NOT_FOUND'
  /** Отказано по правилу — повторять тот же вызов бессмысленно. */
  | 'REFUSED'
  /** Такое не читается и не делается (например, двоичный файл). */
  | 'UNSUPPORTED'
  /** Слишком велико — читать частями. */
  | 'TOO_LARGE'
  /** Сейчас недоступно: проекта нет, доступ отозван, плагин выключен. */
  | 'UNAVAILABLE';

/** Структурированная ошибка инструмента. */
export interface FormToolError {
  code: FormToolErrorCode;
  message: string;
  /** Кандидаты на замену (имена компонентов, инструментов, пути). */
  suggestions?: string[];
}

/** Вид правки в списке изменений. */
export type FormChangeOpKind = 'add' | 'update' | 'remove' | 'move';

/** Одна правка хода — строка списка изменений в предпросмотре и в журнале ленты. */
export interface FormChangeOp {
  kind: FormChangeOpKind;
  /** Адрес затронутого узла ПОСЛЕ правки — в адресации стека. */
  ref: string;
  /** Человекочитаемое описание: «Email (Input)», «Email → обязательное». */
  summary: string;
}

/** Ответ инструмента. Стек вправе нести в своём ответе больше — ассистент читает только это. */
export interface FormToolOutcome {
  ok: boolean;
  /** Текст для модели. Ассистент обрезает его до бюджета ответа инструмента. */
  text: string;
  /** Правки вызова — у пишущих инструментов при `ok: true`. */
  ops?: readonly FormChangeOp[];
  /** Заполнено при `ok: false`. */
  error?: FormToolError;
}

/** Успешный ответ инструмента. */
export function formToolOk(text: string): FormToolOutcome {
  return { ok: true, text };
}

/**
 * Ответ инструмента с ошибкой. Похожие имена уходят и в текст для модели: по ним она чинит вызов
 * сама, не переспрашивая каталог.
 */
export function formToolFail(
  code: FormToolErrorCode,
  message: string,
  suggestions?: string[]
): FormToolOutcome {
  return {
    ok: false,
    text: suggestions?.length ? `${message} Did you mean: ${suggestions.join(', ')}.` : message,
    error: { code, message, ...(suggestions?.length ? { suggestions } : {}) },
  };
}

/** Исход записи инструмента плагина дверью хода. */
export type FormTurnWriteResult =
  | { readonly ok: true; readonly op: FormChangeOp }
  | { readonly ok: false; readonly code: AssistantWriteRefusal; readonly message: string };

/** Прочитанный ресурс плагина — целиком; листает его ассистент. */
export type FormResourceReadResult =
  | { readonly ok: true; readonly text: string; readonly mediaType: string }
  | { readonly ok: false; readonly error: FormToolError };

/** Вариант ответа на вопрос модели. */
export interface FormAskOption {
  readonly label: string;
  /** Пояснение под вариантом — что он значит для формы. */
  readonly description?: string;
}

/** Вопрос модели человеку. */
export interface FormAskQuestion {
  readonly question: string;
  /** Короткая метка вопроса — когда их в карточке несколько. */
  readonly header?: string;
  readonly options: readonly FormAskOption[];
  /** Можно выбрать несколько вариантов. */
  readonly multiSelect: boolean;
}

/** Ответ на один вопрос: выбранные варианты и/или свой текст. */
export interface FormAskAnswer {
  readonly selected: readonly string[];
  readonly text?: string;
}

/**
 * Чем кончился вопрос: ответы по порядку вопросов, исчерпанный предел вопросов хода или отмена —
 * ход остановили, не дождавшись ответа.
 */
export type FormAskOutcome = readonly FormAskAnswer[] | 'limit' | 'cancelled';

/** Шаблон формы в списке `list_templates`. */
export interface FormTemplateInfo {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
}

/** Что просит создать `create_form`. */
export interface FormCreateRequest {
  /** Имя модуля — имя его каталога. */
  readonly name: string;
  readonly template?: string;
  /** Каталог для модуля от корня проекта. */
  readonly folder?: string;
}

/** Исход `create_form`. */
export type FormCreateOutcome =
  | {
      readonly ok: true;
      readonly path: string;
      readonly template: string | null;
      /** Форма только в рабочей копии: отправить её в проект не удалось — почему, словами. */
      readonly unsaved?: string;
    }
  | {
      readonly ok: false;
      readonly code: FormToolErrorCode;
      readonly message: string;
      readonly suggestions?: string[];
    };

/**
 * Ход, внутри которого идёт вызов: остановка, дверь записи, ресурсы, вопросы человеку и заказы
 * генерации и создания формы. Даёт его ассистент; методов, которых нет, в сборке нечем исполнить.
 */
export interface FormTurnScope {
  /** Срабатывает, когда ход останавливают. */
  readonly signal: AbortSignal;
  /**
   * Записать ресурс от имени хода: с пометкой хода и учётом для его отмены. `caller.readOnly` —
   * объявлен ли вызывающий только читающим: такому запись отказана.
   */
  write(
    resource: string,
    text: string,
    caller: { readonly readOnly: boolean }
  ): Promise<FormTurnWriteResult>;
  /** Прочитать ресурс плагина по адресу `<схема>:<остаток>`. */
  readResource(uri: string): Promise<FormResourceReadResult>;
  /** Спросить человека и дождаться ответа тем же ходом. Нет — ход идёт на допущениях. */
  ask?(questions: readonly FormAskQuestion[]): Promise<FormAskOutcome>;
  /** Заказать генерацию кода формы хода — она идёт один раз, после правок хода. */
  generate?(): void;
  /** Шаблоны форм. */
  templates?(): Promise<readonly FormTemplateInfo[]>;
  /** Создать форму: ассистент открывает её и продолжает ход на ней. */
  createForm?(request: FormCreateRequest): Promise<FormCreateOutcome>;
}

/** Контекст вызова: стек добавляет своё (черновик, каталог), ассистент — {@link turn}. */
export interface FormToolContext {
  readonly turn?: FormTurnScope;
}

/**
 * Инструмент модели. `C` — контекст вызова: инструмент стека объявлен над расширением
 * {@link FormToolContext} и получает то, что отдал {@link FormTurn.context} его же стека.
 */
export interface FormAgentTool<P = never, C extends FormToolContext = FormToolContext> {
  /** Идентификатор вызова, snake_case. */
  readonly name: string;
  /** Для чего инструмент и когда его выбирать. */
  readonly description: string;
  /** JSON Schema аргументов. */
  readonly inputSchema: object;
  /** Не меняет форму: его отказ форму не задевает, а вызов не попадает в список изменений. */
  readonly readOnly: boolean;
  /** Ждёт человека — сторож тишины канала на это время стоит. */
  readonly interactive?: true;
  /** Свой бюджет ответа вместо общего — у инструментов, отдающих данные, а не сводку. */
  readonly textBudget?: number;
  run(params: P, ctx: C): FormToolOutcome | Promise<FormToolOutcome>;
}

/**
 * Инструменты ассистента, которые стек ставит в СВОЙ список по имени: вопрос человеку, заказ
 * генерации кода и создание формы. Исполняет их ассистент; стек решает только, где они стоят, —
 * порядок инструментов модель видит, и он не должен зависеть от того, кто инструмент исполняет.
 */
export type FormHostToolName = 'ask_user' | 'generate_code' | 'create_form';

/** Место в упорядоченном списке инструментов режима. */
export type FormToolSlot = FormAgentTool<never, never> | FormHostToolName;

/** Одна попытка хода: что видит модель и что становится с ответами инструментов. */
export interface FormTurn {
  /** Системный промпт попытки. */
  system(): string;
  /** Затравка формы — данные на начало попытки; `''` — показывать нечего. */
  seed(): string | Promise<string>;
  /** Контекст вызова инструмента — зовётся перед КАЖДЫМ вызовом, после исхода предыдущего. */
  context(): FormToolContext;
  /** Учесть ответ инструмента — до следующего вызова. */
  accept?(outcome: FormToolOutcome): void;
}

// ── Структурный режим ───────────────────────────────────────────────────────────────────────

/** Пометка записи для журнала рабочей области: кто правит и каким шагом. */
export interface FormWriteMark {
  readonly origin?: 'user' | 'agent';
  /** Логический шаг: ход отменяется целиком, даже если записей было несколько. */
  readonly txId?: string;
}

/** Документ формы на начало хода — разобранный стеком. */
export interface FormLoaded {
  /** Стек, который разобрал документ: ему и возвращаются набор, отмена и восстановление. */
  readonly stack: string;
  readonly resource: ResourceId;
  /** Путь документа от корня проекта. */
  readonly path: string;
  /** Текст документа на начало хода — база проверки расхождения. */
  readonly text: string;
  /** Разобранная форма и всё, что к ней относится (правила формы), — стек сужает сам. */
  readonly state: unknown;
  /** Файлы, которые ход пишет сам вместе с документом (например, файл правил формы). */
  readonly companions: readonly ResourceId[];
}

/** Набор изменений хода. Стек носит в своём наборе черновик; ассистенту нужен только список. */
export interface FormChangeSet {
  readonly ops: readonly FormChangeOp[];
}

/** Попытка структурного хода: копит набор изменений из ответов инструментов. */
export interface FormStructuredTurn extends FormTurn {
  /** Набор изменений попытки — после её конца. */
  result(): FormChangeSet;
}

/** Сопутствующий файл, который записала правка: чем он был и чем стал. */
export interface FormLandedCompanion {
  readonly id: ResourceId;
  /** `null` — файл правка создала. */
  readonly before: string | null;
  readonly after: string;
}

/**
 * Чем кончилась запись набора. Проверки «форма открыта» и «текст документа не разошёлся» делает
 * ассистент до записи; здесь — то, что знает только стек.
 */
export type FormLandOutcome =
  | {
      readonly status: 'applied';
      readonly companions: readonly FormLandedCompanion[];
      /**
       * Сопутствующий файл не записан, и `error` говорит почему: запись затёрла бы правку руками
       * либо её нечем сделать. Документ при этом записан.
       */
      readonly broken?: { readonly id: ResourceId; readonly error: string };
    }
  /** Сопутствующий файл разошёлся с базой хода. */
  | { readonly status: 'conflict' }
  /** Набор не проходит строгий гейт. */
  | { readonly status: 'invalid'; readonly errors: readonly string[] }
  /** Записать не удалось. */
  | { readonly status: 'failed'; readonly error: unknown };

/** Структурный режим: черновик в памяти, одна запись в конце хода. */
export interface FormStructuredMode {
  /** Инструменты режима — по порядку. */
  readonly tools: readonly FormToolSlot[];
  /** Разобрать документ; `null` — это не форма стека, править нечего. */
  load(document: {
    readonly resource: ResourceId;
    readonly path: string;
    readonly text: string;
  }): Promise<FormLoaded | null>;
  /** Начать попытку хода над документом. */
  begin(loaded: FormLoaded): FormStructuredTurn;
  /** Есть ли что записывать. */
  hasChanges(set: FormChangeSet): boolean;
  /** Записать набор: документ и сопутствующие файлы — с пометкой хода. */
  land(request: {
    readonly loaded: FormLoaded;
    readonly set: FormChangeSet;
    readonly mark: FormWriteMark;
    /** Поверх расхождения сопутствующих файлов — выбор человека. */
    readonly force: boolean;
  }): Promise<FormLandOutcome>;
  /**
   * Вернуть сопутствующее состояние к документу `loaded`: после отмены хода (`files: false` —
   * файлы ассистент уже вернул сам) и после «Восстановить» (`files: true`).
   */
  rewind(loaded: FormLoaded, options: { readonly files: boolean }): Promise<void>;
}

// ── Режим файлов ────────────────────────────────────────────────────────────────────────────

/** Модуль формы — то, в пределах чего ход режима файлов правит файлы. */
export interface FormModuleScope {
  /** Корень модуля формы. */
  readonly root: ResourceId;
  /** Путь корня модуля от корня проекта; `''` — модуль и есть корень проекта. */
  readonly rootPath: string;
  /** Документ формы — от него найден модуль. */
  readonly document: ResourceId;
  /** Путь документа ОТ КОРНЯ МОДУЛЯ. */
  readonly schemaPath: string;
}

/** Запись хода режима файлов. */
export interface FormFileJournalEntry {
  /** Путь от корня модуля. */
  readonly rel: string;
  /** Текст до первой записи хода; `null` — файл ход создал. */
  readonly before: string | null;
  /** Текст после последней записи хода. */
  readonly after: string;
}

/** Журнал хода режима файлов — общий для обеих попыток; по нему ассистент отменяет ход. */
export interface FormFileJournal {
  /** Учесть запись. `before` берётся только у первой записи файла. */
  record(id: ResourceId, rel: string, before: string | null, after: string): void;
  get(id: ResourceId): FormFileJournalEntry | undefined;
  /** Записанные файлы в порядке первого касания. */
  entries(): ReadonlyMap<ResourceId, FormFileJournalEntry>;
  readonly size: number;
}

/** Что ассистент даёт попытке хода режима файлов. */
export interface FormFilesIO {
  readonly journal: FormFileJournal;
  readonly mark: FormWriteMark;
}

/** Режим файлов: модель правит файлы модуля формы, каждая запись — сразу в рабочей копии. */
export interface FormFilesMode {
  /** Инструменты режима — по порядку. */
  readonly tools: readonly FormToolSlot[];
  /** Модуль формы документа; `null` — у документа нет своей папки модуля, ход идёт структурным. */
  scopeOf(document: ResourceId): FormModuleScope | null;
  /** Форма из файлов на начало попытки — база проверки записей; отказ — форма не собирается. */
  baseline(
    scope: FormModuleScope
  ): Promise<
    { readonly ok: true; readonly state: unknown } | { readonly ok: false; readonly error: string }
  >;
  /** Начать попытку хода над модулем. */
  begin(scope: FormModuleScope, base: unknown, io: FormFilesIO): FormTurn;
  /** Конец хода: привести записанные файлы к виду, каким их пишут редактор и генерация. */
  normalize(scope: FormModuleScope, io: FormFilesIO): Promise<void>;
}

// ── Стек ────────────────────────────────────────────────────────────────────────────────────

/** Документ, который ассистент отдаёт стеку. */
export interface FormStackDocument {
  readonly ref: ResourceRef;
  getText(): string;
}

/** Файлы рабочей копии — для стека, которому нужен режим файлов или сопутствующие файлы. */
export interface FormStackFiles {
  /** Текст файла; `null` — файла нет. */
  read(id: ResourceId): Promise<string | null>;
  write(id: ResourceId, text: string, mark?: FormWriteMark): Promise<void>;
  list(dir: ResourceId): Promise<readonly ResourceRef[]>;
  exists(id: ResourceId): Promise<boolean>;
  resolve(dir: ResourceId, ...segments: readonly string[]): ResourceId;
  parentOf(id: ResourceId): ResourceId;
  /** Путь от корня проекта. */
  pathOf(id: ResourceId): string;
}

/** Двери рабочей области, которые ассистент даёт стеку. */
export interface FormStackHost {
  /** Документ открытой вкладки; `null` — вкладку закрыли. */
  documentOf(id: ResourceId): FormStackDocument | null;
  writeText(id: ResourceId, text: string, mark?: FormWriteMark): Promise<void>;
  /** Нет — у платформы нет файлового доступа: режима файлов и сопутствующих файлов не будет. */
  readonly files?: FormStackFiles;
}

/**
 * Дверь документа, которую стек подменяет: например, составная форма, чей текст — сборка корня и
 * файлов шагов. Ей ассистент читает документ хода и пишет его отмену.
 */
export interface FormDocumentDoor {
  getText(): string;
  write(text: string, mark?: FormWriteMark): Promise<void>;
}

/** Стек, подключённый к ассистенту: память стека (правила по документам) живёт здесь. */
export interface FormStackSession {
  /** Подготовить то, без чего ход провести нельзя (загрузить проверку); отказ — ошибка хода. */
  prepare(): Promise<void>;
  /** Форма ли это стека — для подписи «Правит: …» в панели. */
  recognizes(text: string): boolean;
  /** Системный промпт хода без открытой формы — у него только создание формы. */
  creationPrompt(): string;
  /**
   * Почему ход не отдаёт ресурс инструменту плагина: документ формы, её части и сопутствующие
   * файлы ход правит своим механизмом. `null` — отдаёт.
   */
  refuseWrite(
    id: ResourceId,
    form: { readonly resource: ResourceId; readonly loaded?: FormLoaded }
  ): string | null;
  /** Своя дверь документа; `null` — ассистент читает и пишет документ как есть. */
  door?(id: ResourceId): FormDocumentDoor | null;
  readonly structured: FormStructuredMode;
  readonly files?: FormFilesMode;
}

/** Стек форм — вклад точки {@link FormAssistantStackPoint}. */
export interface FormAssistantStack {
  readonly id: string;
  /**
   * Берётся ли стек за документ. По {@link DocumentRef.providerId} — тот же признак, по которому
   * берутся за документ поверхности превью.
   */
  applies(document: DocumentRef): boolean;
  /** Подключиться к ассистенту — один раз на ассистента. */
  connect(host: FormStackHost): FormStackSession;
}

/**
 * Точка стеков форм ассистента. Стек вносит себя в `activate` и снимает при выключении — ассистент
 * спрашивает точку на каждый ход.
 */
export const FormAssistantStackPoint: ExtensionPoint<FormAssistantStack> =
  defineExtensionPoint<FormAssistantStack>('reformer.assistant.form-stack');
