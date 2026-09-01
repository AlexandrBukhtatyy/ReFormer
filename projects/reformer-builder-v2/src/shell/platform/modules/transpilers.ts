/**
 * Реестр сменных транспиляторов: «исходник → JS» и ничего больше.
 *
 * Транспилятор — **чистая функция без доступа к модулям**, и именно поэтому его можно менять.
 * Он не видит реестра модулей, не резолвит импорты, не исполняет код: всё, что он умеет, —
 * переписать текст одного файла. Заменить `typescript` на sucrase или esbuild-wasm значит
 * зарегистрировать другой объект с тем же интерфейсом; ни один инвариант идентичности при этом
 * не затрагивается. В v1 то же свойство держалось на комментарии «замена движка — правка одного
 * файла»; здесь оно держится на форме API.
 *
 * Линковщик, наоборот, менять нельзя и незачем: его форма продиктована реестром модулей.
 *
 * Почему `transpile` синхронный, а `ModuleLoader.load` — нет: движок может грузиться лениво
 * (в v1 `typescript` приезжает отдельным чанком), и это асинхронно **один раз при подготовке**.
 * Сама транспиляция обязана быть синхронной, потому что `require` внутри CommonJS-модуля
 * синхронен: асинхронный шаг посреди линковки означал бы, что модуль нельзя дописать до конца.
 *
 * @module host/modules/transpilers
 */

import { toDisposable, type Disposable } from '@/shell/platform/primitives/disposable';

/** Результат транспиляции одного файла. `map` — sourcemap, если движок её отдаёт. */
export interface TranspileOutput {
  readonly js: string;
  readonly map?: string;
}

/** Сменный движок транспиляции. Контракт Э8. */
export interface Transpiler {
  /** Идентификатор для диагностики и для запрета двойной регистрации. */
  readonly id: string;
  /** Берётся ли этот движок за такой файл. Решение только по имени — содержимое ещё не читали. */
  applies(fileName: string): boolean;
  /** Чистое преобразование. Ошибка — исключение; вызывающий отнесёт её к файлу. */
  transpile(code: string, fileName: string): TranspileOutput;
}

/** Набор зарегистрированных транспиляторов. */
export interface TranspilerRegistry {
  /** Добавляет движок. Повторный `id` — ошибка: это почти всегда двойная регистрация. */
  register(transpiler: Transpiler): Disposable;
  /**
   * Первый подходящий движок в порядке «последний зарегистрированный побеждает».
   *
   * Порядок именно такой, потому что транспилятор сменный: чтобы перебить встроенный TS своим,
   * достаточно зарегистрировать свой позже — снимать чужую регистрацию не нужно.
   */
  find(fileName: string): Transpiler | undefined;
  /** Все движки в порядке регистрации. Для панели «о сборке» и тестов. */
  list(): readonly Transpiler[];
}

/** Ошибка реестра транспиляторов (конфликт `id`). */
export class TranspilerRegistryError extends Error {
  readonly transpilerId: string;

  constructor(transpilerId: string, message: string) {
    super(message);
    this.name = 'TranspilerRegistryError';
    this.transpilerId = transpilerId;
  }
}

/** Создаёт пустой реестр транспиляторов. */
export function createTranspilerRegistry(): TranspilerRegistry {
  const items: Transpiler[] = [];

  return {
    register(transpiler) {
      if (transpiler.id.trim() === '') {
        throw new TranspilerRegistryError(transpiler.id, 'у транспилятора пустой id');
      }
      if (items.some((it) => it.id === transpiler.id)) {
        throw new TranspilerRegistryError(
          transpiler.id,
          `транспилятор «${transpiler.id}» уже зарегистрирован: ` +
            `чтобы перебить чужой движок, регистрируй свой под собственным id`
        );
      }
      items.push(transpiler);
      return toDisposable(() => {
        const at = items.indexOf(transpiler);
        if (at >= 0) items.splice(at, 1);
      });
    },

    find(fileName) {
      for (let i = items.length - 1; i >= 0; i -= 1) {
        const candidate = items[i];
        if (candidate.applies(fileName)) return candidate;
      }
      return undefined;
    },

    list() {
      return [...items];
    },
  };
}
