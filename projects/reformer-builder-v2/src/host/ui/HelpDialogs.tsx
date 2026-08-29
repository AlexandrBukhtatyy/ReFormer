/**
 * Диалоги справки и команды, которые их открывают.
 *
 * ## Почему команды регистрируются здесь, а не в оболочке
 *
 * Тот же довод, что у палитры: команда, открывающая окно, не должна значиться доступной,
 * когда окна нет. Пока компонент не смонтирован, команд `host.help.*` не существует —
 * и пункты меню, которые на них ссылаются, не рисуются вовсе (пункт без команды не
 * показывается; см. `./menu`). Сборка без справки остаётся законной сборкой, а не оболочкой
 * с двумя мёртвыми строками в меню.
 *
 * ## Таблица сочетаний строится из реестра команд
 *
 * Ни одна строка здесь не записана вручную. Ручной список — это обещание, которое перестаёт
 * быть правдой при первой же новой команде, и заметить это некому. Правило сбора живёт
 * в `./help`, чтобы проверяться без браузера.
 *
 * @module host/ui/HelpDialogs
 */

import { useEffect, useMemo, useState, type ReactElement } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@reformer/ui-kit/dialog';
import { Kbd, KbdGroup } from '@reformer/ui-kit/kbd';
import { ScrollArea } from '@reformer/ui-kit/scroll-area';
import type { CommandRegistry } from '../primitives/command';
import type { RootI18nService } from '../services/i18n/i18n';
import { shortcutRows } from './help';
import { detectPlatformModifier, formatKeybinding, type PlatformModifier } from './keybindings';
import { useLocale } from './usePanels';

/** Команда «горячие клавиши». Идентификатор экспортирован: на него ссылается пункт меню. */
export const HELP_SHORTCUTS_COMMAND_ID = 'host.help.shortcuts';
/** Команда «о программе». */
export const HELP_ABOUT_COMMAND_ID = 'host.help.about';

/** Какое из двух окон открыто. `null` — ни одного. */
type HelpDialog = 'shortcuts' | 'about';

export interface HelpDialogsProps {
  readonly commands: CommandRegistry;
  readonly i18n: RootI18nService;
  /** Во что разворачивать `mod` в подписях. По умолчанию определяется по платформе. */
  readonly modifier?: PlatformModifier;
}

/** Сочетание клавишами, как в палитре: подпись собрана тем же разделителем, что и там. */
function ShortcutKeys({ shortcut }: { shortcut: string }): ReactElement {
  const keys = shortcut.split('+').filter((key) => key !== '');
  return (
    <KbdGroup className="flex-none">
      {(keys.length === 0 ? [shortcut] : keys).map((key, index) => (
        <Kbd key={`${key}-${String(index)}`}>{key}</Kbd>
      ))}
    </KbdGroup>
  );
}

export function HelpDialogs({ commands, i18n, modifier }: HelpDialogsProps): ReactElement {
  const [dialog, setDialog] = useState<HelpDialog | null>(null);
  // Локаль — повод перерисоваться: `t()` вне React-состояния.
  useLocale(i18n);
  const platformModifier = useMemo(() => modifier ?? detectPlatformModifier(), [modifier]);
  const { t } = i18n;

  useEffect(() => {
    const open = (target: HelpDialog) => () => {
      setDialog(target);
    };
    // Регистрация парой: обе команды принадлежат одному окну и уходят вместе с ним.
    // Занятый идентификатор не должен ронять оболочку — но и молчать нельзя, иначе
    // «Справка» окажется пустой, а виновника придётся искать чтением плагинов.
    try {
      const shortcuts = commands.register({
        id: HELP_SHORTCUTS_COMMAND_ID,
        titleKey: 'shell.help.shortcuts',
        run: open('shortcuts'),
      });
      const about = commands.register({
        id: HELP_ABOUT_COMMAND_ID,
        titleKey: 'shell.help.about',
        run: open('about'),
      });
      return () => {
        shortcuts.dispose();
        about.dispose();
      };
    } catch (error) {
      console.error('[shell] команды справки не зарегистрированы', error);
      return undefined;
    }
  }, [commands]);

  // Без мемоизации по той же причине, что и дерево меню в `./MenuBar`: перевод происходит
  // внутри, локаль в самом вычислении не упоминается, и держать её в зависимостях значило бы
  // объявить связь, которой в коде нет. Список считается только пока окно открыто.
  const rows =
    dialog !== 'shortcuts'
      ? []
      : shortcutRows(commands.getAll(), {
          translate: (key, owner) =>
            owner?.pluginId === undefined ? i18n.t(key) : i18n.forPlugin(owner.pluginId).t(key),
          format: (keybinding) => formatKeybinding(keybinding, platformModifier),
        });

  return (
    <Dialog
      open={dialog !== null}
      onOpenChange={(open) => {
        if (!open) setDialog(null);
      }}
    >
      <DialogContent className="max-w-lg">
        {dialog === 'shortcuts' ? (
          <>
            <DialogHeader>
              <DialogTitle>{t('shell.help.shortcuts')}</DialogTitle>
              <DialogDescription>{t('shell.help.shortcuts.hint')}</DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh]">
              <ul className="flex flex-col gap-1 pr-3">
                {rows.map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-4 text-sm">
                    <span className="min-w-0 truncate">{row.title}</span>
                    <ShortcutKeys shortcut={row.shortcut} />
                  </li>
                ))}
                {rows.length === 0 && (
                  <li className="text-muted-foreground text-sm">
                    {t('shell.help.shortcuts.empty')}
                  </li>
                )}
              </ul>
            </ScrollArea>
          </>
        ) : (
          <DialogHeader>
            <DialogTitle>{t('app.title')}</DialogTitle>
            <DialogDescription>{t('shell.help.about.description')}</DialogDescription>
          </DialogHeader>
        )}
      </DialogContent>
    </Dialog>
  );
}
