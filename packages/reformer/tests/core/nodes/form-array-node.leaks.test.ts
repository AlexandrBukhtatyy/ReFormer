/**
 * `FormArrayNode` — утечки: effect синхронизации массива и формы строк.
 *
 * Нода массива держит один effect — он следит за массивом модели и строит формы строк. Форма
 * строки сама effect'ов не держит, но массив внутри строки — тоже нода со своим effect'ом. Здесь
 * проверяется, что этот счёт сходится на всех путях:
 * - строка, выпавшая из массива (`removeAt`, `clear`, замена массива), отдаёт effect'ы своих
 *   вложенных массивов сразу; перестановка (`move`, `swap`) ничего не пересоздаёт;
 * - снятие ноды массива и формы целиком возвращает счётчик к базе, повторное снятие безопасно, а
 *   снятая нода на записи в модель больше не реагирует;
 * - форма удалённой строки уходит сборщику мусора, пока форма жива.
 * Что снятие зовёт `dispose` каждой строки ровно один раз — в `model-array-node-dispose.test.ts`
 * и `form-array-node.test.ts`.
 */

import { describe, expect, it, vi } from 'vitest';
import { createdEffects, liveEffects } from '../../test-utils/effect-tracker';
import { disposeForm } from '../../test-utils/dispose-form';
import { collectUntilReleased } from '../../test-utils/gc';
import { arrayOf, createModel, type FormModel } from '../../../src/model/index';
import { createFormFromModel } from '../../../src/form/create-form';
import { rawNode } from '../../../src/form/nodes/node-kind';
import type { FormGroup } from '../../../src/form/types/nodes';

vi.mock('@preact/signals-core', async (importOriginal) =>
  (await import('../../test-utils/effect-tracker')).trackEffects(await importOriginal())
);

interface Phone {
  number: string;
}
interface Contact {
  name: string;
  phones: Phone[];
}
interface Tag {
  label: string;
}
interface Book {
  title: string;
  contacts: Contact[];
  tags: Tag[];
}

const blankPhone = (): Phone => ({ number: '' });
const blankContact = (): Contact => ({ name: '', phones: arrayOf(blankPhone) });

/** Контакт с телефонами — обычные данные: шаблон телефона строка берёт из шаблона массива. */
const contact = (name: string, numbers: string[] = []): Contact => ({
  name,
  phones: numbers.map((number) => ({ number })),
});

/**
 * Книга контактов: массив строк с вложенным массивом телефонов и плоский массив меток. Счёт
 * effect'ов: по одному на массив книги (`contacts`, `tags`) и по одному на массив телефонов в
 * каждой строке контактов.
 */
function createBook(contacts: Contact[] = [contact('Анна', ['1']), contact('Борис', ['2', '3'])]) {
  const model = createModel<Book>({
    title: '',
    contacts: arrayOf(blankContact, contacts),
    tags: arrayOf((): Tag => ({ label: '' }), [{ label: 'семья' }]),
  });
  const form: FormGroup<Book> = createFormFromModel<Book>({
    model,
    schema: {
      children: [
        { model: model.$.title },
        {
          model: model.$.contacts,
          item: (row: FormModel<Contact>) => ({
            children: [
              { model: row.$.name },
              {
                model: row.$.phones,
                item: (phone: FormModel<Phone>) => ({ model: phone.$.number }),
              },
            ],
          }),
        },
        { model: model.$.tags, item: (tag: FormModel<Tag>) => ({ model: tag.$.label }) },
      ],
    },
  });
  return { model, form };
}

describe("form-array-node — счёт effect'ов", () => {
  it('массив держит один effect, вложенный массив каждой строки — ещё по одному', () => {
    const base = liveEffects();

    const { form } = createBook();
    const built = liveEffects() - base;
    disposeForm(form);

    // contacts + tags + телефоны двух строк.
    expect({ built, disposed: liveEffects() - base }).toEqual({ built: 4, disposed: 0 });
  });

  it('новая строка добавляет effect своего вложенного массива, удалённая — отдаёт его сразу', () => {
    const { model, form } = createBook();
    const before = liveEffects();

    model.contacts.push(contact('Вера', ['4']));
    const pushed = liveEffects() - before;
    model.contacts.removeAt(0);
    const removed = liveEffects() - before;
    model.contacts.clear();
    const cleared = liveEffects() - before;
    disposeForm(form);

    expect({ pushed, removed, cleared }).toEqual({ pushed: 1, removed: 0, cleared: -2 });
  });

  it("строки без своих массивов effect'ов не добавляют", () => {
    const { model, form } = createBook();
    const before = liveEffects();

    model.contacts.at(0).phones.push({ number: '5' });
    model.tags.push({ label: 'работа' });
    const pushed = liveEffects() - before;
    model.contacts.at(0).phones.clear();
    model.tags.clear();
    const cleared = liveEffects() - before;
    disposeForm(form);

    expect({ pushed, cleared }).toEqual({ pushed: 0, cleared: 0 });
  });

  it("замена массива (patch) снимает effect'ы прежних строк и создаёт effect'ы новых", () => {
    const { model, form } = createBook();
    const before = liveEffects();
    const createdBefore = createdEffects();

    model.patch({ contacts: [contact('Глеб', ['6']), contact('Дина'), contact('Ева')] });
    const afterPatch = { live: liveEffects() - before, created: createdEffects() - createdBefore };
    disposeForm(form);

    // Было две строки, стало три: минус два effect'а, плюс три.
    expect(afterPatch).toEqual({ live: 1, created: 3 });
  });

  it("move и swap формы строк не пересоздают — новых effect'ов нет", () => {
    const { model, form } = createBook([contact('А', ['1']), contact('Б', ['2']), contact('В')]);
    const rows = [form.contacts.at(0), form.contacts.at(1), form.contacts.at(2)];
    const before = liveEffects();
    const createdBefore = createdEffects();

    model.contacts.move(0, 2);
    model.contacts.swap(0, 1);

    expect({
      live: liveEffects() - before,
      created: createdEffects() - createdBefore,
      // Порядок после перестановок — В, Б, А: формы те же, что были у строк до них.
      sameRows: [
        form.contacts.at(0) === rows[2],
        form.contacts.at(1) === rows[1],
        form.contacts.at(2) === rows[0],
      ],
    }).toEqual({ live: 0, created: 0, sameRows: [true, true, true] });
    disposeForm(form);
  });
});

describe('form-array-node — снятие ноды', () => {
  it("снятие ноды массива снимает её effect и effect'ы строк, соседний массив работает", () => {
    const { model, form } = createBook();
    const before = liveEffects();

    rawNode(form.contacts).dispose();
    const afterArray = liveEffects() - before;
    model.tags.push({ label: 'работа' });

    // contacts и телефоны двух строк сняты; tags жив и видит новую строку.
    expect({ afterArray, tags: form.tags.length }).toEqual({ afterArray: -3, tags: 2 });
    disposeForm(form);
  });

  it('повторное снятие ноды массива и формы целиком счётчик не трогает', () => {
    const base = liveEffects();
    const { form } = createBook();

    rawNode(form.contacts).dispose();
    rawNode(form.contacts).dispose();
    const afterArray = liveEffects() - base;
    disposeForm(form);
    disposeForm(form);

    expect({ afterArray, afterForm: liveEffects() - base }).toEqual({
      afterArray: 1,
      afterForm: 0,
    });
  });

  it("снятая нода на записи в модель не реагирует: ни строк, ни effect'ов", () => {
    const { model, form } = createBook();
    disposeForm(form);
    const before = liveEffects();
    const createdBefore = createdEffects();

    model.contacts.push(contact('Жанна', ['7']));
    model.contacts.at(0).phones.push({ number: '8' });
    model.contacts.removeAt(1);
    model.tags.clear();

    expect({
      live: liveEffects() - before,
      created: createdEffects() - createdBefore,
      contacts: [model.contacts.length, form.contacts.length],
      tags: [model.tags.length, form.tags.length],
    }).toEqual({ live: 0, created: 0, contacts: [2, 2], tags: [0, 1] });
  });

  it('строка, удалённая до снятия, второй раз не снимается', () => {
    const base = liveEffects();
    const { model, form } = createBook();

    model.contacts.removeAt(0);
    const afterRemoval = liveEffects() - base;
    disposeForm(form);

    // После удаления: contacts + tags + телефоны оставшейся строки.
    expect({ afterRemoval, disposed: liveEffects() - base }).toEqual({
      afterRemoval: 3,
      disposed: 0,
    });
  });
});

describe('form-array-node — сборщик мусора', () => {
  /** Слабые ссылки на то, что принадлежит первой строке; сильных наружу нет. */
  const trackFirstRow = (form: FormGroup<Book>) => {
    const row = form.contacts.at(0);
    return {
      /** Форма строки и нода её вложенного массива. */
      row: [row, row?.phones].map((target) => new WeakRef(target as object)),
      /** Форма строки вложенного массива — телефона. */
      nested: new WeakRef(row?.phones.at(0) as object),
    };
  };

  it('форма удалённой строки и нода её вложенного массива уходят, пока форма жива', async () => {
    const { model, form } = createBook();
    const refs = trackFirstRow(form);

    model.contacts.removeAt(0);
    await collectUntilReleased(refs.row);

    expect({
      released: refs.row.map((ref) => ref.deref() === undefined),
      rows: form.contacts.length,
    }).toEqual({ released: [true, true], rows: 1 });
    disposeForm(form);
  });

  it('формы строк, вытесненных заменой массива, тоже уходят', async () => {
    const { model, form } = createBook();
    const refs = trackFirstRow(form);

    model.patch({ contacts: [contact('Зоя')] });
    await collectUntilReleased(refs.row);

    expect({
      released: refs.row.map((ref) => ref.deref() === undefined),
      rows: form.contacts.length,
    }).toEqual({ released: [true, true], rows: 1 });
    disposeForm(form);
  });

  // Было: `dispose()` вложенного массива читал `rows.value` внутри effect'а синхронизации
  // родителя (тот как раз снимает выпавшую строку) и подписывал его на снятый массив — формы
  // вложенных строк жили в источниках этого effect'а до его следующего прогона.
  it('формы строк вложенного массива удалённой строки уходят сразу [ReFormer-68sy]', async () => {
    const { model, form } = createBook();
    const refs = trackFirstRow(form);

    model.contacts.removeAt(0);
    await collectUntilReleased([refs.nested]);

    try {
      expect(refs.nested.deref() === undefined).toBe(true);
    } finally {
      disposeForm(form);
    }
  });

  it('формы вложенных строк уходят со следующим изменением внешнего массива', async () => {
    const { model, form } = createBook();
    const refs = trackFirstRow(form);

    model.contacts.removeAt(0);
    model.contacts.push(contact('Инна'));
    await collectUntilReleased([refs.nested]);

    expect({ released: refs.nested.deref() === undefined, rows: form.contacts.length }).toEqual({
      released: true,
      rows: 2,
    });
    disposeForm(form);
  });

  it('снятие формы отпускает формы вложенных строк, даже если ссылка на форму жива', async () => {
    const { model, form } = createBook();
    const refs = trackFirstRow(form);

    model.contacts.removeAt(0);
    disposeForm(form);
    await collectUntilReleased([refs.nested]);

    expect({ released: refs.nested.deref() === undefined, rows: form.contacts.length }).toEqual({
      released: true,
      rows: 1,
    });
  });
});
