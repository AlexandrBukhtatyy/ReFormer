/**
 * Путь компилирующей поверхности целиком: прочитать сайдкары → исполнить → разобрать контракт →
 * собрать форму.
 *
 * Отдельно от компонента намеренно: DOM здесь не нужен вовсе, а проверяется ровно то, ради чего
 * поверхность существует, — что значения из `model.ts` и правила из `validation.ts` доезжают
 * до собранной формы, а не теряются по дороге.
 *
 * @module plugins/preview/compiling/pipeline.test
 */

import { describe, expect, it } from 'vitest';
import { sampleSchema } from '@/lib/form-model/__fixtures__/sample-schema';
import { toDescriptor } from '@/lib/kits/descriptor';
import type { PreviewModules } from '../host';
import { buildRuntimeBundle } from '../runtime/build';
import { createFakeHost } from '../testing';
import { compileForm } from './compile';
import { extractContract, appliedArtifacts } from './exports';
import { readSidecars } from './read';

/** Загрузчик без транспиляции: сайдкары написаны на CommonJS, чтобы движок был не нужен. */
const modules: PreviewModules = {
  load: (files, entry) => {
    const evaluated = new Map<string, unknown>();
    // Резолв расширения — как у настоящего линковщика: `./model` обязан найти `model.ts`,
    // иначе тест проверял бы не то, что происходит в приложении.
    const resolve = (name: string): string => {
      for (const candidate of [name, `${name}.ts`, `${name}.tsx`]) {
        if (files.has(candidate)) return candidate;
      }
      throw new Error(`нет модуля ${name}`);
    };
    const load = (specifier: string): unknown => {
      const name = resolve(specifier);
      const cached = evaluated.get(name);
      if (cached !== undefined) return cached;
      const source = files.get(name);
      if (source === undefined) throw new Error(`нет модуля ${name}`);
      const module: { exports: unknown } = { exports: {} };
      const require = (specifier: string): unknown => load(specifier.replace('./', ''));
      new Function('exports', 'require', 'module', source)(module.exports, require, module);
      evaluated.set(name, module.exports);
      return module.exports;
    };
    return Promise.resolve({ entry: load(entry), modules: evaluated, errors: [] });
  },
};

const SIDECARS = {
  'model.ts': 'module.exports.initialFormModel = { loanType: "ипотека" };',
  'validation.ts':
    'var model = require("./model");\n' +
    'module.exports.formValidation = { loanType: [] };\n' +
    'module.exports.validationOptions = { strategy: "change" };\n' +
    'module.exports.seenModel = model.initialFormModel;',
  'index.tsx': 'throw new Error("страницу-обёртку исполнять нельзя");',
  'validation.test.ts': 'throw new Error("тесты исполнять нельзя");',
};

describe('путь компилирующей поверхности', () => {
  it('исполняет сайдкары и доводит их значения до собранной формы', async () => {
    const host = createFakeHost({ siblings: SIDECARS, source: { executesCode: true } });
    const sources = await readSidecars(host, 'fake:form/form.json');
    const compiled = await compileForm(sources.files, modules);
    expect(compiled.problems).toEqual([]);

    const contract = extractContract(compiled.modules);
    expect(appliedArtifacts(contract)).toEqual(['model', 'validation']);
    expect(contract.validation).toEqual({ schema: { loanType: [] }, strategy: 'change' });

    const bundle = buildRuntimeBundle({
      schema: sampleSchema(),
      catalog: [],
      descriptor: toDescriptor({ version: '1.0', components: [] }),
      namespace: {},
      mock: null,
      initialOverride: contract.initial,
      behavior: contract.behavior,
      validation: contract.validation,
    });
    expect(bundle.problems).toEqual([]);
    expect(bundle.form?.model.get()).toMatchObject({ loanType: 'ипотека' });
  });

  it('общий импорт исполняется ОДИН раз: иначе у формы было бы две разные модели', async () => {
    const host = createFakeHost({ siblings: SIDECARS, source: { executesCode: true } });
    const sources = await readSidecars(host, 'fake:form/form.json');
    const compiled = await compileForm(sources.files, modules);
    const model = compiled.modules.get('model.ts') as { initialFormModel: unknown };
    const validation = compiled.modules.get('validation.ts') as { seenModel: unknown };
    expect(validation.seenModel).toBe(model.initialFormModel);
  });

  it('страница-обёртка и тесты в набор не попадают', async () => {
    const host = createFakeHost({ siblings: SIDECARS });
    const sources = await readSidecars(host, 'fake:form/form.json');
    expect([...sources.files.keys()].sort()).toEqual(['model.ts', 'validation.ts']);
  });
});
