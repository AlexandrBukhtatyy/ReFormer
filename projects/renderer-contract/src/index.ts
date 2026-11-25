/**
 * Контрактный набор рендерера ReFormer: одни и те же сценарии для React, Vue и Angular.
 *
 * Пакет рендерера подключает набор одним тестовым файлом: описывает адаптер (кит компонентов-зондов
 * и монтирование) и зовёт {@link describeRendererContract}.
 *
 * @module renderer-contract
 */

import { afterEach, describe, vi } from 'vitest';
import type { ContractAdapter } from './adapter';
import { createContext } from './context';
import { arraysScenarios } from './scenarios/arrays';
import { contextScenarios } from './scenarios/context';
import { fieldBindingScenarios } from './scenarios/field-binding';
import { propsEventsScenarios } from './scenarios/props-events';
import { refsLifecycleScenarios } from './scenarios/refs-lifecycle';
import { scopesVisibilityScenarios } from './scenarios/scopes-visibility';
import { selfManagedScenarios } from './scenarios/self-managed';
import { textHtmlScenarios } from './scenarios/text-html';
import { treeScenarios } from './scenarios/tree';
import { wrapperScenarios } from './scenarios/wrapper';

export type { ContractAdapter, ContractKit, KitComponent, Mounted, MountOptions } from './adapter';

/**
 * Объявить контрактный набор для рендерера. Вызывается на верхнем уровне тестового файла под
 * окружением с DOM.
 *
 * @example
 * ```ts
 * // @vitest-environment happy-dom
 * import { describeRendererContract } from 'renderer-contract';
 *
 * describeRendererContract({ name: 'renderer-vue', kit, mount });
 * ```
 */
export function describeRendererContract(adapter: ContractAdapter): void {
  describe(`контракт рендерера — ${adapter.name}`, () => {
    const context = createContext(adapter);

    afterEach(async () => {
      await context.cleanup();
      vi.restoreAllMocks();
    });

    treeScenarios(context);
    scopesVisibilityScenarios(context);
    propsEventsScenarios(context);
    fieldBindingScenarios(context);
    wrapperScenarios(context);
    arraysScenarios(context);
    textHtmlScenarios(context);
    selfManagedScenarios(context);
    contextScenarios(context);
    refsLifecycleScenarios(context);
  });
}
