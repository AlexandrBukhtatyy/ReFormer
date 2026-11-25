/**
 * Замечания валидации поля: какое показывать, когда место есть на одно.
 *
 * @module render/issues
 */

import type { ValidationIssue } from '../form/types/contracts';

/**
 * Главное замечание — первое блокирующее, а если блокирующих нет — первое предупреждение.
 *
 * Порядок замечаний — порядок правил, и предупреждение (`severity: 'warning'`) может стоять раньше
 * ошибки. Одиночный показ не должен заслонять им ошибку.
 *
 * @returns Главное замечание либо `undefined` для пустого списка.
 */
export function primaryIssue(issues: readonly ValidationIssue[]): ValidationIssue | undefined {
  return issues.find((issue) => issue.severity !== 'warning') ?? issues[0];
}
