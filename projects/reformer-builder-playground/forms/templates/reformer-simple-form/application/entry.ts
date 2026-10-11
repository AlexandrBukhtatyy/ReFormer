// @reformer-generated 498ebdb07e2c
// application/entry.ts — запись формы в реестре форм (`@reformer/form-registry`).
// Регенерируется билдером; правки будут перезаписаны.

import type { FormEntry } from '@reformer/form-registry';
import { createReformerSimpleFormModel } from '../model/model';
import { createRegistry } from '../schema/registry';
import type { ReformerSimpleForm } from '../types/reformer-simple-form';
import { formValidation } from '../validation/form';
import { createFormBehavior, formSchema } from './create';
import type { SubmitOptions } from './submit';

/**
 * Запись формы «Reformer simple form» в реестре форм.
 *
 * Регистрация в приложении — одна строка:
 * ```ts
 * import { getFormRegistry } from '@reformer/form-registry';
 * import { reformerSimpleFormEntry } from './pages/demo/reformer-simple-form';
 *
 * getFormRegistry().register(reformerSimpleFormEntry);
 * ```
 *
 * После этого форма монтируется где угодно: `<FormOutlet id="reformer-simple-form" />`, либо через
 * слот или маршрут, если заполнить `placement`.
 */
export const reformerSimpleFormEntry: FormEntry<ReformerSimpleForm> = {
  id: 'reformer-simple-form',
  version: '1.0.0',
  // Кто зарегистрировал: по этому полю различаются одинаковые id из разных микрофронтов.
  owner: 'app', // TODO: имя вашего приложения-хоста

  // Данные — единственная часть, которую можно доставить по сети.
  schema: { kind: 'inline', value: formSchema },

  // Код — только из бандла.
  registry: { kind: 'inline', value: createRegistry() },
  model: { kind: 'inline', value: createReformerSimpleFormModel },
  // Фабрика: настройки места монтирования (`onResult`) хост передаёт пропом `behaviorOptions`.
  behavior: { kind: 'inline', value: (options) => createFormBehavior(options as SubmitOptions) },
  validation: { kind: 'inline', value: formValidation },

  // Где показывать. Пусто — форма доступна только по id; заполните, чтобы показывать её
  // в слоте хоста или на маршруте.
  placement: { slots: [], routes: ['/examples/reformer-simple-form'] },

  meta: {
    name: 'Reformer simple form',
    tags: ['renderer-json', 'form-registry'],
  },
};
