/**
 * Тесты заглушки клиента: рисует детей, повторяет публичный API настоящего клиента
 * и ничего не делает при импорте.
 *
 * @module client/noop.test
 */

import { Fragment } from 'react';
import { describe, expect, it } from 'vitest';

import { ReformerBuilder } from './noop';

describe('заглушка клиента', () => {
  it('рисует детей и ничего больше', () => {
    const element = ReformerBuilder({ children: 'x' });

    expect(element.type).toBe(Fragment);
    expect(element.props).toEqual({ children: 'x' });
  });

  it('без детей — пустой фрагмент', () => {
    const element = ReformerBuilder({});

    expect(element.type).toBe(Fragment);
    expect(element.props).toEqual({ children: undefined });
  });

  it('импорт не трогает страницу: ни рамки, ни моста', () => {
    const page = globalThis as Record<symbol, unknown>;

    expect(page[Symbol.for('reformer.builder.shell-frame')]).toBeUndefined();
    expect(page[Symbol.for('reformer.builder.host')]).toBeUndefined();
  });

  it('публичный API совпадает с настоящим клиентом', async () => {
    const real = await import('./index');
    const stub = await import('./noop');

    expect(Object.keys(stub).sort()).toEqual(Object.keys(real).sort());
    expect(Object.keys(stub)).toEqual(['ReformerBuilder']);
  });
});
