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
 * ## Правила — общие с доменами-плагинами проекта
 *
 * Сами правила (что считать модулем, пороги, служебные имена) лежат в `testing/structure`:
 * теми же функциями свою раскладку проверяют домены ReFormer и RJSF, уехавшие из билдера
 * в каталог плагинов проекта (`integration/structure.test.ts` домена).
 *
 * @module structure.test
 */

import { describe, expect, it } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  dictionaryMisplaced,
  DOMAIN_IN_ROOT_LIMIT,
  domainModulesInRoot,
  moduleCounts,
  overLimit,
  staleExceptions,
  type LayoutExceptions,
} from './testing/structure';

/**
 * Каталоги, которым порог не писан, и почему.
 *
 * Сейчас исключений нет: оба прежних (`ai/tools` и `core/form-model`) принадлежали домену
 * ReFormer, а он уехал из билдера в плагины проекта вместе со своими каталогами — и своими
 * исключениями.
 */
const EXCEPTIONS: LayoutExceptions = {};

/** Корневой каталог `src/`, внутри которого считаем. */
const ROOT = fileURLToPath(new URL('.', import.meta.url)).replace(/[\\/]$/, '');

describe('раскладка каталогов', () => {
  const counts = moduleCounts(ROOT, 'src');

  it('в каталоге не больше пятнадцати модулей — или исключение с причиной', () => {
    expect(overLimit(counts, EXCEPTIONS)).toEqual([]);
  });

  it('исключение, переставшее быть нужным, снимается', () => {
    expect(staleExceptions(counts, EXCEPTIONS)).toEqual([]);
  });

  it('проверка не пуста: каталоги найдены и счёт ненулевой', () => {
    // Без этого сломанный обход давал бы пустую карту и зелёный прогон на пустом множестве —
    // ровно та тишина, которую этот тест и заведён ловить.
    expect(counts.size).toBeGreaterThan(40);
    expect([...counts.values()].reduce((a, b) => a + b, 0)).toBeGreaterThan(200);
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
  const pluginsDir = `${ROOT}/plugins`;
  const isDir = (path: string): boolean => statSync(path).isDirectory();

  /** Домены — первый уровень: `base`, `kits`. */
  const domains = readdirSync(pluginsDir).filter((name) => isDir(`${pluginsDir}/${name}`));

  /** Плагины — второй уровень, `домен/плагин`. */
  const plugins = domains.flatMap((domain) =>
    readdirSync(`${pluginsDir}/${domain}`)
      .filter((name) => isDir(`${pluginsDir}/${domain}/${name}`))
      .map((name) => `${domain}/${name}`)
  );

  it('в папке домена — только плагины', () => {
    // Плагин узнаётся по манифесту и барелю. Файл прямо в папке домена или каталог без них —
    // это код без хозяина: его нельзя включить, и из плагинов его не видно (линтер).
    const stray = domains.flatMap((domain) =>
      readdirSync(`${pluginsDir}/${domain}`)
        .filter((name) => {
          const path = `${pluginsDir}/${domain}/${name}`;
          if (!isDir(path)) return true;
          const entries = readdirSync(path);
          return !entries.includes('manifest.json') || !entries.includes('index.ts');
        })
        .map((name) => `${domain}/${name}`)
    );

    expect(stray).toEqual([]);
  });

  it('каждый плагин отдаёт наружу index.ts', () => {
    const without = plugins.filter(
      (name) => !readdirSync(`${pluginsDir}/${name}`).includes('index.ts')
    );

    expect(without).toEqual([]);
  });

  it('словарь плагина лежит в корне: по нему его находит проверка полноты', () => {
    expect(plugins.filter((name) => dictionaryMisplaced(`${pluginsDir}/${name}`))).toEqual([]);
  });

  it('доменная логика не копится в корне плагина', () => {
    const crowded = plugins
      .map((name) => ({ name, domain: domainModulesInRoot(`${pluginsDir}/${name}`) }))
      .filter(({ domain }) => domain.length > DOMAIN_IN_ROOT_LIMIT)
      .map(({ name, domain }) => `${name}: ${domain.length} доменных модулей в корне`);

    expect(crowded).toEqual([]);
  });

  it('проверка не пуста: домены и плагины найдены', () => {
    expect(domains.length).toBeGreaterThanOrEqual(2);
    expect(plugins.length).toBeGreaterThanOrEqual(7);
  });
});
