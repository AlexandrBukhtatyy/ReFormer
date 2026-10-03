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

const FULL = [
  'reformer.ai',
  'reformer.codegen',
  'reformer.editor-markdown',
  'reformer.editor-monaco',
  'reformer.editor-schema',
  'reformer.files',
  'reformer.kits',
  'reformer.plugin-manager',
  'reformer.preview',
  'reformer.preview-runtime',
  'reformer.stack-switch',
  'reformer.templates',
  'reformer.validator-schema',
];

afterEach(() => {
  vi.restoreAllMocks();
});

// Полный профиль собирается с ленивыми плагинами, и на холодном кэше трансформации (первый прогон
// после переезда файлов) первый такой тест не укладывается в 5 с умолчания — как и
// builtin-plugins с keybindings-wiring (29a2d5d9). Таймаут на блок: холодным оказывается любой
// первый по порядку, а порядок меняет фильтр `-t`.
describe('applicationFromRuntime', { timeout: 30_000 }, () => {
  it('без конфига — полный профиль', async () => {
    await expect(idsOf(applicationFromRuntime({}))).resolves.toEqual(FULL);
  });

  it('preset называет профиль, и состав становится его составом', async () => {
    await expect(idsOf(applicationFromRuntime({ preset: 'minimal' }))).resolves.toEqual([
      'reformer.editor-monaco',
      'reformer.files',
      'reformer.validator-schema',
    ]);
  });

  it('поправки применяются поверх профиля', async () => {
    const ids = await idsOf(
      applicationFromRuntime({ preset: 'minimal', plugins: { enable: ['reformer.preview'] } })
    );

    expect(ids).toEqual([
      'reformer.editor-monaco',
      'reformer.files',
      'reformer.preview',
      'reformer.validator-schema',
    ]);
  });

  it('неизвестный пресет — предупреждение и полный профиль, а не белый экран', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const composition = applicationFromRuntime({ preset: 'minimalll' });

    await expect(idsOf(composition)).resolves.toEqual(FULL);
    // Молчаливый откат означал бы, что человек видит полный билдер и не понимает, почему
    // его `preset` ничего не сделал.
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('minimalll');
  });

  it('опечатка в поправках — то же самое: предупреждение и полный профиль', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const composition = applicationFromRuntime({ plugins: { disable: ['prewiew'] } });

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
  const RJSF_OF_ACME = [
    'reformer.editor-markdown',
    'reformer.editor-monaco',
    'reformer.files',
    'reformer.kits',
    'reformer.plugin-manager',
    'reformer.preview',
    'reformer.rjsf.editor',
    'reformer.rjsf.render',
    'reformer.stack-switch',
  ];

  it('свой профиль собирается поимённо поверх встроенной основы; прежние имена работают', async () => {
    const ids = await idsOf(
      applicationFromRuntime({
        preset: 'acme',
        profiles: [
          {
            id: 'acme',
            extends: 'builder.base',
            // `kits` — прежнее имя `reformer.kits`: профиль в конфиге тоже пишет человек.
            plugins: ['kits', 'reformer.rjsf.editor', 'reformer.rjsf.render'],
          },
        ],
      })
    );

    expect(ids).toEqual(RJSF_OF_ACME);
  });

  it('свой профиль наследует другой свой', async () => {
    const ids = await idsOf(
      applicationFromRuntime({
        preset: 'acme-lite',
        profiles: [
          { id: 'acme', extends: 'rjsf.builder', plugins: [] },
          { id: 'acme-lite', extends: 'acme', plugins: [], name: 'Облегчённый' },
        ],
      })
    );

    expect(ids).toEqual(RJSF_OF_ACME);
  });

  it('имя встроенного профиля не подменяется: предупреждение и встроенный состав', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const ids = await idsOf(
      applicationFromRuntime({
        preset: 'minimal',
        profiles: [{ id: 'minimal', plugins: ['reformer.files'] }],
      })
    );

    expect(ids).toEqual(['reformer.editor-monaco', 'reformer.files', 'reformer.validator-schema']);
    expect(String(warn.mock.calls[0]?.[0])).toContain('совпадает со встроенным');
  });

  it('опечатка в своём профиле — предупреждение и полный профиль', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const typo = applicationFromRuntime({
      preset: 'acme',
      profiles: [{ id: 'acme', extends: 'builder.base', plugins: ['reformer.rjsf.editr'] }],
    });
    const unknownBase = applicationFromRuntime({
      preset: 'acme',
      profiles: [{ id: 'acme', extends: 'rjsf.bulder', plugins: [] }],
    });

    await expect(idsOf(typo)).resolves.toEqual(FULL);
    await expect(idsOf(unknownBase)).resolves.toEqual(FULL);
    expect(warn).toHaveBeenCalledTimes(2);
  });
});

describe('выбор человека поверх конфига запуска', { timeout: 30_000 }, () => {
  const REFORMER = { id: 'reformer.builder', name: 'ReFormer' };
  const RJSF = { id: 'rjsf.builder', name: 'RJSF' };
  /** Свой профиль с обоими стеками — как в dev-конфиге билдера. */
  const ALL_STACKS = {
    id: 'all-stacks',
    name: 'ReFormer + RJSF',
    extends: 'reformer.builder',
    plugins: ['reformer.rjsf.editor', 'reformer.rjsf.render'],
  };

  it('имя переключателя — настоящий встроенный плагин', () => {
    // Константа написана строкой, как имена в профилях; переименуй плагин — выбор молча
    // перестал бы предлагаться, потому что «переключателя нет» ни в одном составе.
    expect(BUILTIN_PLUGINS.has(STACK_SWITCH_PLUGIN_ID)).toBe(true);
  });

  it('без выбора — состав конфига и встроенный список предложенных', () => {
    const launch = launchFromRuntime({}, null);

    expect(launch.application.profile).toEqual(REFORMER);
    expect(launch.profileChoices).toEqual({ launch: REFORMER, offered: [REFORMER, RJSF] });
  });

  it('выбор человека собирает другой профиль; профиль запуска остаётся тем, что в конфиге', async () => {
    const launch = launchFromRuntime({}, 'rjsf.builder');

    expect(launch.application.profile).toEqual(RJSF);
    expect(launch.profileChoices.launch).toEqual(REFORMER);
    await expect(idsOf(launch.application)).resolves.toContain('reformer.rjsf.editor');
  });

  it('выбор сильнее preset конфига — в пределах предложенного', () => {
    const launch = launchFromRuntime({ preset: 'rjsf.builder' }, 'reformer.builder');

    expect(launch.application.profile).toEqual(REFORMER);
    expect(launch.profileChoices.launch).toEqual(RJSF);
  });

  it('выбор, равный профилю запуска, ничего не меняет', () => {
    const launch = launchFromRuntime({ preset: 'rjsf.builder' }, 'rjsf.builder');

    expect(launch.application.profile).toEqual(RJSF);
  });

  it('выбор вне предложенных не действует — и состав остаётся составом конфига, без шума', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const launch = launchFromRuntime({ preset: 'rjsf.builder' }, 'minimal');

    // Не полный профиль: человек не сделал ничего, за что его стоило бы увести с состава,
    // настроенного организацией.
    expect(launch.application.profile).toEqual(RJSF);
    expect(warn).not.toHaveBeenCalled();
  });

  it('пустой список и список из одного имени закрепляют состав', () => {
    for (const presetChoices of [[], ['rjsf.builder']]) {
      const launch = launchFromRuntime({ presetChoices }, 'rjsf.builder');

      expect(launch.application.profile).toEqual(REFORMER);
      expect(launch.profileChoices.offered).toEqual([]);
    }
  });

  it('свой профиль вне списка остаётся профилем запуска, а предложенные — на выбор', () => {
    const config = { preset: 'all-stacks', profiles: [ALL_STACKS] };

    const onLaunch = launchFromRuntime(config, null);
    const onChoice = launchFromRuntime(config, 'rjsf.builder');

    expect(onLaunch.application.profile).toEqual({ id: 'all-stacks', name: 'ReFormer + RJSF' });
    expect(onLaunch.profileChoices.offered).toEqual([REFORMER, RJSF]);
    expect(onChoice.application.profile).toEqual(RJSF);
    expect(onChoice.profileChoices.launch.id).toBe('all-stacks');
  });

  it('свой профиль можно предложить к выбору по имени', () => {
    const launch = launchFromRuntime(
      { profiles: [ALL_STACKS], presetChoices: ['reformer.builder', 'all-stacks'] },
      'all-stacks'
    );

    expect(launch.application.profile.id).toBe('all-stacks');
  });

  it('неизвестное имя в списке — предупреждение и пропуск, соседи остаются', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const launch = launchFromRuntime(
      { presetChoices: ['reformer.builder', 'rjsf.bulder', 'rjsf.builder'] },
      null
    );

    expect(launch.profileChoices.offered).toEqual([REFORMER, RJSF]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('rjsf.bulder');
  });

  it('профиль без переключателя не предлагается: вернуться из него было бы нечем', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const launch = launchFromRuntime(
      { presetChoices: ['reformer.builder', 'rjsf.builder', 'minimal'] },
      'minimal'
    );

    expect(launch.profileChoices.offered).toEqual([REFORMER, RJSF]);
    expect(launch.application.profile).toEqual(REFORMER);
    expect(String(warn.mock.calls[0]?.[0])).toContain('minimal');
  });

  it('переключатель убран поправкой состава — выбора нет, и сохранённый не действует', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const launch = launchFromRuntime(
      { plugins: { disable: [STACK_SWITCH_PLUGIN_ID] } },
      'rjsf.builder'
    );

    expect(launch.application.profile).toEqual(REFORMER);
    expect(launch.profileChoices.offered).toEqual([]);
    // Организация убрала переключатель намеренно: предупреждать о каждом профиле списка незачем.
    expect(warn).not.toHaveBeenCalled();
  });

  it('состав запуска без переключателя даёт именно его, что бы человек ни выбирал раньше', () => {
    const launch = launchFromRuntime({ preset: 'minimal' }, 'rjsf.builder');

    expect(launch.application.profile.id).toBe('minimal');
    expect(launch.profileChoices.offered).toEqual([]);
  });

  it('опечатка в preset: откат на полный профиль виден в имени собранного', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const launch = launchFromRuntime({ preset: 'rjsf.bulder' }, null);

    // Не «что написано в конфиге», а что собрано на самом деле — этим именем подписана ячейка.
    expect(launch.application.profile).toEqual(REFORMER);
    expect(launch.profileChoices.launch).toEqual(REFORMER);
  });
});
