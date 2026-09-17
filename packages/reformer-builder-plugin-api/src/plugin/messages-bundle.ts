/**
 * Файл словаря плагина: `locales/ru.json` и соседи.
 *
 * Один разбор на загрузчик оболочки и `reformer-plugin validate` — по той же причине, что
 * и разбор манифеста.
 *
 * @module @reformer/builder-plugin-api/plugin/messages-bundle
 */

/**
 * Разбирает файл словаря: плоский объект «ключ → строка», и ничего больше.
 *
 * Вложенные объекты не разворачиваются сознательно: ключ у нас и так составной
 * (`command.format`), и второй способ записать тот же ключ дал бы словарь, в котором промах
 * ищется в двух местах. Отказ возвращается ПРИЧИНОЙ, а не готовой проблемой: файл и локаль
 * знает только вызывающий, и собирать сообщение дважды незачем.
 */
export function parseMessagesBundle(
  text: string
):
  | { ok: true; bundle: Readonly<Record<string, string>> }
  | { ok: false; reason: string; cause?: unknown } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (cause) {
    return { ok: false, reason: 'не разбирается как JSON', cause };
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, reason: 'должен быть объектом JSON' };
  }
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== 'string') {
      return {
        ok: false,
        reason: `ключ «${key}» — не строка, а словарь обязан быть плоским «ключ → строка»`,
      };
    }
  }
  return { ok: true, bundle: raw as Record<string, string> };
}
