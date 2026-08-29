/**
 * Хранилище сессии: снимок, лента и точка восстановления.
 *
 * @module plugins/ai/session.test
 */

import { describe, expect, it, vi } from 'vitest';
import { emptyRules } from '@/lib/form-model/rules';
import { createAiSession, type TurnSnapshot } from './session';

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
