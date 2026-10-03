/**
 * Домен RJSF поверх основы (`rjsf.builder`) — настоящим `boot`.
 *
 * Основа, реестр китов и два плагина домена: редактор (провайдер модели, валидатор, редактор,
 * панель свойств поля, команды) и рендер (поверхность превью с темой из кита). Ни одного плагина
 * стека ReFormer:
 * киты — платформа, и RJSF берёт тот же активный кит, что рисует формы ReFormer.
 *
 * Отдельно — совмещённый состав: ReFormer, демо-стек и RJSF в одном приложении. Три формата
 * схемы лежат в `.json`, и отличают их только пробы по содержимому; если две пробы возьмутся
 * за один документ, у него окажется два предметных редактора.
 *
 * @module shell/boot/integration/rjsf-profile.test
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fromProfile } from '@/application/composer/compose';
import { builtinProfile } from '@/application/profiles/registry';
import { defineProfile } from '@/application/profiles/profile';
import { boot, type BuilderApp } from '@/shell/boot/boot';
import type { ExtensionPoint, ResourceRef } from '@reformer/builder-plugin-api/internal';
import {
  DocumentModelPoint,
  EDITOR_TITLE_MENU,
  EditorPoint,
  MenuPoint,
  PanelPoint,
  PreviewSurfacePoint,
  RESOURCE_CONTEXT_MENU,
  ValidatorPoint,
  type DocumentModelProvider,
} from '@reformer/builder-plugin-api/internal';
import { buildMenu, type MenuSubmenuNode } from '@/shell/platform/ui/menu/menu';
import { printPlainForm, sampleForm as samplePlainForm } from '@/plugins/plain/core';
import { printRjsfForm, sampleForm as sampleRjsfForm, type RjsfForm } from '@/plugins/rjsf/core';
import {
  RJSF_EDITOR_PLUGIN_ID,
  RJSF_FORM_ITEM_ID,
  RJSF_INSPECTOR_PANEL_ID,
  RJSF_SHOW_FORM_COMMAND_ID,
  RJSF_SHOW_STRUCTURE_COMMAND_ID,
  RJSF_STRUCTURE_ITEM_ID,
} from '@/plugins/rjsf/editor';
import { createDocument } from '@/shell/platform/workspace/document';
import { createModelDocument } from '@/shell/platform/workspace/model/model-document';
import { createEditorProbe } from '@/shell/platform/workspace/model/provider';
import { resolveEditor } from '@/shell/platform/ui/contributions/editors';
import { createMemoryIndexedDb } from '@/shell/platform/workspace/storage/testing';

const builderProfile = builtinProfile('reformer.builder');
const rjsfProfile = builtinProfile('rjsf.builder');

/** Окружение браузера в объёме, который трогает `boot` при сборке (см. `base-profile.test`). */
function stubBrowser(): void {
  const listeners = { addEventListener: () => {}, removeEventListener: () => {} };
  vi.stubGlobal('indexedDB', createMemoryIndexedDb().factory);
  vi.stubGlobal('window', { ...listeners });
  vi.stubGlobal('document', {
    ...listeners,
    title: 'reformer-builder',
    documentElement: { classList: { add: () => {}, remove: () => {} } },
  });
}

let app: BuilderApp | null = null;

afterEach(() => {
  app?.dispose();
  app = null;
  vi.unstubAllGlobals();
});

async function start(profile = rjsfProfile): Promise<BuilderApp> {
  stubBrowser();
  app = boot({ application: fromProfile(profile) });
  await app.ready;
  return app;
}

const ref = (name: string): ResourceRef => ({
  id: `mem:${name}`,
  sourceId: 'mem',
  path: name,
  name,
  kind: 'file',
  mediaType: 'application/json',
});

/** Каталог дерева — цель щелчка, над которой собирается контекстное меню. */
const DIRECTORY: ResourceRef = {
  id: 'mem:forms',
  sourceId: 'mem',
  path: 'forms',
  name: 'forms',
  kind: 'directory',
  mediaType: 'inode/directory',
};

/** Подраздел подменю «Сгенерировать»: подпись и подписи пунктов под ней. */
type GenerateSection = readonly [title: string, items: readonly string[]];

/**
 * Подменю «Сгенерировать» так, как его соберёт оболочка по щелчку на каталоге: настоящими
 * вкладами, настоящим реестром команд и словарями плагинов. Подменю нет — пустой список.
 */
async function generateSections(started: BuilderApp): Promise<readonly GenerateSection[]> {
  await started.i18n.setLocale('ru');
  const nodes = buildMenu(
    {
      entries: started.extensions.get(MenuPoint),
      ctx: started.whenContext.get(),
      target: { ref: DIRECTORY, dir: DIRECTORY.id, selection: [DIRECTORY], rootId: 'mem:' },
      commands: started.commands,
      translate: (key, owner) =>
        owner?.pluginId === undefined
          ? started.i18n.t(key)
          : started.i18n.forPlugin(owner.pluginId).t(key),
      execute: () => {},
    },
    RESOURCE_CONTEXT_MENU
  );
  const generate = nodes.find(
    (node): node is MenuSubmenuNode => node.kind === 'submenu' && node.title === 'Сгенерировать'
  );
  if (generate === undefined) return [];
  return generate.items.flatMap((node): GenerateSection[] =>
    node.kind === 'submenu'
      ? [[node.title, node.items.flatMap((item) => (item.kind === 'item' ? [item.title] : []))]]
      : []
  );
}

/** Три формата схемы — все в `.json`. */
const FORMATS = {
  reformer: JSON.stringify({ version: '1.0', root: { component: 'Box', children: [] } }),
  plain: printPlainForm(samplePlainForm()),
  rjsf: printRjsfForm(sampleRjsfForm()),
} as const;

describe('boot на профиле rjsf.builder', () => {
  it('поднимается: основа, киты и два плагина домена — все активны', async () => {
    const started = await start();

    const statuses = started.plugins.statuses();
    expect(statuses.map((s) => s.id).sort()).toEqual([
      'reformer.editor-markdown',
      'reformer.editor-monaco',
      'reformer.files',
      'reformer.kits',
      'reformer.plugin-manager',
      'reformer.preview',
      'reformer.rjsf.editor',
      'reformer.rjsf.render',
    ]);
    expect(statuses.filter((s) => s.state !== 'active')).toEqual([]);
  });

  it('модель и валидатор — у редактора домена, поверхность — у рендера', async () => {
    const started = await start();
    const owners = <T>(point: ExtensionPoint<T>): string[] =>
      [...new Set(started.extensions.get(point).map((c) => c.pluginId))].sort();

    expect(owners(DocumentModelPoint)).toEqual(['reformer.rjsf.editor']);
    expect(owners(ValidatorPoint)).toEqual(['reformer.rjsf.editor']);
    expect(owners(PreviewSurfacePoint)).toEqual(['reformer.rjsf.render']);
  });

  it('свойства поля — панелью правого дока; справа в этом составе она единственная', async () => {
    const started = await start();
    const panels = started.extensions.get(PanelPoint);

    const right = panels.filter((contribution) => contribution.value.slot === 'panel.right');
    expect(right.map((contribution) => [contribution.pluginId, contribution.value.id])).toEqual([
      [RJSF_EDITOR_PLUGIN_ID, RJSF_INSPECTOR_PANEL_ID],
    ]);
    // Вне формы домена панели нет — а с ней и правого рейла: показывать в нём нечего.
    const visible = (activeResourceKind: string | null) =>
      right[0]!.value.when?.({ ...started.whenContext.get(), activeResourceKind });
    expect(visible('rjsf.form')).toBe(true);
    expect(visible('text/markdown')).toBe(false);
  });

  it('переключатель вида — двумя кнопками полосы вкладок, и команды у них есть', async () => {
    const started = await start();
    // Ряд действий делят с основой: кнопки markdown стоят там же, но над своим редактором.
    const items = started.extensions
      .get(MenuPoint)
      .filter(
        (contribution) =>
          contribution.pluginId === RJSF_EDITOR_PLUGIN_ID &&
          contribution.value.kind === 'item' &&
          contribution.value.menu === EDITOR_TITLE_MENU
      );

    expect(items.map((contribution) => contribution.id)).toEqual([
      RJSF_STRUCTURE_ITEM_ID,
      RJSF_FORM_ITEM_ID,
    ]);
    // Пункт без команды не рисуется вовсе — молча.
    expect(started.commands.get(RJSF_SHOW_STRUCTURE_COMMAND_ID)).toBeDefined();
    expect(started.commands.get(RJSF_SHOW_FORM_COMMAND_ID)).toBeDefined();
  });

  it('форма RJSF открывается редактором домена, а не Monaco', async () => {
    const started = await start();

    expect(
      resolveEditor(
        started.extensions.get(EditorPoint),
        ref('contact.rjsf.json'),
        createEditorProbe(FORMATS.rjsf)
      )?.value.id
    ).toBe('rjsf.editor');
  });

  it('«Сгенерировать» дерева есть и без стека ReFormer: подраздел «RJSF» с новой формой', async () => {
    const started = await start();

    // Заголовок подменю вносит основа, поэтому подразделу домена есть куда встать.
    expect(await generateSections(started)).toEqual([['RJSF', ['Новая форма']]]);
  });

  it('в «Файл» домен ничего не вносит: там открывают и сохраняют, а не порождают формы', async () => {
    const started = await start();
    const inFile = started.extensions
      .get(MenuPoint)
      .filter(
        (contribution) =>
          contribution.pluginId === RJSF_EDITOR_PLUGIN_ID &&
          contribution.value.kind !== 'root' &&
          contribution.value.menu === 'file'
      );

    expect(inFile).toEqual([]);
  });
});

describe('выделение формы RJSF в НАСТОЯЩЕЙ ручке модели', () => {
  /**
   * Сквозная половина к двойнику `plugins/rjsf/editor/testing`: тот повторяет правила ручки
   * («операция переносит выделение на `focus`, отмена возвращает его из снимка»), и только здесь
   * видно, что настоящая ручка с настоящим провайдером домена ведёт себя так же.
   */
  async function open() {
    const started = await start();
    const provider = started.extensions.get(DocumentModelPoint)[0]!
      .value as DocumentModelProvider<RjsfForm>;
    const buffer = createDocument(ref('contact.rjsf.json'), FORMATS.rjsf, false).document;
    return createModelDocument<RjsfForm>({ document: buffer, provider, writeText: () => {} });
  }

  it('новое поле и переименование переносят выделение, отмена возвращает прежнее', async () => {
    const handle = await open();
    handle.setSelection(['age']);

    handle.apply({ type: 'add-field', params: { name: 'email', field: { type: 'string' } } });
    expect(handle.document.getSelection()).toEqual(['email']);

    handle.apply({ type: 'rename-field', params: { name: 'email', to: 'mail' } });
    expect(handle.document.getSelection()).toEqual(['mail']);

    expect(handle.undo()).toBe(true);
    expect(handle.document.getSelection()).toEqual(['email']);
    expect(handle.undo()).toBe(true);
    expect(handle.document.getSelection()).toEqual(['age']);
  });

  it('удаление выделение не двигает — его снимает редактор, и отмена возвращает выбор', async () => {
    const handle = await open();
    handle.setSelection(['age']);

    handle.apply({ type: 'remove-field', params: { name: 'age' } });
    // Адрес повис: поля с таким именем больше нет. Редактор после удаления зовёт setSelection([]).
    expect(handle.document.getSelection()).toEqual(['age']);
    handle.setSelection([]);

    expect(handle.undo()).toBe(true);
    expect(handle.document.getModel().schema.properties.age).toBeDefined();
    expect(handle.document.getSelection()).toEqual(['age']);
  });

  it('снимок выделения стабилен между изменениями: панель подписана на него ссылкой', async () => {
    const handle = await open();
    handle.setSelection(['age']);
    const before = handle.document.getSelection();

    // Правка без `focus` и повтор того же выделения ссылку не меняют.
    handle.apply({ type: 'set-title', params: { title: 'Анкета' } });
    handle.setSelection(['age']);

    expect(handle.document.getSelection()).toBe(before);
  });
});

describe('совмещённый состав: ReFormer, демо-стек и RJSF', () => {
  const combined = defineProfile({
    id: 'combined.test',
    name: 'Все стеки',
    extends: builderProfile.id,
    plugins: ['reformer.plain', 'reformer.rjsf.editor', 'reformer.rjsf.render'],
  });

  it('собирается и поднимается целиком', async () => {
    const started = await start(combined);

    expect(started.plugins.statuses().filter((s) => s.state !== 'active')).toEqual([]);
  });

  it('«Сгенерировать» дерева делится на подразделы стеков: «ReFormer» и «RJSF»', async () => {
    const started = await start(combined);
    const sections = await generateSections(started);

    // Порядок назван вкладами, а не порядком активации плагинов.
    expect(sections.map(([title]) => title)).toEqual(['ReFormer', 'RJSF']);
    // Цели модуля ReFormer остались под своим подразделом — с «Весь модуль» во главе.
    expect(sections[0]?.[1][0]).toBe('Весь модуль');
    expect(sections[0]?.[1].length).toBeGreaterThan(1);
    expect(sections[1]?.[1]).toEqual(['Новая форма']);
  });

  it('пробы форматов не пересекаются: у каждой схемы ровно один провайдер и свой редактор', async () => {
    const started = await start(combined);
    const providers = started.extensions.get(DocumentModelPoint);
    const editors = started.extensions.get(EditorPoint);
    const expected = {
      reformer: 'editor-schema.canvas',
      plain: 'plain.editor',
      rjsf: 'rjsf.editor',
    };

    for (const [format, text] of Object.entries(FORMATS)) {
      const name = `form.${format}.json`;
      const applying = providers
        .filter((contribution) => contribution.value.applies(ref(name), createEditorProbe(text)))
        .map((contribution) => contribution.pluginId);
      expect(applying, format).toHaveLength(1);
      expect(resolveEditor(editors, ref(name), createEditorProbe(text))?.value.id, format).toBe(
        expected[format as keyof typeof expected]
      );
    }
  });
});
