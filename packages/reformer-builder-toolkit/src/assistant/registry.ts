/**
 * Реестр инструментов ассистента: единственная точка, через которую вызываются операции модели.
 *
 * Реестр берёт на себя ровно то, что иначе пришлось бы дублировать в каждом инструменте и в каждом
 * будущем адаптере: резолв имени, валидацию аргументов против `inputSchema`, бюджет ответа и
 * защиту от исключений. Инструмент остаётся чистой функцией над схемой.
 *
 * Адаптеронезависимость сознательная: реестр ничего не знает о том, кто его вызвал — панель чата,
 * тест или (в будущем) внешний агент. Появление второго потребителя не потребует его правок.
 *
 * ## Типы — структурные
 *
 * Инструмент и его ответ описаны ровно в том объёме, который нужен реестру: имя, описание, схема
 * аргументов, `run` и `{ ok, text, error }`. Реестр собирают и общий ассистент, и стек форм со
 * своими инструментами (их ответ шире — черновик схемы, правила); параметр `O` сохраняет этот
 * ответ в типе `invoke`, а контракта SDK реестру не нужно вовсе.
 *
 * ## Движок проверки аргументов грузится по требованию
 *
 * `ajv` стоит ~140 кБ raw в ГЛАВНОМ чанке, и платили за них все — включая тех, кто ассистента
 * ни разу не открыл. Причём цена двойная: пока на `ajv` есть хоть одна статическая ссылка,
 * rollup не может вынести в отдельный чанк и проверку по мета-схеме (`renderer-json/validate`),
 * которую оба её потребителя заказывают динамически. Vite говорит об этом прямым
 * предупреждением, а замер контролируемым A/B подтвердил число.
 *
 * Поэтому движок приходит {@link ToolRegistryOptions.loadAjv} и заказывается
 * {@link ToolRegistry.prepare} — тем же приёмом и по той же причине, что и проверка по мета-схеме
 * у гейта стека: «когда его грузить» решает ВЛАДЕЛЕЦ, а не проверка. Владелец здесь — плагин
 * ассистента: он заказывает загрузку при активации, задолго до того, как человек наберёт первую
 * строку.
 *
 * Ячейка загрузки живёт в замыкании реестра, а не на уровне модуля. Модульный синглтон означал
 * бы, что два реестра (тест и приложение, два окна) делят одну загрузку, и порядок тестов
 * начинает влиять на их результат — ровно та болезнь, от которой в v2 избавлены каталог кита
 * и отложенная проверка валидатора схемы.
 *
 * @module @reformer/builder-toolkit/assistant/registry
 */

import type { ValidateFunction } from 'ajv';
import { similarNames } from './suggest';

/**
 * Бюджет текста ответа инструмента (символы). Ограничение не протокольное, а экономическое:
 * ответ инструмента уходит в контекст модели на КАЖДОМ шаге хода, поэтому дайджест обязан быть
 * дешевле полного JSON. Реестр обрезает превышение; у инструмента, отдающего данные, свой бюджет
 * ({@link RegistryTool.textBudget}).
 */
export const TOOL_TEXT_BUDGET = 1500;

/** Ответ инструмента в объёме, нужном реестру. */
export interface RegistryOutcome {
  ok: boolean;
  /** Текст для модели. Реестр обрезает его до бюджета. */
  text: string;
  error?: { code: string; message: string; suggestions?: string[] };
}

/** Инструмент в объёме, нужном реестру. `C` — контекст вызова, `O` — его ответ. */
export interface RegistryTool<C = unknown, O extends RegistryOutcome = RegistryOutcome> {
  readonly name: string;
  readonly description: string;
  /** JSON Schema аргументов. */
  readonly inputSchema: object;
  readonly readOnly: boolean;
  /** Ждёт человека — сторож тишины канала на это время стоит. */
  readonly interactive?: true;
  /** Свой бюджет ответа вместо {@link TOOL_TEXT_BUDGET}. */
  readonly textBudget?: number;
  run(params: never, ctx: C): O | Promise<O>;
}

/**
 * Отказ реестра — ответ того же вида, что у инструмента. `O` только добавляет к нему поля, поэтому
 * приведение честное: отказ их просто не заполняет.
 */
function refuse<O extends RegistryOutcome>(
  code: 'UNKNOWN_TOOL' | 'INVALID_PARAMS' | 'TOOL_FAILED',
  message: string,
  suggestions?: string[]
): O {
  return {
    ok: false,
    text: suggestions?.length ? `${message} Did you mean: ${suggestions.join(', ')}.` : message,
    error: { code, message, ...(suggestions?.length ? { suggestions } : {}) },
  } as O;
}

/**
 * Модуль движка проверки. Тип берётся у самого модуля, а не переписывается структурно:
 * `import type` стирается на сборке, поэтому стоит ноль байт и ничего за собой не тянет,
 * а копия сигнатуры разъехалась бы с оригиналом на первом же его изменении.
 */
type AjvModule = typeof import('ajv');

/** Настройки реестра. */
export interface ToolRegistryOptions {
  /**
   * Чем грузить движок проверки аргументов. Подменяется в тестах — и чтобы не тянуть
   * настоящий модуль, и чтобы проверить поведение при отказе загрузки.
   */
  readonly loadAjv?: () => Promise<AjvModule>;
}

/**
 * Реестр инструментов.
 *
 * `C` — контекст вызова, `O` — ответ инструментов: реестр стека держит свой, более широкий.
 */
export interface ToolRegistry<C = unknown, O extends RegistryOutcome = RegistryOutcome> {
  /** Инструменты, опционально отфильтрованные по признаку read-only. */
  list(filter?: { readOnly?: boolean }): readonly RegistryTool<C, O>[];
  get(name: string): RegistryTool<C, O> | undefined;
  /**
   * Заказать движок проверки аргументов. Идемпотентно и НИКОГДА не отвергается.
   *
   * Зовёт владелец — плагин при активации. Отказ здесь не пробрасывается по той же причине,
   * по которой `activate` не держит на себе сеть: не загрузившийся движок — это не сбой
   * запуска, а состояние, о котором скажет первый же вызов инструмента. Неудача при этом
   * НЕ запоминается: следующий вызов попробует снова, и повтор случается на действие
   * человека, а не по таймеру.
   */
  prepare(): Promise<void>;
  /**
   * Вызвать инструмент. Никогда не бросает — ошибка возвращается ответом.
   *
   * Всегда промис, даже когда инструмент синхронный: иначе тип был бы объединением, и каждый
   * вызывающий разбирался бы, что ему пришло. Синхронные инструменты от этого не становятся
   * медленнее — промис разрешается в том же тике.
   */
  invoke(name: string, params: unknown, ctx: C): Promise<O>;
}

/**
 * Обрезать текст до бюджета, обозначив факт обрезки.
 *
 * Суффикс идёт С НОВОЙ СТРОКИ: обрезка режет по символам и может разорвать JSON Pointer пополам,
 * а приклеенный к обрубку суффикс превращал его в правдоподобный, но несуществующий адрес — модель
 * шла по нему и сжигала шаг на `STALE_POINTER`. Перевод строки отделяет мусор от текста явно.
 */
function clamp(text: string, budget: number): string {
  if (text.length <= budget) return text;
  const suffix = '\n… (response truncated)';
  return `${text.slice(0, Math.max(0, budget - suffix.length))}${suffix}`;
}

/** ajv-ошибки → одна человекочитаемая строка. */
function formatErrors(validate: ValidateFunction): string {
  const parts = (validate.errors ?? []).map((e) =>
    `${e.instancePath || '/'} ${e.message ?? 'invalid'}`.trim()
  );
  return parts.length ? parts.join('; ') : 'arguments do not match the schema';
}

/**
 * Собрать реестр.
 *
 * @param tools - Инструменты; имена обязаны быть уникальными.
 * @param options - Чем грузить движок проверки; см. {@link ToolRegistryOptions}.
 * @throws Если имя инструмента повторяется — это ошибка сборки, а не рантайма.
 */
export function createToolRegistry<C = unknown, O extends RegistryOutcome = RegistryOutcome>(
  tools: readonly RegistryTool<C, O>[],
  options: ToolRegistryOptions = {}
): ToolRegistry<C, O> {
  const loadAjv = options.loadAjv ?? ((): Promise<AjvModule> => import('ajv'));
  const byName = new Map<string, RegistryTool<C, O>>();
  for (const tool of tools) {
    if (byName.has(tool.name)) {
      throw new Error(`createToolRegistry: инструмент "${tool.name}" объявлен дважды`);
    }
    byName.set(tool.name, tool);
  }

  /** Компилятор схем: движок, поднятый один раз. */
  type Compile = (schema: object) => ValidateFunction;

  /**
   * Запомненная загрузка. Промис запоминается ЦЕЛИКОМ, а не его результат: параллельные
   * заказы (активация и первый ход, случившийся раньше её завершения) обязаны дождаться
   * одной и той же загрузки, а не завести вторую. Отказ ячейку освобождает — см. `prepare`.
   */
  let started: Promise<Compile> | undefined;
  const compiler = (): Promise<Compile> => {
    started ??= loadAjv().then(
      ({ default: AjvCtor }) => {
        const ajv = new AjvCtor({ allErrors: true, strict: false });
        return (schema: object): ValidateFunction => ajv.compile(schema);
      },
      (error: unknown) => {
        started = undefined;
        throw error;
      }
    );
    return started;
  };

  // Компиляция ленивая и кэшируется: схемы статичны, а ajv-компиляция заметно дороже вызова.
  const validators = new Map<string, ValidateFunction>();
  const validatorFor = async (tool: RegistryTool<C, O>): Promise<ValidateFunction> => {
    const known = validators.get(tool.name);
    if (known !== undefined) return known;
    const compile = await compiler();
    // Гонка двух вызовов одного инструмента компилирует схему дважды и кладёт вторую —
    // это трата такта, а не расхождение: схема одна и результат тот же.
    const built = compile(tool.inputSchema);
    validators.set(tool.name, built);
    return built;
  };

  return {
    list(filter) {
      const all = [...byName.values()];
      return filter?.readOnly === undefined
        ? all
        : all.filter((t) => t.readOnly === filter.readOnly);
    },

    get(name) {
      return byName.get(name);
    },

    prepare() {
      return compiler().then(
        () => undefined,
        (error: unknown) => {
          console.warn('[assistant] движок проверки аргументов не загрузился', error);
        }
      );
    },

    async invoke(name, params, ctx) {
      const tool = byName.get(name);
      if (!tool) {
        return refuse<O>(
          'UNKNOWN_TOOL',
          `No tool named "${name}".`,
          similarNames(name, [...byName.keys()])
        );
      }

      let validate: ValidateFunction;
      try {
        validate = await validatorFor(tool);
      } catch (e) {
        // Барьер, который не смог проверить, ОТКАЗЫВАЕТ, а не пропускает: молча пропущенный
        // аргумент — это отказ, неотличимый от успеха, и он приземлился бы правкой формы.
        // Код тот же, что у упавшего инструмента: цикл продолжается, модель пробует снова,
        // а повтор заново заказывает загрузку — ячейка отказ не запомнила.
        const message = e instanceof Error ? e.message : String(e);
        return refuse<O>(
          'TOOL_FAILED',
          `Argument validation for ${name} is unavailable: ${message}. The tool was not called.`
        );
      }

      // ajv не любит undefined на входе, а инструменты без обязательных полей вызываются без них.
      const args = params ?? {};
      if (!validate(args)) {
        return refuse<O>(
          'INVALID_PARAMS',
          `Invalid arguments for ${name}: ${formatErrors(validate)}.`
        );
      }

      let outcome: O;
      try {
        // `await` покрывает оба вида инструментов: синхронный вернёт значение, и оно разрешится
        // в том же тике. Отдельной ветки для промиса не нужно — она отличалась бы только тем,
        // что в ней легче забыть про `catch`.
        outcome = await tool.run(args as never, ctx);
      } catch (e) {
        // Исключение инструмента не должно ронять ход агента: модель получит ошибку и попробует иначе.
        const message = e instanceof Error ? e.message : String(e);
        return refuse<O>('TOOL_FAILED', `Tool ${name} failed: ${message}`);
      }
      return { ...outcome, text: clamp(outcome.text, tool.textBudget ?? TOOL_TEXT_BUDGET) };
    },
  };
}
