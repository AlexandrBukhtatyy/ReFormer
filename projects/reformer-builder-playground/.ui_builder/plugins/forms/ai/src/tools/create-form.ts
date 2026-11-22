/**
 * `create_form` — новая форма по просьбе пользователя.
 *
 * ## Почему ход переходит на новую форму сам
 *
 * Черновик хода — форма, с которой ход начался, и правки после создания легли бы в неё, а не в
 * новую. Поэтому успешный `create_form` заканчивает попытку: мост открывает новую форму и
 * продолжает тот же ход на ней — с её картой и теми же инструментами. Ход без открытой формы
 * начинается с одних этих инструментов: править ещё нечего.
 *
 * ## Форма ассистента всегда пустая
 *
 * Модуль кладёт плагин шаблонов тем же путём, что окно «Создать форму» (`<каталог>/<имя>/`), но
 * без шаблона: один документ формы с пустым корнем. Содержимое формы ход собирает сам, по
 * описанию, `build_form` в продолжении хода.
 *
 * Раньше у инструмента был параметр `template`, а затравка хода без формы перечисляла шаблоны.
 * Небольшая модель брала шаблон и для формы, описанной словами («пошаговая форма» — это и имя
 * встроенного шаблона), а затем перекраивала образец: встроенные шаблоны несут по полю каждого
 * вида, правила, источники данных и вычисления, и всё это приходилось вычищать. Каждая такая
 * правка — шанс оставить правило на удалённое поле или поле образца в форме (ReFormer-u7g0).
 * Поэтому шаблонов ассистент не видит и выбрать не может; форма из шаблона — решение человека,
 * в окне «Создать форму».
 *
 * @module plugins/forms/ai/tools/create-form
 */

import { formToolFail, formToolOk, type FormAgentTool } from '@reformer/builder-plugin-api';

/** Имя модуля — имя его каталога и основа имён в коде: латиница в kebab-case. */
const MODULE_NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/**
 * Имя модуля из того, что прислала модель. Небольшая модель пишет путь по образцу открытой формы —
 * `forms/eval/schema/restaurant-review`. Отказ на такое имя она не исправляла, а бросала создание
 * и достраивала открытую форму (ReFormer-9a9c, замер на qwen3.5:4b: 47 запросов вместо трёх).
 * Поэтому путь, чей последний сегмент — годное имя, принимается этим сегментом. Каталог из пути
 * не берётся: в нём легко оказаться внутри чужого модуля (`…/schema/`).
 */
function moduleNameOf(raw: string): { name: string; fromPath: boolean } {
  const name = raw.trim();
  if (MODULE_NAME.test(name) || !name.includes('/')) return { name, fromPath: false };
  const last = name.replace(/\/+$/, '').split('/').at(-1) ?? '';
  return MODULE_NAME.test(last) ? { name: last, fromPath: true } : { name, fromPath: false };
}

interface CreateParams {
  name: string;
  folder?: string;
}

export const createFormTool: FormAgentTool<CreateParams> = {
  name: 'create_form',
  description:
    'New empty form module; the turn continues on it and builds it. Only when asked for a new ' +
    'form.',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Folder, kebab-case: credit-application' },
      folder: { type: 'string', description: 'Parent folder' },
    },
    required: ['name'],
    additionalProperties: false,
  },
  // Черновик не меняет — но создаёт файлы, и отказ здесь — отказ правки, а не чтения.
  readOnly: false,
  async run(params, ctx) {
    const create = ctx.turn?.createForm;
    if (create === undefined) {
      return formToolFail('UNAVAILABLE', 'Creating forms is not available in this builder.');
    }
    const { name, fromPath } = moduleNameOf(params.name);
    if (!MODULE_NAME.test(name)) {
      return formToolFail(
        'INVALID_PARAMS',
        `name "${name}": the folder name only, kebab-case latin, e.g. credit-application.`
      );
    }
    const outcome = await create({
      name,
      ...(params.folder === undefined ? {} : { folder: params.folder }),
    });
    if (!outcome.ok) return formToolFail(outcome.code, outcome.message, outcome.suggestions);
    // Несохранённая форма открыта и правится так же: ход пишет только в рабочую копию.
    const unsaved = outcome.unsaved === undefined ? '' : ' Not saved to the project yet.';
    const renamed = fromPath ? ` Name taken from the path: ${name}.` : '';
    return formToolOk(
      `Created ${outcome.path} (empty).${renamed}${unsaved} This turn continues on it — stop ` +
        'here.'
    );
  },
};
