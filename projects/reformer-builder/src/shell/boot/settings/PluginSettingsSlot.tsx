/**
 * Место формы настроек в карточке плагина.
 *
 * Отдельным файлом, а не рядом с телом раздела: файл, экспортирующий фабрику, не должен
 * объявлять компоненты верхнего уровня — на этом ломается fast refresh, и это ловит линтер.
 *
 * @module shell/boot/settings/PluginSettingsSlot
 */

import type { ReactElement } from 'react';
import { Separator } from '@reformer/ui-kit/separator';
import type { JsonFormSchema } from '@reformer/renderer-json';
import type { SettingsSectionBodyProps } from '@/shell/platform/ui/dialogs/settings-ui';
import type { PluginSettingsValues } from '@/shell/platform/services/plugin-settings';
import { settingsCardStateOf, type PluginRow, type PluginSettingsHost } from './plugins-list';
import { PluginSettingsForm } from './PluginSettingsForm';

/** Место формы настроек в карточке: сама форма, объяснение или ничего. */
export function PluginSettingsSlot({
  row,
  host,
  i18n,
  onFailure,
}: {
  readonly row: PluginRow;
  readonly host: PluginSettingsHost;
  readonly i18n: SettingsSectionBodyProps['i18n'];
  readonly onFailure: (message: string) => void;
}): ReactElement | null {
  const schema = row.state === 'enabled' ? host.schemaOf(row.id) : null;
  const state = settingsCardStateOf(row, schema !== null && schema !== undefined);

  if (state === 'none') return null;
  if (state === 'plugin-off') {
    return (
      <p data-testid={`settings-plugin-${row.id}-settings-off`}>
        {i18n.t('shell.settings.plugins.settings.off')}
      </p>
    );
  }

  return (
    <div data-testid={`settings-plugin-${row.id}-settings`}>
      <Separator />
      <PluginSettingsForm
        schema={schema as JsonFormSchema}
        values={host.read(row.id)}
        onChange={(values: PluginSettingsValues) => {
          void host.write(row.id, values).catch((error: unknown) => {
            onFailure(error instanceof Error ? error.message : String(error));
          });
        }}
        renderFailure={(message) => (
          <p className="text-destructive" data-testid={`settings-plugin-${row.id}-settings-broken`}>
            {i18n.t('shell.settings.plugins.settings.broken', { message })}
          </p>
        )}
      />
    </div>
  );
}
