/**
 * Корпус знаний из `node_modules` ОТКРЫТОГО ПРОЕКТА, а не из сборки билдера.
 *
 * Зачем, если артефакт уже вшит. Вшитый описывает версии, с которыми собран билдер; у
 * пользователя в проекте стоят свои. Разъезд не гипотетический: билдер публикуется отдельно от
 * библиотек и живёт дольше любой их версии, а справка, рассказывающая про API, которого в его
 * `node_modules` нет, хуже отсутствующей — она выглядит достоверно.
 *
 * Именно поэтому MCP-сервер читает индекс У ПАКЕТА, а не из своего `dist`
 * (`core/index/merge.ts`). Здесь то же свойство восстанавливается для браузера.
 *
 * Всё или ничего по пакетам: берутся ровно те `@reformer/*`, что нашлись в проекте. Смешивать
 * их с вшитыми нельзя — получился бы корпус, которого не существует ни у кого: часть API из
 * одной версии, часть из другой.
 *
 * ## Почему источник объявлен здесь, а не импортирован
 *
 * В v1 функция принимала `FileSystemDirectoryHandle` и спускалась по каталогам дескрипторами File
 * System Access — то есть знала транспорт. В v2 транспорт спрятан за контрактом источника
 * (`host/source`), но плагин видит платформу только через `@/sdk`, а источника там нет и не должно
 * быть: ассистенту нужен не источник целиком (листинг, запись, конфликты, ревизии), а ОДНО
 * действие — «прочитай файл по пути». Поэтому здесь объявлена {@link PackageFiles} — минимальная
 * потребность, структурно совместимая с `Source`: настоящий источник подходит ей как есть, а тест
 * обходится картой из четырёх строк. Тот же приём, которым `host/plugin/storage` объявляет свой
 * бэкенд вместо импорта IndexedDB.
 *
 * @module plugins/ai/knowledge/project-source
 */

import { KNOWN_PACKAGES } from '@reformer/mcp/dist/core/docs/packages.js';
import {
  BUNDLE_SCHEMA_VERSION,
  type DocsBundle,
  type IndexBundle,
} from '@reformer/mcp/dist/core/bundle.js';

/**
 * Чтение файла проекта по пути — всё, что корпусу нужно от источника.
 *
 * Отсутствие файла — ОТКАЗ (исключение), а не пустая строка: у `Source.read` это так, и трактовать
 * пустой файл как отсутствующий значило бы принять покалеченный `llms.txt` за «пакета нет».
 */
export interface PackageFiles {
  read(path: string): Promise<{ readonly text: string }>;
}

/** Что нашлось в проекте. `null` — `@reformer/*` там нет вовсе (открыт не тот каталог). */
export interface ProjectBundles {
  index: IndexBundle;
  docs: DocsBundle;
  /** Пакет → версия из найденного индекса. Показывается в ответе: чьи это знания. */
  versions: Record<string, string>;
}

/** Прочитать файл; `null` — его там нет либо источник отказал. */
async function readText(files: PackageFiles, path: string): Promise<string | null> {
  try {
    return (await files.read(path)).text;
  } catch {
    return null;
  }
}

/**
 * Прочитать корпус из `node_modules` проекта.
 *
 * Читается один раз на открытый источник — вызывающий обязан кэшировать: это около 2.8 МБ, и
 * делать это на каждый вопрос агента незачем.
 *
 * @param files - Чтение файлов проекта (обычно — источник рабочей области).
 */
export async function readProjectBundles(files: PackageFiles): Promise<ProjectBundles | null> {
  const index: IndexBundle = { schemaVersion: BUNDLE_SCHEMA_VERSION, builtAt: '', packages: {} };
  const docs: DocsBundle = { schemaVersion: BUNDLE_SCHEMA_VERSION, builtAt: '', packages: {} };
  const versions: Record<string, string> = {};

  for (const pkg of KNOWN_PACKAGES) {
    // Путь — по ИМЕНИ пакета (`node_modules/@reformer/core`), а не по имени каталога монорепо:
    // у потребителя нет ни `packages/`, ни его раскладки.
    const dir = `node_modules/${pkg}`;

    const rawIndex = await readText(files, `${dir}/llms-index.json`);
    if (!rawIndex) continue;

    try {
      const parsed = JSON.parse(rawIndex);
      index.packages[pkg] = parsed;
      if (typeof parsed?.version === 'string') versions[pkg] = parsed.version;
    } catch {
      // Битый индекс — как отсутствующий: лучше не знать про пакет, чем знать неверно.
      continue;
    }

    const text = await readText(files, `${dir}/llms.txt`);
    if (text) docs.packages[pkg] = text;
  }

  return Object.keys(index.packages).length > 0 ? { index, docs, versions } : null;
}
