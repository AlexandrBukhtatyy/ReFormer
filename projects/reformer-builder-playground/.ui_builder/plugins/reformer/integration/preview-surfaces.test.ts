/**
 * Поверхности стека ReFormer встречаются с правилом выбора превью-хоста.
 *
 * Правило (`plugins/forms/preview`) и поверхности (`plugins/reformer/render`) живут в разных
 * плагинах, а плагины друг друга не импортируют. Встречаются они только в собранном
 * приложении — поэтому и проверка здесь, в интеграционных тестах сборки.
 *
 * Здесь же встречаются три ответа на вопрос «где корень модуля формы»: раскладка домена
 * (`core/codegen`), по которой печатает кодоген и читает компилирующая поверхность, и два
 * нейтральных правила плагинов вне домена — жизни состояния превью (`forms/preview`) и точки
 * входа формы на стенде приложения (`base/app-preview`). Нейтральные плагины домен не
 * импортируют и правило повторяют своими словами — «папка `schema`», — поэтому разойтись с
 * раскладкой могут молча, и поймать это можно только там, где видны все три.
 *
 * И четвёртый стык — документ со свободным именем: его модуль кодоген заводит подкаталогом рядом
 * с документом, и компилирующая поверхность обязана читать его оттуда же. Место считает кодоген
 * (`moduleRootOf`), ищет превью (`detachedModuleOf`), а проверить, что это одно место, можно
 * только на модуле, который кодоген действительно напечатал.
 *
 * @module shell/boot/integration/preview-surfaces.test
 */

import { describe, expect, it } from 'vitest';
import {
  makeResourceId,
  parseResourceId,
  type ResourceId,
} from '@reformer/builder-plugin-api/internal';
import { parentOf, resolve } from '@/shell/platform/primitives/resource-path';
import { moduleDirectoryOf as appPreviewModuleDirectory } from '../../base/app-preview/src/model';
import { chooseSurface } from '../../forms/preview/src';
import {
  attachPreviewLifecycle,
  moduleDirectoryOf as previewModuleDirectory,
} from '../../forms/preview/src/state/lifecycle';
import { createPreviewSessions } from '../../forms/preview/src/state/sessions';
import { BUILTIN_TARGETS, generateModule } from '../codegen/src';
import { moduleRootOf } from '../codegen/src/pipeline/run';
import {
  formNameOfSchemaPath,
  makeNames,
  moduleDirOfSchemaPath,
  moduleFilesOf,
  modulePlacementOf,
} from '../core/codegen';
import { builtinKit, wizardSchema } from '../core/testing';
import { builtinSurfaces, COMPILING_SURFACE_ID, RUNTIME_SURFACE_ID } from '../render/src';
import {
  detachedModuleOf,
  locateModule,
  moduleFilesFor,
  planModule,
} from '../render/src/compiling/module';
import { readSidecars } from '../render/src/compiling/read';
import { createFakeHost, fakeRef } from '../render/src/testing';

const DOC = {
  id: 'fake:form.json',
  ref: fakeRef('fake:form.json'),
  kind: 'model' as const,
  providerId: 'form.schema',
};

const t = (key: string): string => key;

describe('запрет исполнения по источнику доходит до выбора', () => {
  it('на источнике без права исполнения компилирующая недоступна, показывается рантайм', () => {
    const choice = chooseSurface({
      surfaces: builtinSurfaces(createFakeHost(), t),
      doc: DOC,
      source: { executesCode: false },
    });
    expect(choice.surface?.id).toBe(RUNTIME_SURFACE_ID);
    expect(choice.fallback).toEqual({
      requested: COMPILING_SURFACE_ID,
      reason: 'source-forbids-code',
    });
  });

  it('с правом исполнения умолчание — компилирующая', () => {
    const choice = chooseSurface({
      surfaces: builtinSurfaces(createFakeHost(), t),
      doc: DOC,
      source: { executesCode: true },
    });
    expect(choice.surface?.id).toBe(COMPILING_SURFACE_ID);
  });

  it('документ другого стека поверхностей ReFormer не получает вовсе', () => {
    const choice = chooseSurface({
      surfaces: builtinSurfaces(createFakeHost(), t),
      doc: { ...DOC, providerId: 'plain.form' },
      source: { executesCode: true },
    });
    expect(choice.surface).toBeNull();
    expect(choice.options).toEqual([]);
  });

  it('документ из папки schema/ модуля — тот же документ формы: выбор от места не зависит', () => {
    const id = 'fake:forms/zayavka/schema/form.schema.json';
    const choice = chooseSurface({
      surfaces: builtinSurfaces(createFakeHost(), t),
      doc: { ...DOC, id, ref: fakeRef(id) },
      source: { executesCode: true },
    });
    expect(choice.surface?.id).toBe(COMPILING_SURFACE_ID);
  });
});

describe('корень модуля формы: раскладка домена и правила плагинов вне домена сходятся', () => {
  /** Адресная арифметика НАСТОЯЩЕЙ оболочки — та, что стоит за службой рабочей области. */
  const files = { parentOf, resolve };
  const at = (path: string): ResourceId => makeResourceId('fs', path);

  /** Документы во всех местах, где раскладка их допускает. */
  const DOCUMENTS = [
    // Папки по ролям: документ в `schema/`, модуль — её родитель.
    'src/forms/zayavka/schema/form.schema.json',
    // Прежняя плоская раскладка: документ в корне модуля.
    'src/forms/contact/form.schema.json',
    // Свободное имя документа — рядом и в `schema/`.
    'src/forms/loan.schema.json',
    'src/forms/loan/schema/loan.json',
    // Папка `schema` в корне проекта и документ в корне.
    'schema/form.schema.json',
    'form.schema.json',
    // Похожие имена папок — не `schema`.
    'src/forms/zayavka/schemas/form.schema.json',
  ];

  it.each(DOCUMENTS)('«%s»: три правила называют один каталог', (path) => {
    const expected = at(moduleDirOfSchemaPath(path));

    // Компилирующая поверхность: отсюда читаются файлы модуля. У документа со свободным именем
    // это запасной ответ — когда подкаталога, в который модуль кладёт кодоген, нет (см. ниже).
    expect(locateModule(parentOf, at(path), path).root).toBe(expected);
    // Жизнь состояния превью: пока открыт файл этого каталога.
    expect(previewModuleDirectory(files, at(path))).toBe(expected);
    // Стенд приложения: здесь ищется точка входа формы.
    expect(appPreviewModuleDirectory(files, at(path))).toBe(expected);
  });

  it('состояние превью живёт, пока открыт ЛЮБОЙ файл модуля, который напечатал кодоген', async () => {
    // Глубина «файла модуля» в правиле жизни объявлена числом и о раскладке домена не знает.
    // Напечатай кодоген файл глубже — состояние формы терялось бы ровно на нём.
    const module = await generateModule(BUILTIN_TARGETS, {
      schema: wizardSchema(),
      formName: 'Заявка',
      kit: builtinKit(),
      splitSteps: true,
    });
    expect(module.problems).toEqual([]);
    const form = at('src/forms/zayavka/schema/form.schema.json');

    for (const file of module.files) {
      const sessions = createPreviewSessions();
      sessions.storeFor(form);
      const lifecycle = attachPreviewLifecycle(
        {
          openDocuments: () => [at(`src/forms/zayavka/${file.path}`)],
          onDidChange: () => ({ dispose: () => undefined }),
        },
        files,
        sessions
      );
      expect(sessions.ids(), `открыт «${file.path}»`).toEqual([form]);
      lifecycle.dispose();
    }
  });

  it('файл соседней формы состояние не держит', () => {
    const form = at('src/forms/zayavka/schema/form.schema.json');
    const sessions = createPreviewSessions();
    sessions.storeFor(form);
    attachPreviewLifecycle(
      {
        openDocuments: () => [at('src/forms/sosed/validation/form.ts'), at('src/forms/readme.md')],
        onDidChange: () => ({ dispose: () => undefined }),
      },
      files,
      sessions
    );
    expect(sessions.ids()).toEqual([]);
  });
});

describe('документ со свободным именем: превью читает модуль там, куда его кладёт кодоген', () => {
  /** Адресная арифметика НАСТОЯЩЕЙ оболочки — ею кодоген считает корень модуля. */
  const files = { parentOf, resolve };
  const at = (path: string): ResourceId => makeResourceId('fs', path);

  /** Документы, чьё имя не каноническое: своего каталога у формы нет. */
  const FREE_NAMED = [
    'src/forms/credit.schema.json',
    'src/forms/LoanApplication.form.json',
    'src/forms/Заявка на кредит.schema.json',
    // Свободное имя в папке `schema` и документ в корне проекта.
    'src/forms/loan/schema/loan.json',
    'credit.schema.json',
  ];

  it.each(FREE_NAMED)('«%s»: подкаталог превью — корень модуля кодогена', (path) => {
    const placement = modulePlacementOf(path);
    expect(placement.kind).toBe('detached');
    // Кодоген: каталог документа плюс kebab-имя формы (по умолчанию — из имени документа).
    const codegenRoot = moduleRootOf(
      files,
      at(path),
      placement,
      makeNames(formNameOfSchemaPath(path)).dir
    );

    const detached = detachedModuleOf(path);
    if (detached === null) throw new Error('превью не признало имя документа свободным');
    // Превью: подкаталог с тем же именем в каталоге документа.
    expect(resolve(parentOf(at(path)), detached.directory)).toBe(codegenRoot);
    // И документ внутри модуля — там же, куда кодоген кладёт его копию.
    expect(detached.document).toBe(placement.schemaPath);
  });

  it.each(['src/forms/loan/schema/form.schema.json', 'src/forms/loan/form.schema.json'])(
    '«%s»: у канонического имени подкаталога нет — модуль печатается на месте',
    (path) => {
      expect(modulePlacementOf(path).kind).not.toBe('detached');
      expect(detachedModuleOf(path)).toBeNull();
    }
  );

  it('модуль, напечатанный кодогеном, превью находит и исполняет по ролям', async () => {
    const document = 'src/forms/credit.schema.json';
    const placement = modulePlacementOf(document);
    const formName = formNameOfSchemaPath(document);
    // Тот же вход, что собирает прогон генерации (`runCodegen`) для документа по такому пути.
    const module = await generateModule(BUILTIN_TARGETS, {
      schema: wizardSchema(),
      formName,
      schemaPath: placement.schemaPath,
      kit: builtinKit(),
      splitSteps: true,
    });
    expect(module.problems).toEqual([]);
    // Корень — тем же правилом, которым его считает доставка.
    const root = parseResourceId(moduleRootOf(files, at(document), placement, module.dir)).path;
    expect(root).toBe('src/forms/credit');
    const tree: Record<string, string> = {
      [document]: '{ "документ": "открыт в редакторе" }',
      // Соседний документ того же каталога: его файлы превью этой формы читать не должно.
      'src/forms/loan.schema.json': '{}',
      'src/forms/loan/validation/form.ts': 'export {};',
    };
    for (const file of module.files) tree[`${root}/${file.path}`] = file.content;

    const sources = await readSidecars(createFakeHost({ tree }), `fake:${document}`);

    expect(sources.problems).toEqual([]);
    expect(sources.detached).toBe(true);
    // Ключи набора — пути от корня модуля; копия документа из `schema/` в него не идёт.
    expect(sources.resources.get('validation/form.ts')).toBe(`fake:${root}/validation/form.ts`);
    expect(sources.files.has(placement.schemaPath)).toBe(false);

    const plan = planModule(sources.resources.keys(), moduleFilesFor(document, sources.detached));
    expect(plan.layout).toBe('roles');
    // Каждый файл роли, который кодоген напечатал под этим именем формы, точка входа требует.
    const printed = moduleFilesOf(makeNames(formName), placement.schemaPath);
    for (const role of [
      printed.initial,
      printed.validation,
      printed.flow,
      printed.behavior,
      printed.submit,
      printed.registry,
    ]) {
      expect(
        module.files.map((file) => file.path),
        role
      ).toContain(role);
      expect(plan.entry, role).toContain(role);
    }
    // Страница и сборка приложения до линковщика не доходят; реэкспорты модуля (корневой
    // `index.ts`) отсекает ещё отбор набора.
    expect(plan.skipped).toEqual([printed.page, printed.create, printed.entry]);
    expect(sources.files.has(printed.barrel)).toBe(false);
  });

  it('нейтральные плагины называют каталог ДОКУМЕНТА — модуль кодогена лежит внутри него', () => {
    // Правила жизни состояния превью и стенда приложения о свободных именах не знают: для них
    // модуль — каталог документа. Состояние формы при этом держит и файл подкаталога кодогена.
    const document = at('src/forms/credit.schema.json');
    expect(previewModuleDirectory(files, document)).toBe(at('src/forms'));
    expect(appPreviewModuleDirectory(files, document)).toBe(at('src/forms'));

    const sessions = createPreviewSessions();
    sessions.storeFor(document);
    const lifecycle = attachPreviewLifecycle(
      {
        openDocuments: () => [at('src/forms/credit/validation/form.ts')],
        onDidChange: () => ({ dispose: () => undefined }),
      },
      files,
      sessions
    );
    expect(sessions.ids()).toEqual([document]);
    lifecycle.dispose();
  });
});
