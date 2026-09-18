/**
 * Живой вид: выбрать для документа поверхность по общему правилу и смонтировать её в элемент
 * того, кто документ показывает, — возможность `reformer.preview.live`.
 *
 * ## Почему это служба плагина превью, а не порт композиции
 *
 * Раньше мост собирала оболочка (`shell/boot/ports/live-surface`): рисовать форму умеет превью,
 * а редактор схемы превью импортировать не может. Мост знал ровно то, чем владеет превью, —
 * точку поверхностей, правило выбора, состояния документов, — и оболочка держала его только
 * потому, что в SDK не было ни точки, ни возможности. Оболочка при этом знала о превью больше,
 * чем о любом другом плагине, и тянула его в стартовый граф.
 *
 * Теперь контракт в SDK, и отдаёт его владелец. Потребитель — редактор ЛЮБОГО стека: правило
 * выбирает поверхность по провайдеру модели документа, поэтому схема ReFormer и форма другого
 * стека показываются одной службой, каждая своей поверхностью.
 *
 * ## Поверхность у всех, кто показывает документ, ОДНА
 *
 * Правило выбора (`chooseSurface`), состояние документа (`PreviewStore`) и реестр состояний —
 * общие. Поэтому находки сборки не раздваиваются, а введённые значения переживают переход
 * между видами. Разведи их — и на вопрос «чем нарисована эта форма» появилось бы два ответа.
 *
 * ## Что достраивается, а что приходит от показывающего
 *
 * От показывающего — схема и выделение: схему он берёт из МОДЕЛИ, а не из буфера (буфер
 * перерисовывается с задержкой, пока в текстовом редакторе печатают), и выделение у него своё.
 * Отсюда — адрес документа, мок-данные, хранилище введённых значений и имя источника находок.
 *
 * @module plugins/preview/live/live-service
 */

import type {
  Disposable,
  LiveSurfaceContext,
  LiveSurfaceInfo,
  PreviewContext,
  PreviewFormHandle,
  PreviewLiveService,
  PreviewProblem,
  PluginContext,
  PreviewSurface,
  ResourceId,
} from '@reformer/builder-plugin-api';
import { PreviewSurfacePoint } from '../contract';
import type { LiveDocument, PreviewHostPort } from '../host';
import type { PreviewSessions } from '../state/sessions';
import { documentRefOf } from '../surface/document-ref';
import { fallbackMessage, surfaceTitle, type Translate } from '../surface/label';
import { chooseSurface, type SurfaceChoice } from '../surface/selection';

export interface LiveServiceDeps {
  readonly host: PreviewHostPort;
  readonly sessions: PreviewSessions;
  /** Реестр вкладов в объёме чтения точки поверхностей. */
  readonly extensions: Pick<PluginContext['extensions'], 'get' | 'observe'>;
  /** Перевод в пространстве имён превью: причины отказа завёл он. */
  readonly t: Translate;
}

export function createLiveService(deps: LiveServiceDeps): PreviewLiveService {
  const { host, sessions, extensions, t } = deps;

  const surfacesNow = (): readonly PreviewSurface[] =>
    extensions.get(PreviewSurfacePoint).map((contribution) => contribution.value);

  /** Документ и выбор для него; `null` — показывать нечем или документа нет. */
  function decide(
    documentId: ResourceId
  ): { document: LiveDocument; choice: SurfaceChoice } | null {
    const document = host.documentOf(documentId);
    if (document === null) return null;
    const surfaces = surfacesNow();
    if (surfaces.length === 0) return null;
    // Выбор целиком за правилом: переключателя поверхностей нет, а самая способная
    // доступная — ровно то, чего человек ждёт, не выбирая. Отказ источника при этом
    // не прячется: он приезжает в `fallback` и доходит до полосы живого вида.
    const choice = chooseSurface({
      surfaces,
      doc: documentRefOf(document),
      source: host.sourceOf(documentId),
    });
    return choice.surface === null ? null : { document, choice };
  }

  return {
    available: () => surfacesNow().length > 0,

    chosen(documentId: ResourceId): LiveSurfaceInfo | null {
      const decided = decide(documentId);
      if (decided === null) return null;
      const surface = decided.choice.surface;
      if (surface === null) return null;
      const capabilities = surface.capabilities;
      return {
        id: surface.id,
        title: surfaceTitle(surface),
        hitTest: capabilities.hitTest,
        sameRealm: capabilities.sameRealm,
        executesCode: capabilities.executesCode,
        notice: fallbackMessage(decided.choice.fallback, t),
      };
    },

    mount(
      documentId: ResourceId,
      element: HTMLElement,
      ctx: LiveSurfaceContext
    ): Disposable | null {
      const decided = decide(documentId);
      const surface = decided?.choice.surface ?? null;
      if (decided === null || surface === null) return null;
      const store = sessions.storeFor(documentId);

      const previewCtx: PreviewContext = {
        doc: documentRefOf(decided.document),
        schema: () => ctx.schema(),
        onDidChangeSchema: (cb) => ctx.onDidChangeSchema(cb),
        selection: () => ctx.selection(),
        onDidChangeSelection: (cb) => ctx.onDidChangeSelection(cb),
        select: (ids) => {
          ctx.select(ids);
        },
        // Мок-данных в v2 нет ни у кого: поверхность синтезирует значения из схемы.
        mock: () => null,
        values: () => store.values(),
        publishForm: (form) => {
          store.publishForm(form);
        },
        keepValues: (values) => {
          store.keepValues(values);
        },
        report: (source: string, problems: readonly PreviewProblem[]) => {
          // В состояние документа — оттуда превью кладёт находки в общий свод диагностик под
          // адресом файла, где чинить, и оттуда их целиком показывает панель проблем. Своего
          // канала к показывающему здесь нет: живой вид рисует находки контуром на узле, а
          // списком не повторяет — вторая копия стояла бы рядом с первой.
          store.report(source, problems);
        },
      };

      try {
        return surface.mount(element, previewCtx);
      } catch (error) {
        // Упавшая поверхность не роняет того, кто её показывает.
        console.error(`[live] поверхность «${surface.id}»: mount бросил`, error);
        return null;
      }
    },

    onDidChange(_documentId: ResourceId, cb: () => void): Disposable {
      // Источник смены один: состав поверхностей. Выбор зависит от вкладов и возможностей
      // источника, а не от состояния документа.
      return extensions.observe(PreviewSurfacePoint, cb);
    },

    formOf(documentId: ResourceId): PreviewFormHandle | null {
      return sessions.storeFor(documentId).get().form;
    },

    onDidChangeForm(documentId: ResourceId, cb: () => void): Disposable {
      // Подписка на состояние документа целиком: форма меняется вместе с ним, а отдельного
      // события у хранилища нет. Лишний вызов у наблюдателя — перерисовка того же снимка.
      return sessions.storeFor(documentId).subscribe(cb);
    },
  };
}
