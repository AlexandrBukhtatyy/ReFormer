/**
 * `validate_form` — строгий гейт качества над черновиком хода.
 *
 * Строгий режим (в отличие от гейта ручного сохранения) не принимает имена компонентов из самой
 * проверяемой схемы, поэтому выдуманное имя здесь падает, а не проходит молча. Базой исключений
 * служит схема на начало хода: компоненты, которые у пользователя уже были, законны и после правки.
 *
 * @module reformer-builder/agent/core/tools/validate-form
 */

import { getAt } from '../../../model';
import { parseErrorPath, splitErrorMessage } from '../../../io/error-path';
import { validateSchema } from '../../../io/validate';
import { componentOf, nodeRef } from '../node-ref';
import { ok, type AgentTool, type ToolContext } from '../types';

/** Сколько ошибок показывать: остальное — шум, модель чинит по одной. */
const MAX_ERRORS = 5;

/**
 * Ошибка на языке, которым агент правит форму.
 *
 * Валидатор адресует узлы точечной нотацией (`root.children[0].componentProps`), а все
 * write-инструменты — JSON Pointer'ом (`/root/children/0`). Модель получала диагноз в одном
 * диалекте, а чинить была обязана в другом, и трансляции ниоткуда не знала. Здесь путь
 * переводится в адрес инструментов и рядом называется компонент — он же нужен для `expect`.
 *
 * Если путь не разобрался, сообщение остаётся как есть: неточный адрес хуже отсутствующего.
 */
function retarget(message: string, ctx: ToolContext): string {
  const parsed = parseErrorPath(message);
  if (!parsed?.segments.length) return message;

  // Хвост пути может уходить внутрь узла (`componentProps/min`) — адресом инструментов служит
  // путь до самого узла, а хвост дописывается словами: без него «must be number» не говорит,
  // какое свойство чинить.
  const segments = [...parsed.segments];
  const tail: (string | number)[] = [];
  while (segments.length && !isNodeAt(ctx, segments)) tail.unshift(segments.pop()!);
  if (!segments.length) return message;

  const ref = nodeRef(segments);
  const component = componentOf(getAt(ctx.draft, segments) as never);
  const { rest } = splitErrorMessage(message);
  const where = tail.length ? ` ${tail.join('.')}` : '';
  return `${ref}${component ? ` (${component})` : ''}${where}${rest}`;
}

/** Есть ли по пути узел схемы (а не кусок `componentProps`). */
function isNodeAt(ctx: ToolContext, segments: (string | number)[]): boolean {
  const value = getAt(ctx.draft, segments);
  return !!value && typeof value === 'object' && !Array.isArray(value) && 'component' in value;
}

export const validateForm: AgentTool = {
  name: 'validate_form',
  description:
    // «Зови перед ответом» убрано: каждая правка и так проходит гейт, а новые замечания приходят
    // прямо в её ответе. Обязательный финальный вызов был чистым лишним шагом в конце всякого хода.
    'Check the whole form at once: node structure, component names, componentProps types and links ' +
    'between nodes (tab ↔ panel, wizard steps). Single edits are already checked as you make them.',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  readOnly: true,
  run(_params, ctx) {
    const { valid, errors, warnings } = validateSchema(ctx.draft, {
      strict: true,
      baseline: ctx.base,
    });

    // Предупреждения показываются и при валидной схеме: форма, где вкладка ведёт в пустоту, ошибок
    // не содержит — она просто не работает. Молчание здесь читалось бы как «всё в порядке».
    const lines: string[] = [];
    if (valid) lines.push('Schema is valid: no errors.');
    else {
      const shown = errors.slice(0, MAX_ERRORS);
      lines.push(
        `Errors: ${errors.length}.`,
        ...shown.map((e) => `- ${retarget(e, ctx)}`),
        ...(errors.length > shown.length ? [`… ${errors.length - shown.length} more`] : [])
      );
    }
    if (warnings.length) {
      const shown = warnings.slice(0, MAX_ERRORS);
      lines.push(
        `Node links — ${warnings.length} issue(s).`,
        ...shown.map((w) => `- ${w}`),
        ...(warnings.length > shown.length ? [`… ${warnings.length - shown.length} more`] : [])
      );
    }
    return ok(lines.join('\n'));
  },
};
