// @reformer-generated bfa62bfd8169
// application/entry.ts — запись формы в реестре форм (`@reformer/form-registry`).
// Регенерируется билдером; правки будут перезаписаны.

import type { FormEntry } from '@reformer/form-registry';
import { createContactHexaFormModel } from '../model/model';
import { createRegistry } from '../schema/registry';
import type { ContactHexaForm } from '../types/contact-hexa';
import { formValidation } from '../validation/form';
import { createFormBehavior, formSchema } from './create';
import type { SubmitOptions } from './submit';

/**
 * Запись формы «Обратная связь на HexaUI» в реестре форм.
 *
 * Регистрация в приложении — одна строка:
 * ```ts
 * import { getFormRegistry } from '@reformer/form-registry';
 * import { contactHexaFormEntry } from './pages/demo/contact-hexa';
 *
 * getFormRegistry().register(contactHexaFormEntry);
 * ```
 *
 * После этого форма монтируется где угодно: `<FormOutlet id="contact-hexa" />`, либо через
 * слот или маршрут, если заполнить `placement`.
 */
export const contactHexaFormEntry: FormEntry<ContactHexaForm> = {
  id: 'contact-hexa',
  version: '1.0.0',
  // Кто зарегистрировал: по этому полю различаются одинаковые id из разных микрофронтов.
  owner: 'app', // TODO: имя вашего приложения-хоста

  // Данные — единственная часть, которую можно доставить по сети.
  schema: { kind: 'inline', value: formSchema },

  // Код — только из бандла.
  registry: { kind: 'inline', value: createRegistry() },
  model: { kind: 'inline', value: createContactHexaFormModel },
  // Фабрика: настройки места монтирования (`onResult`) хост передаёт пропом `behaviorOptions`.
  behavior: { kind: 'inline', value: (options) => createFormBehavior(options as SubmitOptions) },
  validation: { kind: 'inline', value: formValidation },

  // Где показывать. Пусто — форма доступна только по id; заполните, чтобы показывать её
  // в слоте хоста или на маршруте.
  placement: { slots: [], routes: ['/examples/contact-hexa'] },

  meta: {
    name: 'Обратная связь на HexaUI',
    tags: ['renderer-json', 'form-registry'],
  },
};
