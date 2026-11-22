/**
 * Общий API-клиент бенчмарка. Все реализации ходят на «сервер» только через него.
 *
 * Проверки занятости и капчи уже содержат debounce 300 мс (trailing) и кэш по значению
 * (BENCH-CONTRACT §3): реализация вызывает их в штатном месте своей библиотеки для async-валидации
 * и своих debounce/кэша не добавляет. Вызов, вытесненный более поздним, возвращает `undefined` —
 * «не проверено», ошибки нет.
 */
import { request, serverConfig } from './server';
import { createRng, generateChallenge, type CaptchaChallenge } from './captcha';
import { debouncedByKey } from './debounce';

export { ASYNC_CHECK_DEBOUNCE_MS } from './debounce';

const TAKEN_USERNAMES = new Set(['johndoe', 'janedoe', 'admin']);
const TAKEN_EMAILS = new Set(['john@example.com', 'admin@example.com']);

export const REGISTRATION_PREFILL = {
  email: 'invited.user@example.com',
  fullName: 'Invited User',
} as const;

// ── Сессия капчи на «сервере» ────────────────────────────────────────────────
const captchaRng = createRng(serverConfig.seed);
let captchaIndex = 0;
let captchaAnswer = '';

function issueChallenge(): CaptchaChallenge {
  const { answer, challenge } = generateChallenge(captchaRng, ++captchaIndex);
  captchaAnswer = answer;
  return challenge;
}

// ── Debounce + кэш ───────────────────────────────────────────────────────────
/** `true`/`false` — ответ, `undefined` — проверка вытеснена более поздней (см. `debouncedByKey`). */
const debouncedCheck = <T>(key: (value: T) => string, run: (value: T) => Promise<boolean>) =>
  debouncedByKey<T, boolean>(key, run);

// ── Эндпоинты ────────────────────────────────────────────────────────────────
export interface RegistrationPayload {
  username: string;
  email: string;
  password: string;
  fullName: string;
  phone: string;
  captcha: string;
  acceptTerms: boolean;
}

const submissions: unknown[] = [];

export const api = {
  /** `true` — свободно, `false` — занято, `undefined` — проверка вытеснена более поздней. */
  checkUsername: debouncedCheck<string>(
    (v) => v.toLowerCase(),
    (v) => request('check-username', () => !TAKEN_USERNAMES.has(v.toLowerCase()))
  ),

  checkEmail: debouncedCheck<string>(
    (v) => v.toLowerCase(),
    (v) => request('check-email', () => !TAKEN_EMAILS.has(v.toLowerCase()))
  ),

  /** `true` — ответ совпал с кодом текущей картинки. */
  verifyCaptcha: debouncedCheck<string>(
    (v) => `${captchaIndex}:${v.toUpperCase()}`,
    (v) => request('captcha-verify', () => v.toUpperCase() === captchaAnswer)
  ),

  getCaptcha(): Promise<CaptchaChallenge> {
    return request('captcha', issueChallenge);
  },

  /** Отметка `bench:prefill` — момент доставки ответа: от неё считается гидратация формы. */
  getRegistrationPrefill(invite: string): Promise<typeof REGISTRATION_PREFILL> {
    return request('registration-prefill', () => {
      if (!invite) throw new Error('invite required');
      return { ...REGISTRATION_PREFILL };
    }).then((data) => {
      performance.mark('bench:prefill');
      return data;
    });
  },

  register(payload: RegistrationPayload): Promise<{ userId: string }> {
    return request('register', () => {
      submissions.push(structuredClone(payload));
      return { userId: `u${submissions.length}` };
    });
  },
};

export const apiInspect = {
  submissions,
  /** Ответ текущей капчи — только для e2e (через `__bench`). */
  peekCaptcha: () => captchaAnswer,
};
