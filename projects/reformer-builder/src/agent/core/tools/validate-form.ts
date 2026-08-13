/**
 * `validate_form` — строгий гейт качества над черновиком хода.
 *
 * Строгий режим (в отличие от гейта ручного сохранения) не принимает имена компонентов из самой
 * проверяемой схемы, поэтому выдуманное имя здесь падает, а не проходит молча. Базой исключений
 * служит схема на начало хода: компоненты, которые у пользователя уже были, законны и после правки.
 *
 * @module reformer-builder/agent/core/tools/validate-form
 */

import { validateSchema } from '../../../io/validate';
import { ok, type AgentTool } from '../types';

/** Сколько ошибок показывать: остальное — шум, модель чинит по одной. */
const MAX_ERRORS = 10;

export const validateForm: AgentTool = {
  name: 'validate_form',
  description:
    'Проверить текущую форму строгим гейтом: структура узлов, известные имена компонентов и ' +
    'типы componentProps. Вызывай после структурных правок, перед завершением ответа.',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  readOnly: true,
  run(_params, ctx) {
    const { valid, errors } = validateSchema(ctx.draft, { strict: true, baseline: ctx.base });
    if (valid) return ok('Форма валидна: ошибок нет.');
    const shown = errors.slice(0, MAX_ERRORS);
    const rest = errors.length - shown.length;
    return ok(
      [
        `Ошибок: ${errors.length}.`,
        ...shown.map((e) => `- ${e}`),
        ...(rest > 0 ? [`… ещё ${rest}`] : []),
      ].join('\n')
    );
  },
};
