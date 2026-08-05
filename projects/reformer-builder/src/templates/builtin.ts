/**
 * Встроенные шаблоны форм — «Простая форма» (одна страница полей) и «Пошаговая форма» (визард).
 * Оба собираются из «рыб» (`app/form-templates.ts`, `app/wizard-templates.ts`) в обычные
 * {@link FormTemplate}, поэтому встроенные и пользовательские шаблоны проходят один путь генерации.
 *
 * «Рыбы» пишутся под конкретное имя формы, поэтому рендерятся с техническим базовым именем
 * {@link BUILTIN_BASE_NAME} и сразу токенизируются — в файлах шаблона остаются плейсхолдеры.
 *
 * @module reformer-builder/templates/builtin
 */

import {
  formBehaviorTsTemplate,
  formJsonTemplate,
  indexTsxTemplate,
  modelTsTemplate,
  registryTsTemplate,
  renderBehaviorTsTemplate,
  validationTsTemplate,
} from '../app/form-templates';
import {
  wizardAdapterTsxTemplate,
  wizardFormBehaviorTsTemplate,
  wizardFormJsonTemplate,
  wizardIndexTsxTemplate,
  wizardModelTsTemplate,
  wizardRegistryTsTemplate,
  wizardRenderBehaviorTsTemplate,
  wizardValidationTsTemplate,
} from '../app/wizard-templates';
import { tokenize } from './placeholders';
import type { FormTemplate, TemplateFile } from './types';

/**
 * Базовое имя, под которое рендерятся «рыбы» перед токенизацией. Односложное и не встречающееся
 * в текстах шаблонов, поэтому замена не задевает ничего лишнего; `componentName('sample')` даёт
 * `SampleForm`, что превращается в `__FormName__Form` (суффикс `Form` остаётся у сгенерированной формы).
 */
export const BUILTIN_BASE_NAME = 'sample';

/** Идентификатор шаблона простой формы (на него по умолчанию встаёт диалог). */
export const SIMPLE_TEMPLATE_ID = 'builtin-simple-form';

/** Идентификатор шаблона пошаговой формы. */
export const WIZARD_TEMPLATE_ID = 'builtin-wizard-form';

/** Описание файла шаблона до токенизации. */
interface BuiltinFile {
  path: string;
  label: string;
  render: () => string;
}

const SIMPLE_FILES: ReadonlyArray<BuiltinFile> = [
  {
    path: 'index.tsx',
    label: 'Компонент-страница (index.tsx) — рендерит форму',
    render: () => indexTsxTemplate(BUILTIN_BASE_NAME),
  },
  {
    path: 'registry.ts',
    label: 'Реестр компонентов (registry.ts)',
    render: () => registryTsTemplate(BUILTIN_BASE_NAME),
  },
  {
    path: 'model.ts',
    label: 'Модель (model.ts)',
    render: () => modelTsTemplate(BUILTIN_BASE_NAME),
  },
  { path: 'form.json', label: 'Схема формы (form.json)', render: () => formJsonTemplate() },
  {
    path: 'validation.ts',
    label: 'Схема валидации (validation.ts)',
    render: () => validationTsTemplate(BUILTIN_BASE_NAME),
  },
  {
    path: 'form-behavior.ts',
    label: 'Поведение формы (form-behavior.ts)',
    render: () => formBehaviorTsTemplate(BUILTIN_BASE_NAME),
  },
  {
    path: 'render-behavior.ts',
    label: 'Поведение UI (render-behavior.ts)',
    render: () => renderBehaviorTsTemplate(BUILTIN_BASE_NAME),
  },
];

const WIZARD_FILES: ReadonlyArray<BuiltinFile> = [
  {
    path: 'index.tsx',
    label: 'Компонент-страница (index.tsx) — рендерит визард',
    render: () => wizardIndexTsxTemplate(BUILTIN_BASE_NAME),
  },
  {
    path: 'wizard.tsx',
    label: 'Адаптер визарда (wizard.tsx) — шаги схемы → ui-kit FormWizard',
    render: () => wizardAdapterTsxTemplate(BUILTIN_BASE_NAME),
  },
  {
    path: 'registry.ts',
    label: 'Реестр компонентов (registry.ts)',
    render: () => wizardRegistryTsTemplate(BUILTIN_BASE_NAME),
  },
  {
    path: 'model.ts',
    label: 'Модель (model.ts) — поля всех шагов',
    render: () => wizardModelTsTemplate(BUILTIN_BASE_NAME),
  },
  {
    path: 'form.json',
    label: 'Схема формы (form.json) — визард с двумя шагами',
    render: () => wizardFormJsonTemplate(),
  },
  {
    path: 'validation.ts',
    label: 'Схема валидации (validation.ts)',
    render: () => wizardValidationTsTemplate(BUILTIN_BASE_NAME),
  },
  {
    path: 'form-behavior.ts',
    label: 'Поведение формы (form-behavior.ts)',
    render: () => wizardFormBehaviorTsTemplate(BUILTIN_BASE_NAME),
  },
  {
    path: 'render-behavior.ts',
    label: 'Поведение UI (render-behavior.ts) — submit визарда',
    render: () => wizardRenderBehaviorTsTemplate(BUILTIN_BASE_NAME),
  },
];

/** Файлы шаблона с подставленными плейсхолдерами. */
function toTemplateFiles(files: ReadonlyArray<BuiltinFile>): TemplateFile[] {
  return files.map((f) => ({ path: f.path, content: tokenize(f.render(), BUILTIN_BASE_NAME) }));
}

/** Подписи файлов для диалога выбора. */
function toLabels(files: ReadonlyArray<BuiltinFile>): Record<string, string> {
  return Object.fromEntries(files.map((f) => [f.path, f.label]));
}

/**
 * Зависимости страницы: без модели, схемы, реестра, валидации и поведения `index.tsx` не соберётся,
 * поэтому его отметка тянет все остальные файлы шаблона.
 */
function pageRequires(files: ReadonlyArray<BuiltinFile>): Record<string, string[]> {
  return { 'index.tsx': files.filter((f) => f.path !== 'index.tsx').map((f) => f.path) };
}

/** Простая форма: одна страница полей на `$html(div)`. */
export function simpleFormTemplate(): FormTemplate {
  return {
    id: SIMPLE_TEMPLATE_ID,
    name: 'Простая форма',
    description: 'Одна страница: модель, схема, валидация, поведение, реестр, страница.',
    source: 'builtin',
    files: toTemplateFiles(SIMPLE_FILES),
    requires: pageRequires(SIMPLE_FILES),
    labels: toLabels(SIMPLE_FILES),
  };
}

/** Пошаговая форма: визард с двумя шагами и адаптером к ui-kit FormWizard. */
export function wizardFormTemplate(): FormTemplate {
  return {
    id: WIZARD_TEMPLATE_ID,
    name: 'Пошаговая форма',
    description: 'Визард: два шага, общая модель, валидация и submit на последнем шаге.',
    source: 'builtin',
    files: toTemplateFiles(WIZARD_FILES),
    requires: pageRequires(WIZARD_FILES),
    labels: toLabels(WIZARD_FILES),
  };
}

/** Оба встроенных шаблона в порядке показа (собираются на каждый вызов — «рыбы» дёшевы). */
export function builtinTemplates(): FormTemplate[] {
  return [simpleFormTemplate(), wizardFormTemplate()];
}
