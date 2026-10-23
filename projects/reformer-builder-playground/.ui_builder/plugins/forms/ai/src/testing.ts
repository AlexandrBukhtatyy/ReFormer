/**
 * Двойники платформы для юнитов моста.
 *
 * Порт ассистента (`./host`) держит ровно три глагола про рабочую область, поэтому двойник
 * получается маленьким — и это его главное свойство: тест моста не поднимает ни Workspace,
 * ни OPFS, ни оболочку, а поведение проверяет то же самое. Ровно ради этого платформа и
 * приходит портом, а не импортом.
 *
 * Файлы и документы — общие двойники (`.shared/assistant-fakes`): ими же пользуются тесты стеков.
 *
 * @module plugins/forms/ai/testing
 */

import {
  formToolFail,
  formToolOk,
  type FormAgentTool,
  type FormAssistantStack,
  type FormChangeOp,
  type FormChangeSet,
  type FormHostToolName,
  type FormLandedCompanion,
  type FormStackHost,
  type FormToolContext,
  type ResourceId,
} from '@reformer/builder-plugin-api';
import {
  createFakeDocuments,
  createFakeFiles,
  type FakeDocuments,
  type FakeFiles,
} from '../../../.shared/assistant-fakes';
import type { AiHost, Translate } from './host';

export { createFakeFiles, type FakeFiles };

/** Двойник рабочей области: карта документов, активная вкладка и журнал записей. */
export interface FakeHost
  extends AiHost, Pick<FakeDocuments, 'editOutside' | 'closeDocument' | 'writes' | 'failWrites'> {
  /** Положить (или заменить) содержимое документа и сделать его активным. */
  openDocument(id: ResourceId, text: string): void;
  setActive(id: ResourceId | null): void;
}

/** Ключ и параметры одной строкой: тест сверяет КЛЮЧ, а не перевод. */
const echoTranslate: Translate = (key, params) =>
  params === undefined ? key : `${key} ${JSON.stringify(params)}`;

/** Собрать двойник платформы. */
export function createFakeHost(files?: FakeFiles): FakeHost {
  const documents = createFakeDocuments(files);
  let active: ResourceId | null = null;

  return {
    useTranslate: () => echoTranslate,
    translate: echoTranslate,

    activeResource: () => active,
    documentOf: (id) => documents.documentOf(id),
    writeText: (id, text, mark) => documents.writeText(id, text, mark),

    ...(files ? { files } : {}),

    // Открыть документ, созданный мимо двойника (файлом): текст берётся из файлов, если они есть.
    async open(id) {
      const text = files === undefined ? null : await files.read(id);
      documents.openDocument(id, text ?? documents.documentOf(id)?.getText() ?? '');
      active = id;
    },

    openDocument(id, text) {
      documents.openDocument(id, text);
      active = id;
    },

    editOutside: (id, text) => {
      documents.editOutside(id, text);
    },

    closeDocument(id) {
      documents.closeDocument(id);
      if (active === id) active = null;
    },

    writes: documents.writes,

    failWrites: (error) => {
      documents.failWrites(error);
    },

    setActive(id) {
      active = id;
    },
  };
}

// ── Двойник стека форм ──────────────────────────────────────────────────────────────────────

/** Окончание пути документа формы у двойника стека. */
export const FAKE_FORM_SUFFIX = '.fake.json';

/** Текст формы двойника: JSON со списком имён полей. */
export function fakeFormText(fields: readonly string[]): string {
  return `${JSON.stringify({ fields }, null, 2)}\n`;
}

/** Поля формы двойника по тексту; `null` — это не его форма. */
function fieldsOf(text: string): string[] | null {
  try {
    const parsed = JSON.parse(text) as { fields?: unknown };
    return Array.isArray(parsed.fields) ? parsed.fields.map(String) : null;
  } catch {
    return null;
  }
}

/** Черновик хода двойника: поля и правки, которые ход к ним добавил. */
interface FakeDraft {
  readonly fields: string[];
  readonly ops: FormChangeOp[];
}

/** Набор правок двойника: правки для журнала и поля, которыми их записать. */
interface FakeChangeSet extends FormChangeSet {
  readonly fields: readonly string[];
}

type FakeContext = FormToolContext & { readonly draft: FakeDraft };

/** Пишущий инструмент двойника: добавить поле; повтор имени — отказ. */
const addFieldTool: FormAgentTool<{ name: string }, FakeContext> = {
  name: 'add_field',
  description: 'Add a field to the form.',
  inputSchema: {
    type: 'object',
    properties: { name: { type: 'string' } },
    required: ['name'],
    additionalProperties: false,
  },
  readOnly: false,
  run({ name }, { draft }) {
    if (draft.fields.includes(name)) {
      return formToolFail('INVALID_PARAMS', `Field "${name}" already exists.`);
    }
    draft.fields.push(name);
    const op: FormChangeOp = { kind: 'add', ref: `/fields/${name}`, summary: `+${name}` };
    draft.ops.push(op);
    return { ...formToolOk(`Added ${name}.`), ops: [op] };
  },
};

/** Читающий инструмент двойника: список полей. */
const listFieldsTool: FormAgentTool<Record<string, never>, FakeContext> = {
  name: 'list_fields',
  description: 'List the form fields.',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  readOnly: true,
  run: (_params, { draft }) => formToolOk(draft.fields.join(', ') || '(no fields)'),
};

export interface FakeFormStackOptions {
  /** Идентификатор стека; по умолчанию `fake`. */
  readonly id?: string;
  /** Окончание пути документа, за который стек берётся; по умолчанию {@link FAKE_FORM_SUFFIX}. */
  readonly suffix?: string;
  /**
   * Сопутствующий файл: путь от каталога документа. Применение пишет его портом файлов той же
   * пометкой хода — так у ReFormer ложится файл правил. Без порта файлов его нет.
   */
  readonly companion?: string;
  /** Инструменты ассистента в наборе стека (по имени); по умолчанию — все три. */
  readonly hostTools?: readonly FormHostToolName[];
}

/** Двойник стека и то, что он запомнил. */
export interface FakeFormStack extends FormAssistantStack {
  /** Вызовы `rewind`: путь формы и возвращать ли сопутствующие файлы. */
  readonly rewinds: { readonly path: string; readonly files: boolean }[];
  /** Сколько раз стек подключали к хозяину. */
  readonly connections: number;
}

/**
 * Двойник стека форм: форма — JSON со списком полей, документ узнаётся по окончанию пути.
 *
 * Инструменты — `add_field` и `list_fields`; применение пишет документ одной записью с пометкой
 * хода и, если задан, сопутствующий файл портом файлов. Режима файлов у двойника нет: мост
 * обязан жить и со стеком, который его не приносит.
 */
export function createFakeFormStack(options: FakeFormStackOptions = {}): FakeFormStack {
  const suffix = options.suffix ?? FAKE_FORM_SUFFIX;
  const hostTools = options.hostTools ?? ['ask_user', 'generate_code', 'create_form'];
  const rewinds: { path: string; files: boolean }[] = [];
  let connections = 0;

  const companionOf = (host: FormStackHost, resource: ResourceId): ResourceId | null =>
    options.companion === undefined || host.files === undefined
      ? null
      : host.files.resolve(host.files.parentOf(resource), options.companion);

  const stack: FakeFormStack = {
    id: options.id ?? 'fake',
    rewinds,
    get connections() {
      return connections;
    },
    applies: (document) => document.ref.path.endsWith(suffix),
    connect(host) {
      connections += 1;
      return {
        prepare: () => Promise.resolve(),
        recognizes: (text) => fieldsOf(text) !== null,
        creationPrompt: () => 'Fake forms: create one with create_form.',
        refuseWrite: (id, form) =>
          id === form.resource ? 'The form document is written by the form tools.' : null,
        structured: {
          tools: [
            addFieldTool as FormAgentTool<never, never>,
            listFieldsTool as FormAgentTool<never, never>,
            ...hostTools,
          ],
          async load({ resource, path, text }) {
            const fields = fieldsOf(text);
            if (fields === null) return null;
            const companion = companionOf(host, resource);
            return {
              stack: stack.id,
              resource,
              path,
              text,
              state: fields,
              companions: companion === null ? [] : [companion],
            };
          },
          begin(loaded) {
            const draft: FakeDraft = { fields: [...(loaded.state as string[])], ops: [] };
            return {
              system: () => 'You edit fake forms.',
              seed: () => `Fields: ${draft.fields.join(', ') || '(none)'}`,
              context: (): FakeContext => ({ draft }),
              result: (): FakeChangeSet => ({ ops: [...draft.ops], fields: [...draft.fields] }),
            };
          },
          hasChanges: (set) => set.ops.length > 0,
          async land({ loaded, set, mark }) {
            const fields = (set as FakeChangeSet).fields;
            await host.writeText(loaded.resource, fakeFormText(fields), mark);
            const companions: FormLandedCompanion[] = [];
            const companion = companionOf(host, loaded.resource);
            if (companion !== null && host.files !== undefined) {
              const before = await host.files.read(companion);
              const after = `fields: ${fields.join(',')}\n`;
              await host.files.write(companion, after, mark);
              companions.push({ id: companion, before, after });
            }
            return { status: 'applied', companions };
          },
          async rewind(loaded, { files }) {
            rewinds.push({ path: loaded.path, files });
          },
        },
      };
    },
  };
  return stack;
}
