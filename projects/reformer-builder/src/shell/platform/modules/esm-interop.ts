/**
 * Экспорты CommonJS-модуля в виде пространства имён ESM — то, что получает `await import()`.
 *
 * Правило не своё: это дословно помощник `__toESM` из сборок esbuild. Пока отложенный импорт
 * собранного плагина был `require`, оборачивал его именно он, и код плагина написан под этот
 * результат. Теперь импорт приходит хост-функции (`./loader`, {@link LazyLoad}) — и она обязана
 * отдать ровно то же, иначе плагин, работавший вчера, сегодня не нашёл бы свой `default`.
 *
 * Правило в двух строках: модуль, помеченный `__esModule` (собран из ESM), отдаёт свои экспорты
 * как есть; любой другой — данные, CommonJS-пакет — ещё и `default`, равный самому модулю.
 * Свойства — геттеры на исходный объект: живые привязки ESM, а не снимок.
 *
 * Совпадение с esbuild сверяет тест — на его же собранном помощнике.
 *
 * @module shell/platform/modules/esm-interop
 */

/** Оборачивает экспорты модуля пространством имён. Каждый вызов — новый объект. */
export function toEsmNamespace(mod: unknown): unknown {
  const target: object =
    mod != null ? (Object.create(Object.getPrototypeOf(mod) as object | null) as object) : {};

  const marked =
    mod != null && Boolean(mod) && Boolean((mod as { __esModule?: unknown }).__esModule);
  if (!marked) Object.defineProperty(target, 'default', { value: mod, enumerable: true });

  if ((mod !== null && typeof mod === 'object') || typeof mod === 'function') {
    const source = mod as Record<string, unknown>;
    for (const key of Object.getOwnPropertyNames(source)) {
      if (Object.prototype.hasOwnProperty.call(target, key)) continue;
      const descriptor = Object.getOwnPropertyDescriptor(source, key);
      Object.defineProperty(target, key, {
        get: () => source[key],
        enumerable: descriptor === undefined || descriptor.enumerable === true,
      });
    }
  }
  return target;
}
