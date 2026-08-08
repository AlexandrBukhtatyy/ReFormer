/**
 * Исполнение транспилированного CommonJS-модуля формы.
 *
 * `new Function(...)` вместо blob-import намеренно: динамический `import()` из blob-URL резолвил бы
 * голые спецификаторы браузером, то есть тянул бы ВТОРОЙ бандл `@reformer/core` — и форма потеряла
 * бы связь сигналов с form-node'ами (см. `module-registry`). CJS-конверт позволяет подсунуть
 * собственный `require`, оставаясь на инстансах билдера.
 *
 * Код исполняется в главном потоке с правами приложения. Это осознанный tradeoff (сендбокс
 * несовместим с требованием единого инстанса signals), поэтому вызывающий обязан спросить
 * пользователя перед первым исполнением.
 *
 * @module reformer-builder/preview-runtime/live/link
 */

import type { ModuleExports } from './module-registry';

/** Резолвер импортов: получает спецификатор как он написан в коде, отдаёт объект экспортов. */
export type RequireFn = (spec: string) => ModuleExports;

/**
 * Выполнить CJS-код и вернуть его `module.exports`.
 *
 * `fileName` уходит в `sourceURL`, поэтому в DevTools и в стеке ошибок видно `form/validation.ts`,
 * а не `<anonymous>`. Ошибки исполнения пробрасываются вызывающему как есть — он знает, к какому
 * файлу их отнести.
 */
export function evalCjsModule(js: string, require: RequireFn, fileName: string): ModuleExports {
  const module = { exports: {} as ModuleExports };
  const source = `${js}\n//# sourceURL=reformer-builder:///${fileName}`;
  // `new Function`, а не `eval`: код приходит не из сети, а из файла проекта, который пользователь
  // открыл сам и явно разрешил исполнить (подтверждение — в `LiveSchemasControl`).
  const factory = new Function('exports', 'require', 'module', '__filename', source) as (
    exports: ModuleExports,
    require: RequireFn,
    module: { exports: ModuleExports },
    filename: string
  ) => void;
  factory(module.exports, require, module, fileName);
  return module.exports;
}
