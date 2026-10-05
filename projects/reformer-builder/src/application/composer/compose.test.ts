/**
 * Состав КОРОТКОГО профиля: кто собрался и, главное, кого нет.
 *
 * Полный профиль проверяется рядом (`builtin-plugins.test`), и проверка там устроена так,
 * что «всё на месте» она видит, а «лишнего нет» — нет: состав, где всё есть, ничем не
 * отличается от состава, где отключение не сработало. Значит утверждение «короткий профиль
 * поднимается БЕЗ markdown и управления плагинами» может жить только здесь.
 *
 * Проверка ПОИМЁННАЯ, а не числом. Порог «плагинов стало меньше» проходит и тогда, когда
 * из состава выпал не тот плагин: два вместо пяти — это и «files, monaco», и «markdown, files».
 *
 * Короткие профили здесь свои, тестовые: встроенных у билдера два (`builder.base`, `builder`),
 * и состав у них один. Платформа форм и движки в него не входят вовсе — они плагины приложения.
 *
 * @module application/composer/compose.test
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineProfile } from '../profiles/profile';
import { builtinProfile } from '../profiles/registry';
import { BUILTIN_PLUGINS } from './builtin-plugins';
import { fromProfile } from './compose';

const builderProfile = builtinProfile('builder');
const baseProfile = builtinProfile('builder.base');

/** Короткий профиль: два плагина, ни markdown, ни управления плагинами. */
const shortProfile = defineProfile({
  id: 'short.test',
  name: 'Короткий',
  plugins: ['reformer.files', 'reformer.editor-monaco'],
});

/** Профиль со своим плагином поверх основы — ради порядка склейки. */
const extendedProfile = defineProfile({
  id: 'extended.test',
  name: 'С добавкой',
  extends: 'short.test',
  plugins: ['reformer.editor-markdown'],
});

const lookup = (id: string) =>
  id === shortProfile.id ? shortProfile : id === 'builder.base' ? baseProfile : undefined;

/** Идентификаторы собранного состава — в том порядке, в каком их отдала композиция. */
async function idsOf(composition: ReturnType<typeof fromProfile>): Promise<readonly string[]> {
  const built = await composition.load();
  return built.map((composed) => composed.plugin.id);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fromProfile', () => {
  it('короткий профиль: два плагина поимённо, без markdown и управления плагинами', async () => {
    const ids = await idsOf(fromProfile(shortProfile));

    expect([...ids].sort()).toEqual(['reformer.editor-monaco', 'reformer.files']);
    expect(ids).not.toContain('reformer.editor-markdown');
    expect(ids).not.toContain('reformer.plugin-manager');
  });

  it('builder — основа как есть: платформа форм в состав встроенных не входит', async () => {
    const ids = await idsOf(fromProfile(builderProfile));

    expect([...ids].sort()).toEqual([...baseProfile.plugins].sort());
    // Киты и превью-хост едут плагинами приложения — профилем их не назвать.
    expect(ids).not.toContain('reformer.kits');
    expect(ids).not.toContain('reformer.preview');
  });

  it('унаследованное идёт перед своим: порядок склейки доходит до состава', async () => {
    // Markdown объявлен в самом профиле, остальные унаследованы. Порядок обязан быть
    // «основа, потом своё» — тот же, что отдал резолвер.
    const ids = await idsOf(fromProfile(extendedProfile, undefined, lookup));

    expect(ids).toEqual(['reformer.files', 'reformer.editor-monaco', 'reformer.editor-markdown']);
  });

  it('профиль по умолчанию собирает всю карту', async () => {
    // Плагина, который в карте встроенных есть, а в состав по умолчанию не входит, быть
    // не может: всё необязательное уехало в плагины приложения.
    const ids = await idsOf(fromProfile(builderProfile));

    expect([...ids].sort()).toEqual([...BUILTIN_PLUGINS.keys()].sort());
  });

  it('поправки запуска доходят до состава', async () => {
    const ids = await idsOf(fromProfile(shortProfile, { enable: ['reformer.editor-markdown'] }));
    expect([...ids].sort()).toEqual([
      'reformer.editor-markdown',
      'reformer.editor-monaco',
      'reformer.files',
    ]);

    const without = await idsOf(
      fromProfile(builderProfile, {
        disable: ['reformer.editor-markdown', 'reformer.plugin-manager'],
      })
    );
    expect(without).not.toContain('reformer.editor-markdown');
    expect(without).not.toContain('reformer.plugin-manager');
    expect(without).toContain('reformer.files');
  });

  it('неизвестное имя в профиле — отказ при сборке приложения, а не позже', () => {
    // Отказ случается ТУТ ЖЕ, при `fromProfile`, а не внутри `ready` полсекунды спустя:
    // приложение, собранное наполовину, чинить некому.
    const broken = defineProfile({
      id: 'broken',
      name: 'Битый',
      plugins: ['reformer.files', 'markdwn'],
    });

    expect(() => fromProfile(broken)).toThrow(/неизвестный плагин «markdwn»/);
  });

  it('плагин проекта в профиле — такой же отказ: состав называет только встроенных', () => {
    // Движок форм — плагин приложения или проекта и поднимается своим каталогом. Профиль,
    // который называет его по имени, просит то, чего среди встроенных нет.
    const withEngine = defineProfile({
      id: 'with-engine',
      name: 'С движком',
      extends: 'builder',
      plugins: ['reformer.editor-schema'],
    });

    expect(() => fromProfile(withEngine)).toThrow(/неизвестный плагин «reformer.editor-schema»/);
  });

  it('неизвестное имя в поправках запуска — такой же отказ', () => {
    expect(() => fromProfile(shortProfile, { disable: ['markdwn'] })).toThrow(
      /plugins\.disable.*«markdwn»/s
    );
  });

  it('прежнее имя в поправках запуска работает: конфиг человека переименование переживает', async () => {
    // `.ui_builder/config.json` пишет и хранит пользователь, мигрировать его нам нечем.
    // «Без markdown» обязано значить то же самое и через год после смены пространства имён,
    // иначе переименование тихо ВЕРНУЛО бы в состав выключенный плагин.
    const without = await idsOf(fromProfile(builderProfile, { disable: ['editor-markdown'] }));
    expect(without).not.toContain('reformer.editor-markdown');
    expect(without).toContain('reformer.files');

    // Переименование не механическое: «переключатель сочетаний» стал «выбором профиля».
    const wider = await idsOf(fromProfile(shortProfile, { enable: ['reformer.stack-switch'] }));
    expect(wider).toContain('reformer.profile-switch');
  });

  it('имя плагина, уехавшего в плагины приложения, в поправках пропускается со словом в консоль', async () => {
    // Раньше «без китов» было поправкой состава. Киты больше не встроенные, и поправка
    // ничего не значит — но ронять из-за неё настроенный состав нельзя.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const ids = await idsOf(fromProfile(shortProfile, { disable: ['kits'], enable: ['preview'] }));

    expect([...ids].sort()).toEqual(['reformer.editor-monaco', 'reformer.files']);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(String(warn.mock.calls[0]?.[0])).toContain('плагином приложения');
  });

  it('прежнее имя не отменяет отказа на опечатку', () => {
    // Таблица псевдонимов переводит ИЗВЕСТНЫЕ имена и молчит об остальных: подставь она
    // «похожее», опечатка собрала бы работающее приложение не того состава.
    expect(() => fromProfile(shortProfile, { disable: ['editor-markdwn'] })).toThrow(
      /plugins\.disable.*«editor-markdwn»/s
    );
  });

  it('выбран провайдер, который эту возможность не объявляет, — отказ, а не тишина', () => {
    // Резолвер такой выбор просто не применяет: он разбирает данные. Но профиль пишет
    // человек, и при ДВУХ провайдерах его опечатка выглядела бы как жалоба на конфликт,
    // ни словом не упомянув выбор.
    const wrong = defineProfile({
      id: 'wrong-choice',
      name: 'Не тот',
      plugins: ['reformer.files', 'reformer.editor-monaco'],
      providers: { 'reformer.editor': 'reformer.files' },
    });

    expect(() => fromProfile(wrong)).toThrow(
      /«reformer.files» выбран провайдером «reformer.editor»/
    );
  });

  it('выбран провайдер, которого нет в составе, — отказ по имени части', () => {
    const absent = defineProfile({
      id: 'absent-choice',
      name: 'Нет такого',
      plugins: ['reformer.files'],
      providers: { 'reformer.editor': 'reformer.editor-monaco' },
    });

    expect(() => fromProfile(absent)).toThrow(
      /«reformer.editor-monaco».*такой части в составе нет/s
    );
  });

  it('extends разрешается через реестр профилей, а не через переданную основу', async () => {
    // `builder` называет основу именем; найти её умеет только реестр. Собери `fromProfile`
    // состав без него — унаследованных в приложении не было бы вовсе.
    const composition = fromProfile(builderProfile);

    expect((await composition.load()).length).toBe(baseProfile.plugins.length);
    expect(baseProfile.plugins.length).toBeGreaterThan(0);
  });
});
