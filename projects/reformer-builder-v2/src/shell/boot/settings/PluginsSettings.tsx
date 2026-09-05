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
import { emptyStateOf, toRows, type PluginRow, type PluginsSettingsPort } from './plugins-list';

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

/** Собирает тело раздела над конкретным портом. Композиция зовёт её один раз. */
export function createPluginsSettingsBody(
  port: PluginsSettingsPort
): (props: SettingsSectionBodyProps) => ReactElement {
  return function PluginsSettings({ i18n }: SettingsSectionBodyProps): ReactElement {
    const rows = useCatalog(port);
    const [expanded, setExpanded] = useState<string | null>(null);
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

    if (empty !== null) {
      return (
        <p className="text-muted-foreground py-6 text-[13px]" data-testid="settings-plugins-empty">
          {i18n.t(`shell.settings.plugins.empty.${empty}`)}
        </p>
      );
    }

    return (
      <div className="py-2" data-testid="settings-plugins">
        <p className="text-muted-foreground pb-3 text-[13px]">
          {i18n.t('shell.settings.plugins.description')}
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

                  <Separator />
                  <p>
                    {i18n.t('shell.settings.plugins.identity', {
                      id: row.id,
                      api: row.apiVersion ?? '—',
                    })}
                  </p>
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
