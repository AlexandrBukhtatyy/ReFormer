import { describe, expect, it } from 'vitest';
import * as reexport from './mock';
import * as domain from '@/lib/form-mock';

describe('мок превью — реэкспорт домена, а не копия', () => {
  it('отдаёт ТЕ ЖЕ функции, а не одноимённые', () => {
    // Сравнение по ссылке, а не по имени: копия прошла бы проверку на наличие экспорта
    // и разошлась бы молча — ровно это и случилось, копии успели разъехаться на 29 строк.
    expect(reexport.synthMock).toBe(domain.synthMock);
    expect(reexport.defaultForField).toBe(domain.defaultForField);
    expect(reexport.collectFieldDefaults).toBe(domain.collectFieldDefaults);
  });
});
