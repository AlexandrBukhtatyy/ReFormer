/**
 * Применение набора изменений: одна запись, строгий гейт и отказ вместо тихой перезаписи.
 *
 * @module plugins/ai/apply.test
 */

import { describe, expect, it } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { validateFormSchema } from '@reformer/renderer-json/validate';
import { emptyRules } from '@/lib/form-model/rules';
import { applyChangeSet, isStale, type ApplyDeps } from './apply';
import { createChangeSet, type ChangeSet } from './core/changeset';
import { printSchemaText } from './schema-text';
import type { PendingChanges } from './session';
import { createFakeHost } from './testing';

const RESOURCE = 'form.json';

/**
 * Зависимости применения: рабочая область плюс заказ проверки по мета-схеме.
 *
 * В тесте настоящая функция берётся статическим импортом — вес модуля здесь ничего не стоит,
 * а проверять гейт двойником значило бы проверять двойник.
 */
const deps = (host: ApplyDeps['host']): ApplyDeps => ({
  host,
  validateForm: () => Promise.resolve(validateFormSchema),
});

function schema(label: string): JsonFormSchema {
  return {
    version: '1.0',
    root: {
      component: '$component(Box)',
      children: [
        { value: '$model(email)', component: '$component(Input)', componentProps: { label } },
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
  const pending: PendingChanges = {
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
      { host, validateForm: () => Promise.reject(broken) },
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
    const pending: PendingChanges = {
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
      version: '1.0',
      root: {
        component: '$component(Box)',
        children: [{ value: '$model(email)', component: '$component(НетТакого)' }],
      },
    } as unknown as JsonFormSchema;
    const pending: PendingChanges = {
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
  it('нетронутый буфер расхождением не считается', () => {
    const { host, pending } = setup();
    expect(isStale({ host }, pending)).toBe(false);
  });

  it('правка снаружи и закрытая вкладка — оба расхождение', () => {
    const { host, pending } = setup();
    host.editOutside(RESOURCE, printSchemaText(schema('Другое')));
    expect(isStale({ host }, pending)).toBe(true);
    host.closeDocument(RESOURCE);
    expect(isStale({ host }, pending)).toBe(true);
  });
});
