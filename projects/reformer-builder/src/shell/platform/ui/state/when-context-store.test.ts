import { describe, expect, it, vi } from 'vitest';

import { NEUTRAL_WHEN_CONTEXT } from '@/shell/platform/primitives/when-context';
import { createWhenContextStore } from './when-context-store';

describe('createWhenContextStore', () => {
  it('без начального значения отдаёт нейтральный контекст', () => {
    expect(createWhenContextStore().get()).toEqual(NEUTRAL_WHEN_CONTEXT);
  });

  it('начальное значение достраивается до полного', () => {
    const store = createWhenContextStore({ focus: 'canvas' });
    expect(store.get()).toEqual({ ...NEUTRAL_WHEN_CONTEXT, focus: 'canvas' });
  });

  it('снимок заморожен и стабилен между изменениями', () => {
    // Условие `useSyncExternalStore`: новый объект на каждый вызов `getSnapshot` — это
    // «The result of getSnapshot should be cached» и бесконечная перерисовка.
    const store = createWhenContextStore();
    const first = store.get();

    expect(Object.isFrozen(first)).toBe(true);
    expect(store.get()).toBe(first);
  });

  it('изменение даёт новый снимок и уведомляет', () => {
    const store = createWhenContextStore();
    const before = store.get();
    const listener = vi.fn();
    store.subscribe(listener);

    expect(store.set({ focus: 'tree' })).toBe(true);
    expect(store.get()).not.toBe(before);
    expect(store.get().focus).toBe('tree');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('патч, не меняющий ничего, не рождает ни снимка, ни уведомления', () => {
    const store = createWhenContextStore({ focus: 'panel', activeEditorId: 'doc-1' });
    const before = store.get();
    const listener = vi.fn();
    store.subscribe(listener);

    expect(store.set({ focus: 'panel' })).toBe(false);
    expect(store.set({ focus: 'panel', activeEditorId: 'doc-1' })).toBe(false);
    expect(store.set({})).toBe(false);

    expect(store.get()).toBe(before);
    expect(listener).not.toHaveBeenCalled();
  });

  it('меняет только названные поля', () => {
    const store = createWhenContextStore({ focus: 'canvas', previewMode: 'interactive' });
    store.set({ hasSelection: true });

    expect(store.get()).toEqual({
      ...NEUTRAL_WHEN_CONTEXT,
      focus: 'canvas',
      previewMode: 'interactive',
      hasSelection: true,
    });
  });

  it('null — законное значение, а undefined означает «не трогать»', () => {
    const store = createWhenContextStore({ activeEditorId: 'doc-1', activeResourceKind: 'json' });

    expect(store.set({ activeResourceKind: undefined })).toBe(false);
    expect(store.get().activeResourceKind).toBe('json');

    expect(store.set({ activeEditorId: null })).toBe(true);
    expect(store.get().activeEditorId).toBeNull();
  });

  it('снятая подписка больше не вызывается', () => {
    const store = createWhenContextStore();
    const listener = vi.fn();
    const subscription = store.subscribe(listener);

    store.set({ focus: 'tree' });
    subscription.dispose();
    store.set({ focus: 'canvas' });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('падение одного подписчика не отменяет изменения и не мешает остальным', () => {
    const store = createWhenContextStore();
    const other = vi.fn();
    store.subscribe(() => {
      throw new Error('подписчик сломан');
    });
    store.subscribe(other);

    expect(() => store.set({ focus: 'tree' })).toThrow(/сломан/);
    // Изменение уже состоялось: откатывать снимок из-за чужой поломки нельзя — половина
    // подписчиков его уже увидела.
    expect(store.get().focus).toBe('tree');
    expect(other).toHaveBeenCalledTimes(1);
  });

  it('несколько упавших подписчиков собираются в AggregateError', () => {
    const store = createWhenContextStore();
    store.subscribe(() => {
      throw new Error('первый');
    });
    store.subscribe(() => {
      throw new Error('второй');
    });

    expect(() => store.set({ focus: 'tree' })).toThrow(AggregateError);
  });
});
