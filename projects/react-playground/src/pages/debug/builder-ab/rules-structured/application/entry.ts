// @reformer-generated 55247bbc484e
// application/entry.ts — запись формы в реестре форм (`@reformer/form-registry`).
// Регенерируется билдером; правки будут перезаписаны.

import type { FormEntry } from '@reformer/form-registry';
import { formFlow } from '../flow/reformer-multi-step-form-flow';
import { createReformerMultiStepFormModel } from '../model/model';
import { createRegistry } from '../schema/registry';
import type { ReformerMultiStepForm } from '../types/reformer-multi-step-form';
import { formValidation } from '../validation/form';
import { createFormBehavior, formSchema } from './create';
import type { SubmitOptions } from './submit';

/**
 * Запись формы «Reformer multi step form» в реестре форм.
 *
 * Регистрация в приложении — одна строка:
 * ```ts
 * import { getFormRegistry } from '@reformer/form-registry';
 * import { reformerMultiStepFormEntry } from './pages/demo/reformer-multi-step-form';
 *
 * getFormRegistry().register(reformerMultiStepFormEntry);
 * ```
 *
 * После этого форма монтируется где угодно: `<FormOutlet id="reformer-multi-step-form" />`, либо через
 * слот или маршрут, если заполнить `placement`.
 */
export const reformerMultiStepFormEntry: FormEntry<ReformerMultiStepForm> = {
  id: 'reformer-multi-step-form',
  version: '1.0.0',
  // Кто зарегистрировал: по этому полю различаются одинаковые id из разных микрофронтов.
  owner: 'app', // TODO: имя вашего приложения-хоста

  // Данные — единственная часть, которую можно доставить по сети.
  schema: { kind: 'inline', value: formSchema },

  // Код — только из бандла.
  registry: { kind: 'inline', value: createRegistry() },
  model: { kind: 'inline', value: createReformerMultiStepFormModel },
  // Фабрика: настройки места монтирования (`onResult`) хост передаёт пропом `behaviorOptions`.
  behavior: { kind: 'inline', value: (options) => createFormBehavior(options as SubmitOptions) },
  validation: { kind: 'inline', value: formValidation },
  flow: { kind: 'inline', value: formFlow },

  // Где показывать. Пусто — форма доступна только по id; заполните, чтобы показывать её
  // в слоте хоста или на маршруте.
  placement: { slots: [], routes: ['/examples/reformer-multi-step-form'] },

  meta: {
    name: 'Reformer multi step form',
    tags: ['renderer-json', 'form-registry'],
  },
};
