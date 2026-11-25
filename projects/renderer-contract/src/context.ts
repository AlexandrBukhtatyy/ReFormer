/**
 * Контекст сценариев: адаптер, кит, форма-образец и учёт того, что тест собрал и смонтировал.
 *
 * @module renderer-contract/context
 */

import { createForm } from '@reformer/core';
import type { CreateFormConfig, FormBundle } from '@reformer/core';
import type { ContractAdapter, ContractKit, MountOptions, Mounted } from './adapter';
import { createFixture, type Fixture } from './fixture';

/** Что получает файл сценариев. */
export interface ScenarioContext {
  adapter: ContractAdapter;
  kit: ContractKit;
  fixture: Fixture;
  /** Собрать форму `createForm`. После теста сборка снимается. */
  form<T extends object>(config: CreateFormConfig<T>): FormBundle<T>;
  /** Смонтировать сборку рендерером стека. После теста форма снимается с экрана. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mount(bundle: FormBundle<any>, options?: MountOptions): Promise<Mounted>;
  /** Снять всё, что смонтировал и собрал тест. Набор зовёт сам после каждого теста. */
  cleanup(): Promise<void>;
}

/** Контекст для адаптера: один на набор. */
export function createContext(adapter: ContractAdapter): ScenarioContext {
  const mounted = new Set<Mounted>();
  const bundles = new Set<{ dispose(): void }>();

  return {
    adapter,
    kit: adapter.kit,
    fixture: createFixture(adapter.kit),

    form(config) {
      const bundle = createForm(config);
      bundles.add(bundle);
      return bundle;
    },

    async mount(bundle, options) {
      const handle = await adapter.mount(bundle, options);
      // Снятие — один раз: сценарий мог снять форму сам, набор после теста её не тронет.
      const tracked: Mounted = {
        root: handle.root,
        settle: () => handle.settle(),
        unmount: async () => {
          if (!mounted.delete(tracked)) return;
          await handle.unmount();
        },
      };
      mounted.add(tracked);
      return tracked;
    },

    async cleanup() {
      for (const handle of [...mounted]) await handle.unmount();
      for (const bundle of bundles) bundle.dispose();
      bundles.clear();
    },
  };
}
