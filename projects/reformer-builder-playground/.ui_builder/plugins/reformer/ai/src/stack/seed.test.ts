/**
 * Затравка структурного хода: карта формы на начало попытки — и у пустой формы тоже.
 *
 * @module plugins/reformer/ai/stack/seed.test
 */

import { describe, expect, it } from 'vitest';
import { emptyRules, emptySchema } from '../../../core/form-model';
import { sampleSchema } from '../../../core/testing';
import { formSeed, NEW_FORM_SEED } from './seed';

describe('затравка формы', () => {
  it('непустая форма: о новой форме — create_form, строка до карты; у пустой её нет', () => {
    // Ход идёт в форму вкладки, и просьба о другой форме дописывалась в эту (ReFormer-9a9c).
    // Пустая форма — законная цель такой просьбы: её заполняют, а не заводят новую.
    const filled = formSeed(sampleSchema());
    expect(filled.startsWith(NEW_FORM_SEED)).toBe(true);
    expect(filled.indexOf(NEW_FORM_SEED)).toBeLessThan(filled.indexOf('Form map'));
    expect(NEW_FORM_SEED).toContain('create_form');

    expect(formSeed(emptySchema())).not.toContain(NEW_FORM_SEED);
  });

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

  it('проверки одного поля — одной строкой, как в коде; текст — у своей проверки', () => {
    // Чтение кладёт `validate(model.$.email, [required, email])` правилом на проверку
    // (ReFormer-p4bi), а модель должна видеть одно правило поля, как в файле правил.
    const rules = {
      ...emptyRules(),
      validation: [
        { target: 'email', rules: ['required'], message: 'Введите почту' },
        { target: 'email', rules: ["email({ code: 'email.email' })"] },
        { target: 'email', rules: ['maxLength(80)'], when: 'values.agree' },
        { target: 'email', rules: [], cross: 'values.email !== values.name' },
      ],
    };

    const seed = formSeed(emptySchema(), rules);

    expect(seed).toContain('  validate email: required "Введите почту", email\n');
    expect(seed).toContain('  validate email: maxLength(80) when values.agree');
    expect(seed).toContain('  validate email: cross values.email !== values.name');
    expect(seed.match(/validate email/g)).toHaveLength(3);
  });

  it('непустая форма — карта с адресами узлов', () => {
    const seed = formSeed(sampleSchema());

    expect(seed).toContain('Form map');
    expect(seed).toContain('/root/children/0');
    expect(seed).not.toContain('is empty');
  });
});
