/**
 * Применение набора изменений: одна запись, строгий гейт и отказ вместо тихой перезаписи.
 *
 * @module plugins/reformer/ai/session/apply.test
 */

import { describe, expect, it } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { validateFormSchema } from '@reformer/renderer-json/validate';
import { emptyRules } from '../../../core/form-model';
import { applyChangeSet, isStale, type ApplyDeps, type ApplyRequest } from './apply';
import { createChangeSet, type ChangeSet } from '../model/changeset';
import { printSchemaText } from '../model/schema-text';
import { createFakeFiles, createFakeHost } from '../testing';
import { builtinEntries } from '../../../core/testing';
import { printRulesText } from '../../../core/codegen/rules-file';

const RESOURCE = 'form.json';

/**
 * Зависимости применения: рабочая область, каталог кита и заказ проверки по мета-схеме.
 *
 * В тесте настоящая функция берётся статическим импортом — вес модуля здесь ничего не стоит,
 * а проверять гейт двойником значило бы проверять двойник.
 */
const deps = (host: ApplyDeps['host']): ApplyDeps => ({
  host,
  catalog: () => builtinEntries(),
  validateForm: () => Promise.resolve(validateFormSchema),
});

function schema(label: string): JsonFormSchema {
  return {
    format: 2,
    version: '1.0',
    root: {
      component: '$component(Box)',
      children: [
        { model: '$model(email)', component: '$component(Input)', componentProps: { label } },
      ],
    },
  } as unknown as JsonFormSchema;
}

/** Набор «база → черновик» с одной осмысленной правкой. */
function changed(base: JsonFormSchema, draft: JsonFormSchema): ChangeSet {
  return {
    ...createChangeSet(base, emptyRules()),
    draft,
    ops: [{ kind: 'update', ref: '/root/children/0', summary: 'Почта → Email' }],
  };
}

function setup(baseLabel = 'Почта', draftLabel = 'Email') {
  const host = createFakeHost();
  const base = schema(baseLabel);
  const baseText = printSchemaText(base);
  host.openDocument(RESOURCE, baseText);
  const pending: ApplyRequest = {
    set: changed(base, schema(draftLabel)),
    resource: RESOURCE,
    baseText,
  };
  return { host, pending };
}

describe('применение набора', () => {
  it('весь ход уходит ОДНОЙ записью в рабочую копию', async () => {
    const { host, pending } = setup();
    expect(await applyChangeSet(deps(host), pending)).toEqual({ status: 'applied' });
    expect(host.writes).toHaveLength(1);
    expect(host.writes[0].id).toBe(RESOURCE);
    expect(host.writes[0].text).toContain('Email');
  });

  it('запись ассистента помечена его происхождением, а не человеческим', async () => {
    const { host, pending } = setup();

    await applyChangeSet(deps(host), pending);

    // Канал записи у ассистента тот же, что у человека, поэтому пометка — единственное,
    // чем правка машины отличима от правки руками в журнале.
    expect(host.writes[0].mark?.origin).toBe('agent');
  });

  it('идентификатор хода уезжает в запись — иначе ход нечем отменить целиком', async () => {
    const { host, pending } = setup();

    await applyChangeSet(deps(host), { ...pending, txId: 'ход-1' });

    expect(host.writes[0].mark?.txId).toBe('ход-1');
  });

  it('без проверки по мета-схеме запись не идёт: гейт — барьер, а не украшение', async () => {
    const { host, pending } = setup();
    const broken = new Error('чанк не доехал');

    const outcome = await applyChangeSet(
      { ...deps(host), validateForm: () => Promise.reject(broken) },
      pending
    );

    // Не `invalid`: схему НЕ отвергли, её нечем было проверить. И главное — не `applied`:
    // молча пропустить непроверенный выход модели значило бы, что барьера нет вовсе.
    expect(outcome).toEqual({ status: 'failed', error: broken });
    expect(host.writes).toEqual([]);
  });

  it('пустой набор ничего не пишет', async () => {
    const { host } = setup();
    const base = schema('Почта');
    const pending: ApplyRequest = {
      set: createChangeSet(base, emptyRules()),
      resource: RESOURCE,
      baseText: printSchemaText(base),
    };
    expect(await applyChangeSet(deps(host), pending)).toEqual({ status: 'empty' });
    expect(host.writes).toEqual([]);
  });

  it('правка руками во время хода даёт расхождение, а не тихую перезапись', async () => {
    const { host, pending } = setup();
    host.editOutside(RESOURCE, printSchemaText(schema('Рабочая почта')));
    expect(await applyChangeSet(deps(host), pending)).toEqual({ status: 'conflict' });
    expect(host.writes).toEqual([]);
  });

  it('расхождение перезаписывается только по явному решению человека', async () => {
    const { host, pending } = setup();
    host.editOutside(RESOURCE, printSchemaText(schema('Рабочая почта')));
    expect(await applyChangeSet(deps(host), pending, { force: true })).toEqual({
      status: 'applied',
    });
    expect(host.writes).toHaveLength(1);
  });

  it('закрытая вкладка — отказ, а не запись в никуда', async () => {
    const { host, pending } = setup();
    host.closeDocument(RESOURCE);
    expect(await applyChangeSet(deps(host), pending)).toEqual({ status: 'no-form' });
  });

  it('строгий гейт не пускает выдуманный компонент в буфер', async () => {
    const { host } = setup();
    const base = schema('Почта');
    const draft = {
      format: 2,
      version: '1.0',
      root: {
        component: '$component(Box)',
        children: [{ model: '$model(email)', component: '$component(НетТакого)' }],
      },
    } as unknown as JsonFormSchema;
    const pending: ApplyRequest = {
      set: changed(base, draft),
      resource: RESOURCE,
      baseText: printSchemaText(base),
    };
    const outcome = await applyChangeSet(deps(host), pending);
    expect(outcome.status).toBe('invalid');
    expect(host.writes).toEqual([]);
  });

  it('отказ рабочей области возвращается исходом, а не исключением', async () => {
    const { host, pending } = setup();
    host.failWrites(new Error('квота кончилась'));
    const outcome = await applyChangeSet(deps(host), pending);
    expect(outcome.status).toBe('failed');
  });
});

describe('расхождение спрашивается заранее', () => {
  const baseOf = (pending: ApplyRequest) => ({
    resource: pending.resource,
    text: pending.baseText,
  });

  it('нетронутый буфер расхождением не считается', () => {
    const { host, pending } = setup();
    expect(isStale({ host }, baseOf(pending))).toBe(false);
  });

  it('правка снаружи и закрытая вкладка — оба расхождение', () => {
    const { host, pending } = setup();
    host.editOutside(RESOURCE, printSchemaText(schema('Другое')));
    expect(isStale({ host }, baseOf(pending))).toBe(true);
    host.closeDocument(RESOURCE);
    expect(isStale({ host }, baseOf(pending))).toBe(true);
  });
});

describe('файл правил формы — вторая запись того же хода', () => {
  const RULES_FILE = 'form.rules.json';
  const REQUIRED = {
    validation: [{ target: 'email', rules: ['required'] }],
    behavior: [],
    render: [],
  };

  function withRules(rulesText: string | null, options: { broken?: string } = {}) {
    const files = createFakeFiles(rulesText === null ? {} : { [RULES_FILE]: rulesText });
    const host = createFakeHost(files);
    const base = schema('Почта');
    const baseText = printSchemaText(base);
    host.openDocument(RESOURCE, baseText);
    const pending: ApplyRequest = {
      set: { ...changed(base, schema('Email')), draftRules: REQUIRED },
      resource: RESOURCE,
      baseText,
      txId: 'tx-1',
      rulesFile: {
        id: RULES_FILE,
        text: rulesText,
        ...(options.broken === undefined ? {} : { broken: options.broken }),
      },
    };
    return { host, files, pending };
  }

  it('правила ложатся файлом рядом с той же пометкой хода, что схема', async () => {
    const { host, files, pending } = withRules(null);
    expect(await applyChangeSet(deps(host), pending)).toEqual({ status: 'applied' });
    expect(files.text(RULES_FILE)).toBe(printRulesText(REQUIRED));
    expect(files.writes[0].mark).toEqual(host.writes[0].mark);
    expect(host.writes[0].mark?.txId).toBe('tx-1');
  });

  it('правила не менялись — файл не трогается и не заводится', async () => {
    const { host, files, pending } = withRules(printRulesText(REQUIRED));
    await applyChangeSet(deps(host), pending);
    expect(files.writes).toEqual([]);

    const empty = withRules(null);
    const noRules = { ...empty.pending, set: { ...empty.pending.set, draftRules: emptyRules() } };
    await applyChangeSet(deps(empty.host), noRules);
    expect(empty.files.writes).toEqual([]);
  });

  it('файл правил правили после начала хода — расхождение; «всё равно» пишет', async () => {
    const { host, files, pending } = withRules(null);
    files.put(RULES_FILE, printRulesText(emptyRules()));
    expect(await applyChangeSet(deps(host), pending)).toEqual({ status: 'conflict' });
    expect(host.writes).toEqual([]);

    expect(await applyChangeSet(deps(host), pending, { force: true })).toEqual({
      status: 'applied',
    });
    expect(files.text(RULES_FILE)).toBe(printRulesText(REQUIRED));
  });

  it('битый файл правил не перезаписывается: схема легла, исход говорит о правилах', async () => {
    const { host, files, pending } = withRules('{ broken', { broken: 'Unexpected token' });
    expect(await applyChangeSet(deps(host), pending)).toEqual({
      status: 'applied',
      rulesBroken: true,
    });
    expect(files.text(RULES_FILE)).toBe('{ broken');
    expect(host.writes).toHaveLength(1);
  });
});
