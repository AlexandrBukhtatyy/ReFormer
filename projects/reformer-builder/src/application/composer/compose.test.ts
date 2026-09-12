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
import { builderProfile } from '../profiles/builder';
import { BUILTIN_PLUGINS } from './builtin-plugins';
import { composeAll, fromProfile } from './compose';
import { stubBuiltinOptions } from './testing';

/** Идентификаторы собранного состава — в том порядке, в каком их отдала композиция. */
async function idsOf(composition: ReturnType<typeof fromProfile>): Promise<readonly string[]> {
  const built = await composeAll(composition, stubBuiltinOptions());
  return built.map((plugin) => plugin.id);
}

describe('fromProfile', () => {
  it('минимальный профиль: три плагина поимённо, без превью и редактора схемы', async () => {
    const ids = await idsOf(fromProfile(minimalProfile));

    expect([...ids].sort()).toEqual(['editor-monaco', 'files', 'validator-schema']);
    expect(ids).not.toContain('preview');
    expect(ids).not.toContain('editor-schema');
  });

  it('минимальный профиль целиком статичен: ленивая фаза пуста, а не «почти пуста»', async () => {
    // Ни один из троих не приезжает своим файлом — значит `ready` не ждёт ни одного импорта.
    const composition = fromProfile(minimalProfile);

    await expect(composition.lazy(stubBuiltinOptions())).resolves.toEqual([]);
  });

  it('ai-builder добавляет ассистента к минимальному — и только его', async () => {
    const ids = await idsOf(fromProfile(aiBuilderProfile));

    expect([...ids].sort()).toEqual(['ai', 'editor-monaco', 'files', 'validator-schema']);
  });

  it('унаследованное идёт перед своим: порядок склейки доходит до состава', async () => {
    // `ai` объявлен в самом профиле, остальные трое унаследованы. Порядок обязан быть
    // «основа, потом своё» — тот же, что отдал резолвер.
    const ids = await idsOf(fromProfile(aiBuilderProfile));

    expect(ids.indexOf('ai')).toBe(ids.length - 1);
  });

  it('ассистент приезжает своим файлом и в коротком профиле тоже', async () => {
    // Профиль меняет СОСТАВ, а не способ доставки: «ленивый» — свойство плагина, записанное
    // в карте, и короткий профиль не вправе втянуть его в стартовый граф.
    const composition = fromProfile(aiBuilderProfile);
    const lazy = await composition.lazy(stubBuiltinOptions());

    expect(lazy.map((plugin) => plugin.id)).toEqual(['ai']);
    expect(composition.eager(stubBuiltinOptions()).map((plugin) => plugin.id)).toEqual([
      'files',
      'editor-monaco',
      'validator-schema',
    ]);
  });

  it('полный профиль собирает всю карту', async () => {
    const ids = await idsOf(fromProfile(builderProfile));

    expect([...ids].sort()).toEqual([...BUILTIN_PLUGINS.keys()].sort());
  });

  it('поправки запуска доходят до состава', async () => {
    const ids = await idsOf(fromProfile(minimalProfile, { enable: ['preview'] }));
    expect([...ids].sort()).toEqual(['editor-monaco', 'files', 'preview', 'validator-schema']);

    const without = await idsOf(fromProfile(builderProfile, { disable: ['ai', 'preview'] }));
    expect(without).not.toContain('ai');
    expect(without).not.toContain('preview');
    expect(without).toContain('files');
  });

  it('неизвестное имя в профиле — отказ при сборке приложения, а не позже', () => {
    // Отказ случается ТУТ ЖЕ, при `fromProfile`, а не внутри `ready` полсекунды спустя:
    // приложение, собранное наполовину, чинить некому.
    const broken = defineProfile({ id: 'broken', name: 'Битый', plugins: ['files', 'previeww'] });

    expect(() => fromProfile(broken)).toThrow(/неизвестный плагин «previeww»/);
  });

  it('неизвестное имя в поправках запуска — такой же отказ', () => {
    expect(() => fromProfile(minimalProfile, { disable: ['prewiew'] })).toThrow(
      /plugins\.disable.*«prewiew»/s
    );
  });

  it('extends разрешается через реестр профилей, а не через переданную основу', () => {
    // `ai-builder` называет основу именем; найти её умеет только реестр. Собери `fromProfile`
    // состав без него — унаследованных троих в приложении не было бы вовсе.
    const composition = fromProfile(aiBuilderProfile);

    expect(composition.eager(stubBuiltinOptions()).length).toBe(3);
  });
});
