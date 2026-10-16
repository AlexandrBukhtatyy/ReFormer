/**
 * Зонд часового пояса: ISO-строки даты `YYYY-MM-DD` в правилах дат.
 *
 * `new Date('2024-01-01')` по спецификации разбирает строку «только дата» как полночь UTC, а
 * правила сравнивают ЛОКАЛЬНЫЕ календарные дни. Западнее Гринвича полночь UTC — ещё вчерашний вечер:
 * дата сдвигалась на день назад, и правило на границе отвечало неверно — `minDate` отсекал саму
 * границу, `minAge` пропускал того, кому 18 исполнится только завтра ([ReFormer-nxod]). Теперь
 * `parseDate` читает такую строку как локальную полночь. Других строк правила не разбирают
 * (строгий формат [ReFormer-iioz]) — контрольный кейс: дата-время пропускается в любом поясе.
 *
 * Пояс меняется в процессе: Node перечитывает `process.env.TZ` при присваивании, `getTimezoneOffset`
 * и `Intl` следуют сразу (проверено: pool `forks` — отдельный процесс на файл). Поэтому все даты
 * создаются ВНУТРИ тестов, после `beforeAll`. Предусловие проверяется `skip(условие)` в теле теста:
 * `it.skipIf` вычисляется при сборе тестов, ещё до `beforeAll`. Если смена пояса не применилась
 * (другой pool, среда без данных ICU) — тесты пропускаются, а не краснеют.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { futureDate } from '../../../src/form/validators/future-date';
import { maxAge } from '../../../src/form/validators/max-age';
import { maxDate } from '../../../src/form/validators/max-date';
import { minAge } from '../../../src/form/validators/min-age';
import { minDate } from '../../../src/form/validators/min-date';
import { pastDate } from '../../../src/form/validators/past-date';
import { useFakeClock } from '../../test-utils/async';

const ZONE = 'America/New_York';
const NOT_APPLIED = `process.env.TZ = '${ZONE}' не применился в этом воркере`;

let originalTz: string | undefined;

/** Пояс западнее UTC: полночь UTC — ещё вчера по местному времени. */
const westOfUtc = (): boolean => new Date(2024, 0, 1).getTimezoneOffset() > 0;

beforeAll(() => {
  originalTz = process.env.TZ;
  process.env.TZ = ZONE;
});

afterAll(() => {
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
});

describe('date-utils — ISO-строки дат западнее UTC (America/New_York)', () => {
  beforeEach(() => useFakeClock(new Date(2024, 5, 15, 12)));
  afterEach(() => vi.useRealTimers());

  it('предусловие: пояс сменился, полночь UTC 1 января — ещё 31 декабря', ({ skip }) => {
    skip(!westOfUtc(), NOT_APPLIED);
    expect(new Date('2024-01-01').getDate()).toBe(31);
  });

  it('контроль: дата-время — не дата, правила пропускают её и западнее UTC [ReFormer-iioz]', ({
    skip,
  }) => {
    skip(!westOfUtc(), NOT_APPLIED);
    expect([
      minDate(new Date(2024, 0, 2))('2024-01-01T00:00'),
      futureDate()('2024-06-14T00:00'),
      minAge(18)('2006-06-16T00:00'),
    ]).toEqual([null, null, null]);
  });

  it("minDate: '2024-01-01' не раньше границы 1 января [ReFormer-nxod]", ({ skip }) => {
    skip(!westOfUtc(), NOT_APPLIED);
    expect(minDate(new Date(2024, 0, 1))('2024-01-01')).toBeNull();
  });

  it("maxDate: '2024-01-02' позже границы 1 января [ReFormer-nxod]", ({ skip }) => {
    skip(!westOfUtc(), NOT_APPLIED);
    expect(maxDate(new Date(2024, 0, 1))('2024-01-02')?.code).toBe('date_max');
  });

  it("pastDate: завтрашняя '2024-06-16' — дата в будущем [ReFormer-nxod]", ({ skip }) => {
    skip(!westOfUtc(), NOT_APPLIED);
    expect(pastDate()('2024-06-16')?.code).toBe('date_future');
  });

  it("futureDate: сегодняшняя '2024-06-15' не в прошлом [ReFormer-nxod]", ({ skip }) => {
    skip(!westOfUtc(), NOT_APPLIED);
    expect(futureDate()('2024-06-15')).toBeNull();
  });

  it("minAge(18): рождённому '2006-06-16' ещё 17 [ReFormer-nxod]", ({ skip }) => {
    skip(!westOfUtc(), NOT_APPLIED);
    expect(minAge(18)('2006-06-16')?.code).toBe('date_min_age');
  });

  it("maxAge(65): рождённому '1958-06-16' ещё 65 [ReFormer-nxod]", ({ skip }) => {
    skip(!westOfUtc(), NOT_APPLIED);
    expect(maxAge(65)('1958-06-16')).toBeNull();
  });
});
