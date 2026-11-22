/**
 * Модуль формы глазами превью: где корень, какая раскладка, что требует точка входа.
 *
 * @module plugins/reformer/render/compiling/module.test
 */

import { describe, expect, it } from 'vitest';
import { detachedModuleOf, locateModule, moduleFilesFor, planModule } from './module';

/** Каталог адреса: до последнего «/» — та же арифметика, что у двойника порта. */
const parentOf = (id: string): string => id.slice(0, id.lastIndexOf('/'));

/** Модуль простой формы, как его печатает кодоген (набор `plain-rules`). */
const PLAIN_MODULE = [
  'ZayavkaForm.tsx',
  'api/index.ts',
  'application/create.ts',
  'application/entry.ts',
  'application/submit.ts',
  'behavior/index.ts',
  'constants/zayavka.ts',
  'model/initial-value.ts',
  'model/model.ts',
  'schema/registry.ts',
  'types/zayavka.ts',
  'validation/form.ts',
];

/** Модуль разбитого визарда (набор `wizard-split`): к простому — поток, правила и схема шага. */
const WIZARD_MODULE = [
  ...PLAIN_MODULE,
  'flow/zayavka-flow.ts',
  'schema/steps/shag-1/form.schema.json',
  'validation/shag-1.ts',
];

describe('locateModule — корень модуля по документу', () => {
  it('документ в schema/ — модуль в её родителе', () => {
    const location = locateModule(
      parentOf,
      'fs:src/forms/zayavka/schema/form.schema.json',
      'src/forms/zayavka/schema/form.schema.json'
    );
    expect(location).toEqual({ root: 'fs:src/forms/zayavka', document: 'schema/form.schema.json' });
  });

  it('документ прежней плоской раскладки — модуль там же, где документ', () => {
    const location = locateModule(
      parentOf,
      'fs:src/forms/contact/form.schema.json',
      'src/forms/contact/form.schema.json'
    );
    expect(location).toEqual({ root: 'fs:src/forms/contact', document: 'form.schema.json' });
  });

  // Запасное правило документа со свободным именем: подкаталога кодогена нет — читается каталог
  // документа (либо родитель `schema/`), как у документа с каноническим именем.
  it('свободное имя документа не мешает: решает папка, а не имя файла', () => {
    expect(
      locateModule(parentOf, 'fs:forms/loan/schema/loan.json', 'forms/loan/schema/loan.json')
    ).toEqual({ root: 'fs:forms/loan', document: 'schema/loan.json' });
    expect(locateModule(parentOf, 'fs:forms/loan.schema.json', 'forms/loan.schema.json')).toEqual({
      root: 'fs:forms',
      document: 'loan.schema.json',
    });
  });

  it('разделители Windows читаются так же', () => {
    expect(
      locateModule(parentOf, 'fs:forms/loan/schema/form.schema.json', 'forms\\loan\\schema\\x.json')
        .root
    ).toBe('fs:forms/loan');
  });

  it('путь документа неизвестен — читаем от его каталога, как раньше', () => {
    expect(locateModule(parentOf, 'fs:forms/loan/schema/form.schema.json', '')).toEqual({
      root: 'fs:forms/loan/schema',
      document: '',
    });
  });
});

describe('detachedModuleOf — модуль документа со свободным именем', () => {
  it('подкаталог рядом с документом — по имени формы, документ в нём — в schema/', () => {
    expect(detachedModuleOf('forms/credit.schema.json')).toEqual({
      directory: 'credit',
      document: 'schema/form.schema.json',
    });
    // Имя формы — до первой точки имени файла, каталог — его kebab с транслитерацией.
    expect(detachedModuleOf('forms/LoanApplication.form.json')?.directory).toBe('loan-application');
    expect(detachedModuleOf('forms/Заявка на кредит.schema.json')?.directory).toBe(
      'zayavka-na-kredit'
    );
  });

  it('каноническое имя документа — модуль там, где документ: подкаталога нет', () => {
    expect(detachedModuleOf('forms/loan/schema/form.schema.json')).toBeNull();
    expect(detachedModuleOf('forms/loan/form.schema.json')).toBeNull();
    // Прежнее каноническое имя — тоже документ своего каталога.
    expect(detachedModuleOf('forms/loan/renderer.schema.json')).toBeNull();
  });

  it('свободное имя в папке schema/ — то же правило, что у кодогена: подкаталог рядом', () => {
    expect(detachedModuleOf('forms/loan/schema/loan.json')).toEqual({
      directory: 'loan',
      document: 'schema/form.schema.json',
    });
  });

  it('разделители Windows читаются так же; неизвестный путь модуля не называет', () => {
    expect(detachedModuleOf('forms\\credit.schema.json')?.directory).toBe('credit');
    expect(detachedModuleOf('')).toBeNull();
  });
});

describe('planModule — раскладка «папки по ролям»', () => {
  it('точка входа требует файлы ролей — и только их', () => {
    const plan = planModule(PLAIN_MODULE);
    expect(plan.layout).toBe('roles');
    expect(plan.entry).toEqual([
      'model/initial-value.ts',
      'validation/form.ts',
      'behavior/index.ts',
      'application/submit.ts',
      'schema/registry.ts',
    ]);
  });

  it('словарь замечаний — роль: точка входа требует его сразу за валидацией', () => {
    // Страницу, которая подключает словарь в приложении, превью не исполняет.
    const plan = planModule([...PLAIN_MODULE, 'validation/messages.ts']);
    expect(plan.roles.messages).toEqual(['validation/messages.ts']);
    expect(plan.entry).toEqual([
      'model/initial-value.ts',
      'validation/form.ts',
      'validation/messages.ts',
      'behavior/index.ts',
      'application/submit.ts',
      'schema/registry.ts',
    ]);
    // Модуль без словаря его и не требует.
    expect(planModule(PLAIN_MODULE).roles.messages).toEqual([]);
  });

  it('одного словаря мало, чтобы признать раскладку по ролям: роль не маркер', () => {
    // В модуле прежней раскладки папка `validation/` бывала своей, с любыми файлами.
    expect(planModule(['model.ts', 'validation/messages.ts']).layout).toBe('flat');
  });

  it('страница, сборка приложения и запись реестра форм не исполняются', () => {
    const { entry } = planModule([...PLAIN_MODULE, 'index.ts']);
    for (const file of [
      'ZayavkaForm.tsx',
      'index.ts',
      'application/create.ts',
      'application/entry.ts',
    ]) {
      expect(entry).not.toContain(file);
    }
  });

  it('страница и сборка приложения в набор линковщика не идут вовсе', () => {
    const plan = planModule(
      [...PLAIN_MODULE, 'index.ts'],
      moduleFilesFor('forms/zayavka/schema/form.schema.json')
    );
    expect(plan.skipped).toEqual([
      'ZayavkaForm.tsx',
      'index.ts',
      'application/create.ts',
      'application/entry.ts',
    ]);
    // Отправка — файл той же папки, но роль: её из набора убирать нельзя.
    expect(plan.skipped).not.toContain('application/submit.ts');
  });

  it('страницу под прежним именем формы план не знает — она остаётся незатребованной', () => {
    const plan = planModule(PLAIN_MODULE, moduleFilesFor('forms/credit/schema/form.schema.json'));
    expect(plan.skipped).toEqual(['application/create.ts', 'application/entry.ts']);
    expect(plan.entry).not.toContain('ZayavkaForm.tsx');
  });

  it('у визарда к ролям добавляется поток; правила шага подтянет его импорт', () => {
    const plan = planModule(WIZARD_MODULE, moduleFilesFor('forms/zayavka/schema/form.schema.json'));
    expect(plan.roles.flow).toEqual(['flow/zayavka-flow.ts']);
    expect(plan.entry).toContain('flow/zayavka-flow.ts');
    expect(plan.entry).not.toContain('validation/shag-1.ts');
    expect(plan.entry).not.toContain('schema/steps/shag-1/form.schema.json');
  });

  it('папку формы переименовали — поток находится по папке роли', () => {
    // Код печатали для формы `zayavka`, а каталог теперь зовётся `credit`: ожидаемого имени
    // `flow/credit-flow.ts` в модуле нет.
    const plan = planModule(WIZARD_MODULE, moduleFilesFor('forms/credit/schema/form.schema.json'));
    expect(plan.roles.flow).toEqual(['flow/zayavka-flow.ts']);
    expect(plan.entry).toContain('flow/zayavka-flow.ts');
  });

  it('файл потока с ожидаемым именем идёт первым, остальные файлы папки — за ним', () => {
    const plan = planModule(
      [...WIZARD_MODULE, 'flow/a-staryy-flow.ts', 'flow/notes.json'],
      moduleFilesFor('forms/zayavka/schema/form.schema.json')
    );
    expect(plan.roles.flow).toEqual(['flow/zayavka-flow.ts', 'flow/a-staryy-flow.ts']);
  });

  it('реестр и поведение вправе быть .tsx', () => {
    const plan = planModule(['schema/registry.tsx', 'behavior/index.tsx']);
    expect(plan.layout).toBe('roles');
    expect(plan.entry).toEqual(['behavior/index.tsx', 'schema/registry.tsx']);
  });

  it('файлы прежнего контракта, оставшиеся в корне, не исполняются', () => {
    // Модуль перегенерировали на месте: документ и прежние файлы лежат в корне, код — по ролям.
    // Исполни превью `form.render.ts` — отправка привязалась бы второй раз.
    const plan = planModule([
      ...PLAIN_MODULE,
      'registry.ts',
      'model.ts',
      'form.behavior.ts',
      'form.validation.ts',
      'form.render.ts',
    ]);
    expect(plan.layout).toBe('roles');
    expect(plan.entry.some((file) => !file.includes('/'))).toBe(false);
  });

  it('документ в schema/ — раскладка по ролям, даже когда файлов ролей нет: корень не исполняется', () => {
    // В модуле осталась одна страница (код удалили или ещё не сгенерировали). Прими превью его
    // за модуль прежней раскладки — исполнило бы корень, то есть страницу приложения.
    const plan = planModule(
      ['ZayavkaForm.tsx', 'types/zayavka.ts'],
      moduleFilesFor('forms/zayavka/schema/form.schema.json')
    );
    expect(plan.layout).toBe('roles');
    expect(plan.entry).toEqual([]);
  });

  it('порядок файлов набора на план не влияет: превью обязано быть воспроизводимым', () => {
    expect(planModule([...WIZARD_MODULE].reverse()).entry).toEqual(planModule(WIZARD_MODULE).entry);
  });
});

describe('planModule — прежняя плоская раскладка', () => {
  it('требует только корневые файлы: шаги подтянет линковщик по импортам', () => {
    const plan = planModule(['steps/index.ts', 'steps/a/validation.ts', 'validation.ts']);
    expect(plan.layout).toBe('flat');
    expect(plan.entry).toEqual(['validation.ts']);
  });

  it('корневые файлы требуются в порядке набора', () => {
    expect(planModule(['b.ts', 'a.ts']).entry).toEqual(['b.ts', 'a.ts']);
  });

  it('роли ищутся по именам прежнего контракта, каноничное — первым', () => {
    const { roles } = planModule(['model.ts']);
    expect(roles.validation).toEqual(['form.validation.ts', 'validation.ts']);
    expect(Object.values(roles).flat()).not.toContain('form.render.ts');
    expect(roles.registry).toEqual(['registry.ts', 'registry.tsx']);
    // Потока шагов, отдельной отправки и словаря замечаний у прежнего контракта нет.
    expect(roles.flow).toEqual([]);
    expect(roles.submit).toEqual([]);
    expect(roles.messages).toEqual([]);
    // Страницу прежней раскладки отсекает отбор набора — плану убирать нечего.
    expect(planModule(['model.ts', 'api.ts']).skipped).toEqual([]);
  });

  it('одной папки с именем роли мало: раскладку выдаёт файл роли, а не каталог', () => {
    expect(planModule(['model.ts', 'validation/helpers.ts', 'flow/chart.ts']).layout).toBe('flat');
  });
});

describe('moduleFilesFor', () => {
  it('имя файла потока — по каталогу модуля, а не по каталогу документа', () => {
    expect(moduleFilesFor('src/forms/loan-application/schema/form.schema.json').flow).toBe(
      'flow/loan-application-flow.ts'
    );
    expect(moduleFilesFor('src/forms/contact/form.schema.json').flow).toBe('flow/contact-flow.ts');
  });

  it('помнит место документа в модуле: по нему план отличает раскладку по ролям', () => {
    expect(moduleFilesFor('src/forms/loan/schema/form.schema.json').schema).toBe(
      'schema/form.schema.json'
    );
    expect(moduleFilesFor('src/forms/contact/form.schema.json').schema).toBe('form.schema.json');
    // Путь документа неизвестен — о его месте ничего не утверждается.
    expect(planModule(['model.ts'], moduleFilesFor('')).layout).toBe('flat');
  });

  it('модуль из подкаталога документа со свободным именем разложен по ролям', () => {
    const files = moduleFilesFor('forms/credit.schema.json', true);
    // Документ в таком модуле лежит в `schema/`, где бы ни лежал открытый.
    expect(files.schema).toBe('schema/form.schema.json');
    expect(files.flow).toBe('flow/credit-flow.ts');
    expect(files.page).toBe('CreditForm.tsx');
    // Раскладка по ролям — по определению: корень (страница приложения) не исполняется.
    expect(planModule(['CreditForm.tsx', 'types/credit.ts'], files)).toMatchObject({
      layout: 'roles',
      entry: [],
    });
  });

  it('подкаталога нет — у документа со свободным именем раскладку выдают файлы ролей', () => {
    const files = moduleFilesFor('forms/credit.schema.json');
    expect(files.schema).toBe('credit.schema.json');
    expect(planModule(['model.ts'], files).layout).toBe('flat');
    // Признак подкаталога у документа с каноническим именем ничего не меняет.
    expect(moduleFilesFor('forms/loan/form.schema.json', true).schema).toBe('form.schema.json');
  });
});
