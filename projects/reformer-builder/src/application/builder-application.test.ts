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
  'reformer.templates',
  'reformer.validator-schema',
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe('applicationFromRuntime', () => {
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
