/**
 * In-form валидация данных: `validateFormModel(model, schema)` (архитектура M1) — **form**-слой.
 *
 * Прогоняет тот же headless-движок ({@link module:core/model/validate-model-core}), но роутит ошибки
 * в ноды формы через реестр сигнал→нода. Реестр — единственная зависимость от form-слоя (граница
 * state⇏form проходит здесь). Headless-варианты (`validateModel`/`validateModelSync`) реэкспортируются
 * из ядра для обратной совместимости — состав экспортов этого модуля не изменился.
 *
 * @group Model
 * @module core/model/validate-model
 */

import { getNodeForSignal } from './signal-node-registry';
import type { FormSchemaNode } from './types/schema-node';
import type { FormModel } from '../state/types';
import {
  collect,
  runTasks,
  hasBlockingErrors,
  type ModelValidationResult,
} from './validate-model-core';

// Re-export headless-движка (обратная совместимость: раньше эти символы жили здесь).
export { validateModel, validateModelSync } from './validate-model-core';
export type { ModelValidator, ModelValidationResult } from './validate-model-core';

/**
 * In-form валидация: прогоняет {@link validateModel} и роутит ошибки в ноды формы
 * (через реестр сигнал→нода): `node.setErrors(errors[path] ?? [])` — заодно очищает прошедшие поля
 * И поля выключенных веток (`{ when, children }` с ложным условием). Дерево обходится ОДИН раз.
 *
 * @group Model
 * @param model - Модель данных ({@link FormModel}) — источник значений полей.
 * @param schema - Единая схема формы (та же, что передавалась в `createForm`).
 * @returns {@link ModelValidationResult} — `valid` + ошибки по пути поля; побочный эффект — ошибки
 *   разведены по нодам формы.
 * @remarks Поля, не материализованные в форме (элементы массива — строятся per-item), не роутятся
 * в родительскую форму; их ошибки доступны в возвращаемом результате по пути.
 *
 * @example Валидация перед submit (ошибки показываются в UI автоматически)
 * ```typescript
 * const form = createForm({ model, schema });
 * form.touchAll();
 * const res = await validateFormModel(model, schema);
 * if (res.valid) await api.save(model.get());
 * ```
 */
export async function validateFormModel<T>(
  model: FormModel<T>,
  schema: FormSchemaNode
): Promise<ModelValidationResult> {
  const { tasks, clearSignals } = collect(model, schema);
  const errors = await runTasks(tasks, model);
  for (const { signal } of tasks) {
    getNodeForSignal(signal)?.setErrors(errors[signal.__path] ?? []);
  }
  for (const signal of clearSignals) {
    getNodeForSignal(signal)?.setErrors([]);
  }
  return { valid: !hasBlockingErrors(errors), errors };
}
