import { describe, expect, it } from 'vitest';
// Канон раскладки — из самого MCP-сервера: там он объявлен таблицей (`FORM_LAYOUT_CANON`), и та же
// проверка стоит у консумента как `validate_form kind="layout"`. Импорт из `dist` — тот же путь,
// которым билдер уже ходит в MCP (см. agent/core/tools); CI собирает пакет до тестов билдера.
import { validateLayout } from '@reformer/mcp/dist/core/validate/layout.js';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { validateSchema } from '../io/validate';
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

  it('простая форма: десять файлов канона, страница тянет остальные', () => {
    const t = simpleFormTemplate();
    expect(t.files.map((f) => f.path)).toEqual([
      'index.tsx',
      'types.ts',
      'model.ts',
      'renderer.schema.json',
      'form.behavior.ts',
      'renderer.behavior.ts',
      'validation.ts',
      'data-sources.ts',
      'api.ts',
      'registry.ts',
    ]);
    expect(resolvePicked(['index.tsx'], t.requires).size).toBe(10);
    expect(resolvePicked(['model.ts'], t.requires).size).toBe(1);
  });

  it('пошаговая форма: одиннадцать файлов, включая адаптер визарда', () => {
    const t = wizardFormTemplate();
    expect(t.files.map((f) => f.path)).toContain('renderer.wizard.tsx');
    expect(t.files).toHaveLength(11);
    expect(resolvePicked(['index.tsx'], t.requires).size).toBe(11);
  });

  it('пошаговая схема — визард с двумя шагами в componentProps.steps', () => {
    const t = wizardFormTemplate();
    const form = t.files.find((f) => f.path === 'renderer.schema.json')!;
    const json = JSON.parse(form.content);
    expect(json.root.component).toBe('$component(Wizard)');
    expect(json.root.selector).toBe('wizard');
    expect(json.root.componentProps.steps).toHaveLength(2);
    expect(json.root.componentProps.steps[0].componentProps.title).toBe('Контакты');
    // Шаг — `$component(Step)`, как в рецепте визарда renderer-json: `title`/`icon` — метаданные
    // шага, и props-схема `Box` (только `className`, additionalProperties: false) их отвергает.
    expect(json.root.componentProps.steps[0].component).toBe('$component(Step)');
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
      expect(formSchemaFileOf(out)?.path).toBe('renderer.schema.json');
    }
  });

  // Схема шаблона обязана проходить ТОТ ЖЕ гейт, что стоит на сохранении и экспорте: иначе форма,
  // созданную билдером из его же шаблона, билдер и забракует при первом сохранении. Ровно так и
  // было (ReFormer-shn): шаги визарда лежали в `$component(Box)`, а `title`/`icon` в его
  // `componentProps` — props-схема Box знает только `className` и режет остальное.
  it('схемы шаблонов проходят гейт валидации билдера', () => {
    for (const t of builtinTemplates()) {
      const file = formSchemaFileOf(t.files);
      expect(file, `шаблон «${t.name}»`).not.toBeNull();
      const res = validateSchema(JSON.parse(file!.content) as JsonFormSchema);
      expect(res.errors, `шаблон «${t.name}»`).toEqual([]);
      expect(res.valid).toBe(true);
    }
  });

  // Канон раскладки формы сверяется ЕГО ЖЕ валидатором (@reformer/mcp), а не копией списка имён
  // здесь: копия — это второй источник истины, и расходится он молча. Ровно так канон уже
  // разъезжался: переименование доехало до кодогена, но не до шаблонов.
  it('набор файлов проходит канон раскладки renderer-json', () => {
    for (const t of builtinTemplates()) {
      const { diagnostics } = validateLayout(
        t.files.map((f) => f.path),
        'renderer-json'
      );
      const errors = diagnostics.filter((d) => d.severity === 'error');
      expect(errors, `шаблон «${t.name}»`).toEqual([]);
    }
  });

  // Единственный осознанный отход от дефолта канона — схема как данные (`renderer.schema.json`
  // вместо `renderer.schema.ts`): без неё форма не открывается обратно в canvas билдера. Тест
  // держит список отходов закрытым: новое предупреждение обязано быть решением, а не случайностью.
  it('предупреждение канона ровно одно — схема как данные', () => {
    for (const t of builtinTemplates()) {
      const { diagnostics } = validateLayout(
        t.files.map((f) => f.path),
        'renderer-json'
      );
      const warnings = diagnostics.filter((d) => d.severity === 'warning');
      expect(
        warnings.map((w) => w.path),
        `шаблон «${t.name}»`
      ).toEqual(['renderer.schema.json']);
    }
  });
});
