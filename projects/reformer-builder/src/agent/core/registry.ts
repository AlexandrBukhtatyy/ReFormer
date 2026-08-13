/**
 * Реестр инструментов редактора: единственная точка, через которую вызываются операции.
 *
 * Реестр берёт на себя ровно то, что иначе пришлось бы дублировать в каждом инструменте и в каждом
 * будущем адаптере: резолв имени, валидацию аргументов против `inputSchema`, бюджет ответа и
 * защиту от исключений. Инструмент остаётся чистой функцией над схемой.
 *
 * Адаптеронезависимость сознательная: реестр ничего не знает о том, кто его вызвал — панель чата,
 * тест или (в будущем) внешний агент. Появление второго потребителя не потребует его правок.
 *
 * @module reformer-builder/agent/core/registry
 */

import Ajv, { type ValidateFunction } from 'ajv';
import { similarNames } from './suggest';
import {
  fail,
  TOOL_TEXT_BUDGET,
  type AgentTool,
  type ToolContext,
  type ToolOutcome,
} from './types';

/** Реестр инструментов. */
export interface ToolRegistry {
  /** Инструменты, опционально отфильтрованные по признаку read-only. */
  list(filter?: { readOnly?: boolean }): readonly AgentTool[];
  get(name: string): AgentTool | undefined;
  /** Вызвать инструмент. Никогда не бросает — ошибка возвращается как {@link ToolOutcome}. */
  invoke(name: string, params: unknown, ctx: ToolContext): ToolOutcome;
}

/** Обрезать текст до бюджета, обозначив факт обрезки. */
function clamp(text: string, budget: number): string {
  if (text.length <= budget) return text;
  const suffix = '… (response truncated)';
  return `${text.slice(0, Math.max(0, budget - suffix.length))}${suffix}`;
}

/** ajv-ошибки → одна человекочитаемая строка. */
function formatErrors(validate: ValidateFunction): string {
  const parts = (validate.errors ?? []).map((e) =>
    `${e.instancePath || '/'} ${e.message ?? 'invalid'}`.trim()
  );
  return parts.length ? parts.join('; ') : 'arguments do not match the schema';
}

/**
 * Собрать реестр.
 *
 * @param tools - Инструменты; имена обязаны быть уникальными.
 * @throws Если имя инструмента повторяется — это ошибка сборки, а не рантайма.
 */
export function createToolRegistry(tools: readonly AgentTool[]): ToolRegistry {
  const byName = new Map<string, AgentTool>();
  for (const tool of tools) {
    if (byName.has(tool.name)) {
      throw new Error(`createToolRegistry: инструмент "${tool.name}" объявлен дважды`);
    }
    byName.set(tool.name, tool);
  }

  // Компиляция ленивая и кэшируется: схемы статичны, а ajv-компиляция заметно дороже вызова.
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validators = new Map<string, ValidateFunction>();
  const validatorFor = (tool: AgentTool): ValidateFunction => {
    let v = validators.get(tool.name);
    if (!v) {
      v = ajv.compile(tool.inputSchema);
      validators.set(tool.name, v);
    }
    return v;
  };

  return {
    list(filter) {
      const all = [...byName.values()];
      return filter?.readOnly === undefined
        ? all
        : all.filter((t) => t.readOnly === filter.readOnly);
    },

    get(name) {
      return byName.get(name);
    },

    invoke(name, params, ctx) {
      const tool = byName.get(name);
      if (!tool) {
        return fail(
          'UNKNOWN_TOOL',
          `No tool named "${name}".`,
          similarNames(name, [...byName.keys()])
        );
      }

      const validate = validatorFor(tool);
      // ajv не любит undefined на входе, а инструменты без обязательных полей вызываются без них.
      const args = params ?? {};
      if (!validate(args)) {
        return fail('INVALID_PARAMS', `Invalid arguments for ${name}: ${formatErrors(validate)}.`);
      }

      let outcome: ToolOutcome;
      try {
        outcome = tool.run(args as never, ctx);
      } catch (e) {
        // Исключение инструмента не должно ронять ход агента: модель получит ошибку и попробует иначе.
        const message = e instanceof Error ? e.message : String(e);
        return fail('TOOL_FAILED', `Tool ${name} failed: ${message}`);
      }
      return { ...outcome, text: clamp(outcome.text, TOOL_TEXT_BUDGET) };
    },
  };
}
