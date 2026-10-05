/**
 * Готовые конфиги запуска `.ui_builder/presets/*.json` проекта-образца — по одному на кит.
 *
 * Файлы лежат в `projects/reformer-builder-playground` и никем не импортируются: их называют
 * лаунчеру (`--config`) и dev-серверу (`REFORMER_BUILDER_CONFIG`). Значит, сломаться они могут
 * молча — переименованный кит или поле превращает готовый конфиг в «предупреждение и состав
 * по умолчанию», и человек, запустивший `preset:hexa-ui`, видит не тот кит, который просил.
 * Здесь это проверяется тем же путём, каким конфиг проходит при запуске: разбор, затем сборка
 * состава. Тест живёт в билдере, а не рядом с файлами: проверяет он сборку состава, а она здесь.
 *
 * Движка готовый конфиг не выбирает: движки форм — плагины. Не выбирает он и состав: киты
 * едут плагином приложения, и готовый конфиг только называет кит по умолчанию его настройкой.
 *
 * @module application/launch-presets.test
 */

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApplicationComposition } from '@/shell/boot/composition';
import { parseRuntimeConfig, type RuntimeConfig } from '@/shell/boot/runtime-config';
import { applicationFromRuntime } from './builder-application';

const fromHere = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

const PRESETS_DIR = fromHere('../../../reformer-builder-playground/.ui_builder/presets/');

/** Каталоги китов — источник истины для их идентификаторов. */
const KIT_CATALOGS = [
  fromHere('../../../../packages/reformer-ui-kit/component-catalog.json'),
  fromHere('../../../reformer-builder-playground/.ui_builder/plugins/kit-hexa-ui/catalog.json'),
];

interface KitCatalog {
  readonly kit: { readonly id: string };
}

const readJson = (file: string): unknown => JSON.parse(readFileSync(file, 'utf8')) as unknown;
const kits = KIT_CATALOGS.map((file) => readJson(file) as KitCatalog);

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
  const loaded = await composition.load();
  return loaded.map((composed) => composed.plugin.id);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('готовые конфиги запуска', { timeout: 30_000 }, () => {
  it('их столько же, сколько китов, и каждый называет свой', () => {
    const chosen = presets.map(({ parsed }) => kitOf(parsed.config));

    expect([...chosen].sort()).toEqual(kits.map((catalog) => catalog.kit.id).sort());
  });

  it.each(presets)('$name разбирается без единой проблемы', ({ parsed }) => {
    expect(parsed.problems).toEqual([]);
  });

  it.each(presets)('$name собирает настроенный состав, а не состав отказа', async ({ parsed }) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const ids = await idsOf(applicationFromRuntime(parsed.config));

    // Откат на профиль по умолчанию всегда сопровождается предупреждением — его отсутствие
    // и есть доказательство, что конфиг применён как написан.
    expect(warn).not.toHaveBeenCalled();
    expect(ids.length).toBeGreaterThan(0);
  });
});
