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
  formBehaviorTsTemplate,
  formJsonTemplate,
  modelTsTemplate,
  registryTsTemplate,
  renderBehaviorTsTemplate,
  validationTsTemplate,
} from '../../app/form-templates';
import {
  wizardAdapterTsxTemplate,
  wizardFormBehaviorTsTemplate,
  wizardFormJsonTemplate,
  wizardModelTsTemplate,
  wizardRegistryTsTemplate,
  wizardRenderBehaviorTsTemplate,
  wizardValidationTsTemplate,
} from '../../app/wizard-templates';
import { buildLivePreview } from './build-live-preview';
import { compileForm } from './compile-form';
import type { FormSources } from './sibling-sources';

/** Каталог простой формы так, как его отдаёт шаблон билдера. */
function simpleFormSources(): FormSources {
  return {
    dir: 'forms/sample',
    files: {
      'model.ts': modelTsTemplate('sample'),
      'validation.ts': validationTsTemplate('sample'),
      'form-behavior.ts': formBehaviorTsTemplate('sample'),
      'render-behavior.ts': renderBehaviorTsTemplate('sample'),
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

  it('поведение из form-behavior.ts работает на живой модели', async () => {
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
});

/** Каталог пошаговой формы: JSX-адаптер и фабрика render-behavior вместо константы. */
function wizardFormSources(): FormSources {
  return {
    dir: 'forms/wizard',
    files: {
      'model.ts': wizardModelTsTemplate('sample'),
      'validation.ts': wizardValidationTsTemplate('sample'),
      'form-behavior.ts': wizardFormBehaviorTsTemplate('sample'),
      'render-behavior.ts': wizardRenderBehaviorTsTemplate('sample'),
      'registry.ts': wizardRegistryTsTemplate('sample'),
      'wizard.tsx': wizardAdapterTsxTemplate('sample'),
    },
    fromEditor: [],
  };
}

describe('live-превью на шаблоне пошаговой формы', () => {
  it('JSX-адаптер компилируется, фабрика render-behavior вызывается с формой и моделью', async () => {
    const compiled = await compileForm(wizardFormSources());
    expect(compiled.errors).toEqual([]);
    // registry.ts импортирует ./wizard — значит относительный TSX-импорт резолвится и исполняется.
    expect(Object.keys(compiled.modules)).toContain('wizard.tsx');

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
