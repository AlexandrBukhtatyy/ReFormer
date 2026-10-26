/**
 * Мост на двойнике стека: то, что ассистент обязан уметь сам, какой бы стек форм ни стоял.
 *
 * Стек здесь — `createFakeFormStack` (`../testing`): форма — JSON со списком полей, инструменты
 * `add_field` и `list_fields`, применение пишет документ и, если задан, сопутствующий файл. Хозяин
 * проверяется по своему контракту — ход, вторая попытка, расхождение с буфером, отмена и
 * «Восстановить» с сопутствующими файлами, записи инструментов плагинов, вопросы модели, создание
 * формы, стек, исчезнувший при отложенных правках. Сценарии над формой ReFormer — в интеграции
 * (`reformer/integration/assistant-bridge.test`): там мост собран с настоящим стеком.
 *
 * @module plugins/forms/ai/session/bridge.test
 */

import { describe, expect, it, vi } from 'vitest';
import type {
  DocumentRef,
  FormAssistantStack,
  FormCreatorService,
  ModuleGeneratorService,
  ResourceId,
} from '@reformer/builder-plugin-api';
import { createAgentBridge } from './bridge';
import type { AiAssistant } from '../plugin';
import { createFakeProvider, type FakeStep } from '../providers/fake';
import { createProviderRegistry } from '../providers/registry';
import type { AiMessage, AiProvider } from '../providers/types';
import { createAiSession, openAskOf, type AiSession, type AskCard } from './session';
import type { AgentCommand } from '../tools/command-tools';
import type { ContributedTool, ContributedToolEntry } from '../tools/contributed-tools';
import {
  createFakeFiles,
  createFakeFormStack,
  createFakeHost,
  fakeFormText,
  type FakeFiles,
} from '../testing';

/** Документ формы двойника. */
const FORM = 'forms/a.fake.json';
/** Вторая форма двойника. */
const OTHER = 'forms/b.fake.json';
const EMPTY = fakeFormText([]);

/** Шаг сценария: добавить поле. */
const addField = (name: string): FakeStep => ({ tool: 'add_field', args: { name } });

/** Провайдер, отыгрывающий разные сценарии на разных обращениях — ради второй попытки. */
function sequenceProvider(scripts: readonly (readonly FakeStep[])[]): AiProvider {
  const providers = scripts.map((script) => createFakeProvider(script));
  let call = 0;
  return {
    ...providers[0],
    stream: (req, signal) => {
      const provider = providers[Math.min(call, providers.length - 1)];
      call += 1;
      return provider.stream(req, signal);
    },
  };
}

/** То же, что {@link sequenceProvider}, с репликами каждого обращения. */
function recordingSequence(scripts: readonly (readonly FakeStep[])[]) {
  const inner = sequenceProvider(scripts);
  const requests: { system: string; messages: readonly AiMessage[]; tools: string[] }[] = [];
  const provider: AiProvider = {
    ...inner,
    stream: (req, signal) => {
      requests.push({
        system: req.system ?? '',
        messages: req.messages,
        tools: req.tools.map((tool) => tool.name),
      });
      return inner.stream(req, signal);
    },
  };
  return { provider, requests };
}

/** Провайдер, который после своего сценария делает что-то снаружи — между попытками хода. */
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

/** Провайдеры по очереди обращений. */
function providerSequence(providers: readonly AiProvider[]): AiProvider {
  let call = 0;
  return {
    ...providers[0],
    stream: (req, signal) => {
      const provider = providers[Math.min(call, providers.length - 1)];
      call += 1;
      return provider.stream(req, signal);
    },
  };
}

interface HarnessOptions {
  readonly provider?: AiProvider;
  readonly stacks?: () => readonly FormAssistantStack[];
  readonly files?: FakeFiles;
  readonly openForm?: boolean;
  readonly commands?: readonly AgentCommand[];
  readonly assistantTools?: readonly ContributedToolEntry[];
  readonly formCreator?: FormCreatorService;
  readonly generator?: ModuleGeneratorService;
}

/** Мост с каналом к модели, двойником платформы и стеками. */
function harness(script: readonly FakeStep[], options: HarnessOptions = {}) {
  const host = createFakeHost(options.files);
  if (options.openForm !== false) host.openDocument(FORM, EMPTY);
  const providers = createProviderRegistry();
  providers.register(options.provider ?? createFakeProvider(script));
  const assistant: AiAssistant = {
    providers,
    loadConfig: () => Promise.resolve({ kind: 'anthropic' as const }),
    saveConfig: () => Promise.resolve(),
    clearConfig: () => Promise.resolve(),
    models: () => Promise.resolve([]),
    activate: () => Promise.reject(new Error('не нужно в тесте')),
    restore: () => Promise.resolve(null),
  };
  const session = createAiSession();
  const execute = vi.fn().mockResolvedValue('готово');
  const stack = createFakeFormStack({ companion: 'notes.txt' });
  const bridge = createAgentBridge({
    assistant,
    host,
    session,
    agentCommands: () => options.commands ?? [],
    executeCommand: execute as (id: string, args?: unknown) => Promise<unknown>,
    assistantTools: () => options.assistantTools ?? [],
    formCreator: () => options.formCreator,
    generator: () => options.generator,
    stacks: options.stacks ?? (() => [stack]),
  });
  return { host, session, bridge, stack, execute };
}

/** Стек, который берётся только за документы своего провайдера, а сеанс не открывает. */
function foreignStack(providerId: string, applied: DocumentRef[]): FormAssistantStack {
  return {
    id: 'test.foreign',
    applies: (document) => {
      applied.push(document);
      return document.providerId === providerId;
    },
    connect: () => {
      throw new Error('за чужой документ стек не подключают');
    },
  };
}

/** Команда, которая правит документ посреди хода, — тем же путём выглядит правка руками. */
function conflictHarness(options: HarnessOptions = {}) {
  const editByHand: AgentCommand = {
    id: 'test.edit',
    agent: { description: 'Edit the file directly.', schema: { type: 'object', properties: {} } },
  };
  const result = harness([{ tool: 'test_edit', args: {} }, addField('email')], {
    ...options,
    commands: [editByHand],
  });
  result.execute.mockImplementation(async () => {
    await result.host.writeText(FORM, fakeFormText(['manual']));
    return 'ok';
  });
  return result;
}

describe('мост без стека форм', () => {
  it('стеков нет — ход отвечает словами, что править нечем', async () => {
    const { host, session, bridge } = harness([], { stacks: () => [] });

    await bridge.send('добавь поле');

    expect(session.get().status).toBe('error');
    expect(session.get().error).toBe('turn.noStack');
    expect(host.writes).toEqual([]);
  });

  it('документ не взят ни одним стеком — «откройте форму», стек не подключается', async () => {
    const applied: DocumentRef[] = [];
    const { host, session, bridge } = harness([], {
      stacks: () => [foreignStack('rjsf.form', applied)],
    });
    host.openDocument('notes.md', '# заметки');

    await bridge.send('добавь поле');

    expect(session.get().error).toBe('turn.noForm');
    // Документ, открытый текстом, провайдера не имеет: стек спрашивают по нему.
    expect(applied.map((document) => [document.id, document.kind])).toContainEqual([
      'notes.md',
      'text',
    ]);
  });

  it('подпись «Правит: …» без стека пуста: форму узнаёт только стек', () => {
    const { bridge } = harness([], { stacks: () => [] });
    expect(bridge.activeForm()).toBeNull();
  });
});

describe('ход над формой стека', () => {
  it('правки ложатся одной записью применения стека — с пометкой хода, и ход закрывается', async () => {
    const { host, session, bridge } = harness([
      addField('email'),
      addField('phone'),
      { text: 'Готово.' },
    ]);

    await bridge.send('добавь два поля');

    expect(host.writes.map((write) => write.id)).toEqual([FORM]);
    expect(host.writes[0].text).toBe(fakeFormText(['email', 'phone']));
    expect(host.writes[0].mark).toMatchObject({ origin: 'agent' });
    expect(host.writes[0].mark?.txId).toBeTruthy();
    expect(session.get()).toMatchObject({ status: 'idle', error: null });
    expect(session.get().entries.at(-1)?.text).toBe('Готово.');
  });

  it('модели видны инструменты стека и инструменты ассистента из его набора', async () => {
    const { provider, requests } = recordingSequence([[{ text: 'Смотрю.' }]]);
    const { bridge } = harness([], { provider });

    await bridge.send('что умеешь?');

    expect(requests[0].tools).toEqual(
      expect.arrayContaining(['add_field', 'list_fields', 'ask_user', 'create_form'])
    );
    // Затравку и промпт ходу даёт стек.
    expect(requests[0].system).toContain('You edit fake forms.');
    expect(JSON.stringify(requests[0].messages)).toContain(`Active form: ${FORM}`);
  });

  it('без правок документ не переписывается, а ответ словами замечаний не получает', async () => {
    const { host, session, bridge } = harness([
      { tool: 'list_fields', args: {} },
      { text: 'Полей нет.' },
    ]);

    await bridge.send('какие поля?');

    expect(host.writes).toEqual([]);
    expect(session.get()).toMatchObject({ status: 'idle', error: null });
  });

  it('ход без слов и без правок получает объяснение, а не тишину', async () => {
    const { session, bridge } = harness([{ tool: 'list_fields', args: {} }]);

    await bridge.send('покажи форму');

    expect(session.get().error).toContain('turn.silent.tools');
  });

  it('все правки отказали, а модель «отчиталась» — замечание с причиной', async () => {
    const { host, session, bridge } = harness([addField('a'), addField('a'), { text: 'Готово.' }]);
    host.openDocument(FORM, fakeFormText(['a']));

    await bridge.send('добавь поле a');

    expect(session.get().error).toContain('turn.failedEdits');
  });

  it('подпись «Правит: …» — путь формы, которую узнал стек', () => {
    const { bridge } = harness([]);
    expect(bridge.activeForm()).toBe(FORM);
  });

  it('стек подключается один раз на мост, а не на каждый ход', async () => {
    const { bridge, stack } = harness([addField('a')]);

    await bridge.send('раз');
    await bridge.send('два');

    expect(stack.connections).toBe(1);
  });

  it('из двух стеков ход ведёт тот, что взялся за документ', async () => {
    const other = createFakeFormStack({ id: 'other', suffix: '.other.json' });
    const mine = createFakeFormStack();
    const { host, bridge } = harness([addField('x')], { stacks: () => [other, mine] });
    host.openDocument(FORM, EMPTY);

    await bridge.send('добавь поле');

    expect(host.writes.map((write) => write.id)).toEqual([FORM]);
    expect(other.connections).toBe(0);
  });
});

describe('вторая попытка', () => {
  it('недописанный вызов даёт ровно один повтор, реплика у попыток одна', async () => {
    const provider = sequenceProvider([
      [{ truncated: { tool: 'add_field' } }],
      [addField('email'), { text: 'Дописал.' }],
    ]);
    const { host, session, bridge } = harness([], { provider });

    await bridge.send('добавь поле почты');

    expect(host.writes).toHaveLength(1);
    expect(session.get().entries.map((entry) => entry.role)).toEqual(['user', 'assistant']);
    expect(session.get().entries.at(-1)?.text).toContain('Дописал.');
  });

  it('обрыв дважды — третьей попытки нет', async () => {
    const provider = sequenceProvider([
      [{ truncated: { tool: 'add_field' } }],
      [{ truncated: { tool: 'add_field' } }],
      [addField('email'), { text: 'третья' }],
    ]);
    const { host, session, bridge } = harness([], { provider });

    await bridge.send('добавь поле');

    expect(host.writes).toEqual([]);
    expect(session.get().entries.at(-1)?.text).not.toContain('третья');
  });

  it('вторая попытка правит форму первой, даже если активной стала другая', async () => {
    let switchTab = (): void => {};
    const provider = providerSequence([
      thenOutside([{ truncated: { tool: 'add_field' } }], () => switchTab()),
      createFakeProvider([addField('email'), { text: 'Дописал.' }]),
    ]);
    const { host, session, bridge } = harness([], { provider });
    switchTab = () => host.openDocument(OTHER, EMPTY);

    await bridge.send('добавь поле почты');

    expect(host.writes.map((write) => write.id)).toEqual([FORM]);
    expect(host.documentOf(OTHER)?.getText()).toBe(EMPTY);
    expect(session.get().entries[0].snapshot).toMatchObject({ resource: FORM });
  });

  it('ход из двух попыток отменяется целиком: снимок берётся до первой', async () => {
    const provider = sequenceProvider([
      [addField('a'), { truncated: { tool: 'add_field' } }],
      [addField('b'), { text: 'дописал' }],
    ]);
    const { host, bridge } = harness([], { provider });

    await bridge.send('добавь два поля');
    expect(host.writes.length).toBeGreaterThan(1);

    await expect(bridge.undoLastTurn()).resolves.toBe('undone');
    expect(host.documentOf(FORM)?.getText()).toBe(EMPTY);
  });
});

describe('расхождение с буфером', () => {
  it('правка посреди хода оставляет набор на решение человека; «Применить всё равно» пишет', async () => {
    const { host, session, bridge } = conflictHarness();

    await bridge.send('поправь и добавь поле');
    expect(host.writes).toHaveLength(1);
    expect(session.get()).toMatchObject({ status: 'review', conflict: true });

    await bridge.applyPending(true);

    expect(host.writes).toHaveLength(2);
    expect(host.writes[1].text).toBe(fakeFormText(['email']));
    expect(session.get().pending).toBeNull();
  });

  it('стек исчез при отложенных правках — набор не пишется, причина названа', async () => {
    let stacks: readonly FormAssistantStack[] = [createFakeFormStack()];
    const { host, session, bridge } = conflictHarness({ stacks: () => stacks });
    await bridge.send('поправь и добавь поле');
    expect(session.get().pending).not.toBeNull();

    stacks = [];
    await bridge.applyPending(true);

    expect(host.writes).toHaveLength(1);
    expect(session.get().error).toContain('turn.notApplied.closed');
    // Набор остаётся на решение: стек может вернуться (плагин переподняли).
    expect(session.get().pending).not.toBeNull();
  });

  it('новый запрос отбрасывает неприменённый набор — со строкой в его реплике', async () => {
    const { session, bridge } = conflictHarness();
    await bridge.send('поправь и добавь поле');

    await bridge.send('ладно, просто посмотри');

    const previous = session.get().entries[1];
    expect(previous.tools.at(-1)).toMatchObject({ name: 'apply', ok: false });
    expect(previous.tools.at(-1)?.error).toContain('turn.pending.dropped');
  });
});

describe('отмена и «Восстановить» с сопутствующими файлами', () => {
  it('отмена возвращает документ и сопутствующий файл, без пометки ассистента', async () => {
    const files = createFakeFiles({ [FORM]: EMPTY, 'forms/notes.txt': 'было\n' });
    const { host, bridge, stack } = harness([addField('email')], { files });

    await bridge.send('добавь поле');
    expect(files.text('forms/notes.txt')).toBe('fields: email\n');

    await expect(bridge.undoLastTurn()).resolves.toBe('undone');

    expect(host.documentOf(FORM)?.getText()).toBe(EMPTY);
    expect(files.text('forms/notes.txt')).toBe('было\n');
    expect(host.writes.at(-1)?.mark).toBeUndefined();
    // Состояние формы, которое знает только стек, он возвращает сам — без файлов: их вернула отмена.
    expect(stack.rewinds).toEqual([{ path: FORM, files: false }]);
  });

  it('генерация в том же ходе поверх сопутствующего файла — отмена возвращает текст до хода', async () => {
    const files = createFakeFiles({ [FORM]: EMPTY, 'forms/notes.txt': 'было\n' });
    // Генерация по заказу пишет дверью хода уже после того, как стек положил свой файл.
    const generator: ModuleGeneratorService = {
      async generate(_document, request) {
        await request?.write?.('forms/notes.txt' as ResourceId, 'сгенерировано\n');
        return {
          ok: true,
          formName: 'a',
          dir: 'forms',
          written: ['notes.txt'],
          skipped: [],
          failed: [],
        };
      },
    };
    const { bridge } = harness([addField('email'), { tool: 'generate_code', args: {} }], {
      files,
      generator,
    });

    await bridge.send('добавь поле и сгенерируй код');
    expect(files.text('forms/notes.txt')).toBe('сгенерировано\n');

    await expect(bridge.undoLastTurn()).resolves.toBe('undone');

    expect(files.text('forms/notes.txt')).toBe('было\n');
  });

  it('сопутствующий файл, созданный ходом, остаётся — и об этом сказано', async () => {
    const files = createFakeFiles({ [FORM]: EMPTY });
    const { session, bridge } = harness([addField('email')], { files });

    await bridge.send('добавь поле');
    await expect(bridge.undoLastTurn()).resolves.toBe('undone');

    expect(files.text('forms/notes.txt')).toBe('fields: email\n');
    expect(session.get().error).toContain('turn.undo.created');
  });

  it('правка человека поверх сопутствующего файла — отмена отказывает и не пишет ничего', async () => {
    const files = createFakeFiles({ [FORM]: EMPTY, 'forms/notes.txt': 'было\n' });
    const { host, bridge } = harness([addField('email')], { files });
    await bridge.send('добавь поле');
    const written = host.writes.length;
    await files.write('forms/notes.txt', 'правка человека\n');

    await expect(bridge.undoLastTurn()).resolves.toBe('overlapped');

    expect(host.writes).toHaveLength(written);
    expect(files.text('forms/notes.txt')).toBe('правка человека\n');
  });

  it('«Восстановить» возвращает форму снимком, сопутствующее — стеку, ленту обрезает', async () => {
    const files = createFakeFiles({ [FORM]: EMPTY });
    const { host, session, bridge, stack } = harness([addField('email')], { files });
    await bridge.send('добавь поле');

    await bridge.restoreTo(session.get().entries[0].id);

    expect(host.writes.at(-1)?.text).toBe(EMPTY);
    expect(stack.rewinds).toEqual([{ path: FORM, files: true }]);
    expect(session.get().entries).toEqual([]);
    expect(bridge.canUndoTurn()).toBe(false);
  });

  it('до первого хода отменять нечего, дважды один ход не отменяется', async () => {
    const { bridge } = harness([addField('email')]);
    await expect(bridge.undoLastTurn()).resolves.toBe('nothing');

    await bridge.send('добавь поле');

    await expect(bridge.undoLastTurn()).resolves.toBe('undone');
    await expect(bridge.undoLastTurn()).resolves.toBe('nothing');
  });
});

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

describe('записи инструментов плагинов', () => {
  it('пишут дверью хода той же пометкой, что правка формы, и отменяются вместе с ней', async () => {
    const files = createFakeFiles({ [FORM]: EMPTY, 'notes.md': 'old' });
    const { host, bridge } = harness([addField('email'), writeNote, { text: 'Готово.' }], {
      files,
      assistantTools: [writerTool('notes.md', 'new')],
    });

    await bridge.send('добавь поле и заметку');

    expect(files.text('notes.md')).toBe('new');
    const pluginWrite = files.writes.find((write) => write.path === 'notes.md');
    expect(pluginWrite?.mark?.origin).toBe('agent');
    expect(host.writes.at(-1)?.mark?.txId).toBe(pluginWrite?.mark?.txId);

    await expect(bridge.undoLastTurn()).resolves.toBe('undone');
    expect(files.text('notes.md')).toBe('old');
    expect(host.documentOf(FORM)?.getText()).toBe(EMPTY);
  });

  it('ход, в котором писал только плагин, не молчаливый и тоже отменяется', async () => {
    const files = createFakeFiles({ [FORM]: EMPTY, 'notes.md': 'old' });
    const { session, bridge } = harness([writeNote], {
      files,
      assistantTools: [writerTool('notes.md', 'new')],
    });

    await bridge.send('обнови заметку');

    expect(session.get()).toMatchObject({ status: 'idle', error: null });
    await expect(bridge.undoLastTurn()).resolves.toBe('undone');
    expect(files.text('notes.md')).toBe('old');
  });

  it('документ формы плагину не отдаётся — отказ стека; читающему запись отказана', async () => {
    const files = createFakeFiles({ [FORM]: EMPTY });
    const toForm = harness([writeNote], {
      files,
      assistantTools: [writerTool(FORM, '{}')],
    });
    await toForm.bridge.send('перепиши форму');
    expect(toForm.host.writes).toEqual([]);
    expect(files.writes).toEqual([]);

    const readOnly = harness([writeNote], {
      files,
      assistantTools: [writerTool('notes.md', 'x', true)],
    });
    await readOnly.bridge.send('запиши');
    expect(files.writes).toEqual([]);
  });
});

/** Шаг сценария: модель спрашивает человека. */
const askStep = (question: string, options: readonly string[]): FakeStep => ({
  tool: 'ask_user',
  args: { questions: [{ question, options: options.map((label) => ({ label })) }] },
});

/** Дождаться карточки вопросов, ждущей ответа. */
function untilAsk(session: AiSession): Promise<AskCard> {
  return new Promise((resolve) => {
    const subscription = session.subscribe(() => {
      const card = openAskOf(session.get());
      if (card === null) return;
      subscription.dispose();
      resolve(card);
    });
  });
}

describe('вопросы модели', () => {
  it('ответ продолжает тот же ход: правка после вопроса ложится, реплика одна', async () => {
    const { host, session, bridge } = harness([
      askStep('Поле обязательное?', ['Да', 'Нет']),
      addField('email'),
      { text: 'Готово.' },
    ]);
    const turn = bridge.send('добавь поле почты');
    const card = await untilAsk(session);

    expect(bridge.answer(card.id, [{ selected: ['Да'] }])).toBe(true);
    await turn;

    expect(session.get().entries.map((entry) => entry.role)).toEqual(['user', 'assistant']);
    expect(host.writes).toHaveLength(1);
    expect(session.get().entries[1].asks?.[0].answers).toEqual([{ selected: ['Да'] }]);
  });

  it('«Остановить» снимает карточку: ход кончается без ответа и без замечаний', async () => {
    const { host, session, bridge } = harness([
      askStep('Поле обязательное?', ['Да', 'Нет']),
      addField('email'),
    ]);
    const turn = bridge.send('добавь поле');
    const card = await untilAsk(session);
    bridge.abort();
    await turn;

    expect(session.get().entries[1].asks?.[0]).toMatchObject({ id: card.id, cancelled: true });
    expect(host.writes).toEqual([]);
    expect(session.get()).toMatchObject({ status: 'idle', error: null });
  });
});

/** Шаблоны-двойник: кладут пустую форму двойника файлом `forms/<имя>.fake.json`. */
function fakeCreator(files: FakeFiles) {
  const requests: Parameters<FormCreatorService['create']>[0][] = [];
  const creator: FormCreatorService = {
    templates: async () => [{ id: 'simple', name: 'Простая', source: 'builtin' }],
    async create(request) {
      requests.push(request);
      if (request.template !== undefined && request.template !== 'simple') {
        return { ok: false, error: 'error.unknown-template', message: 'нет шаблона' };
      }
      const path = `forms/${request.formName}.fake.json`;
      files.put(path, EMPTY);
      return { ok: true, documentId: path, path, template: request.template ?? null };
    },
  };
  return { creator, requests };
}

describe('создание формы', () => {
  it('без открытой формы ход начинается с создания и продолжается на новой форме', async () => {
    const files = createFakeFiles();
    const { creator } = fakeCreator(files);
    const { provider, requests } = recordingSequence([
      [{ tool: 'create_form', args: { name: 'credit' } }],
      [addField('amount'), { text: 'Анкета готова.' }],
    ]);
    const { host, session, bridge } = harness([], {
      files,
      provider,
      openForm: false,
      formCreator: creator,
    });

    await bridge.send('сделай анкету на кредит');

    const created = 'forms/credit.fake.json';
    expect(host.activeResource()).toBe(created);
    expect(host.documentOf(created)?.getText()).toBe(fakeFormText(['amount']));
    expect(session.get().entries.filter((entry) => entry.role === 'user')).toHaveLength(1);
    expect(session.get()).toMatchObject({ status: 'idle', error: null });
    // Первая попытка — без формы: промпт создания даёт стек, инструменты — только создание.
    expect(requests[0].system).toContain('Fake forms: create one with create_form.');
    expect(requests[0].tools).not.toContain('add_field');
    expect(requests[1].tools).toContain('add_field');
  });

  it('неизвестный шаблон — отказ модели, формы нет', async () => {
    const files = createFakeFiles({ [FORM]: EMPTY });
    const { creator } = fakeCreator(files);
    const { session, bridge } = harness(
      [{ tool: 'create_form', args: { name: 'credit', template: 'nope' } }, { text: 'Нет.' }],
      { files, formCreator: creator }
    );

    await bridge.send('сделай форму по шаблону nope');

    const failed = session
      .get()
      .entries.at(-1)
      ?.tools.find((tool) => tool.name === 'create_form');
    expect(failed?.ok).toBe(false);
    expect(files.text('forms/credit.fake.json')).toBeUndefined();
  });

  it('без открытой формы и без шаблонов — «откройте форму»', async () => {
    const { session, bridge } = harness([], { openForm: false });

    await bridge.send('сделай форму');

    expect(session.get().error).toBe('turn.noForm');
  });
});
