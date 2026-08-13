import { beforeEach, describe, expect, it } from 'vitest';
import { emptySchema } from '../model';
import { agentSessionActions, agentSessionStore } from './session';
import { createChangeSet, withOutcome } from './core/changeset';
import { createEditorToolRegistry } from './core';

const reg = createEditorToolRegistry();
const state = () => agentSessionStore.getState();

/** Набор изменений с одной операцией. */
function oneChange() {
  const base = emptySchema();
  return withOutcome(
    createChangeSet(base),
    reg.invoke(
      'insert_node',
      { component: 'Input', parent: '/root', model: 'x', props: { label: 'Поле' } },
      { draft: base, base }
    )
  );
}

beforeEach(() => {
  agentSessionActions.reset();
});

describe('панель', () => {
  it('видимость в сторе сессии не хранится — ею владеет раскладка оболочки', () => {
    // Второй флаг видимости неизбежно разошёлся бы с `ui.rightPanel`; тест закрепляет его отсутствие.
    expect('open' in state()).toBe(false);
  });

  it('настройки канала переключаются отдельно от ленты', () => {
    expect(state().settingsOpen).toBe(false);
    agentSessionActions.toggleSettings();
    expect(state().settingsOpen).toBe(true);
    agentSessionActions.setSettings(false);
    expect(state().settingsOpen).toBe(false);
  });

  it('«Новый разговор» чистит ленту и возвращает панель в исходное состояние', () => {
    agentSessionActions.startTurn('привет');
    agentSessionActions.toggleSettings();
    agentSessionActions.reset();
    expect(state().entries).toHaveLength(0);
    expect(state().settingsOpen).toBe(false);
    expect(state().status).toBe('idle');
  });
});

describe('ход', () => {
  it('заводит реплику пользователя и пустую реплику ассистента', () => {
    agentSessionActions.startTurn('добавь email');
    expect(state().status).toBe('running');
    expect(state().entries.map((e) => [e.role, e.text])).toEqual([
      ['user', 'добавь email'],
      ['assistant', ''],
    ]);
  });

  it('текст и вызовы инструментов копятся в последней реплике ассистента', () => {
    agentSessionActions.startTurn('добавь email');
    agentSessionActions.appendText('Добавляю');
    agentSessionActions.appendText(' поле.');
    agentSessionActions.logTool({ name: 'insert_node', ok: true, summary: 'Email (Input)' });
    const last = state().entries.at(-1)!;
    expect(last.text).toBe('Добавляю поле.');
    expect(last.tools).toEqual([{ name: 'insert_node', ok: true, summary: 'Email (Input)' }]);
  });

  it('рассуждение копится отдельно от ответа', () => {
    // Разные поля потому, что в модель обратно уходит только `text`: черновик мысли не должен
    // ни попадать в контекст следующего хода, ни выглядеть в ленте как ответ.
    agentSessionActions.startTurn('добавь email');
    agentSessionActions.appendReasoning('Смотрю схему');
    agentSessionActions.appendReasoning(' формы.');
    agentSessionActions.appendText('Добавил.');
    const last = state().entries.at(-1)!;
    expect(last.reasoning).toBe('Смотрю схему формы.');
    expect(last.text).toBe('Добавил.');
  });

  it('изменения уводят панель в режим решения', () => {
    agentSessionActions.startTurn('добавь');
    agentSessionActions.finishTurn(oneChange());
    expect(state().status).toBe('review');
    expect(state().pending?.ops).toHaveLength(1);
  });

  it('ход без изменений возвращает панель в покой', () => {
    agentSessionActions.startTurn('что тут есть?');
    agentSessionActions.finishTurn(null);
    expect(state().status).toBe('idle');
    expect(state().pending).toBeNull();
  });

  it('ошибка показывается и не выдаёт себя за успех', () => {
    agentSessionActions.startTurn('сломай');
    agentSessionActions.finishTurn(null, 'соединение разорвано');
    expect(state().status).toBe('error');
    expect(state().error).toBe('соединение разорвано');
  });

  it('новый ход снимает прошлую ошибку и конфликт', () => {
    agentSessionActions.startTurn('раз');
    agentSessionActions.finishTurn(null, 'ошибка');
    agentSessionActions.setConflict(true);
    agentSessionActions.startTurn('два');
    expect(state().error).toBeNull();
    expect(state().conflict).toBe(false);
  });

  it('решение по набору возвращает панель в покой', () => {
    agentSessionActions.startTurn('добавь');
    agentSessionActions.finishTurn(oneChange());
    agentSessionActions.resolvePending();
    expect(state().pending).toBeNull();
    expect(state().status).toBe('idle');
  });
});
