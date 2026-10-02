/**
 * Редактор формы RJSF: тело вкладки показывает ЛИБО структуру (поля в порядке показа), ЛИБО
 * отрисованную форму — переключатель стоит в полосе вкладок (`../view`).
 *
 * Свойств выбранного поля здесь нет: они в панели правого дока (`./RjsfInspector`). Связывает их
 * выделение ручки модели — щелчок по строке ставит его, панель читает. Локального «что выбрано»
 * у тела нет намеренно: оболочка пересоздаёт тело на каждую пару «редактор + документ», и выбор
 * терялся бы при каждом переключении вкладки и вида.
 *
 * Форму рисует не редактор, а ПОВЕРХНОСТЬ превью, выбранная хостом превью по провайдеру модели
 * (`reformer.preview.live`): у домена это плагин `reformer.rjsf.render`, и форма в редакторе та же,
 * что в превью, — тема из активного кита. Нет поверхности — вида «форма» нет вовсе, и тело
 * показывает структуру.
 *
 * Каждая правка — операция ручки модели: отмена снимает её целиком, текст документа
 * перепечатывается сам.
 *
 * @module plugins/rjsf/editor/ui/RjsfEditor
 */

import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { displayOrder, type RjsfForm, type RjsfOp } from '@/plugins/rjsf/core';
import type {
  Disposable,
  LiveSurfaceContext,
  ModelDocumentHandle,
  PreviewLiveService,
  ResourceId,
} from '@reformer/builder-plugin-api';
import { addRjsfField, exportRjsfForm, type ExportOutcome, type RjsfServices } from '../commands';
import type { RjsfViewStore } from '../view';
import {
  selectedFieldOf,
  useHandle,
  useLiveRevision,
  useModel,
  useRjsfView,
  useSelection,
  type Translate,
} from './hooks';

const NOOP: Disposable = { dispose: () => {} };
const NO_SELECTION: readonly string[] = Object.freeze([]);
const INPUT_CLASS = 'w-full rounded border border-input bg-background px-2 py-1 text-sm';

export interface RjsfEditorProps {
  readonly documentId: ResourceId;
  readonly services: RjsfServices;
  readonly live: () => PreviewLiveService | undefined;
  /** Чем показана вкладка. Стор плагина: его же читают кнопки в полосе вкладок. */
  readonly view: RjsfViewStore;
  readonly useTranslate: () => Translate;
}

function LiveForm(props: {
  documentId: ResourceId;
  handle: ModelDocumentHandle<RjsfForm>;
  live: PreviewLiveService | undefined;
  t: Translate;
}): ReactElement {
  const { documentId, handle, live, t } = props;
  const element = useRef<HTMLDivElement | null>(null);
  // Выбор перечитывается на каждую отрисовку; о смене состава поверхностей тело редактора
  // узнаёт само (`useLiveRevision`) и перерисовывает этот компонент.
  const chosen = live?.chosen(documentId) ?? null;
  const surfaceId = chosen?.id ?? null;

  const ctx = useMemo<LiveSurfaceContext>(
    () => ({
      schema: () => handle.document.getModel(),
      // Выделение — не правка схемы: форму пересобирает только модель. Поверхность без хит-теста
      // выделения не показывает, поэтому и канал выделения ниже пуст.
      onDidChangeSchema: (cb) =>
        handle.document.onDidChangeModel((change) => {
          if (change.reason !== 'selection') cb();
        }),
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
    <div className="min-h-0 flex-1 overflow-auto" data-testid="rjsf-live">
      {chosen?.notice != null && <p className="px-4 pt-2 text-xs">{chosen.notice}</p>}
      <div ref={element} />
    </div>
  );
}

function exportStatus(outcome: ExportOutcome, t: Translate): string {
  if (outcome.status === 'refused') return t(`editor.export.${outcome.reason}`);
  return outcome.saved ? t('editor.export.saved') : t('editor.export.unsaved');
}

export function RjsfEditor(props: RjsfEditorProps): ReactElement {
  const { documentId, services, live, view, useTranslate } = props;
  const t = useTranslate();
  const handle = useHandle(services, documentId);
  if (handle === null) {
    return <p className="p-4 text-sm text-muted-foreground">{t('editor.notRjsf')}</p>;
  }
  return (
    <RjsfEditorBody
      documentId={documentId}
      services={services}
      live={live()}
      view={view}
      handle={handle}
      t={t}
    />
  );
}

function RjsfEditorBody(props: {
  documentId: ResourceId;
  services: RjsfServices;
  live: PreviewLiveService | undefined;
  view: RjsfViewStore;
  handle: ModelDocumentHandle<RjsfForm>;
  t: Translate;
}): ReactElement {
  const { documentId, services, live, view, handle, t } = props;
  // Поверхность выключили — вид «форма» пропал вместе с кнопками, и тело обязано это увидеть.
  useLiveRevision(live, documentId);
  const mode = useRjsfView(view);

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="rjsf-editor" data-view={mode}>
      {mode === 'form' ? (
        <LiveForm documentId={documentId} handle={handle} live={live} t={t} />
      ) : (
        <StructureView documentId={documentId} services={services} handle={handle} t={t} />
      )}
    </div>
  );
}

/** Структура формы: действия над ней, заголовок и поля в порядке показа. */
function StructureView(props: {
  documentId: ResourceId;
  services: RjsfServices;
  handle: ModelDocumentHandle<RjsfForm>;
  t: Translate;
}): ReactElement {
  const { documentId, services, handle, t } = props;
  const form = useModel(handle);
  const selection = useSelection(handle);
  const [status, setStatus] = useState<string | null>(null);
  const order = displayOrder(form);
  const selected = selectedFieldOf(form, selection);
  const apply = (op: RjsfOp, mergeKey?: string) =>
    handle.apply(op, mergeKey === undefined ? undefined : { mergeKey }).status === 'applied';

  return (
    <div className="flex min-h-0 flex-1 flex-col text-sm" data-testid="rjsf-structure">
      {/* Действия не прокручиваются вместе со списком: на длинной форме они остаются под рукой. */}
      <div className="flex flex-none flex-wrap items-center gap-2 border-b p-3">
        <button
          type="button"
          className="rounded border px-2 py-1"
          data-testid="rjsf-add-field"
          onClick={() => {
            // Выбирать новое поле не нужно: выделение на него переносит сама операция.
            addRjsfField(services, documentId);
          }}
        >
          {t('editor.add')}
        </button>
        <button
          type="button"
          className="rounded border px-2 py-1"
          data-testid="rjsf-export"
          onClick={() => {
            void exportRjsfForm(services, documentId).then((outcome) => {
              setStatus(exportStatus(outcome, t));
            });
          }}
        >
          {t('editor.export')}
        </button>
        {status !== null && (
          <span className="text-xs text-muted-foreground" data-testid="rjsf-status">
            {status}
          </span>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        {/* Ширина ограничена: строка поля на всю вкладку разносит имя и кнопки по краям экрана. */}
        <div className="flex max-w-xl flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="font-medium">{t('editor.formTitle')}</span>
            <input
              className={INPUT_CLASS}
              data-testid="rjsf-title"
              value={form.schema.title ?? ''}
              onChange={(event) => {
                apply({ type: 'set-title', params: { title: event.target.value } }, 'title@form');
              }}
            />
          </label>
          <ul className="flex flex-col gap-1" aria-label={t('editor.fields')}>
            {order.map((name, index) => (
              <li
                key={name}
                className={`flex items-center justify-between gap-2 rounded px-1 py-0.5 ${
                  name === selected ? 'bg-accent' : ''
                }`}
                data-testid={`rjsf-row-${name}`}
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left"
                  aria-pressed={name === selected}
                  onClick={() => {
                    handle.setSelection([name]);
                  }}
                >
                  <span className="font-mono">{name}</span>
                  <span className="text-muted-foreground">
                    {' '}
                    · {t(`type.${form.schema.properties[name]!.type}`)}
                  </span>
                </button>
                <span className="flex shrink-0 gap-1 text-xs text-muted-foreground">
                  <button
                    type="button"
                    disabled={index === 0}
                    aria-label={t('editor.moveUp', { name })}
                    onClick={() => {
                      apply({ type: 'move-field', params: { name, index: index - 1 } });
                    }}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={index === order.length - 1}
                    aria-label={t('editor.moveDown', { name })}
                    onClick={() => {
                      apply({ type: 'move-field', params: { name, index: index + 1 } });
                    }}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    aria-label={t('editor.remove', { name })}
                    onClick={() => {
                      // Выделение снимается ПОСЛЕ операции: в снимок отмены оно ушло прежним,
                      // и отмена вернёт поле выбранным.
                      const removed = apply({ type: 'remove-field', params: { name } });
                      if (removed && name === selected) handle.setSelection([]);
                    }}
                  >
                    ×
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
