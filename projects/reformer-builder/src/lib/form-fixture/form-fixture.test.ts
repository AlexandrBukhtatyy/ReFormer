/**
 * Тесты чистой части фикстур: адреса, слияние слоёв, подменяемое окружение, печать скелета.
 *
 * @module lib/form-fixture/form-fixture.test
 */

import { describe, expect, it } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';

import {
  createAmbient,
  createFixedDate,
  createFixedMath,
  createFixtureFetch,
  deepMerge,
  emitFixture,
  FIXTURE_FILE,
  fixtureDirOf,
  fixturePathOf,
  isFixturePath,
  joinFixtureDir,
  mergeFormData,
  resolveNow,
  ruleMatches,
} from './index';
import type { FormMock } from '../form-mock';

describe('адрес фикстуры', () => {
  it('лежит рядом с формой, в каталоге её схемы', () => {
    expect(fixturePathOf('src/forms/credit/schema.json')).toBe('src/forms/credit/fixture.ts');
    expect(fixtureDirOf('src/forms/credit/schema.json')).toBe('src/forms/credit');
  });

  it('две одноимённые формы в разных ветках не сталкиваются', () => {
    const first = fixturePathOf('src/a/credit/schema.json');
    const second = fixturePathOf('src/b/credit/schema.json');

    expect(first).not.toBe(second);
  });

  it('схема в корне проекта тоже получает адрес — без ведущего слэша', () => {
    expect(fixturePathOf('schema.json')).toBe('fixture.ts');
    expect(joinFixtureDir(fixtureDirOf('schema.json')!, FIXTURE_FILE)).toBe('fixture.ts');
  });

  it('ОТКАЗЫВАЕТ на пути, вылезающем за корень проекта', () => {
    expect(fixturePathOf('../../secrets/schema.json')).toBeNull();
    expect(fixtureDirOf('')).toBeNull();
  });

  it('нормализует разделители и лишние сегменты', () => {
    expect(fixturePathOf('src\\forms\\.\\credit\\schema.json')).toBe('src/forms/credit/fixture.ts');
  });

  it('узнаёт свои пути по ИМЕНИ файла: графы фикстуры и формы собираются врозь', () => {
    expect(isFixturePath('src/forms/credit/fixture.ts')).toBe(true);
    // Отбор сайдкаров спрашивает голым именем — оно тоже обязано узнаваться.
    expect(isFixturePath('fixture.ts')).toBe(true);
    expect(isFixturePath('src/forms/credit/model.ts')).toBe(false);
    // Каталог с таким именем — ещё не файл фикстуры.
    expect(isFixturePath('src/forms/fixture.ts/model.ts')).toBe(false);
  });
});

describe('слияние слоёв данных', () => {
  const synthesized: FormMock = {
    model: { applicant: { age: null, name: '' }, amount: null },
    dataSources: { CITY_LIST: [{ value: 'option1', label: 'City list 1' }] },
  };

  it('фикстура СТАРШЕ model.ts', () => {
    const merged = mergeFormData(
      synthesized,
      { applicant: { name: 'из model.ts' } },
      { model: { applicant: { name: 'из фикстуры' } } }
    );

    // Иначе проверка «как форма выглядит с пустой моделью» была бы невыразима.
    expect((merged.model.applicant as Record<string, unknown>).name).toBe('из фикстуры');
  });

  it('синтез остаётся базой: путь, не названный ни в одном слое, не теряется', () => {
    const merged = mergeFormData(synthesized, { amount: 100 }, { model: {} });

    // Без начального значения у поля не было бы сигнала вовсе.
    expect((merged.model.applicant as Record<string, unknown>).age).toBeNull();
    expect(merged.model.amount).toBe(100);
  });

  it('источники данных заменяются целиком, а не сливаются вглубь', () => {
    const merged = mergeFormData(synthesized, undefined, { dataSources: { CITY_LIST: [] } });

    // Список из одной опции, перекрытый пустым, обязан стать пустым.
    expect(merged.dataSources.CITY_LIST).toEqual([]);
  });

  it('без фикстуры и без model.ts отдаёт синтез как есть', () => {
    const merged = mergeFormData(synthesized, undefined, null);

    expect(merged.model).toEqual(synthesized.model);
    expect(merged.dataSources).toEqual(synthesized.dataSources);
  });

  it('массивы в модели заменяются целиком', () => {
    const merged = deepMerge({ list: [1, 2, 3] }, { list: [9] });

    expect(merged.list).toEqual([9]);
  });
});

describe('ambient: перехват запросов', () => {
  const rules = [
    { method: 'GET', url: '/api/cities', respond: { json: [{ id: 1 }] } },
    { url: /\/api\/regions/, respond: { status: 404, text: 'нет' } },
  ];

  it('подходящее правило отвечает своим телом', async () => {
    const fetchImpl = createFixtureFetch(rules);

    const response = await fetchImpl('https://host/api/cities');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([{ id: 1 }]);
    expect(response.headers.get('content-type')).toBe('application/json');
  });

  it('адрес-строка совпадает по вхождению: базовый URL приложения нам неизвестен', () => {
    expect(ruleMatches(rules[0], 'GET', 'https://example.test/api/cities?page=1')).toBe(true);
    expect(ruleMatches(rules[0], 'POST', 'https://example.test/api/cities')).toBe(false);
  });

  it('несовпавший запрос ОТКЛОНЯЕТСЯ, а не уходит в сеть', async () => {
    const fetchImpl = createFixtureFetch(rules);

    await expect(fetchImpl('https://host/api/unknown')).rejects.toThrow(/не описан в фикстуре/);
  });

  it('задержка ответа воспроизводится: состояние загрузки иначе не увидеть', async () => {
    const waited: number[] = [];
    const fetchImpl = createFixtureFetch(
      [{ url: '/slow', respond: { json: {}, delayMs: 300 } }],
      (ms) => {
        waited.push(ms);
        return Promise.resolve();
      }
    );

    await fetchImpl('https://host/slow');

    expect(waited).toEqual([300]);
  });
});

describe('ambient: время и случайность', () => {
  it('фиксирует «сейчас», не ломая остальной Date', () => {
    const fixed = createFixedDate(Date.parse('2026-01-01T00:00:00Z'));

    expect(fixed.now()).toBe(Date.parse('2026-01-01T00:00:00Z'));
    expect(new fixed().toISOString()).toBe('2026-01-01T00:00:00.000Z');
    // Всё, что не «сейчас», обязано остаться собой.
    expect(new fixed('2020-05-05T00:00:00Z').toISOString()).toBe('2020-05-05T00:00:00.000Z');
    expect(fixed.parse('2020-01-01T00:00:00Z')).toBe(Date.parse('2020-01-01T00:00:00Z'));
    expect(fixed.UTC(2020, 0, 1)).toBe(Date.UTC(2020, 0, 1));
    expect(new fixed() instanceof Date).toBe(true);
  });

  it('фиксирует random, не ломая остальной Math', () => {
    const fixed = createFixedMath([0.1, 0.2]);

    expect(fixed.random()).toBe(0.1);
    expect(fixed.random()).toBe(0.2);
    // По кругу — чтобы длина последовательности не решала, сколько раз форме можно спросить.
    expect(fixed.random()).toBe(0.1);
    expect(fixed.max(3, 7)).toBe(7);
    expect(fixed.floor(2.9)).toBe(2);
  });

  it('момент читается и из ISO-строки, и из миллисекунд', () => {
    expect(resolveNow('2026-01-01T00:00:00Z')).toBe(Date.parse('2026-01-01T00:00:00Z'));
    expect(resolveNow(1000)).toBe(1000);
    expect(Number.isNaN(resolveNow('не дата'))).toBe(true);
  });

  it('подменяет ТОЛЬКО объявленное: за что не просили, того и не подставляем', () => {
    expect(createAmbient(null)).toEqual({});
    expect(createAmbient({})).toEqual({});
    expect(Object.keys(createAmbient({ http: [] }))).toEqual(['fetch']);
    expect(Object.keys(createAmbient({ clock: { now: 0 } }))).toEqual(['Date']);
    expect(Object.keys(createAmbient({ clock: { now: 0, random: 0.5 } })).sort()).toEqual([
      'Date',
      'Math',
    ]);
  });

  it('негодная дата не подменяет ничего: Invalid Date искали бы в форме, а не в фикстуре', () => {
    expect(createAmbient({ clock: { now: 'вчера' } })).toEqual({});
  });
});

describe('печать скелета', () => {
  const schema: JsonFormSchema = {
    root: {
      component: '$component(Form)',
      children: [
        { value: '$model(applicant.name)', component: '$component(Input)' },
        {
          value: '$model(city)',
          component: '$component(Select)',
          componentProps: { options: '$dataSource(CITY_LIST)' },
        },
      ],
    },
  } as unknown as JsonFormSchema;

  it('печатает рабочий модуль с моделью и источниками', () => {
    const text = emitFixture(schema);

    expect(text).toContain('export const fixture = {');
    expect(text).toContain('model:');
    expect(text).toContain('CITY_LIST');
    // Остальные слои показаны заготовками — что тут можно написать, видно сразу.
    expect(text).toContain("'./api': { submitForm");
    expect(text).toContain('// clock:');
  });

  it('схема без источников не печатает пустой блок', () => {
    const bare = {
      root: { component: '$component(Form)', children: [] },
    } as unknown as JsonFormSchema;

    expect(emitFixture(bare)).toContain('в схеме нет ни одного $dataSource');
  });

  it('детерминирована: два вызова дают один текст', () => {
    expect(emitFixture(schema)).toBe(emitFixture(schema));
  });
});
