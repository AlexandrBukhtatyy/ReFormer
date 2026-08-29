/**
 * Эмиттер `validation.ts`.
 *
 * Один эмиттер на две ветки, и это отличие от v1. Там развилка «правила или заглушка» стояла
 * в списке файлов (`buildExampleFiles`), то есть тот, кто добавлял файл, обязан был помнить и
 * про неё. Здесь она внутри: цель одна, файл один, а чем он заполнен — дело эмиттера.
 *
 * Ветка «нет правил» не пустая: `required` выводится из схемы, поэтому форма, у которой правил
 * не задавали, всё равно уезжает с работающей обязательностью полей.
 *
 * @module reformer-builder/lib/codegen/emit/validation
 */

import { hasValidationRules } from '../../form-model/rules';
import type { EmitContext } from '../context';
import { validationFromRules } from './rules-bridge';

export function emitValidation(ctx: EmitContext): string {
  if (hasValidationRules(ctx.rules)) return validationFromRules(ctx.rules, ctx.names);

  const { TypeName } = ctx.names;
  const paths = [...new Set(ctx.collected.requiredPaths)];
  const hasRules = paths.length > 0;

  const rules = paths
    .map((p) => `    validate(model.$.${p}, [required({ message: 'Обязательное поле' })]);`)
    .join('\n');

  const imports = hasRules
    ? `import { validate, defineValidationSchema, validateModel } from '@reformer/core/validation';
import { required } from '@reformer/core/validators';`
    : `import { defineValidationSchema, validateModel } from '@reformer/core/validation';`;

  const callback = hasRules
    ? `({ model }) => {\n${rules}\n  }`
    : `() => {\n    // TODO: правила валидации\n  }`;

  return `// validation.ts — валидация модели. МОК: required выведены из схемы, допишите правила.
// Пишется один раз и при регенерации не затирается.

import { type FormModel } from '@reformer/core';
${imports}
import type { ${TypeName} } from './types';

type Root = ${TypeName};

export const formValidation = defineValidationSchema<Root>(${callback});

/** Пошаговый контракт визарда. Полная проверка — validateModel(model, formValidation). */
export function makeValidationConfig(model: FormModel<Root>) {
  return {
    validateStep: (_step: number): Promise<boolean> => validateModel(model, formValidation),
    validateAll: (): Promise<boolean> => validateModel(model, formValidation),
  };
}
`;
}
