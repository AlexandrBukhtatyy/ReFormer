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
 * ## Инструменты хода = встроенные + проекция команд
 *
 * Набор собирается на каждый ход, а не на активацию: команды приходят и уходят вместе с
 * плагинами, и ход обязан видеть те, что зарегистрированы СЕЙЧАС. Пересборка мемоизируется по
 * подписи набора — иначе каждый ход платил бы компиляцией схем аргументов заново.
 *
 * Здесь же — механическая проверка храповика поверхности: набор известен только в рантайме,
 * поэтому измерение живёт рядом со сборкой. Превышение потолка — ошибка автора команды, и она
 * попадает в консоль немедленно, а не всплывает счётом провайдера через неделю.
 *
 * @module plugins/ai/session/bridge
 */

import type { JsonFormSchema } from '@reformer/renderer-json';
import { emptyRules, type FormRules } from '@/lib/form-model/rules';
import type { CommandContribution, ResourceId } from '@/sdk';
import { applyChangeSet } from './apply';
import { createChangeSet, hasChanges, type ChangeSet } from '../model/changeset';
import { commandTools, type AgentCommand, type ExecuteCommand } from '../tools/command-tools';
import { runAgentTurn, type TurnEvent, type TurnStats } from '../loop/loop';
import { createToolRegistry, type ToolRegistry } from '../tools/registry';
import { measureToolSurface } from '../tools/tool-surface';
import { TOOL_SURFACE_BUDGET, type ChangeOp } from '../model/types';
import type { LoadValidateForm } from '../model/validate';
import type { AiHost } from '../host';
import { historyFor } from './history';
import type { AiAssistant } from '../plugin';
import type { AiProvider, AiStop } from '../providers/types';
import { parseSchemaText } from '../model/schema-text';
import type { AiSession, PendingChanges } from './session';

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

/** Сколько правок пакета называть в журнале, прежде чем свернуть остаток в счёт. */
const OPS_IN_LOG = 3;

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
}

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

/**
 * Ход ассистента, лёгший в буфер, — всё, чем его можно отменить.
 *
 * Живёт в памяти моста, а не в журнале рабочей области, и это ограничение названо честно:
 * `Journal.undoTransaction` умеет ровно это и переживал бы перезагрузку, но журнал в
 * композиции сегодня не создаётся вовсе — `createWorkspace` зовут без него, и `record()`
 * не вызывается ни разу. Отмена поверх журнала была бы кнопкой, которой всегда нечего
 * отменять. `txId` при этом ТОТ ЖЕ, что уходит в пометку записи: когда журнал подключат,
 * тело отмены заменяется одним вызовом `undoTransaction` с этим же идентификатором.
 */
interface LandedTurn {
  readonly resource: ResourceId;
  /** Идентификатор хода — он же `txId` пометки записи. */
  readonly txId: string;
  /** Текст буфера ДО хода. Для хода из двух попыток — до ПЕРВОЙ. */
  readonly before: string;
  /** Правила до хода: ход, изменивший только их, иначе не отменялся бы вовсе. */
  readonly beforeRules: FormRules;
  /** Текст, который ход оставил в буфере. Им и проверяется, не писал ли кто-то после. */
  readonly after: string;
}

export function createAgentBridge(deps: BridgeDeps): AgentBridge {
  const { assistant, host, session } = deps;
  const t = host.translate;

  /** Управление текущим ходом: позволяет остановить его кнопкой. */
  let current: AbortController | null = null;

  /** Последний ход, лёгший в буфер, или `null`. См. {@link LandedTurn}. */
  let lastTurn: LandedTurn | null = null;

  /**
   * Правила формы по документам — В ПАМЯТИ СЕССИИ, и это честно названное ограничение.
   *
   * Правила формы (`@/lib/form-model/rules`) — сайдкар: они лежат рядом со схемой отдельным
   * файлом. Плумбинга этого сайдкара в v2 ещё нет вовсе — валидатор схемы получает правила
   * параметром, и композиция сегодня не передаёт ничего. Пока файла нет, единственная
   * альтернатива памяти — отказать ассистенту в правилах совсем, то есть в валидации и
   * поведении формы. Память хуже файла, но лучше отказа: в пределах сессии `merge` работает
   * правильно, а карта правил уходит в затравку хода и модель их видит.
   *
   * Что при этом теряется, надо знать: перезагрузка страницы правила забудет.
   */
  const rulesByResource = new Map<ResourceId, FormRules>();

  /** Мемоизация набора инструментов: подпись проекции команд + сам реестр. */
  let toolsSignature: string | null = null;
  let toolsRegistry: ToolRegistry | null = null;

  /**
   * Инструменты хода: встроенные плюс проекция команд.
   *
   * Проверка храповика — здесь, потому что полный набор существует только здесь: встроенные
   * известны на сборке и меряются тестом (`core/tool-surface.test.ts`), а команды приходят от
   * включённых плагинов.
   */
  const toolsForTurn = (): ToolRegistry => {
    const builtin = assistant.tools.list();
    const commands = deps.agentCommands();
    const signature = commands.map((c) => `${c.id} ${c.agent.description}`).join('');
    if (toolsRegistry !== null && toolsSignature === signature) return toolsRegistry;

    if (commands.length === 0) {
      // Ничего не спроецировано — реестр плагина годится как есть, и пересобирать его значило
      // бы заново компилировать схемы аргументов на каждый ход без единой причины.
      toolsSignature = signature;
      toolsRegistry = assistant.tools;
      return toolsRegistry;
    }

    const projection = commandTools(
      commands,
      deps.executeCommand,
      builtin.map((tool) => tool.name)
    );
    for (const rejection of projection.rejected) {
      console.error(
        `[plugins/ai] команда «${rejection.commandId}» не стала инструментом: ${rejection.code}`
      );
    }
    const all = [...builtin, ...projection.tools];
    const surface = measureToolSurface(all);
    if (surface > TOOL_SURFACE_BUDGET) {
      // Не отказ: поверхность уже собрана, и оборвать из-за неё ход значило бы наказать
      // пользователя за чужую команду. Но и промолчать нельзя — платится это каждым шагом.
      //
      // Потолок равен достигнутому размеру встроенных инструментов, БЕЗ запаса, поэтому первая
      // же команда с блоком `agent` его переполнит — и это задумано: поднять потолок обязан
      // человек, отдельной строкой рядом с обоснованием, а не побочный эффект чужой правки.
      console.error(
        `[plugins/ai] поверхность инструментов ${surface} символов при потолке ` +
          `${TOOL_SURFACE_BUDGET}: сожмите описания или поднимите TOOL_SURFACE_BUDGET осознанно ` +
          `(команды с блоком agent: ${projection.tools.map((tool) => tool.name).join(', ')})`
      );
    }
    toolsSignature = signature;
    toolsRegistry = createToolRegistry(all);
    return toolsRegistry;
  };

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
   */
  const rememberTurn = (pending: PendingChanges): void => {
    const txId = pending.txId;
    // Без идентификатора хода отменять нечего: сложить две такие правки в один шаг не по чему,
    // и «отмена» сняла бы половину. Сегодня его проставляет `send`, то есть он есть всегда.
    if (txId === undefined) return;
    const document = host.documentOf(pending.resource);
    if (document === null) return;

    const previous = lastTurn;
    const continues =
      previous !== null && previous.txId === txId && previous.resource === pending.resource;
    lastTurn = {
      resource: pending.resource,
      txId,
      before: continues ? previous.before : pending.baseText,
      beforeRules: continues ? previous.beforeRules : pending.set.baseRules,
      after: document.getText(),
    };
  };

  /** Активная форма или `null`: вкладки нет, документа нет либо текст — не схема формы. */
  const resolveTarget = (): Target | null => {
    const resource = host.activeResource();
    if (resource === null) return null;
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
    return { resource, baseText, base, rules: rulesByResource.get(resource) ?? emptyRules() };
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
    console.info(`[plugins/ai] ход: шагов ${stats.steps}${tokens}${why}${cut}`);
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
    signal: AbortSignal
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
    })) {
      switch (event.type) {
        case 'text':
          session.appendText(event.text);
          break;
        case 'reasoning':
          session.appendReasoning(event.text);
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
          });
          break;
        case 'done':
          report(event.stats, event.stop);
          outcome = {
            changeSet: event.changeSet,
            reason: event.reason,
            ...(event.message ? { message: event.message } : {}),
            ...(event.stop ? { stop: event.stop } : {}),
          };
          break;
      }
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
   * Закрыть ход: перевести реплику в покой, ошибку или ожидание решения.
   *
   * Подтверждать каждый ход кнопкой не нужно — отменить его можно и после: у реплики
   * пользователя есть снимок формы, и «Восстановить» возвращает всё, как было. Это дешевле для
   * внимания: обычный исход не требует решения, а редкий — требует.
   */
  const closeTurn = (outcome: TurnOutcome, landed: Landing): void => {
    const error = outcome.reason === 'error' ? (outcome.message ?? t('turn.error')) : undefined;

    if (landed.status === 'stuck') {
      if (landed.conflict) session.setConflict(true);
      session.finishTurn(landed.pending, error ?? landed.note);
      return;
    }
    if (landed.status === 'nothing') {
      session.finishTurn(null, error ?? silentTurnNote());
      return;
    }
    session.finishTurn(null, error);
  };

  /**
   * Стоит ли пробовать ещё раз.
   *
   * Условие узкое намеренно: повтор осмыслен ровно там, где модель знала, что делать, и не
   * успела это выговорить, — недописанный вызов и пустой конец хода. Предел шагов, бюджет и
   * фильтр содержимого повтором не лечатся, а остановку кнопкой пользователь заказал сам.
   *
   * Попытка ровно одна, и это по конструкции — второй заход делается без цикла. Обрыв,
   * повторённый дважды, означает, что задача не влезает в окно модели, и третий заход только
   * сожжёт время.
   */
  const needsSecondPass = (outcome: TurnOutcome, landed: Landing, signal: AbortSignal): boolean => {
    if (signal.aborted || outcome.reason === 'aborted') return false;
    if (outcome.stop?.truncatedCall === undefined && outcome.stop?.emptyFinish !== true) {
      return false;
    }
    // Застрявший набор ждёт решения пользователя: второй ход поверх неприменённых правок
    // собирал бы форму, которой на экране нет.
    return landed.status !== 'stuck';
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
        session.startTurn(message);
        session.finishTurn(null, t('turn.noProvider'));
        return;
      }

      const target = resolveTarget();
      if (target === null) {
        session.startTurn(message);
        session.finishTurn(null, t('turn.noForm'));
        return;
      }

      // Снимок берётся ДО хода: он же станет точкой восстановления на реплике пользователя.
      session.startTurn(message, {
        resource: target.resource,
        text: target.baseText,
        rules: target.rules,
      });
      const controller = new AbortController();
      current = controller;
      // Идентификатор хода заводится ДО первой попытки и один на обе: логический шаг —
      // это ход, а не попытка. Он же уедет в журнал как `txId` записи ассистента.
      const txId = newTurnId();

      try {
        const first = await runOnce(
          provider,
          target,
          historyFor(session.get().entries),
          controller.signal
        );
        const landed = await land(first, target, txId);

        if (!needsSecondPass(first, landed, controller.signal)) {
          closeTurn(first, landed);
          return;
        }

        // База берётся заново: правки первой попытки уже в буфере, и второй ход должен идти от
        // них — это ровно то, что делает пользователь, когда пишет «продолжай».
        const next = resolveTarget();
        if (next === null) {
          closeTurn(first, landed);
          return;
        }
        const second = await runOnce(
          provider,
          next,
          [...historyFor(session.get().entries), { role: 'user', content: CONTINUE_HINT }],
          controller.signal
        );
        closeTurn(second, await land(second, next, txId));
      } catch (error) {
        // Ход не должен уметь оставить панель в «running» навсегда: цикл ошибки не бросает,
        // но чтение настроек и запись в буфер — могут.
        closeTurn(
          {
            changeSet: createChangeSet(target.base, target.rules),
            reason: 'error',
            message: messageOf(error),
          },
          { status: 'nothing' }
        );
      } finally {
        current = null;
      }
    },

    async applyPending(force = false) {
      const pending = session.get().pending;
      if (pending === null) return;
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
        lastTurn = null;
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

      const document = host.documentOf(turn.resource);
      if (document === null) {
        note(t('turn.undo.closed'));
        return 'closed';
      }
      if (document.getText() !== turn.after) {
        // Сравнение с тем, что ход ОСТАВИЛ, а не с тем, что было до него: правка человека
        // поверх хода перемешана с ним в одном тексте, и вернуть форму к состоянию до хода
        // значило бы стереть её. См. заголовок метода в {@link AgentBridge}.
        note(t('turn.undo.overlapped'));
        return 'overlapped';
      }

      try {
        await host.writeText(turn.resource, turn.before);
      } catch (error) {
        note(t('turn.undo.failed', { error: messageOf(error) }));
        return 'failed';
      }
      rulesByResource.set(turn.resource, turn.beforeRules);
      // Дважды один ход не отменяется: второе нажатие иначе сняло бы предыдущий ход,
      // о котором человек в этот момент не думает.
      lastTurn = null;
      return 'undone';
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
