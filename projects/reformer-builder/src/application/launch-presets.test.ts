/**
 * Готовые конфиги запуска `.ui_builder/presets/*.json` проекта-образца — четыре сочетания
 * «движок × кит».
 *
 * Файлы лежат в `projects/reformer-builder-playground` и никем не импортируются: их называют
 * лаунчеру (`--config`) и dev-серверу (`REFORMER_BUILDER_CONFIG`). Значит, сломаться они могут
 * молча — переименованный профиль или кит превращает готовый конфиг в «предупреждение и полный
 * профиль», и человек, запустивший `preset:rjsf-hexa-ui`, видит не то сочетание, которое просил.
 * Здесь это проверяется тем же путём, каким конфиг проходит при запуске: разбор, затем сборка
 * состава. Тест живёт в билдере, а не рядом с файлами: проверяет он сборку состава, а она здесь.
 *
 * Заодно — образцы форм того же проекта (`forms/`): их смысл в том, чтобы одна форма рисовалась
 * обоими китами, и компонент, которого нет в одном из каталогов, этот смысл отменяет.
 *
 * @module application/launch-presets.test
 */

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApplicationComposition } from '@/shell/boot/composition';
import { parseRuntimeConfig, type RuntimeConfig } from '@/shell/boot/runtime-config';
import { isFormSchema } from '@/plugins/reformer/core/form-model';
import { looksLikeRjsfForm } from '@/plugins/rjsf/core';
import { applicationFromRuntime } from './builder-application';
import { stubBuiltinOptions } from './composer/testing';

const fromHere = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

const PRESETS_DIR = fromHere('../../../reformer-builder-playground/.ui_builder/presets/');
const FORMS_DIR = fromHere('../../../reformer-builder-playground/forms/');

/** Каталоги китов — источник истины для их идентификаторов и состава компонентов. */
const KIT_CATALOGS = [
  fromHere('../../../../packages/reformer-ui-kit/component-catalog.json'),
  fromHere('../../../../packages/ui-kits/reformer-hexa-ui/catalog.json'),
];

interface KitCatalog {
  readonly kit: { readonly id: string };
  readonly components: readonly { readonly name: string }[];
}

const readJson = (file: string): unknown => JSON.parse(readFileSync(file, 'utf8')) as unknown;
const kits = KIT_CATALOGS.map((file) => readJson(file) as KitCatalog);

/** Плагин-редактор движка: по нему видно, какой стек на самом деле собран. */
const ENGINE_EDITOR: Readonly<Record<string, string>> = {
  'reformer.builder': 'reformer.editor-schema',
  'rjsf.builder': 'reformer.rjsf.editor',
};

const KIT_SETTING = 'plugin.kits.active';

const presetFiles = readdirSync(PRESETS_DIR)
  .filter((name) => name.endsWith('.json'))
  .sort();
const presets = presetFiles.map((name) => ({
  name,
  parsed: parseRuntimeConfig(readJson(PRESETS_DIR + name)),
}));

const kitOf = (config: RuntimeConfig): unknown => config.defaults?.settings?.[KIT_SETTING];

async function idsOf(composition: ApplicationComposition): Promise<readonly string[]> {
  const loaded = await composition.load(stubBuiltinOptions());
  return loaded.map((composed) => composed.plugin.id);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('готовые конфиги запуска', { timeout: 30_000 }, () => {
  it('их четыре, и это полная матрица «движок × кит»', () => {
    const matrix = presets.map(({ parsed }) => `${parsed.config.preset} × ${kitOf(parsed.config)}`);
    const expected = Object.keys(ENGINE_EDITOR).flatMap((engine) =>
      kits.map((catalog) => `${engine} × ${catalog.kit.id}`)
    );

    expect(presetFiles).toHaveLength(4);
    expect([...matrix].sort()).toEqual([...expected].sort());
  });

  it.each(presets)('$name разбирается без единой проблемы', ({ parsed }) => {
    expect(parsed.problems).toEqual([]);
  });

  it.each(presets)('$name собирает свой движок, а не полный профиль отказа', async ({ parsed }) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const ids = await idsOf(applicationFromRuntime(parsed.config));

    // Откат на полный профиль всегда сопровождается предупреждением — его отсутствие и есть
    // доказательство, что собран профиль из файла.
    expect(warn).not.toHaveBeenCalled();
    expect(ids).toContain(ENGINE_EDITOR[parsed.config.preset ?? '']);
  });
});

describe('образцы форм проекта-образца', () => {
  it('RJSF-образец распознаётся редактором RJSF', () => {
    expect(looksLikeRjsfForm(readFileSync(FORMS_DIR + 'contact.rjsf.json', 'utf8'))).toBe(true);
  });

  it('образец ReFormer — схема формы из компонентов, общих для обоих китов', () => {
    const text = readFileSync(FORMS_DIR + 'contact/form.schema.json', 'utf8');
    const used = [...text.matchAll(/\$component\(([^)]+)\)/g)].map((match) => match[1]);

    expect(isFormSchema(JSON.parse(text))).toBe(true);
    expect(used.length).toBeGreaterThan(0);
    for (const catalog of kits) {
      const names = new Set(catalog.components.map((component) => component.name));
      expect(used.filter((name) => !names.has(name ?? ''))).toEqual([]);
    }
  });
});
