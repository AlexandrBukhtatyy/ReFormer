/**
 * Кредитная заявка как ЗАПИСЬ РЕЕСТРА ФОРМ.
 *
 * Копия `complex-multy-step-form-renderer-json` (тот остаётся образцом прямого использования
 * `renderer-json`). Отличие ровно одно: форма не собирается на странице, а объявляется записью —
 * страница лишь просит смонтировать её по `id`.
 *
 * Разложение по источникам показывает границу «данные / код», ради которой реестр и заведён:
 * схема сериализуема и на этапе 2 сможет приехать по сети (`kind: 'http'`), а реестр компонентов,
 * поведение, фабрика модели и render-behavior — код и приходят только из бандла.
 *
 * @module react-playground/examples/complex-multy-step-form-registry/form-setup
 */

import type { FormEntry } from '@reformer/form-registry';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { createCreditApplicationModel } from '../complex-multy-step-form/schemas/model';
import { creditApplicationBehavior } from '../complex-multy-step-form/schemas/behavior';
import type { CreditApplicationForm } from '../complex-multy-step-form/types/credit-application';
import rawJsonSchema from './json-schema.json';
import { createCreditApplicationRegistry } from './registry';
import { createCreditApplicationJsonRenderBehavior } from './render-behavior';

// Чистый JSON импортируется как данные; операторы-строки (`$model(...)`) типизируются как
// `string`, поэтому приводим к `JsonFormSchema` — это и есть сценарий «схема пришла с сервера».
const creditApplicationJsonSchema =
  rawJsonSchema as unknown as JsonFormSchema<CreditApplicationForm>;

export const creditApplicationFormEntry: FormEntry<CreditApplicationForm> = {
  id: 'credit-application',
  version: '1.0.0',
  owner: 'react-playground',

  // Данные.
  schema: { kind: 'inline', value: creditApplicationJsonSchema },

  // Код.
  registry: { kind: 'inline', value: createCreditApplicationRegistry() },
  model: { kind: 'inline', value: createCreditApplicationModel },
  behavior: { kind: 'inline', value: creditApplicationBehavior },
  // Визард — рантайм-сущность: JSON-схема не выражает ни `FormProxy`, ни конфиг валидации,
  // поэтому и то и другое инъектится в узел `wizard` через `onInit` внутри render-behavior.
  renderBehavior: { kind: 'inline', value: createCreditApplicationJsonRenderBehavior },

  meta: {
    name: 'Кредитная заявка (реестр форм)',
    description: 'Шестишаговый визард из JSON-схемы, смонтированный через реестр форм',
    tags: ['renderer-json', 'form-registry', 'wizard', 'validation'],
  },
};
