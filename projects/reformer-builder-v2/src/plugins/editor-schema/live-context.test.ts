/**
 * Мост между сеансом редактора схемы и поверхностью.
 *
 * @module plugins/editor-schema/live-context.test
 */

import { describe, expect, it, vi } from 'vitest';
import { sampleSchema } from '@/lib/form-model/__fixtures__/sample-schema';
import type { NodeId } from '@/sdk';
import { createLiveContext } from './live-context';
import type { SchemaEditorState } from './sessions';

function state(overrides: Partial<SchemaEditorState> = {}): SchemaEditorState {
  return Object.freeze({
    model: sampleSchema(),
    selection: Object.freeze([]) as readonly NodeId[],
    syncState: 'synced' as const,
    parseError: null,
    canUndo: false,
    canRedo: false,
    ...overrides,
  });
}

function harness(options: { accepts?: boolean } = {}) {
  const chosen: (readonly NodeId[])[] = [];
  const problems: string[][] = [];
  const initial = state();
  const ctx = createLiveContext({
    initial,
    accepts: () => options.accepts ?? true,
    onSelect: (ids) => chosen.push(ids),
    onProblems: (messages) => problems.push([...messages]),
  });
  return { ctx, chosen, problems, initial };
}

describe('createLiveContext', () => {
  it('схема приходит той же ссылкой, пока модель не менялась', () => {
    const { ctx } = harness();
    expect(ctx.schema()).toBe(ctx.schema());
  });

  it('правка модели уведомляет подписчиков схемы, но не выделения', () => {
    const { ctx, initial } = harness();
    const onSchema = vi.fn();
    const onSelection = vi.fn();
    ctx.onDidChangeSchema(onSchema);
    ctx.onDidChangeSelection(onSelection);

    ctx.push(state({ selection: initial.selection }));

    expect(onSchema).toHaveBeenCalledTimes(1);
    // Пересборка формы и перерисовка подсветки — разной цены, и путать их нельзя.
    expect(onSelection).not.toHaveBeenCalled();
  });

  it('смена выделения уведомляет подписчиков выделения, но не схемы', () => {
    const { ctx, initial } = harness();
    const onSchema = vi.fn();
    const onSelection = vi.fn();
    ctx.onDidChangeSchema(onSchema);
    ctx.onDidChangeSelection(onSelection);

    ctx.push({ ...initial, selection: Object.freeze(['a1b2c3d4']) });

    expect(onSelection).toHaveBeenCalledTimes(1);
    expect(onSchema).not.toHaveBeenCalled();
  });

  it('тот же снимок не уведомляет никого', () => {
    const { ctx, initial } = harness();
    const onSchema = vi.fn();
    ctx.onDidChangeSchema(onSchema);
    ctx.push(initial);
    expect(onSchema).not.toHaveBeenCalled();
  });

  it('схема отдаёт модель, которую положили последним push', () => {
    const { ctx } = harness();
    const next = state();
    ctx.push(next);
    expect(ctx.schema()).toBe(next.model);
  });

  it('выбор от поверхности проходит, когда его ждут', () => {
    const { ctx, chosen } = harness({ accepts: true });
    ctx.select(['a1b2c3d4']);
    expect(chosen).toEqual([['a1b2c3d4']]);
  });

  it('обычный клик по живой форме выделение не меняет', () => {
    const { ctx, chosen } = harness({ accepts: false });
    ctx.select(['a1b2c3d4']);
    // Клик по чекбоксу переключает чекбокс; выбор узла — это Alt+клик, и ловит его сам вид.
    expect(chosen).toEqual([]);
  });

  it('находки сборки доходят строками', () => {
    const { ctx, problems } = harness();
    ctx.report?.(['схема не разобралась']);
    expect(problems).toEqual([['схема не разобралась']]);
  });

  it('отписка перестаёт уведомлять', () => {
    const { ctx, initial } = harness();
    const onSchema = vi.fn();
    const subscription = ctx.onDidChangeSchema(onSchema);
    subscription.dispose();
    ctx.push({ ...initial, model: sampleSchema() });
    expect(onSchema).not.toHaveBeenCalled();
  });

  it('упавший подписчик не мешает остальным узнать', () => {
    const { ctx, initial } = harness();
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const good = vi.fn();
      ctx.onDidChangeSchema(() => {
        throw new Error('подписчик сломался');
      });
      ctx.onDidChangeSchema(good);
      ctx.push({ ...initial, model: sampleSchema() });
      expect(good).toHaveBeenCalledTimes(1);
    } finally {
      errors.mockRestore();
    }
  });
});
