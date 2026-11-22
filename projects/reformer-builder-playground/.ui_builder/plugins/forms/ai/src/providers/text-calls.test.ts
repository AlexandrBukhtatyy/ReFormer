import { describe, expect, it } from 'vitest';
import {
  jsonSchema,
  simulateReadableStream,
  stepCountIs,
  streamText,
  tool,
  wrapLanguageModel,
} from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import {
  extractTextCalls,
  recoverTextCalls,
  textCallsMiddleware,
  type ModelStreamPart,
} from './text-calls';

const TOOLS = ['create_form', 'edit_file', 'read_file'];

/** Ответ Qwen2.5-Coder 14B в LM Studio на просьбу создать форму — дословно, из пробы 2026-11-21. */
const QWEN_CALL =
  '<tools>\n{\n  "name": "create_form",\n  "arguments": {\n    "name": "registration-form",\n' +
  '    "title": "Регистрация"\n  }\n}\n</tools>';

describe('вызовы в тексте', () => {
  it('обёртка <tools> у Qwen2.5-Coder — вызов, и от текста ничего не остаётся', () => {
    expect(extractTextCalls(QWEN_CALL, TOOLS)).toEqual({
      calls: [
        {
          toolName: 'create_form',
          input: JSON.stringify({ name: 'registration-form', title: 'Регистрация' }),
        },
      ],
      rest: '',
    });
  });

  it('<tool_call> с аргументами строкой JSON', () => {
    const text =
      '<tool_call>{"name": "read_file", "arguments": "{\\"path\\": \\"a.ts\\"}"}</tool_call>';
    expect(extractTextCalls(text, TOOLS).calls).toEqual([
      { toolName: 'read_file', input: '{"path":"a.ts"}' },
    ]);
  });

  it('блок ```json и ключ parameters; пояснение вокруг остаётся текстом', () => {
    const text =
      'Создаю форму.\n\n```json\n{"name": "create_form", "parameters": {"name": "a"}}\n```\n\nГотово.';
    expect(extractTextCalls(text, TOOLS)).toEqual({
      calls: [{ toolName: 'create_form', input: '{"name":"a"}' }],
      rest: 'Создаю форму.\n\nГотово.',
    });
  });

  it('конверт OpenAI: имя и аргументы внутри function', () => {
    const text =
      '{"type": "function", "function": {"name": "read_file", "arguments": "{\\"path\\": \\"b\\"}"}}';
    expect(extractTextCalls(text, TOOLS).calls).toEqual([
      { toolName: 'read_file', input: '{"path":"b"}' },
    ]);
  });

  it('несколько вызовов массивом — все и по порядку', () => {
    const text =
      '[{"name": "read_file", "arguments": {"path": "a"}}, {"name": "read_file", "arguments": {"path": "b"}}]';
    expect(extractTextCalls(text, TOOLS).calls.map((call) => call.input)).toEqual([
      '{"path":"a"}',
      '{"path":"b"}',
    ]);
  });

  it('сырой перевод строки и значение в обратных кавычках приводятся к JSON', () => {
    const text =
      '{"name": "edit_file", "arguments": {"path": "a.ts", "content": `const a = "x";\nexport {}`}}';
    const [call] = extractTextCalls(text, TOOLS).calls;
    expect(JSON.parse(call.input)).toEqual({
      path: 'a.ts',
      content: 'const a = "x";\nexport {}',
    });
  });

  it('неизвестный инструмент — не вызов, текст не меняется', () => {
    const text = 'Пример: {"name": "drop_database", "arguments": {}}';
    expect(extractTextCalls(text, TOOLS)).toEqual({ calls: [], rest: text });
  });

  it('объект аргументов без имени инструмента — не вызов', () => {
    const text = '{"name": "registration-form", "title": "Регистрация"}';
    expect(extractTextCalls(text, TOOLS).calls).toEqual([]);
  });

  it('битая запись Gemma 4 вызовом не становится — её ловит детектор textual-call', () => {
    const text = 'call:edit_file{edits:[{new_string:<|"|>abc';
    expect(extractTextCalls(text, TOOLS)).toEqual({ calls: [], rest: text });
  });
});

/** Прогнать части через разбор и собрать вывод. */
async function run(parts: ModelStreamPart[], tools = TOOLS): Promise<ModelStreamPart[]> {
  const output: ModelStreamPart[] = [];
  const reader = new ReadableStream<ModelStreamPart>({
    start(controller) {
      for (const part of parts) controller.enqueue(part);
      controller.close();
    },
  })
    .pipeThrough(recoverTextCalls(tools))
    .getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return output;
    output.push(value);
  }
}

const USAGE = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};

const finish = (raw = 'stop'): ModelStreamPart => ({
  type: 'finish',
  usage: USAGE,
  finishReason: { unified: 'stop', raw },
});

/** Блок текста `t1`, порезанный на куски как поток. */
const textBlock = (...deltas: string[]): ModelStreamPart[] => [
  { type: 'text-start', id: 't1' },
  ...deltas.map((delta): ModelStreamPart => ({ type: 'text-delta', id: 't1', delta })),
  { type: 'text-end', id: 't1' },
];

const textOf = (parts: ModelStreamPart[]) =>
  parts.flatMap((part) => (part.type === 'text-delta' ? [part.delta] : [])).join('');

describe('поток с вызовом в тексте', () => {
  it('вызов, порезанный на куски, становится tool-call, причина конца — tool-calls', async () => {
    const half = Math.floor(QWEN_CALL.length / 2);
    const output = await run([
      ...textBlock('<to', 'ols>', QWEN_CALL.slice('<tools>'.length, half), QWEN_CALL.slice(half)),
      finish('stop'),
    ]);
    expect(textOf(output)).toBe('');
    const call = output.find((part) => part.type === 'tool-call');
    expect(call).toMatchObject({
      type: 'tool-call',
      toolName: 'create_form',
      input: JSON.stringify({ name: 'registration-form', title: 'Регистрация' }),
    });
    expect(output.at(-1)).toMatchObject({
      type: 'finish',
      finishReason: { unified: 'tool-calls', raw: 'stop' },
    });
  });

  it('текст до обёртки идёт в ленту сразу, не дожидаясь конца блока', async () => {
    const output = await run([...textBlock('Создаю форму. ', QWEN_CALL), finish()]);
    expect(output[1]).toEqual({ type: 'text-delta', id: 't1', delta: 'Создаю форму. ' });
    expect(textOf(output)).toBe('Создаю форму. ');
    expect(output.some((part) => part.type === 'tool-call')).toBe(true);
  });

  it('обычный ответ проходит без изменений', async () => {
    const parts = [...textBlock('Форма ', 'готова: {поля} на месте.'), finish()];
    const output = await run(parts);
    expect(textOf(output)).toBe('Форма готова: {поля} на месте.');
    expect(output.at(-1)).toEqual(finish());
  });

  it('шаг с родным вызовом не трогается, даже если в тексте похожий JSON', async () => {
    const native: ModelStreamPart = {
      type: 'tool-call',
      toolCallId: 'c1',
      toolName: 'read_file',
      input: '{"path":"a"}',
    };
    const output = await run([
      { type: 'text-start', id: 't1' },
      { type: 'text-delta', id: 't1', delta: QWEN_CALL },
      native,
      { type: 'text-end', id: 't1' },
      finish('tool_calls'),
    ]);
    expect(textOf(output)).toBe(QWEN_CALL);
    expect(output.filter((part) => part.type === 'tool-call')).toEqual([native]);
    expect(output.at(-1)).toEqual(finish('tool_calls'));
  });

  it('блок без text-end разбирается на finish', async () => {
    const output = await run([
      { type: 'text-start', id: 't1' },
      { type: 'text-delta', id: 't1', delta: QWEN_CALL },
      finish(),
    ]);
    expect(output.some((part) => part.type === 'tool-call')).toBe(true);
    expect(output.some((part) => part.type === 'text-end')).toBe(false);
  });

  it('поток без finish отдаёт придержанное как было', async () => {
    const output = await run([
      { type: 'text-start', id: 't1' },
      { type: 'text-delta', id: 't1', delta: QWEN_CALL },
    ]);
    expect(textOf(output)).toBe(QWEN_CALL);
    expect(output.some((part) => part.type === 'tool-call')).toBe(false);
  });
});

describe('middleware', () => {
  const stream = (parts: ModelStreamPart[]) => simulateReadableStream({ chunks: parts });
  const params = (toolChoice: 'auto' | 'none') => ({
    prompt: [],
    toolChoice: { type: toolChoice },
    tools: [{ type: 'function' as const, name: 'create_form', inputSchema: {} }],
  });

  it('на шаге без инструментов (toolChoice none) поток не трогается', async () => {
    const original = { stream: stream([...textBlock(QWEN_CALL), finish()]) };
    const result = await textCallsMiddleware.wrapStream!({
      doStream: async () => original,
      doGenerate: async () => {
        throw new Error('not used');
      },
      params: params('none') as never,
      model: new MockLanguageModelV4(),
    });
    expect(result).toBe(original);
  });

  it('ход SDK исполняет вызов из текста и идёт дальше с ним в истории', async () => {
    const model = new MockLanguageModelV4({
      doStream: [
        { stream: stream([...textBlock(QWEN_CALL), finish()]) },
        { stream: stream([...textBlock('Форма создана.'), finish()]) },
      ],
    });
    const executed: unknown[] = [];
    const result = streamText({
      model: wrapLanguageModel({ model, middleware: textCallsMiddleware }),
      prompt: 'Создай форму регистрации',
      tools: {
        create_form: tool({
          inputSchema: jsonSchema<{ name: string; title: string }>({
            type: 'object',
            properties: { name: { type: 'string' }, title: { type: 'string' } },
            required: ['name', 'title'],
          }),
          execute: async (input) => {
            executed.push(input);
            return 'создана';
          },
        }),
      },
      stopWhen: stepCountIs(5),
    });

    expect(await result.text).toBe('Форма создана.');
    expect(executed).toEqual([{ name: 'registration-form', title: 'Регистрация' }]);
    // Второй запрос несёт вызов и его результат настоящими сообщениями, а не текстом.
    const second = model.doStreamCalls[1].prompt;
    expect(second.find((message) => message.role === 'assistant')?.content).toEqual([
      expect.objectContaining({ type: 'tool-call', toolName: 'create_form' }),
    ]);
    expect(second.some((message) => message.role === 'tool')).toBe(true);
  });
});
