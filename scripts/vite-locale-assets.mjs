// Vite-плагин: кладёт рядом с синхронными модулями локалей их JSON-копии.
//
// Зачем: пакет отдаёт локаль в трёх видах — загрузчик (чанк на язык), синхронный модуль
// (`<пакет>/locale/ru`) и JSON-файл (`<пакет>/locale/ru.json`). JSON-файл приложение выкладывает
// на свой сервер и грузит по сети, чтобы править тексты и добавлять языки без пересборки.
//
// JSON делается ИЗ СОБРАННОГО синхронного модуля, а не из исходников: так он по построению
// равен тому, что отдаёт `import { ru } from '<пакет>/locale/ru'`, включая словари нижних
// пакетов (cdk = ядро + cdk, ui-kit = ядро + cdk + кит). Собирать его вторым списком из
// исходных `*.json` значило бы завести ещё одно место, где слияние может разъехаться.
//
// Требование к порядку сборки то же, что и всегда: нижний пакет собран раньше верхнего
// (модуль локали cdk импортирует `@reformer/core/locale/<язык>` из dist ядра).

import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * @param {object} options
 * @param {string} options.dist - Каталог сборки пакета.
 * @param {readonly string[]} options.codes - Языки; модуль `dist/locale/<код>.js` экспортирует
 *   локаль под именем кода (`export const ru`).
 * @returns {import('vite').Plugin}
 */
export function localeAssets({ dist, codes }) {
  return {
    name: 'reformer-locale-assets',
    apply: 'build',
    async writeBundle() {
      for (const code of codes) {
        const moduleFile = path.join(dist, 'locale', `${code}.js`);
        // Метка времени — чтобы повторная сборка в том же процессе (watch) не взяла модуль из кэша.
        const loaded = await import(`${pathToFileURL(moduleFile).href}?t=${Date.now()}`);
        const locale = loaded[code];
        if (
          locale === null ||
          typeof locale !== 'object' ||
          locale.code !== code ||
          typeof locale.messages !== 'object'
        ) {
          throw new Error(
            `[locale-assets] ${moduleFile} не экспортирует локаль «${code}» (ожидался export const ${code}: { code, messages })`
          );
        }
        // Только данные: необязательное `dateLocale` — это код, в JSON ему не место.
        const { dateLocale: _dateLocale, ...data } = locale;
        writeFileSync(
          path.join(dist, 'locale', `${code}.json`),
          `${JSON.stringify(data, null, 2)}\n`
        );
      }
    },
  };
}
