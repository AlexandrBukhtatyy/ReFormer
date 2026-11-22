/**
 * Харнесс правил узлов схемы: исполняет записи поведения так, как это делает рендерер
 * (`@reformer/renderer-react`: `src/core/render-node.tsx`, `render-behavior.ts`,
 * `render-schema-proxy.ts`), но без React.
 *
 * Операторы узлов (`hideWhen`, `onComponentEvent`, `onMount`/`onUnmount`, `renderEffect`) и
 * управление узлом (`setHidden`, `patchProps`) только ЗАПИСЫВАЮТ правило в хранилище области
 * (`scope.__overrideMaps`); исполняет его рендерер. Тест ядра проверяет запись через харнесс, а не
 * через внутренние карты, — и видит то же, что увидел бы пользователь формы:
 *
 * - **монтирование области** — сначала эффекты `renderEffect` (снимок реестра на момент
 *   монтирования, каждый в своём `effect`, как `RenderBehaviorEffects`), затем узлы по порядку:
 *   `onMount` (результат-функция — его очистка). Хуки берутся при монтировании, как `useEffect`
 *   рендерера, и у скрытого узла тоже: рендерер зовёт хуки до `return null`;
 * - **скрытие** — принудительное `setHidden` главнее условия `hideWhen`; без того и другого узел
 *   виден;
 * - **пропсы компонента** — `componentProps` схемы ← `patchProps` ← обработчики
 *   `onComponentEvent`. Скрытый узел компонент не рисует — пропсов нет;
 * - **событие** — компонент зовёт свой проп (`props.onSubmit?.(…)`): `fire` берёт обработчик из
 *   собранных пропсов; нет обработчика — ничего не происходит;
 * - **размонтирование** — снимаются эффекты области, затем у каждого узла очистка из `onMount` и
 *   `onUnmount` (хуки — те, что взяты при монтировании).
 *
 * Скрытие и пропсы читаются в момент вызова — так, как их покажет рендерер после перерисовки
 * узла. Дерево не моделируется: каждый переданный узел смонтирован, пока смонтирована область;
 * поддерево скрытого узла рендерер не монтирует — такие узлы не передавайте. Пропсы и события
 * моделируют узел-контейнер (секция, шаг, визард): узел-поле и узел-массив рендерер рисует своим
 * путём, `patchProps`/`onComponentEvent` к ним он не применяет.
 *
 * @example
 * ```ts
 * const view = mountScope(controller.scopeOf(model), [
 *   { selector: 'wizard', componentProps: { title: 'Заявка' } },
 *   'mortgage',
 * ]);
 * expect(view.isHidden('mortgage')).toBe(true);
 * await view.fire('wizard', 'onSubmit', values);
 * view.unmount();
 * ```
 *
 * @module test-utils/schema-harness
 */

import { effect } from '@preact/signals-core';
import type { NodeLifecycleHooks, SchemaScope } from '../../src/form/schema-controller';

/** Узел области: селектор и `componentProps` из схемы. */
export interface HarnessNode {
  readonly selector: string;
  /** `componentProps` узла в схеме — база, поверх которой рендерер кладёт переопределения. */
  readonly componentProps?: Readonly<Record<string, unknown>>;
}

/** Смонтированная область. */
export interface MountedScope {
  /** Скрыт ли узел сейчас. */
  isHidden(selector: string): boolean;
  /** Пропсы компонента узла; у скрытого узла компонента нет — `undefined`. */
  propsOf(selector: string): Readonly<Record<string, unknown>> | undefined;
  /**
   * Компонент узла вызывает проп-событие с аргументами. Возвращает результат обработчика
   * (промис async-обработчика — тоже); нет обработчика — `undefined`.
   */
  fire(selector: string, event: string, ...args: unknown[]): unknown;
  /** Размонтировать область. */
  unmount(): void;
}

/** Хуки узла, взятые при монтировании, и очистка, которую вернул его `onMount`. */
interface MountedNode {
  readonly hooks: NodeLifecycleHooks | undefined;
  readonly mountCleanup: void | (() => void);
}

/**
 * Смонтировать область схемы: запустить её эффекты и хуки монтирования узлов.
 *
 * @param scope - Схема области: `controller.scopeOf(model)`, `bundle.render.controller.scopeOf(…)`
 *   либо `schema` из области поведения.
 * @param nodes - Узлы области в порядке монтирования: селектор либо `{ selector, componentProps }`.
 */
export function mountScope(
  scope: SchemaScope,
  nodes: ReadonlyArray<string | HarnessNode>
): MountedScope {
  const maps = scope.__overrideMaps;
  const specs = new Map<string, HarnessNode>();
  for (const entry of nodes) {
    const spec = typeof entry === 'string' ? { selector: entry } : entry;
    if (specs.has(spec.selector)) {
      throw new Error(`[schema-harness] узел «${spec.selector}» передан дважды`);
    }
    specs.set(spec.selector, spec);
  }

  // RenderBehaviorEffects: реестр читается один раз; эффект, вернувший функцию, получает очистку.
  const stopEffects = maps.effectRegistry.map((effectFn) =>
    effect(() => {
      const cleanup = effectFn();
      return typeof cleanup === 'function' ? cleanup : undefined;
    })
  );

  // useNodeLifecycle: хуки узла на момент монтирования; onMount может вернуть очистку.
  const mounted: MountedNode[] = [...specs.keys()].map((selector) => {
    const hooks = maps.lifecycleRegistry.get(selector);
    return { hooks, mountCleanup: hooks?.onMount?.() };
  });

  let alive = true;
  const specOf = (selector: string): HarnessNode => {
    if (!alive) throw new Error('[schema-harness] область размонтирована');
    const spec = specs.get(selector);
    if (!spec) throw new Error(`[schema-harness] узел «${selector}» не смонтирован`);
    return spec;
  };

  // useHiddenOverride + useCondition: override ?? условие ?? виден.
  const isHidden = (selector: string): boolean => {
    specOf(selector);
    const forced = maps.hiddenOverrides.get(selector) ?? null;
    if (forced != null) return forced;
    return maps.conditionRegistry.get(selector)?.() ?? false;
  };

  // usePropsOverride + callbackRegistry: обработчики событий главнее подмешанных пропсов.
  const propsOf = (selector: string): Readonly<Record<string, unknown>> | undefined => {
    const spec = specOf(selector);
    if (isHidden(selector)) return undefined;
    const patched = maps.propsOverrides.get(selector) ?? null;
    const callbacks = maps.callbackRegistry.get(selector);
    return {
      ...(spec.componentProps ?? {}),
      ...(patched ?? {}),
      ...(callbacks ? Object.fromEntries(callbacks) : {}),
    };
  };

  const fire = (selector: string, event: string, ...args: unknown[]): unknown => {
    const props = propsOf(selector);
    if (props === undefined) {
      throw new Error(
        `[schema-harness] узел «${selector}» скрыт: компонента нет, событию неоткуда прийти`
      );
    }
    const handler = props[event];
    return typeof handler === 'function'
      ? (handler as (...a: unknown[]) => unknown)(...args)
      : undefined;
  };

  const unmount = (): void => {
    if (!alive) throw new Error('[schema-harness] область уже размонтирована');
    alive = false;
    stopEffects.forEach((stop) => stop());
    for (const { hooks, mountCleanup } of mounted) {
      if (typeof mountCleanup === 'function') mountCleanup();
      hooks?.onUnmount?.();
    }
  };

  return { isHidden, propsOf, fire, unmount };
}
