/**
 * То, что странице кросс-фреймворк проверки нужно помимо самой формы: харнесс `window.__bench`,
 * маска ввода и капча. Слоя представления и стилей бенчмарка здесь нет — хост стека подключает
 * стили своей библиотеки компонентов.
 *
 * Отдельным модулем от форм: код одной формы не должен попадать на страницу другой.
 */
import { api } from '../shared/api/client';

export { installBench, type BenchHost, type BenchWindowApi } from '../shared/harness/bench';
export type { FormId } from '../shared/harness/screens';
export { applyMask } from '../shared/ui/mask';
export { CAPTCHA_CANVAS, drawCaptcha } from '../shared/ui/captcha-draw';
export type { CaptchaChallenge } from '../shared/api/captcha';

/** Новая картинка капчи от «сервера»: прежний код после этого недействителен. */
export const getCaptcha = (): ReturnType<typeof api.getCaptcha> => api.getCaptcha();
