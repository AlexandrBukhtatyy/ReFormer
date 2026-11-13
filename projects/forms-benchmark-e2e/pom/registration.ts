/**
 * POM формы регистрации на нейтральном DOM-контракте (BENCH-CONTRACT §4) — один на все реализации.
 * Методы с `fill`/`click` — для conformance; бенч вводит «сырым» вводом (lib/input.ts).
 */
import type { Locator, Page } from '@playwright/test';

export const REGISTRATION_FIELDS = [
  'username',
  'email',
  'password',
  'confirmPassword',
  'fullName',
  'phone',
  'captcha',
  'acceptTerms',
] as const;

export type RegistrationField = (typeof REGISTRATION_FIELDS)[number];

/** Валидные данные: ASCII, в пересечении штатных email-валидаторов всех библиотек. */
export const VALID = {
  username: 'john_smith',
  email: 'john.smith@example.com',
  password: 'Secret123',
  confirmPassword: 'Secret123',
  fullName: 'John Smith',
  phoneDigits: '9161234567',
  phone: '+7 (916) 123-45-67',
} as const;

interface BenchWindow {
  __bench: {
    ready: Promise<number>;
    idle(opts?: { network?: boolean }): Promise<number>;
    api: { calls: Record<string, number>; peekCaptcha(): string; flush(): number };
    submissions: unknown[];
  };
}

export class RegistrationPage {
  constructor(
    readonly page: Page,
    readonly lib: string
  ) {}

  input(field: RegistrationField): Locator {
    return this.page.getByTestId(`input-${field}`);
  }

  error(field: RegistrationField): Locator {
    return this.page.getByTestId(`error-${field}`);
  }

  url(params: Record<string, string> = {}): string {
    const q = new URLSearchParams(params).toString();
    return `/${this.lib}/registration/${q ? `?${q}` : ''}`;
  }

  async goto(params: Record<string, string> = {}): Promise<void> {
    await this.page.goto(this.url(params));
    await this.page.evaluate(() => (window as unknown as BenchWindow).__bench.ready);
    await this.idle();
  }

  idle(): Promise<number> {
    return this.page.evaluate(() => (window as unknown as BenchWindow).__bench.idle());
  }

  /** Все показанные ошибки: path → текст. */
  async errors(): Promise<Record<string, string>> {
    return this.page.evaluate(() => {
      const out: Record<string, string> = {};
      for (const el of document.querySelectorAll<HTMLElement>('[data-testid^="error-"]')) {
        out[el.dataset.testid!.slice('error-'.length)] = el.textContent ?? '';
      }
      return out;
    });
  }

  calls(): Promise<Record<string, number>> {
    return this.page.evaluate(() => ({ ...(window as unknown as BenchWindow).__bench.api.calls }));
  }

  submissions(): Promise<unknown[]> {
    return this.page.evaluate(() => [...(window as unknown as BenchWindow).__bench.submissions]);
  }

  captchaAnswer(): Promise<string> {
    return this.page.evaluate(() => (window as unknown as BenchWindow).__bench.api.peekCaptcha());
  }

  /** Посимвольный ввод: настоящие keydown/input, как у пользователя. */
  async type(
    field: RegistrationField,
    text: string,
    opts: { clear?: boolean } = {}
  ): Promise<void> {
    const input = this.input(field);
    await input.click();
    if (opts.clear) {
      await input.press('ControlOrMeta+a');
      await input.press('Backspace');
    }
    await input.pressSequentially(text, { delay: 20 });
  }

  async blur(): Promise<void> {
    await this.page.getByRole('heading').click();
  }

  submit(): Promise<void> {
    return this.page.getByTestId('btn-submit').click();
  }

  reset(): Promise<void> {
    return this.page.getByTestId('btn-reset').click();
  }

  refreshCaptcha(): Promise<void> {
    return this.page.getByTestId('captcha-refresh').click();
  }

  async fillValid(): Promise<void> {
    await this.type('username', VALID.username);
    await this.type('email', VALID.email);
    await this.type('password', VALID.password);
    await this.type('confirmPassword', VALID.confirmPassword);
    await this.type('fullName', VALID.fullName);
    await this.type('phone', VALID.phoneDigits);
    await this.idle();
    await this.type('captcha', await this.captchaAnswer());
    await this.input('acceptTerms').check();
    await this.idle();
  }
}
