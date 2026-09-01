/**
 * Окно «О программе» и команда, которая его открывает.
 *
 * ## Почему команда регистрируется здесь, а не в оболочке
 *
 * Тот же довод, что у палитры: команда, открывающая окно, не должна значиться доступной,
 * когда окна нет. Пока компонент не смонтирован, команды `host.help.about` не существует —
 * и пункт меню, который на неё ссылается, не рисуется вовсе (пункт без команды не
 * показывается; см. `./menu`). Сборка без справки остаётся законной сборкой, а не оболочкой
 * с мёртвой строкой в меню.
 *
 * ## Таблицы сочетаний здесь больше нет
 *
 * Она была read-only списком, выведенным из реестра команд, и это было верно ровно до
 * появления слоёв: как только сочетание можно переназначить, список обязан показывать
 * ДЕЙСТВУЮЩЕЕ значение и давать его править. Обе задачи решает `./KeybindingsDialog`,
 * и держать рядом второй список, обязанный с ним совпадать, значило бы завести расхождение,
 * которое обнаружилось бы молча. Пункт меню «Горячие клавиши» ведёт туда же.
 *
 * @module host/ui/HelpDialogs
 */

import { useEffect, useState, type ReactElement } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@reformer/ui-kit/dialog';
import type { CommandRegistry } from '@/shell/platform/primitives/command';
import type { RootI18nService } from '@/shell/platform/services/i18n/i18n';
import { DIALOG_SCOPE, useScope, type ScopeStack } from '@/shell/platform/ui/keyboard/scope';
import { useLocale } from '@/shell/platform/ui/chrome/usePanels';

/** Команда «о программе». Идентификатор экспортирован: на него ссылается пункт меню. */
export const HELP_ABOUT_COMMAND_ID = 'host.help.about';

export interface HelpDialogsProps {
  readonly commands: CommandRegistry;
  /** Стек областей: пока окно открыто, его клавиши принадлежат ему. */
  readonly scopes?: ScopeStack;
  readonly i18n: RootI18nService;
}

export function HelpDialogs({ commands, scopes, i18n }: HelpDialogsProps): ReactElement {
  const [open, setOpen] = useState(false);
  useScope(scopes, open ? DIALOG_SCOPE : null);
  // Локаль — повод перерисоваться: `t()` вне React-состояния.
  useLocale(i18n);
  const { t } = i18n;

  useEffect(() => {
    // Занятый идентификатор не должен ронять оболочку — но и молчать нельзя, иначе
    // «Справка» окажется пустой, а виновника придётся искать чтением плагинов.
    try {
      const subscription = commands.register({
        id: HELP_ABOUT_COMMAND_ID,
        titleKey: 'shell.help.about',
        run: () => {
          setOpen(true);
        },
      });
      return () => {
        subscription.dispose();
      };
    } catch (error) {
      console.error('[shell] команда справки не зарегистрирована', error);
      return undefined;
    }
  }, [commands]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('app.title')}</DialogTitle>
          <DialogDescription>{t('shell.help.about.description')}</DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
