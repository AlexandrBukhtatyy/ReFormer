/**
 * Визард кита на Taiga UI: шапка — `tui-stepper`, кнопки — `tuiButton`, шаги и переходы — поток
 * сборки `createForm({ flow })`.
 *
 * От `tui-stepper` берётся только шапка: шаг по клику он делает текущим сам, без проверки
 * текущего. Переходы — только кнопками, пункты шапки не нажимаются. У DOM-контракта свои правила
 * кнопок — `btn-prev` есть и на первом шаге (выключена: кнопки не сдвигаются между шагами),
 * заголовок текущего шага — `step-current` с номером в `data-step`.
 */
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { CompiledNode } from '@reformer/core';
import { ReformerNode, formFlowSignals, injectFormBundle } from '@reformer/renderer-angular';
import { TuiButton } from '@taiga-ui/core/components/button';
import { TuiStepper } from '@taiga-ui/kit/components/stepper';

const titleOf = (node: CompiledNode | undefined): string => {
  const title = (node?.props as { title?: unknown } | undefined)?.title;
  return typeof title === 'string' ? title : '';
};

/**
 * Визард: рендерер отдаёт ему узлы шагов входом `children`, поток шагов он берёт из сборки.
 * «Далее» — `flow.next()`: правила текущего шага, при замечаниях шаг не меняется; «Назад» —
 * `flow.previous()`. Рисуется только текущий шаг — директивой узла.
 */
@Component({
  selector: 'kit-wizard',
  imports: [ReformerNode, TuiButton, TuiStepper],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cross-wizard' },
  template: `
    <tui-stepper class="cross-stepper" aria-label="Шаги заявки" [activeItemIndex]="steps.index()">
      @for (node of children(); track node.id; let position = $index) {
        <button
          tuiStep
          type="button"
          tabindex="-1"
          [stepState]="isCompleted(node) ? 'pass' : 'normal'"
          [attr.aria-label]="'Шаг ' + (position + 1) + ': ' + titleOf(node)"
        ></button>
      }
    </tui-stepper>
    <h2 class="cross-wizard__title" data-testid="step-current" [attr.data-step]="number()">
      Шаг {{ number() }} из {{ children().length }}. {{ titleOf(current()) }}
    </h2>
    @if (current(); as node) {
      <ng-container [reformerNode]="node" />
    }
    <div class="cross-actions">
      <button
        tuiButton
        type="button"
        appearance="secondary"
        size="m"
        data-testid="btn-prev"
        [disabled]="steps.isFirst()"
        (click)="flow.previous()"
      >
        Назад
      </button>
      <!-- Разные элементы: кнопка, ставшая type="submit" посреди клика по «Далее», отправила бы форму. -->
      @if (steps.isLast()) {
        <button tuiButton type="submit" size="m" data-testid="btn-submit">Отправить</button>
      } @else {
        <button tuiButton type="button" size="m" data-testid="btn-next" (click)="next()">
          Далее
        </button>
      }
    </div>
  `,
})
export class Wizard {
  /** Компонент ведёт детей сам: узлы шагов приходят входом `children`. */
  static readonly __selfManagedChildren = true;

  readonly children = input<readonly CompiledNode[]>([]);

  protected readonly flow = (() => {
    const flow = injectFormBundle()?.flow;
    if (!flow) throw new Error('Wizard: у сборки нет потока шагов — createForm({ flow })');
    return flow;
  })();
  protected readonly steps = formFlowSignals(() => this.flow);
  protected readonly titleOf = titleOf;

  protected readonly number = computed(() => this.steps.index() + 1);
  protected readonly current = computed(() =>
    this.children().find((node) => node.selector === this.steps.current())
  );

  protected isCompleted(node: CompiledNode): boolean {
    return node.selector !== undefined && this.steps.completed().has(node.selector);
  }

  protected next(): void {
    void this.flow.next();
  }
}

/** Шаг визарда: рисует своих детей; `title` узла читает визард. */
@Component({
  selector: 'kit-step',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cross-step' },
  template: '<ng-content />',
})
export class Step {
  /** Объявлен, чтобы не лечь атрибутом `title` (всплывающей подсказкой) на хост шага. */
  readonly title = input<string>();
}
