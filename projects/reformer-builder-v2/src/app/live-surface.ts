/**
 * Живой рендер формы для редактора схемы: чужая поверхность, отданная ему композицией.
 *
 * ## Зачем это здесь, а не в редакторе схемы
 *
 * Рисовать форму умеет плагин превью, а плагины друг друга не импортируют. Тот же случай, что
 * с телом Monaco в `schema-host`: потребность объявляет потребитель, удовлетворяет композиция.
 * Здесь это ещё и единственное место, где встречаются структурная копия контекста
 * (`LiveSurfaceContext` редактора схемы) и настоящий `PreviewContext`, — то есть единственное
 * место, где компилятор поймает их расхождение.
 *
 * ## Поверхность у редактора и у панели ОДНА
 *
 * Правило выбора (`chooseSurface`), состояние документа (`PreviewStore`) и реестр состояний —
 * общие. Поэтому переключение поверхности в панели меняет и форму в редакторе, находки сборки
 * не раздваиваются, а введённые значения переживают переход между ними. Разведи их — и на
 * вопрос «чем нарисована эта форма» появилось бы два ответа.
 *
 * ## Что достраивается, а что приходит от редактора
 *
 * От редактора — схема, выделение и приёмник находок: схему он берёт из МОДЕЛИ, а не из буфера
 * (буфер перерисовывается с задержкой, пока в текстовом редакторе печатают), и выделение у него
 * своё. Отсюда — адрес документа, мок-данные, хранилище введённых значений и имя источника
 * находок: всё это принадлежит превью и редактору не видно.
 *
 * @module app/live-surface
 */

import type { RootExtensionRegistry } from '../host/primitives/extension-point';
import type { Disposable } from '../host/primitives/disposable';
import type { ResourceId } from '../host/primitives/resource';
import type { RootI18nService } from '../host/services/i18n/i18n';
import type {
  LivePreviewPort,
  LiveSurfaceContext,
  LiveSurfaceInfo,
} from '../plugins/editor-schema';
import {
  chooseSurface,
  documentRefOf,
  fallbackMessage,
  PreviewSurfacePoint,
  PREVIEW_PLUGIN_ID,
  surfaceTitle,
  type PreviewContext,
  type PreviewDocument,
  type PreviewHost,
  type PreviewProblem,
  type PreviewSessions,
  type PreviewSurface,
  type SurfaceChoice,
} from '../plugins/preview';

export interface LiveSurfaceDeps {
  readonly host: PreviewHost;
  /** Тот же реестр, что получил плагин превью: состояние документа у них общее. */
  readonly sessions: PreviewSessions;
  readonly extensions: RootExtensionRegistry;
  readonly i18n: RootI18nService;
}

/** Перевод в пространстве имён превью: и заголовки поверхностей, и причины отказа завёл он. */
function translator(
  i18n: RootI18nService
): (key: string, params?: Record<string, unknown>) => string {
  const view = i18n.forPlugin(PREVIEW_PLUGIN_ID);
  return (key, params) => view.t(key, params);
}

export function createLiveSurfacePort(deps: LiveSurfaceDeps): LivePreviewPort {
  const { host, sessions, extensions, i18n } = deps;
  const t = translator(i18n);

  const surfacesNow = (): readonly PreviewSurface[] =>
    extensions.get(PreviewSurfacePoint).map((contribution) => contribution.value);

  /** Документ и выбор для него; `null` — показывать нечем или документа нет. */
  function decide(
    documentId: ResourceId
  ): { document: PreviewDocument; choice: SurfaceChoice } | null {
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
        title: surfaceTitle(surface, t),
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
      const doc = documentRefOf(decided.document);

      const previewCtx: PreviewContext = {
        doc,
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
        keepValues: (values) => {
          store.keepValues(values);
        },
        report: (source: string, problems: readonly PreviewProblem[]) => {
          // В общий свод — чтобы панель показала то же самое; и во встраивающего — чтобы
          // живой вид мог сказать словами, почему форма не собралась.
          store.report(source, problems);
          ctx.report?.(problems.map(describeProblem));
        },
      };

      try {
        return surface.mount(element, previewCtx);
      } catch (error) {
        // Та же политика, что в панели: упавшая поверхность не роняет того, кто её показывает.
        console.error(`[live] поверхность «${surface.id}»: mount бросил`, error);
        return null;
      }
    },

    onDidChange(_documentId: ResourceId, cb: () => void): Disposable {
      // Источник смены остался один: состав поверхностей. Выбор человека был вторым, пока
      // существовал переключатель в панели превью; теперь выбирает правило, а оно зависит
      // от вкладов и возможностей источника, а не от состояния документа.
      return extensions.observe(PreviewSurfacePoint, cb);
    },
  };
}

/** Находка одной строкой: имя файла имеет смысл только когда оно есть. */
function describeProblem(problem: PreviewProblem): string {
  return problem.file === '' ? problem.message : `${problem.file}: ${problem.message}`;
}
