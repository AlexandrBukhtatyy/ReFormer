/**
 * Утилиты для работы с датами в валидаторах
 *
 * @group Validation
 * @category Validators
 * @module form/validators/date-utils
 */

/** Дата без времени — формат значения `<input type="date">`. */
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Парсит значение в объект Date
 *
 * Строка `YYYY-MM-DD` — локальная полночь этого дня: `new Date('2024-01-01')` дал бы полночь UTC,
 * и западнее UTC правила дат сравнивали бы предыдущий день. Несуществующая дата (`2023-02-29`)
 * не разбирается — движок перенёс бы её на 1 марта.
 *
 * @param value - Значение для парсинга (Date, string или undefined)
 * @returns Date объект или null если парсинг не удался
 */
export function parseDate(value: string | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string') {
    const isoDate = ISO_DATE.exec(value);
    if (isoDate) return localDate(Number(isoDate[1]), Number(isoDate[2]) - 1, Number(isoDate[3]));
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

/** Локальная полночь дня; `null`, если такого дня в календаре нет. */
function localDate(year: number, month: number, day: number): Date | null {
  const date = new Date(0);
  // `setFullYear`, а не конструктор: `new Date(99, 0, 1)` читает год 99 как 1999.
  date.setFullYear(year, month, day);
  date.setHours(0, 0, 0, 0);
  const exists = date.getFullYear() === year && date.getMonth() === month && date.getDate() === day;
  return exists ? date : null;
}

/**
 * Возвращает сегодняшнюю дату с обнулённым временем
 */
export function getToday(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

/**
 * Нормализует дату, обнуляя время
 */
export function normalizeDate(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

/**
 * Вычисляет полный возраст (в годах) по календарным полям.
 *
 * Считаем по годам/месяцам/дням, а не делением миллисекунд на усреднённый год (365.25 дн): усреднение
 * даёт off-by-one на границе — в день N-летия накопленных реальных дней меньше `N * 365.25`, и `floor`
 * роняет возраст до `N - 1` (т.е. `minAge(18)` ошибочно отклонял 18-летнего в его день рождения).
 */
export function calculateAge(birthDate: Date): number {
  const today = getToday();
  const birth = normalizeDate(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}
