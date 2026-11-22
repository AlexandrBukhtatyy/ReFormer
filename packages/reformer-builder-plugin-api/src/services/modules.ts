/**
 * Загрузчик модулей оболочки — возможность для тех, кто исполняет код рабочей копии.
 *
 * ## Зачем
 *
 * В приложении один транспилятор и один загрузчик модулей: ими оболочка поднимает плагины
 * каталога проекта. Превью, которое компилирует форму с её сайдкарами, пользуется ТЕМ ЖЕ
 * механизмом — второй экземпляр значил бы второй чанк движка TypeScript на несколько мегабайт.
 * Раньше загрузчик доезжал до превью портом, который собирала оболочка для стека ReFormer;
 * компилирующая поверхность другого стека (или внешнего плагина) получить его не могла.
 *
 * ## Что здесь не обещано
 *
 * Права исполнять код: его объявляет ИСТОЧНИК, и спрашивают его у службы записей рабочей
 * области (`WorkspaceFilesService.executesCode`). Загрузчик — механизм, а не разрешение.
 *
 * @module @reformer/builder-plugin-api/services/modules
 */

import { defineCapability, type Capability } from '../primitives/capability.js';
import type { TextRange } from './diagnostics/types.js';

/** Сбой загрузки одного файла. */
export interface ModuleLoadProblem {
  readonly file: string;
  readonly phase: 'resolve' | 'transpile' | 'evaluate';
  readonly message: string;
  /** Место в исходнике файла, если фаза его знает (транспиляция — знает). */
  readonly range?: TextRange;
}

/** Результат загрузки графа модулей. */
export interface ModuleGraph {
  readonly entry: unknown;
  readonly modules: ReadonlyMap<string, unknown>;
  readonly errors: readonly ModuleLoadProblem[];
  /** Что пришлось транспилировать: путь → JS. Уходит обратно в кэш сборки. */
  readonly compiled?: ReadonlyMap<string, string>;
}

/** Прогретая компиляция набора: готовое из кэша и способ вернуть собранное. */
export interface PrimedCompile {
  /** Готовый JS, взятый из кэша: путь → код. */
  readonly ready: ReadonlyMap<string, string>;
  /** Нашлось ли всё. `false` означает, что движок транспиляции уже разбужен. */
  readonly complete: boolean;
  /** Отдать на хранение то, что собралось. Зовётся после линковки — до неё состав неизвестен. */
  commit(compiled: ReadonlyMap<string, string>): Promise<void>;
}

export interface ModuleLoaderService {
  /**
   * Прогрев перед линковкой; ОБЯЗАН завершиться до {@link load}: внутри `require` асинхронного
   * шага быть не может. Принимает ФАЙЛЫ, а не имена: ответить «движок не нужен, всё собрано»
   * можно, только зная содержимое.
   */
  prepare(files: ReadonlyMap<string, string>): Promise<PrimedCompile>;

  load(
    files: ReadonlyMap<string, string>,
    entry: string,
    options?: {
      /** Готовый JS из кэша: путь → код. */
      readonly ready?: ReadonlyMap<string, string>;
      /** Подстановки импортов: спецификатор → готовые экспорты. */
      readonly overrides?: ReadonlyMap<string, unknown>;
      /** Лексически подставляемое окружение: `fetch`, `Date`, `Math`. */
      readonly ambient?: Readonly<Record<string, unknown>>;
    }
  ): Promise<ModuleGraph>;
}

/**
 * Возможность «загрузчик модулей». Провайдер — оболочка: движок один на приложение.
 *
 * Версия `1.0.0` — исходная.
 */
export const ModuleLoaderCapability: Capability<ModuleLoaderService> =
  defineCapability<ModuleLoaderService>({ id: 'reformer.modules', version: '1.0.0' });
