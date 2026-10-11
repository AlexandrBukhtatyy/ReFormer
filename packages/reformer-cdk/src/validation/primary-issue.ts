import type { ValidationIssue } from '@reformer/core';

/**
 * Номер главного замечания — того, что показывают, когда место есть на одно: первое блокирующее,
 * а если блокирующих нет — первое предупреждение.
 *
 * Порядок замечаний — порядок правил, и предупреждение (`severity: 'warning'`) может стоять раньше
 * ошибки. Одиночный показ не должен заслонять им ошибку: поле в состоянии ошибки, а под ним — текст
 * предупреждения.
 *
 * @param issues - Замечания поля или массива.
 * @returns Номер главного замечания; для пустого списка — `0`.
 * @internal
 */
export function primaryIssueIndex(issues: readonly ValidationIssue[]): number {
  const blocking = issues.findIndex((issue) => issue.severity !== 'warning');
  return blocking < 0 ? 0 : blocking;
}
