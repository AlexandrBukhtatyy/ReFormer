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
 * Набор берётся ПОЛНЫЙ (`allTools`), а не только read-only: write-инструменты крупнее вдвое —
 * у них схемы аргументов, — и в v1 именно они долго оставались вне проверки.
 *
 * ## Второе слагаемое: команды с блоком `agent`
 *
 * По контракту инструменты ассистента — проекция команд, поэтому поверхность растёт не только
 * правкой `core/tools`, но и появлением блока `agent` у чьей-нибудь команды. Здесь проверяется,
 * что счётчик их ВИДИТ и что потолок один на обоих слагаемых: иначе храповик защищал бы
 * половину поверхности, а вторая росла бы мимо него.
 *
 * Сумма по всем зарегистрированным в приложении командам этому тесту недоступна: реестр команд
 * собирается композицией, а плагин чужих плагинов не видит. В рантайме её считает мост
 * (`bridge.toolsForTurn`) той же функцией и тем же потолком.
 *
 * @module plugins/ai/core/tool-surface.test
 */

import { describe, expect, it } from 'vitest';
import { builtinEntries } from '@/lib/catalog/__fixtures__/builtin-catalog';
import { commandTools, type AgentCommand } from './command-tools';
import { systemPrompt } from './prompt';
import { measureToolSurface } from './tool-surface';
import { allTools } from './tools';
import {
  PROMPT_BUDGET,
  TOOL_DESCRIPTION_BUDGET,
  TOOL_NAME_BUDGET,
  TOOL_SURFACE_BUDGET,
} from './types';

/**
 * Набор без корпуса знаний — то же, что уходит модели без открытого проекта.
 *
 * Состав набора от корпуса не зависит (`ask_reformer` в нём есть всегда, см. `core/tools`),
 * поэтому измеряемая величина одна и та же при любой развязке моста.
 */
const tools = allTools();

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

describe('храповик считает и команды с блоком agent', () => {
  it('сегодня их нет, и потолок описывает только встроенные', () => {
    // Ни одна команда билдера пока не объявила `agent`, поэтому запас между фактическим
    // размером и потолком равен нулю: место, освобождённое один раз, не становится запасом.
    expect(measureToolSurface(tools)).toBe(TOOL_SURFACE_BUDGET);
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
    expect(measureToolSurface([...tools, ...projected])).toBeGreaterThan(TOOL_SURFACE_BUDGET);
  });
});
