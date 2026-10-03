/**
 * Состояние переключателя как наблюдаемое значение: список сочетаний, который сам узнаёт,
 * что устарел.
 *
 * Список — функция от двух служб ({@link describeSwitch}), а меняется он по трём поводам:
 * сменился активный кит, изменился набор китов (плагин внёс свой или его выключили), появилась
 * или исчезла сама служба китов. Третий — не редкость, а правило: порядок активации плагинов
 * ничего не значит, и плагин китов вправе подняться позже этого. Поэтому наблюдается
 * ВОЗМОЖНОСТЬ, а подписки на службу переезжают к каждому её новому владельцу.
 *
 * Профили здесь не наблюдаются намеренно: состав приложения фиксирован до перезапуска, и
 * список предложенных профилей за время жизни приложения не меняется.
 *
 * ## Снимок стабилен между изменениями
 *
 * {@link SwitchStore.get} отдаёт ОДНУ И ТУ ЖЕ ссылку, пока ничего не изменилось, — условие
 * `useSyncExternalStore`. Пересчёт на каждый вызов дал бы новую ссылку на каждой отрисовке и
 * бесконечную перерисовку ячейки.
 *
 * @module plugins/base/stack-switch/store
 */

import {
  KitsCapability,
  type CapabilityAccess,
  type Disposable,
  type KitsService,
} from '@reformer/builder-plugin-api';
import { describeSwitch, type ProfilesView, type SwitchState } from './combinations';

export interface SwitchStore extends Disposable {
  /** Текущий список; ссылка стабильна до следующего изменения. */
  get(): SwitchState;
  subscribe(listener: () => void): Disposable;
}

export interface SwitchStoreDeps {
  /** Служба профилей — в момент обращения: приложение вправе её не давать. */
  readonly profiles: () => ProfilesView | undefined;
  readonly capabilities: Pick<CapabilityAccess, 'observe'>;
}

export function createSwitchStore(deps: SwitchStoreDeps): SwitchStore {
  const listeners = new Set<() => void>();
  let kits: KitsService | undefined;
  let kitSubscriptions: Disposable[] = [];
  let snapshot: SwitchState | null = null;

  const invalidate = (): void => {
    snapshot = null;
    // Копия: подписчик вправе отписаться прямо в обработчике.
    for (const listener of [...listeners]) listener();
  };

  const releaseKit = (): void => {
    for (const subscription of kitSubscriptions) subscription.dispose();
    kitSubscriptions = [];
  };

  // Первый вызов приходит сразу, с текущим значением: отдельного `get` рядом с `observe`,
  // между которыми поместилась бы гонка, не нужно.
  const observed = deps.capabilities.observe(KitsCapability, (impl) => {
    releaseKit();
    kits = impl;
    if (impl !== undefined) {
      kitSubscriptions = [impl.onDidChange(invalidate), impl.onDidChangeAvailable(invalidate)];
    }
    invalidate();
  });

  return {
    get() {
      snapshot ??= describeSwitch(deps.profiles(), kits);
      return snapshot;
    },
    subscribe(listener) {
      listeners.add(listener);
      return {
        dispose: () => {
          listeners.delete(listener);
        },
      };
    },
    dispose() {
      observed.dispose();
      releaseKit();
      listeners.clear();
    },
  };
}
