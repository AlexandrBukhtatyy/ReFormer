/**
 * Плагин ассистента — точка входа.
 *
 * Наружу выставлено ровно то, что нужно композиции (собрать плагин, зарегистрировать словарь,
 * подставить порт платформы) и внешнему потребителю сервиса. Внутренности — реестр, гейт,
 * дайджест каталога, мост — доступны по своим путям тем, кто их и правит; тянуть их через эту
 * точку незачем: барьер здесь не для сокрытия, а чтобы состав зависимости было видно в одном
 * файле.
 *
 * @module plugins/ai/index
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
  createValidateFormLoader,
  type AiAssistant,
  type AiPluginOptions,
} from './plugin';

// Порт платформы: его подставляет композиция.
export type { AiDocument, AiHost, MessageSink, Translate, WriteMark } from './host';

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
export {
  applyChangeSet,
  isStale,
  type ApplyDeps,
  type ApplyOptions,
  type ApplyOutcome,
} from './session/apply';
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

// Ход агента: чистое ядро, которым пользуется мост.
export { runAgentTurn, type AgentTurnOptions, type TurnEvent, type TurnStats } from './loop/loop';
export { createChangeSet, describeChangeSet, hasChanges, type ChangeSet } from './model/changeset';
export { createEditorToolRegistry, createReadOnlyToolRegistry } from './tools';
export type { ToolRegistry } from './tools/registry';
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
export { measureToolSurface } from './tools/tool-surface';
export type { ChangeOp, ChangeOpKind, ToolError, ToolErrorCode } from './model/types';
// Проверка по мета-схеме: грузится по требованию, приходит параметром — см. `core/validate`.
export type { LoadValidateForm, ValidateFormSchema } from './model/validate';

// Каналы к модели.
export { createProviderRegistry, type ProviderRegistry } from './providers/registry';
export type { AiMessage, AiProvider, AiStop } from './providers/types';

// Корпус знаний: мост отдаёт ему чтение файлов проекта.
export { createKnowledgeLoader, type KnowledgeLoader, type PackageFiles } from './knowledge';
