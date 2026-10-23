/**
 * Состав команд плагина.
 *
 * Проверяется здесь ровно одно, зато то, чего не проверяет ни мост, ни панель: что команда
 * отмены хода ДОШЛА до реестра. Сама отмена покрыта в `./bridge.test`, но её объявление
 * и её регистрация — разные факты: команда, написанная и не внесённая, выглядит рабочей
 * в тестах моста и не существует в приложении. Ровно так `undoTransaction` и прожил в дереве
 * без единого вызывающего.
 *
 * @module plugins/reformer/ai/plugin.test
 */

import { describe, expect, it, vi } from 'vitest';
import { ASSISTANT_ATTACH_COMMAND_ID } from '@reformer/builder-plugin-api';

import { AI_UNDO_TURN_COMMAND_ID, type AgentBridge } from './session/bridge';
import { aiChatPanel, aiCommands, AI_RESET_COMMAND_ID, AI_STOP_COMMAND_ID } from './plugin';
import { createAiSession } from './session/session';
import { createFakeHost } from './testing';

/** Мост в объёме, который читают охранные условия команд. */
function fakeBridge(overrides: Partial<AgentBridge> = {}): AgentBridge {
  return {
    isRunning: () => false,
    send: () => Promise.resolve(),
    abort: () => {},
    applyPending: () => Promise.resolve(),
    rejectPending: () => {},
    restoreTo: () => Promise.resolve(),
    answer: () => false,
    reset: () => true,
    canUndoTurn: () => false,
    undoLastTurn: () => Promise.resolve('nothing' as const),
    requestUndoTurn: () => Promise.resolve(),
    attach: () => 'attached' as const,
    detach: () => {},
    canSearchResources: () => false,
    searchResources: () => Promise.resolve([]),
    activeForm: () => null,
    isPendingStale: () => false,
    prepare: () => Promise.resolve(),
    ...overrides,
  };
}

describe('команды плагина', () => {
  it('отмена хода и прикрепление внесены в реестр наравне с остановкой и новым разговором', () => {
    const commands = aiCommands(fakeBridge());

    expect(commands.map((command) => command.id)).toEqual([
      AI_STOP_COMMAND_ID,
      AI_RESET_COMMAND_ID,
      AI_UNDO_TURN_COMMAND_ID,
      ASSISTANT_ATTACH_COMMAND_ID,
    ]);
  });

  it('прикрепление: адрес уходит мосту, о результате сказано тостом', () => {
    const attach = vi.fn().mockReturnValue('attached');
    const notify = vi.fn();
    const command = aiCommands(fakeBridge({ attach }), notify).find(
      (c) => c.id === ASSISTANT_ATTACH_COMMAND_ID
    );

    expect(command?.run({ uri: 'source:notes/brief.md', name: 'brief.md' })).toBe('attached');
    expect(attach).toHaveBeenCalledWith({ uri: 'source:notes/brief.md', name: 'brief.md' });
    expect(notify).toHaveBeenCalledWith('chat.attach.attached', { name: 'brief.md' }, 'info');
  });

  it('прикрепление без адреса (из палитры) — подсказка, а не ошибка', () => {
    const attach = vi.fn();
    const notify = vi.fn();
    const command = aiCommands(fakeBridge({ attach }), notify).find(
      (c) => c.id === ASSISTANT_ATTACH_COMMAND_ID
    );

    command?.run();
    expect(attach).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith('chat.attach.howTo', {}, 'info');
  });

  it('у отмены есть охранное условие, и оно спрашивает мост', () => {
    const undo = aiCommands(fakeBridge({ canUndoTurn: () => true })).find(
      (command) => command.id === AI_UNDO_TURN_COMMAND_ID
    );

    expect(undo?.enabled?.({} as never)).toBe(true);
  });

  it('ни одна команда плагина не отдаётся модели', () => {
    // Дать модели «остановить ход» или «отменить последний ход» значило бы позволить ей
    // прервать саму себя и переиграть собственную работу.
    const commands = aiCommands(fakeBridge());

    expect(commands.filter((command) => command.agent !== undefined)).toEqual([]);
  });
});

describe('панель ассистента', () => {
  it('несёт действия шапки: ряд кнопок не занимает высоту у ленты', () => {
    // Раньше это была своя полоса первой строкой содержимого, под заголовком дока, — то есть
    // тот же ярус интерфейса, разложенный на два. Здесь проверяется, что действия объявлены
    // вкладом шапки, а не вернулись в тело при следующей правке.
    const panel = aiChatPanel(
      createFakeHost() as unknown as Parameters<typeof aiChatPanel>[0],
      createAiSession(),
      fakeBridge(),
      {} as unknown as Parameters<typeof aiChatPanel>[3]
    );

    expect(panel.Actions).toBeTypeOf('function');
    expect(panel.Body).toBeTypeOf('function');
  });
});
