/**
 * Визард по новой раскладке (`steps/<шаг>/…`) в компилирующем превью — целиком, без двойников
 * движка.
 *
 * Стык трёх мест, и разойтись они могут только здесь: кодоген печатает `steps/index.ts` и
 * импорт `./steps` из корневого `form.validation.ts`; превью читает каталог формы (`readSidecars`)
 * и собирает энтри (`./entry`) только из корневых файлов; линковщик оболочки резолвит `./steps`
 * в `steps/index.ts`. Любое звено, оставшееся «плоским», даёт визард, у которого «Далее» не
 * проверяет шаг, — и снимок текста файла этого не ловит: он сверяет строку с собой же.
 *
 * @module shell/boot/integration/wizard-steps-preview.test
 */

import { describe, expect, it } from 'vitest';
import { builtinKit, wizardSchema } from '@reformer/builder-stack-reformer/testing';
import type { ResourceId, ResourceRef } from '@reformer/builder-plugin-api';
import { BUILTIN_TARGETS, generateModule } from '@/plugins/reformer/codegen';
import type { PreviewHost, PreviewModules } from '@/plugins/reformer/render/host';
import { compileForm } from '@/plugins/reformer/render/compiling/compile';
import { extractContract } from '@/plugins/reformer/render/compiling/exports';
import { readSidecars } from '@/plugins/reformer/render/compiling/read';
import { createPluginModules } from '@/shell/boot/plugin-modules';

const ROOT = 'fake:form';

/** Порт превью над картой «путь от каталога формы → текст» — ровно то, что читает `readSidecars`. */
function treeHost(tree: ReadonlyMap<string, string>): PreviewHost {
  const ref = (id: string, kind: 'file' | 'directory'): ResourceRef => ({
    id: id as ResourceId,
    sourceId: 'fake',
    path: id.slice(id.indexOf(':') + 1),
    name: id.slice(id.lastIndexOf('/') + 1),
    kind,
    mediaType: 'text/plain',
  });
  const list = async (dir: ResourceId): Promise<readonly ResourceRef[]> => {
    const prefix = dir === ROOT ? '' : `${dir.slice(ROOT.length + 1)}/`;
    const names = new Map<string, 'file' | 'directory'>();
    for (const path of tree.keys()) {
      if (!path.startsWith(prefix)) continue;
      const rest = path.slice(prefix.length);
      const cut = rest.indexOf('/');
      names.set(cut === -1 ? rest : rest.slice(0, cut), cut === -1 ? 'file' : 'directory');
    }
    return [...names].map(([name, kind]) => ref(`${dir}/${name}`, kind));
  };
  return {
    siblings: () => list(ROOT as ResourceId),
    list,
    parentOf: (id: ResourceId) => id.slice(0, id.lastIndexOf('/')) as ResourceId,
    readText: async (id: ResourceId) => {
      const text = tree.get(id.slice(ROOT.length + 1));
      if (text === undefined) throw new Error(`нет файла ${id}`);
      return text;
    },
  } as unknown as PreviewHost;
}

describe('визард с папками шагов в компилирующем превью', () => {
  it('собирается, и пошаговая проверка из makeValidationConfig останавливает пустой шаг', async () => {
    // Обязательное поле шага — флагом в схеме: из него шаблон шага печатает `required`
    // в `steps/<шаг>/form.validation.ts` (правила сайдкара разносит по шагам другой слой).
    const schema = wizardSchema();
    const json = JSON.stringify(schema).replace(
      '"componentProps":{"label":"Почта"}',
      '"componentProps":{"label":"Почта","required":true}'
    );
    expect(json).toContain('"required":true');
    const module = await generateModule(BUILTIN_TARGETS, {
      schema: JSON.parse(json) as typeof schema,
      formName: 'Заявка',
      kit: builtinKit(),
    });
    expect(module.problems).toEqual([]);
    const tree = new Map(module.files.map((file) => [file.path, file.content]));
    // Раскладка визарда: агрегатор и папка шага действительно напечатаны.
    expect([...tree.keys()].filter((path) => path.startsWith('steps/'))).toEqual(
      expect.arrayContaining([
        'steps/index.ts',
        expect.stringMatching(/^steps\/[^/]+\/form\.validation\.ts$/),
      ])
    );

    const sources = await readSidecars(treeHost(tree), `${ROOT}/form.schema.json` as ResourceId);
    expect(sources.problems).toEqual([]);
    expect(sources.files.has('steps/index.ts')).toBe(true);
    expect(sources.files.has('index.tsx')).toBe(false);

    const plugin = createPluginModules();
    const loader: PreviewModules = {
      load: plugin.modules.load,
      prepare: async (files) => {
        const [primed] = await Promise.all([plugin.prepareCached(files), plugin.warm(files)]);
        return primed;
      },
    };
    const compiled = await compileForm(sources.files, loader);
    expect(compiled.problems).toEqual([]);
    // Энтри требует только корень: файлы шагов исполнены как импорты, но в разбор не выставлены.
    expect([...compiled.modules.keys()].some((key) => key.includes('/'))).toBe(false);

    const contract = extractContract(compiled.modules);
    expect(contract.renderBehavior).toBeDefined();
    expect(contract.validation).toBeDefined();

    const validation = compiled.modules.get('form.validation.ts') as {
      makeValidationConfig: (model: unknown) => { validateStep(step: number): Promise<boolean> };
    };
    const model = compiled.modules.get('model.ts') as Record<string, unknown>;
    const create = Object.entries(model).find(
      ([name, value]) => /^create\w*FormModel$/.test(name) && typeof value === 'function'
    )?.[1] as (() => unknown) | undefined;
    expect(create).toBeDefined();
    const config = validation.makeValidationConfig(create?.());
    // `required` поля шага доехал из `steps/<шаг>/form.validation.ts` через агрегатор:
    // пустой шаг не проходит. Без папок шагов в наборе энтри упал бы на `./steps`.
    await expect(config.validateStep(1)).resolves.toBe(false);

    plugin.dispose();
  }, 60_000);
});
