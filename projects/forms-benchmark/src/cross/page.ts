/**
 * То, что странице кросс-фреймворк проверки нужно помимо самой формы: харнесс `window.__bench` и
 * капча. Слоя представления и стилей бенчмарка здесь нет — хост стека подключает стили своей
 * библиотеки компонентов.
 *
 * Отдельным модулем от форм: код одной формы не должен попадать на страницу другой.
 */
import { api } from '../shared/api/client';
import {
  installBench as installHarness,
  type BenchHost,
  type BenchWindowApi,
} from '../shared/harness/bench';
import type { FormId } from '../shared/harness/screens';

export type { BenchHost, BenchWindowApi, FormId };
export { CAPTCHA_CANVAS, drawCaptcha } from '../shared/ui/captcha-draw';
export type { CaptchaChallenge } from '../shared/api/captcha';

/**
 * Первый шаг мастера, когда он текущий, — в разметке китов (`@reformer/ui-kit`,
 * `@reformer/kit-vuetify`, `@reformer/kit-taiga`): пункт шапки с `data-step-current`.
 */
const KIT_FIRST_STEP = '[data-testid="step-indicator-1"][data-step-current="true"]';

/**
 * Харнесс страницы: тот же, что у бенчмарка, с разметкой мастера китов — по ней харнесс узнаёт,
 * что первый экран кредитной заявки готов.
 */
export function installBench(form: FormId, container: ParentNode, host: BenchHost): BenchWindowApi {
  return installHarness(form, container, host, { firstStep: KIT_FIRST_STEP });
}

/** Новая картинка капчи от «сервера»: прежний код после этого недействителен. */
export const getCaptcha = (): ReturnType<typeof api.getCaptcha> => api.getCaptcha();
