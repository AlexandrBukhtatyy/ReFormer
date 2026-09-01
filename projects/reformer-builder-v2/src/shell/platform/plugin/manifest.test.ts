import { describe, expect, it } from 'vitest';

import { parsePluginManifest, PLUGIN_API_MAJOR } from './manifest';

const good = {
  id: 'acme-forms',
  name: 'Acme Forms',
  version: '1.0.0',
  apiVersion: '^1',
  main: 'main.js',
};

const parse = (fields: Record<string, unknown>, dirName = 'acme-forms') =>
  parsePluginManifest(JSON.stringify(fields), dirName);

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

describe('манифест отвергается', () => {
  it('когда это не JSON', () => {
    const result = parsePluginManifest('{ "id": "acme-forms"', 'acme-forms');

    expect(result.ok).toBe(false);
    expect(!result.ok && result.problem.code).toBe('manifest-unreadable');
  });

  it('когда это JSON, но не объект', () => {
    const result = parsePluginManifest('[1, 2, 3]', 'acme-forms');

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

  it('когда мажор API чужой — и это отдельный код, а не «манифест плохой»', () => {
    const result = parse({ ...good, apiVersion: '^2' });

    // Политики совместимости нет по решению: расхождение мажора — отказ загрузки
    // с внятным сообщением, а не попытка что-то согласовать.
    expect(!result.ok && result.problem.code).toBe('api-version');
    expect(!result.ok && result.problem.message).toContain(String(PLUGIN_API_MAJOR));
  });

  it('когда из apiVersion не читается число', () => {
    const result = parse({ ...good, apiVersion: 'latest' });

    expect(!result.ok && result.problem.code).toBe('manifest-invalid');
  });
});

describe('диапазон apiVersion', () => {
  it('разбирается ровно до мажора и не дальше', () => {
    // Всё, что сложнее «первое число», было бы обещанием семантики, которой у нас нет.
    for (const range of ['1', '^1', '~1.2.3', '1.x', '>=1.0.0', 'v1']) {
      expect(parse({ ...good, apiVersion: range }).ok, range).toBe(true);
    }
    for (const range of ['^0.1', '2', '~10.0']) {
      const result = parse({ ...good, apiVersion: range });
      expect(!result.ok && result.problem.code, range).toBe('api-version');
    }
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
      'acme'
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
      'acme'
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.manifest.contributes).toBeUndefined();
  });

  it('аккорд из двух ступеней принимается', () => {
    const result = parsePluginManifest(
      withContributes({ keybindings: [{ command: 'acme.insert', key: 'mod+k mod+i' }] }),
      'acme'
    );

    expect(result.ok).toBe(true);
  });

  it('неразбираемое сочетание — ОТКАЗ манифеста, а не пропуск записи', () => {
    // Клавиша с испорченным описанием не сработает никогда, и узнавать об этом в день
    // нажатия — самая дорогая из поломок, потому что она молчит.
    const result = parsePluginManifest(
      withContributes({ keybindings: [{ command: 'acme.insert', key: 'mod+' }] }),
      'acme'
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problem.code).toBe('manifest-invalid');
  });

  it('три ступени — отказ', () => {
    const result = parsePluginManifest(
      withContributes({ keybindings: [{ command: 'a', key: 'mod+k mod+s mod+x' }] }),
      'acme'
    );

    expect(result.ok).toBe(false);
  });

  it('неразбираемое условие — отказ манифеста', () => {
    const result = parsePluginManifest(
      withContributes({ keybindings: [{ command: 'a', key: 'mod+i', when: 'focus ==' }] }),
      'acme'
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problem.code).toBe('manifest-invalid');
  });

  it('запись без команды или без клавиши — отказ', () => {
    expect(
      parsePluginManifest(withContributes({ keybindings: [{ key: 'mod+i' }] }), 'acme').ok
    ).toBe(false);
    expect(
      parsePluginManifest(withContributes({ keybindings: [{ command: 'a' }] }), 'acme').ok
    ).toBe(false);
  });

  it('contributes не объект и keybindings не массив — отказ', () => {
    expect(parsePluginManifest(withContributes('нет'), 'acme').ok).toBe(false);
    expect(parsePluginManifest(withContributes({ keybindings: 'нет' }), 'acme').ok).toBe(false);
  });

  it('allowInEditable обязано быть булевым', () => {
    const result = parsePluginManifest(
      withContributes({ keybindings: [{ command: 'a', key: 'mod+i', allowInEditable: 'да' }] }),
      'acme'
    );

    expect(result.ok).toBe(false);
  });
});
