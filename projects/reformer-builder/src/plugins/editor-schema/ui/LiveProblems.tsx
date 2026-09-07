/**
 * Полоса находок над живой формой.
 *
 * Появляется, только когда есть что сказать, — то же правило, что у остальных полос живого
 * вида: в норме высота принадлежит форме. Строки считает чистый модуль (`../live/live-problems`),
 * здесь остаётся разметка: значок строгости, текст, счётчик спрятанного.
 *
 * Значки — поштучный импорт из `lucide-react`, как в панели проблем и по той же причине:
 * `@reformer/ui-kit/icon` тянет весь набор разом.
 *
 * @module plugins/editor-schema/ui/LiveProblems
 */

import type { ComponentType, ReactElement } from 'react';
import { CircleAlert, CircleX, Info } from 'lucide-react';
import type { DiagnosticSeverity } from '@/sdk';
import { splitLiveProblems, type LiveProblemRow } from '../live/live-problems';
import type { Translate } from '../host';

const SEVERITY_ICON: Readonly<Record<DiagnosticSeverity, ComponentType<{ className?: string }>>> =
  Object.freeze({ error: CircleX, warning: CircleAlert, info: Info });

/** Цвет строки — теми же токенами, что у пометок в дереве: ошибка красная, остальное тише. */
const SEVERITY_CLASS: Readonly<Record<DiagnosticSeverity, string>> = Object.freeze({
  error: 'text-destructive',
  warning: 'text-amber-700 dark:text-amber-400',
  info: 'text-muted-foreground',
});

export interface LiveProblemsProps {
  readonly rows: readonly LiveProblemRow[];
  readonly t: Translate;
}

export function LiveProblems({ rows, t }: LiveProblemsProps): ReactElement | null {
  if (rows.length === 0) return null;
  const { shown, hidden } = splitLiveProblems(rows);
  return (
    <div
      role="list"
      aria-label={t('live.problems.title')}
      data-testid="live-problems"
      className="border-border bg-muted/40 flex flex-col gap-0.5 border-b px-3 py-1 text-[11px]"
    >
      {shown.map((row) => {
        const Icon = SEVERITY_ICON[row.severity];
        return (
          <div
            key={row.key}
            role="listitem"
            title={row.text}
            className={`flex min-w-0 items-start gap-1.5 ${SEVERITY_CLASS[row.severity]}`}
          >
            <Icon className="mt-0.5 size-3 shrink-0" />
            <span className="truncate">{row.text}</span>
          </div>
        );
      })}
      {hidden > 0 && (
        <div className="text-muted-foreground">{t('live.problems.more', { count: hidden })}</div>
      )}
    </div>
  );
}
