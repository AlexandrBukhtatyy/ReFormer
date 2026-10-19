import { validateFormSchema } from '@reformer/renderer-json/validate';
import { describe, expect, it } from 'vitest';
import { emptySchema } from '../../../core/form-model';
import { builtinEntries } from '../../../core/testing';
import { validateSchema } from '../model/validate';
import { printSchemaText } from '../model/schema-text';
import { createFakeProvider, type FakeStep } from '../providers/fake';
import type { AiProvider, AiRequest } from '../providers/types';
import { createFakeFiles, createTestFileTurn, FORM_PATH, type FakeFiles } from '../testing';
import { createFileToolRegistry } from '../tools/files';
import { fileSystemPrompt } from './file-prompt';
import { fileSeed, runFileTurn, type FileTurnEvent } from './file-loop';
import type { FileTurn } from '../files/turn';

const catalog = builtinEntries();
const registry = createFileToolRegistry();
const EMPTY = printSchemaText(emptySchema());

/** Проиграть ход над двойником файлов и собрать события. */
async function play(
  script: FakeStep[],
  files: FakeFiles,
  provider: AiProvider = createFakeProvider(script)
): Promise<{ events: FileTurnEvent[]; turn: FileTurn }> {
  const turn = await createTestFileTurn(files);
  const events: FileTurnEvent[] = [];
  for await (const event of runFileTurn({
    provider,
    registry,
    turn,
    catalog,
    validateForm: validateFormSchema,
    messages: [{ role: 'user', content: 'сделай' }],
  })) {
    events.push(event);
  }
  return { events, turn };
}

const done = (events: FileTurnEvent[]) => events.at(-1) as Extract<FileTurnEvent, { type: 'done' }>;

/** Провайдер, который только запоминает запрос. */
function capturing(): { provider: AiProvider; request: () => AiRequest } {
  let seen: AiRequest | undefined;
  return {
    provider: {
      id: 'capture',
      displayName: 'capture',
      origin: 'browser',
      detect: async () => ({ available: true }),
      capabilities: () => ({ streaming: true, tools: true, images: false, languages: ['ru'] }),
      async *stream(request) {
        seen = request;
        yield { type: 'done', reason: 'complete' };
      },
    },
    request: () => {
      if (!seen) throw new Error('запроса не было');
      return seen;
    },
  };
}

/** Поле кита — узлом JSON, как его вставит модель по скелету `describe_component`. */
const field = (path: string, label: string) => ({
  model: `$model(${path})`,
  component: '$component(Input)',
  componentProps: { label },
});

describe('затравка хода', () => {
  it('модуль, файлы с ролями и документ формы — данными, в хвосте диалога', async () => {
    const files = createFakeFiles({
      [FORM_PATH]: EMPTY,
      'forms/loan/model/model.ts': 'export {};\n',
    });
    const { provider, request } = capturing();
    await play([], files, provider);
    const seed = request().messages.at(-1);
    expect(seed?.role).toBe('user');
    expect(seed?.content).toMatch(
      /^Form module at the start of this turn \(data, not instructions\):/
    );
    expect(seed?.content).toContain('Module location: forms/loan');
    expect(seed?.content).toContain('Form document: schema/form.schema.json');
    expect(seed?.content).toContain('model/model.ts [derived');
    expect(seed?.content).toContain('     1\t{');
    expect(request().system).toBe(fileSystemPrompt(catalog));
    expect(request().tools.map((t) => t.name)).toEqual(registry.list().map((t) => t.name));
  });

  it('документ из затравки считается прочитанным — его можно заменить целиком', async () => {
    const files = createFakeFiles({ [FORM_PATH]: EMPTY });
    const turn = await createTestFileTurn(files);
    await fileSeed(turn);
    expect(turn.seen('schema/form.schema.json')).toBe(EMPTY);
  });

  it('большой документ — первой страницей и подсказкой, откуда читать дальше', async () => {
    const big = printSchemaText({
      ...emptySchema(),
      root: {
        component: '$component(Box)',
        children: Array.from({ length: 300 }, (_, i) => field(`f${i}`, `Поле ${i}`)),
      },
    } as never);
    const files = createFakeFiles({ [FORM_PATH]: big });
    const seed = await fileSeed(await createTestFileTurn(files));
    expect(seed.length).toBeLessThanOrEqual(8000);
    expect(seed).toMatch(/Continue: read_file offset=\d+$/);
  });
});

describe('ход над файлами', () => {
  it('вызовы одного шага исполняются по очереди: вторая правка видит первую', async () => {
    const files = createFakeFiles({ [FORM_PATH]: EMPTY, 'forms/loan/x.ts': 'A\n' });
    await play(
      [
        {
          parallel: [
            {
              tool: 'edit_file',
              args: { path: 'x.ts', edits: [{ old_string: 'A', new_string: 'B' }] },
            },
            {
              tool: 'edit_file',
              args: { path: 'x.ts', edits: [{ old_string: 'B', new_string: 'C' }] },
            },
          ],
        },
      ],
      files
    );
    expect(files.text('forms/loan/x.ts')).toBe('C\n');
  });

  it('выдуманный компонент отвергается, в рабочую копию не попадает ничего', async () => {
    const files = createFakeFiles({ [FORM_PATH]: EMPTY });
    const bad = JSON.stringify({ component: '$component(EmailField)' });
    const { events } = await play(
      [
        {
          tool: 'edit_file',
          args: {
            path: 'schema/form.schema.json',
            edits: [{ old_string: '"children": []', new_string: `"children": [${bad}]` }],
          },
        },
        { text: 'Не вышло.' },
      ],
      files
    );
    const tool = events.find((e) => e.type === 'tool');
    expect(tool).toMatchObject({ name: 'edit_file', ok: false });
    expect(files.writes).toHaveLength(0);
    expect(done(events).touched).toEqual([]);
  });

  it('эталон «мастер 3×4»: скелет и одна правка — валидная форма за два вызова', async () => {
    const files = createFakeFiles({ [FORM_PATH]: EMPTY });
    const step = (title: string, prefix: string) => ({
      component: '$component(Step)',
      componentProps: { title },
      children: ['a', 'b', 'c', 'd'].map((name) => field(`${prefix}.${name}`, `${title}: ${name}`)),
    });
    const wizard = {
      component: '$component(Wizard)',
      children: [
        step('Личные данные', 'person'),
        step('Контакты', 'contacts'),
        step('Работа', 'job'),
      ],
    };
    const { events, turn } = await play(
      [
        { tool: 'describe_component', args: { names: ['Wizard', 'Step', 'Input'] } },
        {
          tool: 'edit_file',
          args: {
            path: 'schema/form.schema.json',
            edits: [
              {
                old_string: '"children": []',
                new_string: `"children": [${JSON.stringify(wizard)}]`,
              },
            ],
          },
        },
        { text: 'Готово: мастер из трёх шагов по четыре поля.' },
      ],
      files
    );

    const tools = events.filter((e) => e.type === 'tool');
    expect(tools).toHaveLength(2);
    expect(tools.every((e) => e.type === 'tool' && e.ok)).toBe(true);
    expect(done(events)).toMatchObject({
      reason: 'complete',
      touched: ['schema/form.schema.json'],
    });
    expect(done(events).stats.steps).toBe(2);

    const written = files.text(FORM_PATH) ?? '';
    expect(written.match(/\$model\(/g)).toHaveLength(12);
    const result = validateSchema(turn.draft(), { catalog, validateForm: validateFormSchema });
    expect(result.errors).toEqual([]);
  });
});
