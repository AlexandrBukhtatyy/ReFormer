/**
 * Плагин стека ReFormer в шаблонах: что он вносит в точки хозяина.
 *
 * @module plugins/reformer/templates/plugin.test
 */

import { describe, expect, it } from 'vitest';
import type { FormTemplateStore, PluginContext, TemplateStack } from '@reformer/builder-plugin-api';
import { BUILTIN_STORE_ID, createTemplateStackPlugin, TEMPLATE_STACK_PLUGIN_ID } from './plugin';
import { fakePrinter } from './testing';

/** Контекст в объёме вкладов: реестр служб отвечает «их нет» — ни кита, ни печатника. */
function fakeContext() {
  const contributed: { point: string; id?: string; order?: number; value: unknown }[] = [];
  const ctx = {
    id: TEMPLATE_STACK_PLUGIN_ID,
    subscriptions: [],
    extensions: {
      contribute: (
        point: { id: string },
        value: unknown,
        meta?: { id?: string; order?: number }
      ) => {
        contributed.push({ point: point.id, id: meta?.id, order: meta?.order, value });
        return { dispose: () => undefined };
      },
    },
    services: { get: () => undefined },
  } as unknown as PluginContext;
  return { ctx, contributed };
}

describe('плагин стека ReFormer в шаблонах', () => {
  it('идентификатор — свой, отдельный от хозяина шаблонов', () => {
    expect(TEMPLATE_STACK_PLUGIN_ID).toBe('reformer.templates-schema');
  });

  it('вносит себя в точку стеков и встроенные шаблоны — первым хранилищем', () => {
    const { ctx, contributed } = fakeContext();
    createTemplateStackPlugin().activate(ctx);

    const stacks = contributed.filter((item) => item.point === 'templates.stack');
    expect(stacks.map((item) => (item.value as TemplateStack).id)).toEqual(['reformer']);
    expect(contributed.filter((item) => item.point === 'templates.store')).toMatchObject([
      { id: BUILTIN_STORE_ID, order: 10 },
    ]);
  });

  it('без печатника встроенное хранилище объявляет себя недоступным', () => {
    const { ctx, contributed } = fakeContext();
    createTemplateStackPlugin().activate(ctx);
    const builtin = contributed.find((item) => item.id === BUILTIN_STORE_ID);
    expect((builtin?.value as FormTemplateStore).available()).toBe(false);
  });

  it('с печатником встроенные шаблоны печатаются', async () => {
    const { ctx, contributed } = fakeContext();
    createTemplateStackPlugin({ print: fakePrinter }).activate(ctx);
    const builtin = contributed.find((item) => item.id === BUILTIN_STORE_ID)
      ?.value as FormTemplateStore;

    expect(builtin.available()).toBe(true);
    expect((await builtin.list()).map((template) => template.source)).toContain('builtin');
  });

  it('всё вносится подписками контекста — уходит вместе с плагином', () => {
    const { ctx, contributed } = fakeContext();
    createTemplateStackPlugin().activate(ctx);
    expect(ctx.subscriptions).toHaveLength(contributed.length);
  });
});
