/**
 * Состав корневого экспорта `@reformer/core`: низкоуровневые операторы над сигналами и нодами в
 * зонтик не входят. Поведение формы пишут операторами `@reformer/core/behaviors`; примитивы над
 * сигналами остаются в сабпате `@reformer/core/model`.
 */

import { describe, it, expect } from 'vitest';
import * as core from '../../../src/index';
import * as model from '../../../src/model/index';
import * as behaviors from '../../../src/form/behaviors';

const VALUE_OPERATORS = [
  'computeFrom',
  'copyFrom',
  'watchField',
  'transformValue',
  'resetWhen',
  'syncFields',
  'revalidateWhen',
];
const NODE_OPERATORS = ['enableWhen', 'disableWhen'];

describe('корневой экспорт @reformer/core', () => {
  it.each([...VALUE_OPERATORS, ...NODE_OPERATORS])('не отдаёт оператор %s', (name) => {
    expect(core).not.toHaveProperty(name);
  });

  it('отдаёт сборку формы, модель и ноды', () => {
    for (const name of [
      'createForm',
      'createFormFromModel',
      'createModel',
      'arrayOf',
      'modelOf',
      'FieldNode',
      'GroupNode',
      'ModelArrayNode',
      'useFormControl',
      'useFormBundle',
      'markDerived',
      'runOutsideEffect',
    ]) {
      expect(core, name).toHaveProperty(name);
    }
  });

  it('удалённый старый путь в зонтик не вернулся', () => {
    for (const name of [
      'createLegacyForm',
      'NodeFactory',
      'ArrayNode',
      'FormErrorHandler',
      'ErrorStrategy',
    ]) {
      expect(core, name).not.toHaveProperty(name);
    }
  });
});

describe('сабпаты ядра', () => {
  it.each(VALUE_OPERATORS)('@reformer/core/model отдаёт оператор над сигналами %s', (name) => {
    expect(model).toHaveProperty(name);
  });

  it('@reformer/core/behaviors отдаёт операторы поведения формы', () => {
    for (const name of [
      'defineFormBehavior',
      'compute',
      'copyFrom',
      'enableWhen',
      'disableWhen',
      'hideWhen',
      'onChange',
      'apply',
      'applyEach',
    ]) {
      expect(behaviors, name).toHaveProperty(name);
    }
  });
});
