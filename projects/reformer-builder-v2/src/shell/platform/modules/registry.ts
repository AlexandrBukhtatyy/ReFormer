/**
 * Реестр модулей оболочки: bare-спецификатор → УЖЕ ЗАГРУЖЕННЫЙ объект экспортов.
 *
 * Это самая чувствительная часть механики загрузки кода, и причина одна: **второй экземпляр
 * пакета ломает идентичность**. В v1 это измерено на `@reformer/core` — `getNodeForSignal`
 * и `instanceof Signal` работают через модуль-локальный реестр и прототипы, поэтому два бандла
 * ядра дают форму, у листьев которой «нет form-node». Отсюда правило, из которого выведено всё
 * остальное: каждый `@reformer/*` спецификатор обязан указывать на тот же объект модуля,
 * что использует сама оболочка.
 *
 * Поэтому реестр устроен как **только добавление**. Плагин может принести свой модуль под своим
 * именем, но не подменить платформенный: подмена `react` или `@reformer/core` — не расширение,
 * а способ разломать идентичность из плагина. Проверка — принадлежность списку, и она здесь
 * в коде ({@link isProtectedSpecifier}), а не в договорённости: список, который «все знают»,
 * перестаёт соблюдаться на первом же исключении.
 *
 * Заполнение защищённых слотов — привилегия того, кто создаёт реестр ({@link createModuleRegistry}
 * принимает их аргументом). Разделение намеренное: оболочка сажает настоящие `react`
 * и `@reformer/*` при старте, а публичный `register` не может к ним прикоснуться уже никогда —
 * ни поверх занятого слота, ни в пустой.
 *
 * ## Ленивый модуль оболочки — и почему это не догрузка
 *
 * Часть модулей оболочки живёт отдельным чанком: `@reformer/ui-kit` вынесен в свои 708 кБ
 * осознанно, и статическая ссылка на него отсюда вернула бы его в основной чанк — то есть
 * заставила бы платить за кит всех, включая тех, кто ни одной формы не открывал. Поэтому
 * встроенным модулем может быть {@link lazyBuiltin} — обещание значения, а не значение.
 *
 * Это НЕ ослабление запрета «bare-спецификатор никуда не догружается». Догрузка запрещена потому,
 * что второй экземпляр пакета ломает идентичность, а второй экземпляр берётся из того, что
 * спецификатор резолвит кто-то, кроме оболочки. Здесь резолвит по-прежнему только оболочка:
 * `load` объявлен композицией и указывает на её собственный `import()`, то есть на ТОТ ЖЕ
 * экземпляр, который получит и сама оболочка. Код формы к этому механизму не прикасается —
 * `register` ленивую запись не принимает.
 *
 * Разрешаются такие записи одной фазой — {@link ModuleRegistryWarmup.warm}, — и ровно по той же
 * причине, по которой отдельной фазой грузится движок TypeScript: `require` внутри модуля
 * синхронен, значит всё асинхронное обязано случиться ДО линковки. Непрогретый ленивый модуль
 * на `resolve` не молчит и не отдаёт `undefined`, а отказывает причиной `cold`: «не зарегистрирован»
 * и «зарегистрирован, но не прогрет» чинятся в разных местах.
 *
 * @module host/modules/registry
 */

import { toDisposable, type Disposable } from '../primitives/disposable';

/**
 * Реестр модулей — неприкосновенная часть контракта Э8.
 *
 * Ровно два метода: резолв и добавление. Всё, что нужно сверх этого для диагностики, вынесено
 * в {@link ModuleRegistryDiagnostics}, чтобы обязательная поверхность оставалась минимальной.
 */
export interface ModuleRegistry {
  /**
   * Объект экспортов по bare-спецификатору либо `undefined`, если такого модуля нет.
   *
   * `fromPath` — файл, из которого пришёл импорт; он не влияет на результат (реестр плоский),
   * но участвует в диагностике и держит место под будущий резолв, зависящий от контекста.
   */
  resolve(specifier: string, fromPath: string): unknown | undefined;
  /**
   * Добавляет модуль. **Только добавление**: защищённый спецификатор и уже занятый слот —
   * {@link ModuleRegistryError}, а не тихая замена.
   */
  register(specifier: string, exports: unknown): Disposable;
}

/**
 * Необязательная надстройка над реестром — для сообщений об ошибке и тестов.
 *
 * Вынесена из {@link ModuleRegistry} осознанно: контракт неприкосновенен, а «покажи, что у тебя
 * есть» — удобство, которое не должно в него просачиваться.
 */
export interface ModuleRegistryDiagnostics {
  /** Известен ли спецификатор — проверка до исполнения, без побочных эффектов. */
  has(specifier: string): boolean;
  /** Все известные спецификаторы, отсортированные. Идёт в текст ошибки «импорт недоступен». */
  specifiers(): readonly string[];
}

/**
 * Прогрев ленивых модулей оболочки. Тоже вне {@link ModuleRegistry} и по той же причине:
 * контракт описывает резолв, а не жизненный цикл того, кто его наполняет.
 */
export interface ModuleRegistryWarmup {
  /** Объявленные, но ещё не прогретые спецификаторы. Пусто ⇔ `resolve` не откажет по `cold`. */
  cold(): readonly string[];
  /**
   * Разрешает все ленивые модули. Идемпотентна: параллельные вызовы получают один промис,
   * а после успеха прогревать уже нечего.
   *
   * Отказ НЕ запоминается — иначе одна сетевая икота навсегда лишила бы человека кита,
   * и лечилась бы только перезагрузкой страницы (тот же довод, что у ленивого namespace
   * в `app/preview-host`).
   */
  warm(): Promise<void>;
}

/** Реализация реестра в Host: контракт плюс диагностика плюс прогрев. */
export type HostModuleRegistry = ModuleRegistry & ModuleRegistryDiagnostics & ModuleRegistryWarmup;

/**
 * Обещание модуля оболочки вместо самого модуля.
 *
 * Бренд — символ, а не форма объекта: распознавать «ленивое» по наличию поля `load` значило бы
 * не суметь посадить в реестр настоящий модуль, у которого есть экспорт с таким именем.
 */
const LAZY_BUILTIN: unique symbol = Symbol('reformer-builder.lazy-builtin');

/** Ленивый встроенный модуль. Создаётся только через {@link lazyBuiltin}. */
export interface LazyBuiltin {
  readonly [LAZY_BUILTIN]: true;
  /** Как достать модуль. Зовётся не более одного раза за успешный прогрев. */
  readonly load: () => Promise<unknown>;
}

/**
 * Объявляет встроенный модуль ленивым.
 *
 * ```ts
 * createModuleRegistry([['@reformer/ui-kit', lazyBuiltin(() => import('@reformer/ui-kit'))]]);
 * ```
 */
export function lazyBuiltin(load: () => Promise<unknown>): LazyBuiltin {
  return { [LAZY_BUILTIN]: true, load };
}

/** Ленивое ли это объявление. */
export function isLazyBuiltin(value: unknown): value is LazyBuiltin {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Partial<LazyBuiltin>)[LAZY_BUILTIN] === true
  );
}

/**
 * Защищённые спецификаторы — точное совпадение.
 *
 * Список из контракта Э8. Каждый пункт здесь потому, что его подмена ломает идентичность:
 * два React — два дерева хуков, два `jsx-runtime` — несовместимые элементы, второй `@builder/sdk` —
 * плагин, который регистрирует вклады в чужой пустой реестр.
 */
export const PROTECTED_SPECIFIERS: readonly string[] = [
  'react',
  'react/jsx-runtime',
  '@builder/sdk',
];

/**
 * Защищённые пространства: сам пакет и **любой** его подпуть.
 *
 * `@reformer/core`, `@reformer/core/validation`, `@reformer/ui-kit/form-wizard` — все они ведут
 * в один и тот же экземпляр ядра, поэтому защищать надо префикс, а не перечислять подпути:
 * перечисление устареет на первом новом entry point пакета.
 */
export const PROTECTED_PREFIXES: readonly string[] = ['@reformer/'];

/** Относительный спецификатор — дело линковщика, а не реестра. */
export function isRelativeSpecifier(specifier: string): boolean {
  return (
    specifier === '.' ||
    specifier === '..' ||
    specifier.startsWith('./') ||
    specifier.startsWith('../')
  );
}

/**
 * Принадлежит ли спецификатор защищённому набору.
 *
 * Экспортируется отдельно, чтобы проверку можно было выполнить **до** попытки регистрации —
 * загрузчик плагинов показывает такой конфликт как отказ включить плагин, а не как исключение
 * посреди его инициализации.
 */
export function isProtectedSpecifier(specifier: string): boolean {
  if (PROTECTED_SPECIFIERS.includes(specifier)) return true;
  return PROTECTED_PREFIXES.some((prefix) => specifier.startsWith(prefix));
}

/** Почему реестр отказал. Причины различаются, потому что чинятся по-разному. */
export type ModuleRegistryErrorReason =
  /** Спецификатор в защищённом списке: подменить нельзя вообще, переименуй свой модуль. */
  | 'protected'
  /** Слот занят: имя уже зарегистрировано, снимай ту регистрацию или бери другое имя. */
  | 'occupied'
  /** Пустой или бессмысленный спецификатор. */
  | 'invalid'
  /** В реестр пришёл путь — ошибка вызывающего, такие резолвит линковщик. */
  | 'relative'
  /**
   * Модуль объявлен ленивым, но прогрев до линковки не выполнен.
   *
   * Отдельная причина, а не `undefined`: «такого модуля нет» отправляет автора формы искать опечатку
   * в импорте, тогда как чинить надо вызывающего, забывшего дождаться {@link ModuleRegistryWarmup.warm}.
   */
  | 'cold';

/** Отказ реестра модулей. Несёт спецификатор и причину — чтобы UI не разбирал текст. */
export class ModuleRegistryError extends Error {
  readonly specifier: string;
  readonly reason: ModuleRegistryErrorReason;

  constructor(reason: ModuleRegistryErrorReason, specifier: string, message: string) {
    super(message);
    this.name = 'ModuleRegistryError';
    this.reason = reason;
    this.specifier = specifier;
  }
}

/**
 * Создаёт реестр, заполненный модулями оболочки.
 *
 * `builtins` — единственный путь занять защищённый слот, и он доступен только тому, кто создаёт
 * реестр. Дубликат внутри `builtins` — противоречие в сборке оболочки, а не в коде пользователя,
 * поэтому бросаем сразу, на старте.
 */
export function createModuleRegistry(
  builtins: Iterable<readonly [string, unknown]> = []
): HostModuleRegistry {
  /**
   * Запись, а не голое значение: по её идентичности `dispose` понимает, что слот всё ещё его.
   *
   * Поля меняются на месте (прогрев ленивой записи), а не заменой записи целиком — иначе
   * `dispose`, сверяющий идентичность, счёл бы прогретый слот чужим.
   */
  interface Entry {
    exports: unknown;
    /** Не `undefined` ⇔ модуль ещё не прогрет. */
    load?: () => Promise<unknown>;
  }

  const entries = new Map<string, Entry>();

  for (const [specifier, exports] of builtins) {
    if (entries.has(specifier)) {
      throw new ModuleRegistryError(
        'occupied',
        specifier,
        `модуль оболочки «${specifier}» объявлен дважды: список встроенных модулей противоречив`
      );
    }
    entries.set(
      specifier,
      isLazyBuiltin(exports) ? { exports: undefined, load: exports.load } : { exports }
    );
  }

  /** Промис текущего прогрева. Сбрасывается на отказе — см. {@link ModuleRegistryWarmup.warm}. */
  let warming: Promise<void> | undefined;

  const coldEntries = (): [string, Entry][] =>
    [...entries].filter(([, entry]) => entry.load !== undefined);

  return {
    resolve(specifier, fromPath) {
      if (isRelativeSpecifier(specifier) || specifier.startsWith('/')) {
        // Не промах, а ошибка вызывающего: реестр знает только bare-спецификаторы. Тихий
        // `undefined` превратил бы ошибку линковки в невнятное «модуль не найден».
        throw new ModuleRegistryError(
          'relative',
          specifier,
          `«${specifier}» (импорт из «${fromPath}») — путь, а не имя пакета: ` +
            `пути резолвит линковщик внутри набора файлов, реестр их не знает`
        );
      }
      const entry = entries.get(specifier);
      if (entry === undefined) return undefined;
      if (entry.load !== undefined) {
        throw new ModuleRegistryError(
          'cold',
          specifier,
          `модуль «${specifier}» (импорт из «${fromPath}») объявлен ленивым и ещё не прогрет: ` +
            `прогрев обязан завершиться ДО линковки, потому что require внутри модуля синхронен`
        );
      }
      return entry.exports;
    },

    register(specifier, exports) {
      if (specifier.trim() === '') {
        throw new ModuleRegistryError('invalid', specifier, 'пустой спецификатор модуля');
      }
      if (isLazyBuiltin(exports)) {
        // Ленивая запись живёт только среди встроенных. Прогрев — фаза, которая к моменту
        // `register` уже могла пройти, и тогда модуль остался бы холодным навсегда: `resolve`
        // отказывал бы причиной «не прогрет», а прогревать было бы уже некому.
        throw new ModuleRegistryError(
          'invalid',
          specifier,
          `«${specifier}»: ленивым может быть только встроенный модуль оболочки — ` +
            `прогрев идёт один раз до линковки, и зарегистрированное после него не прогреет никто`
        );
      }
      if (isProtectedSpecifier(specifier)) {
        throw new ModuleRegistryError(
          'protected',
          specifier,
          `«${specifier}» — защищённый модуль оболочки, подменить его нельзя. ` +
            `Второй экземпляр такого пакета ломает идентичность: сигналы, узлы формы, реестр вкладов. ` +
            `Защищены ${PROTECTED_SPECIFIERS.join(', ')} и любой подпуть ${PROTECTED_PREFIXES.join(', ')}`
        );
      }
      const occupied = entries.get(specifier);
      if (occupied !== undefined) {
        // Тоже подмена, просто без списка: победа последнего регистратора — гонка, в которой
        // вопрос «почему у меня другой модуль» не диагностируется вообще.
        throw new ModuleRegistryError(
          'occupied',
          specifier,
          `модуль «${specifier}» уже зарегистрирован: реестр допускает только добавление`
        );
      }

      const entry: Entry = { exports };
      entries.set(specifier, entry);
      return toDisposable(() => {
        // Сверка по идентичности: слот мог быть освобождён и занят заново кем-то другим.
        if (entries.get(specifier) === entry) entries.delete(specifier);
      });
    },

    has(specifier) {
      return entries.has(specifier);
    },

    specifiers() {
      return [...entries.keys()].sort();
    },

    cold() {
      return coldEntries()
        .map(([specifier]) => specifier)
        .sort();
    },

    warm() {
      const pending = coldEntries();
      if (pending.length === 0) return Promise.resolve();
      warming ??= Promise.all(
        pending.map(async ([specifier, entry]) => {
          const load = entry.load;
          if (load === undefined) return;
          try {
            entry.exports = await load();
          } catch (error) {
            throw new ModuleRegistryError(
              'cold',
              specifier,
              `ленивый модуль «${specifier}» не загрузился: ${
                error instanceof Error ? error.message : String(error)
              }`
            );
          }
          // Снимаем метку последней: пока она стоит, `resolve` честно отвечает «не прогрет».
          entry.load = undefined;
        })
      )
        .then(() => undefined)
        .catch((error: unknown) => {
          warming = undefined;
          throw error;
        });
      return warming;
    },
  };
}
