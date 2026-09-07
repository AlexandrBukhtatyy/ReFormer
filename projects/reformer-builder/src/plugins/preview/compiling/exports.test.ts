/**
 * Контракт каталога формы: имена экспортов, легаси-файлы, склейка валидации.
 *
 * @module plugins/preview/compiling/exports.test
 */

import { describe, expect, it } from 'vitest';
import {
  appliedArtifacts,
  composeValidation,
  extractContract,
  isValidationConfig,
} from './exports';

const rules = { email: [] };

function modules(entries: Record<string, unknown>): ReadonlyMap<string, unknown> {
  return new Map(Object.entries(entries));
}

describe('extractContract', () => {
  it('находит все пять артефактов по каноничным именам', () => {
    const behavior = {};
    const renderBehavior = (): unknown => undefined;
    const createRegistry = (): unknown => ({});
    const contract = extractContract(
      modules({
        'model.ts': { initialFormModel: { a: 1 } },
        'validation.ts': { formValidation: rules },
        'form.behavior.ts': { formBehavior: behavior },
        'renderer.behavior.ts': { formRenderBehavior: renderBehavior },
        'registry.ts': { createRegistry },
      })
    );
    expect(appliedArtifacts(contract)).toEqual([
      'model',
      'validation',
      'behavior',
      'renderBehavior',
      'registry',
    ]);
  });

  it('легаси-имена файлов тоже оживают: старая форма не должна оставаться без превью', () => {
    const contract = extractContract(
      modules({
        'form-behavior.ts': { formBehavior: {} },
        'ui.ts': { formRenderBehavior: () => undefined },
      })
    );
    expect(appliedArtifacts(contract)).toEqual(['behavior', 'renderBehavior']);
  });

  it('готовая функция поведения заворачивается в фабрику — вход у сборки один', () => {
    const ready = (): string => 'поведение';
    const contract = extractContract(modules({ 'ui.ts': { formRenderBehavior: ready } }));
    expect(contract.renderBehavior).toBeDefined();
    expect((contract.renderBehavior as () => unknown)()).toBe(ready);
  });

  it('фабрика выигрывает у готовой функции: шаблон визарда отдаёт именно её', () => {
    const factory = (): string => 'из фабрики';
    const contract = extractContract(
      modules({
        'renderer.behavior.ts': {
          formRenderBehavior: () => 'готовая',
          createRenderBehavior: factory,
        },
      })
    );
    expect(contract.renderBehavior).toBe(factory);
  });

  it('имя кодогена билдера распознаётся наравне с фабрикой шаблона', () => {
    const factory = (): string => 'кодоген';
    const contract = extractContract(
      modules({ 'renderer.behavior.ts': { createJsonRenderBehavior: factory } })
    );
    expect(contract.renderBehavior).toBe(factory);
  });

  it('пустые модули дают пустой контракт, а не выдуманные артефакты', () => {
    expect(appliedArtifacts(extractContract(modules({ 'model.ts': {} })))).toEqual([]);
  });
});

describe('composeValidation', () => {
  it('стратегия из validationOptions приклеивается к схеме правил', () => {
    expect(composeValidation(rules, { strategy: 'change' })).toEqual({
      schema: rules,
      strategy: 'change',
    });
  });

  it('готовую конфигурацию не переспоривают', () => {
    const config = { steps: {}, strategy: 'submit' };
    expect(composeValidation(config, { strategy: 'change' })).toBe(config);
  });

  it('без правил ничего не собирается', () => {
    expect(composeValidation(undefined, { strategy: 'change' })).toBeUndefined();
  });
});

describe('isValidationConfig', () => {
  it('конфигурацию узнают по её ключам, а не по форме объекта', () => {
    expect(isValidationConfig({ steps: {} })).toBe(true);
    expect(isValidationConfig({ schema: {} })).toBe(true);
    expect(isValidationConfig(rules)).toBe(false);
  });
});
