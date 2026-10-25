/**
 * Плагин «MCP-серверы»: серверы проекта — инструментами ассистента.
 *
 * Два вида серверов: бандлы проекта (`.ui_builder/mcp/<имя>/server.js`, Web Worker, MCP через
 * `postMessage`) и удалённые из `.mcp.json` (Streamable HTTP или SSE прямо из браузера). Модель
 * видит их через два инструмента фасада (`./assistant/facade`) — сколько бы серверов ни было.
 *
 * ## Почему отдельный плагин, а не часть ассистента
 *
 * У MCP своё состояние — воркеры, соединения, значения переменных — и своя панель. Ассистент о
 * нём не знает ничего, кроме точек SDK: инструменты приходят вкладом `AssistantToolPoint`, ресурсы
 * продолжения — вкладом `AssistantResourcePoint`. Выключенный плагин снимает всё разом.
 *
 * ## Что делает активация
 *
 * Только читает конфигурацию: ни один воркер не запускается, ни одно соединение не открывается
 * (`./connection/supervisor`). Инструменты модели вносятся, только если в проекте есть сервер, к
 * которому можно подключиться, — иначе фасад занимал бы поверхность хода зря.
 *
 * Перечитывается конфигурация на смену проекта, на правку `.mcp.json` или файлов
 * `.ui_builder/mcp/` и командой `mcp.reload`: слежения за диском у источника нет.
 *
 * @module plugins/forms/mcp/plugin
 */

import { createElement, type ReactElement } from 'react';
import { Plug } from 'lucide-react';
import { Button } from '@reformer/ui-kit/button';
import {
  AssistantResourcePoint,
  AssistantToolPoint,
  definePlugin,
  PanelPoint,
  type Disposable,
  type PanelContribution,
  type Plugin,
  type PluginContext,
} from '@reformer/builder-plugin-api';
import { createFacadeTools } from './assistant/facade';
import { createResultsProvider, createResultStore } from './assistant/results';
import { createMcpManager, type McpManager } from './connection/manager';
import { lazyOpeners } from './connection/openers';
import type { SessionOpeners } from './connection/session';
import type { Clock, SupervisorPolicy } from './connection/supervisor';
import { BUNDLED_SERVERS_DIR, MCP_JSON, MCP_PLUGIN_ID } from './contract';
import type { McpHost } from './host';
import { MCP_MESSAGES } from './messages';
import { McpPanel } from './ui/McpPanel';
import { mcpWorkspace } from './workspace';

export { MCP_PLUGIN_ID };

/** Панель MCP: правый док, у нижнего края рейла — рядом с ассистентом, которому она служит. */
export const MCP_PANEL_ID = 'mcp.servers';

/** Команда «перечитать серверы проекта». */
export const MCP_RELOAD_COMMAND_ID = 'mcp.reload';

/** Задержка перечитывания после правки конфигурации: серия сохранений — одно перечитывание. */
const RELOAD_DEBOUNCE_MS = 500;

/** Что можно подставить снаружи — тестам. */
export interface McpPluginOptions {
  readonly host?: McpHost;
  readonly openers?: SessionOpeners;
  readonly policy?: Partial<SupervisorPolicy>;
  readonly clock?: Clock;
}

const PanelIcon = (): ReactElement => createElement(Plug, { className: 'size-4' });

/** Панель. Отдельно от `activate`, чтобы тест звал её без реестров. */
export function mcpPanel(host: McpHost, manager: McpManager): PanelContribution {
  return {
    id: MCP_PANEL_ID,
    slot: 'panel.right',
    titleKey: 'panel.title',
    icon: PanelIcon,
    order: 25,
    railPlacement: 'bottom',
    Body: () => createElement(McpPanel, { host, manager }),
    Actions: () => createElement(ReloadAction, { host, manager }),
  };
}

function ReloadAction({ host, manager }: { host: McpHost; manager: McpManager }): ReactElement {
  const t = host.useTranslate();
  return createElement(
    Button,
    { size: 'xs', variant: 'ghost', onClick: () => void manager.reload() },
    t('action.reload')
  );
}

/**
 * Вклады в ассистента — по наличию запускаемых серверов.
 *
 * Пересчитываются на каждое изменение менеджера: серверы появляются и исчезают с конфигурацией,
 * а держать фасад в поверхности хода, когда звать некого, незачем.
 */
function syncAssistantContributions(ctx: PluginContext, manager: McpManager): Disposable {
  const results = createResultStore();
  const tools = createFacadeTools(manager, results);
  const provider = createResultsProvider(manager, results);
  let contributed: Disposable[] | null = null;

  const sync = () => {
    const wanted = manager.snapshot().launchable;
    if (wanted && contributed === null) {
      contributed = [
        ...tools.map((tool) =>
          ctx.extensions.contribute(AssistantToolPoint, tool, { id: tool.name })
        ),
        ctx.extensions.contribute(AssistantResourcePoint, provider, {
          id: `${MCP_PLUGIN_ID}.results`,
        }),
      ];
    } else if (!wanted && contributed !== null) {
      for (const contribution of contributed) contribution.dispose();
      contributed = null;
    }
  };

  const unsubscribe = manager.subscribe(sync);
  sync();
  return {
    dispose() {
      unsubscribe();
      for (const contribution of contributed ?? []) contribution.dispose();
      contributed = null;
    },
  };
}

/** Правка конфигурации серверов: `.mcp.json` в корне или что-то в `.ui_builder/mcp/`. */
function touchesConfig(host: McpHost, changed: readonly string[]): boolean {
  const root = host.projectRoot();
  if (root === null) return false;
  const mcpJson = host.resolve(root, MCP_JSON);
  const bundles = host.resolve(root, ...BUNDLED_SERVERS_DIR);
  return changed.some((id) => id === mcpJson || id.startsWith(`${bundles}/`));
}

export function createMcpPlugin(options: McpPluginOptions = {}): Plugin {
  return definePlugin({
    id: MCP_PLUGIN_ID,
    activate(ctx: PluginContext) {
      for (const [locale, messages] of Object.entries(MCP_MESSAGES)) {
        ctx.i18n.contribute(locale, messages);
      }

      const host = options.host ?? mcpWorkspace(ctx);
      const manager = createMcpManager({
        host,
        openers: options.openers ?? lazyOpeners(),
        ...(options.policy === undefined ? {} : { policy: options.policy }),
        ...(options.clock === undefined ? {} : { clock: options.clock }),
      });

      const reload = () => {
        void manager.reload().catch((error: unknown) => {
          console.warn('[plugins/forms/mcp] серверы проекта не перечитаны', error);
        });
      };

      ctx.subscriptions.push(syncAssistantContributions(ctx, manager));
      ctx.subscriptions.push(
        ctx.extensions.contribute(PanelPoint, mcpPanel(host, manager), { id: MCP_PANEL_ID })
      );
      ctx.subscriptions.push(
        ctx.commands.register({
          id: MCP_RELOAD_COMMAND_ID,
          titleKey: 'command.reload',
          run: reload,
        })
      );

      // Проект открывают и закрывают при живом плагине: серверы — того проекта, что открыт сейчас.
      let root = host.projectRoot();
      ctx.subscriptions.push(
        host.onDidChangeProject(() => {
          const next = host.projectRoot();
          if (next === root) return;
          root = next;
          reload();
        })
      );

      let pending: ReturnType<typeof setTimeout> | undefined;
      ctx.subscriptions.push(
        host.onDidChangeFiles((changed) => {
          if (!touchesConfig(host, changed)) return;
          if (pending !== undefined) clearTimeout(pending);
          pending = setTimeout(() => {
            pending = undefined;
            reload();
          }, RELOAD_DEBOUNCE_MS);
        })
      );

      ctx.subscriptions.push({
        dispose: () => {
          if (pending !== undefined) clearTimeout(pending);
          void manager.dispose();
        },
      });

      // Заказ, а не ожидание: `activate` только регистрирует. Читается одна конфигурация —
      // ни воркеров, ни сети.
      reload();
    },
  });
}
