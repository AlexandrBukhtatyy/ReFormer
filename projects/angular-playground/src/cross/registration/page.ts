/**
 * Страница кросс-фреймворк проверки: форма регистрации на Angular и `@reformer/kit-taiga`.
 *
 * Документ формы, правила и API — общие с React- и Vue-страницами
 * (forms-benchmark/src/cross/registration.ts); здесь — реестр кита Taiga UI (../registry.ts),
 * рендерер Angular и оболочка страницы: заголовок, `<form>`, «Зарегистрироваться», «Очистить» и
 * подтверждение отправки. «Сервер» формы живёт в памяти страницы. `window.__bench` публикует общий
 * харнесс (готовность первого экрана, покой, вызовы API, отправленные данные) — по нему e2e ведёт
 * три стека одним сценарием.
 */
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { FormRenderer, ownFormBundle } from '@reformer/renderer-angular';
import { TuiButton } from '@taiga-ui/core/components/button';
import { TuiRoot } from '@taiga-ui/core/components/root';
import {
  createRegistrationForm,
  loadRegistrationInitial,
  registrationMessages,
  submitRegistration,
  type RegistrationValues,
} from '../../../../forms-benchmark/src/cross/registration';
import { startCrossPage } from '../host';
import { registrationRegistry } from '../registry';

/**
 * Форма с оболочкой: сборка — одна на компонент, создаётся, когда пришли начальные значения.
 * Отправка — `submission.submit(handler)`: проверяет форму и зовёт обработчик. «Очистить» —
 * `form.reset()`: значения, ноды и тихая фаза живой проверки; подтверждение прежней отправки при
 * этом скрывается.
 */
@Component({
  selector: 'app-registration-form',
  imports: [FormRenderer, TuiButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form novalidate class="cross-form" (submit)="submit($event)">
      <reformer-form [form]="bundle" [messages]="messages" />
      <div class="cross-actions">
        <button tuiButton type="submit" size="m" data-testid="btn-submit">
          Зарегистрироваться
        </button>
        <button
          tuiButton
          type="button"
          appearance="secondary"
          size="m"
          data-testid="btn-reset"
          (click)="reset()"
        >
          Очистить
        </button>
      </div>
      @if (result(); as text) {
        <p role="status" data-testid="submit-result">{{ text }}</p>
      }
    </form>
  `,
})
class RegistrationForm {
  private readonly page = inject(RegistrationPage);
  protected readonly bundle = ownFormBundle(() =>
    createRegistrationForm(registrationRegistry, this.page.initial()!)
  );
  protected readonly messages = registrationMessages;
  protected readonly result = signal<string | null>(null);

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    const outcome = await this.bundle.submission.submit(submitRegistration);
    if (outcome.status === 'submitted') this.result.set(outcome.result);
  }

  protected reset(): void {
    this.bundle.form.reset();
    this.result.set(null);
  }
}

@Component({
  selector: 'app-registration-page',
  imports: [RegistrationForm, TuiRoot],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tui-root>
      <main class="cross-page">
        <h1>Регистрация</h1>
        @if (initial()) {
          <app-registration-form />
        }
      </main>
    </tui-root>
  `,
})
class RegistrationPage {
  /** Начальные значения: по приглашению они приходят с «сервера». */
  readonly initial = signal<RegistrationValues | null>(null);

  constructor() {
    let mounted = true;
    inject(DestroyRef).onDestroy(() => {
      mounted = false;
    });
    void loadRegistrationInitial().then((values) => {
      if (mounted) this.initial.set(values);
    });
  }
}

export function start(container: HTMLElement): Promise<void> {
  return startCrossPage('registration', container, RegistrationPage);
}
