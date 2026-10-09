/**
 * Вход библиотеки: клиент билдера для приложения, в которое он встроен.
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
 * `@reformer/builder/vite`. Здесь — только клиент, и импортирует он один React.
 *
 * Самостоятельный билдер — другой вход, `./main`; он же открывается в рамке.
 *
 * @module index
 */

export { ReformerBuilder } from './client/ReformerBuilder';
export type { ReformerBuilderLabels, ReformerBuilderProps } from './client/ReformerBuilder';
export type { FormModuleLoader } from './client/FormStand';
