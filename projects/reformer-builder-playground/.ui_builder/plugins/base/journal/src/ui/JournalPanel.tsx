/**
 * Панель «Журнал»: переключатель видов и тело выбранного.
 *
 * Два вида — два разных вопроса. «Проблемы» отвечают «что сейчас не так с проектом»: это
 * состояние, оно уходит, когда находку исправили. «События» отвечают «что произошло»: это
 * история сессии, и запись остаётся, пока журнал не очистили. Смешать их в одну ленту значило
 * бы либо дублировать находку записью на каждой проверке, либо потерять её из ленты, когда
 * она исправлена.
 *
 * ## Строка переключателя — своя, а не шапка дока
 *
 * У нижнего дока шапки нет: её роль играет полоса вкладок, и действий панели (`Actions`) он
 * не рисует. Поэтому переключатель и «Очистить» стоят первой строкой тела, а список под ними
 * прокручивается сам — панель внесена с признаком `fill`, чтобы строка не уезжала с ним.
 *
 * Выбор вида хранится не здесь, а у плагина (`../view-state`): тело размонтируется при свёртке
 * дока, и выбор, хранимый в нём, сбрасывался бы.
 *
 * @module plugins/base/journal/ui/JournalPanel
 */

import { useMemo, type ReactElement } from 'react';
import { Badge } from '@reformer/ui-kit/badge';
import { Button } from '@reformer/ui-kit/button';
import { ToggleGroup, ToggleGroupItem } from '@reformer/ui-kit/toggle-group';
import type { DiagnosticsService, LogService } from '@reformer/builder-plugin-api';
import { countLevels } from '../events';
import type { JournalHost } from '../host';
import type { CommandAccess } from '../problems';
import type { JournalView, JournalViewState } from '../view-state';
import { EventsView } from './EventsView';
import { useProblemCounts } from './JournalBadge';
import { ProblemsView } from './ProblemsView';
import { useJournalView, useLogEntries } from './revision';

export interface JournalPanelProps {
  readonly host: JournalHost;
  readonly diagnostics: DiagnosticsService | null;
  /** Служба журнала. `null` — оболочка её не даёт: вид «События» пуст, «Очистить» недоступна. */
  readonly log: LogService | null;
  readonly commands?: CommandAccess | null;
  readonly view: JournalViewState;
}

function isView(value: string): value is JournalView {
  return value === 'problems' || value === 'events';
}

export function JournalPanel({
  host,
  diagnostics,
  log,
  commands = null,
  view: viewState,
}: JournalPanelProps): ReactElement {
  const t = host.useTranslate();
  const view = useJournalView(viewState);
  const problems = useProblemCounts(diagnostics);
  const entries = useLogEntries(log);
  const levels = useMemo(() => countLevels(entries), [entries]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 px-2 py-1">
        <ToggleGroup
          type="single"
          size="sm"
          value={view}
          aria-label={t('view.label')}
          // Щелчок по уже выбранному снимает выбор (`''`) — у журнала вид выбран всегда.
          onValueChange={(value) => {
            if (isView(value)) viewState.set(value);
          }}
        >
          <ToggleGroupItem value="problems" className="h-6 gap-1.5 px-2 text-[11px]">
            {t('view.problems')}
            <Counter total={problems.total} errors={problems.errors} />
          </ToggleGroupItem>
          <ToggleGroupItem value="events" className="h-6 gap-1.5 px-2 text-[11px]">
            {t('view.events')}
            <Counter total={entries.length} errors={levels.error} />
          </ToggleGroupItem>
        </ToggleGroup>
        {view === 'events' && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-6 px-2 text-[11px]"
            disabled={log === null || entries.length === 0}
            onClick={() => log?.clear()}
          >
            {t('events.clear')}
          </Button>
        )}
      </div>
      {view === 'problems' ? (
        <ProblemsView host={host} diagnostics={diagnostics} commands={commands} />
      ) : (
        <EventsView host={host} entries={entries} />
      )}
    </div>
  );
}

/** Число на переключателе; тон — по худшему уровню, как у значка вкладки. */
function Counter({ total, errors }: { total: number; errors: number }): ReactElement | null {
  if (total === 0) return null;
  return (
    <Badge variant={errors > 0 ? 'destructive' : 'secondary'} className="h-4 px-1 text-[10px]">
      {total}
    </Badge>
  );
}
