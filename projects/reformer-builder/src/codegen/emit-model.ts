/**
 * Эмиттер `model.ts` — `createInitialValues` из `MockData.model` + фабрика `createModel`.
 *
 * @module reformer-builder/codegen/emit-model
 */

import type { MockData } from '../preview-runtime/mock-synth';
import type { Names } from './naming';

export function emitModel(mock: MockData, n: Names): string {
  const initial = JSON.stringify(mock.model, null, 2);
  return `// model.ts — начальные значения (из мока) + фабрика модели. Регенерируется.

import { createModel, type FormModel } from '@reformer/core';
import type { ${n.TypeName} } from './types';

export function createInitialValues(): ${n.TypeName} {
  return ${initial} as ${n.TypeName};
}

export function ${n.modelFactory}(initial?: Partial<${n.TypeName}>): FormModel<${n.TypeName}> {
  return createModel<${n.TypeName}>({ ...createInitialValues(), ...initial });
}
`;
}
