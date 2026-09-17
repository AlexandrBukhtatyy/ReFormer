/**
 * Настоящий архив npm — фикстура для разбора пакета.
 *
 * Сделан `reformer-plugin pack` (то есть `npm pack` под ним) из плагина, который создаёт
 * `reformer-plugin create`: манифест, `src/main.ts`, два словаря, `package.json`. Проверять
 * разбор чужого формата на архиве, собранном нашим же кодом разбора, значило бы проверять
 * согласие кода с самим собой; здесь архив сделан ТЕМ, кто такие архивы делает в жизни.
 *
 * Base64, а не бинарный файл рядом: тысяча байт в `git diff` видна как изменение, бинарь —
 * как «файл изменился». Подпись посчитана от тех же байтов.
 *
 * @module shell/platform/plugin/npm/__fixtures__/tarball
 */

/** `acme-hello-0.1.0.tgz`, 1065 байт. */
const BASE64 =
  'H4sIAAAAAAAC/+1XzW7bRhDWmU8x5iGgCppa2ZYMyFDRoj0ULdoUKNCLkQprciivTXLZ3aVjwRHg+JJbeu9TGC5cGDGSvMLy' +
  'jYrljyhLCdJDbCQB5yCKM7M7PzvfzjCl/jGdYi+mLPGOZOc+iBAy3NmBd/EJIVuD3QF0tgdD0u8Ph2QHOqRPBoNt6JDOA1Am' +
  'FRUdQj5CkIQQWDw/E7IziSCVYL6y96wTKmAyCTD8VfAUxvD44Ah95QUYsgQND4Wa1WpTVI+fJob7PUq/0W74RtvIBEsVF+vr' +
  'fqExyvctLIT1mkMqK1GjngquuJql6DXSZf/wNOVCwRgcRcUUlQs0irow/hrOLICQC3CMYkJjBJYUQgsAmgQs1hkVF85gimpk' +
  '9PYN44kLmGQxCnoQ4QiUyBDm3T1rXtv3eToz28jCBe5CKHjsAp76mCoXApT+whsWgmPE8OgRmJB4WGjDeDwGmxfx2vDs2bos' +
  'zBJfMZ7Y3WKfKq4IFRzjDHi4nu/CTrcMtTS8sZxfz6dRVLh7jLOu8cdstDEeV47XC+/kqdRepMgp4jJ29o9xtpKoDScoy2W1' +
  'gpwyP8Zs18Rq1LxmZZFcgLkFIFBlIgHFl7Kt+Hc8jnny428m3TEPCh+WTsFp/D2bu2BPJih/5kEWoW0cP6FR1hyjC2aHPcvq' +
  '9UAKv7welSxsmf9VcZmjPZvvWXWxOcsytziRAEOaRYukFAoVzzIRxYULXrPfcih39uuWobLYvE0OMhYFKCZplE1ZMqEpgzEI' +
  '/DNjAh37G4EhFzGKXqW3Wept0pTZ1UbLrpicEff9e9dXQMHoOkXJBiOwqR/j5iFGEbddC4D6ip1QhY6vTuuC9NWpJ7OD8hZg' +
  'PJFemslDpyojI/V5HNMkkJ7AKZMKhXO2KLIVK15jq6ReD/Tf+jZ/mb+A/Lm+1W/0lb7Mz/O/QL/Vt/pS/6Nv9Gt96YK+BP1a' +
  'X0N+oa/1q/x5fjEC85uf6zf6lb4Bfauv9b/6Mr8AfQUR92mEsveVdyR54i0sKqYi/AlnI7Arx9ecEllSn7epp4o/L6FTVbE5' +
  '+0/g/k+r/l9Hi0kR7gP2f0JMr7/b/7f6ZiZo+//9k0HaSh2PwP7WjxF+MG8jKJnW3Oq09OVRupj/ExaiVB8f/R/E//b27ir+' +
  '+7vDnRb/D4Z/Ftjrvdw2Q+7dy6Dkn6CQZuIcgU28vkdKLk3Z743gj37JNTOGea8+L0umzxMl2EGmUNqjakqwY5SSTpc4ALbI' +
  'zNq6NYmsKM5Fn7UxWRZXncsupPOyx7Z31v/Ff/W8D/h/CP99I1vB/2Cn7f8Ph/8a6as3wLuRfoyzp1wEBqn7JXbrj43Nux8b' +
  'BopPWhB+FvhfuWQfdP4fbq3N/1tb/Rb/n8b8r9/m5/pGX+nr/KL9DGippZZa+lLoP7xRZmQAHAAA';

/** Подпись архива в формате SRI — та же, что отдал бы реестр в `dist.integrity`. */
export const FIXTURE_INTEGRITY =
  'sha512-Hl/TcyTFW3RQd+9gjToSawCbdMIOCuaCx3qwt/ruDbZdWR5/Q2M1mRoPefQsJcuEz8oYevrmwtvMbNxyw5JxaA==';

/** Байты архива. Новый массив на каждый вызов: разбор вправе его не щадить. */
export function fixtureTarball(): Uint8Array {
  const binary = atob(BASE64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
