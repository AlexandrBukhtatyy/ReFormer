/**
 * Тело раздела настроек «Плагины»: список плагинов проекта, включатель и карточка плагина.
 *
 * Компонент живёт в КОМПОЗИЦИИ, а не в платформе, по той же причине, по которой там живёт
 * дерево проекта: он знает предметную вещь — каталог плагинов, — а окно настроек не знает
 * ни одной службы приложения и знать не должно. Окну достаётся только `Body`, собранный
 * здесь замыканием над портом, ровно как `read`/`write` у полей темы и языка.
 *
 * Правила «что доступно в каком состоянии» вынесены в `./plugins-list` и проверяются без
 * браузера. Здесь остаётся отрисовка и подписка.
 *
 * @module shell/boot/settings/PluginsSettings
 */

import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Badge } from '@reformer/ui-kit/badge';
import { Button } from '@reformer/ui-kit/button';
import { Checkbox } from '@reformer/ui-kit/checkbox';
import { Label } from '@reformer/ui-kit/label';
import { Separator } from '@reformer/ui-kit/separator';
import { Settings2 } from 'lucide-react';
import type { SettingsSectionBodyProps } from '@/shell/platform/ui/dialogs/settings-ui';
import {
  emptyStateOf,
  toRows,
  type PluginRow,
  type PluginSettingsHost,
  type PluginsSettingsPort,
} from './plugins-list';
import { PluginSettingsSlot } from './PluginSettingsSlot';
import { MarketplaceTab } from './MarketplaceTab';
import { UpdatesTab } from './UpdatesTab';
import {
  canRollback,
  developmentRows,
  visibleTabs,
  type InstalledInfo,
  type PluginTab,
  type PluginsMarketplacePort,
} from './plugins-tabs';

/** Подписка на каталог: список живой, его меняют палитра, обход проекта и авто-перезагрузка. */
function useCatalog(port: PluginsSettingsPort): readonly PluginRow[] {
  const [, force] = useState(0);
  useEffect(() => {
    const subscription = port.subscribe(() => {
      force((value) => value + 1);
    });
    return () => {
      subscription.dispose();
    };
  }, [port]);
  return toRows(port.list());
}

/**
 * Подписка на настройки: состав вкладов и значения меняются мимо окна — плагин включили,
 * перезагрузили, второе окно записало значение.
 */
function useSettingsHost(host: PluginSettingsHost | null): void {
  const [, force] = useState(0);
  useEffect(() => {
    if (host === null) return undefined;
    const subscription = host.subscribe(() => {
      force((value) => value + 1);
    });
    return () => {
      subscription.dispose();
    };
  }, [host]);
}

/**
 * Собирает тело раздела над конкретным портом. Композиция зовёт её один раз.
 *
 * Второй порт НЕОБЯЗАТЕЛЕН: список плагинов и их настройки — разные способности, и раздел
 * обязан работать без второй (как он и работал до её появления).
 */
export function createPluginsSettingsBody(
  port: PluginsSettingsPort,
  settingsHost: PluginSettingsHost | null = null,
  marketplace: PluginsMarketplacePort | null = null
): (props: SettingsSectionBodyProps) => ReactElement {
  return function PluginsSettings({ i18n }: SettingsSectionBodyProps): ReactElement {
    const all = useCatalog(port);
    const [tab, setTab] = useState<PluginTab>('installed');
    const tabs = visibleTabs(marketplace !== null);
    // «В разработке» — те же строки, отфильтрованные пометкой: вкладка отвечает на вопрос
    // «над чем я работаю», а не показывает другой список.
    const rows =
      tab === 'development'
        ? developmentRows({ rows: all, installed: [], marketplace: [], updates: [] })
        : all;
    useSettingsHost(settingsHost);
    const [expanded, setExpanded] = useState<string | null>(null);
    // Состав установленного из npm нужен карточке ради одного вопроса: есть ли куда
    // откатываться. Читается отдельно от каталога — каталог знает слой, но не знает,
    // сколько версий лежит на диске.
    const [installed, setInstalled] = useState<readonly InstalledInfo[]>([]);
    const readInstalled = useCallback(() => {
      if (marketplace === null) return;
      void marketplace.installed().then(setInstalled);
    }, []);
    useEffect(readInstalled, [readInstalled]);
    const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
    const empty = emptyStateOf(port);

    /**
     * Операция над плагином с защитой от повторного входа.
     *
     * Включение асинхронно и небыстро (чтение файлов, транспиляция), а нажать второй раз
     * человек успевает. Второе нажатие по включённому — это уже `disable`, и без замка
     * получилась бы пара «включить/выключить» вместо одного действия.
     */
    const run = useCallback(async (id: string, operation: () => void | Promise<unknown>) => {
      setBusy((current) => (current.has(id) ? current : new Set(current).add(id)));
      try {
        await operation();
      } catch (error) {
        // Отказ включения каталог уже показал своим каналом проблем; здесь важно лишь
        // не оставить строку навсегда занятой.
        console.error('[shell] действие над плагином не удалось', error);
      } finally {
        setBusy((current) => {
          const next = new Set(current);
          next.delete(id);
          return next;
        });
      }
    }, []);

    const tabBar =
      tabs.length < 2 ? null : (
        <div className="flex gap-1 pb-3" role="tablist" data-testid="settings-plugins-tabs">
          {tabs.map((name) => (
            <Button
              key={name}
              role="tab"
              aria-selected={tab === name}
              variant={tab === name ? 'secondary' : 'ghost'}
              size="sm"
              data-testid={`settings-plugins-tab-${name}`}
              onClick={() => {
                setTab(name);
              }}
            >
              {i18n.t(`shell.settings.plugins.tab.${name}`)}
            </Button>
          ))}
        </div>
      );

    // Каталог и обновления не зависят от открытого проекта: они про то, что стоит в браузере
    // и что предлагает реестр. Поэтому пустое состояние каталога плагинов их не закрывает.
    if (marketplace !== null && (tab === 'marketplace' || tab === 'updates')) {
      return (
        <div className="py-2" data-testid="settings-plugins">
          {tabBar}
          {tab === 'marketplace' ? (
            <MarketplaceTab
              port={marketplace}
              i18n={i18n}
              onInstalled={() => {
                void port.refresh?.();
              }}
            />
          ) : (
            <UpdatesTab
              port={marketplace}
              i18n={i18n}
              onUpdated={() => {
                void port.refresh?.();
              }}
            />
          )}
        </div>
      );
    }

    if (empty !== null) {
      // Панель вкладок переживает пустое состояние, если есть куда с неё уйти: «проект
      // не открыт» — это про список плагинов проекта, а каталог и обновления работают
      // и без проекта. Без панели до них было бы не добраться.
      return marketplace === null ? (
        <p className="text-muted-foreground py-6 text-[13px]" data-testid="settings-plugins-empty">
          {i18n.t(`shell.settings.plugins.empty.${empty}`)}
        </p>
      ) : (
        <div className="py-2" data-testid="settings-plugins">
          {tabBar}
          <p
            className="text-muted-foreground py-6 text-[13px]"
            data-testid="settings-plugins-empty"
          >
            {i18n.t(`shell.settings.plugins.empty.${empty}`)}
          </p>
        </div>
      );
    }

    return (
      <div className="py-2" data-testid="settings-plugins">
        {tabBar}
        <p className="text-muted-foreground pb-3 text-[13px]">
          {i18n.t(
            tab === 'development'
              ? 'shell.settings.plugins.tab.development.description'
              : 'shell.settings.plugins.description'
          )}
        </p>
        {rows.map((row) => {
          const working = busy.has(row.id);
          const open = expanded === row.id;
          return (
            <div key={row.id} className="border-border border-b py-2 last:border-b-0">
              <div className="flex items-center gap-3">
                <Checkbox
                  id={`plugin-${row.id}`}
                  checked={row.on}
                  disabled={working}
                  data-testid={`settings-plugin-${row.id}-toggle`}
                  aria-label={i18n.t(
                    row.toggle === 'disable'
                      ? 'shell.settings.plugins.disable'
                      : row.toggle === 'retry'
                        ? 'shell.settings.plugins.retry'
                        : 'shell.settings.plugins.enable',
                    { name: row.name }
                  )}
                  onCheckedChange={() => {
                    void run(row.id, () =>
                      row.toggle === 'disable' ? port.disable(row.id) : port.enable(row.id)
                    );
                  }}
                />
                <Label htmlFor={`plugin-${row.id}`} className="flex-1 cursor-pointer font-normal">
                  {row.name}
                  {row.version !== null && (
                    <span className="text-muted-foreground ml-2 text-[12px]">{row.version}</span>
                  )}
                </Label>
                {row.dev && (
                  <Badge variant="secondary">{i18n.t('shell.settings.plugins.dev')}</Badge>
                )}
                {row.layer === 'installed' && (
                  <Badge variant="outline">
                    {i18n.t('shell.settings.plugins.layer.installed')}
                  </Badge>
                )}
                {row.shadowed !== null && (
                  <Badge variant="outline">
                    {i18n.t(`shell.settings.plugins.layer.shadowed.${row.shadowed}`)}
                  </Badge>
                )}
                {row.state === 'failed' && (
                  <Badge variant="destructive">{i18n.t('shell.settings.plugins.failed')}</Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  aria-expanded={open}
                  data-testid={`settings-plugin-${row.id}-configure`}
                  aria-label={i18n.t('shell.settings.plugins.configure', { name: row.name })}
                  onClick={() => {
                    setExpanded(open ? null : row.id);
                  }}
                >
                  <Settings2 aria-hidden="true" className="size-4" />
                </Button>
              </div>

              {open && (
                <div
                  className="text-muted-foreground space-y-2 py-2 pl-7 text-[13px]"
                  data-testid={`settings-plugin-${row.id}-card`}
                >
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`plugin-${row.id}-dev`}
                      checked={row.dev}
                      data-testid={`settings-plugin-${row.id}-dev`}
                      onCheckedChange={(checked) => {
                        port.setDev(row.id, checked === true);
                      }}
                    />
                    <Label htmlFor={`plugin-${row.id}-dev`} className="font-normal">
                      {i18n.t('shell.settings.plugins.dev.label')}
                    </Label>
                  </div>
                  <p>{i18n.t('shell.settings.plugins.dev.description')}</p>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!row.canReload || working}
                      data-testid={`settings-plugin-${row.id}-reload`}
                      onClick={() => {
                        void run(row.id, () => port.reload(row.id));
                      }}
                    >
                      {i18n.t('shell.settings.plugins.reload')}
                    </Button>

                    {/* Откат и удаление — только у приехавшего из npm: у плагина проекта
                        и то и другое означало бы правку чужой папки. */}
                    {marketplace !== null && row.layer === 'installed' && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={working || !canRollback(row.id, installed)}
                          data-testid={`settings-plugin-${row.id}-rollback`}
                          onClick={() => {
                            void run(row.id, async () => {
                              await marketplace.rollback(row.id);
                              readInstalled();
                            });
                          }}
                        >
                          {i18n.t('shell.settings.plugins.rollback')}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={working}
                          data-testid={`settings-plugin-${row.id}-uninstall`}
                          onClick={() => {
                            void run(row.id, async () => {
                              await marketplace.uninstall(row.id);
                              readInstalled();
                            });
                          }}
                        >
                          {i18n.t('shell.settings.plugins.uninstall')}
                        </Button>
                      </>
                    )}
                  </div>

                  <Separator />
                  <p>
                    {i18n.t('shell.settings.plugins.identity', {
                      id: row.id,
                      api: row.apiVersion ?? '—',
                    })}
                  </p>
                  {settingsHost !== null && (
                    <PluginSettingsSlot
                      row={row}
                      host={settingsHost}
                      i18n={i18n}
                      // Отказ записи показываем строкой в карточке: молча не применившуюся
                      // настройку человек вводит второй и третий раз.
                      onFailure={(message) => {
                        console.error('[shell] настройка плагина не записана', message);
                      }}
                    />
                  )}
                  {row.problem !== null && (
                    <p
                      className="text-destructive"
                      data-testid={`settings-plugin-${row.id}-problem`}
                    >
                      {i18n.t('shell.settings.plugins.problem', {
                        code: row.problem.code,
                        message: row.problem.message,
                        file: row.problem.file ?? '—',
                      })}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };
}
