/**
 * Тесты отказа открытия проекта глазами человека: сообщение и кнопка.
 *
 * @module shell/boot/project/project-failure.test
 */

import { describe, expect, it, vi } from 'vitest';

import { projectFailureAction, projectFailureMessageKey } from './project-failure';

function actions() {
  return { reopen: vi.fn(), forget: vi.fn() };
}

describe('сообщение', () => {
  it('отмена выбора каталога молчит: человек просто передумал', () => {
    expect(projectFailureMessageKey({ kind: 'cancelled' })).toBeNull();
  });

  it('причина недоступности выбирает сообщение', () => {
    expect(projectFailureMessageKey({ kind: 'unavailable', reason: 'denied' })).toBe(
      'files.notify.unavailable.denied'
    );
    expect(projectFailureMessageKey({ kind: 'unavailable', reason: 'missing' })).toBe(
      'files.notify.unavailable.missing'
    );
    expect(projectFailureMessageKey({ kind: 'unavailable' })).toBe('files.notify.unavailable');
  });

  it('у неподдержки и сбоя — свои сообщения', () => {
    expect(projectFailureMessageKey({ kind: 'unsupported' })).toBe('files.notify.unsupported');
    expect(projectFailureMessageKey({ kind: 'failed', error: new Error('отказ') })).toBe(
      'files.notify.failed'
    );
  });
});

describe('кнопка', () => {
  it('«доступ не дан» — «Разрешить доступ» переоткрывает ИМЕННО эту область', () => {
    const a = actions();

    const action = projectFailureAction(
      { kind: 'unavailable', reason: 'denied', workspaceId: 'w1' },
      a
    );
    action?.run();

    expect(action?.titleKey).toBe('files.notify.action.grant');
    expect(a.reopen).toHaveBeenCalledWith('w1');
    expect(a.forget).not.toHaveBeenCalled();
  });

  it('«каталога нет» — «Убрать из недавних»: поднимать нечего, остаётся не предлагать', () => {
    const a = actions();

    const action = projectFailureAction(
      { kind: 'unavailable', reason: 'missing', workspaceId: 'w1' },
      a
    );
    action?.run();

    expect(action?.titleKey).toBe('files.notify.action.forget');
    expect(a.forget).toHaveBeenCalledWith('w1');
    expect(a.reopen).not.toHaveBeenCalled();
  });

  it('без области кнопки нет: у выбора каталога записи ещё нет', () => {
    expect(projectFailureAction({ kind: 'unavailable', reason: 'denied' }, actions())).toBe(
      undefined
    );
  });

  it('у сбоя и неподдержки кнопки нет — предложить нечего', () => {
    expect(projectFailureAction({ kind: 'failed', workspaceId: 'w1' }, actions())).toBe(undefined);
    expect(projectFailureAction({ kind: 'unsupported' }, actions())).toBe(undefined);
  });
});
