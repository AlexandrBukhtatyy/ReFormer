/**
 * Unit-тесты машины состояний загрузки AsyncBoundary.
 *
 * Проверяют переходы, из-за отсутствия которых рукописные `useEffect`-загрузчики
 * ведут себя плохо: подмена контента спиннером при каждом обновлении, потеря уже
 * загруженных данных при ошибке и «вечный спиннер» после отмены запроса.
 */
import { describe, it, expect } from 'vitest';
import { asyncResourceReducer, defaultToError, initialAsyncResourceState } from './async-resource';

type User = { name: string };

const initial = () => initialAsyncResourceState<User, string>();
const USER: User = { name: 'Иванов' };

describe('asyncResourceReducer', () => {
  it('стартует из idle — загрузка ещё не запускалась', () => {
    expect(initial()).toEqual({
      status: 'idle',
      data: undefined,
      error: null,
      refreshing: false,
    });
  });

  it('первая загрузка переводит в loading', () => {
    const s = asyncResourceReducer(initial(), { kind: 'load-start' });
    expect(s.status).toBe('loading');
    expect(s.refreshing).toBe(false);
  });

  it('успех переводит в ready и кладёт данные', () => {
    const s = asyncResourceReducer(initial(), { kind: 'load-success', data: USER });
    expect(s).toEqual({ status: 'ready', data: USER, error: null, refreshing: false });
  });

  it('повторная загрузка поверх данных не роняет экран в loading', () => {
    const ready = asyncResourceReducer(initial(), { kind: 'load-success', data: USER });
    const again = asyncResourceReducer(ready, { kind: 'load-start' });
    expect(again.status).toBe('ready');
    expect(again.refreshing).toBe(true);
    expect(again.data).toBe(USER);
  });

  it('load-start сбрасывает прошлую ошибку', () => {
    const failed = asyncResourceReducer(initial(), { kind: 'load-error', error: 'упало' });
    const retrying = asyncResourceReducer(failed, { kind: 'load-start' });
    expect(retrying.error).toBeNull();
  });

  it('ошибка не стирает ранее загруженные данные', () => {
    const ready = asyncResourceReducer(initial(), { kind: 'load-success', data: USER });
    const failed = asyncResourceReducer(ready, { kind: 'load-error', error: 'timeout' });
    expect(failed.status).toBe('error');
    expect(failed.error).toBe('timeout');
    expect(failed.data).toBe(USER);
  });

  it('skip возвращает в idle и очищает данные', () => {
    const ready = asyncResourceReducer(initial(), { kind: 'load-success', data: USER });
    expect(asyncResourceReducer(ready, { kind: 'skip' })).toEqual({
      status: 'idle',
      data: undefined,
      error: null,
      refreshing: false,
    });
  });

  it('отмена без данных возвращает в idle, а не оставляет спиннер', () => {
    const loading = asyncResourceReducer(initial(), { kind: 'load-start' });
    const aborted = asyncResourceReducer(loading, { kind: 'abort' });
    expect(aborted.status).toBe('idle');
    expect(aborted.error).toBeNull();
  });

  it('отмена поверх данных возвращает к ним, а не к ошибке', () => {
    const ready = asyncResourceReducer(initial(), { kind: 'load-success', data: USER });
    const refreshing = asyncResourceReducer(ready, { kind: 'load-start' });
    const aborted = asyncResourceReducer(refreshing, { kind: 'abort' });
    expect(aborted.status).toBe('ready');
    expect(aborted.data).toBe(USER);
    expect(aborted.refreshing).toBe(false);
    expect(aborted.error).toBeNull();
  });
});

describe('defaultToError', () => {
  it('берёт message у Error', () => {
    expect(defaultToError(new Error('Ошибка загрузки заявки'))).toBe('Ошибка загрузки заявки');
  });

  it('пропускает непустую строку как есть', () => {
    expect(defaultToError('boom')).toBe('boom');
  });

  it('на всё остальное даёт понятный fallback', () => {
    expect(defaultToError({})).toBe('Неизвестная ошибка');
    expect(defaultToError(null)).toBe('Неизвестная ошибка');
    expect(defaultToError('')).toBe('Неизвестная ошибка');
  });
});
