/**
 * Кредитная заявка как ЗАПИСЬ РЕЕСТРА ФОРМ.
 *
 * Та же форма, что в `complex-multy-step-form-renderer-json` (тот остаётся образцом прямой сборки
 * из документа), и из тех же файлов: документ схемы и реестр компонентов импортируются оттуда,
 * модель, правила и поведение — из `complex-multy-step-form`. Отличие ровно одно: форма не
 * собирается на странице, а объявляется записью — страница лишь просит смонтировать её по `id`.
 * Сборку выполняет реестр, поэтому связка узлов (загрузка, отправка, навигация) приходит не полем
 * `setup`, а в составе поведения записи.
 *
 * Разложение по источникам показывает границу «данные / код», ради которой реестр и заведён:
 * документ схемы сериализуем и может приехать по сети (`kind: 'http'`), а реестр компонентов,
 * фабрика модели, правила и поведение — код и приходят только из бандла.
 *
 * @module react-playground/examples/complex-multy-step-form-registry/form-setup
 */

import type { FormEntry } from '@reformer/form-registry';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { creditApplicationRegistryBehavior } from '../complex-multy-step-form/application/renderer';
import { createCreditApplicationModel } from '../complex-multy-step-form/model/model';
import { creditApplicationValidation } from '../complex-multy-step-form/validation/form';
import type { CreditApplicationForm } from '../complex-multy-step-form/types/credit-application';
import rawJsonSchema from '../complex-multy-step-form-renderer-json/form.schema.json';
import { createCreditApplicationRegistry } from '../complex-multy-step-form-renderer-json/registry';

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

  // Код. Поведение записи — правила заявки и связка узлов схемы (загрузка, отправка, навигация).
  // Форму и валидацию визард берёт из сборки сам — доносить их до узла отдельным слоем не нужно.
  registry: { kind: 'inline', value: createCreditApplicationRegistry() },
  model: { kind: 'inline', value: createCreditApplicationModel },
  behavior: { kind: 'inline', value: creditApplicationRegistryBehavior({ applicationId: '1' }) },
  validation: { kind: 'inline', value: creditApplicationValidation },

  meta: {
    name: 'Кредитная заявка (реестр форм)',
    description: 'Шестишаговый визард из JSON-схемы, смонтированный через реестр форм',
    tags: ['renderer-json', 'form-registry', 'wizard', 'validation'],
  },
};
