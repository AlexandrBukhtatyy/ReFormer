/**
 * Вкладка «Обновления»: у чего из установленного есть версия новее.
 *
 * ## Почему по кнопке, а не само
 *
 * Проверка — это запрос в npm на каждый установленный плагин. Делать её при открытии окна
 * настроек значило бы ходить в сеть за спиной человека, который зашёл поменять тему; делать
 * по расписанию — за спиной вообще. Поэтому состояние «ещё не проверяли» отдельное, и пустой
 * список после проверки значит именно «нечего обновлять», а не «мы не смотрели».
 *
 * Обновление ставит доступную версию поверх текущей и НЕ трогает прежнюю: она остаётся
 * на диске, и откат к ней не потребует сети (`plugin/installed/store`).
 *
 * @module shell/boot/settings/UpdatesTab
 */

import { useState, type ReactElement } from 'react';
import { Button } from '@reformer/ui-kit/button';
import type { RootI18nService } from '@/shell/platform/services/i18n/i18n';
import type { PluginsMarketplacePort, UpdateRow } from './plugins-tabs';

export interface UpdatesTabProps {
  readonly port: PluginsMarketplacePort;
  readonly i18n: RootI18nService;
  /** Зовётся после обновления: каталог плагинов обязан перечитаться. */
  readonly onUpdated: () => void;
}

type State =
  | { readonly kind: 'idle' }
  | { readonly kind: 'checking' }
  | { readonly kind: 'ready'; readonly rows: readonly UpdateRow[] }
  | { readonly kind: 'failed'; readonly message: string };

export function UpdatesTab({ port, i18n, onUpdated }: UpdatesTabProps): ReactElement {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [busy, setBusy] = useState<string | null>(null);

  const check = async (): Promise<void> => {
    setState({ kind: 'checking' });
    const result = await port.checkUpdates();
    setState(
      result.ok ? { kind: 'ready', rows: result.rows } : { kind: 'failed', message: result.message }
    );
  };

  const update = async (row: UpdateRow): Promise<void> => {
    setBusy(row.id);
    try {
      const result = await port.update(row);
      if (!result.ok) {
        setState({ kind: 'failed', message: result.message ?? '' });
        return;
      }
      onUpdated();
      await check();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="py-2" data-testid="updates-tab">
      <div className="flex items-center gap-3 pb-3">
        <Button
          variant="outline"
          size="sm"
          disabled={state.kind === 'checking'}
          data-testid="updates-check"
          onClick={() => {
            void check();
          }}
        >
          {i18n.t('shell.settings.plugins.updates.check')}
        </Button>
        <p className="text-muted-foreground text-[13px]">
          {i18n.t('shell.settings.plugins.updates.description')}
        </p>
      </div>

      {state.kind === 'failed' && (
        <p className="text-destructive text-[13px]" data-testid="updates-problem">
          {state.message}
        </p>
      )}

      {state.kind === 'ready' && state.rows.length === 0 && (
        <p className="text-muted-foreground text-[13px]" data-testid="updates-none">
          {i18n.t('shell.settings.plugins.updates.none')}
        </p>
      )}

      {state.kind === 'ready' &&
        state.rows.map((row) => (
          <div
            key={row.id}
            className="border-border flex items-center gap-3 border-b py-2 last:border-b-0"
          >
            <div className="flex-1">
              <span>{row.name}</span>
              <span className="text-muted-foreground ml-2 text-[12px]">
                {i18n.t('shell.settings.plugins.updates.versions', {
                  current: row.current,
                  available: row.available,
                })}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={busy === row.id}
              data-testid={`updates-${row.id}-apply`}
              onClick={() => {
                void update(row);
              }}
            >
              {i18n.t('shell.settings.plugins.updates.apply')}
            </Button>
          </div>
        ))}
    </div>
  );
}
