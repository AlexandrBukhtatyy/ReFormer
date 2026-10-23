import { describe, expect, it } from 'vitest';
import {
  builtinKit,
  foreignKit,
  plainSchema,
  wizardSchema,
  wizardSlugsSchema,
  wizardSplitSource,
} from '../../../core/testing';
import { isGenerated, MARKER_PREFIX, originOf } from '@reformer/builder-toolkit';
import { type CodegenInput } from '../../../core/codegen';
import type { CodegenTarget } from '../contract';
import { generateModule } from './generate';
import { BUILTIN_TARGETS } from './targets';

const input = (over: Partial<CodegenInput> = {}): CodegenInput => ({
  schema: over.schema ?? plainSchema(),
  formName: over.formName ?? 'Заявка на кредит',
  kit: over.kit ?? builtinKit(),
  rules: over.rules,
  ...(over.schemaPath === undefined ? {} : { schemaPath: over.schemaPath }),
  ...(over.origins === undefined ? {} : { origins: over.origins }),
});

const target = (over: Partial<CodegenTarget> & Pick<CodegenTarget, 'id' | 'path'>): CodegenTarget =>
  ({ cls: 'derived', emit: () => 'x\n', ...over }) as CodegenTarget;

/** Состав модуля простой формы — папки по ролям. */
const PLAIN_FILES = [
  'schema/form.schema.json',
  'types/zayavka-na-kredit.ts',
  'model/initial-value.ts',
  'model/model.ts',
  'schema/registry.ts',
  'application/create.ts',
  'application/entry.ts',
  'ZayavkaNaKreditForm.tsx',
  'index.ts',
  'constants/zayavka-na-kredit.ts',
  'behavior/index.ts',
  'validation/form.ts',
  'validation/messages.ts',
  'application/submit.ts',
  'api/index.ts',
  'README.md',
];

const FLOW = 'flow/zayavka-na-kredit-flow.ts';

describe('прогон целей', () => {
  it('встроенные цели дают канонический состав модуля', async () => {
    const module = await generateModule(BUILTIN_TARGETS, input());
    expect(module.files.map((f) => f.path)).toEqual(PLAIN_FILES);
    expect(module.problems).toEqual([]);
  });

  it('поток шагов появляется только у формы с визардом', async () => {
    // Прежде у визарда появлялся переходник приложения (`wizard.tsx`). Его больше нет — визард
    // библиотечный; файл, которым визард отличается от простой формы, — поток шагов.
    const module = await generateModule(BUILTIN_TARGETS, input({ schema: wizardSchema() }));
    expect(module.files.map((f) => f.path)).toContain(FLOW);
    expect(module.files.map((f) => f.path)).not.toContain('wizard.tsx');
  });

  it('у визарда правила каждого шага — в своём файле validation/, порядок — в потоке', async () => {
    const module = await generateModule(BUILTIN_TARGETS, input({ schema: wizardSchema() }));
    const paths = module.files.map((f) => f.path);
    // Агрегатора шагов (`steps/index.ts`) больше нет: шаги по порядку перечисляет поток.
    expect(paths).not.toContain('steps/index.ts');
    const flow = module.files.find((f) => f.path === FLOW)?.content ?? '';
    // Единственный шаг помещается в строку — так его оставит форматтер.
    expect(flow).toContain("steps: [{ id: 'shag-1-section', rules: shag1Rules }],");
    // Файл шага знает свой шаг: README и меню группируют по нему.
    const stepFiles = module.files.filter((f) => f.step !== undefined).map((f) => f.path);
    expect(stepFiles).toEqual(['validation/shag-1.ts']);
    expect(module.problems).toEqual([]);
  });

  it('у простой формы нет ни потока, ни файлов шагов', async () => {
    const module = await generateModule(BUILTIN_TARGETS, input());
    expect(module.files.some((f) => f.step !== undefined)).toBe(false);
    expect(module.files.some((f) => f.path.startsWith('flow/'))).toBe(false);
    // В `validation/` у простой формы два файла формы: правила и тексты замечаний.
    expect(module.files.filter((f) => f.path.startsWith('validation/')).map((f) => f.path)).toEqual(
      ['validation/form.ts', 'validation/messages.ts']
    );
  });

  it('раскладку визарда решает схема, а не кит: без адаптера поток и правила шагов всё равно печатаются', async () => {
    const kit = foreignKit();
    const module = await generateModule(
      BUILTIN_TARGETS,
      input({
        schema: wizardSchema(),
        kit: { ...kit, kit: { ...kit.kit, adapters: { wizard: null, step: null } } },
      })
    );
    expect(module.files.map((f) => f.path)).toContain(FLOW);
    expect(module.files.map((f) => f.path)).toContain('validation/shag-1.ts');
  });

  it('кит без адаптера визарда: импорта визарда нет, визард и шаг — заглушки с причиной', async () => {
    // Прежде это был вопрос «печатать ли файл шима». Шима нет ни у какого кита; у кита без
    // адаптера реестр не импортирует визард из чужого пакета, а ставит заглушку.
    const kit = foreignKit();
    const module = await generateModule(
      BUILTIN_TARGETS,
      input({
        schema: wizardSchema(),
        kit: { ...kit, kit: { ...kit.kit, adapters: { wizard: null, step: null } } },
      })
    );
    expect(module.files.map((f) => f.path)).not.toContain('wizard.tsx');
    const registry = module.files.find((f) => f.path === 'schema/registry.ts')?.content ?? '';
    expect(registry).toContain(
      "reg.component('Wizard', Placeholder); // TODO: кит «HexaUI» не поставляет адаптер визарда"
    );
    expect(registry).toContain("reg.component('Step', Placeholder);");
    expect(registry).not.toContain('@reformer/cdk/form-wizard');
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

describe('путь цели — шаблон с токенами', () => {
  it('токены формы: {Type}, {dir}, {schema}, {schemaDir} — в любом месте пути', async () => {
    const targets = [
      target({ id: 'a', path: '{Type}.stories.tsx' }),
      target({ id: 'b', path: 'docs/{dir}-notes.md' }),
      target({ id: 'c', path: '{schema}.bak' }),
      target({ id: 'd', path: '{schemaDir}meta.json' }),
    ];
    const module = await generateModule(targets, input());
    expect(module.problems).toEqual([]);
    expect(module.files.map((f) => f.path)).toEqual([
      'ZayavkaNaKreditForm.stories.tsx',
      'docs/zayavka-na-kredit-notes.md',
      'schema/form.schema.json.bak',
      'schema/meta.json',
    ]);
  });

  it('{schemaDir} пуст, когда документ лежит в корне модуля', async () => {
    const targets = [
      target({ id: 'c', path: '{schema}.bak' }),
      target({ id: 'd', path: '{schemaDir}meta.json' }),
    ];
    const module = await generateModule(targets, input({ schemaPath: 'form.schema.json' }));
    expect(module.files.map((f) => f.path)).toEqual(['form.schema.json.bak', 'meta.json']);
  });

  it('{step} — не обязательно целым сегментом: по файлу на шаг', async () => {
    const targets = [
      target({ id: 'rules', path: 'validation/{step}.ts', each: 'step' }),
      target({ id: 'notes', path: 'notes/step-{step}.md', each: 'step' }),
    ];
    const module = await generateModule(targets, input({ schema: wizardSlugsSchema() }));
    expect(module.problems).toEqual([]);
    expect(module.files.map((f) => f.path)).toEqual([
      'validation/kontakty.ts',
      'validation/kontakty-2.ts',
      'validation/step-3.ts',
      'notes/step-kontakty.md',
      'notes/step-kontakty-2.md',
      'notes/step-step-3.md',
    ]);
  });

  it('{stepDir} — папка схемы шага: по ней ложатся файлы шагов разбитого визарда', async () => {
    const targets = [target({ id: 'x', path: '{schemaDir}steps/{stepDir}/NOTE.md', each: 'step' })];
    const module = await generateModule(targets, input(wizardSplitSource()));
    expect(module.files.map((f) => f.path)).toEqual([
      'schema/steps/anketa/NOTE.md',
      'schema/steps/kontakty/NOTE.md',
    ]);
  });

  it('токены подставляются и в прежние имена цели', async () => {
    const targets = [
      target({ id: 'x', path: '{schema}', legacyPaths: ['{schemaDir}renderer.schema.json'] }),
    ];
    const nested = await generateModule(targets, input());
    expect(nested.files[0]?.legacyPaths).toEqual(['schema/renderer.schema.json']);
    const flat = await generateModule(targets, input({ schemaPath: 'form.schema.json' }));
    expect(flat.files[0]?.legacyPaths).toEqual(['renderer.schema.json']);
  });

  it('документ в корне модуля: схема на месте, код — по папкам ролей', async () => {
    const module = await generateModule(BUILTIN_TARGETS, input({ schemaPath: 'form.schema.json' }));
    const paths = module.files.map((f) => f.path);
    expect(paths).toContain('form.schema.json');
    expect(paths).not.toContain('schema/form.schema.json');
    expect(paths).toContain('schema/registry.ts');
    // Импорты считаются от фактического места документа.
    const create = module.files.find((f) => f.path === 'application/create.ts')?.content ?? '';
    expect(create).toContain("import rawSchema from '../form.schema.json';");
  });

  it('токен шага у цели без each и цель each без токена шага — отказ шаблона пути', async () => {
    const module = await generateModule(
      [
        target({ id: 'loose', path: 'validation/{step}.ts' }),
        target({ id: 'same', path: 'validation/all.ts', each: 'step' }),
      ],
      input({ schema: wizardSchema() })
    );
    expect(module.files).toEqual([]);
    expect(module.problems.map((p) => [p.targetId, p.reason])).toEqual([
      ['loose', 'bad-pattern'],
      ['same', 'bad-pattern'],
    ]);
  });

  it('неизвестный токен — отказ с перечнем известных, а не файл с фигурными скобками', async () => {
    const module = await generateModule([target({ id: 'typo', path: 'types/{name}.ts' })], input());
    expect(module.files).toEqual([]);
    expect(module.problems[0]).toMatchObject({ targetId: 'typo', reason: 'bad-pattern' });
    expect(module.problems[0]?.message).toContain('{name}');
    expect(module.problems[0]?.message).toContain('{dir}');
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
    expect(module.files.length).toBe(PLAIN_FILES.length);
    expect(module.problems).toEqual([
      { targetId: 'broken', path: 'broken.ts', reason: 'threw', message: 'сломалась' },
    ]);
  });

  it('вторая цель на тот же путь отвергается, а не переписывает первую молча', async () => {
    const impostor = target({
      id: 'impostor',
      path: 'types/zayavka-na-kredit.ts',
      emit: () => 'подмена\n',
    });
    const module = await generateModule([...BUILTIN_TARGETS, impostor], input());
    const types = module.files.find((f) => f.path === 'types/zayavka-na-kredit.ts');
    expect(types?.targetId).toBe('codegen.types');
    expect(module.problems[0]).toMatchObject({ targetId: 'impostor', reason: 'duplicate-path' });
  });

  it('дубль ловится после подстановки токенов: разные шаблоны — один файл', async () => {
    const impostor = target({ id: 'impostor', path: 'types/{dir}.ts', emit: () => 'подмена\n' });
    const literal = target({ id: 'literal', path: 'types/zayavka-na-kredit.ts' });
    const module = await generateModule([literal, impostor], input());
    expect(module.files.map((f) => f.targetId)).toEqual(['literal']);
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
    expect(module.files.length).toBe(PLAIN_FILES.length);
  });
});

describe('маркеры происхождения', () => {
  it('производные и выводимые из правил несут маркер, авторские — нет', async () => {
    const module = await generateModule(BUILTIN_TARGETS, input());
    const by = (path: string) => module.files.find((f) => f.path === path)?.content ?? '';
    expect(isGenerated(by('types/zayavka-na-kredit.ts'))).toBe(true);
    expect(isGenerated(by('application/create.ts'))).toBe(true);
    expect(isGenerated(by('validation/form.ts'))).toBe(true);
    expect(isGenerated(by('behavior/index.ts'))).toBe(true);
    expect(originOf(by('api/index.ts'))).toBe('handwritten');
    expect(originOf(by('application/submit.ts'))).toBe('handwritten');
    expect(originOf(by('constants/zayavka-na-kredit.ts'))).toBe('handwritten');
  });

  it('схема остаётся РАЗБИРАЕМЫМ json: маркер туда не ставится', async () => {
    // Отказ был ровно здесь: документ формы уезжал со строкой `// @reformer-generated`
    // первой, то есть переставал быть JSON. Редактор схемы такой файл не брал (вкладка
    // открывалась голым текстом), и сборка формы, которая импортирует эту же схему, тоже
    // не собралась бы.
    const module = await generateModule(BUILTIN_TARGETS, input());
    const schema = module.files.find((f) => f.path === 'schema/form.schema.json')?.content ?? '';

    expect(schema.startsWith(MARKER_PREFIX)).toBe(false);
    expect(() => JSON.parse(schema)).not.toThrow();
    expect(JSON.parse(schema)).toHaveProperty('root');
  });

  it('маркер считается ПОСЛЕ форматирования, иначе он не сойдётся с телом', async () => {
    const module = await generateModule(BUILTIN_TARGETS, input(), async (files) =>
      files.map((f) => `${f.content}// причёсано\n`)
    );
    const types = module.files.find((f) => f.path === 'types/zayavka-na-kredit.ts')?.content ?? '';
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
