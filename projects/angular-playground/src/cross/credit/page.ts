/**
 * Страница кросс-фреймворк проверки: кредитная заявка на Angular и `@reformer/kit-taiga`.
 *
 * Документ формы, правила шагов, поведение и API — общие с React- и Vue-страницами
 * (forms-benchmark/src/cross/credit.ts); здесь — реестр кита Taiga UI (../registry.ts), рендерер
 * Angular и оболочка страницы: заголовок, `<form>` и подтверждение отправки. Кнопки шагов и
 * «Отправить» рисует визард кита. «Сервер» формы живёт в памяти страницы. `window.__bench`
 * публикует общий харнесс (готовность первого экрана, покой, вызовы API, отправленные данные) — по
 * нему e2e ведёт три стека одним сценарием.
 */
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { FormRenderer, ownFormBundle } from '@reformer/renderer-angular';
import { TuiRoot } from '@taiga-ui/core/components/root';
import {
  createCreditForm,
  createCreditStart,
  creditMessages,
  type CreditValues,
} from '../../../../forms-benchmark/src/cross/credit';
import { startCrossPage } from '../host';
import { creditRegistry } from '../registry';

/**
 * Форма с оболочкой: сборка — одна на компонент, создаётся, когда пришли данные заявки. Текст
 * подтверждения приходит из поведения формы: визард кита проверил и отправил заявку. Кнопки
 * визарда — `type="button"`; Enter в поле не отправляет форму в обход визарда.
 */
@Component({
  selector: 'app-credit-form',
  imports: [FormRenderer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form novalidate class="cross-form" (submit)="$event.preventDefault()">
      <reformer-form [form]="bundle" [messages]="messages" />
      @if (result(); as text) {
        <p role="status" data-testid="submit-result">{{ text }}</p>
      }
    </form>
  `,
})
class CreditForm {
  private readonly page = inject(CreditPage);
  protected readonly result = signal<string | null>(null);
  protected readonly bundle = ownFormBundle(() =>
    createCreditForm(
      creditRegistry,
      this.page.initial()!,
      this.page.start.dictionaries,
      (message) => this.result.set(message)
    )
  );
  protected readonly messages = creditMessages;
}

@Component({
  selector: 'app-credit-page',
  imports: [CreditForm, TuiRoot],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tui-root>
      <main class="cross-page">
        <h1>Заявка на кредит</h1>
        @if (initial()) {
          <app-credit-form />
        }
      </main>
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
