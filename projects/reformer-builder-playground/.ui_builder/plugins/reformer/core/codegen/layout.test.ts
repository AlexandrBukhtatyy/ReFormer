import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SCHEMA_PATH,
  detachedModuleDirOf,
  formNameOfSchemaPath,
  importOf,
  isCanonicalSchemaName,
  isFlatLayoutPath,
  moduleDirOfSchemaPath,
  moduleFilesOf,
  modulePlacementOf,
  moduleRootOfDocument,
  moduleRootPathOf,
  schemaDirOf,
  schemaPathInModule,
  stepSchemaPath,
  stepValidationPath,
} from './layout';

const NAMES = { dir: 'loan-application', TypeName: 'LoanApplicationForm' };

describe('moduleFilesOf', () => {
  it('раскладывает файлы модуля по папкам ролей', () => {
    expect(moduleFilesOf(NAMES)).toEqual({
      page: 'LoanApplicationForm.tsx',
      barrel: 'index.ts',
      readme: 'README.md',
      create: 'application/create.ts',
      submit: 'application/submit.ts',
      entry: 'application/entry.ts',
      api: 'api/index.ts',
      initial: 'model/initial-value.ts',
      model: 'model/model.ts',
      schema: 'schema/form.schema.json',
      registry: 'schema/registry.ts',
      validation: 'validation/form.ts',
      messages: 'validation/messages.ts',
      behavior: 'behavior/index.ts',
      flow: 'flow/loan-application-flow.ts',
      types: 'types/loan-application.ts',
      constants: 'constants/loan-application.ts',
    });
  });

  it('документ лежит там, где его нашли: путь схемы — параметр, остальное на месте', () => {
    const files = moduleFilesOf(NAMES, 'form.schema.json');
    expect(files.schema).toBe('form.schema.json');
    expect(files.registry).toBe('schema/registry.ts');
  });

  it('по умолчанию документ — в папке schema', () => {
    expect(moduleFilesOf(NAMES).schema).toBe(DEFAULT_SCHEMA_PATH);
  });
});

describe('файлы шага', () => {
  it('правила шага — в папке валидации, под именем шага', () => {
    expect(stepValidationPath('kontakty')).toBe('validation/kontakty.ts');
  });

  it('схема шага лежит рядом с корневым документом: ссылка корня относительна ему', () => {
    expect(stepSchemaPath('schema/form.schema.json', 'kontakty')).toBe(
      'schema/steps/kontakty/form.schema.json'
    );
    // Документ в корне модуля — и папка шагов там же.
    expect(stepSchemaPath('form.schema.json', 'kontakty')).toBe('steps/kontakty/form.schema.json');
  });

  it('каталог документа — с завершающим слэшем либо пусто', () => {
    expect(schemaDirOf('schema/form.schema.json')).toBe('schema/');
    expect(schemaDirOf('form.schema.json')).toBe('');
  });
});

describe('модуль формы по пути её документа', () => {
  it('каталог модуля — каталог документа, а из папки schema — её родитель', () => {
    expect(moduleDirOfSchemaPath('forms/loan/schema/form.schema.json')).toBe('forms/loan');
    expect(moduleDirOfSchemaPath('forms/loan/form.schema.json')).toBe('forms/loan');
    expect(moduleDirOfSchemaPath('forms/credit.schema.json')).toBe('forms');
    // Документ в корне проекта: каталог модуля — корень.
    expect(moduleDirOfSchemaPath('form.schema.json')).toBe('');
    expect(moduleDirOfSchemaPath('schema/form.schema.json')).toBe('');
  });

  it('путь документа внутри модуля: schema/<имя файла> либо просто имя файла', () => {
    expect(schemaPathInModule('forms/loan/schema/form.schema.json')).toBe(
      'schema/form.schema.json'
    );
    expect(schemaPathInModule('forms/loan/form.schema.json')).toBe('form.schema.json');
    expect(schemaPathInModule('forms/loan/schema/credit.schema.json')).toBe(
      'schema/credit.schema.json'
    );
  });

  it('прежнее имя документа в модуле становится каноническим', () => {
    expect(schemaPathInModule('forms/loan/renderer.schema.json')).toBe('form.schema.json');
  });

  it('обратные слэши Windows не ломают разбор', () => {
    expect(moduleDirOfSchemaPath('forms\\loan\\schema\\form.schema.json')).toBe('forms/loan');
    expect(schemaPathInModule('forms\\loan\\schema\\form.schema.json')).toBe(
      'schema/form.schema.json'
    );
  });
});

describe('modulePlacementOf', () => {
  it('документ в папке schema: модуль печатается на месте, в её родителе', () => {
    expect(modulePlacementOf('forms/loan/schema/form.schema.json')).toEqual({
      kind: 'nested',
      schemaPath: 'schema/form.schema.json',
    });
  });

  it('канонический документ в другом каталоге — форма прежней плоской раскладки', () => {
    expect(modulePlacementOf('forms/loan/form.schema.json')).toEqual({
      kind: 'flat',
      schemaPath: 'form.schema.json',
    });
    // Прежнее имя документа — тот же случай, а печатается он уже под новым.
    expect(modulePlacementOf('forms/loan/renderer.schema.json')).toEqual({
      kind: 'flat',
      schemaPath: 'form.schema.json',
    });
  });

  it('документ со свободным именем своего модуля не имеет — тот заводится заново', () => {
    expect(modulePlacementOf('forms/credit.schema.json')).toEqual({
      kind: 'detached',
      schemaPath: 'schema/form.schema.json',
    });
    // И в папке schema тоже: каталог со свободно названными схемами — не модуль одной формы.
    expect(modulePlacementOf('forms/schema/credit.schema.json').kind).toBe('detached');
  });
});

describe('каталог модуля по документу — для всех трёх раскладок', () => {
  /** Порт адресов на строках: ровно та арифметика, которую делает платформа. */
  const port = {
    parentOf: (id: string) => (id.includes('/') ? id.slice(0, id.lastIndexOf('/')) : ''),
    resolve: (dir: string, ...segments: readonly string[]) =>
      [dir, ...segments].filter((part) => part !== '').join('/'),
  };

  it('путь и адрес дают один ответ', () => {
    for (const [path, root] of [
      ['forms/loan/schema/form.schema.json', 'forms/loan'],
      ['forms/loan/form.schema.json', 'forms/loan'],
      ['forms/credit.schema.json', 'forms/credit'],
      // Имя документа на кириллице — каталог kebab-именем, как у кодогена.
      ['forms/Заявка.schema.json', 'forms/zayavka'],
      ['credit.schema.json', 'credit'],
    ] as const) {
      expect(moduleRootPathOf(path), path).toBe(root);
      expect(moduleRootOfDocument(port, path, path), path).toBe(root);
    }
  });

  it('свободно названные документы одного каталога получают разные модули', () => {
    expect(moduleRootPathOf('forms/credit.schema.json')).not.toBe(
      moduleRootPathOf('forms/loan.schema.json')
    );
    // Имя подкаталога — имя документа до первой точки, kebab-ом.
    expect(detachedModuleDirOf('forms/credit.schema.json')).toBe('credit');
  });
});

describe('formNameOfSchemaPath', () => {
  it('канонический файл схемы называет форму именем папки', () => {
    expect(formNameOfSchemaPath('forms/loan-application/form.schema.json')).toBe(
      'loan-application'
    );
  });

  it('документ в папке schema называет форму именем каталога МОДУЛЯ, а не «schema»', () => {
    expect(formNameOfSchemaPath('forms/x/schema/form.schema.json')).toBe('x');
  });

  it('прежнее имя схемы — тоже по папке, а не «renderer»', () => {
    expect(formNameOfSchemaPath('forms/loan/renderer.schema.json')).toBe('loan');
  });

  it('прочие имена — по файлу до первой точки', () => {
    expect(formNameOfSchemaPath('forms/loan.schema.json')).toBe('loan');
    expect(formNameOfSchemaPath('loan.form.json')).toBe('loan');
  });

  it('канонический файл в корне без папки даёт умолчание, а не пустое имя', () => {
    expect(formNameOfSchemaPath('form.schema.json')).toBe('form');
    expect(formNameOfSchemaPath('schema/form.schema.json')).toBe('form');
  });

  it('обратные слэши Windows не ломают разбор', () => {
    expect(formNameOfSchemaPath('forms\\loan\\form.schema.json')).toBe('loan');
  });
});

describe('importOf', () => {
  const files = moduleFilesOf(NAMES);

  it('между папками ролей: скрипт без расширения, данные — с ним', () => {
    expect(importOf(files.create, files.types)).toBe('../types/loan-application');
    expect(importOf(files.create, files.schema)).toBe('../schema/form.schema.json');
  });

  it('папка импортируется через её index', () => {
    expect(importOf(files.create, files.behavior)).toBe('../behavior');
    expect(importOf(files.submit, files.api)).toBe('../api');
  });

  it('из корня модуля — вниз в папку, из папки — в соседний файл', () => {
    expect(importOf(files.page, files.create)).toBe('./application/create');
    expect(importOf(files.entry, files.create)).toBe('./create');
    expect(importOf(files.model, files.initial)).toBe('./initial-value');
  });

  it('файл шага импортируется из потока и из сборки', () => {
    expect(importOf(files.flow, stepValidationPath('kontakty'))).toBe('../validation/kontakty');
    expect(importOf(files.create, stepSchemaPath(files.schema, 'kontakty'))).toBe(
      '../schema/steps/kontakty/form.schema.json'
    );
  });

  it('документ в корне модуля импортируется оттуда', () => {
    const flat = moduleFilesOf(NAMES, 'form.schema.json');
    expect(importOf(flat.create, flat.schema)).toBe('../form.schema.json');
  });
});

describe('прежняя плоская раскладка', () => {
  it('узнаёт файлы корня, агрегатор шагов и код в папке шага', () => {
    expect(isFlatLayoutPath('registry.ts')).toBe(true);
    expect(isFlatLayoutPath('form.render.ts')).toBe(true);
    expect(isFlatLayoutPath('steps/index.ts')).toBe(true);
    expect(isFlatLayoutPath('steps/kontakty/form.validation.ts')).toBe(true);
    // Шаблон пути из заголовка выгруженного шаблона — тоже.
    expect(isFlatLayoutPath('steps/{step}/form.render.ts')).toBe(true);
  });

  it('файлы новой раскладки и схема шага прежними не считаются', () => {
    expect(isFlatLayoutPath('schema/registry.ts')).toBe(false);
    expect(isFlatLayoutPath('validation/form.ts')).toBe(false);
    expect(isFlatLayoutPath('steps/kontakty/form.schema.json')).toBe(false);
    expect(isFlatLayoutPath('README.md')).toBe(false);
  });
});

describe('isCanonicalSchemaName', () => {
  it('каноническое и прежнее имя документа — оба узнаются', () => {
    expect(isCanonicalSchemaName('form.schema.json')).toBe(true);
    expect(isCanonicalSchemaName('renderer.schema.json')).toBe(true);
    expect(isCanonicalSchemaName('credit.schema.json')).toBe(false);
  });
});
