/**
 * Compile-time тест типизации `createForm`. Проверяется `tsc` (файл под `src`,
 * `include: ["src"]`); vitest его НЕ запускает — нет суффикса `.test.`.
 *
 * Убеждается, что тип `validation` в бандле выводится из конфига: правила переданы — поле есть
 * всегда; не переданы — оно необязательное. Раньше ради этого сужения держали отдельный файл
 * сборки.
 */

import type { FormModel } from '../model/types';
import { createForm } from './form-bundle';
import type { FormBehavior } from './behaviors';
import type { FormSchemaNode } from './types/schema-node';
import type { FormValidation, FormValidationBundle } from './validation/config';
import type { ValidationSchema } from './validation';

interface Shape {
  email: string;
}

declare const rules: ValidationSchema<Shape>;
declare const steps: FormValidation<Shape>;
declare const behavior: FormBehavior<Shape>;
declare const schema: (model: FormModel<Shape>) => FormSchemaNode;

export function createFormTypeChecks(): void {
  const withSchema: FormValidationBundle<Shape> = createForm<Shape>({
    initial: { email: '' },
    schema,
    behavior,
    validation: rules,
  }).validation;
  const withSteps: FormValidationBundle<Shape> = createForm<Shape>({
    initial: { email: '' },
    validation: steps,
  }).validation;

  const plain = createForm<Shape>({ initial: { email: '' }, schema });
  // @ts-expect-error — правил в конфиге нет: валидации в бандле может не быть
  const missing: FormValidationBundle<Shape> = plain.validation;
  // `setup` получает бандл целиком — с деревом для рендера.
  createForm<Shape>({ initial: { email: '' }, setup: (bundle) => void bundle.render.tree });

  void [withSchema, withSteps, missing];
}
