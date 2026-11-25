/**
 * Поток шагов формы в компоненте Vue: сигналы потока как ссылки.
 *
 * @module renderer-vue/platform/form-flow
 */

import { getCurrentScope, type ShallowRef } from 'vue';
import type { FormFlow } from '@reformer/core';
import { useSignalValue } from '../bridge/signals';

type Ref<T> = Readonly<ShallowRef<T>>;

/** Состояние потока шагов ссылками Vue. Подписка на сигнал заводится при первом чтении ключа. */
export interface FormFlowRefs {
  /** Идентификатор текущего шага. */
  readonly current: Ref<string>;
  /** Место текущего шага среди участвующих, с нуля. */
  readonly index: Ref<number>;
  /** Шаги, которые сейчас участвуют в потоке, по порядку. */
  readonly activeSteps: Ref<readonly string[]>;
  /** Пройденные шаги. */
  readonly completed: Ref<ReadonlySet<string>>;
  readonly isFirst: Ref<boolean>;
  readonly isLast: Ref<boolean>;
  /** Идёт проверка шага перед переходом. */
  readonly validating: Ref<boolean>;
}

const KEYS = [
  'current',
  'index',
  'activeSteps',
  'completed',
  'isFirst',
  'isLast',
  'validating',
] as const;

/**
 * Состояние потока шагов для рендер-функции. Компонент подписывается только на прочитанное:
 * визард, который не показывает `validating`, на проверку шага не перерисовывается.
 *
 * Переходы — методы самого потока: `flow.next()`, `flow.previous()`, `flow.goTo(id)`.
 *
 * Вызывать в `setup`: подписки живут в его области и снимаются вместе с компонентом.
 *
 * @param flow - Поток шагов сборки: `createForm({ flow })` → `bundle.flow`.
 *
 * @example
 * ```ts
 * setup() {
 *   const flow = useFormBundleContext()!.flow!;
 *   const { current, isLast } = useFormFlow(flow);
 *   return () =>
 *     h('button', { disabled: isLast.value, onClick: () => void flow.next() }, current.value);
 * }
 * ```
 */
export function useFormFlow(flow: FormFlow): FormFlowRefs {
  const scope = getCurrentScope();
  const refs = {} as Record<string, Ref<unknown>>;
  const out = {} as Record<string, unknown>;
  for (const name of KEYS) {
    Object.defineProperty(out, name, {
      enumerable: true,
      get: () => {
        if (!(name in refs)) {
          const bridge = () => useSignalValue(() => flow[name].value as unknown);
          refs[name] = scope ? scope.run(bridge)! : bridge();
        }
        return refs[name];
      },
    });
  }
  return out as unknown as FormFlowRefs;
}
