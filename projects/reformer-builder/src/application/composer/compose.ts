/**
 * Имена → состав: то место, где данные профиля превращаются в пару фаз для `boot`.
 *
 * Разделение обязанностей здесь буквальное. Профиль знает ИМЕНА и ничего больше
 * (`application/profiles`). Резолвер знает, как из имён получается порядок, и отвергает
 * незнакомые (`application/resolver`). Карта знает, КАК создаётся каждый плагин и каким
 * файлом он приезжает (`./builtin-plugins`). Здесь эти три знания встречаются, и только здесь.
 *
 * ## Список разрешается ОДИН раз, а не на каждую фазу
 *
 * `fromProfile` разрешает профиль немедленно и запирает результат в замыкания обеих фаз.
 * Разреши он его внутри `eager` и внутри `lazy` по отдельности — фазы могли бы разойтись:
 * достаточно тому же профилю смениться в реестре между двумя вызовами, и приложение
 * получило бы статический набор одного состава, а ленивый — другого. Заметить это можно
 * было бы только по пропавшей панели. Заодно отказ на неизвестное имя случается ТУТ ЖЕ,
 * при сборке приложения, а не внутри `ready` полсекунды спустя.
 *
 * @module application/composer/compose
 */

import type { ApplicationComposition, BuiltinPluginsOptions } from '@/shell/boot/composition';
import type { Plugin } from '@/shell/platform/plugin/types';
import { findProfile } from '../profiles/registry';
import type { ApplicationProfile } from '../profiles/profile';
import { describeCapabilityProblems, resolveCapabilities } from '../resolver/capability-resolver';
import { resolveProfile, type PluginOverrides } from '../resolver/profile-resolver';
import {
  BUILTIN_PLUGINS,
  type EagerBuiltinPlugin,
  type LazyBuiltinPlugin,
} from './builtin-plugins';

/**
 * Состав приложения по профилю.
 *
 * @throws Error на неизвестное имя плагина, неизвестную основу профиля, круг в `extends` —
 * ровно то, чем отвечает резолвер профилей, — и на состав, который не собирается
 * по возможностям (невыполненное требование, двое провайдеров без выбора). Тот, кто собирает
 * приложение по КОНФИГУ, обязан этот отказ поймать: имя в конфиге пишет человек.
 */
export function fromProfile(
  profile: ApplicationProfile,
  overrides?: PluginOverrides
): ApplicationComposition {
  const ids = resolveProfile({
    profile,
    lookup: findProfile,
    known: BUILTIN_PLUGINS.keys(),
    overrides,
  });

  const entries = ids.map((id) => {
    const entry = BUILTIN_PLUGINS.get(id);
    // Резолвер сверил список с этой же картой, поэтому сюда неизвестное имя не доходит.
    // Проверка стоит не ради него, а ради того, чтобы «не доходит» было утверждением кода,
    // а не комментария: `!` спрятал бы расхождение, появись оно однажды.
    if (entry === undefined) throw new Error(`встроенный плагин «${id}» не найден в карте`);
    return entry;
  });

  // Возможности разрешаются ЗДЕСЬ же, одним проходом с составом, и по той же причине, по
  // которой список разрешается один раз: ответ «этот состав собирается» обязан относиться
  // ровно к тому набору, который поедет в обе фазы. Ни одного плагина это не грузит — читаются
  // объявления карты, то есть литералы.
  const capabilities = resolveCapabilities({ parts: entries });
  const problems = describeCapabilityProblems(capabilities);
  if (problems !== '') {
    // Отказ, а не тихая сборка: состав, в котором плагину нечем работать, соберётся и упадёт
    // позже — в `activate` или на первом обращении, то есть далеко от причины. Ловит его тот же,
    // кто ловит неизвестное имя (`application/builder-application`), и тем же способом.
    throw new Error(`состав «${profile.id}» не собирается по возможностям: ${problems}`);
  }

  const eager = entries.filter((entry): entry is EagerBuiltinPlugin => entry.loading === 'eager');
  const lazy = entries.filter((entry): entry is LazyBuiltinPlugin => entry.loading === 'lazy');

  return Object.freeze({
    capabilities: capabilities.providers,
    eager: (options: BuiltinPluginsOptions): readonly Plugin[] =>
      Object.freeze(eager.map((entry) => entry.create(options))),
    // Все фабрики зовутся ДО первого `await`, поэтому их `import()` уходят в один тик —
    // столько параллельных запросов, сколько ленивых плагинов, а не цепочка из шести.
    lazy: async (options: BuiltinPluginsOptions): Promise<readonly Plugin[]> =>
      Object.freeze(await Promise.all(lazy.map((entry) => entry.create(options)))),
  });
}

/**
 * Обе фазы одним вызовом.
 *
 * Нужна тем, кому важен СОСТАВ, а не порядок загрузки, — прежде всего проверкам состава.
 * `boot` ею не пользуется: ему нужны именно две фазы, потому что статических он регистрирует
 * синхронно, а ленивых дожидается внутри `ready`.
 */
export async function composeAll(
  composition: ApplicationComposition,
  options: BuiltinPluginsOptions
): Promise<readonly Plugin[]> {
  const lazy = await composition.lazy(options);
  return Object.freeze([...composition.eager(options), ...lazy]);
}
