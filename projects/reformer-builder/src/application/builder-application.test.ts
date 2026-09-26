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
import { applicationFromRuntime, builderApplication } from './builder-application';
import { stubBuiltinOptions } from './composer/testing';
import type { ApplicationComposition } from '@/shell/boot/composition';

async function idsOf(composition: ApplicationComposition): Promise<readonly string[]> {
  const options = stubBuiltinOptions();
  const lazy = await composition.lazy(options);
  return [...composition.eager(options), ...lazy].map((composed) => composed.plugin.id).sort();
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
