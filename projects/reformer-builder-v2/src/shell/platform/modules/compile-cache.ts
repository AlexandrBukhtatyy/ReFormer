/**
 * Кэш транспиляции: набор файлов — в готовый JS, минуя движок.
 *
 * ## Что здесь на самом деле экономится
 *
 * Не миллисекунды транспиляции. Главная цена — сам движок: `typescript` приезжает отдельным
 * чанком на 3.5 МБ, и платит за него каждый, кто открыл форму. Поэтому кэш обязан отвечать
 * на вопрос «нужен ли движок вообще» ДО того, как его начнут грузить, — отсюда форма API:
 * {@link CompileCache.prime} возвращает {@link PrimedCompile.complete}, и только `false`
 * заставляет прогревать движок.
 *
 * ## Два уровня, и второй не роскошь
 *
 * Пофайловый уровень переживает правку соседа: изменили `validation.ts` — `model.ts` остаётся
 * в кэше. Наборный уровень отвечает одним чтением вместо N: у формы из десяти сайдкаров это
 * десять обращений к OPFS против одного, на каждой пересборке. Наборный ключ выводится
 * из пофайловых, поэтому правка одного файла обесценивает набор и НЕ трогает остальные файлы.
 *
 * ## Почему храним текст, а не готовые фабрики
 *
 * Соблазн был: сложить набор одним JS-модулем с функциями внутри и звать `new Function` один раз.
 * Отвергнут по двум причинам. Первая: линковщик пришлось бы учить второму источнику модулей,
 * а он объявлен неизменяемым — здесь же не меняется ни строки, кэш подключается к `compile`.
 * Вторая: пофайловый `//# sourceURL` пропал бы, и стек ошибки формы указывал бы в общий бандл
 * вместо `form/validation.ts` — то есть ровно туда, откуда его когда-то и вытащили.
 *
 * ## Ключ
 *
 * `sha256(идентификатор движка, его версия, версия опций, путь, исходник)`. Путь входит потому,
 * что `transpileModule` решает про JSX по расширению: один и тот же текст в `.ts` и `.tsx` даёт
 * разный вывод. Версия движка входит потому, что апгрейд `typescript` обязан обесценить кэш сам,
 * без ручной инвалидации.
 *
 * @module host/modules/compile-cache
 */

import type { BuildCacheStore } from '../workspace/storage/build-cache';
import { digestAvailable, digestHex } from './digest';

/** Версия формата бандла набора. Меняется вместе со схемой JSON ниже. */
const SET_FORMAT = 1;

/** Набор, каким он лежит в кэше. */
interface StoredSet {
  readonly v: number;
  readonly files: Record<string, string>;
}

/** Из чего складывается ключ, помимо самого файла. */
export interface CompileCacheIdentity {
  /** Идентификатор транспилятора (`typescript`, `sucrase`, …). */
  readonly engineId: string;
  /** Версия движка. Апгрейд обязан обесценить записанное прежним. */
  readonly engineVersion: string;
  /**
   * Версия опций транспиляции.
   *
   * Отдельно от версии движка: сменить `jsx` или `target` — значит получить другой вывод тем же
   * движком, и без этой части ключа кэш отдал бы код, собранный по прежним правилам.
   */
  readonly optionsVersion: string;
}

/** Результат прогрева одного набора. */
export interface PrimedCompile {
  /** Путь к файлу и готовый JS для него. Линковщик берёт отсюда, не спрашивая движок. */
  readonly ready: ReadonlyMap<string, string>;
  /**
   * Нашлось ли всё. `true` — движок не нужен вовсе; ради этого ответа кэш и существует.
   */
  readonly complete: boolean;
  /**
   * Отдать на хранение то, что пришлось транспилировать.
   *
   * Зовётся ПОСЛЕ линковки, потому что до неё неизвестно, какие файлы вообще понадобились:
   * граф исполняет только то, что импортируют.
   */
  commit(compiled: ReadonlyMap<string, string>): Promise<void>;
}

/** Кэш транспиляции над хранилищем артефактов. */
export interface CompileCache {
  /** Доступен ли кэш в этом окружении (есть ли чем считать ключ). */
  readonly available: boolean;
  /**
   * Читает из кэша всё, что есть для этого набора.
   *
   * Принимает ТОЛЬКО файлы, которым нужен транспилятор: собранный `main.js` в кэше означал бы
   * запись, где ключ и значение — один и тот же текст.
   */
  prime(files: ReadonlyMap<string, string>): Promise<PrimedCompile>;
}

/** Прогрев, который ничего не знает: окружение без хеша или без хранилища. */
const INERT: PrimedCompile = Object.freeze({
  ready: new Map<string, string>(),
  complete: false,
  commit: () => Promise.resolve(),
});

export function createCompileCache(
  store: BuildCacheStore,
  identity: CompileCacheIdentity
): CompileCache {
  const available = digestAvailable();
  const prefix = [identity.engineId, identity.engineVersion, identity.optionsVersion];

  const fileKey = (path: string, source: string): Promise<string> =>
    digestHex([...prefix, path, source]);

  /**
   * Ключ набора выводится из пофайловых, а не из исходников заново.
   *
   * Так правка одного файла двигает ровно один пофайловый ключ и, через него, ключ набора —
   * остальные файлы остаются найденными.
   */
  const setKey = (fileKeys: ReadonlyMap<string, string>): Promise<string> =>
    digestHex([
      ...prefix,
      ...[...fileKeys]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([path, key]) => `${path}=${key}`),
    ]);

  return {
    available,

    async prime(files) {
      if (!available || files.size === 0) return INERT;

      const keys = new Map<string, string>();
      await Promise.all(
        [...files].map(async ([path, source]) => {
          keys.set(path, await fileKey(path, source));
        })
      );
      const setHash = await setKey(keys);

      const commit = async (compiled: ReadonlyMap<string, string>): Promise<void> => {
        await Promise.all(
          [...compiled].map(async ([path, js]) => {
            const key = keys.get(path);
            // Файла нет среди прогретых — значит он и не из этого набора. Записать его
            // под чужим ключом было бы хуже, чем не записать вовсе.
            if (key !== undefined) await store.write('file', key, js);
          })
        );
      };

      const stored = await store.read('set', setHash);
      if (stored !== null) {
        const parsed = parseSet(stored, [...files.keys()]);
        if (parsed !== null) {
          // Набор целиком: писать нечего, и движок не понадобится.
          return { ready: parsed, complete: true, commit: () => Promise.resolve() };
        }
        // Битый или чужой бандл — ведём себя как при промахе; перезапишется на commit.
      }

      const ready = new Map<string, string>();
      await Promise.all(
        [...keys].map(async ([path, key]) => {
          const js = await store.read('file', key);
          if (js !== null) ready.set(path, js);
        })
      );

      const complete = ready.size === files.size;
      if (complete) {
        // Все файлы нашлись поштучно — сложим их набором, чтобы в следующий раз хватило
        // одного чтения. Сам движок при этом уже не нужен.
        await store.write('set', setHash, printSet(ready));
        return { ready, complete, commit: () => Promise.resolve() };
      }

      return {
        ready,
        complete,
        async commit(compiled) {
          await commit(compiled);
          // Набор пишем, только когда он собрался целиком: неполный бандл отдал бы при
          // следующем чтении меньше файлов, чем просили, и промах пришлось бы обнаруживать
          // сверкой ключей вместо того, чтобы его просто не создавать.
          const whole = new Map(ready);
          for (const [path, js] of compiled) whole.set(path, js);
          if (whole.size === files.size) await store.write('set', setHash, printSet(whole));
        },
      };
    },
  };
}

/** Набор в текст. */
function printSet(files: ReadonlyMap<string, string>): string {
  const out: Record<string, string> = {};
  for (const [path, js] of files) out[path] = js;
  return JSON.stringify({ v: SET_FORMAT, files: out } satisfies StoredSet);
}

/**
 * Текст в набор — с проверкой, что это тот самый набор.
 *
 * Ключ уже гарантирует совпадение, но сверка состава стоит один проход и защищает от того,
 * чего ключ не ловит: обрезанной записи и артефакта прежнего формата. Возвращает `null`,
 * если бандл не годится, — вызывающий обойдётся с ним как с промахом.
 */
function parseSet(text: string, expected: readonly string[]): ReadonlyMap<string, string> | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const candidate = parsed as Partial<StoredSet>;
  if (candidate.v !== SET_FORMAT) return null;
  const files = candidate.files;
  if (typeof files !== 'object' || files === null) return null;

  const out = new Map<string, string>();
  for (const path of expected) {
    const js = (files as Record<string, unknown>)[path];
    if (typeof js !== 'string') return null;
    out.set(path, js);
  }
  return out;
}
