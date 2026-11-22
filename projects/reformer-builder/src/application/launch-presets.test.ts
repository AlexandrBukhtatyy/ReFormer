/**
 * Готовые конфиги запуска `.ui_builder/presets/*.json` — по одному на кит, у каждого проекта,
 * где они есть: проекта-образца (`projects/reformer-builder-playground`) и приложения со встроенным
 * билдером (`projects/reformer-builder-host-example`).
 *
 * Файлы никем не импортируются: их называют лаунчеру (`--config`), dev-серверу билдера и
 * плагину Vite приложения (`REFORMER_BUILDER_CONFIG`). Значит, сломаться они могут
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
import {
  launchOnlyProblems,
  parseRuntimeConfig,
  type RuntimeConfig,
} from '@/shell/boot/runtime-config';
import { applicationFromRuntime } from './builder-application';

const fromHere = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

/** Проекты с готовыми конфигами — каталогами `.ui_builder` от каталога `projects/`. */
const PROJECTS = ['reformer-builder-playground', 'reformer-builder-host-example'].map(
  (project) => ({
    project,
    uiBuilder: fromHere(`../../../${project}/.ui_builder/`),
  })
);

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

const presets = PROJECTS.flatMap(({ project, uiBuilder }) =>
  readdirSync(`${uiBuilder}presets/`)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => ({
      project,
      uiBuilder,
      name: `${project}/${file}`,
      parsed: parseRuntimeConfig(readJson(`${uiBuilder}presets/${file}`)),
    }))
);

const kitOf = (config: RuntimeConfig): unknown => config.defaults?.settings?.[KIT_SETTING];

async function idsOf(composition: ApplicationComposition): Promise<readonly string[]> {
  const loaded = await composition.load();
  return loaded.map((composed) => composed.plugin.id);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('готовые конфиги запуска', { timeout: 30_000 }, () => {
  it.each(PROJECTS)(
    '$project: их столько же, сколько китов, и каждый называет свой',
    ({ project }) => {
      const chosen = presets
        .filter((preset) => preset.project === project)
        .map(({ parsed }) => kitOf(parsed.config));

      expect([...chosen].sort()).toEqual(kits.map((catalog) => catalog.kit.id).sort());
    }
  );

  it.each(presets)(
    '$name: конфиг проекта не спорит с ним — открытие без предупреждения',
    ({ uiBuilder, parsed }) => {
      // Билдер, открыв проект, читает его `.ui_builder/config.json` ещё раз — уже как конфиг
      // проекта. Поле уровня запуска, о котором проект просит то, чего пресет не дал (`defaults`
      // с другим языком), он показывает предупреждением при каждом открытии. Пресет вправе дать
      // больше — кит по умолчанию, — но всё, что записал проект, обязан повторить.
      const project = parseRuntimeConfig(readJson(`${uiBuilder}config.json`));
      expect(launchOnlyProblems(parsed.config, project.config)).toEqual([]);
    }
  );

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
