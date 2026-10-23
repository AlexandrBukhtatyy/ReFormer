/**
 * Цели из проекта, напечатанные настоящим стеком ReFormer: применимость над его видом, цели по
 * шагам, замены со сдвинутым путём и шаблоны прежнего контракта.
 *
 * @module plugins/reformer/codegen/cross/user-targets.test
 */

import { describe, expect, it } from 'vitest';
import { buildView, prepare } from '../../../core/codegen';
import { builtinKit, plainSchema, wizardSchema } from '../../../core/testing';
import type { CodegenTarget } from '@reformer/builder-plugin-api';
import { ejectTemplate } from '../commands/eject';
import { discoverUserTargets, USER_TARGETS_DIR } from '../pipeline/user-targets';
import { overrideProblems, targetsFor } from '../stacks';
import { createFakeHost } from '../testing';
import { generateModule } from '../stack/generate';
import { BUILTIN_TARGETS, reformerStack, reformerStacks } from './harness';

const ROOT = 'fake:';
const DIR = [ROOT, ...USER_TARGETS_DIR].join('/');

const file = (header: string, body = 'тело\n'): string => `---\n${header}\n---\n${body}`;

function hostWith(files: Record<string, string>) {
  return createFakeHost({ root: ROOT, files });
}

function ctxOf(schema = plainSchema()) {
  return prepare({ schema, formName: 'Заявка на кредит', kit: builtinKit() });
}

/** Что напечатает стек ReFormer из этого списка: его цели и общие, без заменённых. */
const printed = (targets: readonly CodegenTarget[]) => targetsFor(targets, reformerStack());

/** Предупреждения о заменах — с устареванием, которое узнаёт стек ReFormer. */
const drift = (targets: readonly CodegenTarget[]) => overrideProblems(targets, reformerStacks());

describe('применимость спрашивается на ВИДЕ', () => {
  it('выражение видит те же данные, что и шаблон', async () => {
    const found = await discoverUserTargets(
      hostWith({
        [`${DIR}/w.eta`]: file(
          '{ "id": "w", "path": "w.ts", "cls": "derived", "applies": "it.layout.isWizard" }'
        ),
      })
    );
    const applies = found.targets[0]?.appliesView;
    expect(applies?.(buildView(ctxOf(wizardSchema())))).toBe(true);
    expect(applies?.(buildView(ctxOf()))).toBe(false);
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
    expect(found.targets[0]?.appliesView?.(buildView(ctxOf()))).toBe(false);
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
    const problems = drift([builtinRegistry, user]);
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
    expect(drift([builtinStep, user])[0]?.message).toMatch(/each/);
  });

  it('замена с иным путём, но не плоским — предупреждение, что модуль импортирует другое', () => {
    const user: CodegenTarget = {
      id: 'user.registry',
      overrides: 'codegen.registry',
      path: 'schema/components.ts',
      cls: 'derived',
      template: 'u',
    };
    const problems = drift([builtinRegistry, user]);
    expect(problems[0]?.message).toMatch(/печатает «schema\/components\.ts» вместо/);
    // Такая замена — решение человека, а не устаревший шаблон: она действует.
    expect(printed([builtinRegistry, user]).map((t) => t.id)).toEqual(['user.registry']);
  });

  it('замена по тому же пути — молчит', () => {
    const user: CodegenTarget = {
      id: 'user.registry',
      overrides: 'codegen.registry',
      path: 'schema/registry.ts',
      cls: 'derived',
      template: 'u',
    };
    expect(drift([builtinRegistry, user])).toEqual([]);
    // Порядок в списке значения не имеет: реестр отдаёт вклады по `order`.
    expect(drift([user, builtinRegistry])).toEqual([]);
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
    const targets = printed([...BUILTIN_TARGETS, staleRegistry, staleShim, staleStepRender]);
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
    const problems = drift([...BUILTIN_TARGETS, staleRegistry, staleShim, staleStepRender]);
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
    expect(drift(all)).toEqual([]);
    const module = await generateModule(printed(all), {
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
