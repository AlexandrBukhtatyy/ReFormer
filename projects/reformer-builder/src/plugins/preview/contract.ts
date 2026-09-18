/**
 * Контракт превью — из `@reformer/builder-plugin-api`, здесь реэкспорт.
 *
 * Точка поверхностей жила здесь структурной копией, пока поверхности вносил один плагин. Теперь
 * их вносят плагины разных стеков, и контракт переехал в пакет: копия, описывающая ПРЕДМЕТНОЕ,
 * у каждого поставщика своя, разъезжается с оригиналом (урок Э6 журнала решений). Модуль
 * остался, чтобы у модулей плагина был один адрес контракта, а не россыпь импортов пакета.
 *
 * @module plugins/preview/contract
 */

export { PreviewLiveCapability, PreviewSurfacePoint } from '@reformer/builder-plugin-api';
export type {
  LiveSurfaceContext,
  LiveSurfaceInfo,
  PreviewCapabilities,
  PreviewContext,
  PreviewFormHandle,
  PreviewLiveService,
  PreviewMock,
  PreviewProblem,
  PreviewProblemPhase,
  PreviewSurface,
  PreviewValues,
} from '@reformer/builder-plugin-api';
