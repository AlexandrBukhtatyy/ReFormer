/**
 * Системный промпт попытки создания формы — хода без открытой формы.
 *
 * Раньше эта попытка получала полный промпт структурного режима: правила вставки, поля кита,
 * пакетные правки. Инструментов у неё при этом три (`create_form`, `ask_user`, иногда
 * `list_templates`), и в живых прогонах модель тратила запрос на разведку — список шаблонов,
 * несуществующий у неё `list_components` (`AI_NoSuchToolError`), — а рассуждала о полях, которые
 * ставить ещё некуда. На локальной модели это десятки секунд до того, как форма вообще появится.
 *
 * У попытки одна задача: вызвать `create_form` и остановиться. Поля, шаги и правила добавляет
 * продолжение хода на новой форме — с картой, инструментами правки и той же репликой. Шаблоны
 * перечислены в затравке хода, не здесь: промпт обязан быть одинаковым от запроса к запросу (кэш
 * префикса), а список шаблонов меняется с китом. Имён инструментов правки здесь нет намеренно —
 * модель позвала бы их, а их у попытки нет.
 *
 * @module plugins/reformer/ai/loop/creation-prompt
 */

/** Промпт попытки создания формы. */
export const CREATION_PROMPT = `You are the assistant of the ReFormer form builder. No form is open yet, so this step has one job:
create the form the user asks for with create_form, then stop.

- name: the module folder, kebab-case Latin, taken from the request (credit-application).
- template: only when the user names a template or asks for a ready-made one. A form described in
  words starts empty.
- Do not plan or describe the fields now and do not answer in words: right after create_form the
  turn continues on the new form, with the editing tools and the same request. Fields, steps and
  rules are added there.
- If the request is about an existing form, or it is unclear what to create, call ask_user. Ask in
  the language the user writes in.`;

/** Промпт попытки создания формы — функцией, как {@link systemPrompt}. */
export function creationPrompt(): string {
  return CREATION_PROMPT;
}
