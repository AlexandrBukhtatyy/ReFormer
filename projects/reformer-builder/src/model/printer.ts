/**
 * Round-trip-принтер модель→JSON (спека §6, риск №1). В библиотеке ReFormer его нет — реализуем
 * здесь. Не рукописный форматтер: `JSON.stringify` (сохраняет порядок строковых ключей и passthrough
 * неизвестных ключей/операторов) → `prettier/standalone` (`json`-парсер) с опциями проекта.
 *
 * Гарантия — СТАБИЛЬНОСТЬ (фикспойнт): `print(parse(print(x))) === print(x)`; байт-в-байт с
 * файлом — на уже prettier-чистых схемах при совпадающих опциях. Опции по умолчанию зеркалят
 * `.prettierrc.cjs` репо (значимые для JSON — `printWidth`/`tabWidth`/`useTabs`/`endOfLine`).
 *
 * @module reformer-builder/model/printer
 */

import * as prettier from 'prettier/standalone';
import type { Plugin } from 'prettier';
import * as babel from 'prettier/plugins/babel';
import * as estree from 'prettier/plugins/estree';

// namespace-импорты плагинов не матчат тип `Plugin` номинально, хотя структурно валидны.
const PLUGINS = [babel, estree] as unknown as Plugin[];

/** Опции форматирования, значимые для JSON-парсера prettier. */
export interface PrinterOptions {
  printWidth?: number;
  tabWidth?: number;
  useTabs?: boolean;
  endOfLine?: 'lf' | 'crlf' | 'cr';
}

/** Дефолт — зеркало `.prettierrc.cjs` репо (для JSON значимо это подмножество). */
export const DEFAULT_PRINTER_OPTIONS: Required<PrinterOptions> = {
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  endOfLine: 'lf',
};

/**
 * Сериализовать схему в prettier-форматированный JSON. `schema` — распарсенный объект (с любыми
 * неизвестными ключами/операторами: они сохраняются). Асинхронно (prettier v3 `format` — Promise).
 */
export async function print(schema: unknown, options: PrinterOptions = {}): Promise<string> {
  const source = JSON.stringify(schema, null, 2);
  return prettier.format(source, {
    parser: 'json',
    plugins: PLUGINS,
    ...DEFAULT_PRINTER_OPTIONS,
    ...options,
  });
}
