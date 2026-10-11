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
 * @module shell/boot/integration/preview-surfaces.test
 */

import { describe, expect, it } from 'vitest';
import { makeResourceId, type ResourceId } from '@reformer/builder-plugin-api/internal';
import { parentOf, resolve } from '@/shell/platform/primitives/resource-path';
import { moduleDirectoryOf as appPreviewModuleDirectory } from '../../base/app-preview/src/model';
import { chooseSurface } from '../../forms/preview/src';
import {
  attachPreviewLifecycle,
  moduleDirectoryOf as previewModuleDirectory,
} from '../../forms/preview/src/state/lifecycle';
import { createPreviewSessions } from '../../forms/preview/src/state/sessions';
import { BUILTIN_TARGETS, generateModule } from '../codegen/src';
import { moduleDirOfSchemaPath } from '../core/codegen';
import { builtinKit, wizardSchema } from '../core/testing';
import { builtinSurfaces, COMPILING_SURFACE_ID, RUNTIME_SURFACE_ID } from '../render/src';
import { locateModule } from '../render/src/compiling/module';
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

    // Компилирующая поверхность: отсюда читаются файлы модуля.
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
