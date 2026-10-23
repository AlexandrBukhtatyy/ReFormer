/**
 * Цели из проекта: обнаружение, отказы разбора, применимость над видом.
 *
 * Печать целей из проекта настоящим стеком и устаревшие замены — в `reformer/integration/codegen-user-targets.test`.
 *
 * @module plugins/forms/codegen/pipeline/user-targets.test
 */

import { describe, expect, it } from 'vitest';
import { createFakeHost } from '../testing';
import { discoverUserTargets, USER_TARGETS_DIR } from './user-targets';

const ROOT = 'fake:';
const DIR = [ROOT, ...USER_TARGETS_DIR].join('/');

const file = (header: string, body = 'тело\n'): string => `---\n${header}\n---\n${body}`;

function hostWith(files: Record<string, string>) {
  return createFakeHost({ root: ROOT, files });
}

describe('обнаружение', () => {
  it('читает `.eta` из каталога проекта и делает из них цели', async () => {
    const found = await discoverUserTargets(
      hostWith({
        [`${DIR}/registry.eta`]: file(
          '{ "id": "user.registry", "path": "registry.ts", "cls": "derived" }',
          'моя привязка\n'
        ),
      })
    );
    expect(found.problems).toEqual([]);
    expect(found.targets).toHaveLength(1);
    expect(found.targets[0]).toMatchObject({
      id: 'user.registry',
      path: 'registry.ts',
      cls: 'derived',
      origin: 'user',
      template: 'моя привязка\n',
    });
  });

  it('порядок обхода источника не влияет на состав: файлы сортируются по имени', async () => {
    const found = await discoverUserTargets(
      hostWith({
        [`${DIR}/z.eta`]: file('{ "id": "z", "path": "z.ts", "cls": "user" }'),
        [`${DIR}/a.eta`]: file('{ "id": "a", "path": "a.ts", "cls": "user" }'),
      })
    );
    expect(found.targets.map((t) => t.id)).toEqual(['a', 'z']);
  });

  it('файлы не той природы игнорируются молча — это не отказ', async () => {
    const found = await discoverUserTargets(
      hostWith({ [`${DIR}/README.md`]: '# заметка', [`${DIR}/.gitignore`]: '*' })
    );
    expect(found).toMatchObject({ targets: [], problems: [] });
  });

  it('нет каталога — нет целей, и это не авария', async () => {
    const found = await discoverUserTargets(hostWith({}));
    expect(found).toMatchObject({ targets: [], problems: [] });
  });

  it('без корня проекта пользовательских целей нет вовсе', async () => {
    // Порт вправе не отдавать корень (названная неполнота). Тогда фича просто отсутствует,
    // а встроенные цели работают — деградация, а не поломка.
    const found = await discoverUserTargets(createFakeHost({}));
    expect(found.targets).toEqual([]);
  });
});

describe('отказы называются файлом, а не проглатываются', () => {
  it('битый заголовок — проблема с именем файла', async () => {
    const found = await discoverUserTargets(hostWith({ [`${DIR}/bad.eta`]: 'без заголовка\n' }));
    expect(found.targets).toEqual([]);
    expect(found.problems).toHaveLength(1);
    expect(found.problems[0]).toMatchObject({ path: 'bad.eta', reason: 'template-invalid' });
  });

  it('несобираемое `applies` — тоже отказ, а не цель, падающая при печати', async () => {
    const found = await discoverUserTargets(
      hostWith({
        [`${DIR}/x.eta`]: file(
          '{ "id": "x", "path": "x.ts", "cls": "user", "applies": "it.wizard !== " }'
        ),
      })
    );
    expect(found.targets).toEqual([]);
    expect(found.problems[0]?.message).toMatch(/applies/);
  });

  it('повтор id ловится здесь, а не броском реестра на активации', async () => {
    // Реестр вкладов на повторном явном ключе БРОСАЕТ. Дойди повтор до него — упала бы
    // активация плагина целиком, то есть из-за одного чужого файла исчез бы весь кодоген.
    const found = await discoverUserTargets(
      hostWith({
        [`${DIR}/a.eta`]: file('{ "id": "dup", "path": "a.ts", "cls": "user" }'),
        [`${DIR}/b.eta`]: file('{ "id": "dup", "path": "b.ts", "cls": "user" }'),
      })
    );
    expect(found.targets).toHaveLength(1);
    expect(found.problems[0]?.message).toMatch(/dup/);
  });

  it('отказ одного файла не уносит остальные', async () => {
    const found = await discoverUserTargets(
      hostWith({
        [`${DIR}/bad.eta`]: 'мусор\n',
        [`${DIR}/good.eta`]: file('{ "id": "good", "path": "g.ts", "cls": "user" }'),
      })
    );
    expect(found.targets.map((t) => t.id)).toEqual(['good']);
    expect(found.problems).toHaveLength(1);
  });
});

describe('применимость спрашивается на ВИДЕ', () => {
  it('выражение компилируется в применимость над видом, который подаст стек', async () => {
    const found = await discoverUserTargets(
      hostWith({
        [`${DIR}/w.eta`]: file(
          '{ "id": "w", "path": "w.ts", "cls": "derived", "applies": "it.layout.isWizard" }'
        ),
      })
    );
    const applies = found.targets[0]?.appliesView;
    expect(applies?.({ layout: { isWizard: true } })).toBe(true);
    expect(applies?.({ layout: { isWizard: false } })).toBe(false);
    // Применимость над контекстом эмиссии у цели из проекта не бывает: контекст — у стека.
    expect(found.targets[0]?.applies).toBeUndefined();
  });

  it('выражение, вернувшее не-булево, читается как «не применяется»', async () => {
    // Иначе цель с недописанным условием (`it.names.dir` вместо `it.names.dir === 'loan'`)
    // печаталась бы всегда, и отказ выглядел бы как лишний файл в модуле, а не как ошибка в
    // выражении.
    const found = await discoverUserTargets(
      hostWith({
        [`${DIR}/w.eta`]: file(
          '{ "id": "w", "path": "w.ts", "cls": "derived", "applies": "it.names.dir" }'
        ),
      })
    );
    expect(found.targets[0]?.appliesView?.({ names: { dir: 'loan' } })).toBe(false);
  });
});

describe('стек шаблона', () => {
  it('«stack» заголовка доезжает до цели; без него цель годится любому стеку', async () => {
    const found = await discoverUserTargets(
      hostWith({
        [`${DIR}/a.eta`]: file('{ "id": "a", "stack": "rjsf", "path": "a.ts", "cls": "user" }'),
        [`${DIR}/b.eta`]: file('{ "id": "b", "path": "b.ts", "cls": "user" }'),
      })
    );
    expect(found.targets.map((t) => [t.id, t.stack])).toEqual([
      ['a', 'rjsf'],
      ['b', undefined],
    ]);
  });
});
