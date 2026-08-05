/**
 * Плейсхолдеры имени формы в шаблонах. При СОЗДАНИИ шаблона имя формы-источника (базовое имя)
 * заменяется на токены во всех написаниях, при ГЕНЕРАЦИИ — токены заменяются на новое имя в том же
 * написании. Так `CreditApplicationForm` в index.tsx становится `UserProfileForm`, а `credit-application`
 * в путях и заголовках — `user-profile`.
 *
 * Подстановка подстрочная (без границ слова): иначе `CreditApplicationForm` не распался бы на
 * `__FormName__` + `Form`. Варианты применяются от длинного к короткому; при равной длине —
 * в порядке {@link VARIANT_ORDER} (Pascal → kebab → snake → camel), поэтому у односложного базового
 * имени, где kebab, snake и camel совпадают, выигрывает kebab — написание путей и заголовков.
 *
 * @module reformer-builder/templates/placeholders
 */

/** Токены-плейсхолдеры по написаниям. */
export const TOKENS = {
  pascal: '__FormName__',
  camel: '__formName__',
  kebab: '__form-name__',
  snake: '__form_name__',
} as const;

/** Написание имени. */
export type NameCase = keyof typeof TOKENS;

/** Порядок применения при равной длине варианта (см. док модуля). */
const VARIANT_ORDER: NameCase[] = ['pascal', 'kebab', 'snake', 'camel'];

/**
 * Разбить имя на слова, понимая kebab/snake/camel/Pascal и пробелы: `user-profile`, `userProfile`
 * и `UserProfile` дают `['user', 'profile']`.
 */
export function splitWords(name: string): string[] {
  const parts = name.match(/[A-Z]+(?![a-z])|[A-Z][a-z0-9]*|[a-z0-9]+/g);
  return parts ? parts.map((w) => w.toLowerCase()) : [];
}

const capitalize = (w: string): string => w.charAt(0).toUpperCase() + w.slice(1);

/** Имя в заданном написании (`user-profile` + `pascal` → `UserProfile`). */
export function toCase(name: string, kind: NameCase): string {
  const words = splitWords(name);
  if (!words.length) return '';
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

/** Все написания имени: `{ pascal: 'UserProfile', camel: 'userProfile', … }`. */
export function nameVariants(name: string): Record<NameCase, string> {
  return {
    pascal: toCase(name, 'pascal'),
    camel: toCase(name, 'camel'),
    kebab: toCase(name, 'kebab'),
    snake: toCase(name, 'snake'),
  };
}

/**
 * Само базовое имя уже равно плейсхолдеру (`form name` во всех написаниях) — токенизировать нельзя,
 * иначе второй проход съел бы собственные токены (`__FormName__` содержит `FormName`).
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
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push({ value, token: TOKENS[kind] });
  }
  // Стабильная сортировка: длинные варианты первыми, при равной длине сохраняется VARIANT_ORDER.
  return out.sort((a, b) => b.value.length - a.value.length);
}

/**
 * Заменить имя формы-источника на плейсхолдеры. Пустое/односимвольное базовое имя и имя, совпадающее
 * с самим плейсхолдером, оставляют текст нетронутым. Идемпотентна.
 */
export function tokenize(text: string, baseName: string): string {
  const words = splitWords(baseName);
  if (!words.length || toCase(baseName, 'kebab').length < 2 || isTokenLike(baseName)) return text;
  let out = text;
  for (const { value, token } of replacements(baseName)) out = out.split(value).join(token);
  return out;
}

/** Подставить имя новой формы вместо плейсхолдеров. Пустое имя оставляет текст нетронутым. */
export function materialize(text: string, formName: string): string {
  const variants = nameVariants(formName);
  if (!variants.kebab) return text;
  let out = text;
  for (const kind of VARIANT_ORDER) out = out.split(TOKENS[kind]).join(variants[kind]);
  return out;
}

/** Есть ли в тексте хотя бы один плейсхолдер (для превью «шаблон параметризован»). */
export function hasTokens(text: string): boolean {
  return VARIANT_ORDER.some((kind) => text.includes(TOKENS[kind]));
}
