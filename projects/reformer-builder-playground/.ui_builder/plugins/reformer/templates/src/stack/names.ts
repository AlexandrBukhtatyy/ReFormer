/**
 * Имена модуля формы в токенах шаблона — так, как их выводит кодоген ReFormer.
 *
 * Написания имени (`__FormName__` и три его формы) кодоген не повторяют: тип формы — не «имя в
 * PascalCase плюс `Form`» (имя, уже оканчивающееся на `Form`, суффикса не получает), каталог —
 * `kebab` билдера, а не склейка слов (`ABCForm` даёт `abcform`), заголовок — пятое написание,
 * которого среди четырёх нет вовсе. Шаблон, напечатанный кодогеном, обязан разложиться в ТЕ ЖЕ
 * пути и имена, которые кодоген напечатает для новой формы, — иначе первая же генерация из билдера
 * оставит рядом сирот (`types/myForm.ts` шаблона против `types/my-form.ts` кодогена). Поэтому у
 * стека свои токены, и значения для них считает сам `makeNames`.
 *
 * | токен           | значение                                   | пример            |
 * | --------------- | ------------------------------------------ | ----------------- |
 * | `__FormType__`  | тип формы, он же имя файла страницы        | `LoanRequestForm` |
 * | `__formType__`  | он же со строчной — приставка имён записей | `loanRequestForm` |
 * | `__form-dir__`  | каталог модуля и имя файлов ролей          | `loan-request`    |
 * | `__FormTitle__` | заголовок для человека                     | `Loan request`    |
 *
 * Хозяин шаблонов подставляет их в любом токенном шаблоне ({@link moduleTokens} — ответ стека на
 * `tokens`): шаблон проекта, написанный руками, вправе назвать файл `types/__form-dir__.ts` и
 * получить имя, с которым согласится кодоген.
 *
 * @module plugins/reformer/templates/stack/names
 */

import { translit } from '@reformer/builder-toolkit';
import { makeNames } from '../../../core/codegen';

/** Токены имён модуля по ролям. */
export const MODULE_TOKENS = {
  type: '__FormType__',
  typeCamel: '__formType__',
  dir: '__form-dir__',
  title: '__FormTitle__',
} as const;

/** Имя модуля, производное от имени формы. */
export type ModuleNameRole = keyof typeof MODULE_TOKENS;

const MODULE_ROLES: readonly ModuleNameRole[] = ['type', 'typeCamel', 'dir', 'title'];

/** Имена модуля для формы — те же, что выведет кодоген. */
export function moduleNames(formName: string): Record<ModuleNameRole, string> {
  const names = makeNames(formName);
  return {
    type: names.TypeName,
    typeCamel: names.TypeName.charAt(0).toLowerCase() + names.TypeName.slice(1),
    dir: names.dir,
    title: names.title,
  };
}

/** Токены имён модуля и их значения для формы — в порядке ролей. */
export function moduleTokens(formName: string): Record<string, string> {
  const names = moduleNames(formName);
  return Object.fromEntries(MODULE_ROLES.map((role) => [MODULE_TOKENS[role], names[role]]));
}

/**
 * Выводится ли из имени хоть одно слово — то же правило, что у написаний имени у хозяина: буква
 * или цифра после транслитерации.
 */
const isUsable = (name: string): boolean => /[a-z0-9]/i.test(translit(name));

/**
 * Заменить имена модуля формы-источника на токены {@link MODULE_TOKENS}.
 *
 * Для текста, напечатанного КОДОГЕНОМ под имя `baseName`: все имена в нём — производные
 * `makeNames`, и других написаний там нет. Базовое имя обязано давать четыре разных, не вложенных
 * друг в друга значения (так выбрано базовое имя встроенных шаблонов): иначе замена одного
 * значения задела бы другое. Длинные значения идут первыми — на случай имени, у которого
 * каталог совпал с началом заголовка.
 */
export function tokenizeModuleNames(text: string, baseName: string): string {
  if (!isUsable(baseName)) return text;
  const names = moduleNames(baseName);
  const pairs = MODULE_ROLES.map((role) => ({ value: names[role], token: MODULE_TOKENS[role] }))
    .filter((pair) => pair.value !== '')
    .sort((a, b) => b.value.length - a.value.length);
  let out = text;
  for (const { value, token } of pairs) out = out.split(value).join(token);
  return out;
}
