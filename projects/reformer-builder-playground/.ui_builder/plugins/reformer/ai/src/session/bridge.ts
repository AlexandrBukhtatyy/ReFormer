/**
 * Мост ассистента: единственное место, где ход агента встречается с рабочей областью.
 *
 * Ядро (`core/`) чистое: оно получает схему входом и возвращает набор изменений, никуда его
 * не применяя. Здесь решается всё остальное — что считать текущей формой, откуда взять историю
 * диалога, куда деть результат и что сказать, если сказать нечего.
 *
 * ## Что изменилось против v1
 *
 * В v1 этим занимался `agent/run.ts`, и он читал `editorStore` — состояние приложения. Здесь
 * нет ни стора, ни модульных синглтонов: активная вкладка приходит портом (`./host`), правки
 * уходят через `Workspace.writeText` (`./apply`), а каталог — входом хода.
 *
 * Два урока живых прогонов, физически лежавших в `run.ts`, вынесены в `./history` и там же
 * покрыты тестами: сводка молчаливого хода (урок 7) и бюджет истории в символах (урок 8).
 * Их место названо явно, потому что при переносе они теряются первыми — они выглядят как
 * частности моста, а являются условиями его работоспособности.
 *
 * ## Инструменты хода = встроенные + вклады плагинов
 *
 * Набор собирается на каждый ход, а не на активацию: инструменты плагинов, провайдеры ресурсов
 * и команды с блоком `agent` приходят и уходят вместе с плагинами, и ход обязан видеть те, что
 * зарегистрированы СЕЙЧАС. Сборка и потолок вкладов — `./contributions`, ресурсы — `./resources`.
 *
 * ## Записи плагинов — часть хода
 *
 * Инструмент плагина пишет дверью хода (`./turn-writes`): с пометкой этого хода и с памятью о
 * том, чем файл был до него. Поэтому «Отменить последний ход» и «Восстановить» снимают его записи
 * вместе с правками самой модели — у каждого файла хода своя дверь (`LandedFile.access`).
 *
 * @module plugins/reformer/ai/session/bridge
 */

import type { JsonFormSchema } from '@reformer/renderer-json';
import { emptyRules, type FormRules } from '../../../core/form-model';
import {
  parseAssistantResourceUri,
  type CommandContribution,
  type ResourceId,
} from '@reformer/builder-plugin-api';
import { applyChangeSet } from './apply';
import { createChangeSet, hasChanges, type ChangeSet } from '../model/changeset';
import type { AgentCommand, ExecuteCommand } from '../tools/command-tools';
import type { ContributedToolEntry } from '../tools/contributed-tools';
import { runAgentTurn, type ActiveForm, type TurnEvent, type TurnStats } from '../loop/loop';
import type { AskAnswer, AskOutcome, ChangeOp, TurnScope } from '../model/types';
import { askUserTool } from '../tools/ask-user';
import { createContributionSurface } from './contributions';
import {
  createResourceRouter,
  resolveAttachments,
  type ResolvedAttachments,
  type ResourceProviderEntry,
  type ResourceSearchGroup,
} from './resources';
import { createTurnWrites, type TurnWrites } from './turn-writes';
import type { LoadValidateForm } from '../model/validate';
import type { AiFiles, AiHost, FileScope, WriteMark } from '../host';
import { historyFor } from './history';
import type { AiAssistant } from '../plugin';
import type { AiMessage, AiProvider, AiStop } from '../providers/types';
import { parseSchemaText, printSchemaText } from '../model/schema-text';
import {
  isFilesSnapshot,
  type AiSession,
  type AttachOutcome,
  type PendingChanges,
} from './session';
import { fileRoleOf } from '../../../core/codegen/layout';
import { printJson } from '../../../core/codegen/print/js';
import { composeForm } from '../files/compose';
import { createFileJournal, type FileJournal } from '../files/journal';
import { relInScope } from '../files/scope';
import { createFileTurn } from '../files/turn';
import { runFileTurn } from '../loop/file-loop';
import type { TurnStepEvent } from '../loop/drive';

/** Исход хода, каким его сообщает цикл. */
type TurnReason = Extract<TurnEvent, { type: 'done' }>['reason'];

/**
 * Подсказка для второй попытки после обрыва на недописанном вызове.
 *
 * По-английски и в роли пользователя: инструкции модель устойчивее выполняет на английском (по
 * той же причине, что и системный промпт), но системным сообщением это быть не может — оно
 * неизменно весь ход и кэшируется. Про язык ответа сказано явно: без этой оговорки английская
 * реплика в конце диалога перетягивает ответ на английский, хотя пользователь писал по-русски.
 */
const CONTINUE_HINT =
  'Your previous answer was cut off before any edit was applied. Continue from the current ' +
  'state of the form and do that work now — in SMALL batches, a few nodes per call, and keep ' +
  "the thinking short. Reply in the same language as the user's own messages.";

/**
 * Подсказка для второй попытки после вызова, написанного текстом (`AiStop.textualCall`).
 *
 * Своя, а не {@link CONTINUE_HINT}: ответ не оборвался — модель договорила и, судя по тексту,
 * считает правку сделанной. Сказать надо другое: текст не исполняется. Выход «только показать»
 * оставлен намеренно: признак опознаёт вызов по виду текста, и пример, который пользователь просил
 * показать, не должен превращаться в правку, о которой его не просили.
 */
const textualCallHint = (tool: string): string =>
  `Your previous answer has a call of ${tool} written as text. Text in an answer is never ` +
  'executed, so nothing was applied. If you meant to make that change, make it now by calling ' +
  'the tool itself, with a few small edits per call. If you only meant to show it, say so in one ' +
  "sentence. Reply in the same language as the user's own messages.";

/**
 * Подсказка для вопроса, написанного текстом вместо вызова `ask_user`. Правки здесь не было и не
 * предполагалось — модель хотела спросить, и «сделай правку сейчас» сбило бы её с толку.
 */
const TEXTUAL_ASK_HINT =
  'Your previous answer has a call of ask_user written as text, so the user saw no question. ' +
  'Call the ask_user tool itself, or ask in plain words. ' +
  "Reply in the same language as the user's own messages.";

/** Подсказка второй попытки по признаку, который её вызвал. */
const secondPassHint = (stop: AiStop | undefined): string =>
  stop?.textualCall === undefined
    ? CONTINUE_HINT
    : stop.textualCall === 'ask_user'
      ? TEXTUAL_ASK_HINT
      : textualCallHint(stop.textualCall);

/**
 * Модель знала, что делать, и правка до формы не дошла: вызов оборван, ход пуст или вызов
 * написан текстом. Ровно эти исходы лечатся повтором — общее условие обоих режимов.
 */
const missedEdit = (stop: AiStop | undefined): boolean =>
  stop?.truncatedCall !== undefined ||
  stop?.emptyFinish === true ||
  stop?.textualCall !== undefined;

/** Сколько правок пакета называть в журнале, прежде чем свернуть остаток в счёт. */
const OPS_IN_LOG = 3;

/**
 * Сколько карточек вопросов модель вправе показать за ход. В карточке до четырёх вопросов, и
 * всё, что модели неясно, помещается в одну; вторая — на случай, когда ответ на первую открыл
 * новую развилку. Дальше модель переспрашивает по кругу, и ход стоит дороже догадки.
 */
const MAX_ASKS_PER_TURN = 2;

/** Предел своего ответа человека, символов: ответ уходит модели целиком на каждом шаге. */
const ANSWER_TEXT_LIMIT = 1000;

/** Что нужно мосту от плагина и от платформы. */
export interface BridgeDeps {
  readonly assistant: AiAssistant;
  readonly host: AiHost;
  readonly session: AiSession;
  /**
   * Команды, объявившие себя инструментами (`CommandRegistry.agentCommands()`).
   *
   * Функция, а не список: набор меняется вместе с включёнными плагинами, а ход обязан идти
   * против того, что зарегистрировано сейчас.
   */
  readonly agentCommands: () => readonly AgentCommand[];
  /** Исполнение команды — `CommandRegistry.execute`. */
  readonly executeCommand: ExecuteCommand;
  /**
   * Инструменты плагинов — вклады точки `reformer.assistant.tool`. Функция по той же причине,
   * что {@link agentCommands}; без неё инструментов плагинов нет.
   */
  readonly assistantTools?: () => readonly ContributedToolEntry[];
  /** Провайдеры ресурсов — вклады точки `reformer.assistant.resource`. */
  readonly resourceProviders?: () => readonly ResourceProviderEntry[];
  /**
   * Заказ проверки по мета-схеме (`core/validate`). Мост — единственное место, где её ждут:
   * ход и применение асинхронны, а инструменты внутри хода синхронны, и просить их ждать сеть
   * значило бы задерживать каждый шаг.
   *
   * Загрузку ЗАКАЗЫВАЕТ владелец при активации плагина, так что к первому ходу она давно
   * приехала; ожидание здесь — страховка на случай очень быстрого первого вопроса, а не
   * рабочий режим.
   */
  readonly validateForm: LoadValidateForm;
}

/** Идентификатор команды «отменить последний ход ассистента». */
export const AI_UNDO_TURN_COMMAND_ID = 'ai.undo-turn';

/**
 * Чем кончилась отмена хода.
 *
 * Код, а не готовая фраза, по той же причине, по которой кодами устроены диагностики: по коду
 * проверяется тест и решает вызывающий, а фразу мост кладёт в ленту сам — чтобы кнопка в панели
 * и пункт палитры объясняли отказ ОДИНАКОВО.
 */
export type UndoTurnOutcome =
  | 'undone'
  /** Ассистент ещё не менял форму — отменять нечего. */
  | 'nothing'
  /** Ход идёт прямо сейчас: сначала он должен кончиться. */
  | 'running'
  /** Форму, которую правил ассистент, закрыли. */
  | 'closed'
  /** Поверх хода уже легла правка человека — см. {@link AgentBridge.undoLastTurn}. */
  | 'overlapped'
  /** Запись в буфер отказала. */
  | 'failed';

/** Мост наружу: то, чем пользуется панель и команды плагина. */
export interface AgentBridge {
  /** Идёт ли ход прямо сейчас. */
  isRunning(): boolean;
  /** Провести ход по сообщению пользователя. */
  send(text: string): Promise<void>;
  /** Прервать текущий ход. Уже применённые правки остаются — их отменяет «Восстановить». */
  abort(): void;
  /** Применить набор, ждущий решения. `force` — поверх расхождения с буфером. */
  applyPending(force?: boolean): Promise<void>;
  /** Отклонить набор, ждущий решения. */
  rejectPending(): void;
  /** Вернуть форму к состоянию перед репликой и обрезать переписку до неё. */
  restoreTo(entryId: string): Promise<void>;
  /**
   * Ответить на карточку вопросов модели — ход продолжится с ответом. `false` — ответ не принят:
   * карточка уже закрыта или не та, число ответов не совпало с вопросами, или на какой-то вопрос
   * не выбран ни вариант, ни свой ответ.
   */
  answer(cardId: string, answers: readonly AskAnswer[]): boolean;
  /**
   * Новый разговор: лента очищается, а вместе с ней — отмена хода и точки восстановления прошлого
   * разговора. Пока идёт ход, отказывает (`false`): обрыв ленты посреди хода оставил бы его
   * реплику без места, куда писать.
   */
  reset(): boolean;

  /**
   * Есть ли ход ассистента, который можно отменить.
   *
   * Дёшево и НЕ читает буфер: предикат зовут на каждую перерисовку панели и на каждый показ
   * палитры (`CommandContribution.enabled` обязан быть чистым и дешёвым). Перекрыт ли ход
   * правкой человека, выясняется в {@link undoLastTurn} — то есть в момент нажатия, и с
   * объяснением. Отключённая кнопка без объяснения была бы здесь хуже: человек не узнал бы,
   * почему отмена недоступна.
   */
  canUndoTurn(): boolean;

  /**
   * Отменить последний ход ассистента целиком — включая ход, приземлившийся ДВУМЯ записями.
   *
   * Отличается от «Восстановить» на реплике не механикой, а тем, чего НЕ делает: переписку
   * не обрезает и чужие правки не перезаписывает. «Восстановить» возвращает форму к снимку
   * до вопроса, каким бы ни стал буфер с тех пор; отмена хода снимает ровно то, что написал
   * ассистент, и только если с тех пор больше никто не писал.
   *
   * **Ход, перекрытый правкой человека, НЕ отменяется** — ответ `overlapped`. Довод тот же,
   * которым `Journal.undoTransaction` отказывает, не найдя основания под обратной правкой:
   * правки ассистента и человека перемешаны в одном тексте, и возврат к состоянию до хода
   * стёр бы работу человека, сделанную ПОСЛЕ. Правдоподобно испорченный текст хуже отказа,
   * а «потерял мою правку» хуже обоих. Человеку в этом случае показывается, чем воспользоваться
   * вместо (кнопкой «Восстановить», которая перезапись как раз и обещает).
   *
   * Отмена уходит в буфер БЕЗ пометки происхождения: её заказал человек, нажав кнопку, — и
   * в журнале она обязана выглядеть его правкой, а не ходом ассистента. То же решение, что
   * у `restoreTo`.
   */
  undoLastTurn(): Promise<UndoTurnOutcome>;

  /**
   * То же, но ЧЕРЕЗ РЕЕСТР КОМАНД — путь кнопки в панели.
   *
   * Кнопка не зовёт {@link undoLastTurn} напрямую нарочно: иначе у отмены было бы два входа,
   * и охранное условие (`enabled`), назначенное сочетание и запись в палитре относились бы
   * только к одному из них. Тот же довод, по которому ассистент чинит форму той же командой,
   * которой чинит человек.
   */
  requestUndoTurn(): Promise<void>;

  /**
   * Прикрепить ресурс к следующей реплике. Адрес проверяется сразу: ресурс схемы, которую никто
   * не даёт, прочитать будет некому, и узнать об этом человек должен сейчас, а не после отправки.
   * Имя для чипа по умолчанию — последний сегмент адреса.
   */
  attach(ref: { readonly uri: string; readonly name?: string }): BridgeAttachOutcome;
  /** Открепить ресурс от следующей реплики. */
  detach(uri: string): void;
  /** Есть ли у кого искать ресурсы — иначе пикеру нечего показать. */
  canSearchResources(): boolean;
  /** Поиск ресурсов для пикера — по провайдерам, умеющим искать. */
  searchResources(query: string, signal: AbortSignal): Promise<readonly ResourceSearchGroup[]>;
}

/** Чем кончилась попытка прикрепить: исходы сессии плюс отказы по адресу. */
export type BridgeAttachOutcome = AttachOutcome | 'invalid' | 'unknown-scheme';

/**
 * Команда «ассистент: отменить последний ход».
 *
 * Живёт здесь, рядом с состоянием, которым распоряжается, а не среди прочих команд плагина:
 * `aiCommands` собирает команды ПРО ассистента (остановить ход, новый разговор), а эта правит
 * форму и обязана видеть, что именно ход оставил в буфере. Регистрирует её, как и остальные,
 * активация плагина.
 *
 * Блока `agent` у неё нет, и это то же решение, что у «остановить ход»: давать модели отмену
 * её собственного хода значило бы позволить ей переигрывать саму себя. Отмена — действие
 * человека над машиной, а не наоборот.
 */
export function aiUndoTurnCommand(bridge: AgentBridge): CommandContribution {
  return {
    id: AI_UNDO_TURN_COMMAND_ID,
    titleKey: 'command.undoTurn',
    enabled: () => bridge.canUndoTurn(),
    run: () => bridge.undoLastTurn(),
  };
}

/** Активная форма на момент вопроса: адрес, текст буфера и разобранная схема. */
interface Target {
  readonly resource: ResourceId;
  /** Путь документа от корня проекта — для модели и для подписи реплики. */
  readonly path: string;
  readonly baseText: string;
  readonly base: JsonFormSchema;
  readonly rules: FormRules;
}

/** Чем кончилась одна попытка: всё, что нужно, чтобы её закрыть или продолжить. */
interface TurnOutcome {
  readonly changeSet: ChangeSet;
  readonly reason: TurnReason;
  readonly message?: string;
  readonly stop?: AiStop;
}

/** Чем кончилась попытка хода режима файлов: набора изменений нет — записи уже в рабочей копии. */
interface FileOutcome {
  readonly reason: TurnReason;
  readonly message?: string;
  readonly stop?: AiStop;
}

/** Что стало с набором изменений. */
type Landing =
  | { readonly status: 'applied' }
  /** Применять было нечего. */
  | { readonly status: 'nothing' }
  /**
   * Набор ждёт решения пользователя: расхождение, невалидность или закрытая форма.
   *
   * `note` есть не всегда, и это существенно: замечание переводит реплику в статус ошибки, а
   * расхождение ошибкой не является — это штатная развилка с кнопками «Применить / Отклонить»,
   * и объясняет её предпросмотр изменений, а не красная строка.
   */
  | {
      readonly status: 'stuck';
      readonly pending: PendingChanges;
      readonly conflict: boolean;
      readonly note?: string;
    };

/** Один файл, который ход изменил: чем он был и чем его ход оставил. */
interface LandedFile {
  /** Текст ДО хода; `null` — файл ход создал. Для хода из двух попыток — до ПЕРВОЙ. */
  readonly before: string | null;
  /** Текст, который ход оставил. Им и проверяется, не писал ли кто-то после. */
  readonly after: string;
  /**
   * Чем читать и писать этот файл — той дверью, которой его писал ход. `document` — дверь
   * документа вкладки (`host.documentOf` / `host.writeText`), которая знает про составную форму;
   * `files` — порт файлов. На файл, а не на ход: структурный ход пишет форму дверью документа,
   * а инструмент плагина в том же ходе — портом файлов.
   */
  readonly access: 'document' | 'files';
}

/**
 * Ход ассистента, лёгший в рабочую копию, — всё, чем его можно отменить.
 *
 * Карта файлов, а не один текст: ход режима файлов правит сколько угодно файлов модуля, и
 * отменяться обязан целиком — одним действием и только если ни один из них после хода не
 * трогали. Структурный ход — та же карта из одной записи, документа активной вкладки.
 *
 * Живёт в памяти моста, а не в журнале рабочей области, и это ограничение названо честно:
 * журнал в композиции создаётся (`workspace-session`) и записи хода в нём помечены `txId`, но
 * `Journal.undoTransaction` плагинам не отдан — в `@reformer/builder-plugin-api` его нет.
 * `txId` при этом ТОТ ЖЕ, что уходит в пометку записи: когда отмену журнала откроют плагинам,
 * тело отмены заменяется вызовом `undoTransaction` с этим же идентификатором.
 */
interface LandedTurn {
  /** Идентификатор хода — он же `txId` пометки записи. */
  readonly txId: string;
  readonly files: ReadonlyMap<ResourceId, LandedFile>;
  /** Правила до хода — у структурного хода: ход, изменивший только их, иначе не отменялся бы. */
  readonly rules?: { readonly resource: ResourceId; readonly before: FormRules };
}

export function createAgentBridge(deps: BridgeDeps): AgentBridge {
  const { assistant, host, session } = deps;
  const t = host.translate;

  /** Управление текущим ходом: позволяет остановить его кнопкой. */
  let current: AbortController | null = null;

  /** Последний ход, лёгший в буфер, или `null`. См. {@link LandedTurn}. */
  let lastTurn: LandedTurn | null = null;

  /**
   * Запомнить последний ход — ТОЛЬКО так, а не присваиванием: доступность «Отменить ход» живёт в
   * сессии (`AiSessionState.undoable`), и кнопка узнаёт о ней по изменению сессии.
   */
  const setLastTurn = (turn: LandedTurn | null): void => {
    lastTurn = turn;
    session.setUndoable(turn !== null);
  };

  /**
   * Правила формы по документам — В ПАМЯТИ СЕССИИ, и это честно названное ограничение.
   *
   * Правила формы (`@/plugins/reformer/core/form-model`) — сайдкар: они лежат рядом со схемой отдельным
   * файлом. Плумбинга этого сайдкара в v2 ещё нет вовсе — валидатор схемы получает правила
   * параметром, и композиция сегодня не передаёт ничего. Пока файла нет, единственная
   * альтернатива памяти — отказать ассистенту в правилах совсем, то есть в валидации и
   * поведении формы. Память хуже файла, но лучше отказа: в пределах сессии `merge` работает
   * правильно, а карта правил уходит в затравку хода и модель их видит.
   *
   * Что при этом теряется, надо знать: перезагрузка страницы правила забудет.
   */
  const rulesByResource = new Map<ResourceId, FormRules>();

  /** Ресурсы плагинов: кого спросить по адресу и что сказать модели в затравке. */
  const resources = createResourceRouter(deps.resourceProviders ?? (() => []));

  /** Инструменты хода: встроенные режима плюс вклады плагинов — см. `./contributions`. */
  const surface = createContributionSurface({
    agentCommands: deps.agentCommands,
    executeCommand: deps.executeCommand,
    assistantTools: deps.assistantTools ?? (() => []),
    hasResources: () => resources.schemes().length > 0,
  });
  const toolsForTurn = () => surface.registryFor('structured', assistant.tools);
  const fileToolsForTurn = () => surface.registryFor('files', assistant.fileTools);

  /**
   * Ходы, лёгшие в рабочую копию мимо набора изменений, — по порядку: ходы режима файлов и
   * записи инструментов плагинов в структурных ходах. Из них «Восстановить» на реплике откатывает
   * все ходы от выбранного до последнего.
   */
  const landedTurns: LandedTurn[] = [];

  /**
   * Порядковый номер хода по `txId` — заводится при начале хода. Нужен «Восстановить»: ход, к
   * реплике которого возвращаются, мог не оставить ни одной записи, а откатить надо все ПОСЛЕ него.
   */
  const turnOrder = new Map<string, number>();
  const beginTurn = (): string => {
    const txId = newTurnId();
    turnOrder.set(txId, turnOrder.size);
    return txId;
  };

  /**
   * Почему ход не отдаёт ресурс инструменту плагина: документ формы и его шаги ход правит своим
   * механизмом, и вторая дверь к ним разошлась бы с первой. `null` — отдаёт.
   */
  const formPartRefusal = (
    id: ResourceId,
    form: ResourceId,
    scope: FileScope | null
  ): string | null => {
    const reason = 'The assistant edits the form document itself; a plugin tool cannot write it.';
    if (id === form) return reason;
    if (scope === null || host.files === undefined) return null;
    const rel = relInScope(host.files, scope, id);
    if (rel === null) return null;
    const role = fileRoleOf(rel, scope.schemaPath);
    return role === 'form' || role === 'step' ? reason : null;
  };

  /** Карточка, ждущая ответа, и как вернуть ответ ходу; `null` — никто не ждёт. */
  let asking: {
    readonly id: string;
    readonly count: number;
    readonly settle: (answers: readonly AskAnswer[]) => void;
  } | null = null;
  /** Счётчик карточек — для их идентификаторов, уникальных в пределах моста. */
  let asks = 0;

  /**
   * Спросить человека от имени хода: карточка уходит в ленту, а ход ждёт ответа. Остановка хода
   * снимает карточку — ход кончается, и ответ на неё некому принять.
   */
  const askerOf = (signal: AbortSignal): NonNullable<TurnScope['ask']> => {
    let asked = 0;
    return (questions) => {
      if (asked >= MAX_ASKS_PER_TURN) return Promise.resolve<AskOutcome>('limit');
      asked += 1;
      asks += 1;
      const id = `ask${String(asks)}`;
      session.askQuestions({ id, questions });
      return new Promise<AskOutcome>((resolve) => {
        const cancel = (): void => {
          asking = null;
          session.cancelAsks();
          resolve('cancelled');
        };
        if (signal.aborted) {
          cancel();
          return;
        }
        signal.addEventListener('abort', cancel, { once: true });
        asking = {
          id,
          count: questions.length,
          settle: (answers) => {
            signal.removeEventListener('abort', cancel);
            asking = null;
            resolve(answers);
          },
        };
      });
    };
  };

  /** Ход для инструментов плагинов, `read_resource` и `ask_user`. */
  const scopeOf = (writes: TurnWrites, signal: AbortSignal): TurnScope => ({
    signal,
    write: (resource, text, caller) => writes.write(resource, text, caller),
    readResource: resources.reader(signal),
    ask: askerOf(signal),
  });

  /**
   * Замечание в ленту, не трогая набор, ждущий решения.
   *
   * `finishTurn(null, …)` очистил бы `pending` — то есть отмена чужого хода молча выбросила бы
   * набор изменений, по которому человек ещё не решил. Поэтому текущий набор передаётся обратно
   * как есть: сообщение здесь ровно об отмене и ни о чём больше.
   */
  const note = (message: string): void => {
    session.finishTurn(session.get().pending, message);
  };

  /**
   * Запомнить приземлившийся ход — то, чем его потом отменять.
   *
   * Вторая попытка того же хода (тот же `txId`) НЕ заводит вторую запись и не переписывает
   * `before`: ход со второй попыткой ложится двумя записями, а отменяться обязан одним
   * действием и целиком — ровно тот довод, по которому `txId` заводится до первой попытки.
   * По той же причине запись того же хода не теряет файлов, которые в нём записали инструменты
   * плагинов: они легли раньше применения набора и отменяются вместе с ним.
   */
  const rememberTurn = (pending: PendingChanges): void => {
    const txId = pending.txId;
    // Без идентификатора хода отменять нечего: сложить две такие правки в один шаг не по чему,
    // и «отмена» сняла бы половину. Сегодня его проставляет `send`, то есть он есть всегда.
    if (txId === undefined) return;
    const document = host.documentOf(pending.resource);
    if (document === null) return;

    const previous = lastTurn !== null && lastTurn.txId === txId ? lastTurn : null;
    const earlier = previous?.files.get(pending.resource);
    const files = new Map(previous?.files ?? []);
    files.set(pending.resource, {
      before: earlier ? earlier.before : pending.baseText,
      after: document.getText(),
      access: 'document',
    });
    setLastTurn({
      txId,
      files,
      rules: {
        resource: pending.resource,
        before: earlier && previous?.rules ? previous.rules.before : pending.set.baseRules,
      },
    });
  };

  /**
   * Запомнить записи инструментов плагинов структурного хода — даже если набор изменений не лёг:
   * записи уже в рабочей копии, и отменять их надо независимо от судьбы набора.
   */
  const rememberWrites = (txId: string, writes: TurnWrites): void => {
    const written = writes.entries();
    if (written.size === 0) return;
    const files = new Map<ResourceId, LandedFile>(
      [...written].map(([id, file]) => [id, { ...file, access: 'files' as const }])
    );
    landedTurns.push({ txId, files });
    if (lastTurn !== null && lastTurn.txId === txId) {
      setLastTurn({ ...lastTurn, files: new Map([...lastTurn.files, ...files]) });
    } else {
      setLastTurn({ txId, files });
    }
  };

  /** Путь ресурса от корня проекта — для замечаний, называющих форму. */
  const pathOfResource = (id: ResourceId): string =>
    host.documentOf(id)?.ref.path ?? host.files?.pathOf(id) ?? String(id);

  /** Чтение и запись файла хода — той дверью, которой ход его писал. */
  const accessOf = (file: LandedFile) =>
    file.access === 'files' && host.files !== undefined
      ? { read: host.files.read.bind(host.files), write: host.files.write.bind(host.files) }
      : {
          read: (id: ResourceId) => Promise.resolve(host.documentOf(id)?.getText() ?? null),
          write: (id: ResourceId, text: string) => host.writeText(id, text),
        };

  /**
   * Форма хода или `null`: вкладки нет, документа нет либо текст — не схема формы.
   *
   * Без адреса — форма АКТИВНОЙ вкладки: так начинается ход. С адресом — та же форма, что у
   * первой попытки: вторая попытка продолжает ход, и правки обязаны лечь туда же, куда легли
   * правки первой, даже если человек тем временем открыл другую форму.
   */
  const resolveTarget = async (resource = host.activeResource()): Promise<Target | null> => {
    if (resource === null) return null;
    // Буфер мог отстать от структурного редактора, пока в фокусе был текстовый, — ход начинается
    // от того, что человек видит.
    if (host.documentOf(resource) !== null) await host.flush?.(resource);
    const document = host.documentOf(resource);
    if (document === null) return null;
    const baseText = document.getText();
    let base: JsonFormSchema;
    try {
      base = parseSchemaText(baseText);
    } catch {
      // Не диагностика, а ответ «править нечего»: про синтаксис скажет валидатор того, кто
      // за файл взялся, а ассистент правит только разбирающуюся схему.
      return null;
    }
    return {
      resource,
      path: document.ref.path,
      baseText,
      base,
      rules: rulesByResource.get(resource) ?? emptyRules(),
    };
  };

  /**
   * Форма прошлого хода — путь из снимка последней реплики пользователя, у которой он есть.
   * Читается ДО `startTurn`: иначе последней оказалась бы реплика этого же хода.
   */
  const previousFormPath = (): string | undefined => {
    const entries = session.get().entries;
    for (let i = entries.length - 1; i >= 0; i--) {
      const path = entries[i].snapshot?.path;
      if (path !== undefined) return path;
    }
    return undefined;
  };

  /** Одна строка журнала для вызова, принёсшего несколько правок. */
  const summaryOf = (ops: readonly ChangeOp[]): string => {
    const shown = ops.slice(0, OPS_IN_LOG).map((op) => op.summary);
    const rest = ops.length - shown.length;
    return `${shown.join('; ')}${rest > 0 ? ` +${rest}` : ''}`;
  };

  /**
   * Напечатать, чего стоил ход.
   *
   * В консоль, а не в панель: цена хода — материал для того, кто настраивает агента, а
   * пользователю формы она ничего не говорит и только шумит в ленте. Причина остановки и пик
   * входа печатаются рядом не для полноты: без них тихий обрыв нечем отличить от законченной
   * работы, а пик — единственная цифра, по которой видно, упёрся ли запрос в окно модели.
   */
  const report = (stats: TurnStats, stop?: AiStop): void => {
    const tokens = stats.inputTokens
      ? `, вход ${stats.inputTokens} (из кэша ${stats.cachedInputTokens}, пик шага ${stats.peakStepInputTokens}), выход ${stats.outputTokens}`
      : '';
    const why = stop?.reason ? `, остановка ${stop.reason}${stop.raw ? ` (${stop.raw})` : ''}` : '';
    const cut = stop?.truncatedCall ? `, оборван вызов ${stop.truncatedCall}` : '';
    const textual = stop?.textualCall ? `, вызов ${stop.textualCall} написан текстом` : '';
    console.info(`[plugins/reformer/ai] ход: шагов ${stats.steps}${tokens}${why}${cut}${textual}`);
  };

  /**
   * Одна попытка: провести ход и разложить его события по ленте.
   *
   * Отделена от {@link send} потому, что попыток может быть две, а реплика в ленте у них одна:
   * `startTurn` здесь не вызывается, и вторая попытка дописывает ту же реплику ассистента.
   * Фантомного «продолжай» от имени пользователя в ленте быть не должно — он этого не писал.
   */
  const runOnce = async (
    provider: AiProvider,
    target: Target,
    messages: Parameters<typeof runAgentTurn>[0]['messages'],
    signal: AbortSignal,
    scope: TurnScope,
    activeForm: ActiveForm
  ): Promise<TurnOutcome> => {
    // Пределы хода читаются здесь, а не в канале: это свойства ХОДА, а не соединения с моделью,
    // и владеть ими должен цикл. Настройки лежат рядом с ключом только потому, что там их задают.
    const config = await assistant.loadConfig();
    const maxSteps = config?.maxSteps;
    const maxInputTokens = config?.maxInputTokens;

    // Здесь же, одним ожиданием на ход: инструменты внутри хода синхронны, и гейт обязан
    // получить УЖЕ загруженную функцию. Отказ загрузки поднимается наружу — его ловит `send`
    // и показывает строкой ошибки: ход без гейта провести нельзя, а сделать вид можно.
    const validateForm = await deps.validateForm();

    // Значение по умолчанию на случай, если цикл почему-то не дошёл до `done`: штатно не бывает —
    // `runAgentTurn` выдаёт его даже поверх исключения, — но исход попытки должен быть объектом,
    // а не «объектом или undefined», иначе каждый читатель обязан помнить про этот случай.
    let outcome: TurnOutcome = {
      changeSet: createChangeSet(target.base, target.rules),
      reason: 'complete',
    };

    for await (const event of runAgentTurn({
      provider,
      registry: toolsForTurn(),
      catalog: host.catalog(),
      validateForm,
      base: target.base,
      baseRules: target.rules,
      messages,
      ...(maxSteps !== undefined ? { maxSteps } : {}),
      ...(maxInputTokens !== undefined ? { maxInputTokens } : {}),
      signal,
      scope,
      resourceSeed: resources.catalog(),
      activeForm,
    })) {
      if (event.type !== 'done') {
        consume(event);
        continue;
      }
      report(event.stats, event.stop);
      outcome = {
        changeSet: event.changeSet,
        reason: event.reason,
        ...(event.message ? { message: event.message } : {}),
        ...(event.stop ? { stop: event.stop } : {}),
      };
    }
    return outcome;
  };

  /**
   * Приземлить правки хода, не закрывая реплику.
   *
   * Отделено от закрытия ради второй попытки: между попытками правки обязаны попасть в буфер
   * (иначе продолжение пойдёт от старой схемы), а вот статус реплики менять рано — ход ещё
   * идёт, и промежуточное «готово» мигало бы в панели.
   *
   * `txId` — ОДИН на обе попытки, поэтому он приходит параметром, а не заводится здесь:
   * ход со второй попыткой приземляется двумя записями журнала, и отменять его человек
   * должен одним действием, а не по одной попытке.
   */
  const land = async (outcome: TurnOutcome, target: Target, txId: string): Promise<Landing> => {
    const set = outcome.changeSet;
    if (!hasChanges(set)) return { status: 'nothing' };

    const pending: PendingChanges = {
      set,
      resource: target.resource,
      baseText: target.baseText,
      txId,
    };
    const applied = await applyChangeSet({ host, validateForm: deps.validateForm }, pending);
    if (applied.status === 'applied') {
      // Правила уезжают в память вместе с применением, а не раньше: набор, который не лёг,
      // не должен менять то, от чего пойдёт следующий ход.
      rulesByResource.set(target.resource, set.draftRules);
      rememberTurn(pending);
      return { status: 'applied' };
    }
    if (applied.status === 'empty') return { status: 'nothing' };
    // Расхождение замечания не получает намеренно: набор уходит в предпросмотр с кнопками
    // решения, и это не отказ, а развилка. Красная строка перевела бы реплику в статус ошибки.
    if (applied.status === 'conflict') return { status: 'stuck', pending, conflict: true };

    const note =
      applied.status === 'invalid'
        ? t('turn.notApplied.invalid', { errors: applied.errors.slice(0, 2).join('; ') })
        : applied.status === 'failed'
          ? t('turn.notApplied.failed', { error: messageOf(applied.error) })
          : t('turn.notApplied.closed');
    return { status: 'stuck', pending, conflict: false, note };
  };

  /**
   * Замечание к ходу, который не изменил форму и ничего не сказал.
   *
   * Такой ход выглядит как зависание: лента пуста, форма прежняя, ошибки нет. Наблюдалось
   * вживую — модель тратила весь вывод на рассуждение и обрывалась, не дойдя до первого вызова
   * инструмента, а пользователь видел ровно ничего.
   *
   * Ход, в котором модель ОТВЕТИЛА текстом, замечания не получает: «покажи, что в форме» —
   * законный вопрос, и форму он менять не обязан.
   *
   * Обе ветки называют одну и ту же починку. Раньше подсказку про окно контекста получал только
   * ход БЕЗ вызовов, а ход с вызовами — сухую констатацию: разница выглядела осмысленной, но
   * чинятся эти два исхода одинаково.
   */
  const silentTurnNote = (): string | undefined => {
    const last = session.get().entries.at(-1);
    if (!last || last.role !== 'assistant') return undefined;
    if (last.text.trim().length > 0) return undefined;
    const fix = t('turn.silent.fix');
    return last.tools.length > 0 ? t('turn.silent.tools', { fix }) : t('turn.silent.none', { fix });
  };

  /**
   * Замечание к ходу, который ОТВЕТИЛ, но формы не изменил, потому что все его правки отказали.
   *
   * Модель, получив отказы, нередко всё равно пишет «готово, добавил поле» — по тексту ход
   * выглядит успешным, а форма на экране прежняя. Так бывает, когда модель бьёт по адресам из
   * разговора о другой форме. Ход, где отказало только чтение, замечания не получает: чтение
   * форму не меняет и не обещает.
   */
  const failedEditsNote = (): string | undefined => {
    const last = session.get().entries.at(-1);
    if (!last || last.role !== 'assistant' || last.text.trim().length === 0) return undefined;
    const failed = last.tools.find((tool) => !tool.ok && tool.readOnly !== true);
    if (failed === undefined) return undefined;
    return t('turn.failedEdits', { error: failed.error ?? failed.name });
  };

  /**
   * Замечание к ходу без правок: тихий ход либо ход, все правки которого отказали. Остановленный
   * пользователем ход замечания не получает — «ассистент ничего не сделал» после нажатой кнопки
   * «Остановить» было бы неправдой о том, кто остановил работу.
   */
  const noEditsNote = (reason: TurnReason): string | undefined =>
    reason === 'aborted' ? undefined : (silentTurnNote() ?? failedEditsNote());

  /**
   * Закрыть ход: перевести реплику в покой, ошибку или ожидание решения.
   *
   * Подтверждать каждый ход кнопкой не нужно — отменить его можно и после: у реплики
   * пользователя есть снимок формы, и «Восстановить» возвращает всё, как было. Это дешевле для
   * внимания: обычный исход не требует решения, а редкий — требует.
   *
   * @param wrote - Писали ли в ходе инструменты плагинов: такой ход не молчаливый, даже если
   *   набор изменений пуст.
   */
  const closeTurn = (outcome: TurnOutcome, landed: Landing, wrote = false): void => {
    const error = outcome.reason === 'error' ? (outcome.message ?? t('turn.error')) : undefined;

    if (landed.status === 'stuck') {
      if (landed.conflict) session.setConflict(true);
      session.finishTurn(landed.pending, error ?? landed.note);
      return;
    }
    if (landed.status === 'nothing') {
      session.finishTurn(null, error ?? (wrote ? undefined : noEditsNote(outcome.reason)));
      return;
    }
    session.finishTurn(null, error);
  };

  /**
   * Стоит ли пробовать ещё раз.
   *
   * Условие узкое намеренно: повтор осмыслен ровно там, где модель знала, что делать, и правка
   * не состоялась, — недописанный вызов, пустой конец хода, вызов текстом ({@link missedEdit}).
   * Предел шагов, бюджет и фильтр содержимого повтором не лечатся, а остановку кнопкой
   * пользователь заказал сам.
   *
   * Попытка ровно одна, и это по конструкции — второй заход делается без цикла. Обрыв,
   * повторённый дважды, означает, что задача не влезает в окно модели, и третий заход только
   * сожжёт время.
   */
  const needsSecondPass = (outcome: TurnOutcome, landed: Landing, signal: AbortSignal): boolean => {
    if (signal.aborted || outcome.reason === 'aborted') return false;
    if (!missedEdit(outcome.stop)) return false;
    // Застрявший набор ждёт решения пользователя: второй ход поверх неприменённых правок
    // собирал бы форму, которой на экране нет.
    return landed.status !== 'stuck';
  };

  /** Ход структурного режима: черновик схемы, применение одной записью. */
  const sendStructured = async (
    message: string,
    provider: AiProvider,
    signal: AbortSignal,
    attached: ResolvedAttachments
  ): Promise<void> => {
    const target = await resolveTarget();
    if (target === null) {
      session.startTurn(message, undefined, attached.refs);
      session.finishTurn(null, t('turn.noForm'));
      return;
    }
    const activeForm: ActiveForm = { path: target.path, previousPath: previousFormPath() };

    // Идентификатор хода заводится ДО первой попытки и один на обе: логический шаг —
    // это ход, а не попытка. Он же уедет в журнал как `txId` записи ассистента, а в снимке
    // реплики по нему «Восстановить» найдёт записи инструментов плагинов этого хода и следующих.
    const txId = beginTurn();
    // Снимок берётся ДО хода: он же станет точкой восстановления на реплике пользователя.
    session.startTurn(
      message,
      {
        resource: target.resource,
        path: target.path,
        text: target.baseText,
        rules: target.rules,
        txId,
      },
      attached.refs
    );
    const withAttached = (): AiMessage[] => [
      ...historyFor(session.get().entries),
      ...(attached.message ? [attached.message] : []),
    ];

    const formScope = host.files?.scopeOf(target.resource) ?? null;
    const writes = createTurnWrites({
      files: host.files,
      mark: { origin: 'agent', txId },
      refuse: (id) => formPartRefusal(id, target.resource, formScope),
    });
    const scope = scopeOf(writes, signal);

    try {
      const first = await runOnce(provider, target, withAttached(), signal, scope, activeForm);
      const landed = await land(first, target, txId);

      if (!needsSecondPass(first, landed, signal)) {
        closeTurn(first, landed, writes.count > 0);
        return;
      }

      // База берётся заново: правки первой попытки уже в буфере, и второй ход должен идти от
      // них — это ровно то, что делает пользователь, когда пишет «продолжай». Форма — та же,
      // что у первой попытки, а не активная: человек мог открыть другую, пока модель думала.
      const next = await resolveTarget(target.resource);
      if (next === null) {
        closeTurn(first, landed, writes.count > 0);
        return;
      }
      const second = await runOnce(
        provider,
        next,
        [...withAttached(), { role: 'user', content: secondPassHint(first.stop) }],
        signal,
        scope,
        activeForm
      );
      closeTurn(second, await land(second, next, txId), writes.count > 0);
    } catch (error) {
      // Ход не должен уметь оставить панель в «running» навсегда: цикл ошибки не бросает,
      // но чтение настроек и запись в буфер — могут.
      closeTurn(
        {
          changeSet: createChangeSet(target.base, target.rules),
          reason: 'error',
          message: messageOf(error),
        },
        { status: 'nothing' },
        writes.count > 0
      );
    } finally {
      // Записи инструментов плагинов уже в рабочей копии — запоминаются при любом исходе хода.
      writes.close();
      rememberWrites(txId, writes);
    }
  };

  /** Чтение файла модуля по пути от его корня. */
  const readerOf =
    (files: AiFiles, scope: FileScope) =>
    (rel: string): Promise<string | null> =>
      files.read(files.resolve(scope.root, ...rel.split('/')));

  /**
   * Ход режима файлов: модель правит файлы модуля формы, каждая принятая запись — сразу в
   * рабочую копию.
   *
   * @returns `false` — режим файлов к этой вкладке неприменим (нет формы с папкой модуля), и ход
   *   идёт структурным: тот скажет про отсутствие формы своими словами, а документ со свободным
   *   именем править умеет.
   */
  const sendFiles = async (
    message: string,
    provider: AiProvider,
    files: AiFiles,
    signal: AbortSignal,
    attached: ResolvedAttachments
  ): Promise<boolean> => {
    const resource = host.activeResource();
    const scope = resource === null ? null : files.scopeOf(resource);
    if (scope === null) {
      if (resource !== null && host.documentOf(resource) !== null) {
        console.info('[plugins/reformer/ai] у документа нет папки модуля — ход идёт структурным');
      }
      return false;
    }

    const read = readerOf(files, scope);
    const start = await composeForm(read, scope.schemaPath);
    if (!start.ok) {
      // Ход по форме, которая не собирается, начинать нельзя: гейт сравнивает каждую запись с
      // формой на начало хода, и сравнивать было бы не с чем.
      session.startTurn(message, undefined, attached.refs);
      session.finishTurn(null, t('turn.files.broken', { error: start.error }));
      return true;
    }

    const path = files.pathOf(scope.document);
    const activeForm: ActiveForm = { path, previousPath: previousFormPath() };
    const txId = beginTurn();
    session.startTurn(
      message,
      { mode: 'files', resource: scope.document, path, txId },
      attached.refs
    );
    const withAttached = (): AiMessage[] => [
      ...historyFor(session.get().entries),
      ...(attached.message ? [attached.message] : []),
    ];
    const journal = createFileJournal();
    const mark: WriteMark = { origin: 'agent', txId };
    // Запись инструмента плагина в файл модуля идёт в журнал хода — так её видят листинг модуля
    // и отмена; документ формы и шаги ему не отдаются: их запись проходит гейт хода.
    const writes = createTurnWrites({
      files,
      mark,
      refuse: (id) => formPartRefusal(id, scope.document, scope),
      module: { journal, relOf: (id) => relInScope(files, scope, id) },
    });
    const turnScope = scopeOf(writes, signal);

    try {
      const config = await assistant.loadConfig();
      const validateForm = await deps.validateForm();
      const attempt = async (
        base: JsonFormSchema,
        messages: readonly AiMessage[]
      ): Promise<FileOutcome> => {
        const turn = createFileTurn({
          files,
          scope,
          journal,
          mark,
          base,
          knowledge: assistant.knowledge,
        });
        let outcome: FileOutcome = { reason: 'complete' };
        for await (const event of runFileTurn({
          provider,
          registry: fileToolsForTurn(),
          turn,
          catalog: host.catalog(),
          validateForm,
          messages,
          ...(config?.maxSteps !== undefined ? { maxSteps: config.maxSteps } : {}),
          ...(config?.maxInputTokens !== undefined
            ? { maxInputTokens: config.maxInputTokens }
            : {}),
          signal,
          scope: turnScope,
          resourceSeed: resources.catalog(),
          activeForm,
        })) {
          if (event.type === 'done') {
            report(event.stats, event.stop);
            outcome = {
              reason: event.reason,
              ...(event.message ? { message: event.message } : {}),
              ...(event.stop ? { stop: event.stop } : {}),
            };
          } else consume(event);
        }
        return outcome;
      };

      let last = await attempt(start.schema, withAttached());
      if (needsFileSecondPass(last, signal)) {
        // База — заново из файлов: записи первой попытки уже лежат в рабочей копии.
        const next = await composeForm(read, scope.schemaPath);
        if (next.ok) {
          last = await attempt(next.schema, [
            ...withAttached(),
            { role: 'user', content: secondPassHint(last.stop) },
          ]);
        }
      }
      // Дверь плагинов закрывается ДО нормализации: перепечатка — последняя запись хода.
      writes.close();
      await normalizeSchemas(files, scope, journal, mark);

      const error = last.reason === 'error' ? (last.message ?? t('turn.error')) : undefined;
      const silent = journal.size === 0 && writes.count === 0;
      session.finishTurn(null, error ?? (silent ? noEditsNote(last.reason) : undefined));
    } catch (error) {
      session.finishTurn(null, messageOf(error));
    } finally {
      // Даже ход, упавший посередине, отменяем: его записи уже лежат в рабочей копии.
      writes.close();
      rememberFileTurn(txId, journal, writes);
    }
    return true;
  };

  /** Записать событие хода в ленту — общее для обоих режимов. */
  function consume(event: TurnStepEvent): void {
    // Вопрос модели показывает его карточка — строка журнала повторяла бы её.
    if (event.type === 'tool' && event.name === askUserTool.name) return;
    switch (event.type) {
      case 'text':
        session.appendText(event.text, event.start === true);
        break;
      case 'reasoning':
        session.appendReasoning(event.text, event.start === true);
        break;
      case 'tool':
        session.logTool({
          name: event.name,
          ok: event.ok,
          // Журнал панели — строка на ВЫЗОВ, а не на правку: пакетная вставка двенадцати
          // полей не должна превращать ленту в двенадцать одинаковых записей. Детали пакета
          // видны в предпросмотре изменений, где им и место.
          ...(event.ops?.length ? { summary: summaryOf(event.ops) } : {}),
          ...(event.error ? { error: event.error.message } : {}),
          ...(event.readOnly ? { readOnly: true } : {}),
        });
        break;
    }
  }

  /** Вторая попытка хода режима файлов — по тем же признакам обрыва, что у структурного. */
  const needsFileSecondPass = (outcome: FileOutcome, signal: AbortSignal): boolean =>
    !signal.aborted && outcome.reason !== 'aborted' && missedEdit(outcome.stop);

  /**
   * Перепечатать схемы, которые ход записал, принтером документа формы — один раз, в конце хода.
   *
   * Не после каждой записи: перепечатка меняет текст, который модель держит в контексте, и её
   * следующий `old_string` не нашёлся бы. Гейт проверяет смысл и от форматирования не зависит,
   * поэтому в пределах хода текст остаётся таким, каким его написала модель, а в конце хода —
   * таким, каким его пишут редактор и кодоген: иначе ход давал бы diff на весь файл.
   *
   * Файл, который после хода правил человек, не трогается: перепечатка стёрла бы его правку.
   */
  const normalizeSchemas = async (
    files: AiFiles,
    scope: FileScope,
    journal: FileJournal,
    mark: WriteMark
  ): Promise<void> => {
    for (const [id, entry] of journal.entries()) {
      const role = fileRoleOf(entry.rel, scope.schemaPath);
      if (role !== 'form' && role !== 'step') continue;
      const current = await files.read(id);
      if (current !== entry.after) continue;
      let printed: string;
      try {
        printed =
          role === 'form'
            ? printSchemaText(parseSchemaText(current))
            : printJson(JSON.parse(current));
      } catch {
        continue;
      }
      if (printed === current) continue;
      await files.write(id, printed, mark);
      journal.record(id, entry.rel, entry.before, printed);
    }
  };

  /**
   * Откатить записи хода `txId` и всех ходов после него, лёгшие мимо набора изменений.
   *
   * Ходы откатываются от новейшего к старому — каждый пишет то, что было до него, и последним
   * пишет самый ранний, то есть итог — состояние до `txId`. Перезапись безусловная, как у
   * структурного «Восстановить»: её заказал человек, увидев, к чему возвращается, — в отличие от
   * отмены хода, которая поверх чужой правки отказывает.
   *
   * Пометки происхождения нет — по той же причине, что у структурного восстановления.
   *
   * @returns `false` — запись отказала, и об этом уже сказано в ленте.
   */
  const revertFrom = async (txId: string): Promise<boolean> => {
    // Ход без записей в списке не лежит — поэтому ищется по номеру хода, а не по месту в списке:
    // откатить надо всё, что легло ПОСЛЕ него, даже если сам он ничего не записал.
    const from = turnOrder.get(txId) ?? Number.POSITIVE_INFINITY;
    const undone = landedTurns.filter((turn) => (turnOrder.get(turn.txId) ?? -1) >= from);
    landedTurns.splice(0, landedTurns.length, ...landedTurns.filter((t) => !undone.includes(t)));
    const created: string[] = [];
    try {
      for (const turn of undone.reverse()) {
        for (const [id, file] of turn.files) {
          if (file.before === null) created.push(id);
          else await accessOf(file).write(id, file.before);
        }
      }
    } catch (error) {
      session.finishTurn(null, t('turn.restoreFailed', { error: messageOf(error) }));
      return false;
    }
    if (created.length > 0) note(t('turn.undo.created', { files: created.join(', ') }));
    return true;
  };

  /**
   * Запомнить ход режима файлов — то, чем его отменять и восстанавливать: журнал модуля и записи
   * инструментов плагинов вне модуля.
   */
  const rememberFileTurn = (txId: string, journal: FileJournal, writes: TurnWrites): void => {
    const files = new Map<ResourceId, LandedFile>();
    for (const [id, entry] of journal.entries()) {
      files.set(id, { before: entry.before, after: entry.after, access: 'files' });
    }
    for (const [id, file] of writes.entries()) files.set(id, { ...file, access: 'files' });
    if (files.size === 0) return;
    const turn: LandedTurn = { txId, files };
    setLastTurn(turn);
    landedTurns.push(turn);
  };

  return {
    isRunning: () => current !== null,

    abort() {
      current?.abort();
    },

    async send(text) {
      const message = text.trim();
      if (message === '' || current !== null) return;

      const provider = assistant.providers.firstEditing();
      if (provider === undefined) {
        session.startTurn(message, undefined, session.get().attachments);
        session.finishTurn(null, t('turn.noProvider'));
        return;
      }

      // Новый запрос при неприменённом наборе прошлого хода — решение «двигаться дальше»: набор
      // отбрасывается, и об этом остаётся строка в реплике, которая его принесла. Молча он терялся
      // в конце следующего хода, а кнопки предпросмотра всё это время писали старый черновик.
      const pending = session.get().pending;
      if (pending !== null) {
        session.logTool({ name: 'apply', ok: false, error: t('turn.pending.dropped') });
        session.resolvePending();
      }

      // Ход занимается СРАЗУ, до первого ожидания: иначе второе нажатие, пришедшее, пока
      // читаются настройки, начало бы второй ход поверх первого.
      const controller = new AbortController();
      current = controller;
      try {
        // Прикреплённое читается до начала хода: его содержимое уходит в первый же запрос,
        // а чип непрочитанного должен показать причину на самой реплике.
        const attached = await resolveAttachments(
          session.get().attachments,
          resources.reader(controller.signal)
        );
        // Настройки читаются, только если режим файлов вообще возможен: без порта файлов ход
        // идёт структурным, и лишнее ожидание отодвинуло бы начало хода без всякой причины.
        if (host.files !== undefined && (await assistant.loadConfig())?.editMode === 'files') {
          if (await sendFiles(message, provider, host.files, controller.signal, attached)) return;
        }
        await sendStructured(message, provider, controller.signal, attached);
      } finally {
        current = null;
      }
    },

    attach(ref) {
      const parsed = parseAssistantResourceUri(ref.uri);
      if (parsed === null) return 'invalid';
      if (!resources.schemes().includes(parsed.scheme)) return 'unknown-scheme';
      const name =
        ref.name !== undefined && ref.name !== ''
          ? ref.name
          : (parsed.rest.split('/').filter(Boolean).at(-1) ?? ref.uri);
      return session.attach({ uri: ref.uri, name });
    },

    detach(uri) {
      session.detach(uri);
    },

    answer(cardId, answers) {
      if (asking === null || asking.id !== cardId || answers.length !== asking.count) return false;
      const clean: AskAnswer[] = answers.map((answer) => {
        const own = answer.text?.trim().slice(0, ANSWER_TEXT_LIMIT) ?? '';
        return { selected: [...answer.selected], ...(own !== '' ? { text: own } : {}) };
      });
      if (clean.some((answer) => answer.selected.length === 0 && answer.text === undefined)) {
        return false;
      }
      if (!session.answerAsk(cardId, clean)) return false;
      asking.settle(clean);
      return true;
    },

    canSearchResources: () => resources.canSearch(),

    searchResources: (query, signal) => resources.search(query, signal),

    async applyPending(force = false) {
      const pending = session.get().pending;
      // Во время хода набор прошлого хода уже отброшен (`send`), а поверх идущего хода его
      // черновик записал бы форму, от которой ход давно ушёл.
      if (pending === null || current !== null) return;
      const outcome = await applyChangeSet({ host, validateForm: deps.validateForm }, pending, {
        force,
      });
      switch (outcome.status) {
        case 'applied':
          rulesByResource.set(pending.resource, pending.set.draftRules);
          // Отложенное применение — тот же ход, просто приземлившийся позже: `txId` набор
          // пережил ровно ради этого, и отменяться такой ход обязан так же, как обычный.
          rememberTurn(pending);
          session.resolvePending();
          break;
        case 'empty':
          session.resolvePending();
          break;
        case 'conflict':
          session.setConflict(true);
          break;
        case 'no-form':
          session.finishTurn(pending, t('turn.notApplied.closed'));
          break;
        case 'invalid':
          session.finishTurn(
            pending,
            t('turn.notApplied.invalid', { errors: outcome.errors.slice(0, 2).join('; ') })
          );
          break;
        case 'failed':
          session.finishTurn(
            pending,
            t('turn.notApplied.failed', { error: messageOf(outcome.error) })
          );
          break;
      }
    },

    rejectPending() {
      session.resolvePending();
    },

    async restoreTo(entryId) {
      if (current !== null) return;
      const snapshot = session.restoreTo(entryId);
      if (snapshot === null) return;
      if (isFilesSnapshot(snapshot)) {
        if (await revertFrom(snapshot.txId)) setLastTurn(null);
        return;
      }
      // Записи инструментов плагинов этого хода и следующих — первыми: форма вернётся снимком.
      if (snapshot.txId !== undefined && !(await revertFrom(snapshot.txId))) return;
      // Возврат идёт тем же `writeText`, что и правка: восстановление — обычная правка буфера,
      // а не отдельный механизм, поэтому оно и в журнале обычная запись, и отменяется само.
      //
      // Пометки происхождения у неё нет намеренно: восстановление заказал ЧЕЛОВЕК, нажав
      // кнопку, — и в журнале оно обязано выглядеть его правкой, а не ходом ассистента.
      try {
        await host.writeText(snapshot.resource, snapshot.text);
        rulesByResource.set(snapshot.resource, snapshot.rules);
        // Отменять после этого нечего: форма вернулась к состоянию ДО хода, и та же отмена,
        // применённая поверх, вернула бы её к состоянию до какого-то другого хода.
        setLastTurn(null);
      } catch (error) {
        session.finishTurn(null, t('turn.restoreFailed', { error: messageOf(error) }));
      }
    },

    canUndoTurn: () => current === null && lastTurn !== null,

    async undoLastTurn() {
      // Ход идёт — молча: кнопка и пункт палитры в это время недоступны (`enabled`), и
      // замечание было бы объяснением того, чего человек не делал.
      if (current !== null) return 'running';

      const turn = lastTurn;
      if (turn === null) {
        note(t('turn.undo.nothing'));
        return 'nothing';
      }

      // Сначала проверяются ВСЕ файлы, и только потом пишется хоть один: отмена, снявшая
      // половину хода и упёршаяся в перекрытый файл, оставила бы форму в состоянии, которого
      // не было ни до хода, ни после.
      for (const [id, file] of turn.files) {
        const text = await accessOf(file).read(id);
        if (text === null) {
          note(t('turn.undo.closed'));
          return 'closed';
        }
        if (text !== file.after) {
          // Сравнение с тем, что ход ОСТАВИЛ, а не с тем, что было до него: правка человека
          // поверх хода перемешана с ним в одном тексте, и вернуть форму к состоянию до хода
          // значило бы стереть её. См. заголовок метода в {@link AgentBridge}.
          note(t('turn.undo.overlapped'));
          return 'overlapped';
        }
      }

      const created: string[] = [];
      try {
        for (const [id, file] of turn.files) {
          if (file.before === null) created.push(id);
          else await accessOf(file).write(id, file.before);
        }
      } catch (error) {
        note(t('turn.undo.failed', { error: messageOf(error) }));
        return 'failed';
      }
      if (turn.rules) rulesByResource.set(turn.rules.resource, turn.rules.before);
      // Созданный ходом файл удалить нечем: удаления в рабочей копии у плагинов нет. Он
      // остаётся, и об этом сказано словами — молча оставленный файл выглядел бы отменённым.
      if (created.length > 0) {
        note(t('turn.undo.created', { files: created.join(', ') }));
      } else {
        // Ход шёл по форме, которой сейчас нет на экране, — отмена правит её, и человек, глядящий
        // на другую форму, иначе не увидел бы ничего.
        const active = host.activeResource();
        const [first] = turn.files.keys();
        if (first !== undefined && (active === null || !turn.files.has(active))) {
          note(t('turn.undo.otherForm', { path: pathOfResource(first) }));
        }
      }
      // Дважды один ход не отменяется: второе нажатие иначе сняло бы предыдущий ход,
      // о котором человек в этот момент не думает.
      setLastTurn(null);
      return 'undone';
    },

    reset() {
      if (current !== null) return false;
      session.reset();
      // Отмена хода из прошлого разговора правила бы форму по реплике, которой уже не видно, а
      // «Восстановить» искало бы записи ходов, от которых не осталось реплик.
      setLastTurn(null);
      landedTurns.length = 0;
      turnOrder.clear();
      return true;
    },

    async requestUndoTurn() {
      try {
        await deps.executeCommand(AI_UNDO_TURN_COMMAND_ID);
      } catch (error) {
        // Сюда попадает и «команда не зарегистрирована»: реестр отвечает на это отказом,
        // и молчание сделало бы кнопку неотличимой от сработавшей.
        note(t('turn.undo.failed', { error: messageOf(error) }));
      }
    },
  };
}

/**
 * Идентификатор хода — он же `txId` записи журнала.
 *
 * Идентификаторы реплик сессии (`m1`, `m2`, …) на эту роль не годятся: они считаются от нуля
 * в каждом экземпляре сессии, а журнал переживает перезагрузку — после неё `m1` нового
 * разговора совпал бы с `m1` вчерашнего, и `undoTransaction` откатил бы чужой ход.
 *
 * Запасной путь на случай отсутствия `crypto.randomUUID` — тот же, что у ключей хэндлов
 * в `app/project`: время плюс случайное число. Уникальности «в пределах журнала» этого хватает.
 */
function newTurnId(): string {
  const api = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (typeof api?.randomUUID === 'function') return api.randomUUID();
  return `turn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Текст исключения для показа человеку. */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
