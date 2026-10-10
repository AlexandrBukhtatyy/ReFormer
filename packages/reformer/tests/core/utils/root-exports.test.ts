/**
 * Состав корневого экспорта `@reformer/core`: низкоуровневые операторы над сигналами и нодами в
 * зонтик не входят. Поведение формы пишут операторами `@reformer/core/behaviors`; примитивы над
 * сигналами остаются в сабпате `@reformer/core/model`. React-привязок в корне и в `/i18n` нет:
 * их отдаёт сабпат `@reformer/core/react`.
 */

import { describe, it, expect } from 'vitest';
import * as core from '../../../src/index';
import * as model from '../../../src/model/index';
import * as behaviors from '../../../src/form/behaviors';
import * as i18n from '../../../src/i18n';
import * as react from '../../../src/react';

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

  it('отдаёт сборку формы, модель и гарды нод', () => {
    for (const name of [
      'createForm',
      'createFormFromModel',
      'createModel',
      'arrayOf',
      'modelOf',
      'isFormNode',
      'isFormControl',
      'isFormGroup',
      'isFormArray',
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
      // Классы нод — внутренние: наружу только контракты FormNode, FormControl, FormGroup, FormArray.
      'FormNode',
      'FieldNode',
      'GroupNode',
      'ModelArrayNode',
      'isFieldNode',
      'isGroupNode',
      'isArrayNode',
    ]) {
      expect(core, name).not.toHaveProperty(name);
    }
  });
});

/** Хуки нод, контекст сборки и связка поля с контролом — состав `platforms/react`. */
const REACT_BINDINGS = [
  'useFormControl',
  'useFormControlValue',
  'useArrayLength',
  'useFormValidation',
  'useFormBundle',
  'FormBundleContext',
  'useFormBundleContext',
  'getFieldAdapter',
  'bindFieldProps',
  'FIELD_WRAPPER_ONLY_PROPS',
  'makeElementFieldHandle',
  'useFieldHandleRef',
];
/** React-часть локализации: провайдер, хуки и метка контекста. */
const REACT_I18N = [
  'I18nProvider',
  'useI18n',
  'useMessages',
  'useIssueMessage',
  'I18N_CONTEXT_MARKER',
];

describe('React-привязки ядра', () => {
  it.each(REACT_BINDINGS)('корень @reformer/core не отдаёт %s', (name) => {
    expect(core).not.toHaveProperty(name);
  });

  it.each(REACT_I18N)('@reformer/core/i18n не отдаёт %s', (name) => {
    expect(i18n).not.toHaveProperty(name);
    expect(core).not.toHaveProperty(name);
  });

  it('@reformer/core/react отдаёт хуки, связку поля и React-часть локализации', () => {
    for (const name of [...REACT_BINDINGS, ...REACT_I18N]) {
      expect(react, name).toHaveProperty(name);
    }
  });

  it('@reformer/core/i18n без React по-прежнему отдаёт перевод и тексты ошибок', () => {
    for (const name of ['createI18n', 'resolveIssueMessage', 'msg', 'resolveLocalized']) {
      expect(i18n, name).toHaveProperty(name);
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
