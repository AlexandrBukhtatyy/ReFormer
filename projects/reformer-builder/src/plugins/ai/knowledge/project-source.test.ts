/**
 * Чтение корпуса знаний из `node_modules` открытого проекта.
 *
 * Проверяется свойство, ради которого этот путь вообще существует: справка должна описывать
 * версии, которые стоят У ПОЛЬЗОВАТЕЛЯ, а не те, с которыми собран билдер. Ошибка здесь не
 * выглядит как ошибка — агент уверенно расскажет про API, которого в проекте нет.
 *
 * Второй инвариант — «всё или ничего по пакетам»: пакет без индекса или с битым индексом
 * пропускается целиком, а не подменяется вшитым. Смешанный корпус описывал бы библиотеку,
 * которой не существует ни у кого.
 *
 * Двойник источника — плоская карта «путь → содержимое», а не дерево дескрипторов File System
 * Access, как в v1: корпус больше не знает транспорта, он читает по пути (см. `PackageFiles`).
 *
 * @module plugins/ai/knowledge/project-source.test
 */

import { describe, it, expect } from 'vitest';
import { readProjectBundles, type PackageFiles } from './project-source';

/** Источник из литерала: чего в карте нет — того нет, и `read` отказывает, а не молчит. */
function files(map: Record<string, string>): PackageFiles {
  return {
    async read(path: string) {
      const text = map[path];
      if (text === undefined) throw new Error(`not-found: ${path}`);
      return { text };
    },
  };
}

const index = (pkg: string, version: string) =>
  JSON.stringify({ schemaVersion: 1, package: pkg, version, topics: [], symbols: [] });

describe('readProjectBundles', () => {
  it('собирает корпус из node_modules проекта и называет версии', async () => {
    const found = await readProjectBundles(
      files({
        'node_modules/@reformer/core/llms-index.json': index('@reformer/core', '9.9.9'),
        'node_modules/@reformer/core/llms.txt': '# core',
        'node_modules/@reformer/cdk/llms-index.json': index('@reformer/cdk', '9.9.9'),
      })
    );

    expect(found).not.toBeNull();
    expect(Object.keys(found!.index.packages)).toEqual(['@reformer/core', '@reformer/cdk']);
    // Версия — из индекса пользователя, а не из сборки билдера. Ради этого всё и затевалось.
    expect(found!.versions['@reformer/core']).toBe('9.9.9');
    // `llms.txt` необязателен: без него работают choose_api и сигнатуры, не работает полнотекст.
    expect(found!.docs.packages['@reformer/core']).toBe('# core');
    expect(found!.docs.packages['@reformer/cdk']).toBeUndefined();
  });

  it('пакет без индекса пропускается, а не подменяется вшитым', async () => {
    const found = await readProjectBundles(
      files({
        'node_modules/@reformer/core/llms-index.json': index('@reformer/core', '1.0.0'),
        // Старый пакет: индекса ещё нет, только документация.
        'node_modules/@reformer/cdk/llms.txt': '# cdk без индекса',
      })
    );

    expect(Object.keys(found!.index.packages)).toEqual(['@reformer/core']);
    expect(found!.docs.packages['@reformer/cdk']).toBeUndefined();
  });

  it('битый индекс трактуется как отсутствующий', async () => {
    const found = await readProjectBundles(
      files({
        'node_modules/@reformer/core/llms-index.json': '{ это не json',
        'node_modules/@reformer/cdk/llms-index.json': index('@reformer/cdk', '2.0.0'),
      })
    );

    expect(Object.keys(found!.index.packages)).toEqual(['@reformer/cdk']);
  });

  it('каталог без @reformer/* даёт null — источником станет вшитый корпус', async () => {
    expect(await readProjectBundles(files({ 'node_modules/react/package.json': '{}' }))).toBeNull();
    expect(await readProjectBundles(files({}))).toBeNull();
  });
});
