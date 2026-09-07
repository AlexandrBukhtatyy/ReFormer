import { describe, expect, it } from 'vitest';
import { parentOf, resolve } from './resource-path';

describe('путевая арифметика портов', () => {
  it('поднимается к каталогу', () => {
    expect(parentOf('mem:src/forms/credit.json')).toBe('mem:src/forms');
  });

  it('у ресурса в корне родитель — сам корень, а не выход за источник', () => {
    expect(parentOf('mem:credit.json')).toBe('mem:');
  });

  it('приписывает имена к каталогу', () => {
    expect(resolve('mem:src/forms', 'credit', 'model.ts')).toBe('mem:src/forms/credit/model.ts');
  });

  it('за корень источника выйти нельзя: отказ, а не молчаливое схлопывание', () => {
    // Схлопни мы молча до корня — «запиши на два уровня выше» стало бы «запиши в корень
    // проекта», и промах адресации превратился бы в запись не туда без признака.
    expect(() => resolve('mem:src', '..', '..', '..', 'etc/passwd')).toThrow(/выходит за корень/);
  });

  it('`..` внутри границ разрешается обычным образом', () => {
    expect(resolve('mem:src/forms', '..', 'shared', 'model.ts')).toBe('mem:src/shared/model.ts');
  });

  it('источник сохраняется', () => {
    expect(resolve('other:a', 'b')).toBe('other:a/b');
  });
});
