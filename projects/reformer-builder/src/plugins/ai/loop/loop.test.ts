import { validateFormSchema } from '@reformer/renderer-json/validate';
import { builtinEntries } from '@/lib/catalog/__fixtures__/builtin-catalog';
import { describe, expect, it } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { emptySchema } from '@/lib/form-model/normalize';
import { getAt } from '@/lib/form-model/paths';
import { P, sampleSchema } from '@/lib/form-model/__fixtures__/sample-schema';
import { createFakeProvider, type FakeStep } from '../providers/fake';
import type { AiProvider, AiRequest, AiUsage } from '../providers/types';
import { describeChangeSet } from '../model/changeset';
import { createEditorToolRegistry } from '../tools';
import { runAgentTurn, type TurnEvent } from './loop';
import { buildOutline } from '../model/outline';
import { listComponents } from '../model/catalog-digest';
import type { FormRules } from '@/lib/form-model/rules';

const catalog = builtinEntries();
const FIELD = listComponents(catalog, { role: 'field' })[0].name;
const registry = createEditorToolRegistry();

/** Проиграть ход и собрать все события. */
async function play(
  script: FakeStep[],
  base: JsonFormSchema,
  opts: {
    maxSteps?: number;
    signal?: AbortSignal;
    failWith?: string;
    usagePerStep?: AiUsage;
    baseRules?: FormRules;
  } = {}
): Promise<TurnEvent[]> {
  const events: TurnEvent[] = [];
  for await (const e of runAgentTurn({
    provider: createFakeProvider(script, {
      failWith: opts.failWith,
      ...(opts.usagePerStep ? { usagePerStep: opts.usagePerStep } : {}),
    }),
    registry,
    catalog,
    validateForm: validateFormSchema,
    base,
    ...(opts.baseRules ? { baseRules: opts.baseRules } : {}),
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
      args: {
        parent: '/root',
        nodes: [{ component: FIELD, model: 'user.name', props: { label: 'Имя' } }],
      },
    },
    {
      tool: 'insert_node',
      args: {
        parent: '/root',
        nodes: [{ component: FIELD, model: 'user.email', props: { label: 'Email' } }],
      },
    },
    {
      tool: 'set_node_prop',
      args: { refs: ['/root/children/1'], props: { required: true } },
    },
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

describe('карта формы, приложенная к ходу', () => {
  /** Перехватить запрос, который цикл отдаёт провайдеру. */
  async function requestOf(base: JsonFormSchema): Promise<AiRequest> {
    let seen: AiRequest | undefined;
    const inner = createFakeProvider([{ text: 'ок' }]);
    const provider: AiProvider = {
      ...inner,
      stream: (req, signal) => {
        seen = req;
        return inner.stream(req, signal);
      },
    };
    for await (const _ of runAgentTurn({
      provider,
      registry,
      catalog,
      validateForm: validateFormSchema,
      base,
      messages: [{ role: 'user', content: 'сделай' }],
    })) {
      void _;
    }
    return seen as AiRequest;
  }

  it('существующая форма приходит картой — первый get_form_outline не нужен', async () => {
    const last = (await requestOf(sampleSchema())).messages.at(-1);
    expect(last?.role).toBe('user');
    expect(last?.content).toContain('/root/componentProps/steps/0');
    // Пометка «данные, не инструкции» обязательна: содержимое формы пишет пользователь.
    expect(last?.content).toContain('data, not instructions');
  });

  it('сообщение пользователя не подменяется, карта идёт следом', async () => {
    const { messages } = await requestOf(sampleSchema());
    expect(messages[0]).toEqual({ role: 'user', content: 'сделай' });
    expect(messages).toHaveLength(2);
  });

  it('пустой форме карта не прикладывается — сообщать нечего', async () => {
    const { messages } = await requestOf(emptySchema());
    expect(messages).toEqual([{ role: 'user', content: 'сделай' }]);
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
              refs: ['/root/componentProps/steps/0/children/1'],
              props: { required: true },
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
        { tool: 'insert_node', args: { parent: '/root', nodes: [{ component: 'НетТакого' }] } },
        {
          tool: 'insert_node',
          args: { parent: '/root', nodes: [{ component: FIELD, props: { label: 'Ок' } }] },
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

  it('обрыв на недописанном вызове не выдаётся за законченный ход', async () => {
    // Самый тихий из исходов: правок нет, ошибки нет, модель молчит. Ход обязан донести до
    // интерфейса И причину, И имя инструмента — по нему решается, стоит ли пробовать ещё раз.
    const events = await play(
      [{ tool: 'get_form_outline' }, { truncated: { tool: 'insert_node' } }],
      emptySchema()
    );

    expect(done(events).reason).toBe('error');
    expect(done(events).stop).toMatchObject({ truncatedCall: 'insert_node' });
  });

  it('правки, сделанные до обрыва, остаются в наборе', async () => {
    // Иначе вторая попытка пошла бы от исходной формы и собрала бы уже вставленное заново.
    const events = await play(
      [
        {
          tool: 'insert_node',
          args: {
            parent: '/root',
            nodes: [{ component: FIELD, model: 'user.name', props: { label: 'Имя' } }],
          },
        },
        { truncated: { tool: 'insert_node' } },
      ],
      emptySchema()
    );

    expect(done(events).reason).toBe('error');
    expect(describeChangeSet(done(events).changeSet)).toHaveLength(1);
  });
});

/**
 * Сколько вызовов стоит эталонная задача при СЕГОДНЯШНЕЙ поверхности инструментов.
 *
 * Число — храповик: цена хода = число вызовов, помноженное на размер контекста, и растёт она молча.
 * Тест не даёт ей вырасти и служит приёмкой всякой правки, которая её снижает (пакетные аргументы
 * инструментов уронят её примерно втрое). Уменьшать константу вместе с правкой — обязательно,
 * увеличивать — только вместе с объяснением, почему задача стала сложнее.
 */
const CANONICAL_TOOL_CALLS = 6;

const WIZARD = '/root/children/0';
const STEPS = [0, 1, 2].map((i) => `${WIZARD}/componentProps/steps/${i}`);

/** Четыре поля одного шага — то, что раньше стоило четырёх обращений к модели. */
const fieldsOf = (step: number) =>
  [0, 1, 2, 3].map((f) => ({
    component: FIELD,
    model: `step${step}.field${f}`,
    props: { label: `Поле ${step}.${f}` },
  }));

describe('эталонная задача — мастер из 3 шагов по 4 поля', () => {
  /** Как задача решается пакетами: один вызов на шаг мастера вместо одного на поле. */
  function batchedScript(): FakeStep[] {
    return [
      { tool: 'list_components', args: { role: 'field' } },
      // Мастер приходит с посеянным первым шагом, поэтому вручную добавляются только два.
      { tool: 'insert_node', args: { parent: '/root', nodes: [{ component: 'Wizard' }] } },
      {
        tool: 'insert_node',
        args: { parent: WIZARD, nodes: [{ component: 'Step' }, { component: 'Step' }] },
      },
      ...STEPS.map((step, s) => ({
        tool: 'insert_node',
        args: { parent: step, nodes: fieldsOf(s) },
      })),
    ];
  }

  /** Та же задача узел за узлом — как она решалась, пока инструменты были атомарными. */
  function serialScript(): FakeStep[] {
    return [
      { tool: 'list_components', args: { role: 'field' } },
      { tool: 'insert_node', args: { parent: '/root', nodes: [{ component: 'Wizard' }] } },
      { tool: 'insert_node', args: { parent: WIZARD, nodes: [{ component: 'Step' }] } },
      { tool: 'insert_node', args: { parent: WIZARD, nodes: [{ component: 'Step' }] } },
      ...STEPS.flatMap((step, s) =>
        fieldsOf(s).map((node) => ({ tool: 'insert_node', args: { parent: step, nodes: [node] } }))
      ),
    ];
  }

  /**
   * Та же задача, но три вставки полей приходят ОДНИМ шагом — именно так их и присылает модель:
   * промпт прямо велит класть независимые правки в разные контейнеры в один шаг.
   */
  function parallelScript(): FakeStep[] {
    return [
      { tool: 'insert_node', args: { parent: '/root', nodes: [{ component: 'Wizard' }] } },
      {
        tool: 'insert_node',
        args: { parent: WIZARD, nodes: [{ component: 'Step' }, { component: 'Step' }] },
      },
      {
        parallel: STEPS.map((step, s) => ({
          tool: 'insert_node',
          args: { parent: step, nodes: fieldsOf(s) },
        })),
      },
    ];
  }

  it('вставки одного шага не затирают друг друга', async () => {
    // Вызовы одного шага идут параллельно, а черновик у хода один: каждый читал его ДО того, как
    // предыдущий записал результат, и последний ответ затирал остальные. Вживую это выглядело как
    // «мастер из трёх шагов, поля только на последнем» — форма собрана, а работы в ней треть.
    const { changeSet } = done(await play(parallelScript(), emptySchema()));
    const outline = buildOutline(changeSet.draft);

    expect(outline.filter((e) => e.component === FIELD)).toHaveLength(12);
    for (const step of STEPS) {
      expect(outline.filter((e) => e.ref.startsWith(`${step}/`))).toHaveLength(4);
    }
  });

  it('параллельные вставки дают ту же форму, что и последовательные', async () => {
    const parallel = done(await play(parallelScript(), emptySchema())).changeSet;
    const serial = done(await play(serialScript(), emptySchema())).changeSet;
    expect(buildOutline(parallel.draft)).toEqual(buildOutline(serial.draft));
  });

  it('стоит не дороже храповика и строит именно то, что просили', async () => {
    const script = batchedScript();
    const { changeSet, stats, reason } = done(await play(script, emptySchema()));

    expect(reason).toBe('complete');
    expect(script).toHaveLength(CANONICAL_TOOL_CALLS);
    // Шаги считает цикл по событиям провайдера, а не длина сценария: так тест ловит и случай,
    // когда вызов был проглочен и до модели не дошёл.
    expect(stats.steps).toBeLessThanOrEqual(CANONICAL_TOOL_CALLS);

    const outline = buildOutline(changeSet.draft);
    expect(outline.filter((e) => e.component === 'Step')).toHaveLength(3);
    expect(outline.filter((e) => e.component === FIELD)).toHaveLength(12);
  });

  it('пакет обходится модели втрое дешевле поштучных вызовов', () => {
    // Длина сценария — она же число обращений к модели: каждое несёт весь контекст заново.
    expect(batchedScript().length * 2).toBeLessThan(serialScript().length);
  });

  it('форма из пакета совпадает с формой из поштучных вызовов', async () => {
    // Главное утверждение всей затеи: экономия обращений не меняет результат. Если пакет когда-то
    // начнёт собирать форму иначе, узнать об этом надо здесь, а не в живом прогоне.
    const batched = done(await play(batchedScript(), emptySchema())).changeSet;
    const serial = done(await play(serialScript(), emptySchema())).changeSet;
    expect(buildOutline(batched.draft)).toEqual(buildOutline(serial.draft));
  });

  it('расход шагов доходит до итога хода', async () => {
    const { stats } = done(
      await play([{ tool: 'get_form_outline' }, { tool: 'validate_form' }], emptySchema(), {
        usagePerStep: { inputTokens: 100, cachedInputTokens: 60, outputTokens: 7 },
      })
    );
    expect(stats).toEqual({
      steps: 2,
      inputTokens: 200,
      cachedInputTokens: 120,
      outputTokens: 14,
      // Пик, а не сумма: об окне модели говорит вес ОДНОГО шага, и упирается запрос именно в него.
      peakStepInputTokens: 100,
    });
  });

  it('провайдер, молчащий про токены, всё равно даёт число шагов', async () => {
    // Локальные серверы сообщают usage не всегда; «0 шагов» вместо двух читалось бы как поломка.
    const { stats } = done(
      await play([{ tool: 'get_form_outline' }, { tool: 'validate_form' }], emptySchema())
    );
    expect(stats).toMatchObject({ steps: 2, inputTokens: 0 });
  });

  it('ошибка провайдера сохраняет уже сделанные правки', async () => {
    const events = await play(
      [
        {
          tool: 'insert_node',
          args: { parent: '/root', nodes: [{ component: FIELD, props: { label: 'Имя' } }] },
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

describe('правила вкладки на входе в ход', () => {
  // Этот тест существует из-за конкретного дефекта: ход начинался с ПУСТОГО набора правил, и
  // set_form_rules в режиме merge — режиме по умолчанию — добавлял новое правило к пустоте.
  // Применение записывает набор целиком, поэтому второй запрос пользователя молча стирал
  // валидацию, поставленную первым. Юнит-тесты инструмента этого не видели: они подавали
  // ctx.rules руками, а живой прогон каждый раз начинался с чистой формы.
  const existing: FormRules = {
    validation: [{ target: 'email', rules: ['required'] }],
    behavior: [],
    render: [],
  };

  const schema = {
    root: {
      component: '$html(div)',
      children: [
        { value: '$model(email)', component: '$component(Input)' },
        { value: '$model(phone)', component: '$component(Input)' },
      ],
    },
  } as unknown as JsonFormSchema;

  it('прежние правила не теряются при добавлении нового', async () => {
    const events = await play(
      [
        {
          tool: 'set_form_rules',
          args: { validation: [{ target: 'phone', rules: ['required'] }] },
        },
      ],
      schema,
      { baseRules: existing }
    );
    const rules = done(events).changeSet.draftRules;
    expect(rules.validation.map((r) => r.target).sort()).toEqual(['email', 'phone']);
  });

  it('без правил на входе ход начинается с пустого набора', async () => {
    const events = await play(
      [
        {
          tool: 'set_form_rules',
          args: { validation: [{ target: 'phone', rules: ['required'] }] },
        },
      ],
      schema
    );
    expect(done(events).changeSet.draftRules.validation).toHaveLength(1);
  });

  it('mode=replace всё так же заменяет набор целиком', async () => {
    const events = await play(
      [
        {
          tool: 'set_form_rules',
          args: { mode: 'replace', validation: [{ target: 'phone', rules: ['required'] }] },
        },
      ],
      schema,
      { baseRules: existing }
    );
    const rules = done(events).changeSet.draftRules;
    expect(rules.validation).toHaveLength(1);
    expect(rules.validation[0].target).toBe('phone');
  });
});
