// @reformer-generated ae82f0d0e96f
// application/entry.ts — запись формы в реестре форм (`@reformer/form-registry`).
// Регенерируется билдером; правки будут перезаписаны.

import type { FormEntry } from '@reformer/form-registry';
import { createContactFormModel } from '../model/model';
import { createRegistry } from '../schema/registry';
import type { ContactForm } from '../types/contact';
import { formValidation } from '../validation/form';
import { createFormBehavior, formSchema } from './create';
import type { SubmitOptions } from './submit';

/**
 * Запись формы «Обратная связь» в реестре форм.
 *
 * Регистрация в приложении — одна строка:
 * ```ts
 * import { getFormRegistry } from '@reformer/form-registry';
 * import { contactFormEntry } from './pages/demo/contact';
 *
 * getFormRegistry().register(contactFormEntry);
 * ```
 *
 * После этого форма монтируется где угодно: `<FormOutlet id="contact" />`, либо через
 * слот или маршрут, если заполнить `placement`.
 */
export const contactFormEntry: FormEntry<ContactForm> = {
  id: 'contact',
  version: '1.0.0',
  // Кто зарегистрировал: по этому полю различаются одинаковые id из разных микрофронтов.
  owner: 'app', // TODO: имя вашего приложения-хоста

  // Данные — единственная часть, которую можно доставить по сети.
  schema: { kind: 'inline', value: formSchema },

  // Код — только из бандла.
  registry: { kind: 'inline', value: createRegistry() },
  model: { kind: 'inline', value: createContactFormModel },
  // Фабрика: настройки места монтирования (`onResult`) хост передаёт пропом `behaviorOptions`.
  behavior: { kind: 'inline', value: (options) => createFormBehavior(options as SubmitOptions) },
  validation: { kind: 'inline', value: formValidation },

  // Где показывать. Пусто — форма доступна только по id; заполните, чтобы показывать её
  // в слоте хоста или на маршруте.
  placement: { slots: [], routes: ['/examples/contact'] },

  meta: {
    name: 'Обратная связь',
    tags: ['renderer-json', 'form-registry'],
  },
};
