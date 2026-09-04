/**
 * Разбор конфига билдера: валидная часть применяется, битая — называется по полю.
 * Плюс храповик согласия со схемой: `runtime-config.schema.json` существует для IDE
 * клиента и не имеет права понимать формат иначе, чем разбор.
 *
 * @module shell/boot/runtime-config.test
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createMemorySource } from '@/shell/platform/source/memory';
import {
  fetchRuntimeConfig,
  mergeRuntimeConfig,
  parseRuntimeConfig,
  readProjectRuntimeConfig,
} from './runtime-config';

describe('parseRuntimeConfig', () => {
  it('полный валидный конфиг разбирается без проблем', () => {
    const { config, problems } = parseRuntimeConfig({
      $schema: 'https://reformer.dev/schemas/reformer-builder2-config',
      branding: { title: 'Формы Acme' },
      defaults: { locale: 'en', theme: 'dark' },
    });

    expect(problems).toEqual([]);
    expect(config).toEqual({
      branding: { title: 'Формы Acme' },
      defaults: { locale: 'en', theme: 'dark' },
    });
  });

  it('не-объект — одна проблема и пустой конфиг', () => {
    expect(parseRuntimeConfig('строка').problems).toEqual(['конфиг должен быть JSON-объектом']);
    expect(parseRuntimeConfig(['массив']).config).toEqual({});
    expect(parseRuntimeConfig(null).problems).toHaveLength(1);
  });

  it('битое поле называется, а валидные соседи применяются', () => {
    const { config, problems } = parseRuntimeConfig({
      branding: { title: '   ' },
      defaults: { locale: 'fr', theme: 'dark' },
      surprise: true,
    });

    // Тема выжила, хотя локаль и титул битые: деградация по полю, а не по файлу.
    expect(config).toEqual({ defaults: { theme: 'dark' } });
    expect(problems).toEqual([
      'неизвестное поле «surprise»',
      '«branding.title» должен быть непустой строкой',
      '«defaults.locale» должен быть одним из: ru, en',
    ]);
  });

  it('неизвестные вложенные поля не проходят молча', () => {
    const { problems } = parseRuntimeConfig({
      branding: { logo: 'x.svg' },
      defaults: { fontSize: 14 },
    });

    expect(problems).toEqual([
      'неизвестное поле «branding.logo»',
      'неизвестное поле «defaults.fontSize»',
    ]);
  });
});

describe('mergeRuntimeConfig', () => {
  it('проект перекрывает запуск по полю, а не по секции', () => {
    const merged = mergeRuntimeConfig(
      { branding: { title: 'Запуск' }, defaults: { locale: 'ru', theme: 'light' } },
      { defaults: { theme: 'dark' } }
    );

    expect(merged).toEqual({
      branding: { title: 'Запуск' },
      defaults: { locale: 'ru', theme: 'dark' },
    });
  });

  it('пустые уровни дают пустой результат без фиктивных секций', () => {
    expect(mergeRuntimeConfig({}, {})).toEqual({});
  });
});

describe('readProjectRuntimeConfig', () => {
  it('нет файла — null, это норма, а не проблема', async () => {
    const source = createMemorySource({ 'src/form.json': '{}' });
    await expect(readProjectRuntimeConfig(source)).resolves.toBeNull();
  });

  it('битый JSON — проблема словами, а не исключение', async () => {
    const source = createMemorySource({ '.ui_builder/config.json': '{оборвано' });
    const result = await readProjectRuntimeConfig(source);
    expect(result?.problems[0]).toContain('невалидный JSON');
    expect(result?.config).toEqual({});
  });

  it('валидный файл разбирается', async () => {
    const source = createMemorySource({
      '.ui_builder/config.json': JSON.stringify({ branding: { title: 'Проектный титул' } }),
    });
    const result = await readProjectRuntimeConfig(source);
    expect(result?.config.branding?.title).toBe('Проектный титул');
    expect(result?.problems).toEqual([]);
  });
});

describe('fetchRuntimeConfig', () => {
  const responseOf = (body: unknown, ok = true): Response =>
    ({
      ok,
      json: () =>
        typeof body === 'string' ? Promise.reject(new Error('не JSON')) : Promise.resolve(body),
    }) as Response;

  it('лаунчера нет (404 или HTML вместо JSON) — null, работа на дефолтах', async () => {
    await expect(fetchRuntimeConfig(() => Promise.resolve(responseOf({}, false)))).resolves.toBe(
      null
    );
    await expect(fetchRuntimeConfig(() => Promise.resolve(responseOf('<html>')))).resolves.toBe(
      null
    );
    await expect(fetchRuntimeConfig(() => Promise.reject(new Error('сеть')))).resolves.toBe(null);
  });

  it('лаунчер без файла конфига отдаёт {config: null} — тоже дефолты', async () => {
    await expect(
      fetchRuntimeConfig(() => Promise.resolve(responseOf({ config: null })))
    ).resolves.toBe(null);
  });

  it('конфиг от лаунчера разбирается тем же разбором', async () => {
    const result = await fetchRuntimeConfig(() =>
      Promise.resolve(responseOf({ config: { defaults: { locale: 'en' } } }))
    );
    expect(result?.config.defaults?.locale).toBe('en');
  });
});

describe('схема для IDE согласована с разбором', () => {
  const schema = JSON.parse(
    readFileSync(
      fileURLToPath(new URL('../../../runtime-config.schema.json', import.meta.url)),
      'utf8'
    )
  ) as {
    properties: Record<string, { properties?: Record<string, { enum?: string[] }> }>;
  };

  it('состав полей совпадает', () => {
    expect(Object.keys(schema.properties).sort()).toEqual(['$schema', 'branding', 'defaults']);
    expect(Object.keys(schema.properties.branding.properties ?? {})).toEqual(['title']);
    expect(Object.keys(schema.properties.defaults.properties ?? {}).sort()).toEqual([
      'locale',
      'theme',
    ]);
  });

  it('перечисления совпадают со значениями, которые принимает разбор', () => {
    const locales = schema.properties.defaults.properties?.locale.enum ?? [];
    const themes = schema.properties.defaults.properties?.theme.enum ?? [];
    for (const locale of locales) {
      expect(parseRuntimeConfig({ defaults: { locale } }).problems).toEqual([]);
    }
    for (const theme of themes) {
      expect(parseRuntimeConfig({ defaults: { theme } }).problems).toEqual([]);
    }
    // И обратное: то, чего нет в схеме, разбор отвергает.
    expect(parseRuntimeConfig({ defaults: { locale: 'xx' } }).problems).toHaveLength(1);
    expect(parseRuntimeConfig({ defaults: { theme: 'blue' } }).problems).toHaveLength(1);
  });
});
