/**
 * Раннер валидации — утечки (`src/form/validation/run.ts`).
 *
 * Раннер помнит на пару «модель + схема» поля, чьи замечания разнёс последний прогон, — по ним
 * следующий прогон гасит поля, которые больше не проверяются (удалённая строка, выключенная
 * ветка). Память эта не копится: поле, не попавшее в новый прогон, гасится один раз и
 * отпускается. Здесь проверяется сборщиком мусора, что
 * - ручки полей удалённой строки раннер держит только до следующего прогона той же схемы;
 * - состояние пары живёт не дольше модели: реестр прогонов слабый.
 */

import { describe, expect, it } from 'vitest';
import { tick } from '../../test-utils/async';
import { collectGarbage, collectUntilReleased } from '../../test-utils/gc';
import { disposeForm } from '../../test-utils/dispose-form';
import { issueCodes } from '../../test-utils/issues';
import { arrayOf, createModel, type FormModel } from '../../../src/model/index';
import { createFormFromModel } from '../../../src/form/create-form';
import { required } from '../../../src/form/validators';
import { applyEach, defineValidation, validate, validateModel } from '../../../src/form/validation';
import type { FormGroup } from '../../../src/form/types/nodes';

interface Row {
  label: string;
}
interface Sheet {
  title: string;
  rows: Row[];
}

const rowRules = defineValidation<Row>(({ model }) => {
  validate(model.$.label, [required()]);
});

const sheetRules = defineValidation<Sheet>(({ model }) => {
  validate(model.$.title, [required()]);
  applyEach(model.$.rows, rowRules);
});

function createSheet(): { model: FormModel<Sheet>; form: FormGroup<Sheet> } {
  const model = createModel<Sheet>({
    title: '',
    rows: arrayOf((): Row => ({ label: '' }), [{ label: '' }, { label: '' }]),
  });
  const form = createFormFromModel<Sheet>({
    model,
    schema: {
      children: [
        { model: model.$.title },
        { model: model.$.rows, item: (row: FormModel<Row>) => ({ model: row.$.label }) },
      ],
    },
  });
  return { model, form };
}

describe('run — память пары «модель + схема»', () => {
  it('ручки полей удалённой строки раннер держит до следующего прогона той же схемы', async () => {
    const { model, form } = createSheet();
    await validateModel(model, sheetRules);
    // Слабые ссылки на первую строку: под-модель и форма строки, ручка поля и его нода.
    const trackFirstRow = () => {
      const row = model.rows.at(0);
      const rowForm = form.rows.at(0);
      return {
        row: [row, rowForm].map((target) => new WeakRef(target as object)),
        field: [row.$.label, rowForm?.label].map((target) => new WeakRef(target as object)),
      };
    };
    const refs = trackFirstRow();
    const released = (list: WeakRef<object>[]) => list.map((ref) => ref.deref() === undefined);

    model.rows.removeAt(0);
    await collectUntilReleased(refs.row);
    // Сборка мусора прошла только что: ручка поля и его нода её пережили.
    await tick();
    collectGarbage();
    const afterRemoval = { row: released(refs.row), field: released(refs.field) };
    await validateModel(model, sheetRules);
    await collectUntilReleased(refs.field);

    expect({ afterRemoval, afterNextRun: released(refs.field), rows: form.rows.length }).toEqual({
      // Строку отпустила форма; ручку поля с замечанием помнит прошлый прогон — её ещё гасить.
      afterRemoval: { row: [true, true], field: [false, false] },
      afterNextRun: [true, true],
      rows: 1,
    });
    disposeForm(form);
  });

  it('состояние пары уходит вместе с моделью — реестр прогонов её не держит', async () => {
    const validateAndDrop = async (): Promise<WeakRef<object>[]> => {
      const { model, form } = createSheet();
      await validateModel(model, sheetRules);
      const refs = [model, form, form.rows.at(0)].map((target) => new WeakRef(target as object));
      // Прогон был настоящим: замечания разнесены, раннер запомнил поля.
      expect(issueCodes(form.title)).toEqual(['required']);
      disposeForm(form);
      return refs;
    };
    const refs = await validateAndDrop();

    await collectUntilReleased(refs);

    expect(refs.map((ref) => ref.deref() === undefined)).toEqual([true, true, true]);
  });
});
