/**
 * Значения источников из правил формы — в генерации поверх выдуманных.
 *
 * @module plugins/reformer/core/codegen/data-sources.test
 */

import { describe, expect, it } from 'vitest';
import { renderTemplate } from '@reformer/builder-toolkit';
import { builtinKit, subpathSchema } from './__fixtures__/kit';
import { prepare } from './context';
import { emptyRules } from '../form-model/rules';
import { dataSourcesTemplate } from './templates';
import { buildView } from './view/index';

describe('значения источников из правил формы', () => {
  const options = [
    { value: 'dev', label: 'Разработчик' },
    { value: 'qa', label: 'Тестировщик' },
  ];

  it('заменяют выдуманные значения в constants', () => {
    const ctx = prepare({
      schema: subpathSchema(),
      formName: 'Анкета',
      kit: builtinKit(),
      rules: { ...emptyRules(), dataSources: { POSITIONS: options } },
    });
    expect(ctx.mock.dataSources.POSITIONS).toEqual(options);
    const code = renderTemplate('data-sources', dataSourcesTemplate, buildView(ctx));
    expect(code).toContain("label: 'Разработчик'");
  });

  it('источник, на который схема не ссылается, не печатается', () => {
    const ctx = prepare({
      schema: subpathSchema(),
      formName: 'Анкета',
      kit: builtinKit(),
      rules: { ...emptyRules(), dataSources: { UNUSED: options } },
    });
    expect(ctx.mock.dataSources.UNUSED).toBeUndefined();
  });
});
