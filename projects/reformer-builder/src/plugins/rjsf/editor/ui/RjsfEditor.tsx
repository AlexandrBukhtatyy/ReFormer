/**
 * Редактор формы RJSF: тело вкладки показывает ЛИБО структуру (поля в порядке показа), ЛИБО
 * отрисованную форму — переключатель стоит в полосе вкладок (`../view`).
 *
 * Свойств здесь нет — ни поля, ни формы: они в панели правого дока (`./RjsfInspector`), там же
 * заголовок формы и её экспорт. Связывает их выделение ручки модели — щелчок по строке ставит
 * его, панель читает. Строка формы стоит над полями и выделение снимает: пустое выделение
 * и значит «выбрана форма целиком». Локального «что выбрано» у тела нет намеренно: оболочка
 * пересоздаёт тело на каждую пару «редактор + документ», и выбор терялся бы при каждом
 * переключении вкладки и вида.
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

import { useEffect, useMemo, useRef, type ReactElement } from 'react';
import { displayOrder, type RjsfForm, type RjsfOp } from '@/plugins/rjsf/core';
import type {
  Disposable,
  LiveSurfaceContext,
  ModelDocumentHandle,
  PreviewLiveService,
  ResourceId,
} from '@reformer/builder-plugin-api';
import { addRjsfField, type RjsfServices } from '../commands';
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
/** Строка структуры: выбранная залита, остальные откликаются на указатель по всей ширине. */
const rowClass = (selected: boolean): string =>
  `rounded px-2 py-1 ${selected ? 'bg-accent' : 'hover:bg-accent/50'}`;

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

/**
 * Структура формы: строка формы, под ней поля в порядке показа и кнопка нового поля.
 *
 * Прокручивается только список полей. Строка формы и кнопка стоят вокруг него и остаются под
 * рукой на длинной форме: первая — способ выбрать форму целиком, вторая — всегда «в конце».
 */
function StructureView(props: {
  documentId: ResourceId;
  services: RjsfServices;
  handle: ModelDocumentHandle<RjsfForm>;
  t: Translate;
}): ReactElement {
  const { documentId, services, handle, t } = props;
  const form = useModel(handle);
  const selection = useSelection(handle);
  const list = useRef<HTMLUListElement | null>(null);
  const order = displayOrder(form);
  const selected = selectedFieldOf(form, selection);
  const title = form.schema.title ?? '';
  const apply = (op: RjsfOp) => handle.apply(op).status === 'applied';

  // Выбранное поле — на виду: новое встаёт в конец списка, а список длинной формы прокручен.
  useEffect(() => {
    if (selected === null) return;
    list.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1 p-3 text-sm" data-testid="rjsf-structure">
      {/* Выделение не «снимается в никуда»: пустое выделение — это выбранная форма, и панель
          показывает её свойства. */}
      <button
        type="button"
        className={`flex-none truncate text-left ${rowClass(selected === null)}`}
        data-testid="rjsf-row-form"
        aria-pressed={selected === null}
        onClick={() => {
          handle.setSelection([]);
        }}
      >
        <span className="font-medium">{t('editor.form')}</span>
        {title !== '' && <span className="text-muted-foreground"> · {title}</span>}
      </button>
      {order.length > 0 && (
        <ul
          ref={list}
          className="flex min-h-0 flex-col gap-1 overflow-auto pl-4"
          aria-label={t('editor.fields')}
        >
          {order.map((name, index) => (
            <li
              key={name}
              className={`flex items-center justify-between gap-2 ${rowClass(name === selected)}`}
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
      )}
      <button
        type="button"
        className="w-full flex-none rounded border border-dashed px-2 py-1.5 text-muted-foreground hover:bg-accent/50 hover:text-foreground"
        data-testid="rjsf-add-field"
        onClick={() => {
          // Выбирать новое поле не нужно: выделение на него переносит сама операция.
          addRjsfField(services, documentId);
        }}
      >
        + {t('editor.add')}
      </button>
    </div>
  );
}
