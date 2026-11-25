/**
 * `FormRenderer` — отрисовать сборку `createForm` в Angular.
 *
 * @module renderer-angular/form-renderer
 */

import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  ViewContainerRef,
  inject,
  input,
  untracked,
  viewChild,
  type OnChanges,
  type OnDestroy,
  type StaticProvider,
  type Type,
} from '@angular/core';
import type { FormBundle } from '@reformer/core';
import type { IssueMessages } from '@reformer/core/i18n';
import {
  FORM_BUNDLE,
  ISSUE_MESSAGES,
  OVERRIDE_MAPS,
  RENDERER_SETTINGS,
  SCHEMA_CONTROLLER,
} from './context';
import { RenderTemplates } from './node.directive';
import { runScopeEffects } from './scope';
import type { RendererSettings } from './types';

/**
 * Рендер сборки `createForm`. Дерево узлов построено сборкой один раз; рендерер ставит контекст
 * сборки (форму и отправку из него берут компоненты реестра), исполняет правила узлов из
 * поведения формы (`hideWhen`, `onComponentEvent`, `onMount`) и даёт строкам массивов и
 * подформам собственные области схемы.
 *
 * Обёртка поля — `settings.fieldWrapper`, иначе та, что положил в сборку реестр. Без обёртки
 * контрол рисует поле целиком сам.
 *
 * Своих элементов рендерер в разметку не добавляет: форма стоит прямо в хост-элементе
 * `<reformer-form>`. Смена любого входа рисует форму заново.
 *
 * @example
 * ```ts
 * import { Component } from '@angular/core';
 * import { createForm } from '@reformer/core';
 * import { FormRenderer, ownFormBundle } from '@reformer/renderer-angular';
 *
 * @Component({
 *   selector: 'app-profile',
 *   imports: [FormRenderer],
 *   template: `<reformer-form [form]="bundle" [messages]="messages" />`,
 * })
 * export class ProfileForm {
 *   readonly bundle = ownFormBundle(() => createForm({ schema, registry, initial }));
 *   readonly messages = messages;
 * }
 * ```
 */
@Component({
  selector: 'reformer-form',
  template: '<ng-container #outlet />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormRenderer implements OnChanges, OnDestroy {
  /** Сборка `createForm` со схемой. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly form = input.required<FormBundle<any>>();
  readonly settings = input<RendererSettings | undefined>(undefined);
  /** Словарь формы: тексты замечаний по коду, поверх локали. */
  readonly messages = input<IssueMessages | undefined>(undefined);

  private readonly outlet = viewChild.required('outlet', { read: ViewContainerRef });
  private readonly injector = inject(Injector);
  private readonly templates = inject(RenderTemplates);
  private readonly parentMessages = inject(ISSUE_MESSAGES, { optional: true });

  private stopEffects: (() => void) | undefined;

  ngOnChanges(): void {
    // Хук исполняется внутри перерисовки родителя: сигналы Angular, прочитанные при создании
    // формы, не должны стать её зависимостями.
    untracked(() => this.render());
  }

  ngOnDestroy(): void {
    this.stopEffects?.();
    this.stopEffects = undefined;
  }

  private render(): void {
    this.stopEffects?.();
    this.stopEffects = undefined;
    const outlet = this.outlet();
    outlet.clear();

    const bundle = this.form();
    const { tree, controller, fieldWrapper } = bundle.render;
    if (tree === undefined) {
      throw new Error(
        'FormRenderer: в сборке нет дерева — у `createForm` не задана `schema`. ' +
          'Без схемы форму рисуют сами, по нодам `bundle.form`.'
      );
    }
    const rootMaps = controller.scopeOf(bundle.model as object).__overrideMaps;
    const own = this.settings();
    const bundleWrapper = fieldWrapper as Type<unknown> | undefined;
    const settings: RendererSettings | undefined =
      own?.fieldWrapper === undefined && bundleWrapper !== undefined
        ? { ...own, fieldWrapper: bundleWrapper }
        : own;

    const providers: StaticProvider[] = [
      { provide: FORM_BUNDLE, useValue: bundle },
      { provide: RENDERER_SETTINGS, useValue: settings },
      { provide: SCHEMA_CONTROLLER, useValue: { controller, rootMaps } },
      { provide: OVERRIDE_MAPS, useValue: rootMaps },
    ];
    const messages = this.messages();
    if (messages) {
      providers.push({
        provide: ISSUE_MESSAGES,
        useValue: this.parentMessages == null ? messages : { ...this.parentMessages, ...messages },
      });
    }

    const view = outlet.createEmbeddedView(
      this.templates.node,
      { $implicit: tree.root, fieldWrapper: undefined },
      { injector: Injector.create({ providers, parent: this.injector }) }
    );
    view.detectChanges();
    // Эффекты отрисовки стартуют, когда узлы уже на экране.
    this.stopEffects = runScopeEffects(rootMaps.effectRegistry);
  }
}
