/**
 * Тело редактора: Monaco над буфером документа.
 *
 * Компонент намеренно **тонкий**. Всё, что можно решить без редактора, решено чистыми
 * функциями рядом:
 *
 * ```text
 * sync.ts         перерисовывать буфер или нет, и что делать с эхом своей же записи
 * markers.ts      диагностика → места в тексте
 * node-ranges.ts  идентификатор узла → диапазон, разбором текста с позициями
 * view-state.ts   прокрутка и каретка
 * input.ts        какое нажатие принадлежит редактору, а какое — глобальному слою
 * language.ts     медиатип → язык и адрес модели
 * ```
 *
 * Здесь остаётся то, что без Monaco непроверяемо: подписки на его события, перевод смещений
 * в координаты и вызовы его API. Окружение тестов — `node`, поднять в нём редактор нечем,
 * поэтому граница проведена именно так.
 *
 * ## Правка идёт в буфер, а не в модель
 *
 * Набранное уходит в `writeText` рабочей области. Что дальше сделает с этим провайдер
 * модели — разберёт, оставит документ в расхождении, перерисует, — редактора не касается:
 * знай он про модель, у документа появилось бы два владельца правки.
 *
 * ## История Monaco не подменяется
 *
 * Ctrl+Z в пределах сеанса работает его собственным стеком, и снимков модели он не касается.
 * Внешний текст кладётся `executeEdits` (так делает `@monaco-editor/react` для управляемого
 * `value`), а не `setValue`: первый — правка поверх стека, второй сносит стек целиком.
 * Подменить историю значило бы получить двойную отмену — одно нажатие снимает две правки.
 *
 * @module plugins/editor-monaco/ui/MonacoEditor
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import Editor, { type Monaco, type OnMount } from '@monaco-editor/react';
import type { editor as MonacoEditor } from 'monaco-editor';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@reformer/ui-kit/empty';
import { Skeleton } from '@reformer/ui-kit/skeleton';
import type { DiagnosticSeverity, ResourceId } from '@/sdk';
import type { MonacoFocusRegistry } from '../sync/focus';
import type { MonacoDocument, MonacoHost, Translate } from '../host';
import { shouldStopPropagation } from '../sync/input';
import { languageFor, modelPathFor } from '../runtime/language';
import { hasNodeTargets, planMarkers, type MarkerDraft } from '../diagnostics/markers';
import { ensureMonaco } from '../runtime/monaco-setup';
import { indexTextNodes, pathKey, type TextNodeIndex } from '../diagnostics/node-ranges';
import { createSyncState, reduceSync, type SyncEvent, type SyncState } from '../sync/sync';
import { monacoThemeFor, useDarkTheme } from '../runtime/theme';
import type { ViewStateRegistry } from '../sync/view-state';

/**
 * Владелец маркеров в Monaco.
 *
 * Один на редактор, а не на источник диагностики: `setModelMarkers` замещает набор владельца
 * целиком, и это ровно та семантика, что у `DiagnosticsService.publish`, — свод ресурса
 * приходит готовым, и класть его частями значило бы оставлять исправленное на экране.
 */
const MARKER_OWNER = 'reformer.diagnostics';

/** Пустой указатель узлов: одна ссылка вместо новых карт на каждый показ. */
const NO_INDEX: TextNodeIndex = Object.freeze({ byId: new Map(), byPath: new Map() });

function severityOf(
  monaco: Monaco,
  severity: DiagnosticSeverity
): MonacoEditor.IMarkerData['severity'] {
  if (severity === 'error') return monaco.MarkerSeverity.Error;
  if (severity === 'warning') return monaco.MarkerSeverity.Warning;
  return monaco.MarkerSeverity.Info;
}

/** Смещения в координаты Monaco: перевод умеет только модель, поэтому он здесь, а не в `markers`. */
function toMarker(
  monaco: Monaco,
  model: MonacoEditor.ITextModel,
  draft: MarkerDraft,
  message: Translate
): MonacoEditor.IMarkerData {
  const start = model.getPositionAt(draft.range.start);
  const end = model.getPositionAt(draft.range.end);
  return {
    severity: severityOf(monaco, draft.severity),
    message: message(draft.code, draft.params),
    source: draft.source,
    code: draft.code,
    startLineNumber: start.lineNumber,
    startColumn: start.column,
    endLineNumber: end.lineNumber,
    endColumn: end.column,
  };
}

/** Пустое состояние в том же виде, в каком его рисует центр оболочки. */
function EmptyState({ title, description }: { title: string; description?: string }): ReactElement {
  return (
    <Empty className="flex-1 border-0">
      <EmptyHeader>
        <EmptyTitle className="text-sm font-medium">{title}</EmptyTitle>
        {description !== undefined && (
          <EmptyDescription className="text-xs">{description}</EmptyDescription>
        )}
      </EmptyHeader>
    </Empty>
  );
}

/** Заглушка на время загрузки чанка Monaco: контур редактора, а не крутящийся круг. */
function LoadingSkeleton({ label }: { label: string }): ReactElement {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 p-3" role="status" aria-label={label}>
      <Skeleton className="h-3 w-1/3" />
      <Skeleton className="h-3 w-2/3" />
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="min-h-0 flex-1" />
    </div>
  );
}

export interface MonacoEditorProps {
  readonly host: MonacoHost;
  readonly focus: MonacoFocusRegistry;
  readonly viewStates: ViewStateRegistry;
  readonly documentId: ResourceId;
}

interface BodyProps extends MonacoEditorProps {
  readonly document: MonacoDocument;
}

function Body({ host, focus, viewStates, documentId, document }: BodyProps): ReactElement {
  const t = host.useTranslate();
  const diagnosticMessage = host.useDiagnosticMessage();
  const dark = useDarkTheme();

  const [value, setValue] = useState(() => document.getText());
  const [loaded, setLoaded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const syncRef = useRef<SyncState>(createSyncState());
  /** Что показано сейчас: нужен, пока редактор ещё не смонтирован и спросить его нечего. */
  const shownRef = useRef(value);

  const show = useCallback((text: string) => {
    shownRef.current = text;
    setValue(text);
  }, []);

  /**
   * Шаг связи с буфером: решение принимает чистый редуктор, здесь остаётся исполнение.
   *
   * Событие «запись завершилась» применяется прямо в `finally` и каскада не даёт (его исход
   * всегда «ничего»), поэтому рекурсии нет и ссылка на саму себя не нужна.
   */
  const dispatch = useCallback(
    (event: SyncEvent) => {
      const outcome = reduceSync(syncRef.current, event);
      syncRef.current = outcome.state;
      const action = outcome.action;
      if (action.kind === 'apply') {
        show(action.text);
        return;
      }
      if (action.kind === 'write') {
        // В рабочую копию, а не в источник: наружу выходит только `save`. Отказ записи
        // не откатывает набранное — истина уже на экране, и терять её из-за сбоя хранилища
        // хуже, чем разойтись с рабочей копией до следующего нажатия.
        void host
          .writeText(documentId, action.text)
          .catch((error: unknown) => {
            console.error(`[editor-monaco] правка не записана: ${documentId}`, error);
          })
          .finally(() => {
            syncRef.current = reduceSync(syncRef.current, {
              kind: 'written',
              text: action.text,
            }).state;
          });
      }
    },
    [host, documentId, show]
  );

  // Monaco грузится отдельным чанком: до его настройки рисовать `<Editor>` нельзя —
  // он пойдёт за редактором в сеть (см. `monaco-setup.ts`).
  useEffect(() => {
    let alive = true;
    void ensureMonaco().then(
      () => {
        if (alive) setLoaded(true);
      },
      (error: unknown) => {
        if (!alive) return;
        setFailure(error instanceof Error ? error.message : String(error));
      }
    );
    return () => {
      alive = false;
    };
  }, []);

  // Буфер сменился: своей записью, откатом, слиянием или перерисовкой по модели.
  useEffect(() => {
    const subscription = document.onDidChangeContent((text) => {
      dispatch({
        kind: 'buffer',
        text,
        editorText: editorRef.current?.getValue() ?? shownRef.current,
        focused: focus.isFocused(documentId),
      });
    });
    return () => {
      subscription.dispose();
    };
  }, [document, dispatch, focus, documentId]);

  // Закрытая вкладка не может остаться «в фокусе»: иначе рабочая область навсегда отложит
  // перерисовку буфера этого документа и ход ассистента в нём молча повиснет.
  useEffect(() => {
    return () => {
      focus.setFocused(documentId, false);
    };
  }, [focus, documentId]);

  const onMount = useCallback<OnMount>(
    (editor, monaco) => {
      editorRef.current = editor;
      monacoRef.current = monaco;

      const recordViewState = (): void => {
        const position = editor.getPosition();
        viewStates.record(documentId, {
          scrollTop: editor.getScrollTop(),
          scrollLeft: editor.getScrollLeft(),
          line: position?.lineNumber ?? 1,
          column: position?.column ?? 1,
        });
      };

      const saved = viewStates.peek(documentId);
      if (saved !== null) {
        editor.setPosition({ lineNumber: saved.line, column: saved.column });
        editor.setScrollTop(saved.scrollTop);
        editor.setScrollLeft(saved.scrollLeft);
      }

      const subscriptions = [
        editor.onDidScrollChange(recordViewState),
        editor.onDidChangeCursorPosition(recordViewState),
        editor.onDidFocusEditorText(() => {
          focus.setFocused(documentId, true);
        }),
        editor.onDidBlurEditorText(() => {
          // Порядок несущий: сначала снимаем фокус, потом просим рабочую область догнать
          // буфер моделью — иначе она увидит фокус на месте и отложит перерисовку снова.
          focus.setFocused(documentId, false);
          dispatch({ kind: 'blur', editorText: editor.getValue() });
          void Promise.resolve(host.flush?.(documentId)).catch((error: unknown) => {
            console.error(`[editor-monaco] перерисовка буфера отказала: ${documentId}`, error);
          });
        }),
      ];

      // Ввод принадлежит редактору: обработанное Monaco не должно дойти до глобального
      // диспетчера, который стоит на `document` в фазе всплытия. См. `input.ts`.
      const node = editor.getDomNode();
      const onKeyDown = (event: KeyboardEvent): void => {
        if (shouldStopPropagation(event)) event.stopPropagation();
      };
      node?.addEventListener('keydown', onKeyDown);

      editor.onDidDispose(() => {
        node?.removeEventListener('keydown', onKeyDown);
        for (const subscription of subscriptions) subscription.dispose();
        editorRef.current = null;
      });

      setMounted(true);
    },
    [dispatch, documentId, focus, host, viewStates]
  );

  // Разметка: свод диагностик ресурса целиком, при каждом его изменении и при каждой правке
  // текста — места узлов считаются по ТОМУ тексту, который сейчас в редакторе.
  useEffect(() => {
    if (!mounted) return;
    const publish = (): void => {
      const monaco = monacoRef.current;
      const model = editorRef.current?.getModel();
      if (monaco === null || model === undefined || model === null) return;
      const items = host.diagnostics.get(documentId);
      const text = model.getValue();
      const withNodes = hasNodeTargets(items);
      const index = withNodes ? indexTextNodes(text) : NO_INDEX;
      // Узел, чьего идентификатора в тексте нет, ищется по пути: «идентификатор → путь» знает
      // порт по модели документа, «путь → место» — указатель по этому же тексту.
      const paths = withNodes ? (host.locateNodes?.(documentId) ?? null) : null;
      const plan = planMarkers(items, text, index.byId, (nodeId) => {
        const path = paths?.get(nodeId);
        return path === undefined ? undefined : index.byPath.get(pathKey(path));
      });
      monaco.editor.setModelMarkers(
        model,
        MARKER_OWNER,
        plan.markers.map((draft) => toMarker(monaco, model, draft, diagnosticMessage))
      );
    };

    publish();
    const subscription = host.diagnostics.onDidChange((resource) => {
      if (resource === documentId) publish();
    });
    return () => {
      subscription.dispose();
    };
  }, [mounted, host, documentId, diagnosticMessage, value]);

  const options = useMemo<MonacoEditor.IStandaloneEditorConstructionOptions>(
    () => ({
      ariaLabel: t('editor.label'),
      automaticLayout: true,
      fontSize: 12,
      lineHeight: 18,
      minimap: { enabled: false },
      renderWhitespace: 'selection',
      scrollBeyondLastLine: false,
      tabSize: 2,
      // Всплывающие виджеты (поиск, подсказки) не должны обрезаться панелями оболочки.
      fixedOverflowWidgets: true,
    }),
    [t]
  );

  if (failure !== null) {
    return (
      <EmptyState
        title={t('editor.failed.title')}
        description={t('editor.failed.description', { message: failure })}
      />
    );
  }

  if (!loaded) return <LoadingSkeleton label={t('editor.loading')} />;

  return (
    <Editor
      className="min-h-0 flex-1"
      height="100%"
      language={languageFor(document.ref.mediaType)}
      loading={<LoadingSkeleton label={t('editor.loading')} />}
      onChange={(next) => {
        if (next === undefined) return;
        shownRef.current = next;
        setValue(next);
        dispatch({ kind: 'typed', text: next });
      }}
      onMount={onMount}
      options={options}
      path={modelPathFor(document.ref)}
      // Состоянием вида ведает вклад редактора (`viewState` в `plugin.ts`), а не библиотека:
      // её снимок несёт ВЫДЕЛЕНИЕ, которому в состоянии вида не место — см. `view-state.ts`.
      saveViewState={false}
      theme={monacoThemeFor(dark)}
      value={value}
      wrapperProps={{ className: 'flex min-h-0 flex-1 flex-col' }}
    />
  );
}

/**
 * Редактор для вкладки.
 *
 * Документ берётся у платформы по идентификатору: держать его пропом значило бы, что
 * оболочка знает, кому какой документ показывать, — а она знает только пары
 * «редактор + ресурс».
 */
export function MonacoEditorBody(props: MonacoEditorProps): ReactElement | null {
  const document = props.host.documentOf(props.documentId);
  if (document === null) return null;
  return <Body {...props} document={document} />;
}
