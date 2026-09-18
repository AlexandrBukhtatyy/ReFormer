/**
 * Профили, доступные по имени: `extends` и конфиг запуска обращаются сюда.
 *
 * Реестр нужен ровно потому, что профиль ссылается на основу ИМЕНЕМ (см. `./profile`):
 * имя без места, где его разрешить, — это просто строка. Второй потребитель — `preset`
 * из конфига лаунчера: там имя приходит из JSON и не может быть ничем, кроме строки.
 *
 * Карта строится из перечисленных ЗДЕСЬ профилей, а не собирается автообходом каталога:
 * профиль — публичное имя, которым инструмент запускают, и появление нового имени обязано
 * быть видно в diff'е этого файла. Автообход добавлял бы профиль молча, вместе с файлом.
 *
 * @module application/profiles/registry
 */

import { baseProfile, builderProfile } from './builder';
import { aiBuilderProfile, minimalProfile } from './presets';
import type { ApplicationProfile } from './profile';

const ALL: readonly ApplicationProfile[] = Object.freeze([
  baseProfile,
  builderProfile,
  minimalProfile,
  aiBuilderProfile,
]);

/** Все известные профили по идентификатору. */
export const PROFILES: ReadonlyMap<string, ApplicationProfile> = new Map(
  ALL.map((profile) => [profile.id, profile])
);

/**
 * Профиль по имени или `undefined`.
 *
 * Отказ `undefined`, а не исключением, потому что у двух вызывающих он значит разное:
 * резолвер превращает его во внятную ошибку («профиль X наследует неизвестный Y»),
 * а запуск — в предупреждение и умолчание. Реши это место за обоих — второй потерял бы
 * возможность открыться вообще.
 */
export function findProfile(id: string): ApplicationProfile | undefined {
  return PROFILES.get(id);
}
