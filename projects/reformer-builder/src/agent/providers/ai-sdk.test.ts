import { describe, expect, it, vi } from 'vitest';
import type { LanguageModel } from 'ai';
import type { AiEvent, AiRequest } from './types';

/**
 * Части потока, которые отдаст подменённый `streamText`. Переменная поднята `vi.hoisted`: фабрика
 * мока исполняется до тела файла, и обычная `let` в ней ещё не существует.
 */
const stream = vi.hoisted(() => ({
  parts: [] as unknown[],
  args: {} as Record<string, unknown>,
  /** Номер шага, который мок подставит в `prepareStep`. */
  stepNumber: 0,
  /** Шаги, которые мок подставит в условия `stopWhen`. */
  steps: [] as Array<{ usage: { inputTokens?: number } }>,
}));

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return {
    ...actual,
    streamText: (args: Record<string, unknown>) => {
      // Аргументы запоминаются целиком: половина этого файла проверяет не поток, а то, ЧЕМ именно
      // мы зовём модель — пометку кэша, пределы, таймауты.
      stream.args = args;
      return {
        fullStream: (async function* () {
          // SDK зовёт prepareStep перед каждым шагом; мок повторяет один вызов, иначе отметки,
          // которые там ставятся (например «дошли до последнего шага»), не успели бы сработать.
          const prepare = args.prepareStep as
            | ((o: { stepNumber: number; messages: unknown[] }) => unknown)
            | undefined;
          prepare?.({ stepNumber: stream.stepNumber, messages: [] });
          // SDK так же спрашивает условия остановки после каждого шага. Мок повторяет один опрос,
          // иначе отметка «бюджет исчерпан» не успела бы сработать до конца потока.
          const stop = args.stopWhen;
          for (const condition of Array.isArray(stop) ? stop : [stop]) {
            (condition as ((o: { steps: unknown[] }) => boolean) | undefined)?.({
              steps: stream.steps,
            });
          }
          // Ошибка в сценарии = поток оборвался исключением, а не событием: так ведут себя
          // сетевые сбои и таймаут самого SDK.
          for (const part of stream.parts) {
            if (part instanceof Error) throw part;
            yield part;
          }
        })(),
      };
    },
  };
});

const { streamViaAiSdk } = await import('./ai-sdk');
type AiSdkTuning = import('./ai-sdk').AiSdkTuning;

/** Запрос по умолчанию — без предела шагов, как его теперь и собирает цикл. */
const REQUEST: AiRequest = {
  system: 's',
  messages: [{ role: 'user', content: 'добавь поле' }],
  tools: [],
};

/** Проиграть заданный поток SDK и собрать наши события. */
async function play(
  parts: unknown[],
  tuning?: AiSdkTuning,
  req: AiRequest = REQUEST,
  stepNumber = 0
): Promise<AiEvent[]> {
  stream.parts = parts;
  stream.stepNumber = stepNumber;
  const events: AiEvent[] = [];
  for await (const e of streamViaAiSdk({} as LanguageModel, req, undefined, tuning)) {
    events.push(e);
  }
  return events;
}

/** Чем позвали модель в последнем проигрыше. */
const lastCall = () => stream.args;

describe('перевод потока AI SDK', () => {
  it('рассуждение доходит отдельным событием, а не теряется по дороге', async () => {
    // Ровно случай think-модели: `content` пуст, весь поток идёт частями reasoning.
    const events = await play([
      { type: 'reasoning-delta', id: 'r0', text: 'Сначала ' },
      { type: 'reasoning-delta', id: 'r0', text: 'посмотрю схему.' },
      { type: 'text-delta', id: 't0', text: 'Готово.' },
      { type: 'finish', finishReason: 'stop' },
    ]);

    expect(events).toMatchObject([
      { type: 'reasoning', text: 'Сначала ' },
      { type: 'reasoning', text: 'посмотрю схему.' },
      { type: 'delta', text: 'Готово.' },
      { type: 'done', reason: 'complete' },
    ]);
  });

  it('обрыв на пределе длины — ошибка, а не успешный ход', async () => {
    const events = await play([
      { type: 'reasoning-delta', id: 'r0', text: 'Думаю…' },
      { type: 'finish', finishReason: 'length' },
    ]);

    const error = events.find((e) => e.type === 'error');
    expect(error).toMatchObject({ type: 'error', retryable: false });
    expect((error as { message: string }).message).toContain('пределе длины');
    // Главное: `done` не выдаёт обрыв за нормальное завершение.
    expect(events.at(-1)).toMatchObject({ type: 'done', reason: 'error' });
  });

  it('фильтр содержимого тоже не выдаётся за успех', async () => {
    const events = await play([{ type: 'finish', finishReason: 'content-filter' }]);
    expect(events.at(-1)).toMatchObject({ type: 'done', reason: 'error' });
  });

  it('остановка на пределе шагов не выдаётся за законченную работу', async () => {
    // 'tool-calls' в ИТОГОВОМ finish означает ровно одно: модель просила следующий инструмент, а
    // шаги кончились (`stopWhen: stepCountIs`). Раньше это считалось нормальным завершением — и в
    // живых прогонах локальной модели ход, упёршийся в предел на полпути, выглядел в панели как
    // доделанная работа: половина формы, никакого предупреждения. Набор изменений при этом цел и
    // остаётся применимым (`ChatPanel` рисует его по `pending`, независимо от статуса), поэтому
    // сообщение говорит и о применимости, и о том, что работа не закончена.
    const events = await play([{ type: 'finish', finishReason: 'tool-calls' }]);

    const error = events.find((e) => e.type === 'error');
    expect(error).toMatchObject({ type: 'error', retryable: false });
    expect((error as { message: string }).message).toContain('пределе шагов');
    expect(events.at(-1)).toMatchObject({ type: 'done', reason: 'error' });
  });

  it('неназванная причина остановки сама по себе не превращается в ошибку', async () => {
    // 'other' — значение ПО УМОЛЧАНИЮ у openai-compatible: сервер, который не шлёт finish_reason,
    // отдаёт его на каждом исправном ходе, и ветка отказа здесь была бы ложной тревогой после
    // каждого ответа. Обрыв при 'other' ловится не причиной, а признаками незавершённости —
    // незакрытым вызовом и пустым концом хода, оба ниже.
    const events = await play([
      { type: 'text-delta', id: 't0', text: 'готово' },
      { type: 'finish', finishReason: 'other' },
    ]);
    expect(events.at(-1)).toMatchObject({ type: 'done', reason: 'complete' });
    expect(events.find((e) => e.type === 'error')).toBeUndefined();
  });

  it('ошибка генерации у провайдера — не успешный ход', async () => {
    const events = await play([{ type: 'finish', finishReason: 'error' }]);

    const error = events.find((e) => e.type === 'error');
    expect(error).toMatchObject({ type: 'error', retryable: false });
    expect(events.at(-1)).toMatchObject({ type: 'done', reason: 'error' });
  });

  it('причина остановки доходит до цикла — и унифицированная, и сырая', async () => {
    // Диагностика: без неё тихий обрыв нечем отличить от законченной работы даже в консоли.
    const events = await play([
      { type: 'text-delta', id: 't0', text: 'готово' },
      { type: 'finish', finishReason: 'stop', rawFinishReason: 'end_turn' },
    ]);

    expect(events.at(-1)).toMatchObject({
      type: 'done',
      reason: 'complete',
      stop: { reason: 'stop', raw: 'end_turn' },
    });
  });

  describe('вызов, оборванный посреди аргументов', () => {
    // Аргументы инструмента приходят потоком. Обрыв на середине не даёт ни `tool-call`, ни
    // `tool-result` — то есть от попытки не остаётся ВООБЩЕ ничего, и ход выглядит так, будто
    // модель ничего и не собиралась делать. Ровно этот исход и наблюдался вживую.
    const CUT = [
      { type: 'tool-input-start', id: 'c1', toolName: 'insert_node' },
      { type: 'tool-input-delta', id: 'c1', delta: '{"parent":"/root","nodes":[{"comp' },
      { type: 'finish', finishReason: 'other' },
    ];

    it('становится ошибкой, а не успешным ходом', async () => {
      const events = await play(CUT);

      const error = events.find((e) => e.type === 'error') as { message: string } | undefined;
      expect(error?.message).toContain('insert_node');
      expect(events.at(-1)).toMatchObject({
        type: 'done',
        reason: 'error',
        stop: { truncatedCall: 'insert_node' },
      });
    });

    it('дописанный вызов ошибкой не считается', async () => {
      const events = await play([
        { type: 'tool-input-start', id: 'c1', toolName: 'insert_node' },
        { type: 'tool-input-delta', id: 'c1', delta: '{}' },
        { type: 'tool-input-end', id: 'c1' },
        { type: 'tool-call', toolCallId: 'c1', toolName: 'insert_node', input: {} },
        { type: 'finish', finishReason: 'stop' },
      ]);

      expect(events.at(-1)).toMatchObject({ type: 'done', reason: 'complete' });
      expect(events.find((e) => e.type === 'error')).toBeUndefined();
    });

    it('готовый tool-call закрывает вызов и без tool-input-end', async () => {
      // `tool-input-end` шлют не все провайдеры; полагаться только на него значило бы объявлять
      // обрывом каждый исправный вызов у такого канала.
      const events = await play([
        { type: 'tool-input-start', id: 'c1', toolName: 'insert_node' },
        { type: 'tool-call', toolCallId: 'c1', toolName: 'insert_node', input: {} },
        { type: 'finish', finishReason: 'stop' },
      ]);

      expect(events.at(-1)).toMatchObject({ type: 'done', reason: 'complete' });
    });
  });

  describe('ход, кончившийся пустотой', () => {
    // Наблюдавшийся исход целиком: модель уходит в рассуждение, обрывается на полуслове и
    // закрывает поток. Причины локальный сервер не присылает, и до этой ветки такой ход доходил
    // до панели штатно завершённым — то есть как «модель решила ничего не делать».
    it('одно рассуждение без ответа и без вызова — обрыв, а не успех', async () => {
      const events = await play([
        { type: 'start-step' },
        { type: 'reasoning-delta', id: 'r0', text: 'Let me insert these into' },
        { type: 'finish', finishReason: 'other' },
      ]);

      const error = events.find((e) => e.type === 'error') as { message: string } | undefined;
      expect(error?.message).toContain('не вызвав ни одного инструмента');
      expect(events.at(-1)).toMatchObject({
        type: 'done',
        reason: 'error',
        stop: { emptyFinish: true },
      });
    });

    it('ответ текстом пустотой не считается', async () => {
      const events = await play([
        { type: 'start-step' },
        { type: 'reasoning-delta', id: 'r0', text: 'думаю' },
        { type: 'text-delta', id: 't0', text: 'В форме три поля.' },
        { type: 'finish', finishReason: 'stop' },
      ]);

      expect(events.at(-1)).toMatchObject({ type: 'done', reason: 'complete' });
      expect(events.find((e) => e.type === 'error')).toBeUndefined();
    });

    it('шаг с вызовом инструмента пустотой не считается', async () => {
      const events = await play([
        { type: 'start-step' },
        { type: 'tool-call', toolCallId: 'c1', toolName: 'insert_node', input: {} },
        { type: 'finish', finishReason: 'stop' },
      ]);

      expect(events.at(-1)).toMatchObject({ type: 'done', reason: 'complete' });
    });

    it('пустым считается ПОСЛЕДНИЙ шаг, а не весь ход', async () => {
      // Ход мог сделать пять правок и замолчать на шестом шаге — это всё равно обрыв, и
      // сделанное при этом остаётся применимым.
      const events = await play([
        { type: 'start-step' },
        { type: 'tool-call', toolCallId: 'c1', toolName: 'insert_node', input: {} },
        { type: 'start-step' },
        { type: 'reasoning-delta', id: 'r1', text: 'дальше надо' },
        { type: 'finish', finishReason: 'other' },
      ]);

      expect(events.at(-1)).toMatchObject({
        type: 'done',
        reason: 'error',
        stop: { emptyFinish: true },
      });
    });
  });

  it('поток, кончившийся без finish, не выдаётся за завершённый ход', async () => {
    // Страховка: штатно `finish` есть всегда, но без этой ветки генератор просто заканчивался бы
    // молча, и ход с недоделанной формой считался бы успешным.
    const events = await play([{ type: 'text-delta', id: 't0', text: 'начал' }]);

    expect(events.find((e) => e.type === 'error')).toBeDefined();
    expect(events.at(-1)).toMatchObject({ type: 'done', reason: 'error' });
  });

  it('прерывание доходит как отмена', async () => {
    const events = await play([{ type: 'abort' }]);
    expect(events).toMatchObject([{ type: 'done', reason: 'aborted' }]);
  });
});

describe('расход шага', () => {
  it('конец шага доходит событием с разложением по кэшу', async () => {
    const events = await play([
      {
        type: 'finish-step',
        usage: {
          inputTokens: 3120,
          inputTokenDetails: { cacheReadTokens: 2800, cacheWriteTokens: 0 },
          outputTokens: 64,
        },
      },
      { type: 'finish', finishReason: 'stop' },
    ]);

    expect(events[0]).toEqual({
      type: 'step_usage',
      usage: {
        inputTokens: 3120,
        cachedInputTokens: 2800,
        cacheWriteTokens: 0,
        outputTokens: 64,
      },
    });
  });

  it('промолчавший провайдер отличается от нулевого расхода', async () => {
    // Ollama сообщает вход, но ничего не знает про кэш. Подставить туда 0 значило бы утверждать,
    // что кэш не сработал, — а он там попросту не существует как понятие.
    const events = await play([
      {
        type: 'finish-step',
        usage: { inputTokens: 900, inputTokenDetails: {}, outputTokens: undefined },
      },
      { type: 'finish', finishReason: 'stop' },
    ]);

    expect(events[0]).toEqual({ type: 'step_usage', usage: { inputTokens: 900 } });
  });
});

describe('чем зовём модель', () => {
  // Минимальный ЗАКОНЧЕННЫЙ ход: модель что-то ответила и остановилась. Текст здесь не украшение —
  // ход, не сказавший ни слова и не позвавший инструмента, считается оборванным, и без ответа эти
  // проверки ловили бы обрыв вместо того, что проверяют.
  const finish = [
    { type: 'text-delta', id: 't0', text: 'готово' },
    { type: 'finish', finishReason: 'stop' },
  ];

  it('канал с кэшем помечает префикс, а не просто шлёт строку', async () => {
    // Пометка стоит на системном сообщении, но накрывает и определения инструментов: Anthropic
    // складывает префикс как «инструменты → системный промпт → диалог».
    await play(finish, { cacheBreakpoints: true, pruneContext: false, maxRetries: 2 });
    expect(lastCall().instructions).toEqual({
      role: 'system',
      content: 's',
      providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
    });
  });

  it('канал без кэша получает промпт строкой — лишних полей в запросе не появляется', async () => {
    await play(finish, { cacheBreakpoints: false, pruneContext: false, maxRetries: 2 });
    expect(lastCall().instructions).toBe('s');
    expect(lastCall().providerOptions).toBeUndefined();
  });

  it('ключ кэша OpenAI уходит своим namespace', async () => {
    await play(finish, {
      cacheBreakpoints: false,
      promptCacheKey: 'rb-abc',
      pruneContext: false,
      maxRetries: 2,
    });
    expect(lastCall().providerOptions).toEqual({ openai: { promptCacheKey: 'rb-abc' } });
  });

  it('пределы и таймауты выставлены всегда', async () => {
    await play(finish);
    // temperature 0 — не вкусовщина: выдуманное имя компонента стоит отказа гейта, то есть шага.
    expect(lastCall().temperature).toBe(0);
    // Таймаут на первый фрагмент не ставится: у крупной локальной модели разбор промпта честно
    // занимает минуты, и такой таймаут убивал бы живые запросы.
    expect(lastCall().timeout).toMatchObject({ chunkMs: expect.any(Number) });
    expect((lastCall().timeout as Record<string, unknown>).firstChunkMs).toBeUndefined();
  });

  it('потолок ответа не задаётся, пока его не задал пользователь', async () => {
    // Зашитое число обрывало ответ think-модели на полуслове: рассуждение съедало вывод целиком.
    await play(finish);
    expect(lastCall().maxOutputTokens).toBeUndefined();
  });

  it('заданный потолок доходит до модели', async () => {
    await play(finish, {
      cacheBreakpoints: false,
      pruneContext: false,
      maxRetries: 2,
      maxOutputTokens: 4096,
    });
    expect(lastCall().maxOutputTokens).toBe(4096);
  });

  it('предел повторов берётся из настроек канала', async () => {
    await play(finish, { cacheBreakpoints: false, pruneContext: false, maxRetries: 1 });
    expect(lastCall().maxRetries).toBe(1);
  });

  it('таймаут объясняется словами, а не сырым AbortError', async () => {
    // Таймаут SDK прерывает запрос своим контроллером, и наш `signal.aborted` при этом ложь.
    // Без разбора этого случая пользователь видел «The operation was aborted» — то есть отказ
    // выглядел как нажатая им самим кнопка «Остановить».
    const events = await play([Object.assign(new Error('aborted'), { name: 'AbortError' })]);
    const error = events.find((e) => e.type === 'error') as { message: string; retryable: boolean };
    expect(error.message).toContain('таймауту');
    // Повтор здесь осмыслен, в отличие от обрыва по пределу длины.
    expect(error.retryable).toBe(true);
    expect(events.at(-1)).toMatchObject({ type: 'done', reason: 'error' });
  });

  it('без предела шагов ход не останавливают ни на каком шаге', async () => {
    // `stopWhen` обязан быть задан ЯВНО: без него SDK подставляет stepCountIs(1), и ход закончился
    // бы после первого же вызова инструмента, не дойдя до правок.
    const events = await play(finish, undefined, REQUEST, 999);
    const stop = lastCall().stopWhen as (o: unknown) => boolean;
    expect(stop({})).toBe(false);
    // Никакого «израсходовал шаги»: их некуда расходовать.
    expect(events.at(-1)).toMatchObject({ type: 'done', reason: 'complete' });
  });

  it('заданный предел запрещает инструменты на последнем шаге', async () => {
    // Вызов с последнего шага всё равно не исполнится — шаги кончились.
    await play(finish, undefined, { ...REQUEST, maxSteps: 4 }, 3);
    const prepare = lastCall().prepareStep as (o: { stepNumber: number }) => unknown;
    expect(prepare({ stepNumber: 3 })).toEqual({ toolChoice: 'none' });
    expect(prepare({ stepNumber: 0 })).toBeUndefined();
  });

  describe('потолок стоимости хода', () => {
    /** Условие остановки по бюджету — второе в списке, после предела шагов. */
    const guardOf = () => {
      const stop = lastCall().stopWhen as Array<(o: { steps: unknown[] }) => boolean>;
      return stop[stop.length - 1];
    };
    const steps = (...inputTokens: number[]) => ({
      steps: inputTokens.map((t) => ({ usage: { inputTokens: t } })),
    });

    it('без бюджета условия остановки вообще нет', async () => {
      await play(finish);
      expect(typeof lastCall().stopWhen).toBe('function');
    });

    it('ход идёт, пока израсходовано меньше бюджета', async () => {
      await play(finish, undefined, { ...REQUEST, maxInputTokens: 10_000 });
      expect(guardOf()(steps(3000, 3000))).toBe(false);
    });

    it('превышение бюджета останавливает ход', async () => {
      await play(finish, undefined, { ...REQUEST, maxInputTokens: 10_000 });
      // Считается сумма по всем шагам: цена шага растёт вместе с диалогом, и мера стоимости —
      // именно накопленный вход, а не последний запрос.
      expect(guardOf()(steps(4000, 4000, 4000))).toBe(true);
    });

    it('шаги без сообщённого расхода бюджет не жгут', async () => {
      // Локальные серверы часто молчат про usage; считать их шаги «бесконечно дорогими» нельзя.
      await play(finish, undefined, { ...REQUEST, maxInputTokens: 10_000 });
      expect(guardOf()({ steps: [{ usage: {} }, { usage: {} }] })).toBe(false);
    });

    it('остановка по бюджету объясняется своей причиной, а не пределом шагов', async () => {
      // Для провайдера она выглядит обычным завершением, и без отдельного сообщения ход снова
      // выдавал бы половину формы за результат — причём чинить его пошли бы не туда.
      stream.steps = [{ usage: { inputTokens: 20_000 } }];
      const events = await play(finish, undefined, { ...REQUEST, maxInputTokens: 10_000 });
      stream.steps = [];

      const error = events.find((e) => e.type === 'error') as { message: string } | undefined;
      expect(error?.message).toContain('бюджет входных токенов');
      expect(events.at(-1)).toMatchObject({ type: 'done', reason: 'error' });
    });

    it('ход в рамках бюджета заканчивается штатно', async () => {
      stream.steps = [{ usage: { inputTokens: 1000 } }];
      const events = await play(finish, undefined, { ...REQUEST, maxInputTokens: 10_000 });
      stream.steps = [];

      expect(events.at(-1)).toMatchObject({ type: 'done', reason: 'complete' });
    });
  });

  it('упор в заданный предел не выдаётся за законченную работу', async () => {
    // Запрет инструментов делает последний шаг «тихим»: модель отвечает текстом, провайдер
    // сообщает штатный stop — и половина формы выглядела бы результатом. Ровно так ход и
    // останавливался молча, пока об упоре не начали сообщать отдельно.
    const events = await play(finish, undefined, { ...REQUEST, maxSteps: 4 }, 3);
    const error = events.find((e) => e.type === 'error') as { message: string } | undefined;
    expect(error?.message).toContain('израсходовал все шаги');
    expect(events.at(-1)).toMatchObject({ type: 'done', reason: 'error' });
  });
});
