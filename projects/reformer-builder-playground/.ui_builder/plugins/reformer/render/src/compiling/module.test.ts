/**
 * Модуль формы глазами превью: где корень, какая раскладка, что требует точка входа.
 *
 * @module plugins/reformer/render/compiling/module.test
 */

import { describe, expect, it } from 'vitest';
import { locateModule, moduleFilesFor, planModule } from './module';

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
    expect(plan.roles.renderBehavior).toEqual([]);
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
    expect(roles.renderBehavior[0]).toBe('form.render.ts');
    expect(roles.registry).toEqual(['registry.ts', 'registry.tsx']);
    // Потока шагов и отдельной отправки у прежнего контракта нет.
    expect(roles.flow).toEqual([]);
    expect(roles.submit).toEqual([]);
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
});
