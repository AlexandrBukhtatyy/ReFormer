/**
 * Панель превью: переключатель поверхностей и место, куда смонтирована выбранная.
 *
 * ## Смонтирована ровно одна
 *
 * Это следует из решения «состояние превью живёт вне поверхности»: раз выбор режима, выделение
 * и находки принадлежат документу, а не компоненту, поверхность можно свободно размонтировать
 * при переключении. Держать вторую про запас незачем — она стоила бы второй сборки формы
 * и второго исполнения сайдкаров.
 *
 * ## Монтирование императивное, а не через React
 *
 * `mount(element, ctx)` — контракт поверхности, и он намеренно не React: точка расширения
 * открыта, а внешнее превью это iframe. Панель поэтому даёт элемент и снимает подписку,
 * а чем поверхность его наполнит — не её дело.
 *
 * @module plugins/preview/ui/PreviewPanel
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Disposable } from '@/sdk';
import type { PreviewSurface, SurfaceCatalog } from '../contract';
import { createPreviewContext } from '../context';
import type { PreviewHost } from '../host';
import type { PreviewSessions } from '../sessions';
import { chooseSurface, type SurfaceOption } from '../selection';
import { refusalMessageKey } from '../source-guard';
import { Notice } from './Notice';
import { usePreviewState } from './hooks';

export interface PreviewPanelProps {
  readonly host: PreviewHost;
  readonly sessions: PreviewSessions;
  readonly surfaces: SurfaceCatalog;
}

export function PreviewPanel({ host, sessions, surfaces }: PreviewPanelProps): ReactNode {
  const t = host.useTranslate();
  const documentId = host.useActiveDocument();

  useEffect(() => {
    // Панель сообщает реестру, на что смотрит: своего способа узнать активную вкладку
    // у реестра нет, а команде переключения поверхности этот ответ нужен.
    sessions.setActive(documentId);
  }, [sessions, documentId]);

  if (documentId === null) {
    return <Notice title={t('empty.no-document')} detail={t('empty.no-document.detail')} />;
  }
  // Ключ по документу: контекст, состояние и смонтированная поверхность принадлежат ему,
  // и смена вкладки обязана пересоздать их, а не переиспользовать чужие.
  return (
    <PreviewFor
      key={documentId}
      host={host}
      sessions={sessions}
      surfaces={surfaces}
      documentId={documentId}
    />
  );
}

interface PreviewForProps extends PreviewPanelProps {
  readonly documentId: string;
}

function PreviewFor({ host, sessions, surfaces, documentId }: PreviewForProps): ReactNode {
  const t = host.useTranslate();
  const version = useSurfacesVersion(surfaces);
  const store = sessions.storeFor(documentId);
  const state = usePreviewState(store);
  const mountPoint = useRef<HTMLDivElement | null>(null);

  const document = host.documentOf(documentId);
  const ctx = useMemo(
    () => (document === null ? null : createPreviewContext({ document, store })),
    [document, store]
  );
  useEffect(() => () => ctx?.dispose(), [ctx]);

  const available = useMemo(() => {
    // Счётчик читается намеренно: список поверхностей отдаёт реестр, и только версия
    // связывает пересчёт со снятием или добавлением вклада.
    void version;
    return surfaces.list();
  }, [surfaces, version]);
  const choice = useMemo(
    () =>
      ctx === null
        ? null
        : chooseSurface({
            surfaces: available,
            doc: ctx.doc,
            source: host.sourceOf(documentId),
            preferred: state.surfaceId,
          }),
    [ctx, available, host, documentId, state.surfaceId]
  );

  const surface = choice?.surface ?? null;
  useEffect(() => {
    const element = mountPoint.current;
    if (element === null || surface === null || ctx === null) return;
    let mounted: Disposable | null = null;
    try {
      mounted = surface.mount(element, ctx);
    } catch (error) {
      // Упавшее монтирование не должно ронять панель: она обязана остаться, чтобы человек
      // мог переключиться на поверхность, которая работает.
      console.error(`[preview] поверхность «${surface.id}»: mount бросил`, error);
    }
    return () => {
      mounted?.dispose();
    };
  }, [surface, ctx]);

  const choose = useCallback(
    (id: string) => {
      // Повторное нажатие возвращает решение правилу: иначе выбранный однажды режим нельзя
      // было бы «отпустить», и новая, более способная поверхность не выбралась бы никогда.
      store.chooseSurface(state.surfaceId === id ? null : id);
    },
    [store, state.surfaceId]
  );

  if (ctx === null) {
    return <Notice title={t('empty.no-document')} detail={t('empty.no-document.detail')} />;
  }
  if (choice === null || choice.options.length === 0) {
    return <Notice title={t('empty.no-surface')} detail={t('empty.no-surface.detail')} />;
  }

  const fallback = choice.fallback;
  const refusal =
    fallback === null
      ? null
      : fallback.reason === 'unknown-surface' || fallback.reason === 'not-applicable'
        ? t(`fallback.${fallback.reason}`, { requested: fallback.requested })
        : t(refusalMessageKey(fallback.reason));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        role="group"
        aria-label={t('switcher.label')}
        className="border-border flex items-center gap-1 border-b px-2 py-1"
      >
        {choice.options.map((option) => (
          <SurfaceButton
            key={option.surface.id}
            option={option}
            active={option.surface.id === surface?.id}
            label={labelOf(option.surface, t)}
            onSelect={choose}
          />
        ))}
      </div>
      {refusal === null ? null : (
        <div className="border-border border-b bg-amber-50/60 px-3 py-1 text-[11px] text-amber-700 dark:bg-amber-950/20 dark:text-amber-400">
          {refusal}
        </div>
      )}
      <div ref={mountPoint} className="min-h-0 flex-1" />
    </div>
  );
}

interface SurfaceButtonProps {
  readonly option: SurfaceOption;
  readonly active: boolean;
  readonly label: string;
  readonly onSelect: (id: string) => void;
}

function SurfaceButton({ option, active, label, onSelect }: SurfaceButtonProps): ReactNode {
  return (
    <button
      type="button"
      aria-pressed={active}
      // Недоступная поверхность остаётся НАЖИМАЕМОЙ: нажатие показывает причину отказа,
      // а серая кнопка без объяснения — ровно то, чего контракт запрещает.
      onClick={() => onSelect(option.surface.id)}
      className={[
        'rounded px-2 py-0.5 text-[12px]',
        active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50',
        option.available ? '' : 'opacity-60',
      ]
        .filter((part) => part !== '')
        .join(' ')}
    >
      {label}
    </button>
  );
}

/** Заголовок поверхности. Ключ разрешается словарём ПРЕВЬЮ, поэтому у чужой его нет — см. контракт. */
function labelOf(
  surface: PreviewSurface,
  t: (key: string, params?: Record<string, unknown>) => string
): string {
  return surface.titleKey === undefined ? surface.id : t(surface.titleKey);
}

/** Версия списка поверхностей: вклад могут снять вместе с плагином, который его внёс. */
function useSurfacesVersion(surfaces: SurfaceCatalog): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const subscription = surfaces.observe(() => {
      setVersion((previous) => previous + 1);
    });
    return () => {
      subscription.dispose();
    };
  }, [surfaces]);
  return version;
}
