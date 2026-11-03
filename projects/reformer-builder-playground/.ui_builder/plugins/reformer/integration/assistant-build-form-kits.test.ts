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
import { BUILD_FORM_EXAMPLE, buildFormGrammar } from '../ai/src/tools/build-form/grammar';
import { arrayName } from '../ai/src/model/catalog-digest';

const KITS = [
  { name: 'встроенный кит', entries: builtinCatalog().entries },
  { name: 'HexaUI', entries: projectCatalog(hexaCatalog as never).entries },
];

describe.each(KITS)('build_form: $name', ({ entries }) => {
  it('пример грамматики собирается', async () => {
    // Без массива в ките грамматика его не показывает — и пример собирается без него.
    const intent =
      arrayName(entries) === undefined ? { ...BUILD_FORM_EXAMPLE, arrays: [] } : BUILD_FORM_EXAMPLE;
    const steps =
      arrayName(entries) === undefined
        ? intent.steps.map((s) => ({ ...s, fields: s.fields.filter((f) => f !== 'children') }))
        : intent.steps;
    const out = await buildFormTool.run({ intent: { ...intent, steps } } as never, {
      draft: emptySchema(),
      base: emptySchema(),
      rules: emptyRules(),
      catalog: entries,
      validateForm: validateFormSchema,
    });
    expect(out.error?.code, out.text).toBeUndefined();
    expect(collectModelPaths(out.schema!)).toEqual(expect.arrayContaining(['email', 'total']));
  });

  it('грамматика называет только поля этого кита', () => {
    const grammar = buildFormGrammar(entries);
    expect(grammar).toContain('Input');
    expect(grammar.includes('## arrays')).toBe(arrayName(entries) !== undefined);
  });
});
