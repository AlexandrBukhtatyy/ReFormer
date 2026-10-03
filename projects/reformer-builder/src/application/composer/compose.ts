/**
 * Имена → состав: то место, где данные профиля превращаются в состав для `boot`.
 *
 * Разделение обязанностей здесь буквальное. Профиль знает ИМЕНА и ничего больше
 * (`application/profiles`). Резолвер знает, как из имён получается порядок, и отвергает
 * незнакомые (`application/resolver`). Карта знает, КАК создаётся каждый плагин и каким
 * файлом он приезжает (`./builtin-plugins`). Здесь эти три знания встречаются, и только здесь.
 *
 * ## Выбор провайдера — тоже данные профиля
 *
 * Возможность, объявленная двумя плагинами, — вопрос к человеку, а не повод «взять любого»:
 * слот службы один. Ответ живёт в профиле (`providers`), приезжает сюда вместе с составом
 * и уходит в резолвер. Здесь же он ПРОВЕРЯЕТСЯ на осмысленность: резолвер обязан отвечать
 * списками, а не бросать, но профиль пишет человек — и его опечатка должна называться,
 * а не молчать до первого запуска.
 *
 * ## Список разрешается сразу, а не при загрузке
 *
 * `fromProfile` разрешает профиль немедленно и запирает результат в замыкание `load`. Поэтому
 * объявленные возможности состава и сами плагины относятся к одному и тому же набору, а отказ
 * на неизвестное имя случается ТУТ ЖЕ, при сборке приложения, а не внутри `ready` полсекунды
 * спустя.
 *
 * @module application/composer/compose
 */

import type {
  ApplicationComposition,
  BuiltinPluginsOptions,
  ComposedPlugin,
} from '@/shell/boot/composition';
import { HOST_CAPABILITIES, HOST_PROVIDER_ID } from '@/shell/platform/services/host-capabilities';
import { findProfile } from '../profiles/registry';
import type { ApplicationProfile } from '../profiles/profile';
import { describeCapabilityProblems, resolveCapabilities } from '../resolver/capability-resolver';
import {
  resolveProfile,
  resolveProviders,
  type PluginOverrides,
} from '../resolver/profile-resolver';
import { BUILTIN_PLUGINS, canonicalPluginId } from './builtin-plugins';
import { RUNTIME_MODULES } from './runtime-modules';

/**
 * Состав, собранный по профилю: то же, что получает оболочка, плюс его плагины поимённо.
 *
 * Имена нужны приложению, а не оболочке — тому, кто решает, годится ли состав для выбора
 * человеком (есть ли в нём переключатель, чтобы из него можно было вернуться). Оболочке список
 * имён ни к чему, поэтому в {@link ApplicationComposition} его нет.
 */
export interface ProfileComposition extends ApplicationComposition {
  /** Плагины состава в порядке резолвера — после `extends` и поправок. */
  readonly pluginIds: readonly string[];
}

/**
 * Состав приложения по профилю.
 *
 * @throws Error на неизвестное имя плагина, неизвестную основу профиля, круг в `extends` —
 * ровно то, чем отвечает резолвер профилей, — и на состав, который не собирается
 * по возможностям (невыполненное требование, двое провайдеров без выбора). Тот, кто собирает
 * приложение по КОНФИГУ, обязан этот отказ поймать: имя в конфиге пишет человек.
 *
 * @param lookup где искать основы профиля по `extends`. По умолчанию — реестр встроенных; свои
 * профили конфига запуска добавляет к нему тот, кто собирает приложение по конфигу.
 */
export function fromProfile(
  profile: ApplicationProfile,
  overrides?: PluginOverrides,
  lookup: (id: string) => ApplicationProfile | undefined = findProfile
): ProfileComposition {
  const ids = resolveProfile({
    profile,
    lookup,
    known: BUILTIN_PLUGINS.keys(),
    // Поправки приходят из конфига, который пишет и хранит человек, поэтому прежние имена
    // плагинов приводятся к нынешним ЗДЕСЬ. Список профиля через ту же таблицу не гоняется:
    // профили — наш код, и прежнее имя в них означало бы забытую правку, а не чужой файл.
    overrides: canonicalOverrides(overrides),
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
  // которой список разрешается сразу: ответ «этот состав собирается» обязан относиться
  // ровно к тому набору, который будет загружен. Ни одного плагина это не грузит — читаются
  // манифесты состава, то есть статически импортированный JSON.
  //
  // Часть «оболочка» идёт наравне с плагинами: рабочую область, фокус текстового редактора
  // и снимки вида даёт не плагин, а сама оболочка (`platform/services/host-capabilities`).
  // Без неё внешний плагин с `requires: reformer.workspace@^1` получал бы отказ «никто
  // не предоставляет» ровно у той службы, которая заведена для него же.
  const parts = [
    { id: HOST_PROVIDER_ID, provides: HOST_CAPABILITIES },
    ...entries.map((entry) => entry.manifest),
  ];
  const chosen = resolveProviders({ profile, lookup });
  const capabilities = resolveCapabilities({ parts, chosen });
  rejectEmptyChoices(profile, chosen, parts);
  const problems = describeCapabilityProblems(capabilities);
  if (problems !== '') {
    // Отказ, а не тихая сборка: состав, в котором плагину нечем работать, соберётся и упадёт
    // позже — в `activate` или на первом обращении, то есть далеко от причины. Ловит его тот же,
    // кто ловит неизвестное имя (`application/builder-application`), и тем же способом.
    throw new Error(`состав «${profile.id}» не собирается по возможностям: ${problems}`);
  }

  return Object.freeze({
    profile: Object.freeze({ id: profile.id, name: profile.name }),
    pluginIds: Object.freeze([...ids]),
    capabilities: capabilities.providers,
    modules: RUNTIME_MODULES,
    // Все фабрики зовутся ДО первого `await`, поэтому их `import()` уходят в один тик —
    // столько параллельных запросов, сколько плагинов в составе, а не цепочка.
    load: async (options: BuiltinPluginsOptions): Promise<readonly ComposedPlugin[]> =>
      Object.freeze(
        await Promise.all(
          entries.map(async (entry) => ({
            plugin: await entry.create(options),
            provides: entry.manifest.provides,
            permissions: entry.manifest.permissions,
          }))
        )
      ),
  });
}

/**
 * Приводит имена поправок к нынешним — прежние остаются рабочими.
 *
 * Отсутствующий список остаётся отсутствующим, а не превращается в пустой: у резолвера
 * «поправки не заданы» и «задан пустой список» и так совпадают, но пустое поле в объекте
 * читалось бы как сделанный выбор.
 */
function canonicalOverrides(overrides?: PluginOverrides): PluginOverrides | undefined {
  if (overrides === undefined) return undefined;
  const map = (list?: readonly string[]): readonly string[] | undefined =>
    list?.map(canonicalPluginId);
  const enable = map(overrides.enable);
  const disable = map(overrides.disable);
  return {
    ...(enable !== undefined ? { enable } : {}),
    ...(disable !== undefined ? { disable } : {}),
  };
}

/**
 * Отвергает выбор провайдера, который ничего не выбирает.
 *
 * Резолвер такой выбор просто НЕ ПРИМЕНЯЕТ — и правильно делает: он разбирает данные и обязан
 * отвечать списками, а не бросать. Но здесь данные пришли из ПРОФИЛЯ, который пишет человек,
 * и «выбрали того, кто эту возможность не даёт» — такая же опечатка, как имя плагина, которого
 * нет в карте. Промолчи мы — при одном провайдере не изменилось бы ничего, а при двух состав
 * отказался бы собираться с жалобой на конфликт, ни словом не упомянув сделанный выбор.
 */
function rejectEmptyChoices(
  profile: ApplicationProfile,
  chosen: Readonly<Record<string, string>>,
  parts: readonly { readonly id: string; readonly provides?: readonly { readonly id: string }[] }[]
): void {
  for (const [capabilityId, pluginId] of Object.entries(chosen)) {
    const part = parts.find((candidate) => candidate.id === pluginId);
    if (part === undefined) {
      throw new Error(
        `профиль «${profile.id}»: выбран провайдер «${pluginId}» для возможности ` +
          `«${capabilityId}», но такой части в составе нет`
      );
    }
    if (!(part.provides ?? []).some((declaration) => declaration.id === capabilityId)) {
      throw new Error(
        `профиль «${profile.id}»: «${pluginId}» выбран провайдером «${capabilityId}», ` +
          'но этой возможности он не объявляет'
      );
    }
  }
}
