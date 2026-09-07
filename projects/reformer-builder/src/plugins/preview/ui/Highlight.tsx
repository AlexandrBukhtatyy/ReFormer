/**
 * Подсветка выделенных узлов — правилами CSS, а не правкой DOM.
 *
 * Класс-токен узла уже стоит на элементе (см. `../annotate`), поэтому подсветка выражается
 * одним селектором на выделенный адрес. Альтернатива — обходить DOM и вешать классы руками —
 * потребовала бы синхронизации с перерисовкой формы: рендерер пересоздаёт элементы, и
 * навешанное вручную исчезало бы на первом же изменении значения.
 *
 * @module plugins/preview/ui/Highlight
 */

import type { ReactNode } from 'react';
import type { NodeId } from '@/sdk';
import { NODE_ID_PATTERN } from '@/lib/form-model/node-id';
import { NODE_CLASS_PREFIX } from '../schema/node-token';

export interface HighlightProps {
  readonly selection: readonly NodeId[];
}

/** Стиль выделения. Контур, а не заливка: заливка исказила бы вид самой формы. */
const OUTLINE = 'outline: 2px solid var(--color-ring, #6366f1); outline-offset: 2px;';

export function Highlight({ selection }: HighlightProps): ReactNode {
  // Форма адреса проверяется ПЕРЕД склейкой селектора: идентификатор попадает в таблицу стилей,
  // и непроверенная строка была бы прямым способом вписать туда что угодно.
  const safe = selection.filter((id) => NODE_ID_PATTERN.test(id));
  if (safe.length === 0) return null;
  const rules = safe.map((id) => `.${NODE_CLASS_PREFIX}${id} { ${OUTLINE} }`).join('\n');
  return <style>{rules}</style>;
}
