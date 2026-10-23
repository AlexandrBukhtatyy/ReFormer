import { describe, expect, it } from 'vitest';
import { DEFAULT_SCHEMA_PATH, fileRoleOf, schemaDirOf } from '../../../core/codegen/layout';
import { BUILTIN_TARGETS } from './targets';

/** Подставить в шаблон пути цели имена образцовой формы — так, как это делает прогон. */
function samplePath(template: string): string {
  return template
    .replaceAll('{schemaDir}', schemaDirOf(DEFAULT_SCHEMA_PATH))
    .replaceAll('{schema}', DEFAULT_SCHEMA_PATH)
    .replaceAll('{stepDir}', 'kontakty')
    .replaceAll('{step}', 'kontakty')
    .replaceAll('{dir}', 'loan-application')
    .replaceAll('{Type}', 'LoanApplicationForm');
}

describe('fileRoleOf ↔ встроенные цели кодогена', () => {
  // Роль файла ассистент читает из раскладки ядра, а перепечатывает файлы кодоген по своим
  // целям. Разойдись они — ассистент обещал бы «этот файл кодоген не тронет» про файл, который
  // следующая генерация перезапишет.
  it.each(BUILTIN_TARGETS.map((target) => [target.id, target] as const))('%s', (_id, target) => {
    const path = samplePath(target.path);
    const role = fileRoleOf(path, DEFAULT_SCHEMA_PATH);
    const expected =
      target.id === 'codegen.schema'
        ? 'form'
        : path.endsWith('/form.schema.json')
          ? 'step'
          : target.cls === 'derived'
            ? 'derived'
            : target.regenerable === true
              ? 'regenerable'
              : 'user';
    expect(role, path).toBe(expected);
  });
});
