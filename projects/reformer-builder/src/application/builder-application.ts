/**
 * Приложение «ReFormer Builder» как СОСТАВ: из каких встроенных плагинов оно собрано.
 *
 * Оболочка знает форму композиции (`shell/boot/composition`), но не её содержимое, — поэтому
 * значение собирается здесь и приходит в `boot` параметром из `main.tsx`. Отсюда свойство, ради
 * которого слой и заведён: другое приложение на той же оболочке — это другой профиль в этом
 * каталоге, а не правка `boot`.
 *
 * ОДИН объект: загрузка плагинов и объявленные ими возможности обязаны относиться к одному
 * составу. Собирает его `composer/compose`, разрешая профиль один раз.
 *
 * @module application/builder-application
 */

import type { ApplicationComposition, ProfileChoices } from '@/shell/boot/composition';
import type { RuntimeConfig } from '@/shell/boot/runtime-config';
import { canonicalPluginId } from './composer/builtin-plugins';
import { fromProfile, type ProfileComposition } from './composer/compose';
import { profileFromConfig, type ApplicationProfile } from './profiles/profile';
import { defaultPresetChoices, defaultProfile, findProfile } from './profiles/registry';

/** Полный состав: то, что получает человек, открывший инструмент без конфига. */
export const builderApplication: ProfileComposition = fromProfile(defaultProfile);

/**
 * Плагин-переключатель сочетаний — именем, как плагины названы в профилях.
 *
 * Строкой, а не импортом из плагина: состав знает плагины по именам, а сверяет имена с картой
 * встроенных резолвер. То, что имя настоящее, стережёт тест этого модуля.
 */
export const STACK_SWITCH_PLUGIN_ID = 'reformer.stack-switch';

type ProfileLookup = (id: string) => ApplicationProfile | undefined;

/**
 * Свои профили конфига запуска как профили приложения.
 *
 * Имя, совпавшее со встроенным, — предупреждение и пропуск, а не подмена: встроенный профиль —
 * публичное имя, и тихо переопределить его из конфига значило бы, что `preset: "rjsf.builder"`
 * собирает не то, что о нём написано. Имена плагинов проходят ту же таблицу прежних имён, что и
 * поправки: профиль в конфиге тоже пишет и хранит человек. Само преобразование — то же, что у
 * встроенных профилей (`profiles/registry`): формат у них один.
 */
export function configProfiles(
  profiles: RuntimeConfig['profiles']
): ReadonlyMap<string, ApplicationProfile> {
  const own = new Map<string, ApplicationProfile>();
  for (const profile of profiles ?? []) {
    if (findProfile(profile.id) !== undefined) {
      console.warn(
        `[application] профиль «${profile.id}» из конфига совпадает со встроенным — пропущен`
      );
      continue;
    }
    own.set(profile.id, profileFromConfig(profile, canonicalPluginId));
  }
  return own;
}

/**
 * Состав по конфигу уровня запуска: `preset`, свои `profiles` и поправки `plugins.enable/disable`.
 *
 * `preset` и `extends` ищутся сначала среди своих профилей конфига, затем среди встроенных:
 * свой профиль может наследовать встроенный (`"extends": "rjsf.builder"`) и другой свой.
 *
 * Живёт здесь, а не в `main.tsx`, по одной причине: у `main.tsx` нет теста и быть не может —
 * это точка входа с `createRoot`. А решать эта функция обязана ровно то, что проверяется
 * только тестом: неизвестное имя пресета, поправку, называющую несуществующий плагин, и то,
 * что ни один из этих случаев не оставляет человека без приложения.
 *
 * ЛЮБОЙ отказ здесь — предупреждение и полный профиль, а не исключение. Конфиг пишет человек
 * руками, и опечатка в нём не может стоить ему инструмента: тот же принцип, по которому битый
 * конфиг не роняет запуск, а собирает `problems` (см. `shell/boot/runtime-config`). Разница
 * с `problems` в том, что состав фиксируется при СБОРКЕ приложения — раньше, чем появятся
 * словари и служба уведомлений, — поэтому сказать здесь можно только в консоль.
 */
export function applicationFromRuntime(config: RuntimeConfig): ApplicationComposition {
  return launchComposition(config, lookupOf(config));
}

/** Где искать профиль по имени: свои профили конфига, затем встроенные. */
function lookupOf(config: RuntimeConfig): ProfileLookup {
  const own = configProfiles(config.profiles);
  return (id) => own.get(id) ?? findProfile(id);
}

/** Состав, который называет конфиг запуска, — без оглядки на выбор человека. */
function launchComposition(config: RuntimeConfig, lookup: ProfileLookup): ProfileComposition {
  const presetId = config.preset;
  const profile = presetId === undefined ? defaultProfile : lookup(presetId);
  if (profile === undefined) {
    console.warn(
      `[application] профиль «${presetId ?? ''}» неизвестен — собираю «${defaultProfile.id}»`
    );
    return builderApplication;
  }
  try {
    return fromProfile(profile, config.plugins, lookup);
  } catch (error) {
    console.warn('[application] состав по конфигу не собран — собираю полный профиль', error);
    return builderApplication;
  }
}

/** Что получает `boot`: состав и то, между чем человек может его переключить. */
export interface Launch {
  readonly application: ApplicationComposition;
  readonly profileChoices: ProfileChoices;
}

/**
 * Состав с учётом выбора человека: конфиг запуска называет профиль, а человек вправе выбрать
 * другой — из тех, что предложены.
 *
 * Та же доктрина, что у умолчаний настроек (`defaults.settings`): слово организации действует,
 * пока человек не выбрал сам, а его выбор сильнее и переживает перезагрузку. Отличие одно —
 * выбор состава обязан быть известен ДО сборки, поэтому приходит он сюда параметром, прочитанный
 * `main.tsx` мимо службы настроек (`shell/boot/stored-preset`).
 *
 * ## Что предлагается к выбору
 *
 * `presetChoices` конфига запуска, а без него — список встроенного файла. Профиль остаётся
 * в списке, только если он СОБИРАЕТСЯ с поправками этого конфига и СОДЕРЖИТ переключатель:
 * первое — потому что выбор, ведущий в отказ, выбором не является; второе — потому что из состава
 * без переключателя нельзя вернуться назад. Меньше двух таких профилей — выбора нет.
 *
 * Нет переключателя в составе самого запуска — выбора нет вовсе, и сохранённый когда-то выбор
 * не действует. Переключатель и есть интерфейс выбора: организация, убравшая его поправкой
 * состава, закрепила профиль, а конфиг вида `preset: "minimal"` обязан давать именно `minimal`,
 * что бы человек ни выбирал под другим конфигом.
 *
 * ## Выбор, который не действует, не роняет запуск
 *
 * Имя вне списка, профиль, переставший собираться, выбор, равный профилю запуска, — во всех
 * случаях собирается состав конфига запуска, а не полный профиль: человек не делал ничего, за
 * что его стоило бы увести с настроенного организацией состава.
 *
 * @param stored выбор человека из области `user`; `null` — выбора нет.
 */
export function launchFromRuntime(config: RuntimeConfig, stored: string | null): Launch {
  const lookup = lookupOf(config);
  const launch = launchComposition(config, lookup);
  const offered = launch.pluginIds.includes(STACK_SWITCH_PLUGIN_ID)
    ? offeredCompositions(config, lookup)
    : [];
  const chosen =
    stored !== null && stored !== launch.profile.id
      ? offered.find((composition) => composition.profile.id === stored)
      : undefined;
  return {
    application: chosen ?? launch,
    profileChoices: {
      launch: launch.profile,
      offered: offered.map((composition) => composition.profile),
    },
  };
}

/**
 * Профили, предложенные к выбору, — уже собранными: проверка «собирается ли» и есть сборка,
 * и выбранный человеком состав берётся отсюда же, а не собирается второй раз.
 */
function offeredCompositions(
  config: RuntimeConfig,
  lookup: ProfileLookup
): readonly ProfileComposition[] {
  const compositions: ProfileComposition[] = [];
  const seen = new Set<string>();
  for (const id of config.presetChoices ?? defaultPresetChoices) {
    if (seen.has(id)) continue;
    seen.add(id);
    const profile = lookup(id);
    if (profile === undefined) {
      console.warn(`[application] профиль «${id}» из «presetChoices» неизвестен — пропущен`);
      continue;
    }
    let composition: ProfileComposition;
    try {
      composition = fromProfile(profile, config.plugins, lookup);
    } catch (error) {
      console.warn(
        `[application] профиль «${id}» из «presetChoices» не собирается — пропущен`,
        error
      );
      continue;
    }
    if (!composition.pluginIds.includes(STACK_SWITCH_PLUGIN_ID)) {
      console.warn(
        `[application] профиль «${id}» из «presetChoices» пропущен: в нём нет переключателя ` +
          `«${STACK_SWITCH_PLUGIN_ID}», и вернуться из него было бы нечем`
      );
      continue;
    }
    compositions.push(composition);
  }
  // Один профиль — не выбор. Список из одного имени читается как «закрепить состав», и вести
  // себя иначе, когда профиль запуска в него не входит, значило бы удивить того, кто его писал.
  return compositions.length < 2 ? [] : compositions;
}
