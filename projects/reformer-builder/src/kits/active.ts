/**
 * Активный кит: ДЕСКРИПТОР (метаданные). React-free — этот модуль читают `model/node-kind` и
 * `preview-runtime/render-policy`, которые обязаны работать в node-тестах, поэтому namespace
 * с React-компонентами живёт отдельно, в {@link './runtime'}.
 *
 * Почему состояние, а не производная от каталога: `node-kind.isLeafComponentRef` и
 * `render-policy` спрашивают дескриптор из холодных путей, а каталог строится из `catalog/contract`,
 * который сам зависит от `make-node` → `node-kind`. Прямая связь дала бы цикл
 * `node-kind → catalog → make-node → node-kind`. Поэтому дескриптор кладётся сюда тем, кто собрал
 * каталог (`catalog/catalog.buildCatalog`), а до этого работает фолбэк на дефолты билдера.
 *
 * Фолбэк не «почти правильный», а точный — в той части, ради которой он существует: множества
 * `leafComponents`/`previewPolicy`/`unresolvedReason` и правила резолва у встроенного кита
 * совпадают с дескриптором, собранным по каталогу (per-record полей контракта 2.0 в поставляемом
 * `component-catalog.json` нет). Это закреплено `active.test.ts`.
 *
 * ИСКЛЮЧЕНИЕ — `styles.classNames`/`classGroupPolicy`: их билдер вывести не может, они приходят
 * только из блока `kit`, поэтому у фолбэка словарь пуст. Потребители обязаны читать их ПОСЛЕ сборки
 * каталога — см. `catalog/class-names`, где для этого вызывается `getCatalog()`.
 *
 * @module reformer-builder/kits/active
 */

import { toDescriptor } from './descriptor';
import type { KitDescriptor } from './types';

/** Дескриптор, положенный сборкой каталога. `null` — ещё не собирали, работает фолбэк. */
let active: KitDescriptor | null = null;

/** Мемо фолбэка: пересобирать дефолтный дескриптор на каждый вызов незачем. */
let fallback: KitDescriptor | null = null;

/**
 * Дескриптор активного кита. До сборки каталога — дефолты билдера («неявный кит»), после —
 * дескриптор, собранный из фактического каталога (с per-record полями, если кит их прислал).
 */
export function getActiveDescriptor(): KitDescriptor {
  // `version` каталога дескриптором не используется — важен только пустой список записей.
  return active ?? (fallback ??= toDescriptor({ version: '1.0', components: [] }));
}

/** Положить дескриптор активного кита (вызывается сборкой каталога). */
export function setActiveDescriptor(descriptor: KitDescriptor): void {
  active = descriptor;
}

/** Сбросить активный кит к дефолтам билдера (тесты; смена кита — этап 3). */
export function resetActiveDescriptor(): void {
  active = null;
}
