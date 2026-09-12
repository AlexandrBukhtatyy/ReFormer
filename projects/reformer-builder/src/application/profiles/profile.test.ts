/**
 * Объявление профиля: почему это функция, а не литерал с аннотацией типа.
 *
 * Ответ один — заморозка, — и проверяется он здесь, потому что больше нигде не проверится:
 * состав, собранный по профилю, выглядит одинаково и при замороженном профиле, и при
 * изменяемом. Разница видна только тогда, когда кто-то профиль правит, а к этому времени
 * приложение уже собрано.
 *
 * @module application/profiles/profile.test
 */

import { describe, expect, it } from 'vitest';
import { defineProfile } from './profile';
import { builderProfile } from './builder';
import { aiBuilderProfile, minimalProfile } from './presets';

describe('defineProfile', () => {
  it('профиль и его список заморожены', () => {
    const profile = defineProfile({ id: 'p', name: 'П', plugins: ['files'] });

    expect(Object.isFrozen(profile)).toBe(true);
    expect(Object.isFrozen(profile.plugins)).toBe(true);
  });

  it('список — КОПИЯ: правка исходного массива не меняет объявленный профиль', () => {
    // Профиль живёт всё время работы приложения и читается на каждую сборку состава.
    // Держи он тот же массив, что у вызывающего, состав одного приложения менялся бы
    // из другого места — а `readonly` в типе от этого не спасает, это всего лишь `as`.
    const plugins = ['files', 'ai'];
    const profile = defineProfile({ id: 'p', name: 'П', plugins });

    plugins.push('preview');

    expect(profile.plugins).toEqual(['files', 'ai']);
  });

  it('профили приложения объявлены этой же функцией, а не литералами мимо неё', () => {
    // Иначе заморозка была бы свойством функции, а не свойством профилей.
    for (const profile of [builderProfile, minimalProfile, aiBuilderProfile]) {
      expect(Object.isFrozen(profile)).toBe(true);
      expect(Object.isFrozen(profile.plugins)).toBe(true);
    }
  });
});
