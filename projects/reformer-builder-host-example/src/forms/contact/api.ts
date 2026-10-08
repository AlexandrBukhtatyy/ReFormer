// api.ts — бэкенд формы (submit). Пишется один раз и при регенерации не затирается.

import { notify } from '../../notifications/notifications';
import { sendContactRequest } from '../../services/contact-requests';
import type { ContactForm } from './types';

export type ApiResult<T> = { success: true; data: T } | { success: false; error: string };

/** POST — отправка формы в API приложения; итог показывает уведомление приложения. */
export async function submitForm(values: ContactForm): Promise<ApiResult<{ id: string }>> {
  try {
    const data = await sendContactRequest({
      name: values.name,
      email: values.email,
      city: values.city,
    });
    notify(`Обращение ${data.id} принято`);
    return { success: true, data };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    notify(reason, 'error');
    return { success: false, error: reason };
  }
}
