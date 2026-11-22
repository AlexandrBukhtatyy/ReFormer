/**
 * Переименованные компоненты: прежнее имя из документа → нынешнее имя записи реестра.
 *
 * Документы JSON-схемы хранятся отдельно от кода (сеть, кэш, диск) и переживают релиз библиотеки,
 * поэтому имя, под которым компонент называли раньше, реестр продолжает понимать. Псевдоним
 * срабатывает только тогда, когда записи с прежним именем в реестре нет: приложение, которое
 * само зарегистрировало компонент под именем `FormArray`, получает свою запись.
 *
 * @module reformer/renderer-json/registry/renamed-components
 */

const RENAMED_COMPONENTS: ReadonlyMap<string, string> = new Map([
  ['FormArray', 'FieldArray'],
  ['FormArraySection', 'FieldArraySection'],
]);

const warnedNames = new Set<string>();

/** Сборщик подставляет `process.env.NODE_ENV`; при загрузке голым ESM `process` не определён. */
function isDevelopment(): boolean {
  try {
    return process.env.NODE_ENV !== 'production';
  } catch {
    return false;
  }
}

/**
 * Нынешнее имя компонента по прежнему; `undefined` — имя не переименовывалось.
 *
 * @example
 * ```ts
 * renamedComponentOf('FormArray'); // 'FieldArray'
 * renamedComponentOf('Input'); // undefined
 * ```
 */
export function renamedComponentOf(name: string): string | undefined {
  return RENAMED_COMPONENTS.get(name);
}

/** Один раз на имя сообщает в dev, что документ называет компонент прежним именем. */
export function warnRenamedComponent(name: string, renamedTo: string): void {
  if (warnedNames.has(name) || !isDevelopment() || typeof console === 'undefined') return;
  warnedNames.add(name);
  console.warn(
    `[ComponentRegistry] Компонент "${name}" переименован в "${renamedTo}": документ схемы ` +
      `называет его прежним именем. Замените $component(${name}) на $component(${renamedTo}).`
  );
}
