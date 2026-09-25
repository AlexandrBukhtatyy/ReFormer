/**
 * Пакеты, которые сборка внешнего плагина ВКЛАДЫВАЕТ в свой `main.js`, а не берёт у оболочки.
 *
 * ## Почему не в `PLUGIN_RUNTIME_MODULES`
 *
 * Модули рантайма оболочка подставляет сама — и держит их в стартовом графе. Нейтральные помощники
 * печати стеков (`@reformer/builder-toolkit`: шаблоны, маркер сгенерированного файла, имена) туда
 * не годятся: оболочке они не нужны, а стартовый граф не резиновый. Отказать же в них внешнему
 * плагину значило бы, что стек с кодогеном можно написать только встроенным.
 *
 * ## Почему второй экземпляр здесь безвреден
 *
 * Запрет вкладывать `@reformer/*` существует из-за второго экземпляра: вложенная копия React или
 * ядра форм — два мира, которые молча не видят друг друга. У toolkit мира нет: это чистые функции,
 * ни одного синглтона.
 *
 * ## Чего здесь нет
 *
 * Код домена (ядро ReFormer — модель схемы, каталог, кодоген) живёт внутри билдера, а не пакетом,
 * и во внешний плагин не вкладывается: чужой домен расширяют возможностями с версиями
 * (решение «Ядро домена внутри домена», `docs/decisions-log.md` билдера).
 *
 * @module @reformer/builder-plugin-api/plugin/bundled-modules
 */

export const PLUGIN_BUNDLED_PACKAGES: readonly string[] = Object.freeze([
  '@reformer/builder-toolkit',
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
