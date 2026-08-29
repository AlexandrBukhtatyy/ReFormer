/**
 * Мост: ход агента поверх рабочей области.
 *
 * Проверяется здесь то, чего не проверяет ни ядро, ни применение по отдельности: что ход
 * доходит от сообщения пользователя до одной записи в буфер, что молчаливый ход получает
 * объяснение, что расхождение останавливает применение, и что команды с блоком `agent`
 * действительно доступны модели.
 *
 * Провайдер — сценарный (`providers/fake`): сети, ключей и оплаты токенов здесь нет.
 *
 * @module plugins/ai/bridge.test
 */

import { describe, expect, it, vi } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { validateFormSchema } from '@reformer/renderer-json/validate';
import { builtinEntries } from '@/lib/catalog/__fixtures__/builtin-catalog';
import { listComponents } from './core/catalog-digest';
import type { WhenContext } from '@/sdk';
import { AI_UNDO_TURN_COMMAND_ID, aiUndoTurnCommand, createAgentBridge } from './bridge';
import { createEditorToolRegistry } from './core';
import type { AgentCommand } from './core/command-tools';
import type { AiAssistant } from './plugin';
import { createFakeProvider, type FakeStep } from './providers/fake';
import { createProviderRegistry } from './providers/registry';
import type { AiProvider } from './providers/types';
import { printSchemaText } from './schema-text';
import { createAiSession, type AiSession } from './session';
import { createFakeHost, type FakeHost } from './testing';

const RESOURCE = 'form.json';
/** Контекст применимости, которого предикату отмены достаточно: он его не читает. */
const NEUTRAL_CONTEXT = {} as WhenContext;
const catalog = builtinEntries();
/** Первое поле каталога — тест не должен зависеть от конкретного кита. */
const FIELD = listComponents(catalog, { role: 'field' })[0].name;

const EMPTY_FORM: JsonFormSchema = {
  version: '1.0',
  root: { component: '$component(Box)', children: [] },
} as unknown as JsonFormSchema;

/**
 * Провайдер, отыгрывающий РАЗНЫЕ сценарии на разных обращениях.
 *
 * Нужен ровно для второй попытки: сценарный провайдер проигрывает свой список заново на каждый
 * `stream`, поэтому одним списком «оборвался, потом дописал» не выразить — второе обращение
 * обрывалось бы там же, где первое.
 */
function sequenceProvider(scripts: readonly (readonly FakeStep[])[]): AiProvider {
  const providers = scripts.map((script) => createFakeProvider(script));
  let call = 0;
  return {
    id: 'fake-sequence',
    displayName: 'Сценарии по очереди',
    origin: 'browser',
    detect: () => providers[0].detect(),
    capabilities: () => providers[0].capabilities(),
    stream: (req, signal) => {
      const provider = providers[Math.min(call, providers.length - 1)];
      call += 1;
      return provider.stream(req, signal);
    },
  };
}

interface Harness {
  readonly host: FakeHost;
  readonly session: AiSession;
  readonly bridge: ReturnType<typeof createAgentBridge>;
  readonly assistant: AiAssistant;
  readonly execute: ReturnType<typeof vi.fn>;
}

function harness(
  script: readonly FakeStep[],
  options: {
    readonly withProvider?: boolean;
    readonly openForm?: boolean;
    readonly commands?: readonly AgentCommand[];
    readonly provider?: AiProvider;
  } = {}
): Harness {
  const host = createFakeHost(catalog);
  if (options.openForm !== false) host.openDocument(RESOURCE, printSchemaText(EMPTY_FORM));

  const providers = createProviderRegistry();
  if (options.withProvider !== false) {
    providers.register(options.provider ?? createFakeProvider(script));
  }

  const assistant: AiAssistant = {
    tools: createEditorToolRegistry(),
    catalog: () => catalog,
    providers,
    knowledge: { load: () => Promise.resolve(null) } as unknown as AiAssistant['knowledge'],
    loadConfig: () => Promise.resolve({ kind: 'anthropic' as const }),
    saveConfig: () => Promise.resolve(),
    clearConfig: () => Promise.resolve(),
    models: () => Promise.resolve([]),
    activate: () => Promise.reject(new Error('не нужно в тесте')),
    restore: () => Promise.resolve(null),
  };

  const session = createAiSession();
  const execute = vi.fn().mockResolvedValue('готово');
  const bridge = createAgentBridge({
    assistant,
    host,
    session,
    agentCommands: () => options.commands ?? [],
    executeCommand: execute as (id: string, args?: unknown) => Promise<unknown>,
    // Настоящая проверка, а не двойник: гейт — то, ради чего мост зовёт применение,
    // и подменять его здесь значило бы проверять подмену.
    validateForm: () => Promise.resolve(validateFormSchema),
  });
  return { host, session, bridge, assistant, execute };
}

/** Шаг сценария: вставить одно поле в корень. */
const insertField: FakeStep = {
  tool: 'insert_node',
  args: { parent: '/root', nodes: [{ component: FIELD, props: { label: 'Почта' } }] },
};

describe('ход доходит до рабочей области', () => {
  it('правки уходят ОДНОЙ записью, и ход закрывается в покой', async () => {
    const { host, session, bridge } = harness([insertField, { text: 'Готово.' }]);
    await bridge.send('добавь поле почты');

    expect(host.writes).toHaveLength(1);
    expect(host.writes[0].id).toBe(RESOURCE);
    expect(host.writes[0].text).toContain('Почта');
    expect(session.get().status).toBe('idle');
    expect(session.get().entries.at(-1)?.text).toBe('Готово.');
  });

  it('снимок реплики пользователя — текст ДО хода: по нему и возвращают форму', async () => {
    const before = printSchemaText(EMPTY_FORM);
    const { session, bridge, host } = harness([insertField]);
    await bridge.send('добавь поле почты');

    const snapshot = session.get().entries[0].snapshot;
    expect(snapshot?.text).toBe(before);

    await bridge.restoreTo(session.get().entries[0].id);
    expect(host.writes.at(-1)?.text).toBe(before);
    expect(session.get().entries).toEqual([]);
  });

  it('журнал панели — строка на ВЫЗОВ, а не на каждую правку пакета', async () => {
    const batch: FakeStep = {
      tool: 'insert_node',
      args: {
        parent: '/root',
        nodes: [
          { component: FIELD, props: { label: 'Имя' } },
          { component: FIELD, props: { label: 'Фамилия' } },
          { component: FIELD, props: { label: 'Отчество' } },
          { component: FIELD, props: { label: 'Почта' } },
        ],
      },
    };
    const { session, bridge } = harness([batch]);
    await bridge.send('добавь четыре поля');

    const tools = session.get().entries.at(-1)?.tools ?? [];
    expect(tools).toHaveLength(1);
    expect(tools[0].summary).toContain('+1');
  });
});

describe('ход не доходит до рабочей области', () => {
  it('без настроенного канала ход не начинается, а объясняется', async () => {
    const { host, session, bridge } = harness([], { withProvider: false });
    await bridge.send('добавь поле');
    expect(host.writes).toEqual([]);
    expect(session.get().error).toBe('turn.noProvider');
  });

  it('без открытой формы ход не начинается, а объясняется', async () => {
    const { host, session, bridge } = harness([insertField], { openForm: false });
    await bridge.send('добавь поле');
    expect(host.writes).toEqual([]);
    expect(session.get().error).toBe('turn.noForm');
  });

  it('активная вкладка с не-схемой ассистенту не принадлежит', async () => {
    const { host, session, bridge } = harness([insertField]);
    host.openDocument('notes.md', '# просто текст');
    await bridge.send('добавь поле');
    expect(host.writes).toEqual([]);
    expect(session.get().error).toBe('turn.noForm');
  });

  it('пустое сообщение хода не начинает', async () => {
    const { session, bridge } = harness([insertField]);
    await bridge.send('   ');
    expect(session.get().entries).toEqual([]);
  });
});

describe('молчаливый ход', () => {
  it('ход без слов и без правок получает объяснение, а не тишину', async () => {
    const { session, bridge } = harness([{ reasoning: 'долго думаю' }]);
    await bridge.send('сделай что-нибудь');
    expect(session.get().error).toContain('turn.silent.none');
  });

  it('ход с вызовами, но без правок и без слов — то же объяснение', async () => {
    const { session, bridge } = harness([{ tool: 'get_form_outline', args: {} }]);
    await bridge.send('покажи форму');
    expect(session.get().error).toContain('turn.silent.tools');
  });

  it('ход, который ответил текстом, замечания не получает', async () => {
    const { session, bridge } = harness([{ text: 'В форме пока пусто.' }]);
    await bridge.send('что в форме?');
    expect(session.get().error).toBeNull();
    expect(session.get().status).toBe('idle');
  });
});

/**
 * Расхождение моделируется командой, которая правит документ ПОСРЕДИ хода.
 *
 * Это не искусственная подпорка, а именно тот путь, который контракт и описывает: команда
 * пишет в буфер сразу (она — та же дверь, что у человека), а набор хода приземляется в конце.
 * Тем же выглядит и правка руками в Monaco.
 */
function conflictHarness(): Harness {
  const editByHand: AgentCommand = {
    id: 'test.edit',
    agent: { description: 'Edit the file directly.', schema: { type: 'object', properties: {} } },
  };
  const result = harness([{ tool: 'test_edit', args: {} }, insertField], {
    commands: [editByHand],
  });
  result.execute.mockImplementation(async () => {
    await result.host.writeText(
      RESOURCE,
      printSchemaText({ ...EMPTY_FORM, version: '1.1' } as JsonFormSchema)
    );
    return 'ok';
  });
  return result;
}

describe('расхождение с буфером', () => {
  it('правка посреди хода оставляет набор на решение пользователя', async () => {
    const { host, session, bridge } = conflictHarness();
    await bridge.send('поправь и добавь поле');

    // Записана только правка команды; набор хода в буфер не пошёл.
    expect(host.writes).toHaveLength(1);
    expect(host.writes[0].text).toContain('1.1');
    expect(session.get().status).toBe('review');
    expect(session.get().conflict).toBe(true);
    expect(session.get().pending).not.toBeNull();
  });

  it('«Применить всё равно» пишет поверх — но только по решению человека', async () => {
    const { host, session, bridge } = conflictHarness();
    await bridge.send('поправь и добавь поле');

    await bridge.applyPending(false);
    expect(host.writes).toHaveLength(1);
    expect(session.get().pending).not.toBeNull();

    await bridge.applyPending(true);
    expect(host.writes).toHaveLength(2);
    expect(host.writes[1].text).toContain('Почта');
    expect(session.get().pending).toBeNull();
    expect(session.get().status).toBe('idle');
  });

  it('«Отклонить» снимает набор и ничего не пишет', async () => {
    const { host, session, bridge } = conflictHarness();
    await bridge.send('поправь и добавь поле');

    bridge.rejectPending();
    expect(host.writes).toHaveLength(1);
    expect(session.get().pending).toBeNull();
    expect(session.get().status).toBe('idle');
  });
});

describe('вторая попытка после обрыва', () => {
  it('недописанный вызов даёт ровно один повтор', async () => {
    const provider = sequenceProvider([
      [{ truncated: { tool: 'insert_node' } }],
      [insertField, { text: 'Дописал.' }],
    ]);
    const { host, session, bridge } = harness([], { provider });
    await bridge.send('добавь поле почты');

    // Первая попытка не принесла правок, вторая — принесла: значит повтор состоялся.
    expect(host.writes).toHaveLength(1);
    expect(session.get().entries.at(-1)?.text).toContain('Дописал.');
  });

  it('фантомного «продолжай» в ленте не появляется — реплика у попыток одна', async () => {
    const provider = sequenceProvider([
      [{ truncated: { tool: 'insert_node' } }],
      [insertField, { text: 'Дописал.' }],
    ]);
    const { session, bridge } = harness([], { provider });
    await bridge.send('добавь поле почты');

    expect(session.get().entries.map((e) => e.role)).toEqual(['user', 'assistant']);
    expect(session.get().entries[0].text).toBe('добавь поле почты');
  });

  it('второго повтора не бывает: обрыв дважды означает, что задача не влезает', async () => {
    const provider = sequenceProvider([
      [{ truncated: { tool: 'insert_node' } }],
      [{ truncated: { tool: 'insert_node' } }],
      [insertField, { text: 'третья попытка' }],
    ]);
    const { host, session, bridge } = harness([], { provider });
    await bridge.send('добавь поле почты');

    expect(host.writes).toEqual([]);
    expect(session.get().entries.at(-1)?.text).not.toContain('третья попытка');
  });

  it('остановка кнопкой повтора не вызывает', async () => {
    const { bridge, session } = harness([{ truncated: { tool: 'insert_node' } }]);
    const sending = bridge.send('добавь поле');
    bridge.abort();
    await sending;
    expect(session.get().status).not.toBe('running');
  });
});

describe('проекция команд', () => {
  const command: AgentCommand = {
    id: 'files.save',
    agent: { description: 'Save the active file.', schema: { type: 'object', properties: {} } },
  };

  it('команда с блоком agent становится вызываемой моделью', async () => {
    const { bridge, execute, session } = harness([{ tool: 'files_save', args: {} }], {
      commands: [command],
    });
    await bridge.send('сохрани файл');
    expect(execute).toHaveBeenCalledWith('files.save', {});
    expect(session.get().entries.at(-1)?.tools[0]).toMatchObject({ name: 'files_save', ok: true });
  });

  it('без объявленного блока agent команда модели не видна', async () => {
    const { bridge, execute, session } = harness([{ tool: 'files_save', args: {} }]);
    await bridge.send('сохрани файл');
    expect(execute).not.toHaveBeenCalled();
    // Сценарий назвал инструмент, которого модели не давали, — ход кончается ошибкой.
    expect(session.get().status).toBe('error');
  });

  it('переполнение потолка поверхности не молчит', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fat = Array.from({ length: 40 }, (_, i) => ({
      id: `demo.act${String(i)}`,
      agent: { description: 'z'.repeat(400), schema: { type: 'object', properties: {} } },
    }));
    const { bridge } = harness([{ text: 'ok' }], { commands: fat });
    await bridge.send('привет');
    expect(spy.mock.calls.flat().join(' ')).toContain('поверхность инструментов');
    spy.mockRestore();
  });
});

describe('отмена последнего хода ассистента', () => {
  it('снимает ровно то, что написал ассистент, и не трогает переписку', async () => {
    const before = printSchemaText(EMPTY_FORM);
    const { host, session, bridge } = harness([insertField, { text: 'Готово.' }]);
    await bridge.send('добавь поле почты');

    await expect(bridge.undoLastTurn()).resolves.toBe('undone');

    expect(host.writes.at(-1)?.text).toBe(before);
    // Отличие от «Восстановить»: реплики остаются на месте — отменяется правка, а не разговор.
    expect(session.get().entries).toHaveLength(2);
  });

  it('отмена уходит в буфер БЕЗ пометки ассистента: её заказал человек', async () => {
    const { host, bridge } = harness([insertField]);
    await bridge.send('добавь поле почты');

    await bridge.undoLastTurn();

    expect(host.writes.at(-2)?.mark).toMatchObject({ origin: 'agent' });
    expect(host.writes.at(-1)?.mark).toBeUndefined();
  });

  it('до первого хода отменять нечего, и об этом говорят словами', async () => {
    const { bridge, session, host } = harness([]);

    await expect(bridge.undoLastTurn()).resolves.toBe('nothing');

    expect(host.writes).toEqual([]);
    expect(session.get().error).toBe('turn.undo.nothing');
  });

  it('дважды один ход не отменяется', async () => {
    const { bridge } = harness([insertField]);
    await bridge.send('добавь поле почты');

    await expect(bridge.undoLastTurn()).resolves.toBe('undone');
    await expect(bridge.undoLastTurn()).resolves.toBe('nothing');
  });

  it('ход, перекрытый правкой руками, НЕ отменяется — иначе она потеряется', async () => {
    const { host, bridge, session } = harness([insertField]);
    await bridge.send('добавь поле почты');
    const afterTurn = host.writes.at(-1)!.text;
    host.editOutside(RESOURCE, `${afterTurn}\n`);

    await expect(bridge.undoLastTurn()).resolves.toBe('overlapped');

    // Ни одной записи после правки руками: правдоподобно испорченный текст хуже отказа.
    expect(host.writes.at(-1)?.text).toBe(afterTurn);
    expect(session.get().error).toBe('turn.undo.overlapped');
  });

  it('закрытая форма — отдельный ответ, а не отказ записи', async () => {
    const { host, bridge, session } = harness([insertField]);
    await bridge.send('добавь поле почты');
    host.closeDocument(RESOURCE);

    await expect(bridge.undoLastTurn()).resolves.toBe('closed');
    expect(session.get().error).toBe('turn.undo.closed');
  });

  it('ход из ДВУХ попыток отменяется целиком: снимок берётся до первой', async () => {
    const before = printSchemaText(EMPTY_FORM);
    const provider = sequenceProvider([
      [insertField, { truncated: { tool: 'insert_node' } }],
      [insertField, { text: 'дописал' }],
    ]);
    const { host, bridge } = harness([], { provider });
    await bridge.send('добавь два поля');
    // Обе попытки легли в буфер отдельными записями — иначе проверять было бы нечего.
    expect(host.writes.length).toBeGreaterThan(1);

    await expect(bridge.undoLastTurn()).resolves.toBe('undone');

    expect(host.writes.at(-1)?.text).toBe(before);
  });

  it('«Восстановить» снимает отмену с повестки: возвращать уже некуда', async () => {
    const { session, bridge } = harness([insertField]);
    await bridge.send('добавь поле почты');

    await bridge.restoreTo(session.get().entries[0].id);

    expect(bridge.canUndoTurn()).toBe(false);
  });

  it('замечание об отмене не выбрасывает набор, ждущий решения', async () => {
    // `finishTurn(null, …)` очистил бы `pending`: отмена молча выбросила бы правки,
    // по которым человек ещё не решил.
    const { host, bridge, session } = harness([insertField]);
    host.failWrites(new Error('буфер занят'));
    await bridge.send('добавь поле почты');
    expect(session.get().pending).not.toBeNull();

    await expect(bridge.undoLastTurn()).resolves.toBe('nothing');

    expect(session.get().pending).not.toBeNull();
  });

  it('доступность отмены — дешёвый предикат, а не чтение буфера', async () => {
    const { bridge } = harness([insertField]);
    expect(bridge.canUndoTurn()).toBe(false);

    await bridge.send('добавь поле почты');

    expect(bridge.canUndoTurn()).toBe(true);
  });
});

describe('команда отмены и кнопка ведут в одно место', () => {
  it('команда объявлена с охранным условием моста и без блока agent', () => {
    const { bridge } = harness([]);
    const command = aiUndoTurnCommand(bridge);

    expect(command.id).toBe(AI_UNDO_TURN_COMMAND_ID);
    expect(command.titleKey).toBe('command.undoTurn');
    expect(command.enabled?.(NEUTRAL_CONTEXT)).toBe(false);
    // Отмена своего хода модели не даётся: это действие человека над машиной.
    expect(command.agent).toBeUndefined();
  });

  it('run команды отменяет ход', async () => {
    const before = printSchemaText(EMPTY_FORM);
    const { host, bridge } = harness([insertField]);
    await bridge.send('добавь поле почты');

    await aiUndoTurnCommand(bridge).run();

    expect(host.writes.at(-1)?.text).toBe(before);
  });

  it('кнопка панели идёт ЧЕРЕЗ РЕЕСТР, а не мимо него', async () => {
    const { bridge, execute } = harness([insertField]);
    await bridge.send('добавь поле почты');

    await bridge.requestUndoTurn();

    expect(execute).toHaveBeenCalledWith(AI_UNDO_TURN_COMMAND_ID);
  });

  it('незарегистрированная команда не превращает кнопку в тишину', async () => {
    const { bridge, execute, session } = harness([insertField]);
    execute.mockRejectedValueOnce(new Error('команда «ai.undo-turn» не зарегистрирована'));
    await bridge.send('добавь поле почты');

    await bridge.requestUndoTurn();

    expect(session.get().error).toContain('turn.undo.failed');
  });
});
