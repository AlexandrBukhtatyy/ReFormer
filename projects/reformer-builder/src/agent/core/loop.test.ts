import { describe, expect, it } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { emptySchema, getAt } from '../../model';
import { P, sampleSchema } from '../../model/__fixtures__/sample-schema';
import { createFakeProvider, type FakeStep } from '../providers/fake';
import { describeChangeSet } from './changeset';
import { createEditorToolRegistry } from './index';
import { runAgentTurn, type TurnEvent } from './loop';
import { buildOutline } from './outline';
import { listComponents } from './catalog-digest';

const FIELD = listComponents({ role: 'field' })[0].name;
const registry = createEditorToolRegistry();

/** Проиграть ход и собрать все события. */
async function play(
  script: FakeStep[],
  base: JsonFormSchema,
  opts: { maxSteps?: number; signal?: AbortSignal; failWith?: string } = {}
): Promise<TurnEvent[]> {
  const events: TurnEvent[] = [];
  for await (const e of runAgentTurn({
    provider: createFakeProvider(script, { failWith: opts.failWith }),
    registry,
    base,
    messages: [{ role: 'user', content: 'сделай' }],
    maxSteps: opts.maxSteps,
    signal: opts.signal,
  })) {
    events.push(e);
  }
  return events;
}

const done = (events: TurnEvent[]) => events.at(-1) as Extract<TurnEvent, { type: 'done' }>;

describe('ход агента — создание формы с нуля', () => {
  const script: FakeStep[] = [
    { text: 'Создаю форму регистрации.' },
    { tool: 'list_components', args: { role: 'field' } },
    {
      tool: 'insert_node',
      args: { component: FIELD, parent: '/root', model: 'user.name', props: { label: 'Имя' } },
    },
    {
      tool: 'insert_node',
      args: { component: FIELD, parent: '/root', model: 'user.email', props: { label: 'Email' } },
    },
    { tool: 'set_node_prop', args: { ref: '/root/children/1', key: 'required', value: true } },
    { tool: 'validate_form' },
    { text: 'Готово: добавил два поля.' },
  ];

  it('черновик собирается, база остаётся нетронутой', async () => {
    const base = emptySchema();
    const { changeSet, reason } = done(await play(script, base));

    expect(reason).toBe('complete');
    expect(changeSet.base).toBe(base);
    expect(
      buildOutline(changeSet.draft)
        .slice(1)
        .map((e) => [e.model, e.label])
    ).toEqual([
      ['user.name', 'Имя'],
      ['user.email', 'Email'],
    ]);
    expect(buildOutline(base)).toHaveLength(1);
  });

  it('журнал изменений описывает только правки, без чтений', async () => {
    const { changeSet } = done(await play(script, emptySchema()));
    expect(describeChangeSet(changeSet)).toEqual([
      `+ Имя (${FIELD})`,
      `+ Email (${FIELD})`,
      '~ Email → required = true',
    ]);
  });

  it('рассуждение доходит до интерфейса, но не смешивается с ответом', async () => {
    const events = await play(
      [{ reasoning: 'Нужно поле email.' }, { text: 'Добавляю.' }],
      emptySchema()
    );
    expect(events.filter((e) => e.type === 'reasoning')).toEqual([
      { type: 'reasoning', text: 'Нужно поле email.' },
    ]);
    expect(events.filter((e) => e.type === 'text')).toEqual([{ type: 'text', text: 'Добавляю.' }]);
  });

  it('события хода несут текст и имена вызванных инструментов', async () => {
    const events = await play(script, emptySchema());
    expect(
      events.filter((e) => e.type === 'text').map((e) => (e as { text: string }).text)
    ).toEqual(['Создаю форму регистрации.', 'Готово: добавил два поля.']);
    expect(
      events.filter((e) => e.type === 'tool').map((e) => (e as { name: string }).name)
    ).toEqual(['list_components', 'insert_node', 'insert_node', 'set_node_prop', 'validate_form']);
  });
});

describe('ход агента — правка существующей формы', () => {
  it('непричастные ветки сохраняют ссылочную идентичность', async () => {
    const base = sampleSchema();
    const { changeSet } = done(
      await play(
        [
          { tool: 'get_form_outline' },
          {
            tool: 'set_node_prop',
            args: {
              ref: '/root/componentProps/steps/0/children/1',
              key: 'required',
              value: true,
              expect: { model: 'loanAmount' },
            },
          },
        ],
        base
      )
    );
    expect(getAt(changeSet.draft, P.step1)).toBe(getAt(base, P.step1));
    expect(getAt(changeSet.draft, P.step0field0)).toBe(getAt(base, P.step0field0));
  });

  it('неудачный вызов не попадает в журнал, ход продолжается', async () => {
    const events = await play(
      [
        { tool: 'insert_node', args: { component: 'НетТакого', parent: '/root' } },
        {
          tool: 'insert_node',
          args: { component: FIELD, parent: '/root', props: { label: 'Ок' } },
        },
      ],
      emptySchema()
    );
    const tools = events.filter((e) => e.type === 'tool') as Extract<TurnEvent, { type: 'tool' }>[];
    expect(tools[0].ok).toBe(false);
    expect(tools[0].error?.code).toBe('UNKNOWN_COMPONENT');
    expect(tools[1].ok).toBe(true);
    expect(describeChangeSet(done(events).changeSet)).toEqual([`+ Ок (${FIELD})`]);
  });
});

describe('границы хода', () => {
  it('предел шагов останавливает ход ошибкой', async () => {
    const events = await play(
      [{ tool: 'get_form_outline' }, { tool: 'get_form_outline' }, { tool: 'get_form_outline' }],
      emptySchema(),
      { maxSteps: 2 }
    );
    expect(done(events).reason).toBe('error');
    expect(done(events).message).toContain('предел шагов');
  });

  it('прерывание доводится до провайдера', async () => {
    const controller = new AbortController();
    controller.abort();
    const events = await play([{ tool: 'get_form_outline' }], emptySchema(), {
      signal: controller.signal,
    });
    expect(done(events).reason).toBe('aborted');
  });

  it('ошибка провайдера сохраняет уже сделанные правки', async () => {
    const events = await play(
      [
        {
          tool: 'insert_node',
          args: { component: FIELD, parent: '/root', props: { label: 'Имя' } },
        },
      ],
      emptySchema(),
      { failWith: 'соединение разорвано' }
    );
    expect(done(events).reason).toBe('error');
    expect(done(events).message).toBe('соединение разорвано');
    // Черновик уцелел: пользователь увидит предпросмотр того, что успело примениться.
    expect(describeChangeSet(done(events).changeSet)).toHaveLength(1);
  });
});
