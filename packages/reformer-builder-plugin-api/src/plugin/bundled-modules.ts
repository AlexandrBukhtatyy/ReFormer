/**
 * Пакеты, которые сборка внешнего плагина ВКЛАДЫВАЕТ в свой `main.js`, а не берёт у оболочки.
 *
 * ## Почему не в `PLUGIN_RUNTIME_MODULES`
 *
 * Модули рантайма оболочка подставляет сама — и держит их в стартовом графе. Пакеты стеков
 * (модель схемы, каталог, печать модуля формы) туда не годятся: статическая регистрация втянула бы
 * стек в стартовый граф оболочки, которая стека не знает (ось стеков, Ф3). А отказать внешнему
 * плагину стека в них значило бы, что стек можно написать только встроенным.
 *
 * ## Почему второй экземпляр здесь безвреден
 *
 * Запрет вкладывать `@reformer/*` существует из-за второго экземпляра: вложенная копия React или
 * ядра форм — два мира, которые молча не видят друг друга. У пакетов стеков мира нет: это чистые
 * функции и данные, ни одного синглтона, а токены служб и точек ключуются строкой `id`, так что
 * копия токена находит ту же службу. Что эти пакеты сами тянут из рантайма (`@reformer/core`,
 * `@reformer/renderer-json`, React), остаётся внешним — по общему списку.
 *
 * @module @reformer/builder-plugin-api/plugin/bundled-modules
 */

export const PLUGIN_BUNDLED_PACKAGES: readonly string[] = Object.freeze([
  '@reformer/builder-toolkit',
  '@reformer/builder-stack-reformer',
  '@reformer/builder-stack-plain',
]);

/** Имя пакета по спецификатору: `@scope/name/sub` → `@scope/name`, `name/sub` → `name`. */
export function packageNameOf(specifier: string): string {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]!;
}

/** Вкладывается ли модуль в сборку плагина (сам пакет или его подпуть). */
export function isBundledPluginModule(specifier: string): boolean {
  return PLUGIN_BUNDLED_PACKAGES.includes(packageNameOf(specifier));
}
