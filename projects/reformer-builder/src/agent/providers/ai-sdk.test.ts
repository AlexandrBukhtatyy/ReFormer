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

    expect(events).toEqual([
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
    expect(events.at(-1)).toEqual({ type: 'done', reason: 'error' });
  });

  it('фильтр содержимого тоже не выдаётся за успех', async () => {
    const events = await play([{ type: 'finish', finishReason: 'content-filter' }]);
    expect(events.at(-1)).toEqual({ type: 'done', reason: 'error' });
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
    expect(events.at(-1)).toEqual({ type: 'done', reason: 'error' });
  });

  it('неизвестная причина остановки не превращается в ошибку', async () => {
    // Локальные серверы часто не сообщают причину; считать это отказом — ложная тревога.
    const events = await play([{ type: 'finish', finishReason: 'unknown' }]);
    expect(events).toEqual([{ type: 'done', reason: 'complete' }]);
  });

  it('прерывание доходит как отмена', async () => {
    const events = await play([{ type: 'abort' }]);
    expect(events).toEqual([{ type: 'done', reason: 'aborted' }]);
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
  const finish = [{ type: 'finish', finishReason: 'stop' }];

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
    expect(events.at(-1)).toEqual({ type: 'done', reason: 'error' });
  });

  it('без предела шагов ход не останавливают ни на каком шаге', async () => {
    // `stopWhen` обязан быть задан ЯВНО: без него SDK подставляет stepCountIs(1), и ход закончился
    // бы после первого же вызова инструмента, не дойдя до правок.
    const events = await play(finish, undefined, REQUEST, 999);
    const stop = lastCall().stopWhen as (o: unknown) => boolean;
    expect(stop({})).toBe(false);
    // Никакого «израсходовал шаги»: их некуда расходовать.
    expect(events).toEqual([{ type: 'done', reason: 'complete' }]);
  });

  it('заданный предел запрещает инструменты на последнем шаге', async () => {
    // Вызов с последнего шага всё равно не исполнится — шаги кончились.
    await play(finish, undefined, { ...REQUEST, maxSteps: 4 }, 3);
    const prepare = lastCall().prepareStep as (o: { stepNumber: number }) => unknown;
    expect(prepare({ stepNumber: 3 })).toEqual({ toolChoice: 'none' });
    expect(prepare({ stepNumber: 0 })).toBeUndefined();
  });

  it('упор в заданный предел не выдаётся за законченную работу', async () => {
    // Запрет инструментов делает последний шаг «тихим»: модель отвечает текстом, провайдер
    // сообщает штатный stop — и половина формы выглядела бы результатом. Ровно так ход и
    // останавливался молча, пока об упоре не начали сообщать отдельно.
    const events = await play(finish, undefined, { ...REQUEST, maxSteps: 4 }, 3);
    const error = events.find((e) => e.type === 'error') as { message: string } | undefined;
    expect(error?.message).toContain('израсходовал все шаги');
    expect(events.at(-1)).toEqual({ type: 'done', reason: 'error' });
  });
});
