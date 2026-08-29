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

/** Реализация реестра в Host: контракт плюс диагностика. */
export type HostModuleRegistry = ModuleRegistry & ModuleRegistryDiagnostics;

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
  | 'relative';

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
  /** Запись, а не голое значение: по её идентичности `dispose` понимает, что слот всё ещё его. */
  interface Entry {
    readonly exports: unknown;
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
    entries.set(specifier, { exports });
  }

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
      return entry === undefined ? undefined : entry.exports;
    },

    register(specifier, exports) {
      if (specifier.trim() === '') {
        throw new ModuleRegistryError('invalid', specifier, 'пустой спецификатор модуля');
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
  };
}
