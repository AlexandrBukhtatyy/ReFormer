import { describe, expect, it, vi } from 'vitest';

import type { MenuItemContribution, ResourceId, WhenContext } from '@/sdk';
import type { SchemaEditorHost } from './host';
import {
  documentIdOf,
  schemaViewCommands,
  schemaViewMenuItems,
  TOGGLE_SCHEMA_VIEW_COMMAND_ID,
} from './view-actions';
import { createSchemaViewStore, type SchemaViewStore } from './view-mode';

const SCHEMA_ID: ResourceId = 'fs:forms/credit/schema.json';
const TEXT_ID: ResourceId = 'fs:notes.txt';

function context(): WhenContext {
  return {
    focus: 'canvas',
    activeEditorId: 'editor.schema',
    activeResourceKind: 'form.schema',
    hasSelection: false,
    previewMode: null,
  };
}

function target(documentId: ResourceId) {
  return {
    documentId,
    ref: {
      id: documentId,
      sourceId: 'fs',
      path: documentId.slice(3),
      name: documentId.slice(documentId.lastIndexOf('/') + 1),
      kind: 'file' as const,
      mediaType: 'application/json',
    },
    editorId: 'editor.schema',
  };
}

interface Harness {
  readonly host: SchemaEditorHost;
  readonly views: SchemaViewStore;
}

function harness(options: { withTextEditor?: boolean; active?: ResourceId } = {}): Harness {
  const host = {
    activeDocument: () => options.active ?? SCHEMA_ID,
    TextEditor: options.withTextEditor === false ? undefined : () => null,
  } as unknown as SchemaEditorHost;
  const views = createSchemaViewStore({
    settings: null,
    hasTextEditor: () => host.TextEditor !== undefined,
  });
  return { host, views };
}

const isSchema = (id: ResourceId): boolean => id === SCHEMA_ID;

function items(h: Harness): readonly { id: string; value: MenuItemContribution }[] {
  return schemaViewMenuItems({
    views: h.views,
    hasTextEditor: () => h.host.TextEditor !== undefined,
    isSchema,
  }).map((item) => {
    if (item.value.kind !== 'item') throw new Error('ожидался пункт-действие');
    return { id: item.id, value: item.value };
  });
}

function itemOf(h: Harness, id: string): MenuItemContribution {
  const found = items(h).find((item) => item.id === id);
  if (found === undefined) throw new Error(`нет пункта ${id}`);
  return found.value;
}

describe('команда переключения', () => {
  it('ведёт из конструктора в исходник и обратно', () => {
    const h = harness();
    const [toggle] = schemaViewCommands({ host: h.host, views: h.views, isSchema });

    toggle?.run();
    expect(h.views.get(SCHEMA_ID)).toBe('code');
    toggle?.run();
    expect(h.views.get(SCHEMA_ID)).toBe('design');
  });

  it('работает над документом, названным аргументом', () => {
    const h = harness();
    const [toggle] = schemaViewCommands({ host: h.host, views: h.views, isSchema });

    toggle?.run({ documentId: SCHEMA_ID });

    expect(h.views.get(SCHEMA_ID)).toBe('code');
  });

  it('без редактора кода недоступна: показывать исходник нечем', () => {
    const h = harness({ withTextEditor: false });
    const [toggle] = schemaViewCommands({ host: h.host, views: h.views, isSchema });

    expect(toggle?.enabled?.(context())).toBe(false);
  });

  it('на чужой вкладке недоступна', () => {
    const h = harness({ active: TEXT_ID });
    const [toggle] = schemaViewCommands({ host: h.host, views: h.views, isSchema });

    expect(toggle?.enabled?.(context())).toBe(false);
  });

  it('адрес из аргументов проверяется, а не приводится типом', () => {
    expect(documentIdOf({ documentId: SCHEMA_ID })).toBe(SCHEMA_ID);
    expect(documentIdOf({ documentId: 7 })).toBeNull();
    expect(documentIdOf(null)).toBeNull();
  });
});

describe('кнопки в полосе вкладок', () => {
  it('видна ровно половина пары — она и есть та самая одна кнопка', () => {
    const h = harness();
    const toCode = itemOf(h, 'schema.title.toCode');
    const toDesign = itemOf(h, 'schema.title.toDesign');

    expect(toCode.when?.(context(), target(SCHEMA_ID))).toBe(true);
    expect(toDesign.when?.(context(), target(SCHEMA_ID))).toBe(false);

    h.views.set(SCHEMA_ID, 'code');

    expect(toCode.when?.(context(), target(SCHEMA_ID))).toBe(false);
    expect(toDesign.when?.(context(), target(SCHEMA_ID))).toBe(true);
  });

  it('обе половины зовут одну команду, несут значок и свою подпись', () => {
    const h = harness();

    for (const id of ['schema.title.toCode', 'schema.title.toDesign']) {
      const item = itemOf(h, id);
      expect(item.menu).toBe('editor/title');
      expect(item.command).toBe(TOGGLE_SCHEMA_VIEW_COMMAND_ID);
      expect(item.icon).toBeTypeOf('function');
      // Подпись у команды одна («переключить»), а кнопка обязана говорить, что будет
      // после нажатия — поэтому у половин свои ключи.
      expect(item.titleKey).toBeTypeOf('string');
    }
  });

  it('над не-схемой кнопок нет вовсе', () => {
    const h = harness();

    expect(itemOf(h, 'schema.title.toCode').when?.(context(), target(TEXT_ID))).toBe(false);
  });

  it('без редактора кода кнопок нет: переключать не на что', () => {
    const h = harness({ withTextEditor: false });

    expect(itemOf(h, 'schema.title.toCode').when?.(context(), target(SCHEMA_ID))).toBe(false);
  });

  it('кнопки просят пересчитать себя при смене режима', () => {
    const h = harness();
    const seen = vi.fn();

    const subscription = itemOf(h, 'schema.title.toCode').onDidChange?.(seen);
    h.views.set(SCHEMA_ID, 'code');

    expect(seen).toHaveBeenCalledTimes(1);
    subscription?.dispose();
  });
});
