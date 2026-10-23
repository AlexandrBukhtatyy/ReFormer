/**
 * Набор инструментов хода: встроенные инструменты режима плюс вклады плагинов.
 *
 * ## Вклады — три рода, один потолок
 *
 * Сверх встроенных модель получает `read_resource` (если есть провайдер ресурсов), инструменты
 * плагинов (точка `reformer.assistant.tool`) и команды с блоком `agent`. Всё это уходит модели тем
 * же списком определений и стоит столько же, поэтому меряется вместе — потолком
 * {@link CONTRIBUTED_TOOL_SURFACE_BUDGET}, отдельным от храповика встроенных: состав вкладов
 * известен только в рантайме и зависит от включённых плагинов.
 *
 * ## Что не влезло — отбрасывается, а ход идёт
 *
 * Вклады принимаются по порядку: `read_resource`, затем инструменты плагинов в порядке вкладов,
 * затем команды. Вклад, переполнивший потолок, отбрасывается, а следующий меньший ещё может
 * поместиться. Отказать в ходе из-за чужого вклада значило бы наказать пользователя за чужую
 * ошибку, но и промолчать нельзя — поэтому каждый отказ пишется в консоль, один раз на состав.
 *
 * ## Память — по подписи состава
 *
 * Набор собирается на каждый ход, а пересобирается — только когда состав изменился: иначе каждый
 * ход заново компилировал бы схемы аргументов. Подпись — всё, что уходит модели, и встроенный
 * реестр: у каждого стека форм свой, и документ другого стека меняет набор целиком.
 *
 * @module plugins/reformer/ai/session/contributions
 */

import { commandTools, type AgentCommand, type ExecuteCommand } from '../tools/command-tools';
import {
  contributedTool,
  contributedToolProblem,
  type ContributedToolEntry,
  type ContributionRejectionCode,
} from '../tools/contributed-tools';
import { readResourceTool } from '../tools/read-resource';
import type { FormAgentTool, FormToolContext, FormToolOutcome } from '@reformer/builder-plugin-api';
import {
  createToolRegistry,
  measureToolSurface,
  type ToolRegistry,
} from '@reformer/builder-toolkit';
import { CONTRIBUTED_TOOL_SURFACE_BUDGET } from '../budgets';

/** Режим хода — у каждого свой набор встроенных и своя память. */
export type SurfaceMode = 'structured' | 'files';

/** Отвергнутый вклад: откуда, как назывался и почему. */
export interface DroppedContribution {
  /** Плагин инструмента или идентификатор команды. */
  readonly source: string;
  readonly name: string;
  readonly code: ContributionRejectionCode;
}

/** Что нужно сборке от плагина и моста. */
export interface ContributionSurfaceDeps {
  /** Команды с блоком `agent` — `CommandRegistry.agentCommands()`. */
  readonly agentCommands: () => readonly AgentCommand[];
  readonly executeCommand: ExecuteCommand;
  /** Вклады точки инструментов — `ctx.extensions.get(AssistantToolPoint)`. */
  readonly assistantTools: () => readonly ContributedToolEntry[];
  /** Есть ли провайдеры ресурсов — от этого зависит, нужен ли `read_resource`. */
  readonly hasResources: () => boolean;
}

/** Инструмент вклада — в объёме, нужном набору. */
type AnyTool = FormAgentTool<never, never>;

export interface ContributionSurface {
  /** Реестр хода: встроенные режима плюс принятые вклады. */
  registryFor<C extends FormToolContext>(
    mode: SurfaceMode,
    builtin: ToolRegistry<C, FormToolOutcome>
  ): ToolRegistry<C, FormToolOutcome>;
  /** Отвергнутые при последней сборке режима — для тестов и диагностики. */
  dropped(mode: SurfaceMode): readonly DroppedContribution[];
}

/** Кандидат в набор: инструмент и то, чем назвать его в диагностике. */
interface Candidate {
  readonly source: string;
  readonly tool: AnyTool;
}

export function createContributionSurface(deps: ContributionSurfaceDeps): ContributionSurface {
  /** Память режима: подпись состава, встроенный реестр, собранный реестр и отказы. */
  const memo = new Map<
    SurfaceMode,
    {
      signature: string;
      builtin: unknown;
      registry: ToolRegistry<never, FormToolOutcome>;
      dropped: DroppedContribution[];
    }
  >();

  const signatureOf = (
    commands: readonly AgentCommand[],
    tools: readonly ContributedToolEntry[],
    resources: boolean
  ): string =>
    JSON.stringify([
      resources,
      tools.map(({ pluginId, value }) => [
        pluginId,
        value.name,
        value.description,
        value.inputSchema,
        value.readOnly,
      ]),
      commands.map((command) => [command.id, command.agent.description, command.agent.schema]),
    ]);

  const build = <C extends FormToolContext>(
    builtin: ToolRegistry<C, FormToolOutcome>,
    commands: readonly AgentCommand[],
    tools: readonly ContributedToolEntry[],
    resources: boolean
  ): { registry: ToolRegistry<C, FormToolOutcome>; dropped: DroppedContribution[] } => {
    const own = builtin.list();
    const taken = new Set(own.map((tool) => tool.name));
    const dropped: DroppedContribution[] = [];
    const candidates: Candidate[] = [];

    const claim = (source: string, tool: AnyTool): void => {
      if (taken.has(tool.name)) {
        // Молчаливая подмена хуже отказа: модель звала бы одно, а получала другое.
        dropped.push({ source, name: tool.name, code: 'name-taken' });
        return;
      }
      taken.add(tool.name);
      candidates.push({ source, tool });
    };

    if (resources) claim('reformer.ai', readResourceTool as AnyTool);
    for (const { pluginId, value } of tools) {
      const problem = contributedToolProblem(value);
      if (problem !== null) {
        dropped.push({ source: pluginId, name: String(value.name), code: problem });
        continue;
      }
      // Вклад ищется заново на каждый вызов — см. «Живой вклад» в `tools/contributed-tools`.
      const lookup = () =>
        deps
          .assistantTools()
          .find((entry) => entry.pluginId === pluginId && entry.value.name === value.name)?.value;
      claim(pluginId, contributedTool(value, lookup));
    }
    const projection = commandTools(commands, deps.executeCommand, [...taken]);
    for (const rejection of projection.rejected) {
      dropped.push({
        source: rejection.commandId,
        name: rejection.commandId,
        code: rejection.code,
      });
    }
    // Имя спроецированной команды и есть её идентификатор в `snake_case` — им она и названа.
    for (const tool of projection.tools) candidates.push({ source: tool.name, tool });

    // Первый подходящий по порядку: вклад, переполнивший потолок, не закрывает дорогу меньшим.
    const admitted: AnyTool[] = [];
    for (const candidate of candidates) {
      if (measureToolSurface([...admitted, candidate.tool]) > CONTRIBUTED_TOOL_SURFACE_BUDGET) {
        dropped.push({ source: candidate.source, name: candidate.tool.name, code: 'over-budget' });
        continue;
      }
      admitted.push(candidate.tool);
    }

    const all = [...own, ...admitted];
    return { registry: createToolRegistry<C, FormToolOutcome>(all), dropped };
  };

  const report = (mode: SurfaceMode, dropped: readonly DroppedContribution[]): void => {
    for (const drop of dropped) {
      console.error(
        `[plugins/reformer/ai] вклад «${drop.name}» (${drop.source}) не вошёл в инструменты ` +
          `хода (${mode}): ${drop.code}` +
          (drop.code === 'over-budget'
            ? ` — потолок вкладов CONTRIBUTED_TOOL_SURFACE_BUDGET = ${String(CONTRIBUTED_TOOL_SURFACE_BUDGET)}`
            : '')
      );
    }
  };

  return {
    registryFor<C extends FormToolContext>(
      mode: SurfaceMode,
      builtin: ToolRegistry<C, FormToolOutcome>
    ) {
      const commands = deps.agentCommands();
      const tools = deps.assistantTools();
      const resources = deps.hasResources();
      if (commands.length === 0 && tools.length === 0 && !resources) {
        // Вкладов нет — реестр плагина годится как есть, и пересобирать его значило бы заново
        // компилировать схемы аргументов на каждый ход без единой причины.
        memo.delete(mode);
        return builtin;
      }

      const signature = signatureOf(commands, tools, resources);
      const known = memo.get(mode);
      if (known !== undefined && known.signature === signature && known.builtin === builtin) {
        return known.registry as unknown as ToolRegistry<C, FormToolOutcome>;
      }
      const built = build(builtin, commands, tools, resources);
      memo.set(mode, {
        signature,
        builtin,
        registry: built.registry as unknown as ToolRegistry<never, FormToolOutcome>,
        dropped: built.dropped,
      });
      report(mode, built.dropped);
      return built.registry;
    },

    dropped: (mode) => memo.get(mode)?.dropped ?? [],
  };
}
