/**
 * Эмиттер `validation.ts` (user-owned) — `required`-правила из `componentProps.required` +
 * `makeValidationConfig`. При отсутствии required — пустая схема (форма валидна).
 *
 * @module reformer-builder/codegen/emit-validation
 */

import type { Collected } from './collect';
import type { Names } from './naming';

export function emitValidation(c: Collected, n: Names): string {
  const paths = [...new Set(c.requiredPaths)];
  const hasRules = paths.length > 0;

  const rules = paths
    .map((p) => `    validate(model.$.${p}, [required({ message: 'Обязательное поле' })]);`)
    .join('\n');

  const imports = hasRules
    ? `import { validate, defineValidationSchema, validateModel } from '@reformer/core/validation';
import { required } from '@reformer/core/validators';`
    : `import { defineValidationSchema, validateModel } from '@reformer/core/validation';`;

  const cb = hasRules
    ? `({ model }) => {\n${rules}\n  }`
    : `() => {\n    // TODO: правила валидации\n  }`;

  return `// validation.ts — валидация модели. МОК: required выведены из схемы; допишите правила.
// Пишется один раз (не затирается при регенерации).

import { type FormModel } from '@reformer/core';
${imports}
import type { ${n.TypeName} } from './types';

type Root = ${n.TypeName};

const schema = defineValidationSchema<Root>(${cb});

/** Контракт валидации для формы (при желании — разбейте по шагам). */
export function makeValidationConfig(model: FormModel<Root>) {
  return {
    validateStep: (_step: number): Promise<boolean> => validateModel(model, schema),
    validateAll: (): Promise<boolean> => validateModel(model, schema),
  };
}
`;
}
