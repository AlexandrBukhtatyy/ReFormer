/**
 * Цели из проекта: обнаружение, отказы разбора, переопределение встроенных.
 *
 * @module plugins/reformer/codegen/pipeline/user-targets.test
 */

import { describe, expect, it } from 'vitest';
import { prepare } from '../../../core/codegen';
import { builtinKit, plainSchema, wizardSchema } from '../../../core/testing';
import { ejectTemplate } from '../commands/eject';
import type { CodegenTarget } from '../contract';
import { createFakeHost } from '../testing';
import { generateModule } from './generate';
import { BUILTIN_TARGETS } from './targets';
import {
  applyOverrides,
  discoverUserTargets,
  overrideDrift,
  USER_TARGETS_DIR,
} from './user-targets';

const ROOT = 'fake:';
const DIR = [ROOT, ...USER_TARGETS_DIR].join('/');

const file = (header: string, body = 'тело\n'): string => `---\n${header}\n---\n${body}`;

function hostWith(files: Record<string, string>) {
  return createFakeHost({ root: ROOT, files });
}

function ctxOf(schema = plainSchema()) {
  return prepare({ schema, formName: 'Заявка на кредит', kit: builtinKit() });
}

describe('обнаружение', () => {
  it('читает `.eta` из каталога проекта и делает из них цели', async () => {
    const found = await discoverUserTargets(
      hostWith({
        [`${DIR}/registry.eta`]: file(
          '{ "id": "user.registry", "path": "registry.ts", "cls": "derived" }',
          'моя привязка\n'
        ),
      })
    );
    expect(found.problems).toEqual([]);
    expect(found.targets).toHaveLength(1);
    expect(found.targets[0]).toMatchObject({
      id: 'user.registry',
      path: 'registry.ts',
      cls: 'derived',
      origin: 'user',
      template: 'моя привязка\n',
    });
  });

  it('порядок обхода источника не влияет на состав: файлы сортируются по имени', async () => {
    const found = await discoverUserTargets(
      hostWith({
        [`${DIR}/z.eta`]: file('{ "id": "z", "path": "z.ts", "cls": "user" }'),
        [`${DIR}/a.eta`]: file('{ "id": "a", "path": "a.ts", "cls": "user" }'),
      })
    );
    expect(found.targets.map((t) => t.id)).toEqual(['a', 'z']);
  });

  it('файлы не той природы игнорируются молча — это не отказ', async () => {
    const found = await discoverUserTargets(
      hostWith({ [`${DIR}/README.md`]: '# заметка', [`${DIR}/.gitignore`]: '*' })
    );
    expect(found).toMatchObject({ targets: [], problems: [] });
  });

  it('нет каталога — нет целей, и это не авария', async () => {
    const found = await discoverUserTargets(hostWith({}));
    expect(found).toMatchObject({ targets: [], problems: [] });
  });

  it('без корня проекта пользовательских целей нет вовсе', async () => {
    // Порт вправе не отдавать корень (названная неполнота). Тогда фича просто отсутствует,
    // а встроенные цели работают — деградация, а не поломка.
    const found = await discoverUserTargets(createFakeHost({}));
    expect(found.targets).toEqual([]);
  });
});

describe('отказы называются файлом, а не проглатываются', () => {
  it('битый заголовок — проблема с именем файла', async () => {
    const found = await discoverUserTargets(hostWith({ [`${DIR}/bad.eta`]: 'без заголовка\n' }));
    expect(found.targets).toEqual([]);
    expect(found.problems).toHaveLength(1);
    expect(found.problems[0]).toMatchObject({ path: 'bad.eta', reason: 'template-invalid' });
  });

  it('несобираемое `applies` — тоже отказ, а не цель, падающая при печати', async () => {
    const found = await discoverUserTargets(
      hostWith({
        [`${DIR}/x.eta`]: file(
          '{ "id": "x", "path": "x.ts", "cls": "user", "applies": "it.wizard !== " }'
        ),
      })
    );
    expect(found.targets).toEqual([]);
    expect(found.problems[0]?.message).toMatch(/applies/);
  });

  it('повтор id ловится здесь, а не броском реестра на активации', async () => {
    // Реестр вкладов на повторном явном ключе БРОСАЕТ. Дойди повтор до него — упала бы
    // активация плагина целиком, то есть из-за одного чужого файла исчез бы весь кодоген.
    const found = await discoverUserTargets(
      hostWith({
        [`${DIR}/a.eta`]: file('{ "id": "dup", "path": "a.ts", "cls": "user" }'),
        [`${DIR}/b.eta`]: file('{ "id": "dup", "path": "b.ts", "cls": "user" }'),
      })
    );
    expect(found.targets).toHaveLength(1);
    expect(found.problems[0]?.message).toMatch(/dup/);
  });

  it('отказ одного файла не уносит остальные', async () => {
    const found = await discoverUserTargets(
      hostWith({
        [`${DIR}/bad.eta`]: 'мусор\n',
        [`${DIR}/good.eta`]: file('{ "id": "good", "path": "g.ts", "cls": "user" }'),
      })
    );
    expect(found.targets.map((t) => t.id)).toEqual(['good']);
    expect(found.problems).toHaveLength(1);
  });
});

describe('применимость спрашивается на ВИДЕ', () => {
  it('выражение видит те же данные, что и шаблон', async () => {
    const found = await discoverUserTargets(
      hostWith({
        [`${DIR}/w.eta`]: file(
          '{ "id": "w", "path": "w.ts", "cls": "derived", "applies": "it.layout.isWizard" }'
        ),
      })
    );
    const applies = found.targets[0]?.applies;
    expect(applies?.(ctxOf(wizardSchema()))).toBe(true);
    expect(applies?.(ctxOf())).toBe(false);
  });

  it('выражение, вернувшее не-булево, читается как «не применяется»', async () => {
    // Иначе цель с недописанным условием (`it.names.dir` вместо `it.names.dir === 'loan'`)
    // печаталась бы всегда, и отказ выглядел бы как лишний файл в модуле, а не как ошибка в
    // выражении.
    const found = await discoverUserTargets(
      hostWith({
        [`${DIR}/w.eta`]: file(
          '{ "id": "w", "path": "w.ts", "cls": "derived", "applies": "it.names.dir" }'
        ),
      })
    );
    expect(found.targets[0]?.applies?.(ctxOf())).toBe(false);
  });
});

describe('переопределение', () => {
  const target = (id: string, over: Partial<CodegenTarget> = {}): CodegenTarget => ({
    id,
    path: `${id}.ts`,
    cls: 'derived',
    emit: () => '',
    ...over,
  });

  it('цель, объявившая overrides, снимает названную', () => {
    const kept = applyOverrides([
      target('codegen.registry'),
      target('codegen.types'),
      target('user.registry', { overrides: 'codegen.registry' }),
    ]);
    expect(kept.map((t) => t.id)).toEqual(['codegen.types', 'user.registry']);
  });

  it('переопределение несуществующей цели никого не трогает', () => {
    const all = [target('codegen.types'), target('user.x', { overrides: 'нет-такой' })];
    expect(applyOverrides(all)).toHaveLength(2);
  });

  it('без переопределений список возвращается тем же — лишней работы нет', () => {
    const all = [target('a'), target('b')];
    expect(applyOverrides(all)).toBe(all);
  });
});

describe('цель по шагам из проекта — each: step', () => {
  it('«each» доезжает до цели, и печать размножает её по шагам визарда', async () => {
    const found = await discoverUserTargets(
      hostWith({
        [`${DIR}/step-note.eta`]: file(
          '{ "id": "user.step-note", "path": "steps/{step}/NOTE.md", "each": "step", "cls": "derived" }',
          'шаг <%= it.step.index %>\n'
        ),
      })
    );
    expect(found.problems).toEqual([]);
    expect(found.targets[0]).toMatchObject({ each: 'step', path: 'steps/{step}/NOTE.md' });

    const module = await generateModule(found.targets, {
      schema: wizardSchema(),
      formName: 'Визард',
      kit: builtinKit(),
    });
    expect(module.problems).toEqual([]);
    const notes = module.files.filter((f) => f.targetId === 'user.step-note');
    expect(notes.length).toBe(module.context.layout.steps.length);
    expect(notes.length).toBeGreaterThan(0);
    expect(notes.every((f) => /^steps\/[^/]+\/NOTE\.md$/.test(f.path))).toBe(true);
  });

  it('у простой формы цель по шагам не печатает ничего', async () => {
    const target: CodegenTarget = {
      id: 'u.step',
      path: 'steps/{step}/x.ts',
      each: 'step',
      cls: 'derived',
      template: 'x',
    };
    const module = await generateModule([target], {
      schema: plainSchema(),
      formName: 'Простая',
      kit: builtinKit(),
    });
    expect(module.files).toEqual([]);
    expect(module.problems).toEqual([]);
  });
});

describe('замена со сдвинутым путём — override-path-drift', () => {
  const builtinRegistry: CodegenTarget = {
    id: 'codegen.registry',
    path: 'schema/registry.ts',
    cls: 'derived',
    template: 'b',
  };
  const builtinStep: CodegenTarget = {
    id: 'codegen.step-validation',
    path: 'validation/{step}.ts',
    each: 'step',
    cls: 'user',
    template: 'b',
  };

  it('замена с путём прежней плоской раскладки — предупреждение с подсказкой', () => {
    // Прежде здесь стоял шаблон, выгруженный до переименования `renderer.behavior.ts` →
    // `form.render.ts`. Той цели больше нет; тот же отказ сегодня — шаблон, выгруженный до
    // перехода на папки ролей: путь в заголовке остался плоским.
    const user: CodegenTarget = {
      id: 'user.registry',
      overrides: 'codegen.registry',
      path: 'registry.ts',
      cls: 'derived',
      template: 'u',
    };
    const problems = overrideDrift([builtinRegistry, user]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({
      targetId: 'user.registry',
      path: 'registry.ts',
      reason: 'override-path-drift',
    });
    expect(problems[0]?.message).toMatch(/прежнюю плоскую раскладку.*schema\/registry\.ts/);
    expect(problems[0]?.message).toMatch(/Выгрузите шаблон заново/);
  });

  it('замена по шагам без «each» — тоже сдвиг', () => {
    const user: CodegenTarget = {
      id: 'user.step-validation',
      overrides: 'codegen.step-validation',
      path: 'validation/{step}.ts',
      cls: 'user',
      template: 'u',
    };
    expect(overrideDrift([builtinStep, user])[0]?.message).toMatch(/each/);
  });

  it('замена с иным путём, но не плоским — предупреждение, что модуль импортирует другое', () => {
    const user: CodegenTarget = {
      id: 'user.registry',
      overrides: 'codegen.registry',
      path: 'schema/components.ts',
      cls: 'derived',
      template: 'u',
    };
    const problems = overrideDrift([builtinRegistry, user]);
    expect(problems[0]?.message).toMatch(/печатает «schema\/components\.ts» вместо/);
    // Такая замена — решение человека, а не устаревший шаблон: она действует.
    expect(applyOverrides([builtinRegistry, user]).map((t) => t.id)).toEqual(['user.registry']);
  });

  it('замена по тому же пути — молчит', () => {
    const user: CodegenTarget = {
      id: 'user.registry',
      overrides: 'codegen.registry',
      path: 'schema/registry.ts',
      cls: 'derived',
      template: 'u',
    };
    expect(overrideDrift([builtinRegistry, user])).toEqual([]);
    // Порядок в списке значения не имеет: реестр отдаёт вклады по `order`.
    expect(overrideDrift([user, builtinRegistry])).toEqual([]);
  });
});

describe('шаблон, выгруженный под прежний контракт, не роняет генерацию', () => {
  /** Тело прежнего шаблона реестра: читает поля вида, которых больше нет. */
  const STALE_BODY = "import { Wizard } from '<%= it.layout.imports.wizard %>';\n";

  const staleRegistry: CodegenTarget = {
    id: 'user.registry',
    overrides: 'codegen.registry',
    path: 'registry.ts',
    cls: 'derived',
    template: STALE_BODY,
    origin: 'user',
  };
  const staleShim: CodegenTarget = {
    id: 'user.wizard',
    overrides: 'codegen.wizard',
    path: 'wizard.tsx',
    cls: 'derived',
    template: '<%= it.wizard.symbol %>\n',
    origin: 'user',
  };
  const staleStepRender: CodegenTarget = {
    id: 'user.step-render',
    overrides: 'codegen.step-render',
    path: 'steps/{step}/form.render.ts',
    each: 'step',
    cls: 'user',
    template: '<%= it.step.render.imports.join() %>\n',
    origin: 'user',
  };

  it('устаревшая замена не побеждает: модуль печатается встроенными целями целиком', async () => {
    const targets = applyOverrides([...BUILTIN_TARGETS, staleRegistry, staleShim, staleStepRender]);
    expect(targets.map((t) => t.id)).toEqual(BUILTIN_TARGETS.map((t) => t.id));

    const module = await generateModule(targets, {
      schema: wizardSchema(),
      formName: 'Визард',
      kit: builtinKit(),
    });
    // Ни отказа печати, ни файлов прежней раскладки, ни дыры на месте встроенной цели.
    expect(module.problems).toEqual([]);
    const paths = module.files.map((f) => f.path);
    expect(paths).toContain('schema/registry.ts');
    expect(paths).not.toContain('registry.ts');
    expect(paths).not.toContain('wizard.tsx');
    expect(paths.some((p) => p.endsWith('form.render.ts'))).toBe(false);
    expect(module.files.find((f) => f.path === 'schema/registry.ts')?.origin).toBe('builtin');
  });

  it('и каждая названа находкой с понятным текстом', () => {
    const problems = overrideDrift([...BUILTIN_TARGETS, staleRegistry, staleShim, staleStepRender]);
    expect(problems.map((p) => [p.targetId, p.reason])).toEqual([
      ['user.registry', 'override-path-drift'],
      ['user.wizard', 'override-path-drift'],
      ['user.step-render', 'override-path-drift'],
    ]);
    const [registry, shim, stepRender] = problems.map((p) => p.message);
    // Живая цель, прежний путь: что печатает шаблон, что импортирует модуль, что делать.
    expect(registry).toContain('«registry.ts»');
    expect(registry).toContain('«schema/registry.ts»');
    expect(registry).toContain('Шаблон не применён');
    // Снятая цель: чего больше нет и что пришло на смену.
    expect(shim).toContain('«codegen.wizard», которой больше нет');
    expect(shim).toContain('schema/registry.ts');
    expect(stepRender).toContain('«codegen.step-render», которой больше нет');
    expect(stepRender).toContain('behavior/index.ts');
  });

  it('свежевыгруженный шаблон той же цели — действует и молчит', async () => {
    const host = hostWith({});
    const outcome = await ejectTemplate({ host, targets: () => BUILTIN_TARGETS }, 'codegen.types');
    expect(outcome.kind).toBe('written');
    const found = await discoverUserTargets(host);
    expect(found.problems).toEqual([]);

    const all = [...BUILTIN_TARGETS, ...found.targets];
    expect(overrideDrift(all)).toEqual([]);
    const module = await generateModule(applyOverrides(all), {
      schema: plainSchema(),
      formName: 'Заявка на кредит',
      kit: builtinKit(),
    });
    expect(module.problems).toEqual([]);
    // Путь в заголовке выгружен шаблоном (`types/{dir}.ts`) — файл лёг туда же, куда клала
    // встроенная цель, и печатает его уже файл человека.
    const types = module.files.find((f) => f.path === 'types/zayavka-na-kredit.ts');
    expect(types).toMatchObject({ targetId: 'user.types', origin: 'user' });
  });
});
