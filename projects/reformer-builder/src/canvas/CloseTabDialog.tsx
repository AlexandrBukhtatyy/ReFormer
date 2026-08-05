/**
 * Подтверждение закрытия вкладок-черновиков. Показывается только когда под закрытие попадают
 * несохранённые черновики: у них нет файла в проекте, поэтому вместе со вкладкой пропадает и
 * локальная копия — восстановить её будет нельзя.
 *
 * @module reformer-builder/canvas/CloseTabDialog
 */

import { Button } from '@reformer/ui-kit';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@reformer/ui-kit/dialog';
import { closeDialogActions, useCloseDialog } from '../store/close-dialog';
import { confirmClose } from '../app/close-actions';

export function CloseTabDialog() {
  const { pending } = useCloseDialog();
  if (!pending) return null;
  const { drafts, total } = pending;
  const many = drafts.length > 1;

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) closeDialogActions.close();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{many ? 'Закрыть вкладки?' : 'Закрыть вкладку?'}</DialogTitle>
          <DialogDescription>
            {many
              ? `Из ${total} закрываемых вкладок ${drafts.length} — черновики без файла в проекте. ` +
                'Вместе с ними удалятся и локальные копии, восстановить их будет нельзя.'
              : 'Эта схема — черновик: файла в проекте за ней нет. ' +
                'Вместе со вкладкой удалится и локальная копия, восстановить её будет нельзя.'}
          </DialogDescription>
        </DialogHeader>

        <ul className="max-h-40 overflow-auto rounded-md border border-border bg-muted/40 px-3 py-2 font-mono text-[11.5px]">
          {drafts.map((d) => (
            <li key={d.id} className="truncate py-0.5">
              {d.name}
            </li>
          ))}
        </ul>

        <p className="text-[11.5px] text-muted-foreground">
          Чтобы сохранить работу, отмените закрытие и выгрузите схему через «Сохранить» (⌘S) — она
          скачается файлом.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={closeDialogActions.close}>
            Отмена
          </Button>
          <Button variant="destructive" onClick={() => confirmClose(pending.intent)}>
            Закрыть и удалить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
