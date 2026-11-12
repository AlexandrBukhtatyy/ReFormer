/**
 * Ход ассистента целиком через мост: стек форм с `build_form`, настоящая генерация кода и модуль
 * формы на выходе — тот же путь, что у ассистента в билдере, над двойником рабочей области.
 *
 * Общий для теста `build_form` целым ходом и для лестницы сценариев (`assistant-ladder.test.ts`):
 * провайдер — параметр, поэтому тот же ход идёт и по сценарию двойника, и на живой модели.
 *
 * @module plugins/reformer/integration/bridge-turn
 */

import type { JsonFormSchema } from '@reformer/renderer-json';
import { validateFormSchema } from '@reformer/renderer-json/validate';
import { builtinEntries } from '../core/testing';
import { readRuleCode } from '../ai/src/stack/rule-code';
import { parseSchemaText, printSchemaText } from '../ai/src/model/schema-text';
import { createFakeFiles } from '../ai/src/stack/testing';
import { createSchemaFormStack } from '../ai/src/stack';
import { createAgentBridge } from '../../forms/ai/src/session/bridge';
import { createAiSession } from '../../forms/ai/src/session/session';
import { createProviderRegistry } from '../../forms/ai/src/providers/registry';
import type { AiProvider } from '../../forms/ai/src/providers/types';
import type { AiAssistant } from '../../forms/ai/src/plugin';
import type { ResolveLibraryReference } from '../ai/src/reference';
import { createFakeHost } from '../../forms/ai/src/testing';
import { generatorOver } from './codegen-harness';

/** Документ формы хода: модуль формы — каталог над `schema/`. */
export const TURN_DOCUMENT = 'forms/eval/schema/form.schema.json';

/** Корень модуля формы хода в рабочей области. */
export const TURN_MODULE_ROOT = 'forms/eval/';

/** Пустая форма — с неё начинается ход. */
export const EMPTY_FORM: JsonFormSchema = {
  format: 2,
  version: '1.0',
  root: { component: '$component(Box)', componentProps: { className: 'space-y-4' }, children: [] },
} as unknown as JsonFormSchema;

export interface BridgeTurnOptions {
  readonly provider: AiProvider;
  /** Сообщение пользователя. */
  readonly message?: string;
  /** `build_form` в наборе инструментов (по умолчанию — да, как в билдере). */
  readonly buildForm?: boolean;
  /** Настройки канала, как их хранит ассистент: вид, модель, предел шагов. */
  readonly config?: Readonly<Record<string, unknown>>;
  /** Справка по библиотеке (`ask_reformer`), как в плагине; без неё — инструмент без справки. */
  readonly reference?: ResolveLibraryReference;
}

/** Ход над пустой формой: документ, правила, вызовы, запросы к модели и файлы модуля. */
export async function bridgeTurn(options: BridgeTurnOptions) {
  const files = createFakeFiles();
  const host = createFakeHost(files);
  const codegen = generatorOver({ files, documentOf: (id) => host.documentOf(id) });
  files.put(TURN_DOCUMENT, printSchemaText(EMPTY_FORM));
  host.openDocument(TURN_DOCUMENT, printSchemaText(EMPTY_FORM));

  const providers = createProviderRegistry();
  const seen: string[][] = [];
  providers.register({
    ...options.provider,
    stream: (req, signal) => {
      seen.push(req.tools.map((tool) => tool.name));
      return options.provider.stream(req, signal);
    },
  });
  const assistant = {
    providers,
    loadConfig: () => Promise.resolve(options.config ?? { kind: 'anthropic' as const }),
    saveConfig: () => Promise.resolve(),
    clearConfig: () => Promise.resolve(),
    models: () => Promise.resolve([]),
    activate: () => Promise.reject(new Error('не нужно в тесте')),
    restore: () => Promise.resolve(null),
  } as unknown as AiAssistant;

  const session = createAiSession();
  const stack = createSchemaFormStack({
    catalog: () => builtinEntries(),
    ...(options.reference ? { reference: options.reference } : {}),
    validateForm: () => Promise.resolve(validateFormSchema),
    scopeOf: (id) => files.scopeOf(id),
    generator: () => codegen,
    buildForm: options.buildForm ?? true,
  });
  const bridge = createAgentBridge({
    assistant,
    host,
    session,
    agentCommands: () => [],
    executeCommand: () => Promise.resolve(undefined),
    stacks: () => [stack],
    generator: () => codegen,
    formCreator: () => undefined,
  });
  await bridge.send(options.message ?? 'Собери форму.');

  const text = host.documentOf(TURN_DOCUMENT)?.getText() ?? '';
  const { rules } = await readRuleCode(files, TURN_DOCUMENT, TURN_DOCUMENT);
  const tools = session
    .get()
    .entries.filter((entry) => entry.role === 'assistant')
    .flatMap((entry) => entry.tools);

  /**
   * Файлы модуля формы — пути от корня модуля и текст, документ формы в том виде, в каком он
   * открыт во вкладке: так модуль ложится на диск и проверяется верификатором MCP.
   */
  const moduleFiles = (): Array<{ path: string; text: string }> => {
    const paths = new Set(
      files.writes.map((write) => write.path).filter((path) => path.startsWith(TURN_MODULE_ROOT))
    );
    paths.add(TURN_DOCUMENT);
    return [...paths].sort().map((path) => ({
      path: path.slice(TURN_MODULE_ROOT.length),
      text: path === TURN_DOCUMENT ? text : (files.text(path) ?? ''),
    }));
  };

  return { schema: parseSchemaText(text), rules, tools, seen, host, files, moduleFiles };
}
