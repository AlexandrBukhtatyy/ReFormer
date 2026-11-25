/**
 * Контрактный набор рендерера на Angular: те же сценарии проходят рендереры React и Vue.
 *
 * Здесь только то, что у стека своё, — кит компонентов-зондов и монтирование. Что именно
 * проверяется, описано сценариями пакета `renderer-contract`.
 *
 * Хост каждого зонда — сам нативный элемент (селектор по тегу и атрибуту): `data-testid` и класс,
 * которых зонд входами не объявил, рендерер ставит на хост-элемент, то есть прямо на `<input>`,
 * `<button>` или `<section>`.
 */
import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  ErrorHandler,
  computed,
  createComponent,
  input,
  output,
  provideZonelessChangeDetection,
  type Type,
} from '@angular/core';
import { createApplication } from '@angular/platform-browser';
import type { CompiledNode, FormControl } from '@reformer/core';
import { createI18n } from '@reformer/core/i18n';
import { describeRendererContract, type ContractKit, type Mounted } from 'renderer-contract';
import {
  FormRenderer,
  ReformerArrayItem,
  ReformerNode,
  fromCoreSignal,
  injectFormBundle,
  provideReformerI18n,
  type ArrayItemSlot,
} from '../src/public-api';

// ---------------------------------------------------------------------------
// Кит: компоненты-зонды пишут полученные входы в атрибуты
// ---------------------------------------------------------------------------

/** Входы контрола, которые зонд выводит атрибутами: атрибут есть, только когда вход получен. */
@Directive({
  host: {
    '[attr.placeholder]': 'placeholder()',
    '[attr.data-caption]': 'caption()',
    '[attr.data-options]': 'options()?.length',
    '[attr.data-label]': 'label()',
    '[attr.data-description]': 'description()',
    '[attr.data-required]': 'required()',
  },
})
abstract class ProbeControl {
  readonly disabled = input(false);
  readonly caption = input<unknown>();
  readonly placeholder = input<unknown>();
  readonly options = input<readonly unknown[]>();
  readonly label = input<unknown>();
  readonly description = input<unknown>();
  readonly required = input<boolean>();
}

/** Текст поля ввода из события `input`. */
const typed = (event: Event): string => (event.target as HTMLInputElement).value;

/**
 * Текстовый контрол диалекта `[(value)]`: вход `value`, выход `valueChange`. Потерю фокуса ловит
 * слушатель, который рендерер ставит на хост-элемент.
 */
@Component({
  selector: 'input[probeInput]',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[value]': 'text()', '[disabled]': 'disabled()', '(input)': 'emit($event)' },
})
class ProbeInput extends ProbeControl {
  readonly value = input<unknown>();
  readonly valueChange = output<string>();
  protected readonly text = computed(() => String(this.value() ?? ''));

  protected emit(event: Event): void {
    this.valueChange.emit(typed(event));
  }
}

@Component({
  selector: 'input[probeInlineInput]',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class ProbeInlineInput extends ProbeInput {
  static readonly reformerLayout = 'inline-label';
}

/** Контрол с нодой поля: значение — `value` / `onChange`, как у адаптера без своего диалекта. */
@Component({
  selector: 'input[probeControlInput]',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[value]': 'text()',
    '[disabled]': 'disabled()',
    '[attr.data-path]': 'path()',
    '(input)': 'emit($event)',
  },
})
class ProbeControlInput extends ProbeControl {
  static readonly reformerAdapter = { passControl: true };

  readonly value = input<unknown>();
  /** Колбэк входом, а не выходом: зонду нужно знать, передан ли он. */
  readonly onChange = input<(value: unknown) => void>();
  readonly control = input<FormControl<unknown>>();
  protected readonly text = computed(() => String(this.value() ?? ''));
  protected readonly path = fromCoreSignal(() => this.control()?.path.value);

  protected emit(event: Event): void {
    this.onChange()?.(typed(event));
  }
}

@Component({
  selector: 'button[probeToggle]',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    type: 'button',
    '[disabled]': 'disabled()',
    '[attr.data-checked]': 'checked() === true',
    '[attr.data-caption]': 'caption()',
    '(click)': 'toggle.emit(checked() !== true)',
  },
})
class ProbeToggle {
  static readonly reformerAdapter = { valueProp: 'checked', changeProp: 'onToggle' };

  readonly checked = input<boolean>();
  readonly disabled = input(false);
  readonly caption = input<unknown>();
  readonly toggle = output<boolean>();
}

/** Контейнер. Класс узла входом не объявлен — рендерер ставит его на хост-элемент. */
@Component({
  selector: 'section[probeSection]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (onSubmit(); as submit) {
      <button type="button" data-action="submit" (click)="submit('payload')"></button>
    }
    <ng-content />
  `,
  host: {
    '[attr.data-title]': 'title()',
    '[attr.data-tone]': 'tone()',
    '[attr.data-items]': 'joined()',
    '[attr.data-selector]': 'selector()',
  },
})
class ProbeSection {
  readonly title = input<unknown>();
  readonly tone = input<unknown>();
  readonly items = input<readonly unknown[]>();
  readonly selector = input<string>();
  readonly onSubmit = input<(payload: unknown) => void>();
  protected readonly joined = computed(() => this.items()?.join('+'));
}

@Component({
  selector: 'div[probeList]',
  imports: [ReformerArrayItem],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul>
      @for (item of items(); track item.key) {
        <li [attr.data-index]="item.index">
          <ng-container [reformerArrayItem]="item" />
          <button type="button" data-action="remove" (click)="remove(item.index)"></button>
          <button type="button" data-action="up" (click)="move(item.index, -1)"></button>
          <button type="button" data-action="down" (click)="move(item.index, 1)"></button>
        </li>
      }
    </ul>
    <button type="button" data-action="add" (click)="add()"></button>
  `,
  host: {
    'data-list': '',
    '[attr.data-title]': 'title()',
    '[attr.data-add-label]': 'addLabel()',
  },
})
class ProbeList {
  readonly items = input<readonly ArrayItemSlot[]>([]);
  readonly onAdd = input<() => void>();
  readonly onRemove = input<(index: number) => void>();
  readonly onMove = input<(from: number, to: number) => void>();
  readonly title = input<unknown>();
  readonly addLabel = input<unknown>();

  protected add(): void {
    this.onAdd()?.();
  }

  protected remove(index: number): void {
    this.onRemove()?.(index);
  }

  protected move(index: number, shift: number): void {
    this.onMove()?.(index, index + shift);
  }
}

/** Ведёт детей сам: узлы приходят входом `children`, рисует их директива `reformerNode`. */
@Component({
  selector: 'ol[probeSteps]',
  imports: [ReformerNode],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (child of children(); track child.id) {
      <li
        [attr.data-step]="child.selector"
        [attr.data-kind]="child.kind"
        [attr.data-title]="titleOf(child)"
      >
        <ng-container [reformerNode]="child" />
      </li>
    }
  `,
  host: { '[attr.data-count]': 'children().length' },
})
class ProbeSteps {
  static readonly __selfManagedChildren = true;

  readonly children = input<readonly CompiledNode[]>([]);

  protected titleOf(child: CompiledNode): unknown {
    return (child.props as { title?: unknown } | undefined)?.title;
  }
}

/** Обёртка поля: нода поля и `testId` — входами, класс узла — на хост-элементе. */
@Component({
  selector: 'div[probeFieldWrapper]',
  template: '<ng-content />',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-wrap': 'field',
    '[attr.data-testid]': '"field-" + testId()',
    '[attr.data-issues]': 'issues()',
  },
})
class ProbeFieldWrapper {
  readonly control = input.required<FormControl<unknown>>();
  readonly testId = input<string>();
  protected readonly issues = fromCoreSignal(() => this.control().issues.value.length);
}

@Component({
  selector: 'div[probePlainWrapper]',
  template: '<ng-content />',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'data-wrap': 'plain' },
})
class ProbePlainWrapper {
  readonly control = input.required<FormControl<unknown>>();
  readonly testId = input<string>();
}

@Component({
  selector: 'b[probeBundle]',
  template: '{{ text() }}',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'data-testid': 'bundle-probe' },
})
class ProbeBundle {
  private readonly bundle = injectFormBundle<{ kind: string }>();
  protected readonly text = fromCoreSignal(() =>
    this.bundle ? `форма:${this.bundle.form.kind.value.value}` : 'нет сборки'
  );
}

const kit: ContractKit = {
  Input: ProbeInput,
  InlineInput: ProbeInlineInput,
  Toggle: ProbeToggle,
  ControlInput: ProbeControlInput,
  Section: ProbeSection,
  List: ProbeList,
  Steps: ProbeSteps,
  FieldWrapper: ProbeFieldWrapper,
  PlainWrapper: ProbePlainWrapper,
  BundleProbe: ProbeBundle,
};

// ---------------------------------------------------------------------------
// Монтирование
// ---------------------------------------------------------------------------

describeRendererContract({
  name: 'renderer-angular',
  kit,

  async mount(bundle, options = {}): Promise<Mounted> {
    // Ошибку отложенной перерисовки Angular отдаёт обработчику приложения.
    let failure: unknown;
    const app = await createApplication({
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: ErrorHandler,
          useValue: {
            handleError(error: unknown): void {
              failure ??= error;
            },
          },
        },
        options.locale ? [provideReformerI18n(createI18n(options.locale))] : [],
      ],
    });
    const root = document.createElement('div');
    document.body.appendChild(root);
    const unmount = (): void => {
      app.destroy();
      root.remove();
    };
    const settle = async (): Promise<void> => {
      await app.whenStable();
      if (failure !== undefined) throw failure;
    };

    try {
      const ref = createComponent(FormRenderer, {
        environmentInjector: app.injector,
        hostElement: root,
      });
      ref.setInput('form', bundle);
      if (options.fieldWrapper) {
        ref.setInput('settings', { fieldWrapper: options.fieldWrapper as Type<unknown> });
      }
      app.attachView(ref.hostView);
      // Первая отрисовка — как у `bootstrap()`; дальше перерисовку планирует сам Angular.
      app.tick();
      await settle();
    } catch (error) {
      unmount();
      throw error;
    }

    return { root, settle, unmount };
  },
});
