/**
 * Панель экспорта: имя формы, активный кит, состав модуля и отчёт о прогоне.
 *
 * Собрана на `@reformer/ui-kit`: ввод — `Input` с `Label`, решение — `Button`, класс файла —
 * `Badge`, список — `Item`, отказ — `Alert`, прокрутка — `ScrollArea`. Голого HTML здесь ровно
 * столько, сколько нужно на раскладку (`div` колонок и отступов): раскладочных примитивов кит
 * не предлагает, а заворачивать `flex`-колонку в компонент значило бы завести свой.
 *
 * ## Отчёт живёт в панели, а не в тосте
 *
 * Пропущенный файл и записанный — разные исходы, и различить их нужно ПОСЛЕ того, как тост
 * исчез. Плюс сообщения уведомлений разрешаются словарём Host, а не плагина (так устроен
 * `NotificationCenter`), то есть ключи плагина показались бы сырыми.
 *
 * @module plugins/codegen/ui/ExportPanel
 */

import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Alert, AlertDescription } from '@reformer/ui-kit/alert';
import { Badge } from '@reformer/ui-kit/badge';
import { Button } from '@reformer/ui-kit/button';
import { Input } from '@reformer/ui-kit/input';
import { Item, ItemContent, ItemTitle } from '@reformer/ui-kit/item';
import { Label } from '@reformer/ui-kit/label';
import { ScrollArea } from '@reformer/ui-kit/scroll-area';
import { Separator } from '@reformer/ui-kit/separator';
import type { CodegenTarget } from '../contract';
import type { CodegenProblem } from '../generate';
import type { CodegenHost, Translate } from '../host';
import { defaultFormName, runCodegen } from '../run';
import type { CodegenSessions, CodegenState, CodegenStore } from '../state';

export interface ExportPanelProps {
  readonly host: CodegenHost;
  readonly sessions: CodegenSessions;
  /** Цели читаются лениво: их вносят и снимают, в том числе чужие плагины. */
  readonly targets: () => readonly CodegenTarget[];
  /**
   * Выгрузить шаблон цели в проект.
   *
   * Пропом, а не командой изнутри: у панели нет диспетчера команд, а заводить его ради
   * одной кнопки значило бы дать ей право звать что угодно. Отсутствие пропа —
   * законная сборка без выгрузки: кнопки просто нет.
   */
  readonly onEject?: (targetId: string) => void;
  /**
   * Отказы разбора пользовательских целей.
   *
   * Нужны и здесь, и команде: без них кнопка панели молча печатала бы встроенными
   * целями, а человек считал бы, что его шаблон применился.
   */
  readonly problems?: () => readonly CodegenProblem[];
}

export function ExportPanel({
  host,
  sessions,
  targets,
  onEject,
  problems,
}: ExportPanelProps): ReactNode {
  const t = host.useTranslate();
  const documentId = host.useActiveDocument();

  useEffect(() => {
    // Панель сообщает реестру, на что смотрит: команде этот ответ нужен, а своего способа
    // узнать активную вкладку у неё нет.
    sessions.setActive(documentId);
  }, [sessions, documentId]);

  if (documentId === null) {
    return <Empty title={t('empty.no-document')} detail={t('empty.no-document.detail')} />;
  }
  // Ключ по документу: состояние принадлежит ему, и смена вкладки обязана пересоздать поле
  // ввода имени, а не показать имя чужой формы.
  return (
    <ExportFor
      key={documentId}
      host={host}
      sessions={sessions}
      targets={targets}
      onEject={onEject}
      problems={problems}
      documentId={documentId}
    />
  );
}

interface ExportForProps extends ExportPanelProps {
  readonly documentId: string;
}

function useCodegenState(store: CodegenStore): CodegenState {
  return useSyncExternalStore(
    (cb) => {
      const subscription = store.subscribe(cb);
      return () => {
        subscription.dispose();
      };
    },
    () => store.get()
  );
}

function ExportFor({
  host,
  sessions,
  targets,
  documentId,
  onEject,
  problems,
}: ExportForProps): ReactNode {
  const t = host.useTranslate();
  const store = sessions.storeFor(documentId);
  const state = useCodegenState(store);
  const document = host.documentOf(documentId);
  const kit = host.kit();

  const [name, setName] = useState(
    () => state.formName || (document === null ? '' : defaultFormName(document))
  );

  const generate = useCallback(() => {
    void runCodegen({
      host,
      targets: targets(),
      documentId,
      store,
      formName: name,
      problems: problems?.(),
    });
  }, [host, targets, documentId, store, name, problems]);

  const running = state.phase === 'running';

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="codegen-form-name">{t('form.name')}</Label>
        <Input
          id="codegen-form-name"
          data-testid="input-formName"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <span className="text-muted-foreground text-[11px]">{t('form.name.hint')}</span>
      </div>

      {kit === null ? null : (
        <span className="text-muted-foreground text-[11px]">
          {t('kit.active', { label: kit.label, package: kit.package })}
        </span>
      )}

      <Button size="sm" disabled={running} onClick={generate} data-testid="button-generate">
        {running ? t('action.running') : t('action.generate')}
      </Button>

      {state.errorKey === null ? null : (
        <Alert variant="destructive">
          <AlertDescription>{t(state.errorKey)}</AlertDescription>
        </Alert>
      )}

      <Separator />

      <ScrollArea className="min-h-0 flex-1">
        <Report state={state} t={t} onEject={onEject} />
      </ScrollArea>
    </div>
  );
}

/**
 * Данные, которые видели шаблоны, — тот самый `it`.
 *
 * Первый вопрос автора шаблона — «что мне доступно?», и ответом не может быть «читай
 * исходники вида». Свёрнут по умолчанию: тем, кто шаблоны не пишет, он не нужен.
 *
 * Функции-хелперы (`indent`, `json`, `blocks`) `JSON.stringify` отбрасывает сам, и это
 * к лучшему: в дереве данных им делать нечего, а их наличие документируется отдельно.
 */
function ViewInspector({ view, t }: { view: object; t: Translate }): ReactNode {
  const [open, setOpen] = useState(false);
  return (
    <section className="flex flex-col gap-1">
      <Button
        size="sm"
        variant="ghost"
        className="justify-start px-0"
        onClick={() => {
          setOpen((value) => !value);
        }}
      >
        {open ? '▾' : '▸'} {t('panel.view-data')}
      </Button>
      {!open ? null : (
        <pre className="bg-muted max-h-64 overflow-auto rounded-md p-2 font-mono text-[11px]">
          {JSON.stringify(view, null, 2)}
        </pre>
      )}
    </section>
  );
}

interface ReportProps {
  readonly state: CodegenState;
  readonly t: Translate;
  readonly onEject?: (targetId: string) => void;
}

function Report({ state, t, onEject }: ReportProps): ReactNode {
  if (state.files.length === 0) {
    return <Empty title={t('empty.not-run')} detail={t('empty.not-run.detail')} />;
  }

  const delivery = state.delivery;
  const written = new Set(delivery?.written ?? []);
  const skipped = new Map((delivery?.skipped ?? []).map((s) => [s.path, s.reason]));

  return (
    <div className="flex flex-col gap-3">
      <section className="flex flex-col gap-1">
        <h3 className="text-foreground text-[12px] font-semibold">{t('files.title')}</h3>
        {state.files.map((file) => {
          const reason = skipped.get(file.path);
          return (
            <Item key={file.path} size="sm" variant="muted">
              <ItemContent>
                <ItemTitle className="font-mono text-[12px]">{file.path}</ItemTitle>
                {reason === undefined ? null : (
                  <span className="text-muted-foreground text-[11px]">{t(`skip.${reason}`)}</span>
                )}
              </ItemContent>
              {file.origin !== 'user' ? null : (
                <Badge variant="outline">{t('file.origin.user')}</Badge>
              )}
              <Badge variant={written.has(file.path) ? 'default' : 'secondary'}>
                {t(`files.${file.cls}`)}
              </Badge>
              {onEject === undefined ? null : (
                <Button
                  size="sm"
                  variant="ghost"
                  title={t('command.eject-template')}
                  onClick={() => {
                    onEject(file.targetId);
                  }}
                >
                  ⤓
                </Button>
              )}
            </Item>
          );
        })}
      </section>

      {delivery === null ? null : (
        <section className="flex flex-col gap-0.5 text-[11.5px]">
          <span>{t('result.written', { count: delivery.written.length })}</span>
          {delivery.skipped.length === 0 ? null : (
            <span>{t('result.skipped', { count: delivery.skipped.length })}</span>
          )}
          {delivery.failed.length === 0 ? null : (
            <span className="text-destructive">
              {t('result.failed', { count: delivery.failed.length })}
            </span>
          )}
          <span className="text-muted-foreground">
            {delivery.saved === true ? t('result.saved') : t('result.unsaved')}
          </span>
        </section>
      )}

      {state.problems.length === 0 ? null : (
        <section className="flex flex-col gap-1">
          <h3 className="text-foreground text-[12px] font-semibold">{t('problems.title')}</h3>
          {state.problems.map((problem) => (
            <Alert key={`${problem.targetId}:${problem.path}`} variant="destructive">
              {/*
                `whitespace-pre-wrap` не косметика: сообщение Eta многострочное — номер
                строки, окно ±3 строки и каретка под колонкой. Схлопнутое в строку, оно
                перестаёт отвечать на вопрос «где чинить», ради которого и заведено.
              */}
              <AlertDescription className="font-mono text-[11px] whitespace-pre-wrap">
                {problem.path} — {t(`problem.${problem.reason}`, { message: problem.message })}
              </AlertDescription>
            </Alert>
          ))}
        </section>
      )}

      {state.view === null ? null : <ViewInspector view={state.view} t={t} />}

      {state.snippet === '' ? null : (
        <section className="flex flex-col gap-1">
          <h3 className="text-foreground text-[12px] font-semibold">{t('snippet.title')}</h3>
          {/* `pre` голым: кит блока кода не предлагает, а `Item` схлопнул бы переносы. */}
          <pre className="bg-muted overflow-x-auto rounded p-2 font-mono text-[11px]">
            {state.snippet}
          </pre>
        </section>
      )}
    </div>
  );
}

interface EmptyProps {
  readonly title: string;
  readonly detail: string;
}

function Empty({ title, detail }: EmptyProps): ReactNode {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="border-border max-w-sm rounded-md border border-dashed p-4 text-center">
        <div className="text-foreground text-[13px] font-medium">{title}</div>
        <div className="text-muted-foreground mt-1 text-[12px]">{detail}</div>
      </div>
    </div>
  );
}
