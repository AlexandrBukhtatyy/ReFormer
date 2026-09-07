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
import type { PreviewModuleError, PreviewModules, PreviewPrimedCompile } from '../host';
import { buildEntrySource, PREVIEW_ENTRY_FILE, readEntryExports } from './entry';

/**
 * Изоляция формы от проекта: чем подменить её импорты и окружение.
 *
 * Приходит из фикстуры, исполненной ОТДЕЛЬНЫМ графом (см. {@link './fixture'}), — поэтому
 * компилятор получает уже готовые значения и про устройство фикстуры ничего не знает.
 */
export interface FormIsolation {
  /** Спецификатор → готовые экспорты. Перекрывает и файл набора, и bare-имя. */
  readonly overrides?: ReadonlyMap<string, unknown>;
  /** Имена, подставляемые каждому модулю лексически: `fetch`, `Date`, `Math`. */
  readonly ambient?: Readonly<Record<string, unknown>>;
}

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
  modules: PreviewModules,
  isolation: FormIsolation = {}
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

  let primed: PreviewPrimedCompile | undefined;
  try {
    // Прогрев ДО линковки: внутри `require` асинхронного шага быть не может. Здесь же решается,
    // будить ли движок транспиляции вовсе, — если набор целиком лежит в кэше, не будим.
    primed = await modules.prepare?.(withEntry);
  } catch (error) {
    return {
      modules: new Map(),
      problems: [problem('', 'transpile', `движок транспиляции не готов: ${describe(error)}`)],
    };
  }

  let graph;
  try {
    graph = await modules.load(withEntry, PREVIEW_ENTRY_FILE, {
      ready: primed?.ready,
      overrides: isolation.overrides,
      ambient: isolation.ambient,
    });
  } catch (error) {
    // Загрузчик обещает возвращать ошибки данными, но обещание чужое: превью не имеет права
    // упасть целиком из-за того, что кто-то бросил.
    return { modules: new Map(), problems: [problem('', 'evaluate', describe(error))] };
  }

  if (primed !== undefined && graph.compiled !== undefined && graph.compiled.size > 0) {
    // Не ждём: кэш ускоряет СЛЕДУЮЩУЮ сборку, а эта уже собрана. Задержать показ формы ради
    // записи в OPFS значило бы платить временем человека за выигрыш, который ему ещё не нужен.
    void primed.commit(graph.compiled).catch((error: unknown) => {
      console.warn('[preview] кэш сборки не записался', error);
    });
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
    const next: PreviewProblem = {
      ...problem(
        failure.file,
        failure.phase ?? 'evaluate',
        stripFilePrefix(failure.file, failure.message)
      ),
      ...(failure.range === undefined ? {} : { range: failure.range }),
    };
    // Два сайдкара, импортирующих один битый `./model`, приносят одну и ту же находку дважды:
    // ошибка названа файлом-виновником, а не импортёром, — и второй раз она ничего не добавляет.
    if (!problems.some((seen) => sameProblem(seen, next))) problems.push(next);
  }

  return { modules: new Map(Object.entries(exported.modules)), problems };
}

function sameProblem(a: PreviewProblem, b: PreviewProblem): boolean {
  return a.file === b.file && a.phase === b.phase && a.message === b.message;
}

function problem(file: string, phase: PreviewProblem['phase'], message: string): PreviewProblem {
  return { file, phase, message };
}

/**
 * Снимает имя файла с начала текста, если линковщик его туда приписал.
 *
 * `ModuleLinkError` печатает `«файл: причина»` — для лога это верно, но находка несёт файл
 * отдельным полем, и тот, кто её показывает, называет его сам: в полосе живого вида и в
 * строке панели получалось бы «validation.ts: validation.ts: …».
 */
export function stripFilePrefix(file: string, message: string): string {
  const prefix = `${file}: `;
  return file !== '' && message.startsWith(prefix) ? message.slice(prefix.length) : message;
}

function fromModuleError(error: PreviewModuleError): PreviewProblem {
  return {
    file: error.file,
    phase: error.phase,
    message: stripFilePrefix(error.file, error.message),
    // Место доезжает, когда движок его назвал: без него находка ляжет на первую строку файла.
    ...(error.range === undefined ? {} : { range: error.range }),
  };
}
