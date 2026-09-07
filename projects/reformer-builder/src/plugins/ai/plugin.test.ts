/**
 * Состав команд плагина.
 *
 * Проверяется здесь ровно одно, зато то, чего не проверяет ни мост, ни панель: что команда
 * отмены хода ДОШЛА до реестра. Сама отмена покрыта в `./bridge.test`, но её объявление
 * и её регистрация — разные факты: команда, написанная и не внесённая, выглядит рабочей
 * в тестах моста и не существует в приложении. Ровно так `undoTransaction` и прожил в дереве
 * без единого вызывающего.
 *
 * @module plugins/ai/plugin.test
 */

import { describe, expect, it } from 'vitest';

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
    canUndoTurn: () => false,
    undoLastTurn: () => Promise.resolve('nothing' as const),
    requestUndoTurn: () => Promise.resolve(),
    ...overrides,
  };
}

describe('команды плагина', () => {
  it('отмена хода внесена в реестр наравне с остановкой и новым разговором', () => {
    const commands = aiCommands(fakeBridge(), createAiSession());

    expect(commands.map((command) => command.id)).toEqual([
      AI_STOP_COMMAND_ID,
      AI_RESET_COMMAND_ID,
      AI_UNDO_TURN_COMMAND_ID,
    ]);
  });

  it('у отмены есть охранное условие, и оно спрашивает мост', () => {
    const undo = aiCommands(fakeBridge({ canUndoTurn: () => true }), createAiSession()).find(
      (command) => command.id === AI_UNDO_TURN_COMMAND_ID
    );

    expect(undo?.enabled?.({} as never)).toBe(true);
  });

  it('ни одна команда плагина не отдаётся модели', () => {
    // Дать модели «остановить ход» или «отменить последний ход» значило бы позволить ей
    // прервать саму себя и переиграть собственную работу.
    const commands = aiCommands(fakeBridge(), createAiSession());

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
