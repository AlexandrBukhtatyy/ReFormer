/**
 * Установленные плагины как слой файлов для загрузчика.
 *
 * Загрузчик умеет читать плагины из чего угодно, что отвечает на четыре вопроса
 * ({@link PluginFilesSource}): как тебя зовут, можно ли исполнять твой код, дай список
 * каталога, дай файл. Этот модуль отвечает на них поверх хранилища OPFS — и больше ничего
 * не делает: обход каталога, разбор манифеста, потолок файлов, линковка остаются там же,
 * где были, и работают над установленным ровно так же, как над каталогом проекта.
 *
 * ## Исполнение всё равно решает ПРОЕКТ
 *
 * Установленный плагин приехал не из проекта, но исполняется в проекте. Источник, который
 * запрещает исполнять свой код (`capabilities.executesCode === false` — удалённый, демо,
 * read-only), говорит этим не «мои файлы особенные», а «здесь чужой код не запускаем».
 * Поэтому флаг читается у ПРОЕКТА, а не объявляется здесь константой: иначе read-only
 * проект стал бы местом, где чужой код всё-таки исполняется — достаточно поставить его
 * из npm вместо того, чтобы положить в папку.
 *
 * @module shell/platform/plugin/installed/files
 */

import type { Entry } from '@/shell/platform/source/types';
import { SourceError } from '@/shell/platform/source/errors';
import type { PluginFilesSource } from '../loader';
import { INSTALLED_ROOT_DIR, type InstalledPluginStore } from './store';

/** Имя слоя в сообщениях об отказе. */
export const INSTALLED_SOURCE_ID = 'installed';

export interface InstalledFilesDeps {
  readonly store: InstalledPluginStore;
  /**
   * Разрешает ли ПРОЕКТ исполнять чужой код. Функция: проект открывают и закрывают, а слой
   * живёт дольше. Без проекта — `false`: плагины каталога поднимаются вместе с проектом,
   * и установленные не исключение.
   */
  readonly executesCode: () => boolean;
}

/** Путь внутри слоя: `plugins/<id>/<путь внутри плагина>`. */
function split(path: string): { id: string; rest: string } | undefined {
  const parts = path.split('/').filter((part) => part !== '');
  if (parts[0] !== INSTALLED_ROOT_DIR || parts.length < 2) return undefined;
  const [, id, ...rest] = parts;
  return id === undefined ? undefined : { id, rest: rest.join('/') };
}

export function createInstalledFiles(deps: InstalledFilesDeps): PluginFilesSource {
  const { store } = deps;

  return {
    id: INSTALLED_SOURCE_ID,
    // Геттер, а не снимок: право исполнять принадлежит открытому проекту, а он меняется.
    capabilities: {
      get executesCode(): boolean {
        return deps.executesCode();
      },
    },

    async list(dir: string): Promise<readonly Entry[]> {
      const parts = dir.split('/').filter((part) => part !== '');
      if (parts.length === 0 || parts[0] !== INSTALLED_ROOT_DIR) {
        // «Каталога нет» — не то же, что «он пуст»: загрузчик различает их, и отвечать
        // пустым списком на чужой путь значило бы сказать «здесь ничего не установлено».
        throw new SourceError('not-found', `слой установленных не знает каталога «${dir}»`, {
          path: dir,
        });
      }

      // Корень слоя: каталог на плагин, по одному на запись о составе.
      if (parts.length === 1) {
        const records = await store.list();
        return records.map((record) => ({
          name: record.id,
          path: `${INSTALLED_ROOT_DIR}/${record.id}`,
          kind: 'directory' as const,
        }));
      }

      const target = split(dir);
      if (target === undefined) throw new SourceError('not-found', `каталога «${dir}» нет`);
      const files = await store.listFiles(target.id);
      const prefix = target.rest === '' ? '' : `${target.rest}/`;
      const names = new Map<string, 'file' | 'directory'>();
      for (const file of files) {
        if (!file.startsWith(prefix)) continue;
        const tail = file.slice(prefix.length);
        const slash = tail.indexOf('/');
        if (tail === '') continue;
        names.set(slash === -1 ? tail : tail.slice(0, slash), slash === -1 ? 'file' : 'directory');
      }
      if (names.size === 0 && files.length === 0) {
        throw new SourceError('not-found', `плагин «${target.id}» не установлен`, { path: dir });
      }
      return [...names].map(([name, kind]) => ({ name, path: `${dir}/${name}`, kind }));
    },

    async read(path: string): Promise<{ readonly text: string }> {
      const target = split(path);
      const text = target === undefined ? null : await store.readFile(target.id, target.rest);
      if (text === null) {
        // Отказ той же формы, что у источника проекта: загрузчик уже умеет его читать
        // и превращать в понятную человеку причину.
        throw new SourceError('not-found', `в слое установленных нет «${path}»`, { path });
      }
      return { text };
    },
  };
}
