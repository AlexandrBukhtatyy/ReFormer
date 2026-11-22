/**
 * Вкладка «Каталог»: что предлагает реестр и что из этого уже стоит.
 *
 * Каталог читается ПО ОТКРЫТИЮ вкладки, а не при открытии окна настроек: это сетевой запрос,
 * и делать его тому, кто зашёл поменять тему, незачем. Повторный заход перечитывает — список
 * реестра меняется без нашего участия, и показывать снимок получасовой давности значило бы
 * предлагать установить то, чего уже нет.
 *
 * Установленное из списка НЕ выбрасывается, а помечается: человек ищет плагин по имени и должен
 * найти его там, где искал, иначе «в каталоге его нет» прочитается как «его не существует».
 *
 * @module shell/boot/settings/MarketplaceTab
 */

import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Badge } from '@reformer/ui-kit/badge';
import { Button } from '@reformer/ui-kit/button';
import type { RootI18nService } from '@/shell/platform/services/i18n/i18n';
import {
  marketplaceRows,
  type InstalledInfo,
  type MarketplaceEntryLike,
  type MarketplaceRow,
  type PluginsMarketplacePort,
} from './plugins-tabs';

export interface MarketplaceTabProps {
  readonly port: PluginsMarketplacePort;
  readonly i18n: RootI18nService;
  /** Зовётся после установки: каталог плагинов обязан перечитаться, а вкладка — обновиться. */
  readonly onInstalled: () => void;
}

type State =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly rows: readonly MarketplaceRow[] }
  | { readonly kind: 'failed'; readonly message: string };

export function MarketplaceTab({ port, i18n, onInstalled }: MarketplaceTabProps): ReactElement {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    const [catalog, installed] = await Promise.all([port.catalog(), port.installed()]);
    if (!catalog.ok) {
      setState({ kind: 'failed', message: catalog.message });
      return;
    }
    setState({
      kind: 'ready',
      rows: marketplaceRows({
        rows: [],
        installed: installed as readonly InstalledInfo[],
        marketplace: catalog.entries as readonly MarketplaceEntryLike[],
        updates: [],
      }),
    });
  }, [port]);

  useEffect(() => {
    void load();
  }, [load]);

  const install = async (row: MarketplaceRow): Promise<void> => {
    setBusy(row.id);
    try {
      const result = await port.install(row.package);
      if (result.ok) {
        onInstalled();
        await load();
      } else {
        setState({ kind: 'failed', message: result.message ?? '' });
      }
    } finally {
      setBusy(null);
    }
  };

  if (state.kind === 'loading') {
    return (
      <p className="text-muted-foreground py-6 text-[13px]" data-testid="marketplace-loading">
        {i18n.t('shell.settings.plugins.marketplace.loading')}
      </p>
    );
  }

  if (state.kind === 'failed') {
    return (
      <p className="text-destructive py-6 text-[13px]" data-testid="marketplace-problem">
        {state.message}
      </p>
    );
  }

  if (state.rows.length === 0) {
    return (
      <p className="text-muted-foreground py-6 text-[13px]" data-testid="marketplace-empty">
        {i18n.t('shell.settings.plugins.marketplace.empty')}
      </p>
    );
  }

  return (
    <div className="py-2" data-testid="marketplace-list">
      {state.rows.map((row) => (
        <div key={row.id} className="border-border border-b py-2 last:border-b-0">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span>{row.name}</span>
                {row.publisher !== undefined && (
                  <span className="text-muted-foreground text-[12px]">{row.publisher}</span>
                )}
                {row.installed && (
                  <Badge variant="secondary">
                    {i18n.t('shell.settings.plugins.marketplace.installed')}
                  </Badge>
                )}
              </div>
              {row.description !== undefined && (
                <p className="text-muted-foreground text-[13px]">{row.description}</p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={row.installed || busy === row.id}
              data-testid={`marketplace-${row.id}-install`}
              onClick={() => {
                void install(row);
              }}
            >
              {i18n.t('shell.settings.plugins.marketplace.install')}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
