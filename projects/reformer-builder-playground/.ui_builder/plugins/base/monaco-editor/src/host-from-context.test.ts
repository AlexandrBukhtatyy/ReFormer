/**
 * Порт Monaco из контекста: что редактор получает от служб оболочки и от провайдера модели.
 *
 * Главное здесь — файл части составного документа: он видит находки документа по своим узлам.
 * Валидатор проверяет собранную форму и публикует находки на корень; файл шага открыт текстом,
 * и без заимствования его подчёркивания пусты, даже когда ошибка — в его узле.
 *
 * Службы — двойники в объёме, который порт читает; контракты их проверены у оболочки.
 *
 * @module plugins/base/monaco-editor/host-from-context.test
 */

import { describe, expect, it } from 'vitest';
import {
  DiagnosticsServiceToken,
  DocumentModelPoint,
  DocumentModelsCapability,
  DocumentsServiceToken,
  HostMessagesCapability,
  type Diagnostic,
  type DocumentNodeAnchor,
  type PluginContext,
  type ResourceId,
} from '@reformer/builder-plugin-api';
import { monacoHostFromContext } from './host-from-context';

const ROOT: ResourceId = 'mem:form/form.schema.json';
const PART: ResourceId = 'mem:form/steps/a/form.schema.json';
const OTHER: ResourceId = 'mem:notes.md';

/** Ключи узла схемы ReFormer — то, что объявляет её провайдер модели. */
const ANCHOR: DocumentNodeAnchor = { idKey: '$nodeId', labelKey: 'component' };

function finding(nodeId: string, code: string): Diagnostic {
  return { source: 'schema', severity: 'error', code, target: { kind: 'node', nodeId } };
}

interface HarnessOptions {
  /** Ключи узла, которые объявил провайдер корня; `undefined` — не объявил. */
  readonly anchor?: DocumentNodeAnchor;
  /** Какие службы оболочки есть. По умолчанию — все. */
  readonly without?: readonly string[];
}

function harness(partText: string, options: HarnessOptions = { anchor: ANCHOR }) {
  const published = new Map<ResourceId, readonly Diagnostic[]>([
    [ROOT, [finding('inpart01', 'in-part'), finding('inroot01', 'in-root')]],
    [PART, [finding('own00001', 'own')]],
  ]);
  const listeners = new Set<(resource: ResourceId) => void>();
  const handle = {
    document: { providerId: 'form.schema', getSyncState: () => 'synced', getModel: () => ({}) },
  };
  const flushed: ResourceId[] = [];

  const services = new Map<string, unknown>([
    [
      DiagnosticsServiceToken.id,
      {
        get: (id: ResourceId) => published.get(id) ?? [],
        onDidChange: (cb: (resource: ResourceId) => void) => {
          listeners.add(cb);
          return { dispose: () => listeners.delete(cb) };
        },
      },
    ],
    [
      DocumentModelsCapability.id,
      {
        handleOf: (id: ResourceId) => (id === ROOT ? handle : null),
        ownerOf: (id: ResourceId) => (id === PART ? ROOT : null),
        partsOf: (id: ResourceId) => (id === ROOT ? [PART] : []),
      },
    ],
    [
      DocumentsServiceToken.id,
      {
        documentOf: (id: ResourceId) => (id === PART ? { getText: () => partText } : null),
        writeText: () => Promise.resolve(),
        flush: (id: ResourceId) => void flushed.push(id),
      },
    ],
    [
      HostMessagesCapability.id,
      {
        locale: 'ru',
        t: (key: string) => `host:${key}`,
        diagnosticMessage: (code: string) => `находка:${code}`,
        onDidChangeLocale: () => ({ dispose: () => {} }),
      },
    ],
  ]);
  for (const id of options.without ?? []) services.delete(id);

  const provider = {
    id: 'form.schema',
    nodePaths: () => new Map([['inroot01', ['root']]]),
    ...(options.anchor === undefined ? {} : { nodeAnchor: options.anchor }),
  };
  const ctx = {
    services: { get: (token: { id: string }) => services.get(token.id) },
    extensions: {
      get: (point: { id: string }) =>
        point.id === DocumentModelPoint.id ? [{ pluginId: 'stack', value: provider }] : [],
    },
    i18n: { locale: 'ru', t: (key: string) => key, onDidChangeLocale: () => ({ dispose() {} }) },
  } as unknown as PluginContext;

  const host = monacoHostFromContext(ctx);
  const emit = (resource: ResourceId): void => {
    for (const cb of [...listeners]) cb(resource);
  };
  return { host, emit, flushed };
}

describe('находки файла части', () => {
  it('часть видит свои находки и находки корня по узлам из своего текста', () => {
    const { host } = harness('{ "node": { "$nodeId" :  "inpart01", "children": [] } }');
    expect(host.diagnostics.get(PART).map((d) => d.code)).toEqual(['own', 'in-part']);
  });

  it('корень и посторонние ресурсы — как в своде', () => {
    const { host } = harness('{}');
    expect(host.diagnostics.get(ROOT).map((d) => d.code)).toEqual(['in-part', 'in-root']);
    expect(host.diagnostics.get(OTHER)).toEqual([]);
  });

  it('смена находок корня — повод перечитать и его части', () => {
    const { host, emit } = harness('{}');
    const seen: ResourceId[] = [];
    host.diagnostics.onDidChange((resource) => seen.push(resource));
    emit(ROOT);
    expect(seen).toEqual([ROOT, PART]);
  });

  it('ключ идентификатора называет провайдер: под другим ключом те же находки находятся', () => {
    // Редактор кода формата не знает. Провайдер, пишущий идентификатор ключом `id`, получает
    // то же заимствование — и это единственное, чем формат отличается для редактора.
    const { host } = harness('{ "node": { "id": "inpart01" } }', { anchor: { idKey: 'id' } });
    expect(host.diagnostics.get(PART).map((d) => d.code)).toEqual(['own', 'in-part']);
  });

  it('провайдер ключей не объявил — заимствовать нечего, часть видит только своё', () => {
    const { host } = harness('{ "node": { "$nodeId": "inpart01" } }', {});
    expect(host.diagnostics.get(PART).map((d) => d.code)).toEqual(['own']);
  });
});

describe('знание формата — у провайдера модели', () => {
  it('ключи узла: у документа — от его провайдера, у части — от провайдера владельца', () => {
    const { host } = harness('{}');
    expect(host.nodeAnchorFor?.(ROOT)).toEqual(ANCHOR);
    expect(host.nodeAnchorFor?.(PART)).toEqual(ANCHOR);
    expect(host.nodeAnchorFor?.(OTHER)).toBeNull();
  });

  it('пути узлов отдаёт провайдер документа; у текстового документа их нет', () => {
    const { host } = harness('{}');
    expect(host.locateNodes?.(ROOT)?.get('inroot01')).toEqual(['root']);
    expect(host.locateNodes?.(OTHER)).toBeNull();
  });
});

describe('деградация без служб', () => {
  it('без свода диагностик находок нет, а подписка — пустая', () => {
    const { host } = harness('{}', { anchor: ANCHOR, without: [DiagnosticsServiceToken.id] });
    expect(host.diagnostics.get(ROOT)).toEqual([]);
    expect(() => host.diagnostics.onDidChange(() => {}).dispose()).not.toThrow();
  });

  it('без рабочей области запись — отказ, а не тишина', async () => {
    // Правка, ушедшая в никуда, выглядит как сохранённая.
    const { host } = harness('{}', { anchor: ANCHOR, without: [DocumentsServiceToken.id] });
    await expect(host.writeText(ROOT, 'x')).rejects.toThrow(/писать некуда/);
    expect(host.documentOf(ROOT)).toBeNull();
  });

  it('уход фокуса зовёт отложенную перерисовку у службы документов', () => {
    const { host, flushed } = harness('{}');
    void host.flush?.(ROOT);
    expect(flushed).toEqual([ROOT]);
  });
});
