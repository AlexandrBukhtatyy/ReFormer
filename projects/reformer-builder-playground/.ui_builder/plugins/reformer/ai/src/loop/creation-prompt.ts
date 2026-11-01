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
 * ## Существующая форма — в затравке, не здесь
 *
 * Попытка идёт и тогда, когда человек просит править существующую форму, не стоя на её вкладке:
 * тогда у неё есть `choose_form` (выбирает человек). Но только если формы в проекте есть — поэтому
 * указание «существующая форма → choose_form» и список форм приходят затравкой моста, а промпт
 * говорит общее: реши, о какой форме просьба, и остановись.
 *
 * @module plugins/reformer/ai/loop/creation-prompt
 */

/** Промпт попытки создания формы. */
export const CREATION_PROMPT = `You are the assistant of the ReFormer form builder. The user is not on a form, so this step has one
job: settle which form the request is about, then stop. For a new form call create_form:

- name: the module folder, kebab-case Latin, taken from the request (credit-application).
- template: only when the user names a template or asks for a ready-made one. A form described in
  words starts empty.
- Do not plan or describe the fields now and do not answer in words: right after this step the
  turn continues on the form, with the editing tools and the same request. Fields, steps and
  rules are added there.
- If it is unclear what to create, call ask_user. Ask in the language the user writes in.`;

/** Промпт попытки создания формы — функцией, как {@link systemPrompt}. */
export function creationPrompt(): string {
  return CREATION_PROMPT;
}
