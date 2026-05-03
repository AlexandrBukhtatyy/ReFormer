/**
 * Утилиты для работы с датами в валидаторах
 *
 * @group Validation
 * @category Validators
 * @module validators/date-utils
 */

/**
 * Парсит значение в объект Date
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
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
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
 * Вычисляет возраст на основе даты рождения
 */
export function calculateAge(birthDate: Date): number {
  const today = getToday();
  return Math.floor((today.getTime() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}
