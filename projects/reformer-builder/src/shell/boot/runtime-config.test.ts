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
  RUNTIME_CONFIG_KEYS,
  RUNTIME_PROFILE_KEYS,
} from './runtime-config';

describe('parseRuntimeConfig', () => {
  it('полный валидный конфиг разбирается без проблем', () => {
    const { config, problems } = parseRuntimeConfig({
      $schema: 'https://reformer.dev/schemas/reformer-builder-config',
      branding: { title: 'Формы Acme' },
      defaults: { locale: 'en', theme: 'dark' },
      preset: 'minimal',
      plugins: { enable: ['ai'] },
    });

    expect(problems).toEqual([]);
    expect(config).toEqual({
      branding: { title: 'Формы Acme' },
      defaults: { locale: 'en', theme: 'dark' },
      preset: 'minimal',
      plugins: { enable: ['ai'] },
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
      plugins: { enabled: ['ai'] },
    });

    expect(problems).toEqual([
      'неизвестное поле «branding.logo»',
      'неизвестное поле «defaults.fontSize»',
      'неизвестное поле «plugins.enabled»',
    ]);
  });

  it('состав приложения: профиль и поправки разбираются', () => {
    const { config, problems } = parseRuntimeConfig({
      preset: 'minimal',
      plugins: { enable: ['ai'], disable: ['preview'] },
    });

    expect(problems).toEqual([]);
    expect(config).toEqual({
      preset: 'minimal',
      plugins: { enable: ['ai'], disable: ['preview'] },
    });
  });

  it('мусор в составе называется по полю, а соседи выживают', () => {
    // Имя профиля со списком известных здесь НЕ сверяется, и это решение: профили живут
    // в `application/`, а разбор — в оболочке. Отвергает неизвестное имя тот, кто собирает
    // состав, — предупреждением и полным профилем.
    const { config, problems } = parseRuntimeConfig({
      preset: '   ',
      plugins: { enable: 'ai', disable: ['preview'] },
    });

    expect(config).toEqual({ plugins: { disable: ['preview'] } });
    expect(problems).toEqual([
      '«preset» должен быть непустой строкой',
      '«plugins.enable» должен быть списком непустых строк',
    ]);
  });

  it('свои профили и умолчания настроек организации разбираются', () => {
    const { config, problems } = parseRuntimeConfig({
      preset: 'acme',
      profiles: [
        {
          id: 'acme',
          name: 'Формы Acme',
          extends: 'rjsf.builder',
          plugins: ['reformer.editor-markdown'],
          providers: { 'reformer.kit.catalog': 'reformer.kits' },
        },
        { id: 'acme-lite', extends: 'acme', plugins: [] },
      ],
      defaults: { settings: { 'plugin.kits.active': 'hexa-ui', 'host.flag': false } },
    });

    expect(problems).toEqual([]);
    expect(config.profiles).toEqual([
      {
        id: 'acme',
        name: 'Формы Acme',
        extends: 'rjsf.builder',
        plugins: ['reformer.editor-markdown'],
        providers: { 'reformer.kit.catalog': 'reformer.kits' },
      },
      { id: 'acme-lite', extends: 'acme', plugins: [] },
    ]);
    // Значение `false` — законное умолчание, а не «нет значения».
    expect(config.defaults?.settings).toEqual({
      'plugin.kits.active': 'hexa-ui',
      'host.flag': false,
    });
  });

  it('битый профиль пропускается целиком, соседи применяются, причина названа', () => {
    const { config, problems } = parseRuntimeConfig({
      profiles: [
        { id: 'ok', plugins: ['reformer.files'] },
        { id: '', plugins: 'reformer.files' },
        'строка',
        { id: 'ok', plugins: [] },
        { id: 'extra', plugins: [], color: 'red', providers: { x: 1 } },
      ],
    });

    expect(config.profiles?.map((profile) => profile.id)).toEqual(['ok']);
    expect(problems).toEqual([
      '«profiles[1]» пропущен: id — непустая строка, plugins — список непустых строк',
      '«profiles[2]» должен быть объектом',
      '«profiles[3]» пропущен: профиль «ok» уже описан выше',
      'неизвестное поле «profiles[4]».color',
      '«profiles[4]» пропущен: providers — объект «возможность → плагин»',
    ]);
    expect(parseRuntimeConfig({ profiles: {} }).problems).toEqual([
      '«profiles» должен быть списком профилей',
    ]);
  });

  it('умолчания настроек — объект с непустыми ключами', () => {
    expect(parseRuntimeConfig({ defaults: { settings: ['x'] } }).problems).toEqual([
      '«defaults.settings» должен быть объектом «ключ настройки → значение»',
    ]);
    const { config, problems } = parseRuntimeConfig({
      defaults: { settings: { ' ': 1, 'plugin.kits.active': 'hexa-ui' } },
    });
    expect(problems).toEqual(['«defaults.settings»: пустой ключ настройки']);
    expect(config.defaults?.settings).toEqual({ 'plugin.kits.active': 'hexa-ui' });
  });

  it('«plugins» не объектом и пустые строки в списке — проблема, а не молчание', () => {
    expect(parseRuntimeConfig({ plugins: ['ai'] }).problems).toEqual([
      '«plugins» должен быть объектом',
    ]);
    expect(parseRuntimeConfig({ plugins: { disable: ['ai', ''] } }).problems).toEqual([
      '«plugins.disable» должен быть списком непустых строк',
    ]);
    // Пустая секция не создаёт фиктивного поля: «plugins: {}» — это отсутствие поправок.
    expect(parseRuntimeConfig({ plugins: {} }).config).toEqual({});
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

  it('умолчания настроек сливаются по ключу, профили — уровнем целиком', () => {
    const merged = mergeRuntimeConfig(
      {
        defaults: { locale: 'ru', settings: { a: 1, b: 2 } },
        profiles: [{ id: 'base', plugins: [] }],
      },
      { defaults: { settings: { b: 3 } }, profiles: [{ id: 'over', plugins: [] }] }
    );

    expect(merged.defaults).toEqual({ locale: 'ru', settings: { a: 1, b: 3 } });
    // Слить списки по имени значило бы собрать профиль, которого не писал никто.
    expect(merged.profiles).toEqual([{ id: 'over', plugins: [] }]);
  });

  it('пустые уровни дают пустой результат без фиктивных секций', () => {
    expect(mergeRuntimeConfig({}, {})).toEqual({});
  });

  it('состав сливается наравне с остальным — «что написано», а не «что сработает»', () => {
    // Применяет их всё равно только уровень запуска, но слияние отвечает на другой вопрос:
    // что вообще сказано в конфигах. Не слейся `preset` — `boot` не смог бы назвать его
    // человеку как неприменённое поле.
    const merged = mergeRuntimeConfig(
      { preset: 'reformer.builder', plugins: { disable: ['ai'] } },
      { preset: 'minimal' }
    );

    expect(merged).toEqual({ preset: 'minimal', plugins: { disable: ['ai'] } });
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
    properties: Record<
      string,
      {
        properties?: Record<string, { enum?: string[] }>;
        items?: { properties?: Record<string, unknown>; required?: string[] };
      }
    >;
  };

  it('состав полей совпадает', () => {
    // Корень — с набором самого разбора, а не со списком, написанным рядом: так схема
    // однажды уже разошлась с разбором на `marketplace`, и тест этого не видел.
    expect(Object.keys(schema.properties).sort()).toEqual([...RUNTIME_CONFIG_KEYS].sort());
    expect(Object.keys(schema.properties.branding.properties ?? {})).toEqual(['title']);
    expect(Object.keys(schema.properties.defaults.properties ?? {}).sort()).toEqual([
      'locale',
      'settings',
      'theme',
    ]);
    expect(Object.keys(schema.properties.profiles.items?.properties ?? {}).sort()).toEqual(
      [...RUNTIME_PROFILE_KEYS].sort()
    );
    expect(schema.properties.profiles.items?.required?.sort()).toEqual(['id', 'plugins']);
    expect(Object.keys(schema.properties.marketplace.properties ?? {})).toEqual(['registry']);
    expect(Object.keys(schema.properties.plugins.properties ?? {}).sort()).toEqual([
      'disable',
      'enable',
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
