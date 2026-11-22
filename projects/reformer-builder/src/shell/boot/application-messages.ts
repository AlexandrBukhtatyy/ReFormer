/**
 * Тексты, которыми приложение называет себя, — поверх словаря оболочки.
 *
 * Оболочка — база для разных приложений: имени у неё нет, и ключи `app.title`
 * и `shell.help.about.description` в её словаре нейтральны. Приложение приносит свои тексты
 * вместе с составом, и они ложатся ПОВЕРХ словаря оболочки — тем же загрузчиком, которым словарь
 * приезжает: отдельного «вклада в словарь Host» у корня локализации нет и быть не должно.
 *
 * Перекрыть можно только ключи из закрытого списка. Приложение представляется, а не
 * переписывает оболочку: «Сохранить», переименованное составом, было бы уже другой оболочкой.
 *
 * @module shell/boot/application-messages
 */

import { APPLICATION_MESSAGE_KEYS, type ApplicationMessages } from './composition';

type HostMessages = Readonly<Record<string, string>>;

/**
 * Загрузчик словаря оболочки, дополненный текстами приложения.
 *
 * @param load загрузчик словаря оболочки для локали
 * @param messages тексты приложения; без них словарь отдаётся как есть
 */
export function hostMessagesWith(
  load: (locale: string) => Promise<HostMessages>,
  messages: ApplicationMessages | undefined
): (locale: string) => Promise<HostMessages> {
  if (messages === undefined) return load;
  const allowed = new Set(APPLICATION_MESSAGE_KEYS);
  return async (locale) => {
    const host = await load(locale);
    const own = messages[locale];
    if (own === undefined) return host;
    const accepted: Record<string, string> = {};
    for (const [key, text] of Object.entries(own)) {
      if (allowed.has(key)) accepted[key] = text;
      else {
        console.warn(
          `[boot] состав приложения называет ключ «${key}» — приложению принадлежат только ` +
            `${APPLICATION_MESSAGE_KEYS.join(', ')}; ключ пропущен`
        );
      }
    }
    return { ...host, ...accepted };
  };
}
