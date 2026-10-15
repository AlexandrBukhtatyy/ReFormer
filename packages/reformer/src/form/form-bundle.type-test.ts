/**
 * Compile-time тест типизации `createForm`. Проверяется `tsc` (файл под `src`,
 * `include: ["src"]`); vitest его НЕ запускает — нет суффикса `.test.`.
 *
 * Убеждается, что уровень формы в бандле типизирован: результат отправки — объединение статусов,
 * `result` есть только у отправленной формы, поток шагов — необязательный.
 */

import type { FormModel } from '../model/types';
import { createForm } from './form-bundle';
import type { FormBehavior } from './behaviors';
import type { FormSchemaNode } from './types/schema-node';
import type { FormFlow } from './flow/flow';
import type { SubmitResult } from './submission';
import type { ValidationDefinition, ValidationResult } from './validation';

interface Shape {
  email: string;
}

declare const rules: ValidationDefinition<Shape>;
declare const behavior: FormBehavior<Shape>;
declare const schema: (model: FormModel<Shape>) => FormSchemaNode;

export async function createFormTypeChecks(): Promise<void> {
  const bundle = createForm<Shape>({
    initial: { email: '' },
    schema,
    behavior,
    validation: { extras: rules },
    flow: { steps: [{ id: 'contacts', rules }, { id: 'confirm' }] },
  });

  const sent: SubmitResult<number> = await bundle.submission.submit(
    (values) => values.email.length
  );
  if (sent.status === 'submitted') {
    const length: number = sent.result;
    void length;
  } else if (sent.status === 'failed') {
    void sent.error;
  } else {
    const validation: ValidationResult = sent.validation;
    void validation;
  }
  // @ts-expect-error — у непрошедшей проверку отправки результата обработчика нет
  void sent.result;

  // @ts-expect-error — поток есть не у каждой сборки
  const flow: FormFlow = bundle.flow;
  const step: ValidationResult = await bundle.validateStep('contacts');

  // @ts-expect-error — шаги потока — массив с идентификаторами, а не запись по ключам
  createForm<Shape>({ initial: { email: '' }, flow: { steps: { contacts: rules } } });

  // `setup` получает бандл целиком — с деревом для рендера.
  createForm<Shape>({ initial: { email: '' }, setup: (built) => void built.render.tree });

  void [flow, step];
}
