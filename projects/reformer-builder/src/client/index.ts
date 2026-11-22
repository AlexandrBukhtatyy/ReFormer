/**
 * Вход пакета `@reformer/builder`: клиент билдера для приложения, в которое он встроен.
 *
 * ```tsx
 * createRoot(container).render(
 *   <AppProviders>
 *     <ReformerBuilder>
 *       <App />
 *     </ReformerBuilder>
 *   </AppProviders>
 * );
 * ```
 *
 * Компонент оборачивает приложение: на обычной странице рисует его и кнопку «Билдер», по кнопке
 * открывает билдер в рамке поверх страницы, а в рамке превью показывает приложение — либо одну
 * форму — без билдера. Об устройстве приложения билдер не знает: превью рисует само приложение.
 *
 * Сам билдер в сборку приложения не попадает: его отдаёт dev-сервер приложения, плагином
 * `@reformer/builder/vite`. Здесь — только клиент, и импортирует он один React. Приложение его
 * не компилирует: в пакете клиент едет собранным (`client/`, сборка `vite.client.config.ts`)
 * вместе с объявлениями типов, а в прод-сборке приложения плагин подменяет его заглушкой
 * (`./noop`) — там клиенту делать нечего.
 *
 * Самостоятельный билдер — другой вход, `../main`; он же открывается в рамке.
 *
 * @module client/index
 */

export { ReformerBuilder } from './ReformerBuilder';
export type { ReformerBuilderLabels, ReformerBuilderProps } from './ReformerBuilder';
export type { FormModuleLoader } from './FormStand';
