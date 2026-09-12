/**
 * Реестр профилей: имя разрешается, и разрешается во что-то собираемое.
 *
 * Второе важнее первого. Профиль — это строки, и опечатка в нём ничем не отличается от
 * правильного имени до тех пор, пока по профилю не собрали состав. Профиль, лежащий в реестре
 * и никем не собираемый, — это приглашение запустить билдер с `preset`, который не работает.
 *
 * @module application/profiles/registry.test
 */

import { describe, expect, it } from 'vitest';
import { fromProfile } from '../composer/compose';
import { builderProfile } from './builder';
import { aiBuilderProfile, minimalProfile } from './presets';
import { findProfile, PROFILES } from './registry';

describe('реестр профилей', () => {
  it('все три профиля находятся по своему имени', () => {
    expect(findProfile('reformer.builder')).toBe(builderProfile);
    expect(findProfile('minimal')).toBe(minimalProfile);
    expect(findProfile('ai-builder')).toBe(aiBuilderProfile);
  });

  it('неизвестное имя — undefined, а не исключение', () => {
    // Решает, что с этим делать, вызывающий: резолвер превращает в отказ, запуск —
    // в предупреждение и умолчание.
    expect(findProfile('нет такого')).toBeUndefined();
  });

  it('имена уникальны: профиль не может перекрыть соседний', () => {
    expect(PROFILES.size).toBe(3);
  });

  it('КАЖДЫЙ профиль реестра собирается — имена в нём настоящие', () => {
    // Ловит опечатку в списке плагинов и неразрешимый `extends` у любого профиля, включая
    // тот, который сегодня никто не запускает.
    for (const profile of PROFILES.values()) {
      expect(() => fromProfile(profile)).not.toThrow();
    }
  });
});
