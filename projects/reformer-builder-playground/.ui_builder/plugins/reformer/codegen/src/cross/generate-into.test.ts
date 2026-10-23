/**
 * Генерация в каталог через настоящий стек ReFormer: где ищется схема, что печатается, куда
 * ложится и чем отказывает.
 *
 * @module plugins/reformer/codegen/cross/generate-into.test
 */

import { describe, expect, it } from 'vitest';
import type { ResourceId } from '@reformer/builder-plugin-api';
import { withMarker } from '@reformer/builder-toolkit';
import { wizardSchema } from '../../../core/testing';
import { generateInto } from '../commands/generate-into';
import { createFakeHost } from '../testing';
import { BUILTIN_TARGETS, reformerStacks } from './harness';

/** Минимальная схема, которую `isFormSchema` признаёт формой. */
const FORM = {
  format: 2,
  version: '1.0',
  root: {
    component: '$html(div)',
    children: [{ selector: 'name', model: '$model(name)', component: '$component(Input)' }],
  },
};
const SCHEMA = JSON.stringify(FORM);

/**
 * Та же форма в ПРЕЖНЕМ формате: без `format`, привязка поля — в `value`.
 *
 * Литерал прежнего формата здесь намеренно: это вход проверки перевода, а не недосмотр переноса.
 */
const LEGACY_FORM = {
  version: '1.0',
  root: {
    component: '$html(div)',
    children: [{ selector: 'name', value: '$model(name)', component: '$component(Input)' }],
  },
};
const LEGACY_SCHEMA = JSON.stringify(LEGACY_FORM);

const DIR = 'fake:forms/credit' as ResourceId;

const targets = () => BUILTIN_TARGETS;
const stacks = reformerStacks();

describe('генерация в каталог', () => {
  it('кладёт файлы В САМ каталог, а не в подпапку под ним', async () => {
    const host = createFakeHost({ files: { [`${DIR}/form.schema.json`]: SCHEMA } });

    const outcome = await generateInto(
      { host, stacks, targets },
      { dir: DIR, targetId: 'codegen.types' }
    );

    expect(outcome.kind).toBe('delivered');
    expect(host.written.has(`${DIR}/types/credit.ts`)).toBe(true);
    expect([...host.written.keys()].some((id) => id.includes('/credit/credit/'))).toBe(false);
  });

  it('документ в schema/: файлы модуля ложатся в выбранный каталог, а не в schema/', async () => {
    const host = createFakeHost({ files: { [`${DIR}/schema/form.schema.json`]: SCHEMA } });

    const outcome = await generateInto({ host, stacks, targets }, { dir: DIR });

    expect(outcome).toMatchObject({ kind: 'delivered', formName: 'credit' });
    expect(host.written.has(`${DIR}/CreditForm.tsx`)).toBe(true);
    expect(host.written.has(`${DIR}/application/create.ts`)).toBe(true);
    expect(host.written.has(`${DIR}/schema/registry.ts`)).toBe(true);
    // Документ переписан на месте — второго в корне каталога не появилось.
    expect(host.written.has(`${DIR}/form.schema.json`)).toBe(false);
    expect([...host.written.keys()].some((id) => id.includes('/schema/schema/'))).toBe(false);
  });

  it('щелчок по самой папке schema печатает модуль в её родителе, имя формы — каталог модуля', async () => {
    const schemaDir = `${DIR}/schema` as ResourceId;
    const host = createFakeHost({ files: { [`${schemaDir}/form.schema.json`]: SCHEMA } });

    // Имя формы меню для папки `schema` не передаёт — см. `codegenContextMenuItems` стека.
    const outcome = await generateInto({ host, stacks, targets }, { dir: schemaDir });

    expect(outcome).toMatchObject({ kind: 'delivered', formName: 'credit' });
    if (outcome.kind !== 'delivered') return;
    expect(outcome.delivery.dir).toBe(DIR);
    expect(host.written.has(`${DIR}/types/credit.ts`)).toBe(true);
    expect(host.written.has(`${schemaDir}/types/credit.ts`)).toBe(false);
  });

  it('одна цель печатается так же, как в составе всего модуля', async () => {
    const one = createFakeHost({ files: { [`${DIR}/form.schema.json`]: SCHEMA } });
    const all = createFakeHost({ files: { [`${DIR}/form.schema.json`]: SCHEMA } });

    await generateInto({ host: one, stacks, targets }, { dir: DIR, targetId: 'codegen.registry' });
    await generateInto({ host: all, stacks, targets }, { dir: DIR });

    expect(one.written.get(`${DIR}/schema/registry.ts`)).toBe(
      all.written.get(`${DIR}/schema/registry.ts`)
    );
    expect(one.written.has(`${DIR}/schema/registry.ts`)).toBe(true);
    // И записан ровно один файл: остальные цели печатались только ради контекста.
    expect([...one.written.keys()].filter((id) => !id.endsWith('.schema.json'))).toEqual([
      `${DIR}/schema/registry.ts`,
    ]);
  });

  it('имя формы берётся из аргумента, а без него — из имени файла схемы', async () => {
    const named = createFakeHost({ files: { [`${DIR}/credit.schema.json`]: SCHEMA } });
    await generateInto(
      { host: named, stacks, targets },
      { dir: DIR, targetId: 'codegen.types', formName: 'credit-application' }
    );
    expect(named.written.get(`${DIR}/types/credit-application.ts`)).toContain(
      'CreditApplicationForm'
    );

    const fallback = createFakeHost({ files: { [`${DIR}/credit.schema.json`]: SCHEMA } });
    await generateInto(
      { host: fallback, stacks, targets },
      { dir: DIR, targetId: 'codegen.types' }
    );
    expect(fallback.written.get(`${DIR}/types/credit.ts`)).toContain('CreditForm');
  });

  it('документ со свободным именем остаётся на месте и под своим именем', async () => {
    // Каталог назвал человек — он и есть модуль; заводить рядом копию документа под
    // каноническим именем значило бы получить две схемы одной формы.
    const host = createFakeHost({ files: { [`${DIR}/credit.schema.json`]: SCHEMA } });
    await generateInto({ host, stacks, targets }, { dir: DIR });

    expect(host.written.has(`${DIR}/form.schema.json`)).toBe(false);
    expect(host.written.has(`${DIR}/schema/form.schema.json`)).toBe(false);
    expect(host.written.get(`${DIR}/application/create.ts`)).toContain(
      "import rawSchema from '../credit.schema.json';"
    );
  });

  it('для канонического имени схемы имя формы — имя каталога, а не «form»', async () => {
    const host = createFakeHost({ files: { [`${DIR}/form.schema.json`]: SCHEMA } });
    const outcome = await generateInto(
      { host, stacks, targets },
      { dir: DIR, targetId: 'codegen.types' }
    );
    expect(outcome).toMatchObject({ kind: 'delivered', formName: 'credit' });
    expect(host.written.get(`${DIR}/types/credit.ts`)).toContain('CreditForm');
  });

  it('цель по шагам пишет ВСЕ свои экземпляры — по файлу на шаг', async () => {
    const host = createFakeHost({
      files: { [`${DIR}/form.schema.json`]: JSON.stringify(wizardSchema()) },
    });
    const outcome = await generateInto(
      { host, stacks, targets },
      { dir: DIR, targetId: 'codegen.step-validation' }
    );
    expect(outcome.kind).toBe('delivered');
    if (outcome.kind !== 'delivered') return;
    expect(outcome.delivery.written.length).toBeGreaterThan(0);
    expect(outcome.delivery.written).toEqual(['validation/shag-1.ts']);
  });

  it('прежнее имя документа, брошенные файлы шагов и файлы прежней раскладки доезжают до исхода', async () => {
    const renamed = `${withMarker('правила шага\n')}// моё\n`;
    const host = createFakeHost({
      files: {
        [`${DIR}/renderer.schema.json`]: JSON.stringify(wizardSchema()),
        // Шаг переименовали: файл его правил остался, и в нём правки человека.
        [`${DIR}/validation/pereimenovannyi.ts`]: renamed,
        // Код прежнего контракта — в корне каталога и в папке шага.
        [`${DIR}/form.render.ts`]: 'мои правила рендера\n',
        [`${DIR}/steps/shag-1/form.validation.ts`]: 'мои правила шага\n',
      },
    });
    const outcome = await generateInto({ host, stacks, targets }, { dir: DIR });
    if (outcome.kind !== 'delivered') throw new Error(outcome.kind);
    // Перенос прежнего имени остался только у документа формы.
    expect(outcome.delivery.legacy).toEqual([
      { path: 'renderer.schema.json', replacedBy: 'form.schema.json', carried: false },
    ]);
    const noted = (id: string) => outcome.delivery.notes.find((note) => note.id === id)?.paths;
    expect(noted('orphans')).toEqual(['validation/pereimenovannyi.ts']);
    expect(host.written.get(`${DIR}/validation/pereimenovannyi.ts`)).toBe(renamed);
    // Файлы прежней раскладки названы, не тронуты и под новые имена не перенесены.
    expect(noted('flat')).toEqual(['form.render.ts', 'steps/shag-1/form.validation.ts']);
    expect(host.written.get(`${DIR}/form.render.ts`)).toBe('мои правила рендера\n');
    expect(host.written.get(`${DIR}/behavior/index.ts`)).not.toContain('мои правила рендера');
    expect(host.written.get(`${DIR}/validation/shag-1.ts`)).not.toContain('мои правила шага');
  });

  it('по файлу прежнего формата печатает тот же модуль, что и по записи формата 2', async () => {
    const modern = createFakeHost({ files: { [`${DIR}/form.schema.json`]: SCHEMA } });
    const legacy = createFakeHost({ files: { [`${DIR}/form.schema.json`]: LEGACY_SCHEMA } });

    await generateInto({ host: modern, stacks, targets }, { dir: DIR });
    await generateInto({ host: legacy, stacks, targets }, { dir: DIR });

    // Байт в байт, включая саму схему: она производная и переписана в формат 2.
    expect(Object.fromEntries(legacy.written)).toEqual(Object.fromEntries(modern.written));
    // И это модуль формы с полем, а не пустой: без перевода поле `name` не было бы найдено.
    expect(legacy.written.get(`${DIR}/types/credit.ts`)).toContain('name: string;');
  });

  it('цель, не применившаяся к форме, названа, а не пропущена молча', async () => {
    const host = createFakeHost({ files: { [`${DIR}/form.schema.json`]: SCHEMA } });

    // Поток шагов печатается только у формы с узлом-визардом; здесь его нет.
    const outcome = await generateInto(
      { host, stacks, targets },
      { dir: DIR, targetId: 'codegen.flow' }
    );

    expect(outcome).toEqual({ kind: 'not-applicable', targetId: 'codegen.flow' });
  });

  it('отказы названы: нет каталога, нет схемы, нет кита, источник только для чтения', async () => {
    const empty = createFakeHost();
    expect((await generateInto({ host: empty, stacks, targets }, {})).kind).toBe('no-directory');
    expect((await generateInto({ host: empty, stacks, targets }, { dir: DIR })).kind).toBe(
      'no-schema'
    );

    const noKit = createFakeHost({ files: { [`${DIR}/form.schema.json`]: SCHEMA } });
    expect(
      await generateInto(
        { host: noKit, stacks: reformerStacks({ kit: null }), targets },
        { dir: DIR }
      )
    ).toMatchObject({ kind: 'refused', refusal: { refusal: { key: 'error.no-kit' } } });

    const readOnly = createFakeHost({
      files: { [`${DIR}/form.schema.json`]: SCHEMA },
      write: false,
    });
    expect((await generateInto({ host: readOnly, stacks, targets }, { dir: DIR })).kind).toBe(
      'read-only'
    );

    // Модуль на диске напечатан другим китом — перепечатки под активный нет.
    const foreignKit = createFakeHost({
      files: {
        [`${DIR}/form.schema.json`]: SCHEMA,
        [`${DIR}/schema/registry.ts`]: [
          "import { FormField } from '@reformer/kit-hexa-ui';",
          'reg.component(FIELD_WRAPPER, FormField);',
        ].join('\n'),
      },
    });
    expect(await generateInto({ host: foreignKit, stacks, targets }, { dir: DIR })).toMatchObject({
      kind: 'refused',
      refusal: {
        refusal: {
          key: 'error.kit-mismatch',
          params: { module: '@reformer/kit-hexa-ui', active: '@reformer/ui-kit' },
        },
      },
    });
  });
});
