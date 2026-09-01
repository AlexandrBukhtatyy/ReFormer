import { describe, expect, it } from 'vitest';

import type { ResourceId, WhenContext } from '@/sdk';
import type { SchemaEditorHost } from '../host';
import { documentIdOf, schemaViewCommands } from './view-actions';
import { createSchemaViewStore, type SchemaViewStore } from '../session/view-mode';

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
