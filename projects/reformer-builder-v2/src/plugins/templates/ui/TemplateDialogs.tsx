/**
 * Диалоги шаблонов: создать форму, переименовать, удалить.
 *
 * ## Почему создание формы — диалог, а не поле в панели
 *
 * Панель шаблонов отвечает на вопрос «что у меня есть», и всё, что она показывает постоянно,
 * человек читает при КАЖДОМ взгляде на неё. Поле «имя формы» с кнопкой наверху панели читалось
 * так же часто, как список, хотя нужно оно ровно в момент решения «беру этот шаблон» — то есть
 * раз за сессию. Поэтому решение про имя, каталог и состав файлов вынесено в диалог: он
 * появляется по требованию и уносит с собой все три вопроса разом.
 *
 * ## Состав файлов — свёрнутая подробность
 *
 * По умолчанию берутся ВСЕ файлы шаблона: это тот случай, ради которого шаблон и собирали.
 * Выбор существует ради обратного случая (взять из шаблона только страницу, модель уже есть),
 * и снятие отметки тянет за собой зависимые файлы через `resolvePicked`: набор, из которого
 * выпала модель, не собрался бы, а узнать об этом на компиляции хуже, чем не дать его выбрать.
 *
 * @module plugins/templates/ui/TemplateDialogs
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button } from '@reformer/ui-kit/button';
import { Checkbox } from '@reformer/ui-kit/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@reformer/ui-kit/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@reformer/ui-kit/dialog';
import { Input } from '@reformer/ui-kit/input';
import { Label } from '@reformer/ui-kit/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@reformer/ui-kit/select';
import { ChevronRight } from 'lucide-react';
import type { ResourceId } from '@/sdk';
import { canRemove, canUpdate, type FormTemplate, type TemplateStore } from '../contract';
import { resolvePicked } from '../files';
import type { TemplatesHost, Translate } from '../host';
import { isUsableFormName } from '../placeholders';
import {
  generateFormFromTemplate,
  listFolders,
  removeTemplate,
  renameTemplate,
  storeOf,
  type FolderChoice,
  type OperationResult,
} from '../operations';

/** Какой из трёх диалогов открыт и над каким шаблоном. */
export type TemplateDialog =
  | { readonly kind: 'generate'; readonly template: FormTemplate }
  | { readonly kind: 'rename'; readonly template: FormTemplate }
  | { readonly kind: 'remove'; readonly template: FormTemplate };

export interface TemplateDialogsProps {
  readonly dialog: TemplateDialog | null;
  readonly host: TemplatesHost;
  /** Документ активной вкладки: рядом с ним появится форма. `null` — создавать негде. */
  readonly documentId: ResourceId | null;
  readonly stores: () => readonly TemplateStore[];
  readonly t: Translate;
  readonly onClose: () => void;
  /** Исход операции: панель показывает его и перечитывает список. */
  readonly onDone: (result: OperationResult) => void;
}

export function TemplateDialogs({
  dialog,
  host,
  documentId,
  stores,
  t,
  onClose,
  onDone,
}: TemplateDialogsProps): ReactNode {
  if (dialog === null) return null;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        {/* Ключ по шаблону: тело диалога держит своё состояние (имя, набор файлов), и
            открытие над ДРУГИМ шаблоном обязано начинать с чистого листа. */}
        {dialog.kind === 'generate' ? (
          <GenerateBody
            key={`generate:${dialog.template.source}:${dialog.template.id}`}
            template={dialog.template}
            host={host}
            documentId={documentId}
            t={t}
            onClose={onClose}
            onDone={onDone}
          />
        ) : dialog.kind === 'rename' ? (
          <RenameBody
            key={`rename:${dialog.template.source}:${dialog.template.id}`}
            template={dialog.template}
            stores={stores}
            t={t}
            onClose={onClose}
            onDone={onDone}
          />
        ) : (
          <RemoveBody
            template={dialog.template}
            stores={stores}
            t={t}
            onClose={onClose}
            onDone={onDone}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface GenerateBodyProps {
  readonly template: FormTemplate;
  readonly host: TemplatesHost;
  readonly documentId: ResourceId | null;
  readonly t: Translate;
  readonly onClose: () => void;
  readonly onDone: (result: OperationResult) => void;
}

function GenerateBody({
  template,
  host,
  documentId,
  t,
  onClose,
  onDone,
}: GenerateBodyProps): ReactNode {
  const [name, setName] = useState('');
  const [filesOpen, setFilesOpen] = useState(false);
  const [picked, setPicked] = useState<ReadonlySet<string>>(
    () => new Set(template.files.map((file) => file.path))
  );
  const [folders, setFolders] = useState<readonly FolderChoice[]>([]);
  const [folder, setFolder] = useState<ResourceId | null>(null);

  const root = host.projectRoot();
  // Каталог открытого файла — предложение по умолчанию: форму почти всегда кладут рядом
  // с тем, над чем работают. Но это предложение, а не решение за человека: выбрать можно
  // любой каталог проекта.
  const suggested = documentId === null ? root : host.parentOf(documentId);

  useEffect(() => {
    if (root === null) return;
    let alive = true;
    void listFolders(host, root).then((list) => {
      if (!alive) return;
      setFolders(list);
      // Предложенный каталог мог не попасть в список (глубже предела обхода) — тогда он
      // всё равно годится целью, и добавляется в список как есть.
      setFolder((current) => current ?? suggested ?? root);
    });
    return () => {
      alive = false;
    };
  }, [host, root, suggested]);

  // Выбор ограничен тем, что есть в списке: каталог глубже предела обхода в нём отсутствует,
  // и показать его выбранным значило бы предложить пункт, которого в списке не найти.
  // Тогда предложение отступает к корню — месту, которое есть всегда.
  const known = folders.some((choice) => choice.id === (folder ?? suggested));
  const target = known ? (folder ?? suggested) : root;
  const choices = folders;

  const nameOk = isUsableFormName(name);
  const canSubmit = nameOk && picked.size > 0 && target !== null;

  // Снятие отметки убирает и то, что без снятого файла не соберётся; постановка — тянет
  // зависимости. Обе стороны считает правило шаблона, а не диалог.
  const toggle = (path: string): void => {
    const next = new Set(picked);
    if (next.has(path)) {
      next.delete(path);
      for (const [owner, deps] of Object.entries(template.requires ?? {})) {
        if (deps.includes(path)) next.delete(owner);
      }
      setPicked(next);
      return;
    }
    next.add(path);
    setPicked(resolvePicked(next, template.requires));
  };

  const submit = (): void => {
    if (!canSubmit || target === null) return;
    void generateFormFromTemplate(host, target, name, template, picked).then((outcome) => {
      onDone(outcome);
      if (outcome.ok && outcome.openId !== null) host.openResource?.(outcome.openId);
    });
    onClose();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('dialog.generate.title')}</DialogTitle>
        <DialogDescription>
          {t('dialog.generate.description', { name: template.name })}
        </DialogDescription>
      </DialogHeader>

      <div className="min-w-0 space-y-3 py-1">
        <div className="space-y-1.5">
          <Label htmlFor="templates-form-name">{t('form.name')}</Label>
          <Input
            id="templates-form-name"
            data-testid="input-formName"
            autoFocus
            value={name}
            placeholder={t('form.name.placeholder')}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              submit();
            }}
          />
          {name.trim() !== '' && !nameOk ? (
            <p className="text-destructive text-[11px]">{t('form.name.invalid')}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="templates-form-folder">{t('dialog.generate.folder')}</Label>
          {root === null ? (
            // Проекта нет — выбирать не из чего, и это не поломка окна, а состояние
            // приложения: сказать об этом честнее, чем показать пустой список.
            <p className="text-muted-foreground text-[11px]">{t('dialog.generate.no-project')}</p>
          ) : (
            <Select value={target ?? ''} onValueChange={(value) => setFolder(value as ResourceId)}>
              <SelectTrigger
                id="templates-form-folder"
                size="sm"
                data-testid="select-folder"
                className="w-full"
              >
                <SelectValue placeholder={t('dialog.generate.folder.loading')} />
              </SelectTrigger>
              <SelectContent>
                {choices.map((choice) => (
                  <SelectItem key={choice.id} value={choice.id}>
                    {choice.path === '' ? t('dialog.generate.folder.root') : choice.path}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <p className="text-muted-foreground text-[11px]">{t('dialog.generate.folder.hint')}</p>
        </div>

        <Collapsible open={filesOpen} onOpenChange={setFilesOpen} className="min-w-0 space-y-1.5">
          <CollapsibleTrigger className="flex w-full items-center gap-1 text-left">
            <ChevronRight
              aria-hidden="true"
              className={
                filesOpen
                  ? 'text-muted-foreground size-3.5 flex-none rotate-90 transition-transform'
                  : 'text-muted-foreground size-3.5 flex-none transition-transform'
              }
            />
            <Label className="cursor-pointer">
              {t('files.picked', { picked: picked.size, total: template.files.length })}
            </Label>
          </CollapsibleTrigger>
          <CollapsibleContent>
            {/* Своя прокрутка вместо ScrollArea: её область — display:table с min-width:100%,
                она не сжимается ниже содержимого и распирает сетку диалога. */}
            <div className="border-border max-h-52 space-y-2 overflow-y-auto rounded-md border p-2">
              {template.files.map((file) => (
                <label
                  key={file.path}
                  className="flex min-w-0 cursor-pointer items-center gap-2 text-sm"
                >
                  <Checkbox
                    className="flex-none"
                    checked={picked.has(file.path)}
                    onCheckedChange={() => toggle(file.path)}
                  />
                  <span className="min-w-0 truncate">
                    {template.labels?.[file.path] ?? file.path}
                  </span>
                </label>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {t('action.cancel')}
        </Button>
        <Button data-testid="button-generate" disabled={!canSubmit} onClick={submit}>
          {t('action.generate')}
        </Button>
      </DialogFooter>
    </>
  );
}

interface StoreBodyProps {
  readonly template: FormTemplate;
  readonly stores: () => readonly TemplateStore[];
  readonly t: Translate;
  readonly onClose: () => void;
  readonly onDone: (result: OperationResult) => void;
}

function RenameBody({ template, stores, t, onClose, onDone }: StoreBodyProps): ReactNode {
  const [name, setName] = useState(template.name);
  const store = useMemo(() => storeOf(stores(), template.source), [stores, template.source]);
  const canSubmit = name.trim() !== '' && store !== null && canUpdate(store);

  const submit = (): void => {
    if (!canSubmit || store === null) return;
    void renameTemplate(store, template, name).then(onDone);
    onClose();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('dialog.rename.title')}</DialogTitle>
        <DialogDescription>{t('dialog.rename.description')}</DialogDescription>
      </DialogHeader>
      <Input
        autoFocus
        data-testid="input-templateName"
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          submit();
        }}
      />
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {t('action.cancel')}
        </Button>
        <Button disabled={!canSubmit} onClick={submit}>
          {t('action.rename')}
        </Button>
      </DialogFooter>
    </>
  );
}

function RemoveBody({ template, stores, t, onClose, onDone }: StoreBodyProps): ReactNode {
  const store = useMemo(() => storeOf(stores(), template.source), [stores, template.source]);
  const removable = store !== null && canRemove(store);

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('dialog.remove.title')}</DialogTitle>
        <DialogDescription>
          {t(
            template.source === 'project'
              ? 'dialog.remove.description.project'
              : 'dialog.remove.description.local',
            { name: template.name }
          )}
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {t('action.cancel')}
        </Button>
        <Button
          variant="destructive"
          data-testid="button-remove"
          disabled={!removable}
          onClick={() => {
            if (store === null) return;
            void removeTemplate(store, template).then(onDone);
            onClose();
          }}
        >
          {t('action.remove')}
        </Button>
      </DialogFooter>
    </>
  );
}
