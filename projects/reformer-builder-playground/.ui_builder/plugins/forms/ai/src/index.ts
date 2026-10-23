/**
 * Плагин ассистента — точка входа.
 *
 * Наружу выставлено ровно то, что нужно композиции (собрать плагин, зарегистрировать словарь,
 * подставить порт платформы) и внешнему потребителю сервиса. Внутренности — мост, каналы,
 * панель — доступны по своим путям тем, кто их и правит; тянуть их через эту точку незачем:
 * барьер здесь не для сокрытия, а чтобы состав зависимости было видно в одном файле.
 *
 * Бочка — для тестов и соседей по монорепозиторию. Оболочка грузит плагин из `./main`.
 *
 * @module plugins/forms/ai/index
 */

export { AI_MESSAGES } from './messages';
export {
  AI_PANEL_ID,
  AI_PLUGIN_ID,
  AI_RESET_COMMAND_ID,
  AI_SERVICE_TOKEN,
  AI_STOP_COMMAND_ID,
  aiChatPanel,
  aiCommands,
  createAiAssistant,
  createAiPlugin,
  type AiAssistant,
  type AiPluginOptions,
} from './plugin';

// Порт платформы: его подставляет композиция.
export type { AiDocument, AiHost, MessageSink, Translate, WriteMark } from './host';

// Рабочую область ассистент собирает из возможностей САМ: порта у него больше нет.
export { aiWorkspace } from './workspace';

// Настройки канала: их правит панель, их читает мост.
export {
  clearProviderConfig,
  DEFAULT_LOCAL_BASE_URL,
  limitsFrom,
  loadProviderConfig,
  PROVIDER_LABEL_KEY,
  PROVIDER_ORIGIN,
  saveProviderConfig,
  type ConfigStore,
  type LimitFields,
  type ProviderConfig,
  type ProviderKind,
  type ProviderLimits,
  type ProviderSettings,
  type SaveOptions,
} from './session/config';

// Мост: ход агента поверх рабочей области — то, ради чего плагин существует.
export { createAgentBridge, type AgentBridge, type BridgeDeps } from './session/bridge';
export { isStale } from './session/apply';
export {
  createAiSession,
  type AgentStatus,
  type AiSession,
  type AiSessionState,
  type ChatEntry,
  type PendingChanges,
  type ToolLogEntry,
  type TurnSnapshot,
} from './session/session';
export { assistantContent, historyFor, HISTORY_BUDGET } from './session/history';
export { createStackSet, type ConnectedStack, type StackSet } from './session/stacks';

// Команды с блоком `agent` — инструменты модели.
export {
  commandTools,
  toolNameForCommand,
  type AgentCommand,
  type AgentCommandSpec,
  type CommandProjection,
  type CommandRejection,
  type CommandRejectionCode,
  type ExecuteCommand,
} from './tools/command-tools';
export { measureToolSurface } from '@reformer/builder-toolkit';

// Каналы к модели.
export { createProviderRegistry, type ProviderRegistry } from './providers/registry';
export type { AiMessage, AiProvider, AiStop } from './providers/types';
