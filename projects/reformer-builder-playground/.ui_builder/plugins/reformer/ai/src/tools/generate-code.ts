/**
 * `generate_code` — сгенерировать код модуля формы: типы, модель, валидацию, страницу.
 *
 * ## Почему заказ, а не прогон
 *
 * Генерация печатает модуль из формы, а правки хода структурного режима ложатся в документ только
 * в конце хода: прогон посреди хода напечатал бы форму без них. Поэтому инструмент только
 * заказывает генерацию, а мост проводит её один раз — после того как правки легли, тем же прогоном,
 * что у панели экспорта, и дверью записи хода: файлы модуля отменяются вместе с ходом. В режиме
 * файлов порядок тот же — модуль печатается из того, что модель записала к концу хода.
 *
 * Исход прогона модели не возвращается — ход к тому времени кончается; его видит человек строкой
 * журнала.
 *
 * @module plugins/reformer/ai/tools/generate-code
 */

import { formToolFail, formToolOk, type FormAgentTool } from '@reformer/builder-plugin-api';

export const generateCodeTool: FormAgentTool = {
  name: 'generate_code',
  description:
    'Generate the form module code (types, model, validation, page) once this turn ' +
    'ends. Only when the user asks for code.',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  // Схему не меняет: записи генерации идут дверью хода после правок, а не в черновик.
  readOnly: true,
  run(_params, ctx) {
    const generate = ctx.turn?.generate;
    if (generate === undefined) {
      return formToolFail('UNAVAILABLE', 'Code generation is not available in this builder.');
    }
    generate();
    return formToolOk(
      'Scheduled: the code is generated after your edits apply, and the user sees the result. ' +
        'Do not call again.'
    );
  },
};
