import { describe, expect, it } from 'vitest';

import { parsePluginManifest, parsePluginManifestValue } from './manifest-parser';
import { BUILDER_API_VERSION } from './manifest';

const good = {
  id: 'acme-forms',
  name: 'Acme Forms',
  version: '1.0.0',
  apiVersion: '^1',
  main: 'main.js',
};

/** Поставка по умолчанию у этих проверок — плагин каталога: у него есть и каталог, и вход. */
const project = (dir: string) => ({ kind: 'project', dir }) as const;

const parse = (fields: Record<string, unknown>, dirName = 'acme-forms') =>
  parsePluginManifest(JSON.stringify(fields), project(dirName));

describe('разбор манифеста', () => {
  it('читает манифест из контракта целиком', () => {
    const result = parse(good);

    expect(result).toEqual({
      ok: true,
      manifest: {
        id: 'acme-forms',
        name: 'Acme Forms',
        version: '1.0.0',
        apiVersion: '^1',
        source: { kind: 'project', dir: 'acme-forms' },
        main: 'main.js',
      },
    });
  });

  it('подставляет имя и версию, но не идентификатор и не точку входа', () => {
    const result = parse({ id: 'acme-forms', apiVersion: '1', main: 'main.js' });

    // Имя и версия — подпись для списка, у них есть осмысленное умолчание. У `id` и `main`
    // его нет: плагин без точки входа нечего грузить, и молчаливое «а вдруг main.js» скрыло бы
    // от автора, что манифест неполон.
    expect(result.ok && result.manifest.name).toBe('acme-forms');
    expect(result.ok && result.manifest.version).toBe('0.0.0');
  });

  it('нормализует точку входа', () => {
    const result = parse({ ...good, main: './dist/./main.js' });

    expect(result.ok && result.manifest.main).toBe('dist/main.js');
  });
});

describe('манифест встроенного плагина', () => {
  /**
   * Встроенная поставка ПРОХОДИТ тот же разбор, что и плагин каталога, — в этом и состоит
   * утверждение «один контракт». Отличий ровно два, и оба проверяются здесь: у встроенного
   * нет каталога (значит, нечему совпадать с идентификатором) и нет точки входа (его код
   * уже в бандле), зато есть способ доставки.
   */
  const builtin = { kind: 'builtin' } as const;
  const lazy = {
    id: 'reformer.ai',
    name: 'Ассистент',
    apiVersion: '^1',
    builtin: { loading: 'lazy' },
  };

  it('разбирается без каталога и без точки входа', () => {
    const result = parsePluginManifestValue(lazy, builtin);

    expect(result).toEqual({
      ok: true,
      manifest: {
        id: 'reformer.ai',
        name: 'Ассистент',
        version: '0.0.0',
        apiVersion: '^1',
        source: { kind: 'builtin' },
        builtin: { loading: 'lazy' },
      },
    });
  });

  it('идентификатор с папкой не сверяется: у встроенного её нет', () => {
    // `reformer.ai` лежит в `plugins/ai`, и требовать совпадения значило бы запретить
    // пространство имён, ради которого оно и заведено.
    expect(parsePluginManifestValue(lazy, builtin).ok).toBe(true);
  });

  it('точка входа отвергается: грузить из каталога нечего', () => {
    const result = parsePluginManifestValue({ ...lazy, main: 'main.js' }, builtin);

    expect(!result.ok && result.problem.code).toBe('manifest-invalid');
    expect(!result.ok && result.problem.message).toContain('main');
  });

  it('способ доставки обязателен и должен быть известным', () => {
    expect(parsePluginManifestValue({ ...lazy, builtin: undefined }, builtin).ok).toBe(false);
    expect(parsePluginManifestValue({ ...lazy, builtin: { loading: 'соон' } }, builtin).ok).toBe(
      false
    );
  });

  it('статический обязан объяснить себя, ленивый — не вправе', () => {
    // Ленивость — умолчание, и объяснять надо ОТСТУПЛЕНИЕ от него. Необязательная причина
    // у `eager` означала бы, что через полгода запись без довода не отличить от забытой.
    expect(parsePluginManifestValue({ ...lazy, builtin: { loading: 'eager' } }, builtin).ok).toBe(
      false
    );
    expect(
      parsePluginManifestValue(
        { ...lazy, builtin: { loading: 'eager', reason: 'его словарь вносит композиция' } },
        builtin
      ).ok
    ).toBe(true);
    expect(
      parsePluginManifestValue(
        { ...lazy, builtin: { loading: 'lazy', reason: 'просто так' } },
        builtin
      ).ok
    ).toBe(false);
  });

  it('плагин каталога способа доставки не объявляет: им распоряжается не он', () => {
    const result = parse({ ...good, builtin: { loading: 'eager', reason: 'хочу' } });

    expect(!result.ok && result.problem.code).toBe('manifest-invalid');
  });
});

describe('манифест отвергается', () => {
  it('когда это не JSON', () => {
    const result = parsePluginManifest('{ "id": "acme-forms"', project('acme-forms'));

    expect(result.ok).toBe(false);
    expect(!result.ok && result.problem.code).toBe('manifest-unreadable');
  });

  it('когда это JSON, но не объект', () => {
    const result = parsePluginManifest('[1, 2, 3]', project('acme-forms'));

    expect(!result.ok && result.problem.code).toBe('manifest-invalid');
  });

  it('когда нет обязательного поля', () => {
    for (const missing of ['id', 'apiVersion', 'main']) {
      const fields: Record<string, unknown> = { ...good };
      delete fields[missing];

      const result = parse(fields);

      expect(!result.ok && result.problem.code, missing).toBe('manifest-invalid');
      expect(!result.ok && result.problem.message).toContain(missing);
    }
  });

  it('когда идентификатор не годится в ключ реестра', () => {
    const result = parse({ ...good, id: 'acme forms/x' }, 'acme forms/x');

    expect(!result.ok && result.problem.code).toBe('manifest-invalid');
  });

  it('когда идентификатор не совпадает с именем каталога', () => {
    // Каталог — единственное, что видно до чтения манифеста, и именно им адресуются
    // включение и перезагрузка. Разойдясь, они говорили бы о разных плагинах.
    const result = parse(good, 'acme-forms-dev');

    expect(!result.ok && result.problem.code).toBe('id-mismatch');
    expect(!result.ok && result.problem.message).toContain('acme-forms-dev');
  });

  it('когда точка входа уводит за каталог плагина', () => {
    const result = parse({ ...good, main: '../../../etc/main.js' });

    expect(!result.ok && result.problem.code).toBe('manifest-invalid');
  });

  it('когда API оболочки не покрыт диапазоном — и это отдельный код, а не «манифест плохой»', () => {
    const result = parse({ ...good, apiVersion: '^2' });

    // Политики совместимости нет по решению: расхождение — отказ загрузки с внятным
    // сообщением, а не попытка что-то согласовать.
    expect(!result.ok && result.problem.code).toBe('api-version');
    expect(!result.ok && result.problem.message).toContain(BUILDER_API_VERSION);
  });

  it('когда apiVersion не читается как диапазон', () => {
    const result = parse({ ...good, apiVersion: 'latest' });

    expect(!result.ok && result.problem.code).toBe('manifest-invalid');
  });
});

describe('диапазон apiVersion — настоящий semver, а не первое число', () => {
  it('пропускает диапазоны, покрывающие версию оболочки', () => {
    for (const range of ['1', '^1', '^1.0.0', '~1.0', '1.x', '>=1.0.0', '*', '1.0.0']) {
      expect(parse({ ...good, apiVersion: range }).ok, range).toBe(true);
    }
  });

  it('отвергает диапазоны, которые её НЕ покрывают', () => {
    // Здесь и видна разница с прежним разбором «достать первое число»: `~1.2.3` начинается
    // с единицы, но требует 1.2.x, а оболочка даёт 1.0.0 — раньше это проходило молча,
    // и плагин получал API, которого нет.
    for (const range of ['^0.1', '2', '~10.0', '~1.2.3', '>=1.5']) {
      const result = parse({ ...good, apiVersion: range });
      expect(!result.ok && result.problem.code, range).toBe('api-version');
    }
  });

  it('отвергает то, что диапазоном не является', () => {
    for (const range of ['v1', 'latest', '1.x || 2.x', '>=1.0.0 <2.0.0', '^1.0.0-beta']) {
      const result = parse({ ...good, apiVersion: range });
      expect(!result.ok && result.problem.code, range).toBe('manifest-invalid');
    }
  });
});

describe('provides — объявление возможностей', () => {
  it('разбирает список объявлений', () => {
    const result = parse({
      ...good,
      provides: [{ id: 'acme.forms', version: '1.2.0' }],
    });

    expect(result.ok && result.manifest.provides).toEqual([{ id: 'acme.forms', version: '1.2.0' }]);
  });

  it('поля нет — и это норма, а не упущение', () => {
    const result = parse(good);

    expect(result.ok).toBe(true);
    expect(result.ok && result.manifest.provides).toBeUndefined();
  });

  it('отвергает диапазон вместо версии', () => {
    // «У меня есть ^1» не значит ничего; молчаливое «возьмём нижнюю границу» спрятало бы
    // путаницу с requires до первого несовпадения у потребителя.
    const result = parse({ ...good, provides: [{ id: 'acme.forms', version: '^1' }] });

    expect(!result.ok && result.problem.code).toBe('manifest-invalid');
    expect(!result.ok && result.problem.message).toContain('provides[0]');
  });

  it('отвергает повтор идентификатора', () => {
    const result = parse({
      ...good,
      provides: [
        { id: 'acme.forms', version: '1.0.0' },
        { id: 'acme.forms', version: '2.0.0' },
      ],
    });

    expect(!result.ok && result.problem.code).toBe('manifest-invalid');
    expect(!result.ok && result.problem.message).toContain('дважды');
  });

  it('отвергает не тот вид поля', () => {
    for (const provides of [{}, ['acme.forms'], [{ version: '1.0.0' }]]) {
      expect(parse({ ...good, provides }).ok, JSON.stringify(provides)).toBe(false);
    }
  });
});

describe('requires — требования двумя списками', () => {
  it('разбирает оба списка', () => {
    const result = parse({
      ...good,
      requires: {
        required: [{ id: 'reformer.kit.catalog', range: '^1' }],
        optional: [{ id: 'acme.telemetry', range: '>=0.2.0' }],
      },
    });

    expect(result.ok && result.manifest.requires).toEqual({
      required: [{ id: 'reformer.kit.catalog', range: '^1' }],
      optional: [{ id: 'acme.telemetry', range: '>=0.2.0' }],
    });
  });

  it('пропущенный список — пустой, а не отказ', () => {
    const result = parse({
      ...good,
      requires: { required: [{ id: 'reformer.kit.catalog', range: '^1' }] },
    });

    expect(result.ok && result.manifest.requires?.optional).toEqual([]);
  });

  it('отвергает короткую запись списком строк', () => {
    // Частая догадка автора; отвергнуть её внятно дешевле, чем дать ей молча не сработать.
    const result = parse({ ...good, requires: ['reformer.kit.catalog'] });

    expect(!result.ok && result.problem.code).toBe('manifest-invalid');
    expect(!result.ok && result.problem.message).toContain('required');
  });

  it('отвергает диапазон, которого утилита версий не понимает', () => {
    const result = parse({
      ...good,
      requires: { required: [{ id: 'reformer.kit.catalog', range: '>=1 <2' }] },
    });

    expect(!result.ok && result.problem.code).toBe('manifest-invalid');
    expect(!result.ok && result.problem.message).toContain('requires.required[0]');
  });

  it('отвергает требование без идентификатора', () => {
    const result = parse({ ...good, requires: { optional: [{ range: '^1' }] } });

    expect(!result.ok && result.problem.code).toBe('manifest-invalid');
    expect(!result.ok && result.problem.message).toContain('requires.optional[0]');
  });
});

describe('contributes.keybindings', () => {
  const withContributes = (contributes: unknown): string =>
    JSON.stringify({ id: 'acme', apiVersion: '^1', main: 'main.js', contributes });

  it('разбирает объявленные сочетания', () => {
    const result = parsePluginManifest(
      withContributes({
        keybindings: [
          {
            command: 'acme.insert',
            key: 'mod+alt+i',
            when: 'focus == canvas',
            args: { kind: 'field' },
            allowInEditable: false,
          },
        ],
      }),
      project('acme')
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.manifest.contributes?.keybindings).toEqual([
      {
        command: 'acme.insert',
        key: 'mod+alt+i',
        when: 'focus == canvas',
        args: { kind: 'field' },
        allowInEditable: false,
      },
    ]);
  });

  it('отсутствие contributes — норма, а не промах', () => {
    const result = parsePluginManifest(
      JSON.stringify({ id: 'acme', apiVersion: '^1', main: 'main.js' }),
      project('acme')
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.manifest.contributes).toBeUndefined();
  });

  it('аккорд из двух ступеней принимается', () => {
    const result = parsePluginManifest(
      withContributes({ keybindings: [{ command: 'acme.insert', key: 'mod+k mod+i' }] }),
      project('acme')
    );

    expect(result.ok).toBe(true);
  });

  it('неразбираемое сочетание — ОТКАЗ манифеста, а не пропуск записи', () => {
    // Клавиша с испорченным описанием не сработает никогда, и узнавать об этом в день
    // нажатия — самая дорогая из поломок, потому что она молчит.
    const result = parsePluginManifest(
      withContributes({ keybindings: [{ command: 'acme.insert', key: 'mod+' }] }),
      project('acme')
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problem.code).toBe('manifest-invalid');
  });

  it('три ступени — отказ', () => {
    const result = parsePluginManifest(
      withContributes({ keybindings: [{ command: 'a', key: 'mod+k mod+s mod+x' }] }),
      project('acme')
    );

    expect(result.ok).toBe(false);
  });

  it('неразбираемое условие — отказ манифеста', () => {
    const result = parsePluginManifest(
      withContributes({ keybindings: [{ command: 'a', key: 'mod+i', when: 'focus ==' }] }),
      project('acme')
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problem.code).toBe('manifest-invalid');
  });

  it('запись без команды или без клавиши — отказ', () => {
    expect(
      parsePluginManifest(withContributes({ keybindings: [{ key: 'mod+i' }] }), project('acme')).ok
    ).toBe(false);
    expect(
      parsePluginManifest(withContributes({ keybindings: [{ command: 'a' }] }), project('acme')).ok
    ).toBe(false);
  });

  it('contributes не объект и keybindings не массив — отказ', () => {
    expect(parsePluginManifest(withContributes('нет'), project('acme')).ok).toBe(false);
    expect(parsePluginManifest(withContributes({ keybindings: 'нет' }), project('acme')).ok).toBe(
      false
    );
  });

  it('allowInEditable обязано быть булевым', () => {
    const result = parsePluginManifest(
      withContributes({ keybindings: [{ command: 'a', key: 'mod+i', allowInEditable: 'да' }] }),
      project('acme')
    );

    expect(result.ok).toBe(false);
  });
});

describe('contributes.messages', () => {
  const withContributes = (contributes: unknown): string =>
    JSON.stringify({ id: 'acme', apiVersion: '^1', main: 'main.js', contributes });

  const withMessages = (messages: unknown): string => withContributes({ messages });

  it('разбирает объявленные словари и нормализует их пути', () => {
    const result = parsePluginManifest(
      withMessages({ ru: 'locales/ru.json', en: './locales/./en.json' }),
      project('acme')
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.manifest.contributes?.messages).toEqual({
      ru: 'locales/ru.json',
      en: 'locales/en.json',
    });
  });

  it('уживается с клавишами в одном contributes', () => {
    const result = parsePluginManifest(
      withContributes({
        keybindings: [{ command: 'acme.insert', key: 'mod+alt+i' }],
        messages: { ru: 'locales/ru.json' },
      }),
      project('acme')
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.manifest.contributes?.keybindings).toHaveLength(1);
    expect(result.manifest.contributes?.messages).toEqual({ ru: 'locales/ru.json' });
  });

  it('содержимое файла здесь не читается — проверена только форма объявления', () => {
    // Разбор манифеста обязан оставаться чтением ОДНОГО файла: иначе список плагинов
    // открывался бы со скоростью чтения всех словарей всех найденных плагинов.
    const result = parsePluginManifest(
      withMessages({ ru: 'нет-такого-файла.json' }),
      project('acme')
    );

    expect(result.ok).toBe(true);
  });

  it('не объект — отказ', () => {
    for (const messages of ['locales/ru.json', ['locales/ru.json'], 42]) {
      const result = parsePluginManifest(withMessages(messages), project('acme'));

      expect(result.ok, JSON.stringify(messages)).toBe(false);
      expect(!result.ok && result.problem.code).toBe('manifest-invalid');
    }
  });

  it('значение не строка-путь — отказ', () => {
    for (const value of [42, null, { file: 'ru.json' }, '', '   ']) {
      const result = parsePluginManifest(withMessages({ ru: value }), project('acme'));

      expect(result.ok, JSON.stringify(value)).toBe(false);
      expect(!result.ok && result.problem.code).toBe('manifest-invalid');
      expect(!result.ok && result.problem.message).toContain('ru');
    }
  });

  it('путь, уводящий за каталог плагина, — отказ', () => {
    // Та же граница, что у точки входа и таблицы стилей: загрузчик читает только
    // собственные файлы плагина.
    const result = parsePluginManifest(withMessages({ ru: '../../secrets.json' }), project('acme'));

    expect(!result.ok && result.problem.code).toBe('manifest-invalid');
  });

  it('пустое имя локали — отказ', () => {
    const result = parsePluginManifest(withMessages({ '': 'locales/ru.json' }), project('acme'));

    expect(!result.ok && result.problem.code).toBe('manifest-invalid');
    expect(!result.ok && result.problem.message).toContain('локали');
  });
});
