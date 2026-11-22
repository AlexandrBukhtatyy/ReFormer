/**
 * Настройки — области видимости и одно правило разрешения.
 *
 * Значение одного и того же ключа может лежать в двух местах и быть объявлено ещё в двух:
 *
 * ```text
 * workspace   запись рабочей области   перекрывает всё
 * user        глобальная запись        перекрывает умолчания
 * launch      умолчание запуска        умолчание организации из конфига запуска
 * default     умолчание вклада         последнее слово, если не сказано ничего
 * ```
 *
 * **Почему умолчание запуска — слоем, а не вторым `registerDefault`.** Умолчание ключа объявляет
 * один вклад, и второе объявление бросает. Организация же хочет сказать «наш кит — hexa-ui»
 * про ключ, который объявляет чужой плагин, и сказать ДО его активации. Поэтому её слово —
 * отдельный слой над умолчанием вклада: плагин объявляет своё умолчание как обычно, а действует
 * слово организации, пока человек не выбрал сам. Для человека это тоже умолчание: `scopeOf`
 * отвечает `'default'`, и «вернуть по умолчанию» возвращает к нему.
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
 * Служба настроек: хранилище областей, загрузка кэша и память в тестах.
 *
 * Объявление службы и токен живут в пакете `@reformer/builder-plugin-api`. Здесь — то, что плагину
 * не принадлежит: бэкенд, `hydrate` и правило «область выводится из префикса ключа».
 *
 * @module shell/platform/services/settings
 */

import { toDisposable, type Disposable } from '@reformer/builder-plugin-api/internal';
import { createEventBus } from '@/shell/platform/primitives/event';
import { defineEvent } from '@reformer/builder-plugin-api/internal';
import { type SettingsScope, type SettingsService } from '@reformer/builder-plugin-api/internal';

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
  /**
   * Откуда пришло ДЕЙСТВУЮЩЕЕ значение ключа.
   *
   * Слои без указания источника превращаются в «почему у меня не применяется»: человек правит
   * настройку, она перекрыта проектом, и на экране ничего не меняется. Ответ на этот вопрос
   * знает только кэш, поэтому он и отвечает.
   *
   * `'default'` — умолчание вклада, `undefined` — ключа не знает никто. Не в
   * {@link SettingsService} по той же причине, что и `hydrate`: плагину нужно значение,
   * а происхождение — вопрос того, кто рисует настройки.
   */
  scopeOf(key: string): SettingsScope | 'default' | undefined;
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

/** Событие смены настройки. Полезная нагрузка — ключ, как в контракте `onDidChange`. */
const SettingsDidChange = defineEvent<string>('settings.didChange');

/**
 * Область по умолчанию для ключа: `workspace.*` — рабочая область, всё остальное
 * (`host.*`, `plugin.<id>.*`) — пользовательская.
 *
 * Незнакомый префикс попадает в `user` сознательно: глобальная запись переживает смену
 * рабочей области, поэтому ошибка в имени ключа приводит к «настройка сохранилась не туда»,
 * а не к «настройка исчезла при открытии другого проекта».
 *
 * Два соглашения про плагины, и они РАЗНЫЕ:
 * - `plugin.<id>.*` (область `user`) — встроенные плагины оболочки; живой пример
 *   `plugin.kits.active`. Они есть всегда, и их выбор не принадлежит проекту;
 * - `workspace.plugin.<id>.settings` — плагины КАТАЛОГА (`services/plugin-settings`).
 *   Такой плагин лежит в `.ui_builder/plugins` открытого проекта, и его настройка вне
 *   проекта бессмысленна: «база, настроенная в проекте A» не должна подставиться в проект B.
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
/** Как собрать службу. */
export interface SettingsServiceOptions {
  /**
   * Умолчания запуска — `defaults.settings` конфига лаунчера. Неизменны всё время работы:
   * конфиг запуска читается один раз, до сборки приложения.
   */
  readonly launchDefaults?: Readonly<Record<string, unknown>>;
}

export function createSettingsService(
  backend: SettingsBackend,
  options: SettingsServiceOptions = {}
): HostSettingsService {
  const stores: Record<SettingsScope, Map<string, unknown>> = {
    user: new Map(),
    workspace: new Map(),
  };
  const launch = new Map(
    Object.entries(options.launchDefaults ?? {}).filter(([, value]) => value !== undefined)
  );
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
    if (launch.has(key)) return launch.get(key);
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

    scopeOf(key: string): SettingsScope | 'default' | undefined {
      // Порядок тот же, что у `effective`, и это не совпадение: ответ обязан описывать
      // ровно то значение, которое вернёт `get`.
      if (stores.workspace.has(key)) return 'workspace';
      if (stores.user.has(key)) return 'user';
      // Умолчание запуска для человека — тоже умолчание: выбора он не делал.
      return launch.has(key) || defaults.has(key) ? 'default' : undefined;
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
