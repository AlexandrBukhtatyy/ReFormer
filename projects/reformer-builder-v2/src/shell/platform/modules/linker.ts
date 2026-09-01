/**
 * Линковка набора файлов как CommonJS-графа: `new Function(exports, require, module, __filename)`.
 *
 * Техника выбрана не по вкусу, а по исключению остальных. `import(blobUrl)` отвергнут в v1
 * и повторно в v2: внутри blob-модуля bare-спецификаторы резолвит браузер, то есть попытка выдать
 * коду `@reformer/core` или `@builder/sdk` подтянет ВТОРОЙ экземпляр пакета — и форма потеряет
 * связь сигналов с узлами, а плагин зарегистрирует вклады в чужой пустой реестр. Import maps
 * отвергнуты по той же причине. CJS-конверт — единственный способ подсунуть коду собственный
 * `require` и остаться на объектах модулей оболочки.
 *
 * Отсюда же второе правило: **bare-спецификатор идёт только в реестр модулей и никогда никуда
 * не догружается**. Догрузка — это и есть второй экземпляр; запрет на неё и есть защита
 * идентичности.
 *
 * Код исполняется в главном потоке с правами приложения. Это осознанный размен: песочница
 * несовместима с требованием единого экземпляра сигналов. Поэтому вызывающий обязан спросить
 * пользователя до первого исполнения — контракт Э8 называет это «запретом исполнения
 * по источнику».
 *
 * @module shell/platform/modules/linker
 */

import { isRelativeSpecifier, type ModuleRegistry } from './registry';

/** Резолвер импортов, который получает исполняемый код под именем `require`. */
export type RequireFn = (specifier: string) => unknown;

/** На какой фазе споткнулись. Различаются, потому что чинятся в разных местах. */
export type LinkPhase =
  /** Импорт не удалось привязать: нет такого файла или нет такого модуля в реестре. */
  | 'resolve'
  /** Движок транспиляции отказался переводить файл: синтаксис. */
  | 'transpile'
  /** Модуль исполнился и бросил. */
  | 'evaluate';

/**
 * Ошибка линковки, привязанная к файлу.
 *
 * Файл в ошибке обязателен: «форма не отрабатывает» без указания, какой именно сайдкар лёг, —
 * ровно тот класс сообщений, из-за которого в v1 завели пофайловую изоляцию. `chain` хранит
 * цепочку импортов, по которой добрались до сбойного файла.
 */
export class ModuleLinkError extends Error {
  readonly file: string;
  readonly phase: LinkPhase;
  readonly chain: readonly string[];

  constructor(
    phase: LinkPhase,
    file: string,
    detail: string,
    chain: readonly string[],
    cause?: unknown
  ) {
    super(`${file}: ${detail}`, cause === undefined ? undefined : { cause });
    this.name = 'ModuleLinkError';
    this.phase = phase;
    this.file = file;
    this.chain = chain;
  }
}

/**
 * Циклический импорт.
 *
 * Настоящий CommonJS отдал бы недостроенные экспорты, и получилась бы форма, у которой половина
 * поведения «просто не подключилась». Явный отказ честнее: цикл в сайдкарах формы или в плагине —
 * это ошибка автора, а не режим работы.
 */
export class ModuleCycleError extends ModuleLinkError {
  constructor(chain: readonly string[]) {
    super('evaluate', chain[chain.length - 1], `циклический импорт: ${chain.join(' → ')}`, chain);
    this.name = 'ModuleCycleError';
  }
}

/** Расширения, которые дописываются к импорту без расширения. Порядок значим. */
const EXTENSIONS: readonly string[] = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'];

/** Имена, которые пробуются, когда спецификатор указывает на каталог. */
const INDEX_NAMES: readonly string[] = ['index'];

/**
 * Нормализует путь: убирает `.`, схлопывает `..`, приводит разделители к `/`.
 *
 * Возвращает `undefined`, если путь вылез за корень набора файлов. Это не педантизм: набор
 * файлов — весь мир исполняемого кода, и `../../../etc` обязан быть отказом, а не промахом.
 */
export function normalizePath(path: string): string | undefined {
  const out: string[] = [];
  for (const segment of path.replace(/\\/g, '/').split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      if (out.length === 0) return undefined;
      out.pop();
      continue;
    }
    out.push(segment);
  }
  return out.join('/');
}

/** Каталог файла. Для файла в корне — пустая строка. */
function dirOf(path: string): string {
  const at = path.lastIndexOf('/');
  return at < 0 ? '' : path.slice(0, at);
}

/** Приводит ключи набора файлов к одному виду, чтобы `./model` и `model.ts` встретились. */
export function normalizeFiles(files: ReadonlyMap<string, string>): ReadonlyMap<string, string> {
  const out = new Map<string, string>();
  for (const [path, code] of files) {
    const normalized = normalizePath(path);
    if (normalized === undefined || normalized === '') continue;
    out.set(normalized, code);
  }
  return out;
}

/**
 * Резолв пути внутри набора файлов — та самая «арифметика путей».
 *
 * Никакой файловой системы: кандидаты проверяются по ключам набора. `undefined` значит
 * «в наборе такого нет» — догружать неоткуда и не надо.
 */
export function resolveFilePath(
  specifier: string,
  fromPath: string,
  files: ReadonlyMap<string, string>
): string | undefined {
  const base = specifier.startsWith('/') ? specifier.slice(1) : `${dirOf(fromPath)}/${specifier}`;
  const target = normalizePath(base);
  if (target === undefined || target === '') return undefined;

  if (files.has(target)) return target;
  for (const ext of EXTENSIONS) {
    if (files.has(`${target}${ext}`)) return `${target}${ext}`;
  }
  for (const index of INDEX_NAMES) {
    for (const ext of EXTENSIONS) {
      const candidate = `${target}/${index}${ext}`;
      if (files.has(candidate)) return candidate;
    }
  }
  return undefined;
}

/**
 * Исполняет CommonJS-код и отдаёт его `module.exports`.
 *
 * `sourceURL` дописывается, чтобы в DevTools и в стеке было `form/validation.ts`,
 * а не `<anonymous>`. `new Function`, а не `eval`: код приходит не из сети, а из файла,
 * который пользователь открыл сам и явно разрешил исполнить.
 *
 * ## `ambient` — подмена окружения ЛЕКСИЧЕСКАЯ
 *
 * Имена из `ambient` становятся дополнительными параметрами функции модуля, то есть внутри кода
 * `fetch` — обычная переменная, затеняющая глобал. Отсюда два свойства, которых не дал бы ни патч
 * `globalThis`, ни Service Worker: область действия ровно один модуль, и снимать подмену не нужно,
 * потому что снаружи её и не было — оболочка и соседние вкладки продолжают видеть настоящий `fetch`.
 *
 * Пустой `ambient` не добавляет ни одного параметра: плагин каталога и форма без фикстуры
 * исполняются ровно так же, как исполнялись.
 */
export function evaluateCommonJs(
  js: string,
  require: RequireFn,
  fileName: string,
  ambient: Readonly<Record<string, unknown>> = {}
): unknown {
  const module: { exports: unknown } = { exports: {} };
  const source = `${js}\n//# sourceURL=builder-module:///${fileName}`;
  const names = Object.keys(ambient);
  const factory = new Function('exports', 'require', 'module', '__filename', ...names, source) as (
    ...args: unknown[]
  ) => void;
  factory(module.exports, require, module, fileName, ...names.map((name) => ambient[name]));
  return module.exports;
}

/** Из чего линковщик собирает граф. */
export interface LinkerOptions {
  /** Путь → исходник. Откуда файлы — линковщик не знает и знать не должен. */
  readonly files: ReadonlyMap<string, string>;
  /** Куда уходят bare-спецификаторы. Больше никуда они не уходят. */
  readonly registry: ModuleRegistry;
  /**
   * Исходник → JS. Синхронно: `require` внутри модуля синхронен, асинхронный шаг здесь
   * означал бы недостроенный модуль. Подготовка движка — забота вызывающего.
   */
  readonly compile: (code: string, fileName: string) => string;
  /** Что перечислить в ошибке «модуль недоступен». Необязательно. */
  readonly knownSpecifiers?: () => readonly string[];
  /**
   * Подстановки на время ОДНОГО графа: спецификатор → уже готовые экспорты.
   *
   * Проверяются раньше всего — и раньше файлов набора, и раньше реестра. Это не обход запрета
   * «bare-спецификатор никуда не догружается», а его продолжение: подстановка приходит из кода,
   * который оболочка уже исполнила сама (фикстура формы), а не из сети. Второго экземпляра пакета
   * отсюда взяться неоткуда.
   *
   * Перекрывать разрешено и файл, который в наборе ЕСТЬ (`./api`): это не лазейка, а суть
   * проверки, когда настоящий `api.ts` ходит в сеть, а посмотреть надо на форму. Ключ
   * сравнивается с тем, что НАПИСАНО в импорте, а не с резолвнутым путём: фикстуру пишет человек,
   * и он видит перед собой строку импорта, а не арифметику путей.
   *
   * Живёт ровно одну загрузку, поэтому две формы, собираемые параллельно, не могут подменить
   * модули друг другу.
   */
  readonly overrides?: ReadonlyMap<string, unknown>;
  /**
   * Имена, которые получит КАЖДЫЙ модуль набора дополнительными параметрами.
   *
   * См. {@link evaluateCommonJs}: подмена лексическая, а не глобальная.
   */
  readonly ambient?: Readonly<Record<string, unknown>>;
}

/** Живой граф: исполненные модули плюс точка входа в него. */
export interface Linker {
  /** Путь → экспорты. Наполняется по мере исполнения; читать можно и после ошибки. */
  readonly modules: ReadonlyMap<string, unknown>;
  /** Исполняет файл и всё, что он импортирует. Повторный вызов отдаёт кэш. */
  load(path: string): unknown;
  /** Резолв пути в имя файла набора. Для точки входа и для диагностики. */
  resolveFile(specifier: string, fromPath: string): string | undefined;
}

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Собирает линковщик над набором файлов.
 *
 * Модуль исполняется ровно один раз за граф — как в настоящем CommonJS. Новый `createLinker`
 * значит новый граф: после правки исходника код обязан исполниться заново, поэтому кэш живёт
 * не дольше одной загрузки.
 */
export function createLinker(options: LinkerOptions): Linker {
  const files = options.files;
  const done = new Map<string, unknown>();
  /** Файлы в процессе исполнения. Он же детектор цикла: без него была бы вечная рекурсия. */
  const stack: string[] = [];

  const overrides = options.overrides;

  const requireFrom =
    (fromPath: string): RequireFn =>
    (specifier: string): unknown => {
      // Подстановка идёт ПЕРВОЙ и одинаково для путей и для имён пакетов: человек, писавший
      // фикстуру, указал строку импорта, а не то, во что она резолвится.
      if (overrides !== undefined && overrides.has(specifier)) return overrides.get(specifier);

      if (isRelativeSpecifier(specifier) || specifier.startsWith('/')) {
        const file = resolveFilePath(specifier, fromPath, files);
        if (file === undefined) {
          throw new ModuleLinkError(
            'resolve',
            fromPath,
            `импорт «${specifier}» не найден среди файлов (есть: ${[...files.keys()].join(', ')})`,
            [...stack]
          );
        }
        return loadFile(file);
      }

      // Bare-спецификатор: только реестр. Догрузка отсюда — это второй экземпляр пакета,
      // то есть ровно та поломка идентичности, ради защиты от которой весь механизм и написан.
      const found = options.registry.resolve(specifier, fromPath);
      if (found === undefined) {
        const known = options.knownSpecifiers?.() ?? [];
        throw new ModuleLinkError(
          'resolve',
          fromPath,
          `модуль «${specifier}» недоступен: он не зарегистрирован в оболочке, ` +
            `а догружать модули извне запрещено — второй экземпляр пакета ломает идентичность` +
            (known.length > 0 ? `. Доступны: ${known.join(', ')}` : ''),
          [...stack]
        );
      }
      return found;
    };

  const loadFile = (file: string): unknown => {
    if (done.has(file)) return done.get(file);
    if (stack.includes(file)) throw new ModuleCycleError([...stack, file]);

    stack.push(file);
    try {
      const source = files.get(file);
      if (source === undefined) {
        // Сюда попасть нельзя: путь пришёл из resolveFilePath, который сверялся с набором.
        throw new ModuleLinkError('resolve', file, 'файла нет в наборе', [...stack]);
      }

      let js: string;
      try {
        js = options.compile(source, file);
      } catch (error) {
        throw new ModuleLinkError('transpile', file, describe(error), [...stack], error);
      }

      let exports: unknown;
      try {
        exports = evaluateCommonJs(js, requireFrom(file), file, options.ambient);
      } catch (error) {
        // Ошибка из более глубокого модуля уже названа своим файлом — перезаворачивать её
        // значило бы приписать сбой импортёру и отправить чинить не тот файл.
        if (error instanceof ModuleLinkError) throw error;
        throw new ModuleLinkError('evaluate', file, describe(error), [...stack], error);
      }

      done.set(file, exports);
      return exports;
    } finally {
      stack.pop();
    }
  };

  return {
    modules: done,
    load: loadFile,
    resolveFile: (specifier, fromPath) => resolveFilePath(specifier, fromPath, files),
  };
}
