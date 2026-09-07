/**
 * Плейсхолдеры имени формы в шаблонах.
 *
 * При СОЗДАНИИ шаблона имя формы-источника заменяется на токены во всех написаниях, при
 * ГЕНЕРАЦИИ — токены заменяются на новое имя в том же написании. Так `CreditApplicationForm`
 * в точке входа становится `UserProfileForm`, а `credit-application` в путях — `user-profile`.
 *
 * Подстановка подстрочная (без границ слова): иначе `CreditApplicationForm` не распался бы на
 * `__FormName__` + `Form`. Варианты применяются от длинного к короткому; при равной длине —
 * в порядке {@link VARIANT_ORDER}.
 *
 * @module plugins/templates/render/placeholders
 */

import { translit } from '@/lib/form-model/naming';

/** Токены-плейсхолдеры по написаниям. */
export const TOKENS = {
  pascal: '__FormName__',
  camel: '__formName__',
  kebab: '__form-name__',
  snake: '__form_name__',
} as const;

/** Написание имени. */
export type NameCase = keyof typeof TOKENS;

/**
 * Порядок применения при равной длине варианта — то есть у ОДНОСЛОЖНОГО базового имени, где
 * kebab, snake и camel совпадают буквально (`sample`).
 *
 * **camel стоит раньше kebab, и это исправление против v1.** Там выигрывал kebab, потому что
 * так пишутся пути и заголовки. Цена этого выбора обнаружилась, как только встроенные шаблоны
 * стали печататься настоящими эмиттерами: идентификатор `sampleFormEntry` получал КЕБАБНЫЙ
 * токен и после подстановки превращался в `profil-polzovatelyaFormEntry` — то есть в
 * синтаксическую ошибку. Обратная цена несравнимо меньше: путь и строка маршрута приезжают
 * в camelCase (`/examples/profilPolzovatelya` вместо `/examples/profil-polzovatelya`).
 * Некрасивый путь работает, сломанный идентификатор — нет.
 *
 * У многосложного базового имени (`credit-form`) все четыре написания различаются, и порядок
 * не значит ничего.
 */
const VARIANT_ORDER: readonly NameCase[] = ['pascal', 'camel', 'snake', 'kebab'];

/**
 * Разбить имя на слова, понимая kebab, snake, camel, Pascal и пробелы: `user-profile`,
 * `userProfile` и `UserProfile` дают `['user', 'profile']`.
 *
 * **Кириллица транслитерируется, и это исправление против v1.** Там разбор был чисто
 * латинским (`/[A-Z]+…|[a-z0-9]+/`), поэтому имя «Профиль пользователя» давало ПУСТОЙ список
 * слов, а {@link materialize} на пустых написаниях возвращала текст нетронутым — то есть форма,
 * созданная по шаблону с русским именем, приезжала с плейсхолдерами вместо имён и не
 * компилировалась. Отказа при этом не было: подстановка молча ничего не делала.
 *
 * Транслитерация берётся у домена (`lib/form-model/naming`) — той же, которой кодоген выводит
 * имя каталога и типа. Своя копия правила дала бы шаблон и экспорт, называющие одну и ту же
 * форму по-разному.
 */
export function splitWords(name: string): string[] {
  const parts = translit(name).match(/[A-Z]+(?![a-z])|[A-Z][a-z0-9]*|[a-z0-9]+/g);
  return parts === null ? [] : parts.map((w) => w.toLowerCase());
}

const capitalize = (w: string): string => w.charAt(0).toUpperCase() + w.slice(1);

/** Имя в заданном написании (`user-profile` + `pascal` → `UserProfile`). */
export function toCase(name: string, kind: NameCase): string {
  const words = splitWords(name);
  if (words.length === 0) return '';
  switch (kind) {
    case 'pascal':
      return words.map(capitalize).join('');
    case 'camel':
      return words[0] + words.slice(1).map(capitalize).join('');
    case 'snake':
      return words.join('_');
    default:
      return words.join('-');
  }
}

/** Все написания имени. */
export function nameVariants(name: string): Record<NameCase, string> {
  return {
    pascal: toCase(name, 'pascal'),
    camel: toCase(name, 'camel'),
    kebab: toCase(name, 'kebab'),
    snake: toCase(name, 'snake'),
  };
}

/**
 * Само базовое имя уже равно плейсхолдеру («form name» во всех написаниях) — токенизировать
 * нельзя, иначе второй проход съел бы собственные токены (`__FormName__` содержит `FormName`).
 */
function isTokenLike(baseName: string): boolean {
  return toCase(baseName, 'kebab') === 'form-name';
}

/** Пары «что искать → на что заменить», отсортированные для безопасной последовательной замены. */
function replacements(baseName: string): Array<{ value: string; token: string }> {
  const variants = nameVariants(baseName);
  const seen = new Set<string>();
  const out: Array<{ value: string; token: string }> = [];
  for (const kind of VARIANT_ORDER) {
    const value = variants[kind];
    if (value === '' || seen.has(value)) continue;
    seen.add(value);
    out.push({ value, token: TOKENS[kind] });
  }
  // Стабильная сортировка: длинные варианты первыми, при равной длине сохраняется порядок.
  return out.sort((a, b) => b.value.length - a.value.length);
}

/**
 * Заменить имя формы-источника на плейсхолдеры. Пустое и односимвольное базовое имя, а также
 * имя, совпадающее с самим плейсхолдером, оставляют текст нетронутым. Идемпотентна.
 */
export function tokenize(text: string, baseName: string): string {
  const words = splitWords(baseName);
  if (words.length === 0 || toCase(baseName, 'kebab').length < 2 || isTokenLike(baseName)) {
    return text;
  }
  let out = text;
  for (const { value, token } of replacements(baseName)) out = out.split(value).join(token);
  return out;
}

/** Подставить имя новой формы вместо плейсхолдеров. Пустое имя оставляет текст нетронутым. */
export function materialize(text: string, formName: string): string {
  const variants = nameVariants(formName);
  if (variants.kebab === '') return text;
  let out = text;
  for (const kind of VARIANT_ORDER) out = out.split(TOKENS[kind]).join(variants[kind]);
  return out;
}

/**
 * Годится ли имя новой формы: выводится ли из него хоть одно слово.
 *
 * Проверка ровно та, от которой зависит {@link materialize}: пустой набор слов означает, что
 * подстановка молча оставит плейсхолдеры в файлах. Правило первой версии («латиница, цифры
 * и дефис») здесь было бы уже неверным — {@link splitWords} транслитерирует кириллицу, и
 * «Профиль пользователя» даёт законное `ProfilPolzovatelya`. Запрещать надо не кириллицу,
 * а имя, из которого не выходит идентификатор: одни знаки препинания, пробелы, пустая строка.
 */
export function isUsableFormName(name: string): boolean {
  return splitWords(name).length > 0;
}

/** Есть ли в тексте хотя бы один плейсхолдер — для отметки «шаблон параметризован». */
export function hasTokens(text: string): boolean {
  return VARIANT_ORDER.some((kind) => text.includes(TOKENS[kind]));
}
