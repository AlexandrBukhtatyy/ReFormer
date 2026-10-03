/**
 * Реестр профилей: имя разрешается, и разрешается во что-то собираемое.
 *
 * Второе важнее первого. Профиль — это строки, и опечатка в нём ничем не отличается от
 * правильного имени до тех пор, пока по профилю не собрали состав. Профиль, лежащий в реестре
 * и никем не собираемый, — это приглашение запустить билдер с `preset`, который не работает.
 *
 * @module application/profiles/registry.test
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseRuntimeConfig } from '@/shell/boot/runtime-config';
import { fromProfile } from '../composer/compose';
import builtinConfig from './builtin.config.json';
import {
  builtinProfile,
  defaultPresetChoices,
  defaultProfile,
  findProfile,
  PROFILES,
} from './registry';

describe('реестр профилей', () => {
  it('профили находятся по своему имени', () => {
    for (const id of ['reformer.builder', 'rjsf.builder', 'minimal', 'ai-builder']) {
      expect(findProfile(id)?.id).toBe(id);
    }
  });

  it('неизвестное имя — undefined, а не исключение', () => {
    // Решает, что с этим делать, вызывающий: резолвер превращает в отказ, запуск —
    // в предупреждение и умолчание.
    expect(findProfile('нет такого')).toBeUndefined();
  });

  it('имя, написанное в коде, обязано существовать: builtinProfile бросает', () => {
    expect(builtinProfile('minimal')).toBe(findProfile('minimal'));
    expect(() => builtinProfile('нет такого')).toThrow('встроенного профиля «нет такого» нет');
  });

  it('имена уникальны: профиль не может перекрыть соседний', () => {
    expect(PROFILES.size).toBe(6);
  });

  it('встроенный файл — чистый конфиг запуска: тот же разбор, ни одной проблемы', () => {
    // Формат профиля один. Дубль имени, незнакомое поле или битый профиль разбор назвал бы
    // в `problems` и пропустил — а реестр на это бросает при загрузке; здесь то же сказано явно.
    const parsed = parseRuntimeConfig(builtinConfig);

    expect(parsed.problems).toEqual([]);
    expect(parsed.config.profiles?.map((profile) => profile.id)).toEqual([...PROFILES.keys()]);
  });

  it('профиль по умолчанию — «preset» встроенного файла, и это полный состав ReFormer', () => {
    expect(defaultProfile).toBe(findProfile(builtinConfig.preset));
    expect(defaultProfile.id).toBe('reformer.builder');
  });

  it('переключатель по умолчанию предлагает существующие профили, и умолчание среди них', () => {
    // Имя в списке — такая же строка, как в `preset`: опечатка в нём молча убрала бы движок
    // из выбора. А умолчание вне списка означало бы выбор, из которого нельзя вернуться назад.
    expect(defaultPresetChoices).toEqual(['reformer.builder', 'rjsf.builder']);
    expect(defaultPresetChoices.filter((id) => findProfile(id) === undefined)).toEqual([]);
    expect(defaultPresetChoices).toContain(defaultProfile.id);
  });

  it('КАЖДЫЙ профиль реестра собирается — имена в нём настоящие', () => {
    // Ловит опечатку в списке плагинов и неразрешимый `extends` у любого профиля, включая
    // тот, который сегодня никто не запускает.
    for (const profile of PROFILES.values()) {
      expect(() => fromProfile(profile)).not.toThrow();
    }
  });
});

describe('схема конфига запуска называет встроенные профили', () => {
  it('описание «preset» перечисляет каждый профиль реестра', () => {
    // Описание — то, что человек видит подсказкой IDE, когда пишет `preset`. Профиль, которого
    // там нет, существует только для того, кто читает код.
    const schema = JSON.parse(
      readFileSync(
        fileURLToPath(new URL('../../../runtime-config.schema.json', import.meta.url)),
        'utf8'
      )
    ) as { properties: { preset: { description: string } } };
    const description = schema.properties.preset.description;

    expect([...PROFILES.keys()].filter((id) => !description.includes(id))).toEqual([]);
  });
});
