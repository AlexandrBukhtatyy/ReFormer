import { describe, expect, it } from 'vitest';

import { createTranspilerRegistry, TranspilerRegistryError, type Transpiler } from './transpilers';

/**
 * Фиктивный движок: вырезает строки, помеченные `//@ts-strip`.
 *
 * Настоящий транспилятор TypeScript здесь не нужен и намеренно не пишется: реестру всё равно,
 * чем компилируют, и тест обязан проверять именно это — что движок выбирается по `applies`
 * и вызывается как чистая функция.
 */
function stripper(id: string, extension: string): Transpiler {
  return {
    id,
    applies: (fileName) => fileName.endsWith(extension),
    transpile: (code) => ({
      js: code
        .split('\n')
        .filter((line) => !line.trimEnd().endsWith('//@ts-strip'))
        .join('\n'),
    }),
  };
}

describe('реестр транспиляторов', () => {
  it('выбирает движок по applies', () => {
    const registry = createTranspilerRegistry();
    registry.register(stripper('ts', '.ts'));
    registry.register(stripper('css', '.css'));

    expect(registry.find('form/model.ts')?.id).toBe('ts');
    expect(registry.find('plugin/styles.css')?.id).toBe('css');
    expect(registry.find('plugin/main.js')).toBeUndefined();
  });

  it('транспилирует как чистая функция — без доступа к чему-либо', () => {
    const registry = createTranspilerRegistry();
    registry.register(stripper('ts', '.ts'));

    const out = registry.find('a.ts')?.transpile('вырезать //@ts-strip\nоставить', 'a.ts');

    expect(out?.js).toBe('оставить');
  });

  it('последний зарегистрированный побеждает — в этом и смысл сменности', () => {
    const registry = createTranspilerRegistry();
    registry.register(stripper('builtin-ts', '.ts'));
    registry.register(stripper('custom-ts', '.ts'));

    expect(registry.find('a.ts')?.id).toBe('custom-ts');
  });

  it('снятие регистрации возвращает предыдущий движок', () => {
    const registry = createTranspilerRegistry();
    registry.register(stripper('builtin-ts', '.ts'));
    const custom = registry.register(stripper('custom-ts', '.ts'));

    custom.dispose();

    expect(registry.find('a.ts')?.id).toBe('builtin-ts');
    expect(registry.list().map((t) => t.id)).toEqual(['builtin-ts']);
  });

  it('отклоняет повторный id: это почти всегда двойная регистрация', () => {
    const registry = createTranspilerRegistry();
    registry.register(stripper('ts', '.ts'));

    expect(() => registry.register(stripper('ts', '.tsx'))).toThrowError(TranspilerRegistryError);
  });

  it('отклоняет пустой id', () => {
    const registry = createTranspilerRegistry();

    expect(() => registry.register(stripper('  ', '.ts'))).toThrowError(TranspilerRegistryError);
  });
});
