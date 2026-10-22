import { describe, expect, it } from 'vitest';
import { overlayDataSources } from './index';

describe('значения источников поверх выдуманных', () => {
  const mock = { model: {}, dataSources: { CITIES: [{ value: 'option1', label: 'Cities 1' }] } };

  it('заменяют значения источника, на который ссылается схема', () => {
    const real = [{ value: 'msk', label: 'Москва' }];
    expect(overlayDataSources(mock, { CITIES: real }).dataSources).toEqual({ CITIES: real });
  });

  it('чужие имена и пустой набор мок не меняют', () => {
    expect(overlayDataSources(mock, { OTHER: [] })).toBe(mock);
    expect(overlayDataSources(mock, undefined)).toBe(mock);
  });
});
