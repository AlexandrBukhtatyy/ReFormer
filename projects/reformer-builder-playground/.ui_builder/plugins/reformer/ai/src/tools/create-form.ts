/**
 * `list_templates` и `create_form` — новая форма по просьбе пользователя.
 *
 * ## Почему ход переходит на новую форму сам
 *
 * Черновик хода — форма, с которой ход начался, и правки после создания легли бы в неё, а не в
 * новую. Поэтому успешный `create_form` заканчивает попытку: мост открывает новую форму и
 * продолжает тот же ход на ней — с её картой и теми же инструментами. Ход без открытой формы
 * начинается с одних этих инструментов: править ещё нечего.
 *
 * Модуль кладут шаблоны — тем же путём, что окно «Создать форму»: каталогом `<каталог>/<имя>/`,
 * всеми файлами шаблона. Без шаблона форма пустая: встроенные шаблоны — образцы со всеми видами
 * полей, и форму по описанию из них пришлось бы сначала вычищать.
 *
 * @module plugins/reformer/ai/tools/create-form
 */

import { fail, ok, type AgentTool } from '../model/types';

/** Имя модуля — имя его каталога и основа имён в коде: латиница в kebab-case. */
const MODULE_NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/** Предел описания шаблона в списке: список — для выбора, а не для чтения. */
const DESCRIPTION_LIMIT = 160;

export const listTemplatesTool: AgentTool = {
  name: 'list_templates',
  description: 'Form templates create_form can start from.',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  readOnly: true,
  async run(_params, ctx) {
    const templates = ctx.turn?.templates;
    if (templates === undefined) {
      return fail('UNAVAILABLE', 'Templates are not available in this builder.');
    }
    const list = await templates();
    if (list.length === 0)
      return ok('No templates: create_form without template makes an empty form.');
    const lines = list.map((item) => {
      const about = item.description?.trim() ?? '';
      const short =
        about.length > DESCRIPTION_LIMIT ? `${about.slice(0, DESCRIPTION_LIMIT - 1)}…` : about;
      return `- "${item.id}" ${item.name}${short === '' ? '' : `: ${short}`}`;
    });
    return ok(lines.join('\n'));
  },
};

interface CreateParams {
  name: string;
  template?: string;
  folder?: string;
}

export const createFormTool: AgentTool<CreateParams> = {
  name: 'create_form',
  description:
    'New form module; the turn continues on it. Only when asked for a new form. No ' +
    'template: empty form.',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Folder, kebab-case: credit-application' },
      template: { type: 'string', description: 'Template id' },
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
      return fail('UNAVAILABLE', 'Creating forms is not available in this builder.');
    }
    const name = params.name.trim();
    if (!MODULE_NAME.test(name)) {
      return fail('INVALID_PARAMS', `name "${name}": kebab-case latin, e.g. credit-application.`);
    }
    const outcome = await create({
      name,
      ...(params.template === undefined ? {} : { template: params.template }),
      ...(params.folder === undefined ? {} : { folder: params.folder }),
    });
    if (!outcome.ok) return fail(outcome.code, outcome.message, outcome.suggestions);
    const from = outcome.template === null ? 'empty' : `from template "${outcome.template}"`;
    return ok(`Created ${outcome.path} (${from}). This turn continues on it — stop here.`);
  },
};
