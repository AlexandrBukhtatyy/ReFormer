/**
 * `build_form` на настоящих китах проекта-образца: пример его грамматики обязан собираться на
 * каждом ките, а не только на встроенном каталоге тестов ассистента.
 *
 * Тест в композиции, потому что сверяет два плагина: инструмент ассистента и каталог кита HexaUI.
 * Плагину чужой плагин не виден — это держит линтер.
 *
 * @module plugins/reformer/integration/assistant-build-form-kits.test
 */

import { describe, expect, it } from 'vitest';
import { validateFormSchema } from '@reformer/renderer-json/validate';
import hexaCatalog from '../../kit-hexa-ui/catalog.json';
import { projectCatalog } from '../core/catalog';
import { collectModelPaths, emptyRules, emptySchema } from '../core/form-model';
import { builtinCatalog } from '../core/testing';
import { buildFormTool } from '../ai/src/tools/build-form';
import {
  BUILD_FORM_EXAMPLE,
  BUILD_FORM_STEPS_EXAMPLE,
  buildFormGrammar,
} from '../ai/src/tools/build-form/grammar';
import { arrayName } from '../ai/src/model/catalog-digest';

const KITS = [
  { name: 'встроенный кит', entries: builtinCatalog().entries },
  { name: 'HexaUI', entries: projectCatalog(hexaCatalog as never).entries },
];

describe.each(KITS)('build_form: $name', ({ entries }) => {
  const build = (intent: unknown, parent?: string, draft = emptySchema(), rules = emptyRules()) =>
    buildFormTool.run({ intent, ...(parent === undefined ? {} : { parent }) } as never, {
      draft,
      base: emptySchema(),
      rules,
      catalog: entries,
      validateForm: validateFormSchema,
    });

  it('пример грамматики собирается', async () => {
    // Без массива в ките грамматика его не показывает — и пример собирается без него.
    const intent =
      arrayName(entries) === undefined ? { ...BUILD_FORM_EXAMPLE, arrays: [] } : BUILD_FORM_EXAMPLE;
    const out = await build(intent);
    expect(out.error?.code, out.text).toBeUndefined();
    expect(collectModelPaths(out.schema!)).toEqual(expect.arrayContaining(['email', 'total']));
  });

  it('пример шагов собирается визардом кита, а поля ложатся в шаг по адресу из ответа', async () => {
    const steps = await build(BUILD_FORM_STEPS_EXAMPLE);
    expect(steps.error?.code, steps.text).toBeUndefined();
    const ref = /"Client" (\S+);/.exec(steps.text)?.[1];
    expect(ref).toBeDefined();
    const filled = await build(
      { fields: BUILD_FORM_EXAMPLE.fields.slice(0, 2) },
      ref,
      steps.schema!,
      steps.rules!
    );
    expect(filled.error?.code, filled.text).toBeUndefined();
    expect(collectModelPaths(filled.schema!)).toEqual(['email', 'kind']);
  });

  it('грамматика называет только поля этого кита', () => {
    const grammar = buildFormGrammar(entries);
    expect(grammar).toContain('Input');
    expect(grammar.includes('## arrays')).toBe(arrayName(entries) !== undefined);
  });
});
