/**
 * Раскладка каталогов проверяется тестом, а не соглашением.
 *
 * Реорганизация 2026-09 разбирала три каталога, доросшие до 75, 65 и 42 файлов. Дорастали они
 * не за день и не по чьей-то ошибке: каждый отдельный файл добавлялся в правильное место, просто
 * «правильное место» никто не пересматривал. Соглашение в документе от этого не спасает — оно
 * не срабатывает в момент добавления файла. Тест срабатывает.
 *
 * Проверка живёт ТЕСТОМ, а не скриптом, по тому же доводу, что и полнота словарей: прогон тестов
 * и есть CI, а скрипт пришлось бы заводить в `package.json`, помнить про него и запускать вторым
 * проходом.
 *
 * ## Считаются МОДУЛИ, а не файлы
 *
 * Тест рядом с кодом — соглашение проекта, и он не добавляет каталогу сущностей: `ops.test.ts`
 * ищут не сам по себе, а вместе с `ops.ts`. Считать файлы значило бы наказывать за покрытие —
 * каталог из восьми хорошо покрытых модулей выглядел бы вдвое хуже каталога из пятнадцати
 * непокрытых. Поэтому `*.test.ts` и `*.browser.test.tsx` из счёта исключены, а порог назначен
 * по числу того, что в каталоге ЛЕЖИТ.
 *
 * Порог проверен задним числом на трёх разобранных каталогах: `host/ui` держал ~45 модулей,
 * `editor-schema` ~37, `app` ~25 — все три провалили бы эту проверку задолго до того, как
 * стали проблемой на глаз.
 *
 * ## Исключение обязано быть названо и обязано быть нужным
 *
 * Список {@link EXCEPTIONS} — не «список прощённых», а список решений с причиной. И он
 * храповик в обе стороны: каталог сверх порога без записи роняет тест, но и запись,
 * переставшая быть нужной, роняет его тоже. Иначе список копил бы мёртвые строки,
 * а через год никто не знал бы, какие из них ещё что-то значат.
 *
 * @module structure.test
 */

import { describe, expect, it } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Сколько модулей в одном каталоге ещё читается списком. */
const MODULE_LIMIT = 15;

/**
 * Каталоги, которым порог не писан, и почему.
 *
 * Планка исключения — не «сколько там сейчас», а «сколько допустимо»: она обязана оставлять
 * запас на рост, но падать, если каталог поедет дальше без разговора.
 */
const EXCEPTIONS: Readonly<Record<string, { readonly limit: number; readonly why: string }>> = {
  'plugins/ai/tools': {
    limit: 25,
    why:
      'по файлу на инструмент агента — сам НАБОР и есть поверхность, которую видит модель; ' +
      'группировка инструментов по темам спрятала бы её состав, а он под храповиком ' +
      'tool-surface.test.ts',
  },
};

/** Корневые каталоги `src/`, внутри которых считаем. */
const ROOT = fileURLToPath(new URL('.', import.meta.url));

const isModule = (name: string): boolean =>
  /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && !/\.browser\.test\.tsx?$/.test(name);

/** Каталоги, которые не про исходники: снимки, голдены, фикстуры, словари. */
const SKIP = new Set(['__golden__', '__fixtures__', '__snapshots__', 'locales', 'generated']);

function moduleCounts(): Map<string, number> {
  const counts = new Map<string, number>();
  const walk = (absolute: string, relative: string): void => {
    const entries = readdirSync(absolute);
    let modules = 0;
    for (const name of entries) {
      const child = `${absolute}/${name}`;
      if (statSync(child).isDirectory()) {
        if (SKIP.has(name)) continue;
        walk(child, relative === '' ? name : `${relative}/${name}`);
      } else if (isModule(name)) {
        modules += 1;
      }
    }
    counts.set(relative === '' ? 'src' : relative, modules);
  };
  walk(ROOT.replace(/[\\/]$/, ''), '');
  return counts;
}

describe('раскладка каталогов', () => {
  const counts = moduleCounts();

  it('в каталоге не больше пятнадцати модулей — или исключение с причиной', () => {
    const over = [...counts]
      .filter(([dir, n]) => n > (EXCEPTIONS[dir]?.limit ?? MODULE_LIMIT))
      .map(([dir, n]) => `${dir}: ${n} модулей (порог ${EXCEPTIONS[dir]?.limit ?? MODULE_LIMIT})`);

    expect(over).toEqual([]);
  });

  it('исключение, переставшее быть нужным, снимается', () => {
    const stale = Object.keys(EXCEPTIONS).filter((dir) => (counts.get(dir) ?? 0) <= MODULE_LIMIT);

    expect(stale).toEqual([]);
  });

  it('проверка не пуста: каталоги найдены и счёт ненулевой', () => {
    // Без этого сломанный обход давал бы пустую карту и зелёный прогон на пустом множестве —
    // ровно та тишина, которую этот тест и заведён ловить.
    expect(counts.size).toBeGreaterThan(40);
    expect([...counts.values()].reduce((a, b) => a + b, 0)).toBeGreaterThan(300);
  });
});

/**
 * Устройство плагина — вторая половина той же дисциплины.
 *
 * Претензия, с которой начиналась реорганизация, звучала как «в корне плагина лежит логика
 * вперемешку с тестами». Порог выше её не ловит: плагин может держать в корне четырнадцать
 * доменных модулей и формально пройти. Поэтому корень проверяется отдельно — по СОСТАВУ.
 */
describe('устройство плагина', () => {
  /** Служебные имена контракта: их место — корень плагина, и только их. */
  const SERVICE_NAMES = new Set([
    'index.ts',
    'plugin.ts',
    'host.ts',
    'contract.ts',
    'messages.ts',
    'testing.ts',
  ]);

  /**
   * Сколько доменных модулей корень терпит, прежде чем их пора разложить.
   *
   * Ноль здесь был бы догмой: у валидатора схемы шесть чистых модулей без состояния, и шесть
   * каталогов по одному файлу — это шум вместо навигации. Планка отделяет «маленький плагин
   * живёт плоско» от «плагин пора разбирать».
   */
  const DOMAIN_IN_ROOT_LIMIT = 6;

  const pluginsDir = `${ROOT.replace(/[\\/]$/, '')}/plugins`;
  const plugins = readdirSync(pluginsDir).filter((name) =>
    statSync(`${pluginsDir}/${name}`).isDirectory()
  );

  it('каждый плагин отдаёт наружу index.ts', () => {
    const without = plugins.filter(
      (name) => !readdirSync(`${pluginsDir}/${name}`).includes('index.ts')
    );

    expect(without).toEqual([]);
  });

  it('словарь плагина лежит в корне: по нему его находит проверка полноты', () => {
    // i18n-completeness ищет словари по именам `locales` и `messages.ts` В КОРНЕ плагина.
    // Уехавший в подкаталог словарь не сломает приложение — он просто выпадет из проверки,
    // и его локали разъедутся молча. Поэтому условие охраняется здесь же.
    const misplaced: string[] = [];
    for (const name of plugins) {
      const root = readdirSync(`${pluginsDir}/${name}`);
      const hasDictionary = root.includes('locales') || root.includes('messages.ts');
      if (hasDictionary) continue;
      const deeper = root.some(
        (entry) =>
          statSync(`${pluginsDir}/${name}/${entry}`).isDirectory() &&
          readdirSync(`${pluginsDir}/${name}/${entry}`).some(
            (inner) => inner === 'locales' || inner === 'messages.ts'
          )
      );
      if (deeper) misplaced.push(name);
    }

    expect(misplaced).toEqual([]);
  });

  it('доменная логика не копится в корне плагина', () => {
    const crowded = plugins
      .map((name) => {
        const domain = readdirSync(`${pluginsDir}/${name}`)
          .filter((entry) => isModule(entry) && !SERVICE_NAMES.has(entry))
          .filter((entry) => statSync(`${pluginsDir}/${name}/${entry}`).isFile());
        return { name, domain };
      })
      .filter(({ domain }) => domain.length > DOMAIN_IN_ROOT_LIMIT)
      .map(({ name, domain }) => `${name}: ${domain.length} доменных модулей в корне`);

    expect(crowded).toEqual([]);
  });

  it('проверка не пуста: плагины найдены', () => {
    expect(plugins.length).toBeGreaterThanOrEqual(10);
  });
});
