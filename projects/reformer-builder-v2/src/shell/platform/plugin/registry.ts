/**
 * Рантайм плагинов: регистрация набора, активация, деактивация, перезагрузка одного.
 *
 * Реестр отвечает ровно за жизненный цикл. Он не знает, что именно плагин регистрирует,
 * и знать не должен: связь с платформой целиком проходит через {@link PluginContext},
 * который собирает `host/plugin/context`.
 *
 * ## Три правила, на которых стоит модуль
 *
 * **`activate` синхронный и только регистрирует.** Обоснование — в `host/plugin/types`.
 * Здесь важно следствие: активация набора завершается за один синхронный проход, и сразу
 * после него набор вкладов полон. Оболочка отрисовывается по определённому состоянию,
 * а не по тому, что успело зарегистрироваться.
 *
 * **Порядок активации ничего не значит.** Реестр не строит граф зависимостей и не сортирует
 * плагины: сервис ищется в момент использования, а не активации. Правило приёмки — активация
 * в обратном порядке даёт то же поведение — проверено тестом.
 *
 * **Падение одного плагина не мешает остальным.** Каждая активация обёрнута; сбой не прерывает
 * цикл; упавший помечается отказавшим с идентификатором и текстом исключения.
 *
 * ## Почему нет автоповтора
 *
 * Соблазн «попробуем ещё раз» здесь стоит дорого: плагин, падающий по внешней причине,
 * ронял бы запуск снова и снова, и каждая попытка тратила бы время до появления интерфейса.
 * Поэтому {@link PluginRegistry.activateAll} отказавших **пропускает**. Повторная попытка —
 * действие человека: явный {@link PluginRegistry.activate} или {@link PluginRegistry.reload}
 * состояние отказа сбрасывают и пробуют заново. Разница между «система пробует сама»
 * и «попросили ещё раз» здесь и есть вся политика.
 *
 * ## Почему неудачная активация откатывается
 *
 * Плагин, упавший на середине `activate`, уже успел что-то зарегистрировать. Оставить это
 * означало бы половину панели без второй половины и команду, которая зовёт неготовый код, —
 * состояние, которого нет ни в одном сценарии и под которое никто не писал. Поэтому
 * `subscriptions` неудачной активации освобождаются сразу. Всё, что плагин зарегистрировал
 * **мимо** `subscriptions`, останется: рантайм не знает, что именно тот сделал, — и это ещё
 * одна причина класть регистрации в `subscriptions`, а не «прибираться потом».
 *
 * @module shell/platform/plugin/registry
 */

import { disposeAll } from '@/shell/platform/primitives/disposable';
import { createPluginContext } from './context';
import type { PluginContextDeps } from './context';
import { createSecretSessionStore } from './storage';
import type { SecretSessionStore } from './storage';
import type { Plugin, PluginContext } from './types';

/**
 * Состояние плагина в реестре.
 *
 * - `inactive` — зарегистрирован, но не активирован (или деактивирован);
 * - `active` — активация прошла, вклады на месте;
 * - `failed` — `activate` бросил; вклады откачены; автоматические циклы его пропускают.
 */
export type PluginState = 'inactive' | 'active' | 'failed';

/** Где именно упал плагин. Различение нужно, чтобы диагностика не сваливалась в одну кучу. */
export type PluginFailurePhase = 'activate' | 'deactivate' | 'dispose';

/**
 * Отказ плагина.
 *
 * `message` — текст исключения для человека и для списка плагинов; `error` — исходное значение
 * целиком, потому что по тексту причину не всегда видно, а `cause` и стек нужны в отладке.
 */
export interface PluginFailure {
  readonly pluginId: string;
  readonly phase: PluginFailurePhase;
  readonly message: string;
  readonly error: unknown;
}

/** Снимок состояния одного плагина. Ровно то, что показывает список плагинов. */
export interface PluginStatus {
  readonly id: string;
  readonly state: PluginState;
  /** Есть только у `failed`: почему не поднялся. */
  readonly failure?: PluginFailure;
}

/** Чем закончился один проход активации. Про **этот** вызов, а не про историю. */
export interface PluginActivationReport {
  readonly activated: readonly string[];
  readonly failed: readonly PluginFailure[];
  /** Пропущенные: уже активные и ранее отказавшие — их автоповтор не трогает. */
  readonly skipped: readonly string[];
}

/**
 * Платформа плюс настройки рантайма.
 *
 * `secrets` необязателен: память сессии — деталь рантайма, а не выбор композиции, и по
 * умолчанию реестр заводит её сам. Внедрение нужно тестам и тому случаю, когда двум рантаймам
 * положено видеть одни и те же сеансовые секреты.
 */
export interface PluginRuntimeDeps extends Omit<PluginContextDeps, 'secrets'> {
  readonly secrets?: SecretSessionStore;
  /**
   * Куда сообщать об отказе плагина. По умолчанию — `console.error`.
   *
   * Тот же канал и та же причина, что у шины событий и реестра команд: чужая поломка не должна
   * ни ронять запуск, ни исчезать бесследно. Host позже направит его в уведомления.
   */
  readonly onError?: (failure: PluginFailure) => void;
}

export interface PluginRegistry {
  /**
   * Добавляет плагин в набор, **не активируя** его.
   *
   * Повторная регистрация того же `id` — ошибка, а не замена: иначе действующая реализация
   * зависела бы от порядка в списке, а список плагинов перестал бы отвечать на вопрос
   * «из чего собрано приложение». Для замены есть {@link reload}.
   */
  register(plugin: Plugin): void;
  /** То же для набора. Порядок в массиве на поведение не влияет — см. правило выше. */
  registerAll(plugins: readonly Plugin[]): void;

  /**
   * Активирует один плагин. `true` — поднялся (или уже был активен).
   *
   * Отказавшему даёт новую попытку: это явное действие, а не автоповтор.
   *
   * @throws если плагин с таким `id` не зарегистрирован — это ошибка вызывающего,
   * а не штатная деградация.
   */
  activate(id: string): boolean;

  /**
   * Активирует всё, что зарегистрировано и ещё не активно, в порядке регистрации.
   *
   * Отказавших пропускает (автоповтора нет). Исключение плагина наружу не выходит.
   */
  activateAll(): PluginActivationReport;

  /**
   * Деактивирует плагин: сначала его `deactivate`, затем освобождение `subscriptions`.
   *
   * Для неактивного — ничего не делает. `@throws` для незарегистрированного, по той же
   * причине, что и {@link activate}.
   */
  deactivate(id: string): void;

  /** Деактивирует все активные, в порядке, обратном активации. Для завершения работы и тестов. */
  deactivateAll(): void;

  /**
   * Перезагружает плагин: деактивация, затем активация заново, с новым контекстом.
   *
   * `replacement` подставляет другой экземпляр под тем же `id` — это то, что делает команда
   * «перезагрузить плагин» для плагина из каталога проекта: файл перечитан, объект новый,
   * идентификатор прежний. Без него перезагружается тот же экземпляр.
   */
  reload(id: string, replacement?: Plugin): boolean;

  isActive(id: string): boolean;
  /** `undefined` — плагин не зарегистрирован. */
  status(id: string): PluginStatus | undefined;
  /** Все известные плагины в порядке регистрации. */
  statuses(): readonly PluginStatus[];
  /** Только отказавшие. Пустой массив — все поднялись. */
  failures(): readonly PluginFailure[];
}

interface PluginRecord {
  plugin: Plugin;
  state: PluginState;
  failure?: PluginFailure;
  /** Контекст текущей активации. `undefined` у неактивного — контекст живёт не дольше её. */
  context?: PluginContext;
}

/**
 * Текст исключения для списка плагинов.
 *
 * Бросить можно чем угодно, включая строку и `undefined`; `String(error)` на объекте без
 * `message` даёт «[object Object]», что в списке плагинов не значит ничего. Поэтому `Error`
 * разбирается отдельно.
 */
function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function defaultOnError(failure: PluginFailure): void {
  console.error(`[plugin] «${failure.pluginId}»: отказ в ${failure.phase}`, failure.error);
}

export function createPluginRegistry(deps: PluginRuntimeDeps): PluginRegistry {
  const onError = deps.onError ?? defaultOnError;
  const contextDeps: PluginContextDeps = {
    services: deps.services,
    extensions: deps.extensions,
    commands: deps.commands,
    events: deps.events,
    storage: deps.storage,
    secrets: deps.secrets ?? createSecretSessionStore(),
  };

  // Map сохраняет порядок вставки — это и есть «порядок регистрации» в отчётах и статусах.
  // На поведение он не влияет (см. правило о порядке), но делает вывод воспроизводимым.
  const records = new Map<string, PluginRecord>();
  /** Порядок фактической активации: деактивация идёт по нему в обратную сторону. */
  const activationOrder: string[] = [];

  const requireRecord = (id: string, where: string): PluginRecord => {
    const record = records.get(id);
    if (record === undefined) {
      throw new Error(`${where}: плагин «${id}» не зарегистрирован`);
    }
    return record;
  };

  const report = (failure: PluginFailure): void => {
    // Канал сообщений — чужой код: он тоже может упасть, и тогда падение диагностики
    // подменило бы собой исходный отказ. Здесь это уже некому обработать, поэтому молчим.
    try {
      onError(failure);
    } catch {
      /* отказ канала диагностики не должен превращаться в отказ рантайма */
    }
  };

  /** Освобождает подписки активации. Ошибка внутри не отменяет ни отката, ни деактивации. */
  const releaseSubscriptions = (record: PluginRecord, phase: PluginFailurePhase): void => {
    const context = record.context;
    if (context === undefined) return;
    try {
      disposeAll(context.subscriptions);
    } catch (error) {
      report({
        pluginId: record.plugin.id,
        phase,
        message: describeError(error),
        error,
      });
    }
    // Чистим в любом случае: контекст этой активации больше не действителен, и повторное
    // освобождение уже снятого — лишняя работа, а при неидемпотентном dispose ещё и вред.
    context.subscriptions.length = 0;
    record.context = undefined;
  };

  const activateRecord = (record: PluginRecord): boolean => {
    if (record.state === 'active') return true;

    const context = createPluginContext(record.plugin.id, contextDeps);
    record.context = context;

    try {
      record.plugin.activate(context);
    } catch (error) {
      const failure: PluginFailure = {
        pluginId: record.plugin.id,
        phase: 'activate',
        message: describeError(error),
        error,
      };
      // Откат до пометки об отказе: к моменту, когда кто-то увидит статус `failed`,
      // вклады половинчатой активации уже сняты.
      releaseSubscriptions(record, 'dispose');
      record.state = 'failed';
      record.failure = failure;
      report(failure);
      return false;
    }

    record.state = 'active';
    record.failure = undefined;
    activationOrder.push(record.plugin.id);
    return true;
  };

  const deactivateRecord = (record: PluginRecord): void => {
    if (record.state !== 'active') return;

    try {
      record.plugin.deactivate?.();
    } catch (error) {
      // Вклады снимаем всё равно: плагин, не сумевший закрыться чисто, тем более не должен
      // остаться в реестрах — иначе одна ошибка в `deactivate` навсегда прибивает панель.
      report({
        pluginId: record.plugin.id,
        phase: 'deactivate',
        message: describeError(error),
        error,
      });
    }

    releaseSubscriptions(record, 'dispose');
    // Состояние после деактивации — `inactive`, даже если `deactivate` бросил: плагин выключен,
    // а пометка `failed` без нужды запретила бы автоматическую активацию в следующий раз.
    record.state = 'inactive';
    record.failure = undefined;

    const index = activationOrder.indexOf(record.plugin.id);
    if (index >= 0) activationOrder.splice(index, 1);
  };

  const statusOf = (record: PluginRecord): PluginStatus =>
    record.failure === undefined
      ? { id: record.plugin.id, state: record.state }
      : { id: record.plugin.id, state: record.state, failure: record.failure };

  // Отдельная функция, а не метод возвращаемого объекта: registerAll зовёт её напрямую,
  // и реестр остаётся работоспособным после деструктуризации (`const { register } = registry`).
  const register = (plugin: Plugin): void => {
    if (plugin.id.trim() === '') {
      throw new Error('PluginRegistry.register: идентификатор плагина не может быть пустым');
    }
    if (records.has(plugin.id)) {
      throw new Error(
        `PluginRegistry.register: плагин «${plugin.id}» уже зарегистрирован. ` +
          'Молчаливая замена сделала бы состав приложения зависимым от порядка в списке; ' +
          'чтобы поднять другой экземпляр под тем же именем, используйте reload'
      );
    }
    records.set(plugin.id, { plugin, state: 'inactive' });
  };

  return {
    register,

    registerAll(plugins: readonly Plugin[]): void {
      for (const plugin of plugins) register(plugin);
    },

    activate(id: string): boolean {
      const record = requireRecord(id, 'PluginRegistry.activate');
      // Явная активация отказавшего — новая попытка по просьбе человека, а не автоповтор.
      if (record.state === 'failed') record.state = 'inactive';
      return activateRecord(record);
    },

    activateAll(): PluginActivationReport {
      const activated: string[] = [];
      const failed: PluginFailure[] = [];
      const skipped: string[] = [];

      for (const record of records.values()) {
        if (record.state === 'active' || record.state === 'failed') {
          skipped.push(record.plugin.id);
          continue;
        }
        if (activateRecord(record)) activated.push(record.plugin.id);
        else if (record.failure !== undefined) failed.push(record.failure);
      }

      return { activated, failed, skipped };
    },

    deactivate(id: string): void {
      deactivateRecord(requireRecord(id, 'PluginRegistry.deactivate'));
    },

    deactivateAll(): void {
      // Обратный порядок активации — не требование контракта (зависимостей по порядку нет),
      // а свойство, которого стоит держаться: выключение зеркалит включение, и если чей-то
      // `deactivate` всё же трогает соседа, он застаёт его ещё живым.
      for (const id of [...activationOrder].reverse()) {
        const record = records.get(id);
        if (record !== undefined) deactivateRecord(record);
      }
    },

    reload(id: string, replacement?: Plugin): boolean {
      const record = requireRecord(id, 'PluginRegistry.reload');
      if (replacement !== undefined && replacement.id !== id) {
        throw new Error(
          `PluginRegistry.reload: подменяющий плагин объявлен как «${replacement.id}», ` +
            `а перезагружается «${id}». Идентификатор — ключ во всех реестрах, менять его ` +
            'перезагрузкой нельзя'
        );
      }

      deactivateRecord(record);
      if (replacement !== undefined) record.plugin = replacement;
      // Перезагрузка — тоже явное действие: отказ прошлой попытки её не блокирует.
      record.state = 'inactive';
      record.failure = undefined;
      return activateRecord(record);
    },

    isActive(id: string): boolean {
      return records.get(id)?.state === 'active';
    },

    status(id: string): PluginStatus | undefined {
      const record = records.get(id);
      return record === undefined ? undefined : statusOf(record);
    },

    statuses(): readonly PluginStatus[] {
      return [...records.values()].map(statusOf);
    },

    failures(): readonly PluginFailure[] {
      const result: PluginFailure[] = [];
      for (const record of records.values()) {
        if (record.failure !== undefined) result.push(record.failure);
      }
      return result;
    },
  };
}
