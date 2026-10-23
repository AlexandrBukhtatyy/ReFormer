/**
 * Панель экспорта: имя формы, активный кит, состав модуля и отчёт о прогоне.
 *
 * Собрана на `@reformer/ui-kit`: ввод — `Input` с `Label`, решение — `Button`, класс файла —
 * `Badge`, список — `Item`, отказ — `Alert`, прокрутка — `ScrollArea`. Голого HTML здесь ровно
 * столько, сколько нужно на раскладку (`div` колонок и отступов): раскладочных примитивов кит
 * не предлагает, а заворачивать `flex`-колонку в компонент значило бы завести свой.
 *
 * ## Тот же шаг, что у панели свойств
 *
 * Панель стоит в одном доке со «Свойствами», и поле в ней — такая же строка: подпись слева,
 * поле справа, подсказка значком у подписи, высота поля и кнопок — та же. Раньше поле и кнопка
 * здесь были в размере кита по умолчанию (на треть крупнее), а подпись стояла над полем: две
 * соседние вкладки одного дока выглядели как два разных приложения. Класс строки повторён
 * из панели свойств дословно — почему не вынесен, сказано там.
 *
 * ## Отчёт живёт в панели, а не в тосте
 *
 * Пропущенный файл и записанный — разные исходы, и различить их нужно ПОСЛЕ того, как тост
 * исчез. Плюс сообщения уведомлений разрешаются словарём Host, а не плагина (так устроен
 * `NotificationCenter`), то есть ключи плагина показались бы сырыми.
 *
 * @module plugins/reformer/codegen/ui/ExportPanel
 */

import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Alert, AlertDescription } from '@reformer/ui-kit/alert';
import { Badge } from '@reformer/ui-kit/badge';
import { Button } from '@reformer/ui-kit/button';
import { InfoHint } from '@reformer/ui-kit/info-hint';
import { Input } from '@reformer/ui-kit/input';
import { Item, ItemContent, ItemTitle } from '@reformer/ui-kit/item';
import { Label } from '@reformer/ui-kit/label';
import { ScrollArea } from '@reformer/ui-kit/scroll-area';
import { Separator } from '@reformer/ui-kit/separator';
import type { CodegenProblem, CodegenTarget, CodegenText } from '@reformer/builder-plugin-api';
import type { DeliveryResult } from '../pipeline/deliver';
import type { CodegenHost, Translate } from '../host';
import { runCodegen } from '../pipeline/run';
import type { CodegenError, CodegenSessions, CodegenState, CodegenStore } from '../pipeline/state';
import { stackFor, stackText, type Stacks } from '../stacks';

/** Строка поля — та же сетка, что у строки свойства в панели «Свойства». */
const ROW_CLASS = 'grid grid-cols-[minmax(0,min(45%,9rem))_minmax(0,1fr)] items-start gap-x-2';

/** Высота строки подписи — высота поля: текст встаёт напротив его текста. */
const LABEL_CLASS = 'flex min-h-7 min-w-0 items-center gap-1.5';

/** Поле и кнопка в размере панели свойств: на шаг ниже размера кита и мельче текстом. */
const CONTROL_CLASS = 'h-7 text-[12px]';

/** Адреса поля имени формы и скрытого текста его подсказки. */
const FORM_NAME_ID = 'codegen-form-name';
const FORM_NAME_HINT_ID = 'codegen-form-name-hint';

export interface ExportPanelProps {
  readonly host: CodegenHost;
  readonly sessions: CodegenSessions;
  /** Стеки генерации: какой печатает документ, и чьими словами говорить его отказы и заметки. */
  readonly stacks: Stacks;
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
  stacks,
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
      stacks={stacks}
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

/**
 * Активный кит — с подпиской на его смену.
 *
 * Подпись «Кит: …» говорит, чем напечатается модуль, и обязана следовать смене кита сама, а не
 * ждать чужой перерисовки: кит, внесённый плагином, появляется и исчезает вместе с плагином, и
 * без подписки панель показывала бы прежний кит, а печатала — новым. Снимок стабилен между сменами:
 * дескриптор — из проекции, которая памятует по каталогу.
 */
function useActiveKit(host: Pick<CodegenHost, 'kit' | 'onDidChangeKit'>) {
  const subscribe = useCallback(
    (cb: () => void) => {
      const subscription = host.onDidChangeKit(cb);
      return () => {
        subscription.dispose();
      };
    },
    [host]
  );
  const snapshot = useCallback(() => host.kit(), [host]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
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

/** Отказ словами — словарём хозяина либо стека, чей это ключ, с подробностью строкой ниже. */
function ErrorText({
  error,
  t,
  stacks,
}: {
  readonly error: CodegenError;
  readonly t: Translate;
  readonly stacks: Stacks;
}): ReactNode {
  return (
    <>
      {error.stack === undefined
        ? t(error.key, error.params)
        : stackText(stacks, error.stack, error)}
      {error.detail === undefined ? null : <div>{error.detail}</div>}
    </>
  );
}

function ExportFor({
  host,
  sessions,
  stacks,
  targets,
  documentId,
  onEject,
  problems,
}: ExportForProps): ReactNode {
  const t = host.useTranslate();
  const store = sessions.storeFor(documentId);
  const state = useCodegenState(store);
  const document = host.documentOf(documentId);
  const kit = useActiveKit(host);

  // Имя по умолчанию называет стек документа — из имени файла схемы.
  const [name, setName] = useState(() => {
    if (state.formName !== '' || document === null) return state.formName;
    return stackFor(stacks, document)?.stack.formNameOf(document.ref.path) ?? '';
  });

  const generate = useCallback(() => {
    void runCodegen({
      host,
      stacks,
      targets: targets(),
      documentId,
      store,
      formName: name,
      problems: problems?.(),
    });
  }, [host, stacks, targets, documentId, store, name, problems]);

  const running = state.phase === 'running';

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-2">
      <div className={ROW_CLASS} data-export-row="">
        <span className={LABEL_CLASS}>
          {/* `block`, а не `flex` кита: многоточие у гибкого контейнера не рисуется. */}
          <Label
            htmlFor={FORM_NAME_ID}
            title={t('form.name')}
            className="block min-w-0 truncate text-[11px]"
          >
            {t('form.name')}
          </Label>
          {/* Значок стоит вне подписи: внутри неё щелчок по значку уводил бы фокус в поле. */}
          <InfoHint
            content={t('form.name.hint')}
            descriptionId={FORM_NAME_HINT_ID}
            aria-label={t('form.name.hint.label')}
          />
        </span>
        <Input
          id={FORM_NAME_ID}
          aria-describedby={FORM_NAME_HINT_ID}
          data-testid="input-formName"
          className={CONTROL_CLASS}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      {kit === null ? null : (
        <span className="text-muted-foreground text-[11px]">
          {t('kit.active', { label: kit.label, package: kit.package })}
        </span>
      )}

      <Button
        size="sm"
        className={CONTROL_CLASS}
        disabled={running}
        onClick={generate}
        data-testid="button-generate"
      >
        {running ? t('action.running') : t('action.generate')}
      </Button>

      {state.error === null ? null : (
        <Alert variant="destructive">
          <AlertDescription>
            <ErrorText error={state.error} t={t} stacks={stacks} />
          </AlertDescription>
        </Alert>
      )}

      <Separator />

      <ScrollArea className="min-h-0 flex-1">
        <Report state={state} t={t} onEject={onEject} host={host} stacks={stacks} />
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
        className={`${CONTROL_CLASS} justify-start px-0`}
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
  /** Порт — ради «Открыть …» у файла под прежним именем. */
  readonly host?: Pick<CodegenHost, 'resolve' | 'openResource'>;
  /** Стеки — заметки записи говорят словами стека, который печатал. */
  readonly stacks: Stacks;
}

/**
 * Модуль на диске: файлы под прежними именами рядом с новыми и заметки стека — у ReFormer это
 * файлы шагов, которых нет в форме, и файлы прежней плоской раскладки.
 *
 * Отдельной секцией, а не пометкой у файла: все эти случаи — про файлы, которых в составе модуля
 * НЕТ (старое имя, брошенный файл шага, код прежнего контракта), и строки для них в списке файлов
 * модуля не нашлось бы.
 */
function LayoutReport({
  delivery,
  t,
  host,
  translate,
}: {
  readonly delivery: DeliveryResult;
  readonly t: Translate;
  readonly host?: Pick<CodegenHost, 'resolve' | 'openResource'>;
  /** Текст заметки — словами стека, который печатал. */
  readonly translate: (text: CodegenText) => string;
}): ReactNode {
  const open = host?.openResource;
  return (
    <>
      {delivery.legacy.length === 0 ? null : (
        <section className="flex flex-col gap-1" data-testid="codegen-legacy">
          <h3 className="text-foreground text-[12px] font-semibold">{t('legacy.title')}</h3>
          {delivery.legacy.map((entry) => (
            <Alert key={entry.path}>
              <AlertDescription className="flex flex-col gap-1 text-[11px]">
                <span className="font-mono">
                  {t(entry.carried ? 'legacy.carried' : 'legacy.fresh', {
                    path: entry.path,
                    replacedBy: entry.replacedBy,
                  })}
                </span>
                {/* Редактор держит открытым СТАРЫЙ файл, и дальнейшие правки ушли бы в него. */}
                {open === undefined || host === undefined ? null : (
                  <Button
                    size="sm"
                    variant="outline"
                    className={`${CONTROL_CLASS} self-start`}
                    onClick={() => {
                      open(host.resolve(delivery.dir, ...entry.replacedBy.split('/')));
                    }}
                  >
                    {t('legacy.open', { name: entry.replacedBy })}
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          ))}
        </section>
      )}
      {delivery.notes.map((note) => (
        <section key={note.id} className="flex flex-col gap-1" data-testid={`codegen-${note.id}`}>
          <h3 className="text-foreground text-[12px] font-semibold">{translate(note.title)}</h3>
          <span className="text-muted-foreground text-[11px]">{translate(note.detail)}</span>
          {/* Пути печатаются как есть: среди них бывают и каталоги, и файлы. */}
          {note.paths.map((path) => (
            <span key={path} className="font-mono text-[11px]">
              {path}
            </span>
          ))}
        </section>
      ))}
    </>
  );
}

function Report({ state, t, onEject, host, stacks }: ReportProps): ReactNode {
  if (state.files.length === 0) {
    return <Empty title={t('empty.not-run')} detail={t('empty.not-run.detail')} />;
  }

  const delivery = state.delivery;
  const written = new Set(delivery?.written ?? []);
  const skipped = new Map((delivery?.skipped ?? []).map((s) => [s.path, s.reason]));

  return (
    // `contain-inline-size`: отчёт не сообщает родителю свою ширину. Область прокрутки дока —
    // таблица, и она растягивается по самому широкому содержимому; без этого панель целиком
    // раздвигал блок кода с длинной строкой, и поле имени с кнопкой уезжали за край дока.
    // С ним отчёт занимает ширину дока, блок кода прокручивается сам, а строки файлов
    // переносят свои метки.
    <div className="flex flex-col gap-3 [contain:inline-size]" data-testid="codegen-report">
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
                  className={CONTROL_CLASS}
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

      {delivery === null ? null : (
        <LayoutReport
          delivery={delivery}
          t={t}
          host={host}
          translate={(text) =>
            state.stack === null ? text.key : stackText(stacks, state.stack, text)
          }
        />
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
