import { describe, expect, it, vi } from 'vitest';
import type { ResourceId } from '@reformer/builder-plugin-api';
import { createRulesCache, type RulesCachePort } from './rules-cache';
import { printRulesText } from './rules-file';

const DOC = 'forms/loan/schema/form.schema.json';
const FILE = 'forms/loan/schema/form.rules.json';
const RULES = { validation: [{ target: 'a', rules: ['required'] }], behavior: [], render: [] };

/** Рабочая область как карта «путь → текст» с ручным событием изменения. */
function workspace(initial: Record<string, string> = {}) {
  const texts = new Map(Object.entries(initial));
  const listeners = new Set<(changed: readonly ResourceId[]) => void>();
  const port: RulesCachePort = {
    parentOf: (id) => id.slice(0, Math.max(0, id.lastIndexOf('/'))),
    resolve: (dir, ...segments) => [dir, ...segments].filter(Boolean).join('/'),
    readText: (id) => Promise.resolve(texts.get(id) ?? null),
    onDidChange: (cb) => {
      listeners.add(cb);
      return { dispose: () => listeners.delete(cb) };
    },
  };
  const change = (id: string, text: string) => {
    texts.set(id, text);
    for (const listener of listeners) listener([id]);
  };
  return { port, change };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('кэш файлов правил', () => {
  it('промах заказывает чтение, доехавшие правила зовут подписчиков', async () => {
    const { port } = workspace({ [FILE]: printRulesText(RULES) });
    const cache = createRulesCache(port);
    const changed = vi.fn();
    cache.onDidChange(changed);

    expect(cache.get(DOC, DOC)).toBeUndefined();
    await tick();
    expect(cache.get(DOC, DOC)).toEqual(RULES);
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('файла нет — null и без лишней перепроверки', async () => {
    const { port } = workspace();
    const cache = createRulesCache(port);
    const changed = vi.fn();
    cache.onDidChange(changed);
    cache.get(DOC, DOC);
    await tick();
    expect(cache.get(DOC, DOC)).toBeNull();
    expect(changed).not.toHaveBeenCalled();
  });

  it('изменение файла в рабочей области перечитывается', async () => {
    const { port, change } = workspace();
    const cache = createRulesCache(port);
    cache.get(DOC, DOC);
    await tick();
    const changed = vi.fn();
    cache.onDidChange(changed);

    change(FILE, printRulesText(RULES));
    await tick();
    expect(cache.get(DOC, DOC)).toEqual(RULES);
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('битый файл — «правил нет»; своя запись видна сразу', async () => {
    const { port } = workspace({ [FILE]: '{ broken' });
    const cache = createRulesCache(port);
    cache.get(DOC, DOC);
    await tick();
    expect(cache.get(DOC, DOC)).toBeNull();

    cache.remember(DOC, DOC, printRulesText(RULES));
    expect(cache.get(DOC, DOC)).toEqual(RULES);
  });
});
