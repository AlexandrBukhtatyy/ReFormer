/**
 * Проекция команд в инструменты: что становится инструментом, что отвергается и почему.
 *
 * Главное, что здесь проверяется, — отказ. Проекция обязана быть придирчивой: имя инструмента
 * входит в постоянную часть запроса, и молчаливая подмена или обрезка стоила бы кэша префикса
 * и промахов модели по несуществующему адресу.
 *
 * @module plugins/ai/tools/command-tools.test
 */

import { describe, expect, it, vi } from 'vitest';
import { commandTools, toolNameForCommand, type AgentCommand } from './command-tools';
import { TOOL_DESCRIPTION_BUDGET, TOOL_NAME_BUDGET } from '../model/types';

const SCHEMA = { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] };

function command(id: string, description = 'Delete the selected node.'): AgentCommand {
  return { id, agent: { description, schema: SCHEMA } };
}

const noop = (): Promise<unknown> => Promise.resolve(undefined);

describe('имя инструмента из идентификатора команды', () => {
  it('точки и дефисы становятся подчёркиваниями', () => {
    expect(toolNameForCommand('editor-schema.delete')).toBe('editor_schema_delete');
  });

  it('отображение детерминированно — от него зависит кэш префикса', () => {
    expect(toolNameForCommand('a.b')).toBe(toolNameForCommand('a.b'));
  });

  it('идентификатор, из которого имени не выходит, отвергается, а не чинится приставкой', () => {
    expect(toolNameForCommand('42.answer')).toBeNull();
    expect(toolNameForCommand('...')).toBeNull();
    expect(toolNameForCommand('')).toBeNull();
  });
});

describe('проекция', () => {
  it('команда становится инструментом со своим описанием и схемой', () => {
    const { tools, rejected } = commandTools([command('files.save')], noop);
    expect(rejected).toEqual([]);
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('files_save');
    expect(tools[0].description).toBe('Delete the selected node.');
    expect(tools[0].inputSchema).toBe(SCHEMA);
  });

  it('инструмент команды НЕ помечается read-only: ответ действия схлопывать нельзя', () => {
    const { tools } = commandTools([command('files.save')], noop);
    expect(tools[0].readOnly).toBe(false);
  });

  it('вызов идёт через реестр команд — той же дверью, что у человека', async () => {
    const execute = vi.fn().mockResolvedValue('saved');
    const { tools } = commandTools([command('files.save')], execute);
    const outcome = await tools[0].run({ id: 'x' } as never, undefined as never);
    expect(execute).toHaveBeenCalledWith('files.save', { id: 'x' });
    expect(outcome).toEqual({ ok: true, text: 'saved' });
  });

  it('молчаливый ответ команды получает слово: пустоту модель читает как отказ', async () => {
    const { tools } = commandTools([command('files.save')], noop);
    const outcome = await tools[0].run({} as never, undefined as never);
    expect(outcome.ok).toBe(true);
    expect(outcome.text).not.toBe('');
  });

  it('исключение команды не роняет ход, а возвращается ошибкой (урок 10)', async () => {
    const { tools } = commandTools([command('files.save')], () =>
      Promise.reject(new Error('команда «files.save» недоступна в текущем контексте'))
    );
    const outcome = await tools[0].run({} as never, undefined as never);
    expect(outcome.ok).toBe(false);
    expect(outcome.error?.code).toBe('TOOL_FAILED');
    expect(outcome.error?.message).toContain('недоступна');
  });
});

describe('отказы проекции', () => {
  it('имя, занятое встроенным инструментом, не подменяет его', () => {
    const { tools, rejected } = commandTools([command('insert.node')], noop, ['insert_node']);
    expect(tools).toEqual([]);
    expect(rejected).toEqual([{ commandId: 'insert.node', code: 'name-taken' }]);
  });

  it('две команды с одним именем — вторая отвергается, а не затирает первую', () => {
    const { tools, rejected } = commandTools([command('a.b'), command('a-b')], noop);
    expect(tools).toHaveLength(1);
    expect(rejected).toEqual([{ commandId: 'a-b', code: 'name-taken' }]);
  });

  it('слишком длинное имя отвергается', () => {
    const long = `plugin.${'x'.repeat(TOOL_NAME_BUDGET)}`;
    expect(commandTools([command(long)], noop).rejected[0].code).toBe('name-too-long');
  });

  it('слишком длинное описание отвергается: поверхность платится каждым шагом', () => {
    const fat = command('a.b', 'z'.repeat(TOOL_DESCRIPTION_BUDGET + 1));
    expect(commandTools([fat], noop).rejected[0].code).toBe('description-too-long');
  });

  it('негодный идентификатор отвергается кодом, а не догадкой', () => {
    expect(commandTools([command('9.lives')], noop).rejected[0].code).toBe('name-invalid');
  });
});
