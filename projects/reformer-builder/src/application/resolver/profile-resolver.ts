/**
 * Профиль → список плагинов: наследование, склейка, переопределения запуска.
 *
 * Резолвер чистый: на входе профиль, способ найти его основу и множество известных имён,
 * на выходе — порядок идентификаторов. Ни одной фабрики он не видит и видеть не должен;
 * `composer/compose` подставляет ему ключи карты встроенных, а он отвечает, кого из них
 * собирать. Из-за этого его тест поднимается за миллисекунды и не тянет за собой ни одного
 * плагина — а значит, проверять в нём можно то, что в собранном приложении не проверишь:
 * круг наследования, опечатку в имени, порядок склейки.
 *
 * ## Отказ, а не тихий пропуск
 *
 * Неизвестное имя — исключение, и это главное решение модуля. Пропусти резолвер опечатку
 * молча, «профиль без ассистента» и «профиль с опечаткой в слове ai» стали бы одним и тем же
 * приложением, и отличить их можно было бы только по отсутствующей панели. Цена решения —
 * запуск обязан ловить исключение сам: имя в конфиге пишет человек, и падать из-за его
 * опечатки инструмент не вправе (см. `application/builder-application`).
 *
 * То же и с кругом `extends`: обход по именам без проверки просто зациклился бы, то есть
 * дал бы белый экран без единого слова о причине.
 *
 * @module application/resolver/profile-resolver
 */

import type { ApplicationProfile } from '../profiles/profile';

/**
 * Переопределения состава уровня запуска.
 *
 * Не профиль и не его часть: профиль — это решение о приложении, а переопределения —
 * разовая поправка того, кто его запускает («мне сегодня без ассистента»). Поэтому они
 * приходят отдельным аргументом и применяются ПОСЛЕ склейки всей цепочки наследования.
 */
export interface PluginOverrides {
  /** Добавить к составу профиля. Уже входящий в него плагин не удваивается. */
  readonly enable?: readonly string[];
  /**
   * Убрать из состава. СИЛЬНЕЕ `enable`: плагин, названный в обоих списках, выключен.
   *
   * Решение в пользу предсказуемости, а не в пользу «последнего слова»: два списка приходят
   * из одного объекта конфига, где порядка полей нет. Правило «выключение сильнее» даёт
   * один и тот же состав независимо от того, как JSON лёг в память.
   */
  readonly disable?: readonly string[];
}

export interface ResolveProfileOptions {
  /** Профиль, который разрешаем. */
  readonly profile: ApplicationProfile;
  /**
   * Поиск основы для `extends`. Отсутствие поиска — законный случай: профиль без наследования
   * разрешается и без реестра, а профиль с ним получит внятный отказ про неизвестную основу.
   */
  readonly lookup?: (id: string) => ApplicationProfile | undefined;
  /** Известные плагины — ключи карты встроенных. Всё, чего здесь нет, отвергается по имени. */
  readonly known: Iterable<string>;
  /** Поправки уровня запуска. */
  readonly overrides?: PluginOverrides;
}

/**
 * Разворачивает профиль в порядок идентификаторов.
 *
 * Порядок: основа (самая дальняя — первой), затем свои, затем `enable`. Дубликаты убираются
 * по ПЕРВОМУ вхождению — иначе плагин, названный и в основе, и в наследнике, переезжал бы
 * в конец списка при каждом наследовании, и порядок состава зависел бы от глубины цепочки.
 *
 * @throws Error на неизвестный плагин, неизвестную основу или круг в `extends` — с именем
 * виновника в сообщении.
 */
export function resolveProfile(options: ResolveProfileOptions): readonly string[] {
  const known = new Set(options.known);
  const chain = inheritanceChain(options.profile, options.lookup);

  const ordered: string[] = [];
  const require = (id: string, where: string): void => {
    if (!known.has(id)) {
      throw new Error(
        `${where}: неизвестный плагин «${id}». Известны: ${[...known].sort().join(', ')}`
      );
    }
  };

  for (const profile of chain) {
    for (const id of profile.plugins) {
      require(id, `профиль «${profile.id}»`);
      if (!ordered.includes(id)) ordered.push(id);
    }
  }
  for (const id of options.overrides?.enable ?? []) {
    require(id, 'plugins.enable');
    if (!ordered.includes(id)) ordered.push(id);
  }

  const disabled = new Set<string>();
  for (const id of options.overrides?.disable ?? []) {
    require(id, 'plugins.disable');
    disabled.add(id);
  }

  return Object.freeze(ordered.filter((id) => !disabled.has(id)));
}

/**
 * Цепочка наследования от самой дальней основы к самому профилю.
 *
 * Круг ищется списком пройденных, а не множеством: множество ответило бы «круг есть»,
 * а список отвечает «вот он» — `a → b → a`. Читать это будет человек, у которого профиль
 * не собрался, и одного слова «круг» ему не хватит.
 */
function inheritanceChain(
  profile: ApplicationProfile,
  lookup: ((id: string) => ApplicationProfile | undefined) | undefined
): readonly ApplicationProfile[] {
  const chain: ApplicationProfile[] = [];
  const visited: string[] = [];
  let current = profile;
  for (;;) {
    if (visited.includes(current.id)) {
      throw new Error(
        `профиль «${profile.id}»: круг наследования ${[...visited, current.id].join(' → ')}`
      );
    }
    visited.push(current.id);
    chain.unshift(current);

    const parentId = current.extends;
    if (parentId === undefined) return chain;
    const parent = lookup?.(parentId);
    if (parent === undefined) {
      throw new Error(`профиль «${current.id}» наследует неизвестный профиль «${parentId}»`);
    }
    current = parent;
  }
}
