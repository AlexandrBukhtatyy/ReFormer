/**
 * Редактор документа демо-стека: список полей слева, живая форма справа.
 *
 * Форму рисует не редактор, а ПОВЕРХНОСТЬ превью, выбранная хостом превью по провайдеру модели
 * (`reformer.preview.live`). Редактор лишь отдаёт ей модель и место на экране — тот же приём,
 * что у редактора схемы ReFormer, только поверхность другая. Нет превью в составе — форма
 * не рисуется, а редактор честно говорит почему.
 *
 * @module plugins/plain/ui/PlainEditor
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactElement,
} from 'react';
import type { PlainForm } from '@reformer/builder-stack-plain';
import type {
  Disposable,
  LiveSurfaceContext,
  ModelDocumentHandle,
  PreviewLiveService,
  ResourceId,
} from '@reformer/builder-plugin-api';
import {
  addPlainField,
  exportPlainForm,
  plainHandleOf,
  type ExportOutcome,
  type PlainServices,
} from '../commands';

type Translate = (key: string, params?: Record<string, unknown>) => string;

const NOOP: Disposable = { dispose: () => {} };
const NO_SELECTION: readonly string[] = Object.freeze([]);

export interface PlainEditorProps {
  readonly documentId: ResourceId;
  readonly services: PlainServices;
  readonly live: () => PreviewLiveService | undefined;
  readonly useTranslate: () => Translate;
}

/** Ручка документа как внешнее состояние: вкладка открывается раньше, чем модель готова. */
function useHandle(services: PlainServices, documentId: ResourceId) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const subscription = services.documents()?.onDidChange(onChange) ?? NOOP;
      return () => {
        subscription.dispose();
      };
    },
    [services]
  );
  const snapshot = useCallback(() => plainHandleOf(services, documentId), [services, documentId]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** Модель документа: перечитывается на каждую правку, отмену и разбор. */
function useModel(handle: ModelDocumentHandle<PlainForm>): PlainForm {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const subscription = handle.document.onDidChangeModel(onChange);
      return () => {
        subscription.dispose();
      };
    },
    [handle]
  );
  const snapshot = useCallback(() => handle.document.getModel(), [handle]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

function LiveForm(props: {
  documentId: ResourceId;
  handle: ModelDocumentHandle<PlainForm>;
  live: PreviewLiveService | undefined;
  t: Translate;
}): ReactElement {
  const { documentId, handle, live, t } = props;
  const element = useRef<HTMLDivElement | null>(null);
  // Состав поверхностей меняется (плагин выключили) — перечитать выбор. Счётчик, а не снимок:
  // `chosen()` собирает объект на каждый вызов.
  const [, setVersion] = useState(0);
  useEffect(() => {
    const subscription = live?.onDidChange(documentId, () => {
      setVersion((previous) => previous + 1);
    });
    return () => {
      subscription?.dispose();
    };
  }, [live, documentId]);
  const chosen = live?.chosen(documentId) ?? null;
  const surfaceId = chosen?.id ?? null;

  const ctx = useMemo<LiveSurfaceContext>(
    () => ({
      schema: () => handle.document.getModel(),
      onDidChangeSchema: (cb) => handle.document.onDidChangeModel(() => cb()),
      selection: () => NO_SELECTION,
      onDidChangeSelection: () => NOOP,
      select: () => {},
    }),
    [handle]
  );

  useEffect(() => {
    const host = element.current;
    if (host === null || live === undefined || surfaceId === null) return;
    const mounted = live.mount(documentId, host, ctx);
    return () => {
      mounted?.dispose();
    };
  }, [live, documentId, ctx, surfaceId]);

  if (live === undefined || surfaceId === null) {
    return <p className="p-4 text-sm text-muted-foreground">{t('editor.noLive')}</p>;
  }
  return (
    <div className="min-h-0 flex-1 overflow-auto" data-testid="plain-live">
      {chosen?.notice != null && <p className="px-4 pt-2 text-xs">{chosen.notice}</p>}
      <div ref={element} />
    </div>
  );
}

function exportStatus(outcome: ExportOutcome, t: Translate): string {
  if (outcome.status === 'refused') return t(`editor.export.${outcome.reason}`);
  return outcome.saved ? t('editor.export.saved') : t('editor.export.unsaved');
}

export function PlainEditor(props: PlainEditorProps): ReactElement {
  const { documentId, services, live, useTranslate } = props;
  const t = useTranslate();
  const handle = useHandle(services, documentId);
  if (handle === null) {
    return <p className="p-4 text-sm text-muted-foreground">{t('editor.notPlain')}</p>;
  }
  return (
    <PlainEditorBody
      documentId={documentId}
      services={services}
      live={live}
      handle={handle}
      t={t}
    />
  );
}

function PlainEditorBody(props: {
  documentId: ResourceId;
  services: PlainServices;
  live: () => PreviewLiveService | undefined;
  handle: ModelDocumentHandle<PlainForm>;
  t: Translate;
}): ReactElement {
  const { documentId, services, live, handle, t } = props;
  const form = useModel(handle);
  const [status, setStatus] = useState<string | null>(null);

  return (
    <div className="flex h-full min-h-0" data-testid="plain-editor">
      <aside className="flex w-72 shrink-0 flex-col gap-2 border-r p-3 text-sm">
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded border px-2 py-1"
            data-testid="plain-add-field"
            onClick={() => {
              addPlainField(services, documentId);
            }}
          >
            {t('editor.add')}
          </button>
          <button
            type="button"
            className="rounded border px-2 py-1"
            data-testid="plain-export"
            onClick={() => {
              void exportPlainForm(services, documentId).then((outcome) => {
                setStatus(exportStatus(outcome, t));
              });
            }}
          >
            {t('editor.export')}
          </button>
        </div>
        {status !== null && (
          <p className="text-xs text-muted-foreground" data-testid="plain-status">
            {status}
          </p>
        )}
        <ul className="flex flex-col gap-1" aria-label={t('editor.fields')}>
          {form.fields.map((field, index) => (
            <li
              key={`${index}:${field.name}`}
              className="flex items-center justify-between gap-2 rounded px-1 py-0.5"
              data-testid={`plain-field-${index}`}
            >
              <span>
                <span className="font-mono">{field.name}</span>
                <span className="text-muted-foreground"> · {field.type}</span>
              </span>
              <button
                type="button"
                className="text-xs text-muted-foreground"
                aria-label={t('editor.remove', { name: field.name })}
                onClick={() => {
                  handle.apply({ type: 'remove-field', params: { name: field.name } });
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <LiveForm documentId={documentId} handle={handle} live={live()} t={t} />
    </div>
  );
}
