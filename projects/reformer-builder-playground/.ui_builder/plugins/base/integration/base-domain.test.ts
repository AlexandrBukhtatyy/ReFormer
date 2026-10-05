/**
 * Домен base поверх встроенных — настоящим `boot`, без единого плагина про формы.
 *
 * Плагин файлов больше не встроенный, и главное, что надо проверить на собранном приложении, —
 * что он получает от оболочки всё СЛУЖБАМИ: тело панели дерева (`reformer.workspace.tree`),
 * вкладки и документы, перевод находок. Стенд с двойниками этого не показывает: там порт
 * подставной. Здесь порт собирает сам плагин из настоящих служб.
 *
 * @module plugins/base/integration/base-domain.test
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { boot, type BuilderApp } from '@/shell/boot/boot';
import type { ExtensionPoint } from '@reformer/builder-plugin-api/internal';
import {
  EditorPoint,
  MenuPoint,
  PanelPoint,
  ResourceDecorationPoint,
} from '@reformer/builder-plugin-api/internal';
import { resolveEditor } from '@/shell/platform/ui/contributions/editors';
import { createMemoryIndexedDb } from '@/shell/platform/workspace/storage/testing';
import { FILES_PLUGIN_ID } from '../files/src';
import { TextEditorCapability } from '../monaco-editor/src';
import monacoManifest from '../monaco-editor/src/manifest.json';
import { baseApplication } from './application';

/** Окружение браузера в объёме, который трогает `boot` при сборке. */
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

async function start(): Promise<BuilderApp> {
  stubBrowser();
  app = boot({ application: baseApplication() });
  await app.ready;
  return app;
}

describe('boot с доменом base', () => {
  it('поднимается: встроенные и плагины домена — все активны', async () => {
    const started = await start();

    const statuses = started.plugins.statuses();
    // Markdown здесь — уже плагин домена, а не встроенный: в списке он тот же, владелец другой.
    expect(statuses.map((s) => s.id).sort()).toEqual([
      'reformer.editor-markdown',
      'reformer.editor-monaco',
      'reformer.files',
      'reformer.plugin-manager',
      'reformer.profile-switch',
      'reformer.project',
    ]);
    expect(statuses.filter((s) => s.state !== 'active')).toEqual([]);
  });

  it('панель дерева внесена: её тело плагин получил возможностью оболочки, а не портом', async () => {
    const started = await start();

    const panels = started.extensions
      .get(PanelPoint)
      .filter((contribution) => contribution.pluginId === FILES_PLUGIN_ID)
      .map((contribution) => `${contribution.value.slot}:${contribution.value.id}`)
      .sort();

    // Дерево — слева, проблемы — снизу. Без возможности `reformer.workspace.tree` первой бы
    // не было: панель без тела плагин не вносит.
    expect(panels).toEqual(['panel.bottom:files.problems', 'panel.left:files.tree']);
  });

  it('текстовый редактор, пометки находок и подменю «Сгенерировать» — вклады плагина файлов', async () => {
    const started = await start();
    const owned = <T>(point: ExtensionPoint<T>): readonly string[] =>
      started.extensions
        .get(point)
        .filter((contribution) => contribution.pluginId === FILES_PLUGIN_ID)
        .map((contribution) => contribution.id);

    expect(owned(EditorPoint)).toContain('files.text');
    expect(owned(ResourceDecorationPoint)).toContain('files.diagnostics');
    // Заголовок общего подменю дерева: его наполняют движки, а вносит плагин файлов.
    expect(owned(MenuPoint)).toContain('files.context.generate');
  });

  it('редактор кода даёт возможность «reformer.editor»: манифест объявляет её тем же токеном', async () => {
    // Объявление — данные манифеста, токен — значение в коде, и разойтись им ничто не мешает.
    // Рантайм сверяет только идентификатор («что-то под этим именем зарегистрировано»), а ВЕРСИЯ
    // разошлась бы молча: резолвер обещал бы потребителю одну, реестр служб держал бы другую.
    expect(monacoManifest.provides).toEqual([
      { id: TextEditorCapability.id, version: TextEditorCapability.version },
    ]);

    // И обещанное действительно зарегистрировано: тело редактора одалживают предпросмотр
    // markdown («рядом») и исходник схемы формы. Проверяет это сам рантайм — фазой `provides`
    // после активации: невыполненное обещание переводит плагин в `failed`.
    const started = await start();
    expect(started.plugins.failures().filter((failure) => failure.phase === 'provides')).toEqual(
      []
    );
    expect(
      started.plugins.statuses().find((status) => status.id === monacoManifest.id)?.state
    ).toBe('active');
  });

  it('markdown-файл достаётся markdown-редактору, а не редактору кода', async () => {
    // Проверка ЗДЕСЬ, а не в пакете плагина: приоритеты сравниваются между плагинами, а плагин
    // видит только свой. Числа были равны — и `.md` доставался редактору кода просто потому,
    // что тот зарегистрирован раньше; кнопки предпросмотра при этом рисовались и «не работали».
    const started = await start();

    const ref = {
      id: 'mem:README.md',
      sourceId: 'mem',
      path: 'README.md',
      name: 'README.md',
      kind: 'file' as const,
      mediaType: 'text/markdown',
    };
    const winner = resolveEditor(started.extensions.get(EditorPoint), ref, {
      text: () => Promise.resolve('# заголовок'),
    });

    expect(winner?.value.id).toBe('markdown.editor');
    expect(winner?.pluginId).toBe('reformer.editor-markdown');
  });

  it('команды открытия и сохранения остались у встроенного «Проекта», операции — у файлов', async () => {
    const started = await start();
    const ownerOf = (commandId: string): string | undefined =>
      started.commands.getAll().find((command) => command.id === commandId)?.pluginId;

    expect(ownerOf('project.save')).toBe('reformer.project');
    expect(ownerOf('project.openProject')).toBe('reformer.project');
    expect(ownerOf('files.newFile')).toBe(FILES_PLUGIN_ID);
    expect(ownerOf('files.rename')).toBe(FILES_PLUGIN_ID);
  });

  it('заголовки команд плагина файлов переводит ЕГО словарь, а не словарь оболочки', async () => {
    // Словарь плагин вносит сам при активации; раньше его регистрировала композиция.
    const started = await start();
    const files = started.i18n.forPlugin(FILES_PLUGIN_ID);

    expect(files.t('files.command.newFile')).toBe('Новый файл…');
    expect(files.t('notify.noProject')).toBe('Проект не открыт: работать не с чем.');
    expect(files.t('panel.title')).toBe('Проект');
  });
});
