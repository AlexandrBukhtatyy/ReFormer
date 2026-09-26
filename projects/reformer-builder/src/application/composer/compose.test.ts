/**
 * Состав КОРОТКОГО профиля: кто собрался и, главное, кого нет.
 *
 * Полный профиль проверяется рядом (`builtin-plugins.test`), и проверка там устроена так,
 * что «всё на месте» она видит, а «лишнего нет» — нет: состав, где всё есть, ничем не
 * отличается от состава, где отключение не сработало. Значит утверждение «минимальный
 * профиль поднимается БЕЗ превью и редактора схемы» может жить только здесь.
 *
 * Проверка ПОИМЁННАЯ, а не числом. Порог «плагинов стало меньше» проходит и тогда, когда
 * из состава выпал не тот плагин: три вместо одиннадцати — это и «files, monaco, validator»,
 * и «ai, codegen, templates».
 *
 * @module application/composer/compose.test
 */

import { describe, expect, it } from 'vitest';
import { defineProfile } from '../profiles/profile';
import { aiBuilderProfile, minimalProfile } from '../profiles/presets';
import { builderProfile, plainProfile, rjsfProfile } from '../profiles/builder';
import { BUILTIN_PLUGINS } from './builtin-plugins';
import { composeAll, fromProfile } from './compose';
import { stubBuiltinOptions } from './testing';

/** Идентификаторы собранного состава — в том порядке, в каком их отдала композиция. */
async function idsOf(composition: ReturnType<typeof fromProfile>): Promise<readonly string[]> {
  const built = await composeAll(composition, stubBuiltinOptions());
  return built.map((composed) => composed.plugin.id);
}

describe('fromProfile', () => {
  it('минимальный профиль: три плагина поимённо, без превью и редактора схемы', async () => {
    const ids = await idsOf(fromProfile(minimalProfile));

    expect([...ids].sort()).toEqual([
      'reformer.editor-monaco',
      'reformer.files',
      'reformer.validator-schema',
    ]);
    expect(ids).not.toContain('reformer.preview');
    expect(ids).not.toContain('reformer.editor-schema');
  });

  it('способ доставки берётся из карты, а не из профиля', async () => {
    // Редактор кода приезжает своим файлом ВЕЗДЕ, включая минимальный профиль: ленивость —
    // свойство плагина (Monaco весит больше всего остального состава), и короткий профиль
    // не вправе втянуть его в стартовый граф ради круглого «ленивая фаза пуста».
    const composition = fromProfile(minimalProfile);
    const lazy = await composition.lazy(stubBuiltinOptions());

    expect(lazy.map((composed) => composed.plugin.id).sort()).toEqual([
      'reformer.editor-monaco',
      'reformer.files',
    ]);
    expect(composition.eager(stubBuiltinOptions()).map((composed) => composed.plugin.id)).toEqual([
      'reformer.validator-schema',
    ]);
  });

  it('ai-builder добавляет ассистента к минимальному — и только его', async () => {
    const ids = await idsOf(fromProfile(aiBuilderProfile));

    expect([...ids].sort()).toEqual([
      'reformer.ai',
      'reformer.editor-monaco',
      'reformer.files',
      'reformer.validator-schema',
    ]);
  });

  it('унаследованное идёт перед своим: порядок склейки доходит до состава', async () => {
    // `ai` объявлен в самом профиле, остальные трое унаследованы. Порядок обязан быть
    // «основа, потом своё» — тот же, что отдал резолвер.
    const ids = await idsOf(fromProfile(aiBuilderProfile));

    expect(ids.indexOf('reformer.ai')).toBe(ids.length - 1);
  });

  it('ассистент приезжает своим файлом и в коротком профиле тоже', async () => {
    // Профиль меняет СОСТАВ, а не способ доставки: «ленивый» — свойство плагина, записанное
    // в карте, и короткий профиль не вправе втянуть его в стартовый граф.
    const composition = fromProfile(aiBuilderProfile);
    const lazy = await composition.lazy(stubBuiltinOptions());

    expect(lazy.map((composed) => composed.plugin.id).sort()).toEqual([
      'reformer.ai',
      'reformer.editor-monaco',
      'reformer.files',
    ]);
    expect(composition.eager(stubBuiltinOptions()).map((composed) => composed.plugin.id)).toEqual([
      'reformer.validator-schema',
    ]);
  });

  it('полный профиль собирает всю карту, кроме других стеков', async () => {
    // Демо-стек и RJSF — другие стеки: в состав ReFormer они не входят, их собирают
    // `plain.builder` и `rjsf.builder`. Исключение — из их профилей, без общего с ReFormer.
    const ids = await idsOf(fromProfile(builderProfile));
    const others = new Set(
      [plainProfile, rjsfProfile]
        .flatMap((profile) => profile.plugins)
        .filter((id) => !builderProfile.plugins.includes(id))
    );

    expect([...ids].sort()).toEqual(
      [...BUILTIN_PLUGINS.keys()].filter((id) => !others.has(id)).sort()
    );
  });

  it('поправки запуска доходят до состава', async () => {
    const ids = await idsOf(fromProfile(minimalProfile, { enable: ['reformer.preview'] }));
    expect([...ids].sort()).toEqual([
      'reformer.editor-monaco',
      'reformer.files',
      'reformer.preview',
      'reformer.validator-schema',
    ]);

    const without = await idsOf(
      fromProfile(builderProfile, { disable: ['reformer.ai', 'reformer.preview'] })
    );
    expect(without).not.toContain('reformer.ai');
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

  it('неизвестное имя в поправках запуска — такой же отказ', () => {
    expect(() => fromProfile(minimalProfile, { disable: ['prewiew'] })).toThrow(
      /plugins\.disable.*«prewiew»/s
    );
  });

  it('прежнее имя в поправках запуска работает: конфиг человека переименование переживает', async () => {
    // `.ui_builder/config.json` пишет и хранит пользователь, мигрировать его нам нечем.
    // «Без ассистента» обязано значить то же самое и через год после смены пространства имён,
    // иначе переименование тихо ВЕРНУЛО бы в состав выключенный плагин.
    const without = await idsOf(fromProfile(builderProfile, { disable: ['ai'] }));
    expect(without).not.toContain('reformer.ai');
    expect(without).toContain('reformer.files');

    const wider = await idsOf(fromProfile(minimalProfile, { enable: ['preview'] }));
    expect(wider).toContain('reformer.preview');
  });

  it('прежнее имя не отменяет отказа на опечатку', () => {
    // Таблица псевдонимов переводит ИЗВЕСТНЫЕ имена и молчит об остальных: подставь она
    // «похожее», опечатка собрала бы работающее приложение не того состава.
    expect(() => fromProfile(minimalProfile, { disable: ['previeww'] })).toThrow(
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
    // `ai-builder` называет основу именем; найти её умеет только реестр. Собери `fromProfile`
    // состав без него — унаследованных троих в приложении не было бы вовсе.
    const composition = fromProfile(aiBuilderProfile);

    // Четверо унаследованных и своих: один статический и трое своими файлами.
    expect(composition.eager(stubBuiltinOptions()).length).toBe(1);
    expect((await composition.lazy(stubBuiltinOptions())).length).toBe(3);
  });
});
