/**
 * Сквозная проверка live-превью на «рыбах» билдера: исходники каталога → компиляция → бандл →
 * работающая форма.
 *
 * Это тест контракта между шаблонами формы и превью. Если шаблон переименует экспорт или сменит
 * форму `validationOptions`, здесь и рванёт — раньше, чем пользователь увидит «форма не
 * отрабатывает» без объяснений.
 *
 * @module reformer-builder/preview-runtime/live/live-form.test
 */

import { describe, expect, it } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';
import {
  apiTsTemplate,
  dataSourcesTsTemplate,
  formBehaviorTsTemplate,
  formJsonTemplate,
  modelTsTemplate,
  registryTsTemplate,
  renderBehaviorTsTemplate,
  typesTsTemplate,
  validationTsTemplate,
} from '../../app/form-templates';
import {
  wizardAdapterTsxTemplate,
  wizardDataSourcesTsTemplate,
  wizardFormBehaviorTsTemplate,
  wizardFormJsonTemplate,
  wizardModelTsTemplate,
  wizardRegistryTsTemplate,
  wizardRenderBehaviorTsTemplate,
  wizardTypesTsTemplate,
  wizardValidationTsTemplate,
} from '../../app/wizard-templates';
import { buildLivePreview } from './build-live-preview';
import { compileForm } from './compile-form';
import type { FormSources } from './sibling-sources';
import type { FormRules } from '../../model/rules';

/** Каталог простой формы так, как его отдаёт шаблон билдера. */
function simpleFormSources(): FormSources {
  return {
    dir: 'forms/sample',
    files: {
      'types.ts': typesTsTemplate('sample'),
      'model.ts': modelTsTemplate('sample'),
      'validation.ts': validationTsTemplate('sample'),
      'form.behavior.ts': formBehaviorTsTemplate('sample'),
      'renderer.behavior.ts': renderBehaviorTsTemplate('sample'),
      'data-sources.ts': dataSourcesTsTemplate('sample'),
      'api.ts': apiTsTemplate('sample'),
      'registry.ts': registryTsTemplate('sample'),
    },
    fromEditor: [],
  };
}

const schema = (): JsonFormSchema => JSON.parse(formJsonTemplate()) as JsonFormSchema;

/** Дождаться микротаска: статус-операции behavior core выполняет отложенно (`runOutsideEffect`). */
const tick = (): Promise<void> => new Promise((resolve) => queueMicrotask(resolve));

/** Форма данных «рыбы» простой формы (`model.ts` шаблона). */
interface SimpleShape extends Record<string, unknown> {
  name: string;
  email: string;
  contactMethod: string;
  greeting: string;
}

/** Форма данных «рыбы» визарда. */
interface WizardShape extends Record<string, unknown> {
  fullName: string;
  email: string;
  city: string;
  address: string;
  agree: boolean;
}

describe('live-превью на шаблоне простой формы', () => {
  it('каталог компилируется без ошибок и отдаёт весь контракт', async () => {
    const compiled = await compileForm(simpleFormSources());
    expect(compiled.errors).toEqual([]);

    const bundle = buildLivePreview<SimpleShape>({ schema: schema(), compiled, dataSources: {} });
    expect(bundle.errors).toEqual([]);
    expect(bundle.applied).toEqual([
      'model',
      'validation',
      'behavior',
      'renderBehavior',
      'registry',
    ]);
  });

  it('поведение из form.behavior.ts работает на живой модели', async () => {
    const compiled = await compileForm(simpleFormSources());
    const bundle = buildLivePreview<SimpleShape>({ schema: schema(), compiled, dataSources: {} });

    expect(bundle.model.$.greeting.value).toBe('');
    bundle.model.$.name.value = 'Мир';
    expect(bundle.model.$.greeting.value).toBe('Привет, Мир!');
  });

  it('стратегия берётся из validationOptions, а не из дефолта core', async () => {
    const compiled = await compileForm(simpleFormSources());
    const bundle = buildLivePreview<SimpleShape>({ schema: schema(), compiled, dataSources: {} });
    expect(bundle.strategy).toBe('afterFirstSubmit');
  });

  it('прогон валидации отмечает пустые обязательные поля', async () => {
    const compiled = await compileForm(simpleFormSources());
    const bundle = buildLivePreview<SimpleShape>({ schema: schema(), compiled, dataSources: {} });

    expect(await bundle.validateAll?.()).toBe(false);
    expect(bundle.form.email.errors.value.length).toBeGreaterThan(0);

    bundle.model.$.name.value = 'Иван';
    bundle.model.$.email.value = 'ivan@example.com';
    expect(await bundle.validateAll?.()).toBe(true);
    expect(bundle.form.email.errors.value).toEqual([]);
  });

  it('модель стартует пустой: initialFormModel, а не представительный мок', async () => {
    const compiled = await compileForm(simpleFormSources());
    const bundle = buildLivePreview<SimpleShape>({ schema: schema(), compiled, dataSources: {} });
    expect(bundle.model.get()).toMatchObject({ name: '', email: '', greeting: '' });
  });

  it('правки панели «Засев» перекрывают initialFormModel', async () => {
    const compiled = await compileForm(simpleFormSources());
    const bundle = buildLivePreview<SimpleShape>({
      schema: schema(),
      compiled,
      dataSources: {},
      modelOverride: { email: 'seed@example.com' },
    });
    expect(bundle.model.$.email.value).toBe('seed@example.com');
    expect(bundle.model.$.name.value).toBe('');
  });

  it('битый файл не мешает остальным: ошибка адресна, поведение живо', async () => {
    const sources = simpleFormSources();
    sources.files['validation.ts'] = 'export const formValidation = ;';

    const compiled = await compileForm(sources);
    expect(compiled.errors).toHaveLength(1);
    expect(compiled.errors[0]).toMatchObject({ file: 'validation.ts', phase: 'transpile' });

    const bundle = buildLivePreview<SimpleShape>({ schema: schema(), compiled, dataSources: {} });
    expect(bundle.applied).toContain('behavior');
    expect(bundle.applied).not.toContain('validation');
    bundle.model.$.name.value = 'Мир';
    expect(bundle.model.$.greeting.value).toBe('Привет, Мир!');
  });

  it('без каталога превью остаётся data-only, но не падает', async () => {
    const compiled = await compileForm({ dir: 'forms/sample', files: {}, fromEditor: [] });
    const bundle = buildLivePreview<SimpleShape>({ schema: schema(), compiled, dataSources: {} });
    expect(bundle.applied).toEqual([]);
    expect(bundle.validation).toBeNull();
    expect(bundle.model.get()).toMatchObject({ name: '', email: '' });
  });

  // Шаблоны переехали на каноничные имена (form.behavior.ts / renderer.behavior.ts), но формы,
  // сгенерированные прежними версиями билдера, лежат у людей на дисках — превью обязано их поднимать.
  it('дефисные имена прежних шаблонов по-прежнему подхватываются', async () => {
    const compiled = await compileForm({
      dir: 'forms/legacy',
      files: {
        'types.ts': typesTsTemplate('sample'),
        'model.ts': modelTsTemplate('sample'),
        'validation.ts': validationTsTemplate('sample'),
        'form-behavior.ts': formBehaviorTsTemplate('sample'),
        'render-behavior.ts': renderBehaviorTsTemplate('sample'),
        'data-sources.ts': dataSourcesTsTemplate('sample'),
        'registry.ts': registryTsTemplate('sample'),
      },
      fromEditor: [],
    });
    expect(compiled.errors).toEqual([]);

    const bundle = buildLivePreview<SimpleShape>({ schema: schema(), compiled, dataSources: {} });
    expect(bundle.errors).toEqual([]);
    expect(bundle.applied).toEqual([
      'model',
      'validation',
      'behavior',
      'renderBehavior',
      'registry',
    ]);
    bundle.model.$.name.value = 'Мир';
    expect(bundle.model.$.greeting.value).toBe('Привет, Мир!');
  });
});

/** Каталог пошаговой формы: JSX-адаптер и фабрика renderer.behavior вместо константы. */
function wizardFormSources(): FormSources {
  return {
    dir: 'forms/wizard',
    files: {
      'types.ts': wizardTypesTsTemplate('sample'),
      'model.ts': wizardModelTsTemplate('sample'),
      'validation.ts': wizardValidationTsTemplate('sample'),
      'form.behavior.ts': wizardFormBehaviorTsTemplate('sample'),
      'renderer.behavior.ts': wizardRenderBehaviorTsTemplate('sample'),
      'data-sources.ts': wizardDataSourcesTsTemplate('sample'),
      'api.ts': apiTsTemplate('sample'),
      'registry.ts': wizardRegistryTsTemplate('sample'),
      'renderer.wizard.tsx': wizardAdapterTsxTemplate('sample'),
    },
    fromEditor: [],
  };
}

describe('live-превью на шаблоне пошаговой формы', () => {
  it('JSX-адаптер компилируется, фабрика renderer.behavior вызывается с формой и моделью', async () => {
    const compiled = await compileForm(wizardFormSources());
    expect(compiled.errors).toEqual([]);
    // registry.ts импортирует ./renderer.wizard — значит относительный TSX-импорт резолвится и исполняется.
    expect(Object.keys(compiled.modules)).toContain('renderer.wizard.tsx');

    const wizardSchema = JSON.parse(wizardFormJsonTemplate()) as JsonFormSchema;
    const bundle = buildLivePreview<WizardShape>({
      schema: wizardSchema,
      compiled,
      dataSources: {},
    });
    expect(bundle.errors).toEqual([]);
    expect(bundle.applied).toContain('renderBehavior');
    expect(bundle.renderBehavior).toBeTypeOf('function');
    expect(bundle.strategy).toBe('blur');
  });

  it('поведение шага работает: адрес недоступен, пока пуст город', async () => {
    const compiled = await compileForm(wizardFormSources());
    const wizardSchema = JSON.parse(wizardFormJsonTemplate()) as JsonFormSchema;
    const bundle = buildLivePreview<WizardShape>({
      schema: wizardSchema,
      compiled,
      dataSources: {},
    });

    // Статус-операции behavior (`enableWhen` → `node.disable()`) core откладывает на микротаск
    // (`runOutsideEffect`), поэтому проверяем после него, а не сразу за присваиванием.
    await tick();
    expect(bundle.form.address.disabled.value).toBe(true);

    bundle.model.$.city.value = 'Москва';
    await tick();
    expect(bundle.form.address.disabled.value).toBe(false);
  });
});

/**
 * Второй контракт, который обязан сходиться, — между КОДОГЕНОМ билдера и живым превью.
 *
 * Шаблоны из `app/*-templates.ts` (выше) и `codegen/*` — разные производители одного и того же
 * каталога, и имена экспортов у них разошлись: шаблон печатает `formRenderBehavior`, кодоген —
 * фабрику `createJsonRenderBehavior`. Пока превью знало только про первое, форма, экспортированная
 * билдером, рендерилась БЕЗ submit и без `hideWhen` — и молча: отсутствие артефакта ошибкой не
 * считается, в панели «Сборка» не появлялось ничего.
 */
describe('live-превью на выходе кодогена', () => {
  /** Каталог так, как его получает пользователь после «экспортировать пример». */
  async function codegenSources(rules?: FormRules): Promise<{
    sources: FormSources;
    schema: JsonFormSchema;
  }> {
    const { buildExampleFiles } = await import('../../codegen');
    const { synthMock } = await import('../mock-synth');
    const { exampleSchema } = await import('../../codegen/__fixtures__/example-schema');

    const mock = synthMock(exampleSchema, { now: new Date('2026-01-01T00:00:00Z') });
    const out = buildExampleFiles(exampleSchema, mock, 'loan', rules);

    const files: Record<string, string> = {};
    for (const f of out) {
      // Те же правила отбора, что у `sibling-sources`: только исполняемое, без страницы-обёртки.
      if (!/\.tsx?$/.test(f.path) || f.path.startsWith('index.')) continue;
      files[f.path] = f.content;
    }
    // Схема берётся ИЗ выхода: селекторы проставляет `assignSelectors`, и `renderer.behavior.ts`
    // адресует узлы именно ими. Исходная схема здесь дала бы промах `schema.node()`.
    const emitted = out.find((f) => f.path === 'renderer.schema.json')!.content;
    return { sources: { dir: 'forms/loan', files, fromEditor: [] }, schema: JSON.parse(emitted) };
  }

  it('подключает валидацию и поведение UI', async () => {
    const { sources, schema: emitted } = await codegenSources();
    const compiled = await compileForm(sources);
    expect(compiled.errors).toEqual([]);

    const bundle = buildLivePreview({ schema: emitted, compiled, dataSources: {} });
    expect(bundle.errors).toEqual([]);
    expect(bundle.applied).toContain('validation');
    expect(bundle.applied).toContain('renderBehavior');
  });

  it('каталог с правилами тоже подключается целиком', async () => {
    const rules: FormRules = {
      validation: [{ target: 'amount', rules: ['required'] }],
      behavior: [],
      render: [],
    };
    const { sources, schema: emitted } = await codegenSources(rules);
    const compiled = await compileForm(sources);
    expect(compiled.errors).toEqual([]);

    const bundle = buildLivePreview({ schema: emitted, compiled, dataSources: {} });
    expect(bundle.errors).toEqual([]);
    expect(bundle.applied).toContain('validation');
    expect(bundle.applied).toContain('renderBehavior');
  });
});
