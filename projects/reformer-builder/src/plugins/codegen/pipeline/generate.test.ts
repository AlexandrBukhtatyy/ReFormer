import { describe, expect, it } from 'vitest';
import { builtinKit, foreignKit, plainSchema, wizardSchema } from '@/lib/codegen/__fixtures__/kit';
import { isGenerated, MARKER_PREFIX, originOf, type CodegenInput } from '@/lib/codegen';
import type { CodegenTarget } from '../contract';
import { generateModule } from './generate';
import { BUILTIN_TARGETS } from './targets';

const input = (over: Partial<CodegenInput> = {}): CodegenInput => ({
  schema: over.schema ?? plainSchema(),
  formName: over.formName ?? 'Заявка на кредит',
  kit: over.kit ?? builtinKit(),
  rules: over.rules,
});

const target = (over: Partial<CodegenTarget> & Pick<CodegenTarget, 'id' | 'path'>): CodegenTarget =>
  ({ cls: 'derived', emit: () => 'x\n', ...over }) as CodegenTarget;

describe('прогон целей', () => {
  it('встроенные цели дают канонический состав модуля', async () => {
    const module = await generateModule(BUILTIN_TARGETS, input());
    expect(module.files.map((f) => f.path)).toEqual([
      'renderer.schema.json',
      'types.ts',
      'model.ts',
      'registry.ts',
      'index.tsx',
      'data-sources.ts',
      'renderer.behavior.ts',
      'form.behavior.ts',
      'validation.ts',
      'api.ts',
      'README.md',
    ]);
    expect(module.problems).toEqual([]);
  });

  it('шим визарда появляется только у формы с визардом', async () => {
    const module = await generateModule(BUILTIN_TARGETS, input({ schema: wizardSchema() }));
    expect(module.files.map((f) => f.path)).toContain('renderer.wizard.tsx');
  });

  it('кит без адаптера визарда не даёт файла шима', async () => {
    const kit = foreignKit();
    const module = await generateModule(
      BUILTIN_TARGETS,
      input({
        schema: wizardSchema(),
        kit: { ...kit, kit: { ...kit.kit, adapters: { wizard: null, step: null } } },
      })
    );
    expect(module.files.map((f) => f.path)).not.toContain('renderer.wizard.tsx');
  });

  it('чужая цель добавляет файл, не трогая ни одной существующей строки', async () => {
    const mine = target({ id: 'mine', path: 'CHANGELOG.md', emit: () => 'история\n' });
    const module = await generateModule([...BUILTIN_TARGETS, mine], input());
    expect(module.files.map((f) => f.path)).toContain('CHANGELOG.md');
  });

  it('цель, снятая из реестра, просто не участвует', async () => {
    const without = BUILTIN_TARGETS.filter((t) => t.id !== 'codegen.readme');
    const module = await generateModule(without, input());
    expect(module.files.map((f) => f.path)).not.toContain('README.md');
  });
});

describe('отказы целей названы, а не роняют прогон', () => {
  it('бросок цели убирает ОДИН файл и попадает в отчёт', async () => {
    const broken = target({
      id: 'broken',
      path: 'broken.ts',
      emit: () => {
        throw new Error('сломалась');
      },
    });
    const module = await generateModule([...BUILTIN_TARGETS, broken], input());
    expect(module.files.map((f) => f.path)).not.toContain('broken.ts');
    expect(module.files.length).toBe(11);
    expect(module.problems).toEqual([
      { targetId: 'broken', path: 'broken.ts', reason: 'threw', message: 'сломалась' },
    ]);
  });

  it('вторая цель на тот же путь отвергается, а не переписывает первую молча', async () => {
    const impostor = target({ id: 'impostor', path: 'types.ts', emit: () => 'подмена\n' });
    const module = await generateModule([...BUILTIN_TARGETS, impostor], input());
    const types = module.files.find((f) => f.path === 'types.ts');
    expect(types?.targetId).toBe('codegen.types');
    expect(module.problems[0]).toMatchObject({ targetId: 'impostor', reason: 'duplicate-path' });
  });

  it('путь наружу каталога модуля отвергается', async () => {
    const escaping = [
      target({ id: 'up', path: '../secrets.env' }),
      target({ id: 'abs', path: '/etc/passwd' }),
    ];
    const module = await generateModule(escaping, input());
    expect(module.files).toEqual([]);
    expect(module.problems.map((p) => p.reason)).toEqual(['escaping-path', 'escaping-path']);
  });

  it('бросок в applies не отменяет остальные цели', async () => {
    const moody = target({
      id: 'moody',
      path: 'moody.ts',
      applies: () => {
        throw new Error('не решил');
      },
    });
    const module = await generateModule([moody, ...BUILTIN_TARGETS], input());
    expect(module.problems[0]).toMatchObject({ targetId: 'moody', reason: 'threw' });
    expect(module.files.length).toBe(11);
  });
});

describe('маркеры происхождения', () => {
  it('производные и выводимые из правил несут маркер, авторские — нет', async () => {
    const module = await generateModule(BUILTIN_TARGETS, input());
    const by = (path: string) => module.files.find((f) => f.path === path)?.content ?? '';
    expect(isGenerated(by('types.ts'))).toBe(true);
    expect(isGenerated(by('validation.ts'))).toBe(true);
    expect(originOf(by('api.ts'))).toBe('handwritten');
    expect(originOf(by('data-sources.ts'))).toBe('handwritten');
  });

  it('схема остаётся РАЗБИРАЕМЫМ json: маркер туда не ставится', async () => {
    // Отказ был ровно здесь: `renderer.schema.json` уезжал со строкой `// @reformer-generated`
    // первой, то есть переставал быть JSON. Редактор схемы такой файл не брал (вкладка
    // открывалась голым текстом), и сгенерированный `index.tsx`, который импортирует эту же
    // схему, тоже не собрался бы.
    const module = await generateModule(BUILTIN_TARGETS, input());
    const schema = module.files.find((f) => f.path === 'renderer.schema.json')?.content ?? '';

    expect(schema.startsWith(MARKER_PREFIX)).toBe(false);
    expect(() => JSON.parse(schema)).not.toThrow();
    expect(JSON.parse(schema)).toHaveProperty('root');
  });

  it('маркер считается ПОСЛЕ форматирования, иначе он не сойдётся с телом', async () => {
    const module = await generateModule(BUILTIN_TARGETS, input(), async (files) =>
      files.map((f) => `${f.content}// причёсано\n`)
    );
    const types = module.files.find((f) => f.path === 'types.ts')?.content ?? '';
    expect(types).toContain('// причёсано');
    expect(isGenerated(types)).toBe(true);
  });
});

describe('детерминизм', () => {
  it('два прогона на одной схеме дают побайтово одно и то же', async () => {
    const a = await generateModule(BUILTIN_TARGETS, input());
    const b = await generateModule(BUILTIN_TARGETS, input());
    expect(JSON.stringify(a.files)).toBe(JSON.stringify(b.files));
  });
});
