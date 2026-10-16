/**
 * Тесты плагина Vite: что отдаёт `reformerBuilder()` и чем прод-сборка отличается от dev.
 *
 * Плагин — обычный JS без сборки (`vite/plugin.mjs`); проверяется его форма, а не сервер:
 * два плагина в массиве, границы `apply` и псевдоним прод-сборки. Сервер и раздачу покрывают
 * `vite-endpoints.test` и e2e `embedded`.
 *
 * @module shell/embedded/vite-plugin.test
 */

import type { ConfigEnv, Plugin, UserConfig } from 'vite';
import { describe, expect, it } from 'vitest';

import { reformerBuilder } from '../../../vite/plugin.mjs';

const BUILD: ConfigEnv = { command: 'build', mode: 'production' };

/** Зовёт хук `config` плагина: он объявлен и функцией, и объектом с `handler`. */
async function configOf(plugin: Plugin, env: ConfigEnv): Promise<UserConfig> {
  const hook = plugin.config;
  const handler = typeof hook === 'function' ? hook : hook?.handler;
  if (handler === undefined) throw new Error(`у плагина «${plugin.name}» нет хука config`);
  const result = await handler.call(undefined as never, {}, env);
  return result ?? {};
}

describe('reformerBuilder', () => {
  it('отдаёт два плагина: dev-сервер и прод-сборку', () => {
    const plugins = reformerBuilder();

    expect(plugins.map((plugin) => plugin.name)).toEqual([
      'reformer-builder',
      'reformer-builder:production',
    ]);
    expect(plugins.map((plugin) => plugin.apply)).toEqual(['serve', 'build']);
  });

  it('dev-сервер остался тем же: раздача, мост, дедупликация React', async () => {
    const [devServer] = reformerBuilder();

    expect(devServer?.configureServer).toBeDefined();
    expect(devServer?.transformIndexHtml).toBeDefined();
    expect(devServer?.resolveId).toBeDefined();
    expect(devServer?.load).toBeDefined();
    expect(await configOf(devServer!, { command: 'serve', mode: 'development' })).toEqual({
      resolve: { dedupe: ['react', 'react-dom'] },
    });
  });

  it('прод-сборка подменяет клиент заглушкой — и только его', async () => {
    const [, production] = reformerBuilder();

    const { resolve } = await configOf(production!, BUILD);
    const alias = resolve?.alias;
    expect(Array.isArray(alias)).toBe(true);
    if (!Array.isArray(alias)) return;
    expect(alias).toHaveLength(1);
    const [rule] = alias;
    expect(rule?.replacement).toBe('@reformer/builder/noop');
    expect(rule?.find).toBeInstanceOf(RegExp);
    const find = rule?.find as RegExp;
    expect(find.test('@reformer/builder')).toBe(true);
    for (const foreign of [
      '@reformer/builder/vite',
      '@reformer/builder/noop',
      '@reformer/builder-plugin-api',
      '@reformer/builder/package.json',
    ]) {
      expect(find.test(foreign), foreign).toBe(false);
    }
  });

  it('прод-сборка ничего не раздаёт: без сервера и без моста', () => {
    const [, production] = reformerBuilder();

    expect(production?.configureServer).toBeUndefined();
    expect(production?.transformIndexHtml).toBeUndefined();
    expect(production?.resolveId).toBeUndefined();
  });

  it('каждый вызов — свои плагины: состояние dev-сервера не делится', () => {
    const [first] = reformerBuilder();
    const [second] = reformerBuilder();

    expect(first).not.toBe(second);
  });
});
