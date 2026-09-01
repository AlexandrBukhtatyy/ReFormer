/**
 * Настройки — три области видимости и одно правило разрешения.
 *
 * Значение одного и того же ключа может лежать в двух местах и быть объявлено в третьем:
 *
 * ```text
 * workspace   запись рабочей области   перекрывает всё
 * user        глобальная запись        перекрывает умолчание
 * default     умолчание вклада         последнее слово, если не записано ничего
 * ```
 *
 * **Почему умолчания регистрируются, а не зашиты в вызывающем.** Без реестра умолчаний `get`
 * до первой записи возвращает `undefined`, и каждый потребитель дописывает свой `?? 'system'`.
 * Дальше эти «свои» умолчания разъезжаются (панель настроек показывает одно, потребитель
 * применяет другое), а показать пользователю «сейчас действует значение по умолчанию» вообще
 * нечем. Поэтому умолчание объявляет тот, кто вносит настройку, ровно один раз, и оно
 * снимается вместе с вкладом — плагин выключили, его умолчание ушло.
 *
 * **Почему `get` синхронный, а хранилище асинхронное.** `get` вызывается из отрисовки, и делать
 * его асинхронным означало бы промис на каждый кадр. Поэтому обе области целиком загружаются
 * в память один раз ({@link HostSettingsService.hydrate}), а `get` читает кэш. До загрузки
 * `get` отдаёт умолчание вклада — это правильная деградация: оболочка рисуется сразу и
 * перерисовывается, когда записи пользователя доедут.
 *
 * Хранилище внедряется ({@link SettingsBackend}) и здесь не реализуется: слой IndexedDB —
 * часть рабочей области, у него свой владелец.
 *
 * @module host/services/settings
 */

import { toDisposable, type Disposable } from '../primitives/disposable';
import { createEventBus, defineEvent } from '../primitives/event';
import { defineService } from '../primitives/service';

/** Куда пишется значение. Читается всегда из обеих: `workspace` перекрывает `user`. */
export type SettingsScope = 'user' | 'workspace';

/** Обе области в фиксированном порядке — от слабой к сильной. */
const SCOPES: readonly SettingsScope[] = ['user', 'workspace'];

/**
 * Хранилище настроек. Ровно три операции, потому что больше службе не нужно.
 *
 * Чтение — областью целиком, а не по ключу: `get` синхронный, значит кэш заполняется одним
 * заходом на старте, и поштучное чтение означало бы обращение к хранилищу на каждый ключ,
 * который кто-то однажды спросил.
 */
export interface SettingsBackend {
  /** Все записи области. Отсутствующая область — пустой объект, а не отказ. */
  read(scope: SettingsScope): Promise<Readonly<Record<string, unknown>>>;
  write(scope: SettingsScope, key: string, value: unknown): Promise<void>;
  /** Снятие записи: значение проваливается на слой ниже. */
  remove(scope: SettingsScope, key: string): Promise<void>;
}

/** То, что видит плагин. */
export interface SettingsService {
  /**
   * Действующее значение: `workspace` → `user` → умолчание вклада → `undefined`.
   *
   * Тип не проверяется в рантайме: в хранилище лежит то, что туда положили прошлые версии
   * приложения. Потребитель, для которого чужое значение опасно, обязан его провалидировать —
   * так делает служба темы.
   */
  get<T>(key: string): T | undefined;
  /**
   * Записывает значение. Без `scope` область берётся из префикса ключа
   * ({@link scopeForKey}); явный `scope` позволяет перекрыть глобальную настройку
   * в рабочей области — ради этого слои и существуют.
   *
   * `value === undefined` снимает запись именно этой области, и значение проваливается
   * на слой ниже. Без этого «workspace перекрывает user» было бы дверью в одну сторону:
   * перекрыть можно, вернуться к глобальному значению нельзя.
   *
   * Кэш и подписчики обновляются сразу, до того как хранилище подтвердит запись, — иначе
   * переключатель в интерфейсе ждал бы IndexedDB. Если запись отказала, кэш откатывается,
   * подписчики уведомляются повторно, а отказ пробрасывается вызывающему.
   */
  set<T>(key: string, value: T, scope?: SettingsScope): Promise<void>;
  /**
   * Уведомление о смене **действующего** значения ключа.
   *
   * Запись, перекрытая более сильной областью, уведомления не вызывает: подписчик реагирует
   * на то, что вернёт `get`, а перерисовка ради того же самого значения — просто трата кадра.
   */
  onDidChange(cb: (key: string) => void): Disposable;
  /**
   * Объявляет умолчание вклада. `dispose()` снимает его — вместе с плагином.
   *
   * Повторное объявление того же ключа — ошибка, а не замена: два умолчания на один ключ
   * означают, что действующее значение зависит от порядка активации плагинов, а он ничего
   * не значит.
   */
  registerDefault<T>(key: string, value: T): Disposable;
}

/**
 * Вид службы для Host: та же служба плюс загрузка кэша.
 *
 * `hydrate` не в {@link SettingsService} намеренно — плагин не должен уметь перечитать
 * хранилище посреди работы: это сбросило бы состояние, на которое смотрит вся оболочка,
 * в момент, выбранный кем угодно.
 */
export interface HostSettingsService extends SettingsService {
  /**
   * Загружает обе области в кэш и уведомляет о ключах, чьё действующее значение изменилось.
   *
   * Записи, сделанные до окончания загрузки, не затираются: пользователь мог переключить тему,
   * пока читалось хранилище, и вернуть ему прежнюю было бы откатом уже совершённого действия.
   */
  hydrate(options?: HydrateOptions): Promise<void>;
}

/** Как перечитывать хранилище. */
export interface HydrateOptions {
  /**
   * Области, записи которых эта сессия обязана ЗАБЫТЬ перед перечитыванием.
   *
   * Защита «своё не затирать» существует ради гонки с ПЕРВОЙ загрузкой: значение, которое
   * человек только что выбрал, новее прочитанного. Но когда меняется сама область — открыт
   * другой проект, и `workspace` теперь про него, — прежняя запись говорит уже не о том же
   * самом: удержи её служба, и настройки одного проекта показывались бы в другом. Забыть
   * может только тот, кто подменил хранилище под областью, поэтому это параметр, а не
   * догадка службы.
   */
  readonly forget?: readonly SettingsScope[];
}

export const SettingsServiceToken = defineService<SettingsService>('host.settings');

/** Событие смены настройки. Полезная нагрузка — ключ, как в контракте `onDidChange`. */
const SettingsDidChange = defineEvent<string>('settings.didChange');

/**
 * Область по умолчанию для ключа: `workspace.*` — рабочая область, всё остальное
 * (`host.*`, `plugin.<id>.*`) — пользовательская.
 *
 * Незнакомый префикс попадает в `user` сознательно: глобальная запись переживает смену
 * рабочей области, поэтому ошибка в имени ключа приводит к «настройка сохранилась не туда»,
 * а не к «настройка исчезла при открытии другого проекта».
 */
export function scopeForKey(key: string): SettingsScope {
  return key.startsWith('workspace.') ? 'workspace' : 'user';
}

function assertKey(key: string): void {
  if (key.trim() === '') throw new Error('settings: ключ настройки не может быть пустым');
}

/** Ключ слота «область + ключ» — для учёта локальных записей и порядка записей. */
function slotOf(scope: SettingsScope, key: string): string {
  return `${scope} ${key}`;
}

/**
 * Создаёт службу настроек поверх внедрённого хранилища.
 *
 * Возвращает {@link HostSettingsService}; в реестр сервисов кладётся тот же объект под токеном
 * {@link SettingsServiceToken}, типизированным более узким {@link SettingsService}.
 */
export function createSettingsService(backend: SettingsBackend): HostSettingsService {
  const stores: Record<SettingsScope, Map<string, unknown>> = {
    user: new Map(),
    workspace: new Map(),
  };
  const defaults = new Map<string, unknown>();
  /** Слоты, записанные в этой сессии: их `hydrate` не трогает. */
  const written = new Set<string>();
  /** Номер последней записи слота — чтобы откат неудачной записи не снёс более позднюю. */
  const lastWrite = new Map<string, number>();
  const bus = createEventBus();
  let nextSeq = 0;

  const effective = (key: string): unknown => {
    if (stores.workspace.has(key)) return stores.workspace.get(key);
    if (stores.user.has(key)) return stores.user.get(key);
    return defaults.get(key);
  };

  /**
   * Уведомляет, если действующее значение отличается от снятого до изменения.
   *
   * Сравнение по `Object.is`: значение настройки — это то, что положил вызывающий, и служба
   * не вправе решать, что два разных объекта «одинаковы». Для примитивов (а это подавляющее
   * большинство настроек) сравнение точное.
   */
  const notifyIfChanged = (key: string, before: unknown): void => {
    if (!Object.is(before, effective(key))) bus.emit(SettingsDidChange, key);
  };

  return {
    get<T>(key: string): T | undefined {
      // Единственное приведение: в кэше лежит `unknown`, типом ключа служба не располагает.
      return effective(key) as T | undefined;
    },

    async set<T>(key: string, value: T, scope: SettingsScope = scopeForKey(key)): Promise<void> {
      assertKey(key);
      const store = stores[scope];
      const slot = slotOf(scope, key);
      const before = effective(key);
      const hadPrevious = store.has(key);
      const previous = store.get(key);

      if (value === undefined) store.delete(key);
      else store.set(key, value);
      written.add(slot);
      const seq = ++nextSeq;
      lastWrite.set(slot, seq);
      notifyIfChanged(key, before);

      try {
        if (value === undefined) await backend.remove(scope, key);
        else await backend.write(scope, key, value);
      } catch (error) {
        // Откат только если наша запись всё ещё последняя: иначе он вернул бы значение,
        // которое пользователь успел заменить, пока хранилище думало.
        if (lastWrite.get(slot) === seq) {
          const beforeRollback = effective(key);
          if (hadPrevious) store.set(key, previous);
          else store.delete(key);
          notifyIfChanged(key, beforeRollback);
        }
        throw error;
      }
    },

    onDidChange(cb: (key: string) => void): Disposable {
      return bus.on(SettingsDidChange, cb);
    },

    registerDefault<T>(key: string, value: T): Disposable {
      assertKey(key);
      if (defaults.has(key)) {
        throw new Error(
          `settings: умолчание для «${key}» уже объявлено. Один ключ — одно умолчание: ` +
            'иначе действующее значение зависело бы от порядка активации плагинов'
        );
      }
      const before = effective(key);
      defaults.set(key, value);
      notifyIfChanged(key, before);

      return toDisposable(() => {
        const beforeRemoval = effective(key);
        defaults.delete(key);
        notifyIfChanged(key, beforeRemoval);
      });
    },

    async hydrate(options?: HydrateOptions): Promise<void> {
      for (const scope of options?.forget ?? []) {
        // По самому набору записанного, а не по ключам кэша: СНЯТИЕ значения тоже запись,
        // а снятый ключ в кэше не лежит — обход кэша пропустил бы его, и удаление в одном
        // проекте переехало бы в другой.
        // Префикс берётся у самой `slotOf`, а не собирается заново: разделитель слота —
        // её тайна, и вторая его запись разошлась бы с первой на первом же изменении.
        const prefix = slotOf(scope, '');
        for (const slot of [...written]) {
          if (!slot.startsWith(prefix)) continue;
          written.delete(slot);
          // Отметка «изменено позже» гасит откат ещё летящей записи прежней области: вернуть
          // её значение теперь значило бы приписать его новой области.
          lastWrite.set(slot, ++nextSeq);
        }
      }
      const [user, workspace] = await Promise.all([
        backend.read('user'),
        backend.read('workspace'),
      ]);
      const incoming: Record<SettingsScope, Readonly<Record<string, unknown>>> = {
        user,
        workspace,
      };

      // Снимаем «до» по объединению ключей: исчезнувший из хранилища ключ — тоже изменение.
      const touched = new Set<string>();
      for (const scope of SCOPES) {
        for (const key of Object.keys(incoming[scope])) touched.add(key);
        for (const key of stores[scope].keys()) touched.add(key);
      }
      const before = new Map<string, unknown>();
      for (const key of touched) before.set(key, effective(key));

      for (const scope of SCOPES) {
        const store = stores[scope];
        for (const key of [...store.keys()]) {
          if (!written.has(slotOf(scope, key))) store.delete(key);
        }
        for (const [key, value] of Object.entries(incoming[scope])) {
          // `undefined` в хранилище — это «записи нет»: иначе такой ключ перекрывал бы
          // слой ниже пустотой.
          if (value === undefined) continue;
          if (written.has(slotOf(scope, key))) continue;
          store.set(key, value);
        }
      }

      for (const key of touched) notifyIfChanged(key, before.get(key));
    },
  };
}

/**
 * Хранилище в памяти — для тестов и для запуска без слоя IndexedDB.
 *
 * Существует, чтобы служба была полезна до появления настоящего хранилища: без него
 * оболочка на Э5 не смогла бы даже переключить тему.
 */
export function createInMemorySettingsBackend(
  seed: Partial<Record<SettingsScope, Readonly<Record<string, unknown>>>> = {}
): SettingsBackend {
  const data: Record<SettingsScope, Map<string, unknown>> = {
    user: new Map(Object.entries(seed.user ?? {})),
    workspace: new Map(Object.entries(seed.workspace ?? {})),
  };

  return {
    read(scope: SettingsScope): Promise<Readonly<Record<string, unknown>>> {
      return Promise.resolve(Object.fromEntries(data[scope]));
    },
    write(scope: SettingsScope, key: string, value: unknown): Promise<void> {
      data[scope].set(key, value);
      return Promise.resolve();
    },
    remove(scope: SettingsScope, key: string): Promise<void> {
      data[scope].delete(key);
      return Promise.resolve();
    },
  };
}
