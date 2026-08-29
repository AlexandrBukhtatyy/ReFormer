/**
 * Компиляция сайдкаров формы: набор файлов → исполненные модули плюс список того, что не вышло.
 *
 * Своего транспилятора здесь нет и быть не должно. Механизм один на два потребителя — загрузчик
 * плагинов и компилятор формы делают буквально одно и то же, — и живёт он в Host службой
 * (`host/modules/loader`). Разные у них только входные данные: у плагина это его каталог,
 * у формы — её файлы из рабочей копии. Поэтому модуль получает загрузчик ПОРТОМ и добавляет
 * ровно две вещи, которых у платформы нет: синтетическую точку входа и перевод её результата
 * в находки превью.
 *
 * ## Прогрев — отдельная фаза, и пропустить её нельзя
 *
 * `Transpiler.transpile` синхронный, потому что вызывается изнутри `require`, а `require`
 * синхронен по устройству. Ленивая загрузка движка асинхронна по определению. Разрешается
 * это единственным способом: движок готовится ДО загрузки. Здесь это `modules.prepare`,
 * и он вызывается со ВСЕМ набором — включая синтетический энтри, чтобы «нужен ли движок»
 * решалось по тому же списку, который уйдёт в линковку.
 *
 * @module plugins/preview/compiling/compile
 */

import type { PreviewProblem } from '../contract';
import type { PreviewModuleError, PreviewModules } from '../host';
import { buildEntrySource, PREVIEW_ENTRY_FILE, readEntryExports } from './entry';

/** Результат компиляции каталога формы. */
export interface CompiledForm {
  /** Имя файла → его экспорты. Только те, что собрались. */
  readonly modules: ReadonlyMap<string, unknown>;
  readonly problems: readonly PreviewProblem[];
}

const EMPTY: CompiledForm = Object.freeze({
  modules: new Map<string, unknown>(),
  problems: Object.freeze([]),
});

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Транспилировать и исполнить сайдкары.
 *
 * Пустой набор — законный ответ, а не ошибка: форма без сайдкаров существует, и компилирующая
 * поверхность для неё показывает ровно то же, что рантайм. Отдельного сообщения это не требует.
 */
export async function compileForm(
  files: ReadonlyMap<string, string>,
  modules: PreviewModules
): Promise<CompiledForm> {
  const names = [...files.keys()];
  if (names.length === 0) return EMPTY;

  let withEntry: Map<string, string>;
  try {
    withEntry = new Map(files);
    withEntry.set(PREVIEW_ENTRY_FILE, buildEntrySource(names));
  } catch (error) {
    return { modules: new Map(), problems: [problem('', 'resolve', describe(error))] };
  }

  try {
    // Прогрев ДО линковки: внутри `require` асинхронного шага быть не может.
    await modules.prepare?.([...withEntry.keys()]);
  } catch (error) {
    return {
      modules: new Map(),
      problems: [problem('', 'transpile', `движок транспиляции не готов: ${describe(error)}`)],
    };
  }

  let graph;
  try {
    graph = await modules.load(withEntry, PREVIEW_ENTRY_FILE);
  } catch (error) {
    // Загрузчик обещает возвращать ошибки данными, но обещание чужое: превью не имеет права
    // упасть целиком из-за того, что кто-то бросил.
    return { modules: new Map(), problems: [problem('', 'evaluate', describe(error))] };
  }

  const problems: PreviewProblem[] = graph.errors.map(fromModuleError);
  const exported = readEntryExports(graph.entry);
  if (exported === null) {
    // Энтри печатаем мы сами, поэтому непонятный результат означает, что граф не собрался
    // вовсе — и настоящая причина уже лежит в `graph.errors`. Своё сообщение добавляем
    // только если там пусто, иначе оно вытеснило бы полезное.
    if (problems.length === 0) {
      problems.push(problem(PREVIEW_ENTRY_FILE, 'evaluate', 'точка входа не отдала модулей'));
    }
    return { modules: new Map(), problems };
  }

  for (const failure of exported.errors) {
    problems.push(problem(failure.file, 'evaluate', failure.message));
  }

  return { modules: new Map(Object.entries(exported.modules)), problems };
}

function problem(file: string, phase: PreviewProblem['phase'], message: string): PreviewProblem {
  return { file, phase, message };
}

function fromModuleError(error: PreviewModuleError): PreviewProblem {
  return { file: error.file, phase: error.phase, message: error.message };
}
