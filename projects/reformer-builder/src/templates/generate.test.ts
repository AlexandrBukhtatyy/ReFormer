import { describe, expect, it } from 'vitest';
import {
  builtinTemplates,
  simpleFormTemplate,
  wizardFormTemplate,
  BUILTIN_BASE_NAME,
} from './builtin';
import { formSchemaFileOf, materializeFiles, resolvePicked } from './generate';
import { TOKENS } from './placeholders';
import type { FormTemplate } from './types';

const template: FormTemplate = {
  id: 't',
  name: 'T',
  source: 'local',
  files: [
    { path: 'index.tsx', content: `export default function ${TOKENS.pascal}Form() {}` },
    { path: 'model.ts', content: 'export const initial = {};' },
    { path: `${TOKENS.kebab}.form.json`, content: '{"root":{"component":"$html(div)"}}' },
  ],
  requires: { 'index.tsx': ['model.ts'] },
};

describe('resolvePicked', () => {
  it('транзитивно добирает зависимости', () => {
    const requires = { a: ['b'], b: ['c'] };
    expect([...resolvePicked(['a'], requires)].sort()).toEqual(['a', 'b', 'c']);
  });

  it('без requires набор не меняется', () => {
    expect([...resolvePicked(['a'], undefined)]).toEqual(['a']);
  });

  it('циклы не зацикливают', () => {
    expect([...resolvePicked(['a'], { a: ['b'], b: ['a'] })].sort()).toEqual(['a', 'b']);
  });
});

describe('materializeFiles', () => {
  it('отбирает выбранное (с зависимостями) и подставляет имя в путь и содержимое', () => {
    const out = materializeFiles(template, ['index.tsx'], 'user-profile');
    expect(out.map((f) => f.path)).toEqual(['index.tsx', 'model.ts']);
    expect(out[0].content).toBe('export default function UserProfileForm() {}');
  });

  it('плейсхолдер в имени файла раскрывается', () => {
    const out = materializeFiles(template, [`${TOKENS.kebab}.form.json`], 'user-profile');
    expect(out[0].path).toBe('user-profile.form.json');
  });
});

describe('formSchemaFileOf', () => {
  it('находит схему формы среди .json', () => {
    const files = [
      { path: 'package.json', content: '{"name":"x"}' },
      { path: 'form.json', content: '{"root":{"component":"$html(div)","children":[]}}' },
    ];
    expect(formSchemaFileOf(files)?.path).toBe('form.json');
  });

  it('битый JSON и отсутствие схемы — null', () => {
    expect(formSchemaFileOf([{ path: 'a.json', content: '{oops' }])).toBeNull();
    expect(formSchemaFileOf([{ path: 'a.ts', content: 'x' }])).toBeNull();
  });
});

describe('встроенные шаблоны', () => {
  it('их два: простая форма и пошаговая', () => {
    expect(builtinTemplates().map((t) => t.name)).toEqual(['Простая форма', 'Пошаговая форма']);
    for (const t of builtinTemplates()) expect(t.source).toBe('builtin');
  });

  it('простая форма: семь файлов, страница тянет остальные', () => {
    const t = simpleFormTemplate();
    expect(t.files.map((f) => f.path)).toEqual([
      'index.tsx',
      'registry.ts',
      'model.ts',
      'form.json',
      'validation.ts',
      'form-behavior.ts',
      'render-behavior.ts',
    ]);
    expect(resolvePicked(['index.tsx'], t.requires).size).toBe(7);
    expect(resolvePicked(['model.ts'], t.requires).size).toBe(1);
  });

  it('пошаговая форма: восемь файлов, включая адаптер визарда', () => {
    const t = wizardFormTemplate();
    expect(t.files.map((f) => f.path)).toContain('wizard.tsx');
    expect(t.files).toHaveLength(8);
    expect(resolvePicked(['index.tsx'], t.requires).size).toBe(8);
  });

  it('пошаговая схема — визард с двумя шагами в componentProps.steps', () => {
    const t = wizardFormTemplate();
    const form = t.files.find((f) => f.path === 'form.json')!;
    const json = JSON.parse(form.content);
    expect(json.root.component).toBe('$component(Wizard)');
    expect(json.root.selector).toBe('wizard');
    expect(json.root.componentProps.steps).toHaveLength(2);
    expect(json.root.componentProps.steps[0].componentProps.title).toBe('Контакты');
    // Шаги — обычные Box-узлы: отдельный Step-компонент регистрировать не нужно.
    expect(json.root.componentProps.steps[0].component).toBe('$component(Box)');
  });

  it('файлы параметризованы: техническое базовое имя не утекает', () => {
    for (const t of builtinTemplates()) {
      const index = t.files.find((f) => f.path === 'index.tsx')!;
      expect(index.content).toContain(`function ${TOKENS.pascal}Form()`);
      for (const f of t.files) expect(f.content).not.toContain(BUILTIN_BASE_NAME);
    }
  });

  it('генерация даёт валидную схему формы и корректное имя компонента', () => {
    for (const t of builtinTemplates()) {
      const out = materializeFiles(t, ['index.tsx'], 'user-profile');
      const index = out.find((f) => f.path === 'index.tsx')!;
      expect(index.content).toContain('export default function UserProfileForm()');
      expect(formSchemaFileOf(out)?.path).toBe('form.json');
    }
  });
});
