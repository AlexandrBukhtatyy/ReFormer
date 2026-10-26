/**
 * Затравка структурного хода: карта формы на начало попытки — и у пустой формы тоже.
 *
 * @module plugins/reformer/ai/stack/seed.test
 */

import { describe, expect, it } from 'vitest';
import { emptyRules, emptySchema } from '../../../core/form-model';
import { sampleSchema } from '../../../core/testing';
import { formSeed } from './seed';

describe('затравка формы', () => {
  it('пустая форма называет корень: продолжение после create_form не идёт за картой', () => {
    // Замер на живой модели: каждое продолжение на новой пустой форме начиналось с
    // get_form_outline — модель не знала, куда вставлять.
    const seed = formSeed(emptySchema());

    expect(seed).toContain('empty');
    expect(seed).toContain('/root');
    expect(seed).not.toContain('Form map');
  });

  it('у пустой формы правила и запертое всё равно видны', () => {
    const rules = {
      ...emptyRules(),
      validation: [{ target: 'email', rules: ['required'] }],
    };

    const seed = formSeed(emptySchema(), rules, ['validation: edited by hand']);

    expect(seed).toContain('validate email: required');
    expect(seed).toContain('validation: edited by hand');
  });

  it('непустая форма — карта с адресами узлов', () => {
    const seed = formSeed(sampleSchema());

    expect(seed).toContain('Form map');
    expect(seed).toContain('/root/children/0');
    expect(seed).not.toContain('is empty');
  });
});
