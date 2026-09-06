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
  it('объект с корнем — принимается', () => {
    const schema = { version: '1.0', root: { component: '$html(div)' } };

    expect(asFormSchema(schema)).toBe(schema);
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
