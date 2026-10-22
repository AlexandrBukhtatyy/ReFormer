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
 * @module plugins/reformer/ai/session/bridge.test
 */

import { describe, expect, it, vi } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { validateFormSchema } from '@reformer/renderer-json/validate';
import { builtinEntries } from '../../../core/testing';
import { listComponents } from '../model/catalog-digest';
import type { WhenContext } from '@reformer/builder-plugin-api';
import { AI_UNDO_TURN_COMMAND_ID, aiUndoTurnCommand, createAgentBridge } from './bridge';
import { createEditorToolRegistry } from '../tools';
import { createFileToolRegistry } from '../tools/files';
import type { AgentCommand } from '../tools/command-tools';
import type { AiAssistant } from '../plugin';
import { createFakeProvider, type FakeStep } from '../providers/fake';
import { createProviderRegistry } from '../providers/registry';
import type { AiMessage, AiProvider } from '../providers/types';
import { printSchemaText } from '../model/schema-text';
import { createAiSession, type AiSession } from './session';
import { createFakeFiles, createFakeHost, type FakeFiles, type FakeHost } from '../testing';
import type { ContributedTool, ContributedToolEntry } from '../tools/contributed-tools';
import type { ResourceProviderEntry } from './resources';

const RESOURCE = 'form.json';
/** Контекст применимости, которого предикату отмены достаточно: он его не читает. */
const NEUTRAL_CONTEXT = {} as WhenContext;
const catalog = builtinEntries();
/** Первое поле каталога — тест не должен зависеть от конкретного кита. */
const FIELD = listComponents(catalog, { role: 'field' })[0].name;

const EMPTY_FORM: JsonFormSchema = {
  format: 2,
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

/** То же, что {@link sequenceProvider}, но с репликами, пришедшими на каждое обращение. */
function recordingSequence(scripts: readonly (readonly FakeStep[])[]) {
  const inner = sequenceProvider(scripts);
  const requests: (readonly AiMessage[])[] = [];
  const provider: AiProvider = {
    ...inner,
    stream: (req, signal) => {
      requests.push(req.messages);
      return inner.stream(req, signal);
    },
  };
  return { provider, requests };
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
    /** Порт файлов — без него инструменту плагина писать некуда. */
    readonly files?: FakeFiles;
    readonly assistantTools?: readonly ContributedToolEntry[];
    readonly resourceProviders?: readonly ResourceProviderEntry[];
  } = {}
): Harness {
  const host = createFakeHost(catalog, options.files);
  if (options.openForm !== false) host.openDocument(RESOURCE, printSchemaText(EMPTY_FORM));

  const providers = createProviderRegistry();
  if (options.withProvider !== false) {
    providers.register(options.provider ?? createFakeProvider(script));
  }

  const assistant: AiAssistant = {
    tools: createEditorToolRegistry(),
    fileTools: createFileToolRegistry(),
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
    assistantTools: () => options.assistantTools ?? [],
    resourceProviders: () => options.resourceProviders ?? [],
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
    expect(snapshot).toMatchObject({ text: before });

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

describe('файл прежнего формата', () => {
  /** Визард, записанный до формата 2: шаги в `componentProps.steps`, привязка поля в `value`. */
  const LEGACY_TEXT = JSON.stringify(
    {
      version: '1.0',
      root: {
        component: '$component(Wizard)',
        componentProps: {
          steps: [
            {
              component: '$component(Step)',
              componentProps: { title: 'Контакты' },
              children: [
                {
                  value: '$model(email)',
                  component: `$component(${FIELD})`,
                  componentProps: { label: 'Почта' },
                },
              ],
            },
          ],
        },
      },
    },
    null,
    2
  );

  /** Шаг сценария: поле в первый шаг — адресом формата 2, каким его называет карта формы. */
  const insertIntoStep: FakeStep = {
    tool: 'insert_node',
    args: {
      parent: '/root/children/0',
      nodes: [{ component: FIELD, model: 'phone', props: { label: 'Телефон' } }],
    },
  };

  it('ход адресует шаги как children, а запись переводит файл в формат 2', async () => {
    const { host, session, bridge } = harness([insertIntoStep, { text: 'Готово.' }]);
    host.openDocument(RESOURCE, LEGACY_TEXT);
    await bridge.send('добавь телефон в первый шаг');

    expect(session.get().error).toBeNull();
    expect(host.writes).toHaveLength(1);

    const written = JSON.parse(host.writes[0].text) as {
      format: number;
      root: { componentProps?: { steps?: unknown }; children: { children: unknown[] }[] };
    };
    expect(written.format).toBe(2);
    expect(written.root.componentProps?.steps).toBeUndefined();
    // Прежнее поле переведено, новое встало рядом — оба с привязкой в `model`.
    expect(written.root.children[0].children).toEqual([
      {
        model: '$model(email)',
        component: `$component(${FIELD})`,
        componentProps: { label: 'Почта' },
      },
      expect.objectContaining({ model: '$model(phone)' }),
    ]);
    expect(host.writes[0].text).not.toMatch(/"(value|array)": "\$model\(/);
  });

  it('ход без правок файл не переписывает — перевод не правка', async () => {
    // Модель хода собрана форматом 2, но в буфер уходит только набор изменений: открыть прежний
    // файл и ничего не поменять не должно давать diff на весь документ.
    const { host, session, bridge } = harness([
      { tool: 'get_form_outline', args: {} },
      { text: 'Один шаг.' },
    ]);
    host.openDocument(RESOURCE, LEGACY_TEXT);
    await bridge.send('что в форме?');

    expect(session.get().error).toBeNull();
    expect(host.writes).toEqual([]);
    expect(host.documentOf(RESOURCE)?.getText()).toBe(LEGACY_TEXT);
  });

  it('отмена хода возвращает файл в прежнем виде, байт в байт', async () => {
    const { host, bridge } = harness([insertIntoStep]);
    host.openDocument(RESOURCE, LEGACY_TEXT);
    await bridge.send('добавь телефон в первый шаг');
    expect(host.writes).toHaveLength(1);

    await expect(bridge.undoLastTurn()).resolves.toBe('undone');
    expect(host.documentOf(RESOURCE)?.getText()).toBe(LEGACY_TEXT);
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

  it('вызов, написанный текстом, тоже даёт повтор — со своей подсказкой', async () => {
    // ReFormer-lhvk.8: модель «вызвала» инструмент текстом ответа, правка не применилась.
    const { provider, requests } = recordingSequence([
      [{ textual: { tool: 'insert_node' } }],
      [insertField, { text: 'Добавил.' }],
    ]);
    const { host, session, bridge } = harness([], { provider });
    await bridge.send('добавь поле почты');

    expect(host.writes).toHaveLength(1);
    expect(session.get()).toMatchObject({ status: 'idle', error: null });
    // Подсказка говорит про текст, а не про обрыв: ответ не оборвался — его не исполнили.
    const second = requests[1].map((message) => message.content).join('\n');
    expect(second).toContain('insert_node written as text');
    expect(second).not.toContain('cut off');
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

  it('переполнение потолка вкладов не молчит, а ход идёт', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fat = Array.from({ length: 40 }, (_, i) => ({
      id: `demo.act${String(i)}`,
      agent: { description: 'z'.repeat(400), schema: { type: 'object', properties: {} } },
    }));
    const { bridge, session } = harness([{ text: 'ok' }], { commands: fat });
    await bridge.send('привет');
    expect(spy.mock.calls.flat().join(' ')).toContain('over-budget');
    expect(session.get().status).toBe('idle');
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

// ── Режим файлов ────────────────────────────────────────────────────────────

/** Документ формы образцового модуля в двойнике файлов. */
const FORM_FILE = 'forms/loan/schema/form.schema.json';
const RULES_FILE = 'forms/loan/validation/form.ts';
const EMPTY_TEXT = printSchemaText(EMPTY_FORM);
const RULES_TEXT = 'export const rules = [];\n';

/** Ход над файлами: правки в корень формы и в правила одной попыткой. */
const fieldEdit: FakeStep = {
  tool: 'edit_file',
  args: {
    path: 'schema/form.schema.json',
    edits: [
      {
        old_string: '"children": []',
        // Компактный JSON — так его пишет модель; принтер документа перепечатает его в конце хода.
        new_string:
          '"children": [{"model": "$model(email)", "component": "$component(Input)", ' +
          '"componentProps": {"label": "Почта"}}]',
      },
    ],
  },
};
const rulesEdit: FakeStep = {
  tool: 'edit_file',
  args: {
    path: 'validation/form.ts',
    edits: [{ old_string: 'export const rules = [];', new_string: 'export const rules = [1];' }],
  },
};

/** Провайдер, который после сценария делает что-то «руками» — до конца хода. */
function thenOutside(script: readonly FakeStep[], outside: () => void): AiProvider {
  const inner = createFakeProvider(script);
  return {
    ...inner,
    async *stream(req, signal) {
      for await (const event of inner.stream(req, signal)) {
        if (event.type === 'done') outside();
        yield event;
      }
    },
  };
}

function filesHarness(
  script: readonly FakeStep[],
  options: {
    readonly provider?: AiProvider;
    readonly initial?: Readonly<Record<string, string>>;
    readonly active?: string;
    readonly assistantTools?: readonly ContributedToolEntry[];
  } = {}
) {
  const files = createFakeFiles(
    options.initial ?? { [FORM_FILE]: EMPTY_TEXT, [RULES_FILE]: RULES_TEXT }
  );
  const host = createFakeHost(catalog, files);
  host.setActive(options.active ?? FORM_FILE);

  const providers = createProviderRegistry();
  providers.register(options.provider ?? createFakeProvider(script));
  const assistant: AiAssistant = {
    tools: createEditorToolRegistry(),
    fileTools: createFileToolRegistry(),
    catalog: () => catalog,
    providers,
    knowledge: () => Promise.resolve(null),
    loadConfig: () => Promise.resolve({ kind: 'anthropic' as const, editMode: 'files' as const }),
    saveConfig: () => Promise.resolve(),
    clearConfig: () => Promise.resolve(),
    models: () => Promise.resolve([]),
    activate: () => Promise.reject(new Error('не нужно в тесте')),
    restore: () => Promise.resolve(null),
  };
  const session = createAiSession();
  const bridge = createAgentBridge({
    assistant,
    host,
    session,
    agentCommands: () => [],
    executeCommand: () => Promise.resolve(undefined),
    assistantTools: () => options.assistantTools ?? [],
    validateForm: () => Promise.resolve(validateFormSchema),
  });
  return { files, host, session, bridge };
}

describe('режим файлов — ход', () => {
  it('записи ложатся сразу, с пометкой хода; набора на подтверждение нет', async () => {
    const { files, host, session, bridge } = filesHarness([
      fieldEdit,
      rulesEdit,
      { text: 'Готово.' },
    ]);
    await bridge.send('добавь почту с правилом');

    expect(host.writes).toHaveLength(0);
    expect(files.text(FORM_FILE)).toContain('$model(email)');
    expect(files.text(RULES_FILE)).toBe('export const rules = [1];\n');
    const marks = files.writes.map((write) => write.mark);
    expect(new Set(marks.map((mark) => mark?.txId)).size).toBe(1);
    expect(marks.every((mark) => mark?.origin === 'agent')).toBe(true);
    expect(session.get()).toMatchObject({ status: 'idle', pending: null, error: null });
  });

  it('схема перепечатывается принтером документа один раз, в конце хода', async () => {
    const { files, bridge } = filesHarness([fieldEdit]);
    await bridge.send('добавь почту');

    const written = files.text(FORM_FILE) ?? '';
    expect(written).toBe(printSchemaText(JSON.parse(written) as JsonFormSchema));
    // Запись правки и запись перепечатки — обе под одним ходом.
    const formWrites = files.writes.filter((write) => write.path === FORM_FILE);
    expect(formWrites).toHaveLength(2);
    expect(formWrites[0].mark?.txId).toBe(formWrites[1].mark?.txId);
  });

  it('файл, который после хода правил человек, не перепечатывается', async () => {
    const human = '{"format": 2, "root": {"component": "$component(Box)", "children": []}}';
    // Провайдер нужен до сборки обвязки, а файлы появляются вместе с ней — отсюда держатель.
    const holder: { files?: ReturnType<typeof createFakeFiles> } = {};
    const provider = thenOutside([fieldEdit], () => holder.files?.put(FORM_FILE, human));
    const harnessed = filesHarness([], { provider });
    holder.files = harnessed.files;
    await harnessed.bridge.send('добавь почту');
    expect(harnessed.files.text(FORM_FILE)).toBe(human);
  });

  it('вторая попытка после обрыва — тот же ход, тот же txId', async () => {
    const provider = sequenceProvider([
      [fieldEdit, { truncated: { tool: 'edit_file' } }],
      [rulesEdit, { text: 'Дописал.' }],
    ]);
    const { files, bridge } = filesHarness([], { provider });
    await bridge.send('сделай всё');

    expect(files.text(RULES_FILE)).toBe('export const rules = [1];\n');
    expect(new Set(files.writes.map((write) => write.mark?.txId)).size).toBe(1);
  });

  it('вызов edit_file текстом — повтор, и правка доходит до файла', async () => {
    // Исход живого прогона (gemma4:26b, ReFormer-lhvk.8): вызов в ленте, файл не тронут, ход
    // закрывался успехом.
    const { provider, requests } = recordingSequence([
      [{ textual: { tool: 'edit_file' } }],
      [rulesEdit, { text: 'Сделал.' }],
    ]);
    const { files, session, bridge } = filesHarness([], { provider });
    await bridge.send('поправь правила');

    expect(files.text(RULES_FILE)).toBe('export const rules = [1];\n');
    expect(session.get()).toMatchObject({ status: 'idle', error: null });
    // Последней репликой попытки идёт затравка модуля, подсказка — перед ней.
    expect(requests[1].map((message) => message.content).join('\n')).toContain(
      'edit_file written as text'
    );
  });

  it('вызов текстом дважды — ошибка остаётся видна, третьей попытки нет', async () => {
    const { provider, requests } = recordingSequence([
      [{ textual: { tool: 'edit_file' } }],
      [{ textual: { tool: 'edit_file' } }],
      [rulesEdit],
    ]);
    const { files, session, bridge } = filesHarness([], { provider });
    await bridge.send('поправь правила');

    expect(requests).toHaveLength(2);
    expect(files.writes).toHaveLength(0);
    expect(session.get().error).toContain('текстом');
  });

  it('ломающая запись не доходит до файлов, ход кончается без ошибки панели', async () => {
    const broken: FakeStep = {
      tool: 'edit_file',
      args: {
        path: 'schema/form.schema.json',
        edits: [{ old_string: '$component(Box)', new_string: '$component(Boks)' }],
      },
    };
    const { files, session, bridge } = filesHarness([broken, { text: 'Не вышло.' }]);
    await bridge.send('сломай');
    expect(files.writes).toHaveLength(0);
    expect(session.get().entries.at(-1)?.tools[0]).toMatchObject({ name: 'edit_file', ok: false });
  });

  it('форма, которая не собирается, — ход не начинается, причина названа', async () => {
    const root = printSchemaText({
      format: 2,
      root: { component: '$component(Wizard)', children: [{ $ref: './steps/x/form.schema.json' }] },
    } as never);
    const { session, bridge } = filesHarness([fieldEdit], { initial: { [FORM_FILE]: root } });
    await bridge.send('добавь почту');
    expect(session.get().error).toContain('turn.files.broken');
  });

  it('документ без папки модуля — ход идёт структурным режимом', async () => {
    const free = 'forms/credit.schema.json';
    const { files, host, bridge } = filesHarness([insertField], {
      initial: { [free]: EMPTY_TEXT },
      active: free,
    });
    host.openDocument(free, EMPTY_TEXT);
    await bridge.send('добавь поле');
    expect(files.writes).toHaveLength(0);
    expect(host.writes).toHaveLength(1);
  });
});

describe('режим файлов — отмена и восстановление', () => {
  it('отмена хода возвращает ВСЕ тронутые файлы', async () => {
    const { files, bridge } = filesHarness([fieldEdit, rulesEdit]);
    await bridge.send('добавь почту с правилом');

    expect(bridge.canUndoTurn()).toBe(true);
    expect(await bridge.undoLastTurn()).toBe('undone');
    expect(files.text(FORM_FILE)).toBe(EMPTY_TEXT);
    expect(files.text(RULES_FILE)).toBe(RULES_TEXT);
  });

  it('созданный ходом файл остаётся, и об этом сказано', async () => {
    const create: FakeStep = {
      tool: 'write_file',
      args: { path: 'api/index.ts', content: 'export {};\n' },
    };
    const { files, session, bridge } = filesHarness([create]);
    await bridge.send('заведи api');

    expect(await bridge.undoLastTurn()).toBe('undone');
    expect(files.text('forms/loan/api/index.ts')).toBe('export {};\n');
    expect(session.get().error).toContain('turn.undo.created');
  });

  it('правка человека после хода — отмена отказывает и не пишет ничего', async () => {
    const { files, bridge } = filesHarness([fieldEdit, rulesEdit]);
    await bridge.send('добавь почту с правилом');
    files.put(RULES_FILE, 'export const rules = [2];\n');
    const before = files.writes.length;

    expect(await bridge.undoLastTurn()).toBe('overlapped');
    expect(files.writes).toHaveLength(before);
    expect(files.text(FORM_FILE)).toContain('$model(email)');
  });

  it('«Восстановить» откатывает этот ход и все последующие, обрезая ленту', async () => {
    const provider = sequenceProvider([[fieldEdit], [rulesEdit]]);
    const { files, session, bridge } = filesHarness([], { provider });
    await bridge.send('первый ход');
    await bridge.send('второй ход');
    expect(files.text(RULES_FILE)).toBe('export const rules = [1];\n');

    const first = session.get().entries[0];
    expect(first.snapshot).toMatchObject({ mode: 'files' });
    await bridge.restoreTo(first.id);

    expect(files.text(FORM_FILE)).toBe(EMPTY_TEXT);
    expect(files.text(RULES_FILE)).toBe(RULES_TEXT);
    expect(session.get().entries).toEqual([]);
    expect(bridge.canUndoTurn()).toBe(false);
  });
});

// ── Вклады плагинов: инструменты и ресурсы ─────────────────────────────────────

/** Инструмент плагина, пишущий `text` в `target` дверью хода; ответ — итог записи. */
function writerTool(target: string, text: string, readOnly = false): ContributedToolEntry {
  const value: ContributedTool = {
    name: 'write_note',
    description: 'Write the note.',
    inputSchema: { type: 'object', properties: {} },
    readOnly,
    run: async (_params, ctx) => {
      const written = await ctx.write(target, text);
      return written.ok ? 'written' : `refused: ${written.code}`;
    },
  };
  return { pluginId: 'demo.notes', value };
}

const writeNote: FakeStep = { tool: 'write_note', args: {} };

/** Провайдер ресурсов схемы `source:` — отдаёт текст по адресу. */
const sourceProvider = (read = vi.fn()): ResourceProviderEntry => ({
  pluginId: 'reformer.files',
  value: {
    scheme: 'source',
    describe: 'source:<path> — project files as saved on disk',
    read: read.mockImplementation((uri: string) =>
      Promise.resolve({ ok: true, text: `disk text of ${uri}`, mediaType: 'text/plain' })
    ),
  },
});

/** Сценарный провайдер, запоминающий определения инструментов и реплики каждого запроса. */
function recordingTools(script: readonly FakeStep[]) {
  const inner = createFakeProvider(script);
  const tools: string[][] = [];
  const messages: (readonly AiMessage[])[] = [];
  const provider: AiProvider = {
    ...inner,
    stream: (req, signal) => {
      tools.push(req.tools.map((tool) => tool.name));
      messages.push(req.messages);
      return inner.stream(req, signal);
    },
  };
  return { provider, tools, messages };
}

describe('инструменты плагинов — запись в ходе структурного режима', () => {
  it('пишут дверью хода с той же пометкой, что правка формы, и отменяются вместе с ней', async () => {
    const files = createFakeFiles({ 'notes.md': 'old' });
    const { host, bridge } = harness([insertField, writeNote, { text: 'Готово.' }], {
      files,
      assistantTools: [writerTool('notes.md', 'new')],
    });
    await bridge.send('добавь поле и заметку');

    expect(files.text('notes.md')).toBe('new');
    const pluginMark = files.writes[0].mark;
    expect(pluginMark?.origin).toBe('agent');
    expect(host.writes.at(-1)?.mark?.txId).toBe(pluginMark?.txId);

    expect(await bridge.undoLastTurn()).toBe('undone');
    expect(files.text('notes.md')).toBe('old');
    expect(host.documentOf(RESOURCE)?.getText()).toBe(printSchemaText(EMPTY_FORM));
  });

  it('ход, в котором писал только плагин, не молчаливый и тоже отменяется', async () => {
    const files = createFakeFiles({ 'notes.md': 'old' });
    const { session, bridge } = harness([writeNote], {
      files,
      assistantTools: [writerTool('notes.md', 'new')],
    });
    await bridge.send('обнови заметку');

    expect(session.get().status).toBe('idle');
    expect(session.get().error).toBeNull();
    expect(await bridge.undoLastTurn()).toBe('undone');
    expect(files.text('notes.md')).toBe('old');
  });

  it('документ формы инструменту плагина не отдаётся, только читающему запись отказана', async () => {
    const files = createFakeFiles();
    const toForm = harness([writeNote], { files, assistantTools: [writerTool(RESOURCE, '{}')] });
    await toForm.bridge.send('перепиши форму');
    expect(toForm.host.writes).toHaveLength(0);
    expect(files.writes).toHaveLength(0);

    const readOnly = harness([writeNote], {
      files,
      assistantTools: [writerTool('notes.md', 'x', true)],
    });
    await readOnly.bridge.send('запиши');
    expect(files.writes).toHaveLength(0);
  });

  it('«Восстановить» на реплике откатывает и записи плагина', async () => {
    const files = createFakeFiles({ 'notes.md': 'old' });
    const { session, bridge } = harness([writeNote], {
      files,
      assistantTools: [writerTool('notes.md', 'new')],
    });
    await bridge.send('обнови заметку');
    await bridge.restoreTo(session.get().entries[0].id);

    expect(files.text('notes.md')).toBe('old');
    expect(session.get().entries).toEqual([]);
  });
});

describe('инструменты плагинов — режим файлов', () => {
  it('запись в файл модуля и вне его отменяется вместе с правкой модели', async () => {
    const tools: ContributedToolEntry[] = [
      writerTool(RULES_FILE, 'export const rules = [9];\n'),
      {
        pluginId: 'demo.notes',
        value: { ...writerTool('docs/notes.md', 'note').value, name: 'write_docs' },
      },
    ];
    const { files, bridge } = filesHarness(
      [fieldEdit, writeNote, { tool: 'write_docs', args: {} }],
      { assistantTools: tools }
    );
    await bridge.send('добавь почту и заметки');

    expect(files.text(RULES_FILE)).toBe('export const rules = [9];\n');
    expect(files.text('docs/notes.md')).toBe('note');
    expect(await bridge.undoLastTurn()).toBe('undone');
    expect(files.text(FORM_FILE)).toBe(EMPTY_TEXT);
    expect(files.text(RULES_FILE)).toBe(RULES_TEXT);
  });

  it('документ формы режима файлов плагину не отдаётся — его запись идёт через гейт', async () => {
    const { files, bridge } = filesHarness([writeNote], {
      assistantTools: [writerTool(FORM_FILE, '{}')],
    });
    await bridge.send('перепиши форму');
    expect(files.text(FORM_FILE)).toBe(EMPTY_TEXT);
  });
});

describe('ресурсы плагинов', () => {
  it('без провайдера read_resource модели не виден', async () => {
    const { provider, tools } = recordingTools([{ text: 'ok' }]);
    const { bridge } = harness([], { provider });
    await bridge.send('привет');
    expect(tools[0]).not.toContain('read_resource');
  });

  it('с провайдером: read_resource в наборе, каталог в затравке, чтение идёт к провайдеру', async () => {
    const read = vi.fn();
    const { provider, tools, messages } = recordingTools([
      { tool: 'read_resource', args: { uri: 'source:readme.md' } },
      { text: 'Прочитал.' },
    ]);
    const { session, bridge } = harness([], {
      provider,
      resourceProviders: [sourceProvider(read)],
    });
    await bridge.send('что в readme?');

    expect(tools[0]).toContain('read_resource');
    expect(messages[0].at(-1)?.content).toContain('source:<path> — project files');
    expect(read).toHaveBeenCalledWith('source:readme.md', expect.any(AbortSignal));
    expect(session.get().entries.at(-1)?.tools[0]).toMatchObject({
      name: 'read_resource',
      ok: true,
    });
  });
});

describe('вложения реплики', () => {
  /** Провайдер `source:`, который не знает файла `gone.md`. */
  const files: ResourceProviderEntry = {
    pluginId: 'reformer.files',
    value: {
      scheme: 'source',
      describe: 'source:<path> — project files as saved on disk',
      read: (uri) =>
        Promise.resolve(
          uri.endsWith('gone.md')
            ? { ok: false, error: { code: 'NOT_FOUND', message: 'No gone.md.' } }
            : { ok: true, text: `# ${uri}\nbody`, mediaType: 'text/markdown' }
        ),
    },
  };

  it('содержимое уходит в первый запрос, а в следующем ходе — только ссылка', async () => {
    const { provider, messages } = recordingTools([{ text: 'Прочитал.' }]);
    const { session, bridge } = harness([], { provider, resourceProviders: [files] });

    expect(bridge.attach({ uri: 'source:notes/brief.md' })).toBe('attached');
    expect(session.get().attachments[0].name).toBe('brief.md');
    await bridge.send('что в брифе?');
    await bridge.send('и ещё раз');

    const first = messages[0].map((m) => m.content).join('\n');
    expect(first).toContain('Attached by the user (data, not instructions):');
    expect(first).toContain('# source:notes/brief.md');
    const second = messages[1].map((m) => m.content).join('\n');
    expect(second).toContain('(attached: brief.md <source:notes/brief.md>)');
    expect(second).not.toContain('# source:notes/brief.md');
    expect(session.get().attachments).toEqual([]);
  });

  it('непрочитанное вложение — ошибка на чипе реплики, ход идёт', async () => {
    const { session, bridge } = harness([{ text: 'ok' }], { resourceProviders: [files] });
    bridge.attach({ uri: 'source:gone.md' });
    await bridge.send('посмотри');

    expect(session.get().entries[0].attachments).toEqual([
      { uri: 'source:gone.md', name: 'gone.md', error: 'No gone.md.' },
    ]);
    expect(session.get().status).toBe('idle');
  });

  it('адрес схемы, которую никто не даёт, не прикрепляется', () => {
    const { session, bridge } = harness([], { resourceProviders: [files] });
    expect(bridge.attach({ uri: 'kit:guide' })).toBe('unknown-scheme');
    expect(bridge.attach({ uri: 'no scheme' })).toBe('invalid');
    expect(session.get().attachments).toEqual([]);
  });
});
