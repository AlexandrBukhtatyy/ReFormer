/**
 * Порт Monaco: файл части составного документа видит находки документа по своим узлам.
 *
 * Валидатор проверяет собранную форму и публикует находки на корень; файл шага открыт текстом,
 * и без заимствования его подчёркивания пусты, даже когда ошибка — в его узле.
 *
 * @module shell/boot/ports/monaco.test
 */

import { describe, expect, it } from 'vitest';
import type {
  Diagnostic,
  DiagnosticsService,
  ResourceId,
} from '@reformer/builder-plugin-api/internal';
import { createI18nService } from '@/shell/platform/services/i18n/i18n';
import type { ProjectHost } from '@/shell/boot/project/project';
import { createMonacoHost } from './monaco';

const ROOT = 'mem:form/form.schema.json' as ResourceId;
const PART = 'mem:form/steps/a/form.schema.json' as ResourceId;
const OTHER = 'mem:notes.md' as ResourceId;

function finding(nodeId: string, code: string): Diagnostic {
  return { source: 'schema', severity: 'error', code, target: { kind: 'node', nodeId } };
}

function harness(partText: string) {
  const published = new Map<ResourceId, readonly Diagnostic[]>([
    [ROOT, [finding('inpart01', 'in-part'), finding('inroot01', 'in-root')]],
    [PART, [finding('own00001', 'own')]],
  ]);
  const listeners = new Set<(resource: ResourceId) => void>();
  const diagnostics = {
    get: (id: ResourceId) => published.get(id) ?? [],
    onDidChange: (cb: (resource: ResourceId) => void) => {
      listeners.add(cb);
      return { dispose: () => listeners.delete(cb) };
    },
  } as unknown as DiagnosticsService;
  const handle = { parts: () => [PART] };
  const session = {
    models: {
      opened: () => new Map([[ROOT, handle]]),
      handleOf: (id: ResourceId) => (id === ROOT ? handle : null),
    },
    documents: {
      documentOf: (id: ResourceId) => (id === PART ? { getText: () => partText } : null),
    },
  };
  const project = { get: () => session } as unknown as ProjectHost;
  const host = createMonacoHost({
    project,
    i18n: createI18nService(),
    diagnostics,
    extensions: { get: () => [] },
  });
  const emit = (resource: ResourceId): void => {
    for (const cb of [...listeners]) cb(resource);
  };
  return { host, emit };
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
});
