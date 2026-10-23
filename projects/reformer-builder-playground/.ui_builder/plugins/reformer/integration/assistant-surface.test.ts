/**
 * Храповик поверхности инструментов: сколько символов ассистент платит ЗА КАЖДЫЙ ШАГ хода.
 *
 * ## Почему это тест, а не константа для сравнения глазами
 *
 * Имена, описания и схемы аргументов всех инструментов уходят в запрос ЦЕЛИКОМ, на каждом шаге, а
 * шагов за ход десятки. Отдельное описание при этом всегда выглядит дешёвым — дорога сумма. В v1
 * потолок был записан константой и сверялся дисциплиной: «поднимать нельзя, только снижать». Такая
 * договорённость держится ровно до первого уточнения, добавленного «на всякий случай».
 *
 * Здесь она механическая: тест складывает длины и падает при превышении. Поднять потолок
 * по-прежнему можно — но это отдельная строка в diff'е `core/types.ts` рядом с обоснованием, а не
 * побочный эффект правки описания.
 *
 * Падение здесь — не «подними константу», а «сожми схемы»: посмотри, что из описания модель уже
 * знает из системного промпта или из самой схемы аргументов, и убери повтор.
 *
 * ## Что именно складывается
 *
 * Ровно те поля, которые провайдер кладёт в определение инструмента: `name`, `description`,
 * `inputSchema`. Считает их {@link measureToolSurface} — та же функция, которой мост меряет
 * набор в рантайме, а не её копия в тесте: разойдись они, тест мерил бы не то, за что платят.
 *
 * Набор берётся ПОЛНЫЙ, как его видит модель: списки стека ReFormer (`structuredSlots`,
 * `fileModeSlots`) с инструментами ассистента на их местах — вопрос человеку, генерация кода,
 * новая форма. Поэтому храповик живёт здесь: стек и ассистент — разные плагины, а платит модель за
 * их сумму. Write-инструменты крупнее вдвое — у них схемы аргументов, — и в v1 именно они долго
 * оставались вне проверки.
 *
 * ## Второе слагаемое: вклады плагинов
 *
 * Поверхность растёт и без правки `core/tools`: инструментами плагинов, командами с блоком
 * `agent` и `read_resource`, который приходит вместе с провайдером ресурсов. У них свой потолок
 * (`CONTRIBUTED_TOOL_SURFACE_BUDGET`): состав вкладов известен только в рантайме, и его держит
 * сборка набора хода (`session/contributions`) той же функцией. Здесь проверяется, что счётчик
 * вклады ВИДИТ, что встроенный `read_resource` в свой потолок укладывается, и что лимиты одного
 * инструмента совпадают с теми, что SDK обещает авторам плагинов.
 *
 * @module plugins/reformer/integration/assistant-surface.test
 */

import { describe, expect, it } from 'vitest';
import {
  ASSISTANT_TOOL_DESCRIPTION_MAX,
  ASSISTANT_TOOL_NAME_MAX,
  type FormAgentTool,
  type FormHostToolName,
  type FormToolSlot,
} from '@reformer/builder-plugin-api';
import { builtinEntries } from '../core/testing';
import { commandTools, type AgentCommand } from '../ai/src/tools/command-tools';
import { readResourceTool } from '../ai/src/tools/read-resource';
import { fileSystemPrompt } from '../ai/src/loop/file-prompt';
import { systemPrompt } from '../ai/src/loop/prompt';
import { measureToolSurface } from '@reformer/builder-toolkit';
import { structuredSlots } from '../ai/src/tools';
import { fileModeSlots } from '../ai/src/tools/files';
import { askUserTool } from '../ai/src/tools/ask-user';
import { createFormTool } from '../ai/src/tools/create-form';
import { generateCodeTool } from '../ai/src/tools/generate-code';
import { CONTRIBUTED_TOOL_SURFACE_BUDGET } from '../ai/src/budgets';
import {
  FILE_TOOL_SURFACE_BUDGET,
  PROMPT_BUDGET,
  TOOL_DESCRIPTION_BUDGET,
  TOOL_NAME_BUDGET,
  TOOL_SURFACE_BUDGET,
  type AgentTool,
} from '../ai/src/model/types';

/** Инструменты ассистента, которые стек ставит в свои списки по имени. */
const HOST_TOOLS: Readonly<Record<FormHostToolName, FormAgentTool<never, never>>> = {
  ask_user: askUserTool,
  generate_code: generateCodeTool,
  create_form: createFormTool,
};

/** Список стека, каким его видит модель: имена инструментов ассистента — их определениями. */
const resolve = (slots: readonly FormToolSlot[]): AgentTool[] =>
  slots.map((slot) => (typeof slot === 'string' ? HOST_TOOLS[slot] : slot) as AgentTool);

/**
 * Набор без корпуса знаний — то же, что уходит модели без открытого проекта.
 *
 * Состав набора от корпуса не зависит (`ask_reformer` в нём есть всегда, см. `core/tools`),
 * поэтому измеряемая величина одна и та же при любой развязке моста.
 */
const tools = resolve(structuredSlots());

/** Команда, объявившая себя инструментом, — для проверки, что счётчик её видит. */
function fakeCommand(id: string, description: string): AgentCommand {
  return { id, agent: { description, schema: { type: 'object', properties: {} } } };
}

describe('поверхность инструментов', () => {
  it.each(tools.map((t) => [t.name, t] as const))('%s укладывается в свои бюджеты', (_n, tool) => {
    expect(tool.name.length).toBeLessThanOrEqual(TOOL_NAME_BUDGET);
    expect(tool.description.length).toBeLessThanOrEqual(TOOL_DESCRIPTION_BUDGET);
    expect(tool.name).toMatch(/^[a-z][a-z0-9_]*$/);
  });

  it('имена уникальны — иначе реестр не соберётся', () => {
    const names = tools.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('вся поверхность вместе укладывается в потолок', () => {
    expect(measureToolSurface(tools)).toBeLessThanOrEqual(TOOL_SURFACE_BUDGET);
  });

  it('системный промпт — вторая половина постоянной части — укладывается в свой потолок', () => {
    expect(systemPrompt(builtinEntries()).length).toBeLessThanOrEqual(PROMPT_BUDGET);
  });
});

describe('вклады плагинов — свой потолок', () => {
  it('потолок встроенных описывает только встроенные и равен их размеру', () => {
    // Место, освобождённое один раз, запасом не становится; вклады меряются отдельно.
    expect(measureToolSurface(tools)).toBe(TOOL_SURFACE_BUDGET);
  });

  it('потолок вкладов — осознанное число, а не побочный эффект', () => {
    expect(CONTRIBUTED_TOOL_SURFACE_BUDGET).toBe(3000);
  });

  it('read_resource, который приходит с провайдером ресурсов, оставляет место вкладам', () => {
    const own = measureToolSurface([readResourceTool as AgentTool]);
    expect(own).toBeLessThanOrEqual(CONTRIBUTED_TOOL_SURFACE_BUDGET / 4);
    expect(readResourceTool.name.length).toBeLessThanOrEqual(TOOL_NAME_BUDGET);
    expect(readResourceTool.description.length).toBeLessThanOrEqual(TOOL_DESCRIPTION_BUDGET);
  });

  it('лимиты одного инструмента — те же, что SDK обещает авторам плагинов', () => {
    expect(TOOL_NAME_BUDGET).toBe(ASSISTANT_TOOL_NAME_MAX);
    expect(TOOL_DESCRIPTION_BUDGET).toBe(ASSISTANT_TOOL_DESCRIPTION_MAX);
  });

  it('описание команды входит в сумму, а не проходит мимо', () => {
    const description = 'x'.repeat(200);
    const { tools: projected } = commandTools(
      [fakeCommand('demo.act', description)],
      () => Promise.resolve(undefined),
      tools.map((t) => t.name)
    );
    const grown = measureToolSurface([...tools, ...projected]);
    expect(grown).toBeGreaterThan(measureToolSurface(tools) + description.length);
  });

  it('команда, переполнившая потолок, обнаруживается сложением, а не на глаз', () => {
    const fat = Array.from({ length: 30 }, (_, i) =>
      fakeCommand(`demo.act${String(i)}`, 'y'.repeat(TOOL_DESCRIPTION_BUDGET))
    );
    const { tools: projected } = commandTools(
      fat,
      () => Promise.resolve(undefined),
      tools.map((t) => t.name)
    );
    expect(measureToolSurface(projected)).toBeGreaterThan(CONTRIBUTED_TOOL_SURFACE_BUDGET);
  });
});

describe('поверхность режима файлов — свой храповик', () => {
  const fileTools = resolve(fileModeSlots());

  it.each(fileTools.map((t) => [t.name, t] as const))(
    '%s укладывается в свои бюджеты',
    (_n, tool) => {
      expect(tool.name.length).toBeLessThanOrEqual(TOOL_NAME_BUDGET);
      expect(tool.description.length).toBeLessThanOrEqual(TOOL_DESCRIPTION_BUDGET);
      expect(tool.name).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  );

  it('имена уникальны', () => {
    const names = fileTools.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('поверхность равна потолку — место, освобождённое один раз, запасом не становится', () => {
    expect(measureToolSurface(fileTools)).toBe(FILE_TOOL_SURFACE_BUDGET);
  });

  it('файловый промпт укладывается в тот же потолок, что структурный', () => {
    expect(fileSystemPrompt(builtinEntries()).length).toBeLessThanOrEqual(PROMPT_BUDGET);
  });
});
