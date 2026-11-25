/**
 * Страница кросс-фреймворк проверки: кредитная заявка на Angular и Taiga UI.
 *
 * Документ формы, правила шагов, поведение и API — общие с React- и Vue-страницами
 * (forms-benchmark/src/cross/credit.ts); здесь — реестр компонентов Taiga UI и рендерер Angular.
 * «Сервер» формы живёт в памяти страницы. `window.__bench` публикует общий харнесс (готовность
 * первого экрана, покой, вызовы API, отправленные данные) — по нему e2e ведёт три стека одним
 * сценарием.
 */
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { FormRenderer, ownFormBundle } from '@reformer/renderer-angular';
import { TuiRoot } from '@taiga-ui/core/components/root';
import {
  createCreditForm,
  createCreditStart,
  creditMessages,
  submitCredit,
  type CreditValues,
} from '../../../../forms-benchmark/src/cross/credit';
import { FORM_ACTIONS } from '../../kit/layout';
import { creditRegistry } from '../../kit/registry';
import { startCrossPage } from '../host';

/** Форма: сборка — одна на компонент, создаётся, когда пришли данные заявки. */
@Component({
  selector: 'app-credit-form',
  imports: [FormRenderer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<reformer-form [form]="bundle" [messages]="messages" />`,
})
class CreditForm {
  private readonly page = inject(CreditPage);
  protected readonly bundle = ownFormBundle(() =>
    createCreditForm(creditRegistry, this.page.initial()!, this.page.start.dictionaries)
  );
  protected readonly messages = creditMessages;
}

@Component({
  selector: 'app-credit-page',
  imports: [CreditForm, TuiRoot],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: FORM_ACTIONS,
      useValue: { submit: (values: unknown) => submitCredit(values as CreditValues) },
    },
  ],
  template: `
    <tui-root>
      @if (initial()) {
        <app-credit-form />
      }
    </tui-root>
  `,
})
class CreditPage {
  /** Справочники — сигналы страницы: документ формы ссылается на них, значения придут позже. */
  readonly start = createCreditStart();
  /** Начальные значения: данные заявки приходят с «сервера». */
  readonly initial = signal<CreditValues | null>(null);

  constructor() {
    let mounted = true;
    inject(DestroyRef).onDestroy(() => {
      mounted = false;
    });
    void this.start.load().then((values) => {
      if (mounted) this.initial.set(values);
    });
  }
}

export function start(container: HTMLElement): Promise<void> {
  return startCrossPage('credit', container, CreditPage);
}
