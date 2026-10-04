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

/** Демо-стек поверх основы — состав профиля `plain.builder`. */
const PLAIN_STACK = [...BASE, 'reformer.plain'].sort();

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
    await expect(idsOf(applicationFromRuntime({ preset: 'plain.builder' }))).resolves.toEqual(
      PLAIN_STACK
    );
  });

  it('поправки применяются поверх профиля', async () => {
    const ids = await idsOf(
      applicationFromRuntime({ preset: 'builder.base', plugins: { enable: ['reformer.kits'] } })
    );

    expect(ids).toEqual(FULL);
  });

  it('неизвестный пресет — предупреждение и профиль по умолчанию, а не белый экран', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const composition = applicationFromRuntime({ preset: 'plain.bulder' });

    await expect(idsOf(composition)).resolves.toEqual(FULL);
    // Молчаливый откат означал бы, что человек видит обычный билдер и не понимает, почему
    // его `preset` ничего не сделал.
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('plain.bulder');
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
  const PLAIN_OF_ACME = [...FULL, 'reformer.plain'].sort();

  it('свой профиль собирается поимённо поверх встроенной основы; прежние имена работают', async () => {
    const ids = await idsOf(
      applicationFromRuntime({
        preset: 'acme',
        profiles: [
          {
            id: 'acme',
            extends: 'builder.base',
            // `kits` — прежнее имя `reformer.kits`: профиль в конфиге тоже пишет человек.
            plugins: ['kits', 'reformer.plain'],
          },
        ],
      })
    );

    expect(ids).toEqual(PLAIN_OF_ACME);
  });

  it('свой профиль наследует другой свой', async () => {
    const ids = await idsOf(
      applicationFromRuntime({
        preset: 'acme-lite',
        profiles: [
          { id: 'acme', extends: 'plain.builder', plugins: [] },
          { id: 'acme-lite', extends: 'acme', plugins: [], name: 'Облегчённый' },
        ],
      })
    );

    expect(ids).toEqual(PLAIN_STACK);
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
      profiles: [{ id: 'acme', extends: 'builder.base', plugins: ['reformer.plian'] }],
    });
    const unknownBase = applicationFromRuntime({
      preset: 'acme',
      profiles: [{ id: 'acme', extends: 'plain.bulder', plugins: [] }],
    });

    await expect(idsOf(typo)).resolves.toEqual(FULL);
    await expect(idsOf(unknownBase)).resolves.toEqual(FULL);
    expect(warn).toHaveBeenCalledTimes(2);
  });
});

describe('выбор человека поверх конфига запуска', { timeout: 30_000 }, () => {
  const BUILDER = { id: 'builder', name: 'Конструктор' };
  const PLAIN = { id: 'plain.builder', name: 'Простая форма (демо-стек)' };
  /** Список, из которого есть что выбирать: по умолчанию предложен один профиль. */
  const BOTH = ['builder', 'plain.builder'];
  /** Свой профиль с китами и демо-стеком. */
  const ALL_STACKS = {
    id: 'all-stacks',
    name: 'Киты и демо-стек',
    extends: 'builder',
    plugins: ['reformer.plain'],
  };
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

    expect(launch.profileChoices).toEqual({ launch: BUILDER, offered: [BUILDER, PLAIN] });
  });

  it('выбор человека собирает другой профиль; профиль запуска остаётся тем, что в конфиге', async () => {
    const launch = launchFromRuntime({ presetChoices: BOTH }, 'plain.builder');

    expect(launch.application.profile).toEqual(PLAIN);
    expect(launch.profileChoices.launch).toEqual(BUILDER);
    await expect(idsOf(launch.application)).resolves.toContain('reformer.plain');
  });

  it('выбор сильнее preset конфига — в пределах предложенного', () => {
    const launch = launchFromRuntime({ preset: 'plain.builder', presetChoices: BOTH }, 'builder');

    expect(launch.application.profile).toEqual(BUILDER);
    expect(launch.profileChoices.launch).toEqual(PLAIN);
  });

  it('выбор, равный профилю запуска, ничего не меняет', () => {
    const launch = launchFromRuntime(
      { preset: 'plain.builder', presetChoices: BOTH },
      'plain.builder'
    );

    expect(launch.application.profile).toEqual(PLAIN);
  });

  it('выбор вне предложенных не действует — и состав остаётся составом конфига, без шума', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const launch = launchFromRuntime(
      { preset: 'plain.builder', presetChoices: BOTH },
      'builder.base'
    );

    // Не профиль по умолчанию: человек не сделал ничего, за что его стоило бы увести с состава,
    // настроенного организацией.
    expect(launch.application.profile).toEqual(PLAIN);
    expect(warn).not.toHaveBeenCalled();
  });

  it('пустой список и список из одного имени закрепляют состав', () => {
    for (const presetChoices of [[], ['plain.builder']]) {
      const launch = launchFromRuntime({ presetChoices }, 'plain.builder');

      expect(launch.application.profile).toEqual(BUILDER);
      expect(launch.profileChoices.offered).toEqual([]);
    }
  });

  it('свой профиль вне списка остаётся профилем запуска, а предложенные — на выбор', () => {
    const config = { preset: 'all-stacks', profiles: [ALL_STACKS], presetChoices: BOTH };

    const onLaunch = launchFromRuntime(config, null);
    const onChoice = launchFromRuntime(config, 'plain.builder');

    expect(onLaunch.application.profile).toEqual({ id: 'all-stacks', name: 'Киты и демо-стек' });
    expect(onLaunch.profileChoices.offered).toEqual([BUILDER, PLAIN]);
    expect(onChoice.application.profile).toEqual(PLAIN);
    expect(onChoice.profileChoices.launch.id).toBe('all-stacks');
  });

  it('свой профиль можно предложить к выбору по имени', () => {
    const launch = launchFromRuntime(
      { profiles: [ALL_STACKS], presetChoices: ['builder', 'all-stacks'] },
      'all-stacks'
    );

    expect(launch.application.profile.id).toBe('all-stacks');
  });

  it('неизвестное имя в списке — предупреждение и пропуск, соседи остаются', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const launch = launchFromRuntime(
      { presetChoices: ['builder', 'plain.bulder', 'plain.builder'] },
      null
    );

    expect(launch.profileChoices.offered).toEqual([BUILDER, PLAIN]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('plain.bulder');
  });

  it('профиль без переключателя не предлагается: вернуться из него было бы нечем', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const launch = launchFromRuntime(
      { profiles: [NO_SWITCH], presetChoices: ['builder', 'plain.builder', 'no-switch'] },
      'no-switch'
    );

    expect(launch.profileChoices.offered).toEqual([BUILDER, PLAIN]);
    expect(launch.application.profile).toEqual(BUILDER);
    expect(String(warn.mock.calls[0]?.[0])).toContain('no-switch');
  });

  it('переключатель убран поправкой состава — выбора нет, и сохранённый не действует', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const launch = launchFromRuntime(
      { presetChoices: BOTH, plugins: { disable: [STACK_SWITCH_PLUGIN_ID] } },
      'plain.builder'
    );

    expect(launch.application.profile).toEqual(BUILDER);
    expect(launch.profileChoices.offered).toEqual([]);
    // Организация убрала переключатель намеренно: предупреждать о каждом профиле списка незачем.
    expect(warn).not.toHaveBeenCalled();
  });

  it('состав запуска без переключателя даёт именно его, что бы человек ни выбирал раньше', () => {
    const launch = launchFromRuntime(
      { preset: 'no-switch', profiles: [NO_SWITCH], presetChoices: BOTH },
      'plain.builder'
    );

    expect(launch.application.profile.id).toBe('no-switch');
    expect(launch.profileChoices.offered).toEqual([]);
  });

  it('опечатка в preset: откат на профиль по умолчанию виден в имени собранного', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const launch = launchFromRuntime({ preset: 'plain.bulder' }, null);

    // Не «что написано в конфиге», а что собрано на самом деле — этим именем подписана ячейка.
    expect(launch.application.profile).toEqual(BUILDER);
    expect(launch.profileChoices.launch).toEqual(BUILDER);
  });
});
