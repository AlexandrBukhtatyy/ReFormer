/**
 * F8 — кросс-строчные записи как first-class: exclusiveFlag (single-selection) и
 * aggregateInto (агрегатная запись в строки с коалесингом, устойчивая к инкрементальному push).
 */

import { describe, it, expect } from 'vitest';
import { createModel } from '../../src/core/model';
import { createForm } from '../../src/core/utils/create-form';
import { defineFormBehavior, exclusiveFlag, aggregateInto } from '../../src/behaviors';

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

describe('F8 · exclusiveFlag (single-selection)', () => {
  it('единственный primary среди строк', async () => {
    interface Contact {
      name: string;
      primary: boolean;
    }
    interface F {
      contacts: Contact[];
    }
    const model = createModel<F>({ contacts: [] });
    const behavior = defineFormBehavior<F>(({ model: m }) => {
      exclusiveFlag<Contact>(m.$.contacts, (row) => row.$.primary);
    });
    createForm<F>({ model, behavior });

    model.contacts.push({ name: 'a', primary: false });
    model.contacts.push({ name: 'b', primary: false });
    model.contacts.push({ name: 'c', primary: false });

    model.contacts.at(0).primary = true;
    await tick();
    expect(model.contacts.at(0).primary).toBe(true);

    model.contacts.at(2).primary = true; // выбрали другую → первая гаснет
    await tick();
    expect(model.contacts.at(0).primary).toBe(false);
    expect(model.contacts.at(1).primary).toBe(false);
    expect(model.contacts.at(2).primary).toBe(true);
  });
});

describe('F8 · aggregateInto (cross-row aggregate write)', () => {
  it('последняя строка = 100 − Σ(остальные); устойчиво к инкрементальному push', async () => {
    interface Row {
      percent: number;
    }
    interface F {
      rows: Row[];
    }
    const model = createModel<F>({ rows: [] });
    const behavior = defineFormBehavior<F>(({ model: m }) => {
      aggregateInto<Row>(m.$.rows, (rows) => {
        const n = rows.length;
        if (n === 0) return [];
        const others = rows.slice(0, n - 1).reduce((s, r) => s + r.percent, 0);
        return [{ index: n - 1, patch: { percent: 100 - others } }];
      });
    });
    createForm<F>({ model, behavior });

    // инкрементальный push (ранее хрупкий случай) — коалесинг считает по финальному состоянию
    model.rows.push({ percent: 0 });
    model.rows.push({ percent: 30 });
    model.rows.push({ percent: 0 }); // последняя — авто
    await tick();
    expect(model.rows.at(2).percent).toBe(70); // 100 − (0+30)

    // правка строки → пересчёт
    model.rows.at(0).percent = 40;
    await tick();
    expect(model.rows.at(2).percent).toBe(30); // 100 − (40+30)
  });

  it('атомарная установка набора строк (model.set)', async () => {
    interface Row {
      percent: number;
    }
    interface F {
      rows: Row[];
    }
    const model = createModel<F>({ rows: [] });
    const behavior = defineFormBehavior<F>(({ model: m }) => {
      aggregateInto<Row>(m.$.rows, (rows) => {
        const n = rows.length;
        if (n === 0) return [];
        const others = rows.slice(0, n - 1).reduce((s, r) => s + r.percent, 0);
        return [{ index: n - 1, patch: { percent: 100 - others } }];
      });
    });
    createForm<F>({ model, behavior });

    model.set({ rows: [{ percent: 25 }, { percent: 25 }, { percent: 0 }] });
    await tick();
    expect(model.rows.at(2).percent).toBe(50); // 100 − (25+25)
  });
});
