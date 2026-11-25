/**
 * Области схемы: строка массива и подформа получают хранилище правил своей области.
 *
 * @module renderer-angular/scope
 */

import { Injector, isDevMode } from '@angular/core';
import { unknownSchemaSelectors } from '@reformer/core';
import type { CompiledSchema } from '@reformer/core';
import { effect } from '@reformer/core/signals';
import { OVERRIDE_MAPS, SCHEMA_CONTROLLER } from './context';

/**
 * Запустить эффекты области (`renderEffect` поведения формы). Каждый эффект перезапускается при
 * смене прочитанных в нём сигналов и может вернуть очистку.
 *
 * @returns Остановка эффектов — вызывается, когда область уходит с экрана.
 */
export function runScopeEffects(
  registry: ReadonlyArray<() => void | (() => void)> | undefined
): () => void {
  if (!registry || registry.length === 0) return () => {};
  const disposes = registry.map((run) =>
    effect(() => {
      const cleanup = run();
      return typeof cleanup === 'function' ? cleanup : undefined;
    })
  );
  return () => {
    for (const dispose of disposes) dispose();
  };
}

/** Области, для которых сверка селекторов уже выполнена, — предупреждение одно на область. */
const checkedScopes = new WeakSet<object>();

/** Граница области схемы для поддерева строки массива или подформы. */
export interface ScopeBoundary {
  /** Инжектор поддерева: отдаёт хранилище правил СВОЕЙ области. */
  readonly injector: Injector;
  /** Поддерево отрисовано: запустить эффекты области. */
  start(): void;
  /** Поддерево уходит: остановить эффекты. */
  stop(): void;
}

/**
 * Граница области схемы. Поддерево получает хранилище своей области: селекторы внутри него
 * адресуются из поведения, подключённого к той же под-модели, и не пересекаются ни с корнем, ни с
 * соседними строками.
 *
 * @param parent - Инжектор места, где рисуется поддерево.
 * @param schema - Скомпилированная схема области: её модель — ключ области.
 */
export function createScopeBoundary(parent: Injector, schema: CompiledSchema): ScopeBoundary {
  const context = parent.get(SCHEMA_CONTROLLER, null);
  const model = schema.model;
  const maps =
    context && model !== undefined ? context.controller.scopeOf(model).__overrideMaps : null;
  if (!maps) return { injector: parent, start: () => {}, stop: () => {} };

  const injector = Injector.create({
    providers: [{ provide: OVERRIDE_MAPS, useValue: maps }],
    parent,
  });
  let stopEffects: (() => void) | undefined;

  return {
    injector,
    start() {
      stopEffects = runScopeEffects(maps.effectRegistry);
      if (!isDevMode() || checkedScopes.has(maps)) return;
      checkedScopes.add(maps);
      const unknown = unknownSchemaSelectors(maps, schema);
      if (unknown.length > 0) {
        console.warn(
          '[RenderSchema] поведение области обращается к узлам, которых нет в её поддереве: ' +
            `${unknown.map((selector) => `"${selector}"`).join(', ')}. Правило ничего не сделает.`
        );
      }
    },
    stop() {
      stopEffects?.();
      stopEffects = undefined;
    },
  };
}
