import { describe, expect, it } from 'vitest';
import { withMarker } from '@reformer/builder-toolkit';
import type { ResourceId } from '@reformer/builder-plugin-api';
import { deliverModule, isSchemaDocumentPath, SourceReadOnlyError } from './deliver';
import type { ModuleFile } from './generate';
import { createFakeHost } from '../testing';

const PARENT = 'src/pages' as ResourceId;

const file = (over: Partial<ModuleFile> & Pick<ModuleFile, 'path'>): ModuleFile => ({
  content: 'тело\n',
  cls: 'derived',
  regenerable: false,
  targetId: `t:${over.path}`,
  origin: 'builtin',
  ...over,
});

describe('доставка модуля', () => {
  it('пишет в рабочую область по адресам, которые строит платформа', async () => {
    const host = createFakeHost();
    const result = await deliverModule(host, PARENT, 'my-form', [
      file({ path: 'types/my-form.ts' }),
    ]);
    expect(result.dir).toBe('src/pages/my-form');
    expect(result.written).toEqual(['types/my-form.ts']);
    expect(host.written.get('src/pages/my-form/types/my-form.ts')).toBe('тело\n');
  });

  it('источник без записи отказывает ДО первой записи', async () => {
    const host = createFakeHost({ write: false });
    await expect(
      deliverModule(host, PARENT, 'my-form', [file({ path: 'types/my-form.ts' })])
    ).rejects.toBeInstanceOf(SourceReadOnlyError);
    expect(host.written.size).toBe(0);
  });

  it('производный файл перезаписывается даже если его правили', async () => {
    const host = createFakeHost({
      files: { 'src/pages/my-form/types/my-form.ts': 'моя правка\n' },
    });
    const result = await deliverModule(host, PARENT, 'my-form', [
      file({ path: 'types/my-form.ts' }),
    ]);
    expect(result.written).toEqual(['types/my-form.ts']);
  });

  it('авторский файл не перезаписывается никогда, и пропуск НАЗЫВАЕТСЯ', async () => {
    const host = createFakeHost({ files: { 'src/pages/my-form/api/index.ts': 'мой бэкенд\n' } });
    const result = await deliverModule(host, PARENT, 'my-form', [
      file({ path: 'api/index.ts', cls: 'user' }),
    ]);
    expect(result.written).toEqual([]);
    expect(result.skipped).toEqual([{ path: 'api/index.ts', reason: 'authored' }]);
    expect(host.written.get('src/pages/my-form/api/index.ts')).toBe('мой бэкенд\n');
  });

  it('выводимый из правил файл перезаписывается, пока маркер сходится', async () => {
    const host = createFakeHost({
      files: { 'src/pages/my-form/validation/form.ts': withMarker('старое\n') },
    });
    const result = await deliverModule(host, PARENT, 'my-form', [
      file({ path: 'validation/form.ts', cls: 'user', regenerable: true, content: 'новое\n' }),
    ]);
    expect(result.written).toEqual(['validation/form.ts']);
    expect(host.written.get('src/pages/my-form/validation/form.ts')).toBe('новое\n');
  });

  it('правленный руками выводимый файл пропускается с ДРУГОЙ причиной', async () => {
    const host = createFakeHost({
      files: { 'src/pages/my-form/validation/form.ts': `${withMarker('старое\n')}// моя правка\n` },
    });
    const result = await deliverModule(host, PARENT, 'my-form', [
      file({ path: 'validation/form.ts', cls: 'user', regenerable: true, content: 'новое\n' }),
    ]);
    expect(result.skipped).toEqual([{ path: 'validation/form.ts', reason: 'edited' }]);
  });

  it('отказ одной записи не отменяет остальные', async () => {
    const host = createFakeHost();
    const broken = { ...host };
    broken.writeText = async (id, text) => {
      if (id.endsWith('bad.ts')) throw new Error('диск полон');
      await host.writeText(id, text);
    };
    const result = await deliverModule(broken, PARENT, 'my-form', [
      file({ path: 'bad.ts' }),
      file({ path: 'good.ts' }),
    ]);
    expect(result.written).toEqual(['good.ts']);
    expect(result.failed).toEqual([{ path: 'bad.ts', message: 'диск полон' }]);
  });

  it('без save записанное остаётся рабочей копией, и это видно в отчёте', async () => {
    const host = createFakeHost();
    const result = await deliverModule(host, PARENT, 'my-form', [
      file({ path: 'types/my-form.ts' }),
    ]);
    expect(result.saved).toBeNull();
  });

  it('с save отправляет в источник ровно записанные адреса', async () => {
    const host = createFakeHost({ withSave: true });
    const result = await deliverModule(host, PARENT, 'my-form', [
      file({ path: 'types/my-form.ts' }),
      file({ path: 'model/model.ts' }),
    ]);
    expect(result.saved).toBe(true);
    expect(host.saved).toEqual([
      'src/pages/my-form/types/my-form.ts',
      'src/pages/my-form/model/model.ts',
    ]);
  });
});

describe('доставка: файлы шагов, которых нет в модуле', () => {
  const DIR = 'src/pages/my-form';
  /** Файл правил шага — как его печатает цель `codegen.step-validation`. */
  const rules = (slug: string): ModuleFile =>
    file({ path: `validation/${slug}.ts`, cls: 'user', regenerable: true });
  /** Файл схемы шага разбитого визарда. */
  const stepSchema = (dir: string, schemaDir = 'schema/'): ModuleFile =>
    file({ path: `${schemaDir}steps/${dir}/form.schema.json`, content: '{}' });

  it('называет файл правил шага на диске, которого нет в модуле, и НЕ удаляет его', async () => {
    const edited = `${withMarker('старое\n')}// моя валидация\n`;
    const host = createFakeHost({
      files: {
        [`${DIR}/validation/dannye.ts`]: withMarker('старое\n'),
        // Шаг «Контакты» переименовали: файл остался, и в нём — правки человека.
        [`${DIR}/validation/kontakty.ts`]: edited,
      },
    });
    const result = await deliverModule(host, PARENT, 'my-form', [
      rules('dannye'),
      rules('adres'),
      file({ path: 'validation/form.ts', cls: 'user', regenerable: true }),
    ]);
    expect(result.orphans).toEqual(['validation/kontakty.ts']);
    expect(host.written.get(`${DIR}/validation/kontakty.ts`)).toBe(edited);
  });

  it('свой файл человека в validation/ шагом не считается: сирота — только напечатанный билдером', async () => {
    const host = createFakeHost({
      files: {
        // Без маркера: общие правила, которые человек написал сам и импортирует из файлов шагов.
        [`${DIR}/validation/common.ts`]: 'export const PHONE = /\\d+/;\n',
        [`${DIR}/validation/messages.json`]: '{}',
      },
    });
    const result = await deliverModule(host, PARENT, 'my-form', [rules('dannye')]);
    expect(result.orphans).toEqual([]);
  });

  it('файл правил формы сиротой не бывает, даже если его нет среди доставляемых', async () => {
    const host = createFakeHost({
      files: { [`${DIR}/validation/form.ts`]: withMarker('правила формы\n') },
    });
    const result = await deliverModule(host, PARENT, 'my-form', [file({ path: 'README.md' })]);
    expect(result.orphans).toEqual([]);
  });

  it('называет папку схемы шага рядом с корневым документом, которой нет в модуле', async () => {
    const host = createFakeHost({
      files: {
        [`${DIR}/schema/steps/dannye/form.schema.json`]: '{}',
        [`${DIR}/schema/steps/kontakty/form.schema.json`]: '{"моя":1}',
      },
    });
    const result = await deliverModule(host, PARENT, 'my-form', [
      stepSchema('dannye'),
      stepSchema('adres'),
    ]);
    expect(result.orphans).toEqual(['schema/steps/kontakty']);
    expect(host.written.get(`${DIR}/schema/steps/kontakty/form.schema.json`)).toBe('{"моя":1}');
  });

  it('документ в корне модуля: папки схем шагов ищутся рядом с ним, а не в schema/', async () => {
    const host = createFakeHost({
      files: {
        [`${DIR}/steps/dannye/form.schema.json`]: '{}',
        [`${DIR}/steps/kontakty/form.schema.json`]: '{}',
      },
    });
    const result = await deliverModule(host, PARENT, 'my-form', [stepSchema('dannye', '')], {
      schemaPath: 'form.schema.json',
    });
    expect(result.orphans).toEqual(['steps/kontakty']);
  });

  it('при записи одной цели сироты считаются по ВСЕМУ модулю', async () => {
    const host = createFakeHost({
      files: {
        [`${DIR}/validation/dannye.ts`]: withMarker('x\n'),
        [`${DIR}/schema/steps/dannye/form.schema.json`]: '{}',
      },
    });
    const module = [file({ path: 'types/my-form.ts' }), rules('dannye'), stepSchema('dannye')];
    const result = await deliverModule(host, PARENT, 'my-form', [module[0]], { module });
    expect(result.orphans).toEqual([]);
  });

  it('простая форма сирот не имеет', async () => {
    const host = createFakeHost();
    const result = await deliverModule(host, PARENT, 'my-form', [file({ path: 'types/x.ts' })]);
    expect(result.orphans).toEqual([]);
    expect(result.legacy).toEqual([]);
    expect(result.flat).toEqual([]);
  });
});

describe('доставка: файлы прежней плоской раскладки', () => {
  const DIR = 'src/pages/my-form';

  it('называет их, но НЕ удаляет и НЕ переносит под новые имена', async () => {
    // Код прежнего контракта сборки: правленный `form.render.ts`, положенный на место
    // `behavior/index.ts`, не собрался бы — контракт другой. Поэтому доставка его только называет.
    const edited = 'мои правила рендера\n';
    const host = createFakeHost({
      files: {
        [`${DIR}/index.tsx`]: withMarker('прежняя страница\n'),
        [`${DIR}/form.render.ts`]: edited,
        [`${DIR}/wizard.tsx`]: withMarker('шим\n'),
        [`${DIR}/steps/index.ts`]: withMarker('агрегатор\n'),
        [`${DIR}/steps/dannye/form.validation.ts`]: 'мои правила шага\n',
        [`${DIR}/steps/dannye/form.render.ts`]: withMarker('x\n'),
      },
    });
    const behavior = file({
      path: 'behavior/index.ts',
      cls: 'user',
      regenerable: true,
      content: 'свежее поведение\n',
    });
    const result = await deliverModule(host, PARENT, 'my-form', [behavior]);

    expect(result.flat).toEqual([
      'index.tsx',
      'wizard.tsx',
      'form.render.ts',
      'steps/index.ts',
      'steps/dannye/form.validation.ts',
      'steps/dannye/form.render.ts',
    ]);
    // Новый файл напечатан свежим: правки из прежнего в него не переехали.
    expect(host.written.get(`${DIR}/behavior/index.ts`)).toBe('свежее поведение\n');
    // Прежние файлы на месте и не тронуты.
    expect(host.written.get(`${DIR}/form.render.ts`)).toBe(edited);
    expect(host.written.get(`${DIR}/steps/dannye/form.validation.ts`)).toBe('мои правила шага\n');
    // И в «прежние имена» они не попадают: это не переименование, а другой контракт.
    expect(result.legacy).toEqual([]);
  });

  it('папка шага с кодом прежней раскладки — не сирота шага, а файлы прежнего контракта', async () => {
    // У формы с документом в корне модуля схемы шагов и прежний код шагов делят одну папку
    // `steps/`. Папка без схемы шага сиротой не называется — иначе об одном и том же сказали бы
    // дважды и разными словами.
    const host = createFakeHost({
      files: { [`${DIR}/steps/dannye/form.validation.ts`]: 'x\n' },
    });
    const result = await deliverModule(host, PARENT, 'my-form', [file({ path: 'README.md' })], {
      schemaPath: 'form.schema.json',
    });
    expect(result.orphans).toEqual([]);
    expect(result.flat).toEqual(['steps/dannye/form.validation.ts']);
  });

  it('файл, который модуль печатает сам, прежним не считается', async () => {
    // Чужая цель вправе положить в корень модуля свой `api.ts` — это часть модуля, а не остаток.
    const host = createFakeHost();
    const result = await deliverModule(host, PARENT, 'my-form', [
      file({ path: 'api.ts', cls: 'user' }),
    ]);
    expect(result.flat).toEqual([]);
  });

  it('документ формы и README прежними не считаются: они живут под теми же именами', async () => {
    const host = createFakeHost({
      files: { [`${DIR}/form.schema.json`]: '{}', [`${DIR}/README.md`]: '# старое\n' },
    });
    const result = await deliverModule(host, PARENT, 'my-form', [file({ path: 'types/x.ts' })]);
    expect(result.flat).toEqual([]);
  });
});

describe('доставка: прежние имена файлов', () => {
  // Механизм общий: цель объявляет прежние имена своего файла (`legacyPaths`), и доставка
  // переносит под новое имя то, что человек правил под старым. Встроенные цели пользуются им
  // для одного файла — документа формы (`renderer.schema.json`): только там контракт файла
  // прежний, а сменилось одно имя. Здесь он проверен на цели со своим авторским файлом.
  const DIR = 'src/pages/my-form';
  const notes = (content = 'свежий\n'): ModuleFile =>
    file({
      path: 'docs/notes.ts',
      cls: 'user',
      regenerable: true,
      content,
      legacyPaths: ['notes.ts'],
    });

  it('правленный руками старый файл ПЕРЕНОСИТСЯ под новое имя, старый остаётся', async () => {
    const edited = `${withMarker('старое\n')}// моя правка\n`;
    const host = createFakeHost({ files: { [`${DIR}/notes.ts`]: edited } });
    const result = await deliverModule(host, PARENT, 'my-form', [notes()]);
    expect(result.legacy).toEqual([
      { path: 'notes.ts', replacedBy: 'docs/notes.ts', carried: true },
    ]);
    expect(result.written).toEqual(['docs/notes.ts']);
    expect(host.written.get(`${DIR}/docs/notes.ts`)).toBe(edited);
    expect(host.written.get(`${DIR}/notes.ts`)).toBe(edited);
  });

  it('нетронутый старый файл НЕ переносится: под новым именем печатается свежий текст', async () => {
    const host = createFakeHost({
      files: { [`${DIR}/notes.ts`]: withMarker('старое\n') },
    });
    const result = await deliverModule(host, PARENT, 'my-form', [notes()]);
    expect(result.legacy).toEqual([
      { path: 'notes.ts', replacedBy: 'docs/notes.ts', carried: false },
    ]);
    expect(host.written.get(`${DIR}/docs/notes.ts`)).toBe('свежий\n');
  });

  it('производный файл (схема) печатается заново, даже если старый правили', async () => {
    const host = createFakeHost({
      files: { [`${DIR}/schema/renderer.schema.json`]: '{"мой":1}' },
    });
    const result = await deliverModule(host, PARENT, 'my-form', [
      file({
        path: 'schema/form.schema.json',
        content: '{}',
        legacyPaths: ['schema/renderer.schema.json'],
      }),
    ]);
    expect(result.legacy).toEqual([
      {
        path: 'schema/renderer.schema.json',
        replacedBy: 'schema/form.schema.json',
        carried: false,
      },
    ]);
    expect(host.written.get(`${DIR}/schema/form.schema.json`)).toBe('{}');
    expect(isSchemaDocumentPath('schema/form.schema.json')).toBe(true);
    expect(isSchemaDocumentPath('form.schema.json')).toBe(true);
    expect(isSchemaDocumentPath('docs/notes.ts')).toBe(false);
  });

  it('если новый файл уже есть, старое имя больше не вспоминается', async () => {
    const host = createFakeHost({
      files: {
        [`${DIR}/notes.ts`]: 'давнее\n',
        [`${DIR}/docs/notes.ts`]: withMarker('текущее\n'),
      },
    });
    const result = await deliverModule(host, PARENT, 'my-form', [notes()]);
    expect(result.legacy).toEqual([]);
    expect(host.written.get(`${DIR}/docs/notes.ts`)).toBe('свежий\n');
  });
});
