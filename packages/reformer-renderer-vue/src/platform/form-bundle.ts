/**
 * Сборка формы в компоненте Vue: владение и доступ из дерева рендерера.
 *
 * @module renderer-vue/platform/form-bundle
 */

import { inject, markRaw, onMounted, onScopeDispose } from 'vue';
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
 * Фабрика вызывается в `setup` — один раз. Живая проверка запускается на монтировании (на сервере
 * хук монтирования не исполняется, и стратегия молчит), при снятии компонента останавливается, а
 * сборка снимается: поведение формы, подписки нод и идущие проверки не переживают компонент.
 *
 * Сборка помечается `markRaw`: реактивность Vue не оборачивает её в прокси, даже если она попадёт
 * в `ref()` или `reactive()`. Ядро сопоставляет ноды и ручки модели по ссылке.
 *
 * @param factory - Фабрика сборки, обычно `() => createForm({…})`. Сборкой владеет компонент,
 *   поэтому фабрика собирает НОВУЮ форму, а не отдаёт чужую, живущую дольше него.
 * @returns Сборка — одна на время жизни компонента.
 *
 * @example
 * ```ts
 * setup() {
 *   const bundle = useFormBundle(() => createForm({ schema, registry, initial }));
 *   return () => h(FormRenderer, { form: bundle });
 * }
 * ```
 */
export function useFormBundle<B extends FormBundleLike>(factory: () => B): B {
  const bundle = markRaw(factory() as B & object) as B;
  let stop: (() => void) | undefined;
  onMounted(() => {
    stop = bundle.validation?.controller.start();
  });
  onScopeDispose(() => {
    stop?.();
    bundle.dispose?.();
  });
  return bundle;
}

/**
 * Сборка формы, внутри которой отрисован компонент; `null` — компонент стоит вне рендерера.
 * Компонент реестра берёт отсюда форму и отправку: `bundle.form.reset()`,
 * `bundle.submission.submit(handler)`.
 *
 * @typeParam T - Форма данных модели.
 */
export function useFormBundleContext<T = unknown>(): FormBundle<T> | null {
  return inject(FORM_BUNDLE, null) as FormBundle<T> | null;
}
