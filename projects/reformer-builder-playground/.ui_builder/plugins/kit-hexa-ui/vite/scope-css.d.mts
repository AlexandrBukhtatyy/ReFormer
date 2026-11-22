/**
 * Объявления для `scope-css.mjs` — граница стилей HexaUI в приложении.
 *
 * @module reformer/kit-hexa-ui/vite/scope-css
 */

/** Атрибут контейнера: его ставит `KitProvider`. */
export declare const HEXA_SCOPE_ATTRIBUTE: 'data-hexa-root';

/** Селектор контейнера нулевой специфичности: `:where([data-hexa-root])`. */
export declare const HEXA_SCOPE: string;

/** Есть ли в селекторе класс или идентификатор вне аргументов псевдоклассов и атрибутов. */
export declare function hasClassOrId(selector: string): boolean;

/** Один селектор под контейнером; селектор с классом или идентификатором — как есть. */
export declare function scopeSelector(selector: string, scope?: string): string;

/** Таблица стилей HexaUI, ограниченная контейнером провайдера. */
export declare function scopeHexaCss(
  css: string,
  options?: { readonly scope?: string; readonly from?: string }
): string;

/** Модуль `style-inject` с ограниченной таблицей; `null` — переписывать нечего. */
export declare function scopeInjectedCss(
  code: string,
  options?: { readonly scope?: string }
): string | null;
