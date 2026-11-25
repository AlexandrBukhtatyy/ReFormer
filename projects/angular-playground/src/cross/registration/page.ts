/**
 * Страница кросс-фреймворк проверки: форма регистрации на Angular и Taiga UI.
 *
 * Документ формы, правила и API — общие с React- и Vue-страницами
 * (forms-benchmark/src/cross/registration.ts); здесь — реестр компонентов Taiga UI и рендерер
 * Angular. «Сервер» формы живёт в памяти страницы. `window.__bench` публикует общий харнесс
 * (готовность первого экрана, покой, вызовы API, отправленные данные) — по нему e2e ведёт три стека
 * одним сценарием.
 */
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { FormRenderer, ownFormBundle } from '@reformer/renderer-angular';
import { TuiRoot } from '@taiga-ui/core/components/root';
import {
  createRegistrationForm,
  loadRegistrationInitial,
  registrationMessages,
  submitRegistration,
  type RegistrationValues,
} from '../../../../forms-benchmark/src/cross/registration';
import { FORM_ACTIONS } from '../../kit/layout';
import { registrationRegistry } from '../../kit/registry';
import { startCrossPage } from '../host';

/** Форма: сборка — одна на компонент, создаётся, когда пришли начальные значения. */
@Component({
  selector: 'app-registration-form',
  imports: [FormRenderer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<reformer-form [form]="bundle" [messages]="messages" />`,
})
class RegistrationForm {
  private readonly page = inject(RegistrationPage);
  protected readonly bundle = ownFormBundle(() =>
    createRegistrationForm(registrationRegistry, this.page.initial()!)
  );
  protected readonly messages = registrationMessages;
}

@Component({
  selector: 'app-registration-page',
  imports: [RegistrationForm, TuiRoot],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: FORM_ACTIONS,
      useValue: { submit: (values: unknown) => submitRegistration(values as RegistrationValues) },
    },
  ],
  template: `
    <tui-root>
      @if (initial()) {
        <app-registration-form />
      }
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
