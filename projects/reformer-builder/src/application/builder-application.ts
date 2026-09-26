/**
 * Приложение «ReFormer Builder» как СОСТАВ: из каких встроенных плагинов оно собрано.
 *
 * Оболочка знает форму композиции (`shell/boot/composition`), но не её содержимое, — поэтому
 * значение собирается здесь и приходит в `boot` параметром из `main.tsx`. Отсюда свойство, ради
 * которого слой и заведён: другое приложение на той же оболочке — это другой профиль в этом
 * каталоге, а не правка `boot`.
 *
 * ОДИН объект, а не две функции по отдельному полю `BootOptions`: фазы обязаны приходить ПАРОЙ.
 * Разъехавшись, они дали бы приложение, у которого статический набор от одного состава, а ленивый
 * от другого, — и заметить это можно было бы только по пропавшей панели. Пару собирает
 * `composer/compose`, разрешая профиль один раз на оба замыкания.
 *
 * @module application/builder-application
 */

import type { ApplicationComposition } from '@/shell/boot/composition';
import type { RuntimeConfig } from '@/shell/boot/runtime-config';
import { canonicalPluginId } from './composer/builtin-plugins';
import { fromProfile } from './composer/compose';
import { builderProfile } from './profiles/builder';
import { defineProfile, type ApplicationProfile } from './profiles/profile';
import { findProfile } from './profiles/registry';

/** Полный состав: то, что получает человек, открывший инструмент без конфига. */
export const builderApplication: ApplicationComposition = fromProfile(builderProfile);

/**
 * Свои профили конфига запуска как профили приложения.
 *
 * Имя, совпавшее со встроенным, — предупреждение и пропуск, а не подмена: встроенный профиль —
 * публичное имя, и тихо переопределить его из конфига значило бы, что `preset: "rjsf.builder"`
 * собирает не то, что о нём написано. Имена плагинов проходят ту же таблицу прежних имён, что и
 * поправки: профиль в конфиге тоже пишет и хранит человек.
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
    own.set(
      profile.id,
      defineProfile({
        id: profile.id,
        name: profile.name ?? profile.id,
        ...(profile.extends !== undefined ? { extends: profile.extends } : {}),
        plugins: profile.plugins.map(canonicalPluginId),
        ...(profile.providers !== undefined
          ? {
              providers: Object.fromEntries(
                Object.entries(profile.providers).map(([capability, plugin]) => [
                  capability,
                  canonicalPluginId(plugin),
                ])
              ),
            }
          : {}),
      })
    );
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
  const own = configProfiles(config.profiles);
  const lookup = (id: string): ApplicationProfile | undefined => own.get(id) ?? findProfile(id);
  const presetId = config.preset;
  const profile = presetId === undefined ? builderProfile : lookup(presetId);
  if (profile === undefined) {
    console.warn(
      `[application] профиль «${presetId ?? ''}» неизвестен — собираю «${builderProfile.id}»`
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
