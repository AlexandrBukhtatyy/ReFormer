/**
 * Страница, форма и кнопки кита на Taiga UI: своя разметка с кнопками библиотеки и testid
 * DOM-контракта (`btn-submit`, `btn-reset`, `submit-result`).
 *
 * Заголовок страницы один — `<h1>`: сценарии снимают фокус с поля кликом по заголовку.
 *
 * Кнопка Taiga (`button tuiButton`) тип не ставит, а внутри формы кнопка без типа — `submit`.
 * Поэтому `type` у каждой кнопки кита записан явно.
 */
import {
  ChangeDetectionStrategy,
  Component,
  InjectionToken,
  inject,
  input,
  signal,
} from '@angular/core';
import { injectFormBundle } from '@reformer/renderer-angular';
import { TuiButton } from '@taiga-ui/core/components/button';

/**
 * Действия формы, которые документ выразить не может: JSON не несёт функций. Страница отдаёт их
 * провайдером, компонент `Form` реестра берёт оттуда обработчик отправки.
 */
export interface FormActions {
  /** Обработчик отправки валидной формы; возвращает текст подтверждения. */
  submit(values: unknown): Promise<string>;
}

export const FORM_ACTIONS = new InjectionToken<FormActions>('kit.form-actions');

@Component({
  selector: 'main[kitPage]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cross-page' },
  template: `<h1>{{ title() }}</h1>
    <ng-content />`,
})
export class Page {
  readonly title = input.required<string>();
}

/**
 * `<form>` с отправкой через сборку: `submission.submit(handler)` проверяет форму и зовёт
 * обработчик страницы. «Очистить» — `form.reset()`: значения, ноды и тихая фаза живой проверки;
 * подтверждение прежней отправки при этом скрывается.
 *
 * Кнопка сброса стоит внутри формы и находит её внедрением: дети узла создаются с инжектором
 * компонента, в который они вложены.
 */
@Component({
  selector: 'form[kitForm]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cross-form', novalidate: '', '(submit)': 'submit($event)' },
  template: `<ng-content />
    @if (result(); as text) {
      <p role="status" data-testid="submit-result">{{ text }}</p>
    }`,
})
export class Form {
  private readonly bundle = injectFormBundle();
  private readonly actions = inject(FORM_ACTIONS);
  protected readonly result = signal<string | null>(null);

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.bundle) return;
    const outcome = await this.bundle.submission.submit(this.actions.submit);
    if (outcome.status === 'submitted') this.result.set(outcome.result);
  }

  reset(): void {
    this.bundle?.form.reset();
    this.result.set(null);
  }
}

@Component({
  selector: 'div[kitActions]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cross-actions' },
  template: '<ng-content />',
})
export class Actions {}

@Component({
  selector: 'kit-submit-button',
  imports: [TuiButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `<button tuiButton type="submit" size="m" data-testid="btn-submit">
    <ng-content>Отправить</ng-content>
  </button>`,
})
export class SubmitButton {}

@Component({
  selector: 'kit-reset-button',
  imports: [TuiButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `<button
    tuiButton
    type="button"
    appearance="secondary"
    size="m"
    data-testid="btn-reset"
    (click)="reset()"
  >
    <ng-content>Очистить</ng-content>
  </button>`,
})
export class ResetButton {
  private readonly form = inject(Form, { optional: true });

  protected reset(): void {
    this.form?.reset();
  }
}
