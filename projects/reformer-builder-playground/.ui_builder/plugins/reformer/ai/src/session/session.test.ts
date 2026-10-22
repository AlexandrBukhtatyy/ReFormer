/**
 * Хранилище сессии: снимок, лента и точка восстановления.
 *
 * @module plugins/reformer/ai/session/session.test
 */

import { describe, expect, it, vi } from 'vitest';
import { emptyRules } from '../../../core/form-model';
import { ATTACHMENT_LIMIT, createAiSession, type TurnSnapshot, openAskOf } from './session';

const SNAPSHOT: TurnSnapshot = { resource: 'form.json', text: '{}', rules: emptyRules() };

describe('снимок состояния', () => {
  it('ссылка стабильна, пока ничего не менялось', () => {
    const session = createAiSession();
    expect(session.get()).toBe(session.get());
  });

  it('изменение уведомляет подписчиков и меняет ссылку', () => {
    const session = createAiSession();
    const before = session.get();
    const listener = vi.fn();
    session.subscribe(listener);
    session.startTurn('привет');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(session.get()).not.toBe(before);
  });

  it('отписка снимает уведомления', () => {
    const session = createAiSession();
    const listener = vi.fn();
    session.subscribe(listener).dispose();
    session.startTurn('привет');
    expect(listener).not.toHaveBeenCalled();
  });

  it('упавший подписчик не отменяет состоявшегося изменения', () => {
    const session = createAiSession();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    session.subscribe(() => {
      throw new Error('подписчик сломан');
    });
    const good = vi.fn();
    session.subscribe(good);
    session.startTurn('привет');
    expect(good).toHaveBeenCalled();
    expect(session.get().entries).toHaveLength(2);
    spy.mockRestore();
  });
});

describe('ход', () => {
  it('начало хода добавляет реплику пользователя и заготовку ассистента', () => {
    const session = createAiSession();
    session.startTurn('сделай форму', SNAPSHOT);
    const { entries, status } = session.get();
    expect(status).toBe('running');
    expect(entries.map((e) => e.role)).toEqual(['user', 'assistant']);
    expect(entries[0].snapshot).toEqual(SNAPSHOT);
    expect(entries[1].text).toBe('');
  });

  it('текст, рассуждение и журнал дописываются в реплику ассистента', () => {
    const session = createAiSession();
    session.startTurn('сделай форму');
    session.appendReasoning('думаю');
    session.appendText('гото');
    session.appendText('во');
    session.logTool({ name: 'insert_node', ok: true, summary: 'Добавлено поле' });
    const last = session.get().entries.at(-1);
    expect(last?.text).toBe('готово');
    expect(last?.reasoning).toBe('думаю');
    expect(last?.tools).toHaveLength(1);
  });

  it('без хода дописывать некуда — реплика пользователя не растёт', () => {
    const session = createAiSession();
    session.appendText('мимо');
    expect(session.get().entries).toEqual([]);
  });

  it('ход без набора закрывается в покой, с набором — в ожидание решения', () => {
    const session = createAiSession();
    session.startTurn('a');
    session.finishTurn(null);
    expect(session.get().status).toBe('idle');

    session.startTurn('b');
    session.finishTurn({
      set: {
        base: {},
        baseRules: emptyRules(),
        draft: {},
        draftRules: emptyRules(),
        ops: [],
      } as never,
      resource: 'form.json',
      baseText: '{}',
    });
    expect(session.get().status).toBe('review');
  });

  it('замечание переводит ход в ошибку', () => {
    const session = createAiSession();
    session.startTurn('a');
    session.finishTurn(null, 'всё сломалось');
    expect(session.get().status).toBe('error');
    expect(session.get().error).toBe('всё сломалось');
  });
});

describe('восстановление', () => {
  it('отдаёт снимок и обрезает переписку вместе с ним', () => {
    const session = createAiSession();
    session.startTurn('первый', SNAPSHOT);
    session.finishTurn(null);
    const id = session.get().entries[0].id;
    session.startTurn('второй', SNAPSHOT);
    session.finishTurn(null);

    expect(session.restoreTo(id)).toEqual(SNAPSHOT);
    // Реплики ниже описывают правки, которых больше нет: держать их в ленте нельзя.
    expect(session.get().entries).toEqual([]);
  });

  it('незнакомая реплика ничего не меняет', () => {
    const session = createAiSession();
    session.startTurn('первый', SNAPSHOT);
    expect(session.restoreTo('нет-такой')).toBeNull();
    expect(session.get().entries).toHaveLength(2);
  });

  it('очистка диалога не закрывает открытые настройки', () => {
    const session = createAiSession();
    session.setSettingsOpen(true);
    session.startTurn('a');
    session.reset();
    expect(session.get().entries).toEqual([]);
    expect(session.get().settingsOpen).toBe(true);
  });
});

describe('вложения', () => {
  it('прикрепляются к следующей реплике и уходят с ней, освобождая поле', () => {
    const session = createAiSession();
    expect(session.attach({ uri: 'source:a.md', name: 'a.md' })).toBe('attached');
    expect(session.get().attachments).toEqual([{ uri: 'source:a.md', name: 'a.md' }]);

    session.startTurn('посмотри', undefined, session.get().attachments);

    expect(session.get().attachments).toEqual([]);
    expect(session.get().entries[0].attachments).toEqual([{ uri: 'source:a.md', name: 'a.md' }]);
  });

  it('тот же адрес второй раз не прикрепляется, сверх предела — тоже', () => {
    const session = createAiSession();
    session.attach({ uri: 'source:a.md', name: 'a.md' });
    expect(session.attach({ uri: 'source:a.md', name: 'a.md' })).toBe('duplicate');
    for (let i = 1; i < ATTACHMENT_LIMIT; i += 1) {
      session.attach({ uri: `source:${String(i)}.md`, name: `${String(i)}.md` });
    }
    expect(session.attach({ uri: 'source:extra.md', name: 'extra.md' })).toBe('limit');
    expect(session.get().attachments).toHaveLength(ATTACHMENT_LIMIT);
  });

  it('открепление снимает ровно один адрес', () => {
    const session = createAiSession();
    session.attach({ uri: 'source:a.md', name: 'a.md' });
    session.attach({ uri: 'source:b.md', name: 'b.md' });
    session.detach('source:a.md');
    expect(session.get().attachments.map((ref) => ref.uri)).toEqual(['source:b.md']);
  });
});

describe('блоки ответа и рассуждения', () => {
  it('блоки разных шагов разделены пустой строкой, куски одного блока — склеены', () => {
    const session = createAiSession();
    session.startTurn('вопрос');
    session.appendReasoning('Смотрю ', true);
    session.appendReasoning('форму.');
    session.appendReasoning('Поле уже есть.', true);
    expect(session.get().entries.at(-1)?.reasoning).toBe('Смотрю форму.\n\nПоле уже есть.');
  });

  it('ведущие переводы строки блока отбрасываются, разрыв ждёт первого текста', () => {
    const session = createAiSession();
    session.startTurn('вопрос');
    session.appendReasoning('\n', true);
    session.appendReasoning('\nДумаю.');
    session.appendReasoning('\n\n', true);
    session.appendReasoning('Дальше.');
    expect(session.get().entries.at(-1)?.reasoning).toBe('Думаю.\n\nДальше.');
  });

  it('уже стоящий перевод строки не удваивает разрыв', () => {
    const session = createAiSession();
    session.startTurn('вопрос');
    session.appendText('Сначала так.\n', true);
    session.appendText('Потом так.', true);
    expect(session.get().entries.at(-1)?.text).toBe('Сначала так.\n\nПотом так.');
  });

  it('новый ход начинается без разрыва, даже если прошлый блок остался открытым', () => {
    const session = createAiSession();
    session.startTurn('раз');
    session.appendText('\n', true);
    session.startTurn('два');
    session.appendText('Ответ.');
    expect(session.get().entries.at(-1)?.text).toBe('Ответ.');
  });
});

describe('карточки вопросов', () => {
  const question = {
    question: 'Обязательное?',
    options: [{ label: 'Да' }, { label: 'Нет' }],
    multiSelect: false,
  };

  it('карточка ждёт ответа, пока идёт ход, и принимает его один раз', () => {
    const session = createAiSession();
    session.startTurn('вопрос');
    session.askQuestions({ id: 'ask1', questions: [question] });
    expect(openAskOf(session.get())?.id).toBe('ask1');

    expect(session.answerAsk('ask1', [{ selected: ['Да'] }])).toBe(true);
    expect(session.answerAsk('ask1', [{ selected: ['Нет'] }])).toBe(false);
    expect(openAskOf(session.get())).toBeNull();
    expect(session.get().entries.at(-1)?.asks?.[0].answers).toEqual([{ selected: ['Да'] }]);
  });

  it('снятые карточки не ждут ответа, а отвеченные остаются отвеченными', () => {
    const session = createAiSession();
    session.startTurn('вопрос');
    session.askQuestions({ id: 'ask1', questions: [question] });
    session.answerAsk('ask1', [{ selected: ['Да'] }]);
    session.askQuestions({ id: 'ask2', questions: [question] });
    session.cancelAsks();

    const asks = session.get().entries.at(-1)?.asks ?? [];
    expect(asks.map((card) => card.cancelled === true)).toEqual([false, true]);
    expect(openAskOf(session.get())).toBeNull();
  });

  it('после конца хода карточка ответа не ждёт', () => {
    const session = createAiSession();
    session.startTurn('вопрос');
    session.askQuestions({ id: 'ask1', questions: [question] });
    session.finishTurn(null);
    expect(openAskOf(session.get())).toBeNull();
  });
});
