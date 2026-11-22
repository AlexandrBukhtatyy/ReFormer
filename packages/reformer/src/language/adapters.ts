/**
 * Адаптеры уровня языка: язык браузера и атрибуты `<html lang dir>`.
 *
 * @module language/adapters
 */

/**
 * Куда применяется язык на экране: корень документа.
 *
 * @group Language
 */
export interface LanguageTarget {
  apply(code: string, dir: TextDirection): void;
}

/**
 * Направление письма.
 *
 * @group Language
 */
export type TextDirection = 'ltr' | 'rtl';

/**
 * Язык браузера (`navigator.languages`), подходящий под список поддерживаемых.
 *
 * Сначала ищется точное совпадение тега (`pt-BR`), затем базовый язык (`pt`).
 *
 * @param options - `supported` — языки приложения; без списка подходит первый язык браузера.
 * @returns Функция определения: язык или `undefined`, если подходящего нет (или нет `navigator`).
 *
 * @example
 * ```typescript
 * createLanguage({ load, detect: browserLanguage({ supported: ['ru', 'en'] }) });
 * ```
 *
 * @group Language
 */
export function browserLanguage(
  options: { supported?: readonly string[] } = {}
): () => string | undefined {
  const { supported } = options;
  return () => {
    if (typeof navigator === 'undefined') return undefined;
    const tags = navigator.languages?.length ? navigator.languages : [navigator.language];
    for (const tag of tags) {
      if (!tag) continue;
      if (!supported || supported.includes(tag)) return tag;
      const base = tag.split('-')[0]!;
      if (supported.includes(base)) return base;
    }
    return undefined;
  };
}

/**
 * Ставить `lang` и `dir` на корень документа: экранные дикторы, переносы, CSS `:lang()`.
 *
 * @param root - Элемент. По умолчанию `document.documentElement`.
 * @returns Цель или `null` без `document` (сервер).
 *
 * @example
 * ```typescript
 * createLanguage({ load, document: documentLang() }); // так и по умолчанию
 * ```
 *
 * @group Language
 */
export function documentLang(root?: HTMLElement): LanguageTarget | null {
  if (typeof document === 'undefined') return null;
  const element = root ?? document.documentElement;
  return {
    apply(code, dir) {
      element.lang = code;
      element.dir = dir;
    },
  };
}

/** Языки с письмом справа налево — запасной список, если `Intl.Locale#getTextInfo` нет. */
const RTL = new Set(['ar', 'fa', 'he', 'iw', 'ur', 'ps', 'yi', 'dv', 'ku', 'sd', 'ug']);

/**
 * Направление письма языка.
 *
 * @param code - Код языка (`ar`, `he-IL`, `ru`).
 * @returns `'rtl'` или `'ltr'`.
 *
 * @example
 * ```typescript
 * textDirection('ar'); // 'rtl'
 * textDirection('ru'); // 'ltr'
 * ```
 *
 * @group Language
 */
export function textDirection(code: string): TextDirection {
  try {
    const locale = new Intl.Locale(code) as Intl.Locale & {
      getTextInfo?: () => { direction?: string };
      textInfo?: { direction?: string };
    };
    const info = locale.getTextInfo?.() ?? locale.textInfo;
    if (info?.direction) return info.direction === 'rtl' ? 'rtl' : 'ltr';
  } catch {
    // Невалидный тег — ниже запасной список.
  }
  return RTL.has(code.split('-')[0]!.toLowerCase()) ? 'rtl' : 'ltr';
}
