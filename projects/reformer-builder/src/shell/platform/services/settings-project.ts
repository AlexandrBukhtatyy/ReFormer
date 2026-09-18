/**
 * Настройки проекта — ФАЙЛОМ в открытом каталоге, а не записью в IndexedDB.
 *
 * ## Почему файл
 *
 * Область `workspace` отвечает на вопрос «как настроен ЭТОТ проект»: какие плагины включены,
 * какой кит выбран, что переопределено для команды. Пока ответ лежал в IndexedDB браузера,
 * он принадлежал не проекту, а вкладке: коллега, клонировавший репозиторий, получал чистый
 * лист, а собственная настройка исчезала вместе с очисткой хранилища. Файл в `.ui_builder/`
 * едет в git вместе с формами, которые он настраивает, — и это единственное, ради чего
 * область заведена.
 *
 * Адрес соседствует с конфигом запуска (`shell/boot/runtime-config`, `.ui_builder/config.json`)
 * и не сливается с ним намеренно: конфиг запуска отвечает на вопрос «каким собрать
 * приложение» и читается ДО первой отрисовки, а настройки — на вопрос «как оно настроено»
 * и меняются человеком на ходу. Один файл на оба означал бы, что переключатель темы
 * переписывает файл, задающий состав приложения.
 *
 * ## Что здесь считается нормой, а не отказом
 *
 * - **Файла нет** — настроек проекта нет: пустой объект, не ошибка. Так выглядит любой
 *   проект, которого этот билдер ещё не видел.
 * - **JSON испорчен** — тоже пустой объект (и запись в консоль). Правило уже действует
 *   для конфига запуска, и причина та же: файл правят руками, и сломанная скобка не повод
 *   не открыть проект.
 * - **Источник без записи** — читаем, писать отказываемся. Отказ настоящий (отклонённый
 *   промис), потому что служба настроек на нём откатывает кэш: молчаливое «записали»
 *   оставило бы на экране значение, которого в файле нет.
 *
 * ## Один писатель, целиком
 *
 * Файл переписывается ЦЕЛИКОМ на каждую запись ключа, как и область в IndexedDB до него.
 * Слияние с чужой правкой не делается: второй писатель этого файла — человек в редакторе,
 * и «слить» его правку с нашей нечем, а `expected` источника при этом отвергнет запись
 * поверх изменившегося файла, и отказ увидит тот, кто её заказал.
 *
 * @module shell/platform/services/settings-project
 */

import type { SettingsScope } from '@reformer/builder-plugin-api/internal';
import type { Source } from '@/shell/platform/source/types';
import type { SettingsBackend } from './settings';

/** Адрес файла настроек проекта. Рядом с конфигом запуска, но отдельно от него. */
export const PROJECT_SETTINGS_PATH = '.ui_builder/settings.json';

/** Источник в объёме, нужном настройкам: прочитать, записать, узнать про запись. */
export type SettingsSource = Pick<Source, 'read' | 'capabilities'> & {
  write?: Source['write'];
};

export interface ProjectSettingsBackend extends SettingsBackend {
  /**
   * Сообщает, какой источник открыт сейчас. `null` — проекта нет.
   *
   * Зовёт композиция на смену проекта, ДО перечитывания настроек: иначе перечитывание взяло
   * бы файл прежнего проекта. Тот же контракт, что у `IdbSettingsBackend.useWorkspace`, —
   * и по той же причине.
   */
  useSource(source: SettingsSource | null): void;
  /** Пишется ли слой проекта прямо сейчас: есть проект и источник принимает запись. */
  writable(): boolean;
}

/** Разбирает файл. Всё, что не объект, — это «настроек нет», а не половина настроек. */
function parseSettings(text: string): Record<string, unknown> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    console.error(`[settings] ${PROJECT_SETTINGS_PATH} не разбирается как JSON`, error);
    return {};
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    console.error(`[settings] ${PROJECT_SETTINGS_PATH}: ожидался объект`);
    return {};
  }
  return { ...(raw as Record<string, unknown>) };
}

export function createProjectSettingsBackend(): ProjectSettingsBackend {
  let source: SettingsSource | null = null;
  /**
   * Снимок файла в памяти.
   *
   * Нужен записи: она переписывает файл целиком, а читать его перед каждой правкой значило бы
   * ходить в источник на каждое нажатие переключателя. Снимок заполняется чтением области
   * (`read`) — служба настроек делает его один раз при загрузке и на каждую смену проекта.
   */
  let snapshot: Record<string, unknown> = {};
  let loaded = false;

  /** Запись идёт по одной: вторая правка не должна обогнать коммит первой и потерять её. */
  let chain: Promise<unknown> = Promise.resolve();
  const enqueue = <T>(job: () => Promise<T>): Promise<T> => {
    const next = chain.then(job, job);
    chain = next.catch(() => undefined);
    return next;
  };

  const readFile = async (): Promise<Record<string, unknown>> => {
    if (source === null) return {};
    try {
      const content = await source.read(PROJECT_SETTINGS_PATH);
      return parseSettings(content.text);
    } catch {
      // Нет файла — нет настроек проекта. Отличать «не найден» от «не прочитался» нечем:
      // источники отвечают на это по-разному, а исход для нас один.
      return {};
    }
  };

  const writeFile = async (values: Record<string, unknown>): Promise<void> => {
    const current = source;
    if (current?.write === undefined || !current.capabilities.write) {
      throw new Error(`${PROJECT_SETTINGS_PATH}: источник проекта не принимает запись`);
    }
    // Отступы — файл читают и правят люди, он лежит в git, и однострочный JSON давал бы
    // конфликт слияния на каждой правке любого ключа.
    await current.write(PROJECT_SETTINGS_PATH, `${JSON.stringify(values, null, 2)}\n`);
  };

  return {
    useSource: (next) => {
      source = next;
      snapshot = {};
      loaded = false;
    },

    writable: () => source !== null && source.capabilities.write && source.write !== undefined,

    read: (scope: SettingsScope) =>
      enqueue(async () => {
        // Слой проекта отвечает ТОЛЬКО за область проекта. Спросили про `user` — это не наш
        // вопрос, и пустота здесь означает «здесь ничего не лежит», а не «ничего не задано».
        if (scope !== 'workspace') return {};
        snapshot = await readFile();
        loaded = true;
        return { ...snapshot };
      }),

    write: (scope: SettingsScope, key: string, value: unknown) =>
      enqueue(async () => {
        if (scope !== 'workspace') return;
        if (!loaded) {
          snapshot = await readFile();
          loaded = true;
        }
        const next = { ...snapshot, [key]: value };
        await writeFile(next);
        snapshot = next;
      }),

    remove: (scope: SettingsScope, key: string) =>
      enqueue(async () => {
        if (scope !== 'workspace') return;
        if (!loaded) {
          snapshot = await readFile();
          loaded = true;
        }
        if (!(key in snapshot)) return;
        const next = { ...snapshot };
        delete next[key];
        await writeFile(next);
        snapshot = next;
      }),
  };
}
