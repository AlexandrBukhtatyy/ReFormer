/**
 * Транслитерация и kebab-имена — та часть `codegen/naming` из v1, которая нужна ДОМЕНУ.
 *
 * Почему переехало сюда, а не осталось у кодогена: имя селектора выводится из подписи узла
 * ({@link './selectors'.suggestSelector}), то есть kebab нужен модели ещё до всякого экспорта.
 * В v1 модель поэтому импортировала `codegen/naming` — направление зависимости, которое в v2
 * запрещено: кодоген становится плагином, а плагин домену не виден. Осталось у кодогена то,
 * что действительно его: `makeNames` с именами каталога, типа, страницы и маршрута.
 *
 * Модуль — ЛИСТ графа зависимостей: не импортирует ничего.
 *
 * @module lib/form-model/naming
 */

const TRANSLIT: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

/** Кириллица → латиница (для имён папок/типов/selector-ов). Прочее — без изменений. */
export function translit(s: string): string {
  return s.replace(/[а-яё]/gi, (ch) => {
    const lower = ch.toLowerCase();
    const mapped = TRANSLIT[lower] ?? ch;
    return ch === lower ? mapped : mapped.charAt(0).toUpperCase() + mapped.slice(1);
  });
}

/** `AnyCase Строка` → `any-case-stroka` (транслит кириллицы; латиница/цифры; разделитель — дефис). */
export function kebab(s: string): string {
  return translit(s)
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}
