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
 * @module shell/platform/modules/transpilers
 */

import { toDisposable, type Disposable } from '@reformer/builder-plugin-api/internal';

/** Результат транспиляции одного файла. `map` — sourcemap, если движок её отдаёт. */
export interface TranspileOutput {
  readonly js: string;
  readonly map?: string;
}

/**
 * Одна находка движка: текст и, если движок его знает, полуинтервал `[start, end)` в исходнике —
 * в кодовых единицах UTF-16, как считают и JavaScript, и редактор.
 */
export interface TranspileFinding {
  readonly message: string;
  readonly range?: { readonly start: number; readonly end: number };
}

/**
 * Отказ движка — исключение, которое несёт находки, а не только их склейку.
 *
 * `message` по-прежнему читается как одна строка (так её показывают лог и панель сборки),
 * но позиция первой находки без этого класса терялась бы на первом же перезаворачивании:
 * линковщик описывает ошибку строкой и относит к файлу, а «в какой строке» знает только
 * движок — и только в момент, когда транспилирует.
 */
export class TranspileError extends Error {
  readonly findings: readonly TranspileFinding[];
  /**
   * Находка окончательная: запасной движок (`Transpiler.fallback`) её не уточнит, и файл ему не
   * отдаётся. Пример — повторное объявление имени: это не синтаксис, а связывание, и строгий
   * движок, переводящий файл в одиночку, его не проверяет вовсе — переведёт, и сбой всплывёт
   * при исполнении уже без места.
   */
  readonly definitive: boolean;

  constructor(findings: readonly TranspileFinding[], options: { definitive?: boolean } = {}) {
    super(findings.map((finding) => finding.message).join('; '));
    this.name = 'TranspileError';
    this.findings = findings;
    this.definitive = options.definitive === true;
  }
}

/** Сменный движок транспиляции. Контракт Э8. */
export interface Transpiler {
  /** Идентификатор для диагностики и для запрета двойной регистрации. */
  readonly id: string;
  /** Берётся ли этот движок за такой файл. Решение только по имени — содержимое ещё не читали. */
  applies(fileName: string): boolean;
  /** Чистое преобразование. Ошибка — исключение; вызывающий отнесёт её к файлу. */
  transpile(code: string, fileName: string): TranspileOutput;
  /**
   * Запасной движок для файлов, которые этот отверг. Необязателен.
   *
   * Быстрый движок вправе быть беднее строгого: хуже объяснять ошибку или не знать редкого
   * синтаксиса. Запасной закрывает оба случая сразу — загрузчик переводит им отвергнутый файл:
   * собрал — модуль работает, не собрал — находки уже его, точные. Отсюда и асинхронность:
   * строгий движок тяжёлый и грузится лениво, ТОЛЬКО когда отказ случился. Синхронный `require`
   * дождаться его не может, поэтому загрузчик собирает граф заново после загрузки (см.
   * `./loader`). Функция зовётся при каждом отказе и сама отвечает за то, чтобы движок
   * грузился один раз.
   */
  readonly fallback?: () => Promise<Transpiler>;
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
