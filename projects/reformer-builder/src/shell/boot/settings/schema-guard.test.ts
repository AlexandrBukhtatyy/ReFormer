/**
 * Проверка схемы, пришедшей от плагина.
 *
 * Смысл проверки — не пустить в рендерер то, что схемой не является вовсе. Настоящую
 * непригодность ловит сборка формы и показывает словами; здесь отсекается мусор, на котором
 * конвертер выдал бы стену текста из своих недр.
 *
 * @module shell/boot/settings/schema-guard.test
 */

import { describe, expect, it } from 'vitest';
import { asFormSchema } from './schema-guard';

describe('схема настроек плагина', () => {
  it('схема формата 2 принимается той же ссылкой', () => {
    const schema = { format: 2, version: '1.0', root: { component: '$html(div)' } };

    expect(asFormSchema(schema)).toBe(schema);
  });

  it('схема прежнего формата переводится в формат 2', () => {
    // Плагин, написанный до формата 2, обязан работать без правок: единая сборка прежний
    // документ не собирает.
    const legacy = {
      version: '1.0',
      root: {
        component: '$html(div)',
        children: [{ component: '$component(Input)', value: '$model(endpoint)' }],
      },
    };

    expect(asFormSchema(legacy)).toEqual({
      format: 2,
      version: '1.0',
      root: {
        component: '$html(div)',
        children: [{ component: '$component(Input)', model: '$model(endpoint)' }],
      },
    });
  });

  it('перевод один на объект вклада: ссылка стабильна между вызовами', () => {
    // Проверка зовётся на каждый кадр, а форма настроек пересобирается на смену ссылки схемы:
    // новый объект на каждый вызов отнимал бы фокус у поля на первом же символе.
    const legacy = { version: '1.0', root: { component: '$component(Input)', value: '$model(x)' } };

    expect(asFormSchema(legacy)).toBe(asFormSchema(legacy));
  });

  it('без корня — не схема: конвертеру нечего строить', () => {
    expect(asFormSchema({ version: '1.0' })).toBeNull();
  });

  it.each([
    ['null', null],
    ['строка', 'root'],
    ['число', 42],
    ['массив', [{ root: {} }]],
    ['undefined', undefined],
  ])('%s — не схема', (_name, value) => {
    expect(asFormSchema(value)).toBeNull();
  });
});
