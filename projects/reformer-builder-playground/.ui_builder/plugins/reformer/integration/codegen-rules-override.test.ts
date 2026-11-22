/**
 * Правила хода — в код модуля: генерация по заказу с правилами заказчика (`stackInput`) и только
 * файлами правил (`only`), через настоящий стек ReFormer.
 *
 * Так ассистент записывает правила формы: модуль уже сгенерирован, и ход пишет ровно файлы
 * правил — валидацию, поведение и точечные правки файлов человека (словарь текстов, константы
 * источников). Производные файлы при этом не трогаются: их обновляет «Сгенерировать код».
 *
 * @module plugins/reformer/integration/codegen-rules-override.test
 */

import { describe, expect, it } from 'vitest';
import type { ResourceId } from '@reformer/builder-plugin-api';
import { partsSchema, plainSchema } from '../core/testing';
import type { FormRules } from '../core/form-model';
import { RULE_TARGET_IDS } from '../core/codegen';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { generateFor } from '../../forms/codegen/src/pipeline/generate-for';
import { createCodegenSessions } from '../../forms/codegen/src/pipeline/state';
import { createFakeDocument, createFakeHost } from '../../forms/codegen/src/testing';
import { BUILTIN_TARGETS, reformerStacks } from './codegen-harness';

const DOC = 'src/forms/credit.schema.json' as ResourceId;
const MODULE = 'src/forms/credit';

/** Цели файлов правил — их пишет ход. */
const RULE_TARGETS = RULE_TARGET_IDS;

function setup(schema: JsonFormSchema) {
  const document = createFakeDocument(DOC, JSON.stringify(schema), 'credit.schema.json');
  const host = createFakeHost({ document });
  const store = createCodegenSessions().storeFor(DOC);
  const options = {
    host,
    stacks: reformerStacks(),
    targets: BUILTIN_TARGETS,
    store,
    translate: (key: string) => key,
  };
  const generate = (rules?: FormRules, only?: readonly string[]) =>
    generateFor(options, DOC, {
      ...(rules === undefined ? {} : { stackInput: { stack: 'reformer', value: { rules } } }),
      ...(only === undefined ? {} : { only }),
    });
  return { host, generate };
}

const rulesWith = (over: Partial<FormRules>): FormRules => ({
  validation: [],
  behavior: [],
  render: [],
  ...over,
});

describe('правила хода — в код модуля', () => {
  it('правило и его текст: валидация — из правил хода, текст — в словарь человека', async () => {
    const { host, generate } = setup(plainSchema());
    await generate();
    const types = host.written.get(`${MODULE}/types/credit.ts`);
    host.written.set(`${MODULE}/types/credit.ts`, `${types}// правка человека\n`);

    const report = await generate(
      rulesWith({
        validation: [
          {
            target: 'fullName',
            rules: ["required({ code: 'fullName.required' })"],
            code: 'fullName.required',
            message: 'Укажите ФИО',
          },
        ],
      }),
      RULE_TARGETS
    );

    expect(report.ok).toBe(true);
    if (!report.ok) return;
    expect(report.written).toEqual(
      expect.arrayContaining(['validation/form.ts', 'validation/messages.ts'])
    );
    expect(report.written).not.toContain('types/credit.ts');
    expect(host.written.get(`${MODULE}/types/credit.ts`)).toContain('// правка человека');
    expect(host.written.get(`${MODULE}/validation/form.ts`)).toContain(
      "required({ code: 'fullName.required' })"
    );
    expect(host.written.get(`${MODULE}/validation/messages.ts`)).toContain(
      "'fullName.required': 'Укажите ФИО'"
    );
  });

  it('правило убрали — его текст уходит из словаря, свои записи человека остаются', async () => {
    const { host, generate } = setup(plainSchema());
    const withMessage = rulesWith({
      validation: [
        {
          target: 'fullName',
          rules: ["required({ code: 'fullName.required' })"],
          code: 'fullName.required',
          message: 'Укажите ФИО',
        },
      ],
    });
    await generate(withMessage);
    const messages = `${MODULE}/validation/messages.ts`;
    host.written.set(
      messages,
      (host.written.get(messages) ?? '').replace(
        "'fullName.required': 'Укажите ФИО',",
        "'fullName.required': 'Укажите ФИО',\n  'mine.code': 'Моя запись',"
      )
    );

    await generate(rulesWith({}), RULE_TARGETS);

    expect(host.written.get(messages)).not.toContain('fullName.required');
    expect(host.written.get(messages)).toContain("'mine.code': 'Моя запись'");
    expect(host.written.get(`${MODULE}/validation/form.ts`)).not.toContain('fullName.required');
  });

  it('значение источника данных — в константы человека, его правка соседней константы цела', async () => {
    const { host, generate } = setup(partsSchema());
    await generate();
    const constants = [...host.written.keys()].find((id) => id.startsWith(`${MODULE}/constants/`))!;
    host.written.set(constants, `${host.written.get(constants)}\nexport const MINE = 1;\n`);

    const regions = [{ value: 'msk', label: 'Москва' }];
    await generate(rulesWith({ dataSources: { REGIONS: regions } }), RULE_TARGETS);

    const text = host.written.get(constants) ?? '';
    expect(text).toContain("value: 'msk'");
    expect(text).toContain("label: 'Москва'");
    expect(text).toContain('export const MINE = 1;');
  });

  it('модуля ещё нет — правила хода печатаются вместе со всем модулем', async () => {
    const { host, generate } = setup(plainSchema());
    const report = await generate(
      rulesWith({ validation: [{ target: 'fullName', rules: ['minLength(3)'] }] })
    );

    expect(report.ok && report.written).toEqual(expect.arrayContaining(['types/credit.ts']));
    expect(host.written.get(`${MODULE}/validation/form.ts`)).toContain('minLength(3)');
  });
});
