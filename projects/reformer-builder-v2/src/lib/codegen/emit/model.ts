/**
 * Эмиттер `model.ts` — `createInitialValues` из мока плюс фабрика модели.
 *
 * @module reformer-builder/lib/codegen/emit/model
 */

import type { EmitContext } from '../context';

export function emitModel(ctx: EmitContext): string {
  const { names, mock } = ctx;
  const initial = JSON.stringify(mock.model, null, 2);
  return `// model.ts — начальные значения (из мока) и фабрика модели. Регенерируется.

import { createModel, type FormModel } from '@reformer/core';
import type { ${names.TypeName} } from './types';

export function createInitialValues(): ${names.TypeName} {
  return ${initial} as ${names.TypeName};
}

export function ${names.modelFactory}(
  initial?: Partial<${names.TypeName}>
): FormModel<${names.TypeName}> {
  return createModel<${names.TypeName}>({ ...createInitialValues(), ...initial });
}
`;
}
