/**
 * Regression: ArrayNode.validate() должен учитывать array-level errors (setErrors),
 * а не только валидность элементов.
 *
 * Баг (до фикса): validate() возвращал results.every(Boolean) только по валидациям элементов
 * и игнорировал this._arrayErrors. Поэтому после setErrors([minItems]) реактивный valid.value
 * === false (агрегат учитывает ownErrors), но await validate() резолвился в true — императивное
 * булево расходилось с сигналом, и submit()/родительская валидация продолжали работу.
 * ModelArrayNode это уже учитывает; ArrayNode отзеркалили.
 */

import { describe, it, expect } from 'vitest';
import { ArrayNode } from '../../../src/core/nodes/array-node';
import { ComponentInstance } from '../../test-utils/types';

interface Item {
  name: string;
}

const schema = {
  name: { value: '', component: null as ComponentInstance },
};

describe('ArrayNode.validate() учитывает array-level errors', () => {
  it('validate() === false, когда установлены array-level errors (совпадает с valid.value)', async () => {
    const arr = new ArrayNode<Item>(schema, [{ name: 'A' }]);

    // элементы валидны (собственных валидаторов нет), но нарушено правило уровня массива
    arr.setErrors([{ code: 'minItems', message: 'минимум 2 элемента' }]);

    expect(arr.valid.value).toBe(false); // реактивный сигнал уже учитывает ownErrors
    await expect(arr.validate()).resolves.toBe(false); // раньше true — расхождение
  });

  it('validate() === true, когда array-level errors очищены', async () => {
    const arr = new ArrayNode<Item>(schema, [{ name: 'A' }]);
    arr.setErrors([{ code: 'minItems', message: 'x' }]);
    arr.clearErrors();

    expect(arr.valid.value).toBe(true);
    await expect(arr.validate()).resolves.toBe(true);
  });
});
