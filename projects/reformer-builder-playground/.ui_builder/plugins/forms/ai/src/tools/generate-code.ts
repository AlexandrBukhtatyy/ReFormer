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
 * ## Нужен редко
 *
 * Ход, изменивший форму, и так кончается печатью модуля: её проводит стек вместе с записью правок
 * (`FormLandOutcome.code`), и заказ того же хода второго прогона не даёт. Поэтому описание прямо
 * говорит модели: звать, только когда просят код, а форму не меняют, — вызов ради уже
 * напечатанного стоил бы целого обращения к модели.
 *
 * @module plugins/forms/ai/tools/generate-code
 */

import { formToolFail, formToolOk, type FormAgentTool } from '@reformer/builder-plugin-api';

export const generateCodeTool: FormAgentTool = {
  name: 'generate_code',
  description:
    'Regenerate the module code. Edits regenerate it anyway: call only when the user asks ' +
    'for code and changes nothing.',
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
