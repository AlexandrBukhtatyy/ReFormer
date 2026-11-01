/**
 * `choose_form` — работать с существующей формой, когда ход не знает, с какой.
 *
 * Ход начался без формы: вкладка — не форма и не файл её модуля, и в панели ничего не закреплено.
 * Модель решает одно — новая это форма (`create_form`) или существующая. Какая именно существующая,
 * решает человек: модель сама формы не выбирает, поэтому параметров у инструмента нет. Мост берёт
 * единственную форму проекта сразу, а из нескольких спрашивает карточкой со всеми формами — не
 * `ask_user`, у которого вариантов не больше четырёх.
 *
 * Как и `create_form`, успешный выбор заканчивает попытку: мост открывает форму в фоне и продолжает
 * тот же ход на ней — с её картой и инструментами правки.
 *
 * @module plugins/forms/ai/tools/choose-form
 */

import { formToolFail, formToolOk, type FormAgentTool } from '@reformer/builder-plugin-api';

export const chooseFormTool: FormAgentTool<Record<string, never>> = {
  name: 'choose_form',
  description:
    'Work on an existing form of the project: the user picks which one, and the turn ' +
    'continues on it.',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  // Черновик не меняет, но уводит ход на другую форму — для гейта это правка, а не чтение.
  readOnly: false,
  async run(_params, ctx) {
    const choose = ctx.turn?.chooseForm;
    if (choose === undefined) {
      return formToolFail('UNAVAILABLE', 'Choosing a form is not available in this builder.');
    }
    const outcome = await choose();
    if (!outcome.ok) return formToolFail(outcome.code, outcome.message, outcome.suggestions);
    return formToolOk(`The user chose ${outcome.path}. This turn continues on it — stop here.`);
  },
};
