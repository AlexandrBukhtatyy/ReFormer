/**
 * Сборка формы в компоненте Angular: владение и доступ из дерева рендерера.
 *
 * @module renderer-angular/platform/form-bundle
 */

import { DestroyRef, afterNextRender, inject } from '@angular/core';
import type { FormBundle } from '@reformer/core';
import { FORM_BUNDLE } from '../context';

/** Минимум, который ожидается от сборки: живая проверка и снятие — оба необязательны. */
export interface FormBundleLike {
  validation?: { controller: { start(): () => void } };
  /** Снять сборку: поведение, подписки нод, живую проверку. */
  dispose?(): void;
}

/**
 * Собрать форму один раз на компонент и снять её вместе с ним.
 *
 * Вызывать при создании компонента — в инициализаторе поля или в конструкторе. Живая проверка
 * запускается после первой отрисовки (на сервере она не исполняется, и стратегия молчит), при
 * снятии компонента останавливается, а сборка снимается: поведение формы, подписки нод и идущие
 * проверки не переживают компонент.
 *
 * @param factory - Фабрика сборки, обычно `() => createForm({…})`. Сборкой владеет компонент,
 *   поэтому фабрика собирает НОВУЮ форму, а не отдаёт чужую, живущую дольше него.
 * @returns Сборка — одна на время жизни компонента.
 *
 * @example
 * ```ts
 * @Component({
 *   imports: [FormRenderer],
 *   template: `<reformer-form [form]="bundle" />`,
 * })
 * export class ProfileForm {
 *   readonly bundle = ownFormBundle(() => createForm({ schema, registry, initial }));
 * }
 * ```
 */
export function ownFormBundle<B extends FormBundleLike>(factory: () => B): B {
  const destroyRef = inject(DestroyRef);
  const bundle = factory();
  let stop: (() => void) | undefined;
  let destroyed = false;
  afterNextRender(() => {
    if (!destroyed) stop = bundle.validation?.controller.start();
  });
  destroyRef.onDestroy(() => {
    destroyed = true;
    stop?.();
    bundle.dispose?.();
  });
  return bundle;
}

/**
 * Сборка формы, внутри которой отрисован компонент; `null` — компонент стоит вне рендерера.
 * Компонент реестра берёт отсюда форму и отправку: `bundle.form.reset()`,
 * `bundle.submission.submit(handler)`. Вызывать при создании компонента.
 *
 * @typeParam T - Форма данных модели.
 */
export function injectFormBundle<T = unknown>(): FormBundle<T> | null {
  return inject(FORM_BUNDLE, { optional: true }) as FormBundle<T> | null;
}
