/**
 * Компоненты кита в грамматике (ReFormer-11oe.15): раздел `## components` называет все компоненты
 * верхнего уровня по назначению — для формы и для страницы, — а `components:<Имя>` описывает
 * компонент из каталога: роль, импорт, части и пропсы. Раньше грамматика знала одни поля, а отказ на
 * незнакомый контейнер отсылал в неё же.
 */

import { describe, expect, it } from 'vitest';
import { CATALOGS } from './support/catalogs';
import {
  intentGrammar,
  readGrammarRequest,
  type GrammarRequest,
} from '../src/core/generate/intent-grammar';
import { judgeIntent } from '../src/core/generate/judge';
import { uiKitFromCatalog } from '../src/core/generate/ui-kit-components';
import { formBuildTool } from '../src/core/tools/form-build';
import { UNAVAILABLE_FORM_WORKSPACE } from '../src/core/workspace/form-workspace';
import { cliKnowledge } from '../src/platform/cli/knowledge';

const grammar = (request: GrammarRequest): string => intentGrammar(CATALOGS, { sections: request });

describe('разбор каталога: группы по назначению и части составных', () => {
  it('каталог конструктора — category у записи; без неё — по роли и имени', () => {
    const kit = uiKitFromCatalog({
      components: [
        { name: 'Input', role: 'field', category: 'Поля ввода' },
        { name: 'Card', role: 'container', category: 'Контейнеры' },
        { name: 'CardTitle', role: 'container', compoundParent: 'Card' },
        { name: 'TypographyH1', role: 'container' },
        { name: 'Slider', role: 'field' },
        { name: 'Widget', role: 'container', category: 'Свои' },
        { name: 'DataGrid', role: 'container' },
        { name: 'TypographyP', role: 'container', category: 'Типографика' },
        { name: '$html(h1)', role: 'container', category: 'HTML' },
      ],
    });
    expect(kit.groups).toEqual({
      inputs: ['Input', 'Slider'],
      layout: ['Card'],
      typography: ['TypographyH1', 'TypographyP'],
      html: ['$html(h1)'],
      other: ['DataGrid'],
      Свои: ['Widget'],
    });
    // Теги HTML intent пишет ключом htmlTag, а не именем `$html(…)`.
    const section = intentGrammar({ ...CATALOGS, uiKit: kit }, { sections: { components: [] } });
    expect(section).toContain('html — a container {"htmlTag":"section"}: h1');
    expect(kit.parts).toEqual({ Card: ['CardTitle'] });
  });

  it('файл кита — категории палитры и её порядок, служебные обёртки не в перечне', () => {
    const kit = uiKitFromCatalog({
      kit: {
        palette: { categoryByName: { Section: 'Контейнеры', Box: 'Контейнеры' } },
        infra: { fieldWrapper: 'FormField' },
      },
      components: [
        { name: 'Box', role: 'container' },
        { name: 'FormField', role: 'container' },
        { name: 'Section', role: 'container' },
      ],
    });
    expect(kit.groups).toEqual({ layout: ['Section', 'Box'] });
    // Обёртка вне перечня, но остаётся компонентом кита: имя сверяется, описание даётся.
    expect(kit.exports.FormField).toBe('FormField');
  });
});

describe('form_build {grammar: "components…"}', () => {
  it('components — перечень, components:Имена — описания; регистр и пробелы не важны', () => {
    expect(readGrammarRequest('components')).toEqual({ components: [] });
    expect(readGrammarRequest(' Components: Card, tabs ')).toEqual({
      components: ['Card', 'tabs'],
    });
    expect(readGrammarRequest('component:Card')).toEqual({ components: ['Card'] });
  });

  it('перечень — тот же раздел, что в базе', () => {
    const base = intentGrammar(CATALOGS);
    const section = grammar({ components: [] });
    expect(section.startsWith('## components')).toBe(true);
    expect(base).toContain(section);
  });

  it('контейнер: импорт, части и пропсы с типом, значениями и описанием кита', () => {
    const tabs = grammar({ components: ['tabs'] });
    expect(tabs).toContain('## Tabs — container, layout; import { Tabs } from "@reformer/ui-kit"');
    expect(tabs).toContain('parts — containers inside it: TabsContent TabsList TabsTrigger');
    expect(tabs).toMatch(/^- orientation: "horizontal" \| "vertical" = "horizontal" — /m);
    // Обработчик — код, а не JSON intent: его в описании нет.
    expect(tabs).not.toContain('onValueChange:');
  });

  it('поле: без своих частей, с пометкой про ключи записи поля', () => {
    const select = grammar({ components: ['Select'] });
    expect(select).toContain('## Select — field, choice; import { SelectAsync }');
    expect(select).not.toContain('parts —');
    expect(select).toContain('label and required are keys of the field record');
  });

  it('описание пропа не рвётся на сокращении и не длиннее предела', () => {
    const select = grammar({ components: ['Select'] });
    expect(select).toContain('- className: string — Доп. CSS-класс триггера.');
    for (const line of select.split('\n').filter((l) => l.startsWith('- '))) {
      const description = line.split(' — ')[1] ?? '';
      expect(description.length).toBeLessThanOrEqual(140);
    }
  });

  it('незнакомое имя — ближайшее и путь к перечню; больше восьми — остаток назван', () => {
    expect(grammar({ components: ['Seletc'] })).toContain(
      '## Seletc — not in @reformer/ui-kit; did you mean `Select`? The list: form_build {"grammar":"components"}'
    );
    const many = grammar({
      components: ['Box', 'Card', 'Tabs', 'Alert', 'Badge', 'Dialog', 'Sheet', 'Table', 'Tree'],
    });
    expect(many.match(/^## /gm)).toHaveLength(8);
    expect(many).toContain('… 1 more: at most 8 per call.');
  });

  it('через form_build: без проекта и без диска', async () => {
    const knowledge = { ...cliKnowledge(), forms: UNAVAILABLE_FORM_WORKSPACE };
    const result = await formBuildTool({ grammar: 'components:Card' }, knowledge);
    expect(result.isError).not.toBe(true);
    const text = (result.content as { text: string }[])[0].text;
    expect(text).toContain('parts — containers inside it: CardAction CardContent');
  });
});

describe('грамматика документа билдера', () => {
  it('тот же перечень, без отсылки к form_build: у билдера его нет', () => {
    const document = intentGrammar(CATALOGS, { profile: 'document' });
    const section = document.slice(document.indexOf('## components'));
    expect(section).toContain('typography: TypographyBlockquote TypographyH1');
    expect(section).not.toContain('form_build');
  });
});

describe('подсказки судьи ведут в перечень и описание', () => {
  const intent = (container: string, props: Record<string, unknown> = {}) => ({
    formName: 'Login',
    target: 'renderer-react',
    fields: [{ name: 'login', type: 'string', component: 'Input', label: 'Логин' }],
    layoutRoot: {
      kind: 'container',
      component: container,
      componentProps: props,
      children: ['login'],
    },
  });

  it('незнакомый контейнер: модулю — form_build components, документу — раздел грамматики', () => {
    const module = judgeIntent(intent('Stack'), CATALOGS).errors;
    expect(module).toEqual([
      expect.objectContaining({
        code: 'unknown-component',
        hint: expect.stringContaining('form_build {"grammar":"components"}'),
      }),
    ]);
    const document = judgeIntent(intent('Stack'), CATALOGS, { forDocument: true }).errors;
    expect(document.find((e) => e.code === 'unknown-component')?.hint).toBe(
      'a component of the kit: ## components of the grammar lists them by purpose'
    );
  });

  it('чужой проп: модулю — описание этого компонента, документу — без form_build', () => {
    const module = judgeIntent(intent('Section', { heading: 'X' }), CATALOGS).warnings;
    expect(module.find((w) => w.code === 'component-props')?.message).toContain(
      'types and values: form_build {"grammar":"components:Section"}'
    );
    const document = judgeIntent(intent('Section', { heading: 'X' }), CATALOGS, {
      forDocument: true,
    });
    const findings = [...document.errors, ...document.warnings];
    expect(findings.find((f) => f.code === 'component-props')?.message).not.toContain('form_build');
  });
});
