/**
 * Разрешение профиля: цепочка `extends`, порядок склейки, поправки запуска и отказы.
 *
 * Проверяется ЗДЕСЬ, на выдуманных профилях и выдуманном множестве известных имён, а не
 * на настоящем составе, — и это то, ради чего резолвер отделён от карты встроенных. Круг
 * наследования, опечатку в имени и «основу, которой нет» на настоящем составе выразить
 * нельзя: там все имена верны по построению. Тест на настоящем наборе отвечает на другой
 * вопрос — «кто собрался» (`composer/compose.test`).
 *
 * @module application/resolver/profile-resolver.test
 */

import { describe, expect, it } from 'vitest';
import { defineProfile, type ApplicationProfile } from '../profiles/profile';
import { resolveProfile, resolveProviders } from './profile-resolver';

const KNOWN = ['files', 'monaco', 'validator', 'ai', 'preview'];

const base = defineProfile({ id: 'base', name: 'Основа', plugins: ['files', 'monaco'] });
const middle = defineProfile({
  id: 'middle',
  name: 'Середина',
  extends: 'base',
  plugins: ['validator', 'files'],
});
const top = defineProfile({ id: 'top', name: 'Верх', extends: 'middle', plugins: ['ai'] });

const lookupOf =
  (...profiles: readonly ApplicationProfile[]) =>
  (id: string): ApplicationProfile | undefined =>
    profiles.find((profile) => profile.id === id);

const resolve = (
  profile: ApplicationProfile,
  overrides?: Parameters<typeof resolveProfile>[0]['overrides']
) =>
  resolveProfile({
    profile,
    lookup: lookupOf(base, middle, top),
    known: KNOWN,
    overrides,
  });

describe('resolveProfile', () => {
  it('профиль без наследования отдаёт свой список как есть', () => {
    expect(resolve(base)).toEqual(['files', 'monaco']);
  });

  it('цепочка «extends» разворачивается целиком, от дальней основы к своему списку', () => {
    // Порядок именно такой: сначала то, на чём профиль стоит, потом то, что он добавил.
    // Обратный порядок означал бы, что базовый плагин регистрируется после наследника,
    // и при равных приоритетах редакторов исход зависел бы от глубины цепочки.
    expect(resolve(top)).toEqual(['files', 'monaco', 'validator', 'ai']);
  });

  it('дубликат из основы не переезжает в конец: первое вхождение держит место', () => {
    // `middle` называет `files` повторно. Порядок обязан остаться порядком основы —
    // иначе каждое наследование тасовало бы состав, ничего в него не добавляя.
    expect(resolve(middle)).toEqual(['files', 'monaco', 'validator']);
  });

  it('enable добавляет в конец и не удваивает уже входящего', () => {
    expect(resolve(base, { enable: ['preview', 'files'] })).toEqual(['files', 'monaco', 'preview']);
  });

  it('disable убирает — в том числе то, что пришло из основы', () => {
    expect(resolve(top, { disable: ['monaco'] })).toEqual(['files', 'validator', 'ai']);
  });

  it('disable сильнее enable, как бы поля ни легли в объект', () => {
    expect(resolve(base, { enable: ['preview'], disable: ['preview'] })).toEqual([
      'files',
      'monaco',
    ]);
  });

  it('disable того, кого в составе нет, — не ошибка и не изменение', () => {
    expect(resolve(base, { disable: ['preview'] })).toEqual(['files', 'monaco']);
  });

  it('неизвестный плагин — отказ с именем, а не тихий пропуск', () => {
    // Ровно тот случай, ради которого резолвер бросает: «профиль без ассистента» и «профиль
    // с опечаткой в слове ai» иначе стали бы одним приложением, отличимым только по
    // отсутствующей панели.
    const typo = defineProfile({ id: 'typo', name: 'Опечатка', plugins: ['files', 'aii'] });

    expect(() => resolve(typo)).toThrow(/профиль «typo».*неизвестный плагин «aii»/s);
    expect(() => resolve(base, { enable: ['aii'] })).toThrow(/plugins\.enable.*«aii»/s);
    expect(() => resolve(base, { disable: ['aii'] })).toThrow(/plugins\.disable.*«aii»/s);
  });

  it('отказ перечисляет известные имена: человеку видно, чем опечатка отличается от правды', () => {
    const typo = defineProfile({ id: 'typo', name: 'Опечатка', plugins: ['aii'] });

    expect(() => resolve(typo)).toThrow(/Известны: ai, files, monaco, preview, validator/);
  });

  it('неизвестная основа названа вместе с тем, кто её просил', () => {
    const orphan = defineProfile({ id: 'orphan', name: 'Сирота', extends: 'none', plugins: [] });

    expect(() => resolveProfile({ profile: orphan, lookup: lookupOf(base), known: KNOWN })).toThrow(
      'профиль «orphan» наследует неизвестный профиль «none»'
    );
  });

  it('профиль с extends без реестра получает отказ, а не молчание', () => {
    // `lookup` необязателен — профиль без наследования разрешается и без него. Но профиль
    // С наследованием обязан отличить «основы нет» от «основа пуста».
    expect(() => resolveProfile({ profile: top, known: KNOWN })).toThrow(
      'профиль «top» наследует неизвестный профиль «middle»'
    );
  });

  it('круг в extends называется цепочкой, а не зацикливается', () => {
    // Обход по именам без этой проверки просто не вернулся бы: белый экран без единого
    // слова о причине.
    const left = defineProfile({ id: 'left', name: 'Левый', extends: 'right', plugins: [] });
    const right = defineProfile({ id: 'right', name: 'Правый', extends: 'left', plugins: [] });

    expect(() =>
      resolveProfile({ profile: left, lookup: lookupOf(left, right), known: KNOWN })
    ).toThrow('профиль «left»: круг наследования left → right → left');
  });

  it('профиль, наследующий сам себя, — тот же круг', () => {
    const self = defineProfile({ id: 'self', name: 'Сам', extends: 'self', plugins: [] });

    expect(() => resolveProfile({ profile: self, lookup: lookupOf(self), known: KNOWN })).toThrow(
      'круг наследования self → self'
    );
  });

  it('результат заморожен: состав нельзя поправить у вызывающего', () => {
    const resolved = resolve(base);

    expect(Object.isFrozen(resolved)).toBe(true);
  });
});

describe('resolveProviders', () => {
  const withChoice = defineProfile({
    id: 'with-choice',
    name: 'С выбором',
    plugins: ['preview'],
    providers: { 'reformer.preview.sessions': 'preview', 'acme.telemetry': 'base-telemetry' },
  });
  const heir = defineProfile({
    id: 'heir',
    name: 'Наследник',
    extends: 'with-choice',
    plugins: ['ai'],
    providers: { 'acme.telemetry': 'own-telemetry' },
  });

  it('профиль без выбора отдаёт пусто, а не «что-нибудь по умолчанию»', () => {
    expect(resolveProviders({ profile: base })).toEqual({});
  });

  it('наследник перекрывает выбор основы по ключу, остальное наследует', () => {
    // Ради этого наследование и нужно: профиль, унаследовавший чужой выбор, обязан мочь
    // его изменить, не переписывая соседние.
    expect(resolveProviders({ profile: heir, lookup: lookupOf(withChoice, heir) })).toEqual({
      'reformer.preview.sessions': 'preview',
      'acme.telemetry': 'own-telemetry',
    });
  });

  it('отвечает на неизвестную основу и на круг тем же отказом, что и состав', () => {
    const orphan = defineProfile({ id: 'orphan', name: 'Сирота', extends: 'нет', plugins: [] });

    expect(() => resolveProviders({ profile: orphan, lookup: lookupOf(orphan) })).toThrow(
      'наследует неизвестный профиль «нет»'
    );
  });

  it('результат заморожен: выбор нельзя поправить у вызывающего', () => {
    expect(Object.isFrozen(resolveProviders({ profile: withChoice }))).toBe(true);
  });
});
