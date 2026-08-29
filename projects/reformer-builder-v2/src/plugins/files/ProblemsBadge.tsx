/**
 * Значок на вкладке «Проблемы»: число находок и их строгость.
 *
 * Ради него свёрнутый вид нижнего дока и существует. Полоса вкладок остаётся видимой,
 * когда тело убрано, — чтобы ошибку было ВИДНО, не разворачивая панель. Убери значок,
 * и свёрнутое состояние потеряет смысл: полоса из одних имён ничего не сообщает.
 *
 * Тон берётся по ХУДШЕЙ строгости, а не по преобладающей: одна ошибка среди двадцати
 * замечаний важнее двадцати замечаний, и смешивать их в «в основном замечания» нельзя.
 *
 * @module plugins/files/ProblemsBadge
 */

import { useSyncExternalStore, type ReactElement } from 'react';
import { Badge } from '@reformer/ui-kit/badge';
import type { DiagnosticsService, ResourceId } from '@/sdk';
import { summarize, totalCounts } from './diagnostics';

/**
 * Снимок свода как внешнее состояние.
 *
 * Возвращается ЧИСЛО, а не объект: `useSyncExternalStore` сравнивает по ссылке, и объект,
 * собранный на каждый вызов, дал бы бесконечную перерисовку. Ошибка эта в проекте
 * встречалась уже трижды, поэтому здесь считаем сразу в примитив.
 */
function useCounts(diagnostics: DiagnosticsService | null): {
  total: number;
  errors: number;
} {
  const key = useSyncExternalStore(
    (cb) => {
      if (diagnostics === null) return () => {};
      const off = diagnostics.onDidChange(cb);
      return () => {
        off.dispose();
      };
    },
    () => encode(diagnostics),
    () => 0
  );
  return { total: key >>> 8, errors: key & 0xff };
}

/** Свод в одно число: старшие разряды — всего находок, младшие — сколько из них ошибок. */
function encode(diagnostics: DiagnosticsService | null): number {
  if (diagnostics === null) return 0;
  const counts = totalCounts(
    diagnostics.resources().map((id: ResourceId) => summarize(diagnostics.get(id)))
  );
  const total = counts.error + counts.warning + counts.info;
  return (Math.min(total, 0xffffff) << 8) | Math.min(counts.error, 0xff);
}

export function ProblemsBadge({
  diagnostics,
}: {
  diagnostics: DiagnosticsService | null;
}): ReactElement | null {
  const { total, errors } = useCounts(diagnostics);
  if (total === 0) return null;
  return (
    <Badge variant={errors > 0 ? 'destructive' : 'secondary'} className="h-4 px-1 text-[10px]">
      {total}
    </Badge>
  );
}
