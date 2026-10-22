// @reformer-generated e2b56a6ef050
// application/entry.ts — запись формы в реестре форм (`@reformer/form-registry`).
// Регенерируется билдером; правки будут перезаписаны.

import type { FormEntry } from '@reformer/form-registry';
import { formFlow } from '../flow/credit-application-flow';
import { createCreditApplicationFormModel } from '../model/model';
import { createRegistry } from '../schema/registry';
import type { CreditApplicationForm } from '../types/credit-application';
import { formValidation } from '../validation/form';
import { createFormBehavior, formSchema } from './create';
import type { SubmitOptions } from './submit';

/**
 * Запись формы «Credit application» в реестре форм.
 *
 * Регистрация в приложении — одна строка:
 * ```ts
 * import { getFormRegistry } from '@reformer/form-registry';
 * import { creditApplicationFormEntry } from './pages/demo/credit-application';
 *
 * getFormRegistry().register(creditApplicationFormEntry);
 * ```
 *
 * После этого форма монтируется где угодно: `<FormOutlet id="credit-application" />`, либо через
 * слот или маршрут, если заполнить `placement`.
 */
export const creditApplicationFormEntry: FormEntry<CreditApplicationForm> = {
  id: 'credit-application',
  version: '1.0.0',
  // Кто зарегистрировал: по этому полю различаются одинаковые id из разных микрофронтов.
  owner: 'app', // TODO: имя вашего приложения-хоста

  // Данные — единственная часть, которую можно доставить по сети.
  schema: { kind: 'inline', value: formSchema },

  // Код — только из бандла.
  registry: { kind: 'inline', value: createRegistry() },
  model: { kind: 'inline', value: createCreditApplicationFormModel },
  // Фабрика: настройки места монтирования (`onResult`) хост передаёт пропом `behaviorOptions`.
  behavior: { kind: 'inline', value: (options) => createFormBehavior(options as SubmitOptions) },
  validation: { kind: 'inline', value: formValidation },
  flow: { kind: 'inline', value: formFlow },

  // Где показывать. Пусто — форма доступна только по id; заполните, чтобы показывать её
  // в слоте хоста или на маршруте.
  placement: { slots: [], routes: ['/examples/credit-application'] },

  meta: {
    name: 'Credit application',
    tags: ['renderer-json', 'form-registry'],
  },
};
