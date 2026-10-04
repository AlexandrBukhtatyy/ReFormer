/**
 * Раскладка домена-плагина проекта — те же правила, что у исходников билдера.
 *
 * Пока домены жили в `src/plugins` билдера, их раскладку стерёг его `structure.test.ts`: порог
 * модулей на каталог, состав корня плагина, словарь в корне. Тот тест обходит только `src/`
 * билдера, и уехавший домен остался бы без правил вовсе — а доросший до сорока файлов каталог
 * появляется не за день и не по чьей-то ошибке: каждый файл кладут в «правильное место».
 *
 * Правила не переписаны, а взяты у билдера (`@/testing/structure`): порог, поднятый там,
 * поднимется и здесь. Отличается только устройство пакета плагина — исходники в `src/`, вход
 * сборки `main.ts` рядом с барелем.
 *
 * Зовётся из `integration/structure.test.ts` домена: у него одного есть псевдоним `@`.
 *
 * @module plugins/.shared/domain-structure
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  dictionaryMisplaced,
  DOMAIN_IN_ROOT_LIMIT,
  domainModulesInRoot,
  moduleCounts,
  overLimit,
  SERVICE_NAMES,
  staleExceptions,
  type LayoutExceptions,
} from '@/testing/structure';

/** Ядро домена — общий чистый код его плагинов: пакет без манифеста и без сборки. */
const DOMAIN_CORE = 'core';

/** Проверки плагинов домена в настоящей оболочке — тоже не плагин. */
const DOMAIN_CHECKS = 'integration';

/** Каталог исходников пакета плагина. */
const SOURCES = 'src';

/** Вход сборки пакета плагина: у встроенного плагина его нет, код приезжает с билдером. */
const ENTRY = 'main.ts';

/** Служебные имена корня исходников пакета плагина. */
const PACKAGE_SERVICE_NAMES: ReadonlySet<string> = new Set([...SERVICE_NAMES, ENTRY]);

export interface DomainStructureOptions {
  /** Каталог домена: `.ui_builder/plugins/<домен>`. */
  readonly domainDir: string;
  /** Каталоги домена, которым порог модулей не писан, — путями от каталога домена. */
  readonly exceptions?: LayoutExceptions;
  /** Сколько плагинов в домене самое меньшее: страховка от обхода, не нашедшего ничего. */
  readonly minPlugins: number;
  /** Сколько модулей в домене самое меньшее — та же страховка для счёта. */
  readonly minModules: number;
}

/** Объявляет проверки раскладки домена. */
export function describeDomainStructure(options: DomainStructureOptions): void {
  const domainDir = options.domainDir.replace(/[\\/]$/, '');
  const exceptions = options.exceptions ?? {};
  const isDir = (path: string): boolean => statSync(path).isDirectory();

  /** Плагин узнаётся по манифесту в исходниках — тем же признаком, что у сборки и e2e. */
  const isPlugin = (name: string): boolean =>
    existsSync(`${domainDir}/${name}/${SOURCES}/manifest.json`);

  const entries = readdirSync(domainDir);
  const plugins = entries.filter((name) => isDir(`${domainDir}/${name}`) && isPlugin(name));
  const sourcesOf = (plugin: string): string => `${domainDir}/${plugin}/${SOURCES}`;

  describe('раскладка каталогов домена', () => {
    const counts = moduleCounts(domainDir);

    it('в каталоге не больше пятнадцати модулей — или исключение с причиной', () => {
      expect(overLimit(counts, exceptions)).toEqual([]);
    });

    it('исключение, переставшее быть нужным, снимается', () => {
      expect(staleExceptions(counts, exceptions)).toEqual([]);
    });

    it('проверка не пуста: каталоги найдены и счёт ненулевой', () => {
      expect([...counts.values()].reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(
        options.minModules
      );
    });
  });

  describe('устройство плагинов домена', () => {
    it('в каталоге домена — только плагины, ядро и проверки', () => {
      // Файл прямо в каталоге домена или каталог без манифеста — код без хозяина: не плагин,
      // который можно включить, и не ядро, которое видят плагины. Билдер такой каталог молча
      // пропустит, и заметить это будет нечем.
      const stray = entries.filter(
        (name) => name !== DOMAIN_CORE && name !== DOMAIN_CHECKS && !plugins.includes(name)
      );

      expect(stray).toEqual([]);
    });

    it('каждый плагин отдаёт наружу index.ts, а сборке — main.ts', () => {
      const without = plugins.filter((plugin) => {
        const root = readdirSync(sourcesOf(plugin));
        return !root.includes('index.ts') || !root.includes(ENTRY);
      });

      expect(without).toEqual([]);
    });

    it('словарь плагина лежит в корне исходников: по нему его находит проверка полноты', () => {
      expect(plugins.filter((plugin) => dictionaryMisplaced(sourcesOf(plugin)))).toEqual([]);
    });

    it('доменная логика не копится в корне плагина', () => {
      const crowded = plugins
        .map((plugin) => ({
          plugin,
          domain: domainModulesInRoot(sourcesOf(plugin), PACKAGE_SERVICE_NAMES),
        }))
        .filter(({ domain }) => domain.length > DOMAIN_IN_ROOT_LIMIT)
        .map(({ plugin, domain }) => `${plugin}: ${domain.length} доменных модулей в корне`);

      expect(crowded).toEqual([]);
    });

    it('проверка не пуста: плагины найдены', () => {
      expect(plugins.length).toBeGreaterThanOrEqual(options.minPlugins);
    });
  });
}
