/**
 * Состав по конфигу запуска: что человек получает, написав `preset` — и что он получает,
 * написав его с опечаткой.
 *
 * Второе и есть предмет файла. Конфиг лежит в `.ui_builder/config.json` и пишется руками;
 * ошибка в нём не может стоить человеку инструмента, а молча собранный «не тот» состав —
 * не может остаться необъяснённым. Обе половины проверяются только здесь: `main.tsx` теста
 * не имеет и иметь не может.
 *
 * @module application/builder-application.test
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applicationFromRuntime,
  builderApplication,
  launchFromRuntime,
  STACK_SWITCH_PLUGIN_ID,
} from './builder-application';
import { BUILTIN_PLUGINS } from './composer/builtin-plugins';
import { stubBuiltinOptions } from './composer/testing';
import type { ApplicationComposition } from '@/shell/boot/composition';

async function idsOf(composition: ApplicationComposition): Promise<readonly string[]> {
  const loaded = await composition.load(stubBuiltinOptions());
  return loaded.map((composed) => composed.plugin.id).sort();
}

/** Состав по умолчанию: основа и киты. Движки форм — плагины проекта, в состав они не входят. */
const FULL = [
  'reformer.editor-markdown',
  'reformer.editor-monaco',
  'reformer.files',
  'reformer.kits',
  'reformer.plugin-manager',
  'reformer.preview',
  'reformer.stack-switch',
];

/** Основа без китов — состав профиля `builder.base`. */
const BASE = FULL.filter((id) => id !== 'reformer.kits');

afterEach(() => {
  vi.restoreAllMocks();
});

// Профиль собирается с ленивыми плагинами, и на холодном кэше трансформации (первый прогон
// после переезда файлов) первый такой тест не укладывается в 5 с умолчания — как и
// builtin-plugins с keybindings-wiring (29a2d5d9). Таймаут на блок: холодным оказывается любой
// первый по порядку, а порядок меняет фильтр `-t`.
describe('applicationFromRuntime', { timeout: 30_000 }, () => {
  it('без конфига — профиль по умолчанию', async () => {
    await expect(idsOf(applicationFromRuntime({}))).resolves.toEqual(FULL);
  });

  it('preset называет профиль, и состав становится его составом', async () => {
    await expect(idsOf(applicationFromRuntime({ preset: 'builder.base' }))).resolves.toEqual(BASE);
  });

  it('поправки применяются поверх профиля', async () => {
    const ids = await idsOf(
      applicationFromRuntime({ preset: 'builder.base', plugins: { enable: ['reformer.kits'] } })
    );

    expect(ids).toEqual(FULL);
  });

  it('неизвестный пресет — предупреждение и профиль по умолчанию, а не белый экран', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const composition = applicationFromRuntime({ preset: 'builder.bse' });

    await expect(idsOf(composition)).resolves.toEqual(FULL);
    // Молчаливый откат означал бы, что человек видит обычный билдер и не понимает, почему
    // его `preset` ничего не сделал.
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('builder.bse');
  });

  it('опечатка в поправках — то же самое: предупреждение и профиль по умолчанию', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const composition = applicationFromRuntime({ plugins: { disable: ['prewiew'] } });

    await expect(idsOf(composition)).resolves.toEqual(FULL);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('плагин проекта в поправках состава — то же самое: состав называет только встроенных', async () => {
    // Движок форм включается в проекте (`workspace.plugins.enabled`), а не конфигом запуска.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const composition = applicationFromRuntime({
      plugins: { enable: ['reformer.editor-schema'] },
    });

    await expect(idsOf(composition)).resolves.toEqual(FULL);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('умолчание — то же значение, что уходит в boot из main', async () => {
    // `builderApplication` и есть состав по умолчанию; расхождение означало бы, что тест
    // состава проверяет не то приложение, которое запускается.
    await expect(idsOf(builderApplication)).resolves.toEqual(FULL);
  });
});

describe('свои профили из конфига запуска', { timeout: 30_000 }, () => {
  it('свой профиль собирается поимённо поверх встроенной основы; прежние имена работают', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const ids = await idsOf(
      applicationFromRuntime({
        preset: 'acme',
        profiles: [
          {
            id: 'acme',
            extends: 'builder.base',
            // `kits` — прежнее имя `reformer.kits`: профиль в конфиге тоже пишет человек.
            plugins: ['kits'],
          },
        ],
      })
    );

    expect(ids).toEqual(FULL);
    // Основа с китами — это и состав по умолчанию, то есть ровно то, что дал бы откат на
    // непонятый профиль. Отличает их только предупреждение: откат без него не случается.
    expect(warn).not.toHaveBeenCalled();
  });

  it('свой профиль наследует другой свой', async () => {
    const ids = await idsOf(
      applicationFromRuntime({
        preset: 'acme-lite',
        profiles: [
          { id: 'acme', extends: 'builder.base', plugins: [] },
          { id: 'acme-lite', extends: 'acme', plugins: [], name: 'Облегчённый' },
        ],
      })
    );

    expect(ids).toEqual(BASE);
  });

  it('имя встроенного профиля не подменяется: предупреждение и встроенный состав', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const ids = await idsOf(
      applicationFromRuntime({
        preset: 'builder.base',
        profiles: [{ id: 'builder.base', plugins: ['reformer.files'] }],
      })
    );

    expect(ids).toEqual(BASE);
    expect(String(warn.mock.calls[0]?.[0])).toContain('совпадает со встроенным');
  });

  it('опечатка в своём профиле — предупреждение и профиль по умолчанию', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const typo = applicationFromRuntime({
      preset: 'acme',
      profiles: [{ id: 'acme', extends: 'builder.base', plugins: ['reformer.kist'] }],
    });
    const unknownBase = applicationFromRuntime({
      preset: 'acme',
      profiles: [{ id: 'acme', extends: 'builder.bse', plugins: [] }],
    });

    await expect(idsOf(typo)).resolves.toEqual(FULL);
    await expect(idsOf(unknownBase)).resolves.toEqual(FULL);
    expect(warn).toHaveBeenCalledTimes(2);
  });
});

describe('выбор человека поверх конфига запуска', { timeout: 30_000 }, () => {
  const BUILDER = { id: 'builder', name: 'Конструктор' };
  const BASE_PROFILE = { id: 'builder.base', name: 'Основа конструктора' };
  /** Список, из которого есть что выбирать: по умолчанию предложен один профиль. */
  const BOTH = ['builder', 'builder.base'];
  /** Свой профиль организации: существует, но в список выбора попадает только по имени. */
  const OWN = { id: 'acme', name: 'Свой состав', extends: 'builder', plugins: [] };
  /** Свой профиль без переключателя: вернуться из него было бы нечем. */
  const NO_SWITCH = {
    id: 'no-switch',
    name: 'Без переключателя',
    plugins: ['reformer.files', 'reformer.editor-monaco'],
  };

  it('имя переключателя — настоящий встроенный плагин', () => {
    // Константа написана строкой, как имена в профилях; переименуй плагин — выбор молча
    // перестал бы предлагаться, потому что «переключателя нет» ни в одном составе.
    expect(BUILTIN_PLUGINS.has(STACK_SWITCH_PLUGIN_ID)).toBe(true);
  });

  it('без конфига — состав по умолчанию; встроенный список из одного имени выбора не даёт', () => {
    const launch = launchFromRuntime({}, null);

    expect(launch.application.profile).toEqual(BUILDER);
    expect(launch.profileChoices).toEqual({ launch: BUILDER, offered: [] });
  });

  it('список из конфига предлагается к выбору', () => {
    const launch = launchFromRuntime({ presetChoices: BOTH }, null);

    expect(launch.profileChoices).toEqual({ launch: BUILDER, offered: [BUILDER, BASE_PROFILE] });
  });

  it('выбор человека собирает другой профиль; профиль запуска остаётся тем, что в конфиге', async () => {
    const launch = launchFromRuntime({ presetChoices: BOTH }, 'builder.base');

    expect(launch.application.profile).toEqual(BASE_PROFILE);
    expect(launch.profileChoices.launch).toEqual(BUILDER);
    await expect(idsOf(launch.application)).resolves.toEqual(BASE);
  });

  it('выбор сильнее preset конфига — в пределах предложенного', () => {
    const launch = launchFromRuntime({ preset: 'builder.base', presetChoices: BOTH }, 'builder');

    expect(launch.application.profile).toEqual(BUILDER);
    expect(launch.profileChoices.launch).toEqual(BASE_PROFILE);
  });

  it('выбор, равный профилю запуска, ничего не меняет', () => {
    const launch = launchFromRuntime(
      { preset: 'builder.base', presetChoices: BOTH },
      'builder.base'
    );

    expect(launch.application.profile).toEqual(BASE_PROFILE);
  });

  it('выбор вне предложенных не действует — и состав остаётся составом конфига, без шума', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Профиль настоящий и собирается — его просто нет среди предложенных.
    const launch = launchFromRuntime(
      { preset: 'builder.base', profiles: [OWN], presetChoices: BOTH },
      'acme'
    );

    // Не профиль по умолчанию: человек не сделал ничего, за что его стоило бы увести с состава,
    // настроенного организацией.
    expect(launch.application.profile).toEqual(BASE_PROFILE);
    expect(warn).not.toHaveBeenCalled();
  });

  it('пустой список и список из одного имени закрепляют состав', () => {
    for (const presetChoices of [[], ['builder.base']]) {
      const launch = launchFromRuntime({ presetChoices }, 'builder.base');

      expect(launch.application.profile).toEqual(BUILDER);
      expect(launch.profileChoices.offered).toEqual([]);
    }
  });

  it('свой профиль вне списка остаётся профилем запуска, а предложенные — на выбор', () => {
    const config = { preset: 'acme', profiles: [OWN], presetChoices: BOTH };

    const onLaunch = launchFromRuntime(config, null);
    const onChoice = launchFromRuntime(config, 'builder.base');

    expect(onLaunch.application.profile).toEqual({ id: 'acme', name: 'Свой состав' });
    expect(onLaunch.profileChoices.offered).toEqual([BUILDER, BASE_PROFILE]);
    expect(onChoice.application.profile).toEqual(BASE_PROFILE);
    expect(onChoice.profileChoices.launch.id).toBe('acme');
  });

  it('свой профиль можно предложить к выбору по имени', () => {
    const launch = launchFromRuntime(
      { profiles: [OWN], presetChoices: ['builder', 'acme'] },
      'acme'
    );

    expect(launch.application.profile.id).toBe('acme');
  });

  it('неизвестное имя в списке — предупреждение и пропуск, соседи остаются', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const launch = launchFromRuntime(
      { presetChoices: ['builder', 'builder.bse', 'builder.base'] },
      null
    );

    expect(launch.profileChoices.offered).toEqual([BUILDER, BASE_PROFILE]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('builder.bse');
  });

  it('профиль без переключателя не предлагается: вернуться из него было бы нечем', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const launch = launchFromRuntime(
      { profiles: [NO_SWITCH], presetChoices: ['builder', 'builder.base', 'no-switch'] },
      'no-switch'
    );

    expect(launch.profileChoices.offered).toEqual([BUILDER, BASE_PROFILE]);
    expect(launch.application.profile).toEqual(BUILDER);
    expect(String(warn.mock.calls[0]?.[0])).toContain('no-switch');
  });

  it('переключатель убран поправкой состава — выбора нет, и сохранённый не действует', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const launch = launchFromRuntime(
      { presetChoices: BOTH, plugins: { disable: [STACK_SWITCH_PLUGIN_ID] } },
      'builder.base'
    );

    expect(launch.application.profile).toEqual(BUILDER);
    expect(launch.profileChoices.offered).toEqual([]);
    // Организация убрала переключатель намеренно: предупреждать о каждом профиле списка незачем.
    expect(warn).not.toHaveBeenCalled();
  });

  it('состав запуска без переключателя даёт именно его, что бы человек ни выбирал раньше', () => {
    const launch = launchFromRuntime(
      { preset: 'no-switch', profiles: [NO_SWITCH], presetChoices: BOTH },
      'builder.base'
    );

    expect(launch.application.profile.id).toBe('no-switch');
    expect(launch.profileChoices.offered).toEqual([]);
  });

  it('опечатка в preset: откат на профиль по умолчанию виден в имени собранного', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const launch = launchFromRuntime({ preset: 'builder.bse' }, null);

    // Не «что написано в конфиге», а что собрано на самом деле — этим именем подписана ячейка.
    expect(launch.application.profile).toEqual(BUILDER);
    expect(launch.profileChoices.launch).toEqual(BUILDER);
  });
});
