/**
 * Состав КОРОТКОГО профиля: кто собрался и, главное, кого нет.
 *
 * Полный профиль проверяется рядом (`builtin-plugins.test`), и проверка там устроена так,
 * что «всё на месте» она видит, а «лишнего нет» — нет: состав, где всё есть, ничем не
 * отличается от состава, где отключение не сработало. Значит утверждение «короткий профиль
 * поднимается БЕЗ превью и реестра китов» может жить только здесь.
 *
 * Проверка ПОИМЁННАЯ, а не числом. Порог «плагинов стало меньше» проходит и тогда, когда
 * из состава выпал не тот плагин: два вместо семи — это и «files, monaco», и «kits, preview».
 *
 * Короткие профили здесь свои, тестовые: встроенных у билдера два (`builder.base`, `builder`),
 * а движки форм в его состав не входят вовсе — они плагины проекта.
 *
 * @module application/composer/compose.test
 */

import { describe, expect, it } from 'vitest';
import { defineProfile } from '../profiles/profile';
import { builtinProfile } from '../profiles/registry';
import { BUILTIN_PLUGINS } from './builtin-plugins';
import { fromProfile } from './compose';
import { stubBuiltinOptions } from './testing';

const builderProfile = builtinProfile('builder');
const baseProfile = builtinProfile('builder.base');

/** Короткий профиль: два плагина, ни превью, ни китов. */
const shortProfile = defineProfile({
  id: 'short.test',
  name: 'Короткий',
  plugins: ['reformer.files', 'reformer.editor-monaco'],
});

/** Идентификаторы собранного состава — в том порядке, в каком их отдала композиция. */
async function idsOf(composition: ReturnType<typeof fromProfile>): Promise<readonly string[]> {
  const built = await composition.load(stubBuiltinOptions());
  return built.map((composed) => composed.plugin.id);
}

describe('fromProfile', () => {
  it('короткий профиль: два плагина поимённо, без превью и китов', async () => {
    const ids = await idsOf(fromProfile(shortProfile));

    expect([...ids].sort()).toEqual(['reformer.editor-monaco', 'reformer.files']);
    expect(ids).not.toContain('reformer.preview');
    expect(ids).not.toContain('reformer.kits');
  });

  it('builder добавляет киты к основе — и только их', async () => {
    const ids = await idsOf(fromProfile(builderProfile));

    expect([...ids].sort()).toEqual([...baseProfile.plugins, 'reformer.kits'].sort());
  });

  it('унаследованное идёт перед своим: порядок склейки доходит до состава', async () => {
    // Киты объявлены в самом профиле, остальные унаследованы от основы. Порядок обязан быть
    // «основа, потом своё» — тот же, что отдал резолвер.
    const ids = await idsOf(fromProfile(builderProfile));

    expect(ids.indexOf('reformer.kits')).toBe(ids.length - 1);
  });

  it('профиль по умолчанию собирает всю карту', async () => {
    // Движков форм среди встроенных нет, поэтому плагина, который в карте есть, а в состав
    // по умолчанию не входит, быть не может.
    const ids = await idsOf(fromProfile(builderProfile));

    expect([...ids].sort()).toEqual([...BUILTIN_PLUGINS.keys()].sort());
  });

  it('поправки запуска доходят до состава', async () => {
    const ids = await idsOf(fromProfile(shortProfile, { enable: ['reformer.preview'] }));
    expect([...ids].sort()).toEqual([
      'reformer.editor-monaco',
      'reformer.files',
      'reformer.preview',
    ]);

    const without = await idsOf(
      fromProfile(builderProfile, { disable: ['reformer.kits', 'reformer.preview'] })
    );
    expect(without).not.toContain('reformer.kits');
    expect(without).not.toContain('reformer.preview');
    expect(without).toContain('reformer.files');
  });

  it('неизвестное имя в профиле — отказ при сборке приложения, а не позже', () => {
    // Отказ случается ТУТ ЖЕ, при `fromProfile`, а не внутри `ready` полсекунды спустя:
    // приложение, собранное наполовину, чинить некому.
    const broken = defineProfile({
      id: 'broken',
      name: 'Битый',
      plugins: ['reformer.files', 'previeww'],
    });

    expect(() => fromProfile(broken)).toThrow(/неизвестный плагин «previeww»/);
  });

  it('плагин проекта в профиле — такой же отказ: состав называет только встроенных', () => {
    // Движок форм живёт в каталоге плагинов проекта и поднимается после его открытия.
    // Профиль, который называет его по имени, просит то, чего при сборке приложения ещё нет.
    const withEngine = defineProfile({
      id: 'with-engine',
      name: 'С движком',
      extends: 'builder',
      plugins: ['reformer.editor-schema'],
    });

    expect(() => fromProfile(withEngine)).toThrow(/неизвестный плагин «reformer.editor-schema»/);
  });

  it('неизвестное имя в поправках запуска — такой же отказ', () => {
    expect(() => fromProfile(shortProfile, { disable: ['prewiew'] })).toThrow(
      /plugins\.disable.*«prewiew»/s
    );
  });

  it('прежнее имя в поправках запуска работает: конфиг человека переименование переживает', async () => {
    // `.ui_builder/config.json` пишет и хранит пользователь, мигрировать его нам нечем.
    // «Без китов» обязано значить то же самое и через год после смены пространства имён,
    // иначе переименование тихо ВЕРНУЛО бы в состав выключенный плагин.
    const without = await idsOf(fromProfile(builderProfile, { disable: ['kits'] }));
    expect(without).not.toContain('reformer.kits');
    expect(without).toContain('reformer.files');

    const wider = await idsOf(fromProfile(shortProfile, { enable: ['preview'] }));
    expect(wider).toContain('reformer.preview');
  });

  it('прежнее имя не отменяет отказа на опечатку', () => {
    // Таблица псевдонимов переводит ИЗВЕСТНЫЕ имена и молчит об остальных: подставь она
    // «похожее», опечатка собрала бы работающее приложение не того состава.
    expect(() => fromProfile(shortProfile, { disable: ['previeww'] })).toThrow(
      /plugins\.disable.*«previeww»/s
    );
  });

  it('выбран провайдер, который эту возможность не объявляет, — отказ, а не тишина', () => {
    // Резолвер такой выбор просто не применяет: он разбирает данные. Но профиль пишет
    // человек, и при ДВУХ провайдерах его опечатка выглядела бы как жалоба на конфликт,
    // ни словом не упомянув выбор.
    const wrong = defineProfile({
      id: 'wrong-choice',
      name: 'Не тот',
      plugins: ['reformer.files', 'reformer.preview'],
      providers: { 'reformer.preview.live': 'reformer.files' },
    });

    expect(() => fromProfile(wrong)).toThrow(
      /«reformer.files» выбран провайдером «reformer.preview.live»/
    );
  });

  it('выбран провайдер, которого нет в составе, — отказ по имени части', () => {
    const absent = defineProfile({
      id: 'absent-choice',
      name: 'Нет такого',
      plugins: ['reformer.files'],
      providers: { 'reformer.preview.live': 'reformer.preview' },
    });

    expect(() => fromProfile(absent)).toThrow(/«reformer.preview».*такой части в составе нет/s);
  });

  it('extends разрешается через реестр профилей, а не через переданную основу', async () => {
    // `builder` называет основу именем; найти её умеет только реестр. Собери `fromProfile`
    // состав без него — унаследованных шестерых в приложении не было бы вовсе.
    const composition = fromProfile(builderProfile);

    // Шестеро унаследованных и один свой.
    expect((await composition.load(stubBuiltinOptions())).length).toBe(7);
  });
});
