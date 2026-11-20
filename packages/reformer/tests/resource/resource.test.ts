/**
 * `resource()` [ReFormer-lywn.4] — загрузка на сигналах.
 *
 * Ресурс — основа серверного режима таблицы и любых экранов «загрузить по ключу». Проверяется:
 * реактивный ключ и `idle` без ключа, отмена устаревших запросов, склейка смен ключа в одном
 * тике в один запрос, stale-while-revalidate, ошибки и отмена, оптимистичная правка и время
 * жизни в области.
 */

import { describe, expect, it, vi } from 'vitest';
import { batch, signal } from '@preact/signals-core';
import { createStore } from '../../src/model/index';
import {
  defaultToError,
  rejectionMessage,
  resource,
  type ResourceOptions,
} from '../../src/resource/index';
import { deferred, flushMicrotasks, settle, type Deferred } from '../test-utils/async';

/** Загрузчик под контролем теста: каждый вызов — свой отложенный ответ. */
function controlledLoad<K, T>() {
  const calls: { key: K; signal: AbortSignal; previous: T | undefined; answer: Deferred<T> }[] = [];
  const load: ResourceOptions<T, K>['load'] = (key, ctx) => {
    const answer = deferred<T>();
    calls.push({ key, signal: ctx.signal, previous: ctx.previous, answer });
    return answer.promise;
  };
  return { load, calls };
}

describe('resource — ключ и статусы', () => {
  it('без key грузится один раз: loading сразу, ready после ответа', async () => {
    const { load, calls } = controlledLoad<void, string>();
    const res = createStore(() => ({ r: resource({ load }) })).r;
    expect(res.status.value).toBe('loading');
    expect(res.isFetching.value).toBe(true);
    await flushMicrotasks();
    expect(calls).toHaveLength(1);
    expect(calls[0]!.key).toBeUndefined();
    calls[0]!.answer.resolve('данные');
    await res.settled();
    expect(res.status.value).toBe('ready');
    expect(res.data.value).toBe('данные');
    expect(res.error.value).toBeNull();
    expect(res.isFetching.value).toBe(false);
    res.dispose();
  });

  it('ключ null — idle, запроса нет; появился ключ — загрузка', async () => {
    const id = signal<number | null>(null);
    const { load, calls } = controlledLoad<number, string>();
    const res = resource({ key: () => id.value, load });
    expect(res.status.value).toBe('idle');
    await flushMicrotasks();
    expect(calls).toHaveLength(0);
    id.value = 7;
    expect(res.status.value).toBe('loading');
    await flushMicrotasks();
    expect(calls.map((c) => c.key)).toEqual([7]);
    res.dispose();
  });

  it('ключ undefined при заданном key — тоже idle', async () => {
    const id = signal<number | undefined>(undefined);
    const { load, calls } = controlledLoad<number, string>();
    const res = resource({ key: () => id.value, load });
    expect(res.status.value).toBe('idle');
    await flushMicrotasks();
    expect(calls).toHaveLength(0);
    res.dispose();
  });

  it('смена ключа отменяет прежний запрос, его ответ не применяется', async () => {
    const id = signal(1);
    const { load, calls } = controlledLoad<number, string>();
    const res = resource({ key: () => id.value, load });
    await flushMicrotasks();
    id.value = 2;
    await flushMicrotasks();
    expect(calls[0]!.signal.aborted).toBe(true);
    calls[0]!.answer.resolve('старое');
    calls[1]!.answer.resolve('новое');
    await res.settled();
    expect(res.data.value).toBe('новое');
    res.dispose();
  });

  it('устаревший отказ тоже не применяется', async () => {
    const id = signal(1);
    const { load, calls } = controlledLoad<number, string>();
    const onError = vi.fn();
    const res = resource({ key: () => id.value, load, onError });
    await flushMicrotasks();
    id.value = 2;
    await flushMicrotasks();
    calls[0]!.answer.reject(new Error('старый отказ'));
    calls[1]!.answer.resolve('ok');
    await res.settled();
    expect(res.status.value).toBe('ready');
    expect(onError).not.toHaveBeenCalled();
    res.dispose();
  });

  it('несколько смен ключа в одном тике — один запрос с последним ключом', async () => {
    const page = signal(0);
    const filter = signal('');
    const { load, calls } = controlledLoad<{ page: number; filter: string }, string>();
    const res = resource({ key: () => ({ page: page.value, filter: filter.value }), load });
    await flushMicrotasks();
    expect(calls).toHaveLength(1);
    filter.value = 'ив';
    page.value = 0;
    page.value = 3;
    await flushMicrotasks();
    expect(calls.map((c) => c.key)).toEqual([
      { page: 0, filter: '' },
      { page: 3, filter: 'ив' },
    ]);
    res.dispose();
  });

  it('ключ, глубоко равный загруженному, нового запроса не даёт', async () => {
    const q = signal({ page: 1 });
    const { load, calls } = controlledLoad<{ page: number }, string>();
    const res = resource({ key: () => q.value, load });
    await flushMicrotasks();
    q.value = { page: 1 };
    await flushMicrotasks();
    expect(calls).toHaveLength(1);
    res.dispose();
  });

  it('своё равенство ключей — equals', async () => {
    const q = signal('A');
    const { load, calls } = controlledLoad<string, string>();
    const res = resource({
      key: () => q.value,
      load,
      equals: (a, b) => a.toLowerCase() === b.toLowerCase(),
    });
    await flushMicrotasks();
    q.value = 'a';
    await flushMicrotasks();
    expect(calls).toHaveLength(1);
    res.dispose();
  });

  it('enabled — выключение сбрасывает в idle и отменяет запрос, включение грузит снова', async () => {
    const on = signal(true);
    const { load, calls } = controlledLoad<void, string>();
    const res = resource({ load, enabled: () => on.value });
    await flushMicrotasks();
    on.value = false;
    expect(calls[0]!.signal.aborted).toBe(true);
    expect(res.status.value).toBe('idle');
    on.value = true;
    await flushMicrotasks();
    expect(calls).toHaveLength(2);
    res.dispose();
  });

  it('выключенная с самого начала загрузка остаётся idle без запросов', async () => {
    const { load, calls } = controlledLoad<void, string>();
    const res = resource({ load, enabled: () => false });
    await flushMicrotasks();
    expect(res.status.value).toBe('idle');
    expect(calls).toHaveLength(0);
    res.dispose();
  });
});

describe('resource — прежние данные, ошибки, отмена', () => {
  it('keepPrevious (по умолчанию): новый ключ — ready + refreshing, previous передаётся', async () => {
    const id = signal(1);
    const { load, calls } = controlledLoad<number, string>();
    const res = resource({ key: () => id.value, load });
    await flushMicrotasks();
    calls[0]!.answer.resolve('первый');
    await res.settled();
    id.value = 2;
    expect(res.status.value).toBe('ready');
    expect(res.refreshing.value).toBe(true);
    expect(res.isFetching.value).toBe(true);
    await flushMicrotasks();
    expect(calls[1]!.previous).toBe('первый');
    res.dispose();
  });

  it('keepPrevious: false — новый ключ сбрасывает данные в loading', async () => {
    const id = signal(1);
    const { load, calls } = controlledLoad<number, string>();
    const res = resource({ key: () => id.value, load, keepPrevious: false });
    await flushMicrotasks();
    calls[0]!.answer.resolve('первый');
    await res.settled();
    id.value = 2;
    expect(res.status.value).toBe('loading');
    expect(res.data.value).toBeUndefined();
    res.dispose();
  });

  it('initialData — сразу ready, первый запрос идёт фоном', async () => {
    const { load, calls } = controlledLoad<void, string>();
    const res = resource({ load, initialData: 'кэш' });
    expect(res.status.value).toBe('ready');
    expect(res.refreshing.value).toBe(true);
    expect(res.data.value).toBe('кэш');
    await flushMicrotasks();
    calls[0]!.answer.resolve('свежее');
    await res.settled();
    expect(res.data.value).toBe('свежее');
    res.dispose();
  });

  it('отказ — error с toError и onError, прежние данные сохранены', async () => {
    const { load, calls } = controlledLoad<void, string>();
    const onError = vi.fn();
    const res = resource({ load, toError: defaultToError, onError });
    await flushMicrotasks();
    calls[0]!.answer.resolve('данные');
    await res.settled();
    res.reload();
    await flushMicrotasks();
    calls[1]!.answer.reject(new Error('сеть'));
    await res.settled();
    expect(res.status.value).toBe('error');
    expect(res.error.value).toBe('сеть');
    expect(res.data.value).toBe('данные');
    expect(onError).toHaveBeenCalledWith('сеть');
    res.dispose();
  });

  it('без toError ошибка — сам отказ; синхронный throw в load — тоже отказ', async () => {
    const boom = new Error('sync');
    const res = resource<string>({
      load: () => {
        throw boom;
      },
    });
    await settle();
    expect(res.status.value).toBe('error');
    expect(res.error.value).toBe(boom);
    res.dispose();
  });

  it('onSuccess — только для актуального ответа', async () => {
    const onSuccess = vi.fn();
    const { load, calls } = controlledLoad<void, number>();
    const res = resource({ load, onSuccess });
    await flushMicrotasks();
    calls[0]!.answer.resolve(42);
    await res.settled();
    expect(onSuccess).toHaveBeenCalledWith(42);
    res.dispose();
  });

  it('abort — отменяет запрос, ресурс возвращается к данным; без запроса — no-op', async () => {
    const { load, calls } = controlledLoad<void, string>();
    const res = resource({ load });
    await flushMicrotasks();
    calls[0]!.answer.resolve('данные');
    await res.settled();
    const before = res.state.value;
    res.abort(); // нечего отменять
    expect(res.state.value).toBe(before);

    res.reload();
    await flushMicrotasks();
    res.abort();
    expect(calls[1]!.signal.aborted).toBe(true);
    expect(res.status.value).toBe('ready');
    expect(res.refreshing.value).toBe(false);
    calls[1]!.answer.resolve('опоздал');
    await settle();
    expect(res.data.value).toBe('данные');
    res.dispose();
  });

  it('abort до отправки запроса отменяет запланированный запрос — первая загрузка → idle', async () => {
    const { load, calls } = controlledLoad<void, string>();
    const res = resource({ load });
    res.abort();
    await flushMicrotasks();
    expect(calls).toHaveLength(0);
    expect(res.status.value).toBe('idle');
    res.dispose();
  });

  it('reload без ключа — no-op', async () => {
    const { load, calls } = controlledLoad<number, string>();
    const res = resource({ key: () => null, load });
    res.reload();
    await flushMicrotasks();
    expect(calls).toHaveLength(0);
    res.dispose();
  });

  it('mutate — значение и функция от прежнего, без запроса', async () => {
    const { load, calls } = controlledLoad<void, number[]>();
    const res = resource({ load });
    await flushMicrotasks();
    calls[0]!.answer.resolve([1]);
    await res.settled();
    res.mutate([1, 2]);
    expect(res.data.value).toEqual([1, 2]);
    res.mutate((prev) => [...(prev ?? []), 3]);
    expect(res.data.value).toEqual([1, 2, 3]);
    expect(res.status.value).toBe('ready');
    expect(calls).toHaveLength(1);
    res.dispose();
  });

  it('settled ждёт запланированный и идущий запрос', async () => {
    const res = resource({ load: () => Promise.resolve('x') });
    await res.settled();
    expect(res.data.value).toBe('x');
    await res.settled(); // нечего ждать
    res.dispose();
  });
});

describe('resource — время жизни', () => {
  it('dispose отменяет запрос и перестаёт следить за ключом', async () => {
    const id = signal(1);
    const { load, calls } = controlledLoad<number, string>();
    const res = resource({ key: () => id.value, load });
    await flushMicrotasks();
    res.dispose();
    expect(calls[0]!.signal.aborted).toBe(true);
    id.value = 2;
    res.reload();
    await flushMicrotasks();
    expect(calls).toHaveLength(1);
  });

  it('dispose до отправки — запрос не уходит', async () => {
    const { load, calls } = controlledLoad<void, string>();
    const res = resource({ load });
    res.dispose();
    await flushMicrotasks();
    expect(calls).toHaveLength(0);
  });

  it('снятие стора снимает ресурс, созданный внутри', async () => {
    const id = signal(1);
    const { load, calls } = controlledLoad<number, string>();
    const store = createStore(() => ({ user: resource({ key: () => id.value, load }) }));
    await flushMicrotasks();
    store.dispose();
    expect(calls[0]!.signal.aborted).toBe(true);
    id.value = 2;
    await flushMicrotasks();
    expect(calls).toHaveLength(1);
  });

  it('ключ из batch-записи — один запрос', async () => {
    const a = signal(1);
    const b = signal(1);
    const { load, calls } = controlledLoad<number, string>();
    const res = resource({ key: () => a.value + b.value, load });
    await flushMicrotasks();
    batch(() => {
      a.value = 2;
      b.value = 3;
    });
    await flushMicrotasks();
    expect(calls.map((c) => c.key)).toEqual([2, 5]);
    res.dispose();
  });
});

describe('rejectionMessage — текст отказа', () => {
  it('Error → message, строка → она же, прочее → undefined', () => {
    expect(rejectionMessage(new Error('x'))).toBe('x');
    expect(rejectionMessage('y')).toBe('y');
    expect(rejectionMessage('')).toBeUndefined();
    expect(rejectionMessage({})).toBeUndefined();
  });
});
