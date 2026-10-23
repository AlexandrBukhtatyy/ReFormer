/**
 * Стеки форм, подключённые к ассистенту.
 *
 * Стеки приходят точкой `FormAssistantStackPoint` и читаются на каждый ход: плагин стека вправе
 * подняться позже ассистента или выключиться посреди сессии. Подключается стек лениво и один раз —
 * сеанс держит память стека (правила по документам, загруженную проверку), и пересоздавать его на
 * каждый ход значило бы её терять. Стек, который сняли и внесли заново, — новый объект и новый сеанс.
 *
 * Документ берёт первый стек, который за него берётся (`applies`), — по провайдеру модели, тем же
 * признаком, что у поверхностей превью.
 *
 * @module plugins/reformer/ai/session/stacks
 */

import type {
  DocumentRef,
  FormAgentTool,
  FormAssistantStack,
  FormStackHost,
  FormStackSession,
  FormToolContext,
  FormToolOutcome,
  FormToolSlot,
} from '@reformer/builder-plugin-api';
import { createToolRegistry, type ToolRegistry } from '@reformer/builder-toolkit';

/** Реестр инструментов хода, каким его видит ассистент. */
export type StackToolRegistry = ToolRegistry<FormToolContext, FormToolOutcome>;

/** Режим правки — у каждого свой список инструментов стека. */
export type StackMode = 'structured' | 'files';

/** Стек, подключённый к ассистенту. */
export interface ConnectedStack {
  readonly id: string;
  readonly session: FormStackSession;
  /**
   * Встроенные инструменты режима — собираются один раз на сеанс: схемы аргументов статичны, а
   * каталог и черновик приходят контекстом вызова. `null` — режима файлов у стека нет.
   */
  registry(mode: 'structured'): StackToolRegistry;
  registry(mode: StackMode): StackToolRegistry | null;
}

/** Стеки ассистента. */
export interface StackSet {
  /** Есть ли хоть один стек. */
  any(): boolean;
  /** Стек, который берётся за документ, или `null`. */
  forDocument(document: DocumentRef): ConnectedStack | null;
  /** Стек по идентификатору — тот, что разобрал документ хода; `null` — его сняли. */
  byId(id: string): ConnectedStack | null;
  /** Первый стек — его промпт у хода без открытой формы. */
  first(): ConnectedStack | null;
}

/** Из чего собирается набор. */
export interface StackSetDeps {
  /** Вклады точки стеков — на каждый вопрос. */
  readonly stacks: () => readonly FormAssistantStack[];
  /** Двери рабочей области для стеков. */
  readonly host: FormStackHost;
  /** Инструмент ассистента по имени в списке стека. */
  readonly hostTool: (name: Extract<FormToolSlot, string>) => FormAgentTool<never, never>;
}

export function createStackSet(deps: StackSetDeps): StackSet {
  const connected = new WeakMap<FormAssistantStack, ConnectedStack>();

  const connect = (stack: FormAssistantStack): ConnectedStack => {
    const known = connected.get(stack);
    if (known !== undefined) return known;
    const session = stack.connect(deps.host);
    const registries = new Map<StackMode, StackToolRegistry>();
    function registry(mode: 'structured'): StackToolRegistry;
    function registry(mode: StackMode): StackToolRegistry | null;
    function registry(mode: StackMode): StackToolRegistry | null {
      const slots = mode === 'structured' ? session.structured.tools : session.files?.tools;
      if (slots === undefined) return null;
      let built = registries.get(mode);
      if (built === undefined) {
        const tools = slots.map((slot) => (typeof slot === 'string' ? deps.hostTool(slot) : slot));
        built = createToolRegistry<FormToolContext, FormToolOutcome>(tools);
        registries.set(mode, built);
      }
      return built;
    }
    const entry: ConnectedStack = { id: stack.id, session, registry };
    connected.set(stack, entry);
    return entry;
  };

  return {
    any: () => deps.stacks().length > 0,
    forDocument(document) {
      const stack = deps.stacks().find((candidate) => candidate.applies(document));
      return stack === undefined ? null : connect(stack);
    },
    byId(id) {
      const stack = deps.stacks().find((candidate) => candidate.id === id);
      return stack === undefined ? null : connect(stack);
    },
    first() {
      const [stack] = deps.stacks();
      return stack === undefined ? null : connect(stack);
    },
  };
}
