import { describe, expect, it, vi } from 'vitest';
import { withMarker } from '@reformer/builder-toolkit';
import type { ResourceId, ResourceRef } from '@reformer/builder-plugin-api';
import { createRulesCache, type RulesCachePort } from './rules-cache';

const DOC = 'forms/loan/schema/form.schema.json';
const FORM_RULES = 'forms/loan/validation/form.ts';
const STEP_RULES = 'forms/loan/validation/kontakty.ts';

/** Файл правил валидации, как его печатает генерация. */
const rulesFile = (name: string, body: string) =>
  withMarker(
    "import { defineValidation, validate } from '@reformer/core/validation';\n" +
      "import { required } from '@reformer/core/validators';\n\n" +
      `export const ${name} = defineValidation<LoanForm>(({ model }) => {\n${body}});\n`
  );

/** Рабочая область как карта «путь → текст» с листингом и ручным событием изменения. */
function workspace(initial: Record<string, string> = {}) {
  const texts = new Map(Object.entries(initial));
  const listeners = new Set<(changed: readonly ResourceId[]) => void>();
  const port: RulesCachePort = {
    parentOf: (id) => id.slice(0, Math.max(0, id.lastIndexOf('/'))),
    resolve: (dir, ...segments) => [dir, ...segments].filter(Boolean).join('/'),
    readText: (id) => Promise.resolve(texts.get(id) ?? null),
    list: (dir) =>
      Promise.resolve(
        [...texts.keys()]
          .filter((id) => id.startsWith(`${dir}/`) && !id.slice(dir.length + 1).includes('/'))
          .map(
            (id): ResourceRef => ({
              id,
              sourceId: 'fake',
              path: id,
              name: id.slice(dir.length + 1),
              kind: 'file',
              mediaType: 'text/plain',
            })
          )
      ),
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
const targets = (rules: ReturnType<ReturnType<typeof createRulesCache>['get']>) =>
  rules?.validation.map((rule) => rule.target);

describe('кэш правил из кода модуля', () => {
  it('промах заказывает чтение, доехавшие правила зовут подписчиков', async () => {
    const { port } = workspace({
      [FORM_RULES]: rulesFile('formRules', '  validate(model.$.email, [required()]);\n'),
    });
    const cache = createRulesCache(port);
    const changed = vi.fn();
    cache.onDidChange(changed);

    expect(cache.get(DOC, DOC)).toBeUndefined();
    await tick();
    expect(targets(cache.get(DOC, DOC))).toEqual(['email']);
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('кода нет — null и без лишней перепроверки', async () => {
    const { port } = workspace();
    const cache = createRulesCache(port);
    const changed = vi.fn();
    cache.onDidChange(changed);
    cache.get(DOC, DOC);
    await tick();
    expect(cache.get(DOC, DOC)).toBeNull();
    expect(changed).not.toHaveBeenCalled();
  });

  it('правка файла правил перечитывается', async () => {
    const { port, change } = workspace({ [FORM_RULES]: rulesFile('formRules', '') });
    const cache = createRulesCache(port);
    cache.get(DOC, DOC);
    await tick();
    const changed = vi.fn();
    cache.onDidChange(changed);

    change(FORM_RULES, rulesFile('formRules', '  validate(model.$.email, [required()]);\n'));
    await tick();
    expect(targets(cache.get(DOC, DOC))).toEqual(['email']);
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('новый файл в каталоге правил — шаг переименовали — тоже перечитывается', async () => {
    const { port, change } = workspace({ [FORM_RULES]: rulesFile('formRules', '') });
    const cache = createRulesCache(port);
    cache.get(DOC, DOC);
    await tick();

    change(STEP_RULES, rulesFile('kontaktyRules', '  validate(model.$.phone, [required()]);\n'));
    await tick();
    expect(targets(cache.get(DOC, DOC))).toEqual(['phone']);
  });

  it('правка чужого файла модуль не перечитывает', async () => {
    const { port, change } = workspace({ [FORM_RULES]: rulesFile('formRules', '') });
    const read = vi.spyOn(port, 'readText');
    const cache = createRulesCache(port);
    cache.get(DOC, DOC);
    await tick();
    const reads = read.mock.calls.length;

    change('forms/loan/types/loan.ts', 'export type LoanForm = {};\n');
    await tick();
    expect(read.mock.calls.length).toBe(reads);
  });
});
