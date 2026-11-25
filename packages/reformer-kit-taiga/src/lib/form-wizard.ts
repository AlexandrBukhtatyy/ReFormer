/**
 * `FormWizard` и `Step` ui-kit на Taiga UI: шапка — `tui-stepper`, кнопки — `tuiButton`, шаги и
 * переходы — поток сборки `createForm({ flow })`.
 *
 * Визард ведёт детей сам (`__selfManagedChildren`): рендерер отдаёт ему узлы шагов входом
 * `children`, текущий шаг визард рисует директивой `reformerNode`. Шаг потока — узел с тем же
 * `selector`. «Далее» — `flow.next()`: правила текущего шага, при замечаниях шаг не меняется;
 * «Назад» — `flow.previous()`. На последнем шаге «Отправить» проверяет всю форму через
 * `bundle.submission` и зовёт `onSubmit` — его ставит поведение формы
 * (`onComponentEvent(schema.node('wizard'), 'onSubmit', …)`).
 *
 * От `tui-stepper` берётся только шапка: шаг по клику он делает текущим сам, без проверки текущего,
 * поэтому пункты шапки не нажимаются. Роли — как у визарда ui-kit: `step-indicator`,
 * `step-indicator-{номер}`, `btn-previous` (нет на первом шаге), `btn-next`, `btn-submit`.
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

@Component({
  selector: 'kit-form-wizard',
  imports: [ReformerNode, TuiButton, TuiStepper],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'classes()' },
  template: `
    <tui-stepper
      class="kit-wizard__steps"
      data-slot="step-indicator"
      data-testid="step-indicator"
      [activeItemIndex]="steps.index()"
    >
      @for (node of children(); track node.id; let position = $index) {
        <!-- Состояние пункта — те же атрибуты, что у шапки визарда ui-kit. -->
        <button
          tuiStep
          type="button"
          tabindex="-1"
          [stepState]="isCompleted(node) ? 'pass' : 'normal'"
          [attr.data-testid]="'step-indicator-' + (position + 1)"
          [attr.data-step-number]="position + 1"
          [attr.data-step-current]="position === steps.index()"
          [attr.data-step-completed]="isCompleted(node)"
        >
          {{ titleOf(node) }}
        </button>
      }
    </tui-stepper>
    @if (current(); as node) {
      <ng-container [reformerNode]="node" />
    }
    <div class="kit-actions">
      @if (!steps.isFirst()) {
        <button
          tuiButton
          type="button"
          appearance="secondary"
          size="m"
          data-testid="btn-previous"
          (click)="flow.previous()"
        >
          Назад
        </button>
      }
      @if (steps.isLast()) {
        <button tuiButton type="button" size="m" data-testid="btn-submit" (click)="submit()">
          {{ submitLabel() }}
        </button>
      } @else {
        <button tuiButton type="button" size="m" data-testid="btn-next" (click)="next()">
          Далее
        </button>
      }
    </div>
  `,
})
export class FormWizard {
  /** Компонент ведёт детей сам: узлы шагов приходят входом `children`. */
  static readonly __selfManagedChildren = true;

  readonly children = input<readonly CompiledNode[]>([]);
  readonly submitLabel = input('Отправить');
  readonly onSubmit = input<(values: unknown) => void | Promise<void>>();
  readonly className = input<string>();

  private readonly bundle = (() => {
    const bundle = injectFormBundle();
    if (!bundle?.flow) {
      throw new Error('FormWizard: у сборки нет потока шагов — createForm({ flow })');
    }
    return bundle;
  })();
  protected readonly flow = this.bundle.flow!;
  protected readonly steps = formFlowSignals(() => this.flow);
  protected readonly titleOf = titleOf;

  protected readonly classes = computed(() =>
    ['kit-wizard', 'kit-stack', this.className()].join(' ').trim()
  );
  protected readonly current = computed(() =>
    this.children().find((node) => node.selector === this.steps.current())
  );

  protected isCompleted(node: CompiledNode): boolean {
    return node.selector !== undefined && this.steps.completed().has(node.selector);
  }

  protected next(): void {
    void this.flow.next();
  }

  protected submit(): void {
    const onSubmit = this.onSubmit();
    void this.bundle.submission.submit(async (values) => {
      await onSubmit?.(values);
    });
  }
}

/** Шаг визарда: рисует своих детей; `title` узла читает визард. */
@Component({
  selector: 'kit-step',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'kit-step kit-stack' },
  template: '<ng-content />',
})
export class Step {
  /** Объявлены, чтобы не лечь атрибутами (`title` — всплывающей подсказкой) на хост шага. */
  readonly title = input<string>();
  readonly icon = input<string>();
}
