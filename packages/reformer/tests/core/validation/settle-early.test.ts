/**
 * Ранний разнос: пока async-правила прогона ждут ответа, замечания полей без async-правил уже на
 * нодах. Async-правило пишет только в своё поле, поэтому у остальных итог готов после синхронной
 * части; поле с async-правилом ждёт ответа целиком.
 */
import { describe, expect, it } from 'vitest';
import { flushMicrotasks } from '../../test-utils/async';
import { controlledAsyncRule } from '../../test-utils/async-rules';
import { issueCodes } from '../../test-utils/issues';
import { createModel } from '../../../src/model/index';
import { createForm } from '../../../src/form/form-bundle';
import { defineFormBehavior, enableWhen } from '../../../src/form/behaviors';
import { defineValidation, validate, validateAsync } from '../../../src/form/validation';
import { runAndApply } from '../../../src/form/validation/run';
import { required } from '../../../src/form/validators';

interface Signup {
  username: string;
  name: string;
  phone: string;
  extra: string;
  hasExtra: boolean;
}

const initial = (): Signup => ({
  username: 'anna',
  name: '',
  phone: '',
  extra: '',
  hasExtra: false,
});

function setup() {
  const free = controlledAsyncRule<string>();
  const rules = defineValidation<Signup>(({ model }) => {
    validate(model.$.username, [required()]);
    validateAsync(model.$.username, [free.rule]);
    validate(model.$.name, [required()]);
    validate(model.$.extra, [required()]);
  });
  const bundle = createForm<Signup>({
    initial: initial(),
    validation: { rules, strategy: 'afterFirstSubmit' },
    behavior: defineFormBehavior<Signup>(({ model }) => {
      enableWhen(model.$.extra, () => model.hasExtra);
    }),
  });
  return { bundle, free, rules };
}

describe('ранний разнос замечаний при ожидающих async-правилах', () => {
  it('отправка: ошибки полей без async-правил видны до ответа сервера, вся форма тронута', async () => {
    const { bundle, free } = setup();
    const { form } = bundle;

    const outcome = bundle.submission.submit(async () => 'sent');
    await flushMicrotasks();

    expect(free.values).toEqual(['anna']);
    expect(issueCodes(form.name)).toEqual(['required']);
    expect(form.name.shouldShowError.value).toBe(true);
    // Поле без правил тоже тронуто: отказ отправки уже известен — синхронная ошибка есть.
    expect(form.phone.touched.value).toBe(true);
    // Поле с async-правилом ждёт ответа: замечаний нет, статус — проверка.
    expect([form.username.pending.value, form.username.issues.value]).toEqual([true, []]);
    // Выключенное поле в проверке формы не участвует и в раннем разносе.
    expect(form.extra.issues.value).toEqual([]);

    free.answers[0].resolve({ code: 'taken' });

    expect(await outcome).toMatchObject({ status: 'invalid' });
    expect(issueCodes(form.name)).toEqual(['required']);
    expect(issueCodes(form.username)).toEqual(['taken']);
    expect(form.username.pending.value).toBe(false);
  });

  it('прогон без касания: замечания разносятся рано, поля не метятся тронутыми', async () => {
    const { bundle, free, rules } = setup();
    const { form, model } = bundle;

    const run = runAndApply(model, rules);
    await flushMicrotasks();

    expect(issueCodes(form.name)).toEqual(['required']);
    expect(form.name.touched.value).toBe(false);
    free.answers[0].resolve(null);
    expect(await run).toMatchObject({ status: 'invalid' });
  });

  it('прогон, отменённый новым, оставляет ранний разнос — его заменяет разнос нового', async () => {
    const { bundle, free, rules } = setup();
    const { form, model } = bundle;

    const first = runAndApply(model, rules, { skipDisabled: true });
    await flushMicrotasks();
    expect(issueCodes(form.name)).toEqual(['required']);

    model.name = 'Анна';
    const second = runAndApply(model, rules, { skipDisabled: true });
    await flushMicrotasks();

    expect((await first).status).toBe('cancelled');
    expect(form.name.issues.value).toEqual([]);
    free.answers[1].resolve(null);
    expect(await second).toMatchObject({ status: 'valid' });
    expect(form.name.issues.value).toEqual([]);
  });

  it('поле с async-правилом — по ответу своего правила, не дожидаясь других полей', async () => {
    const free = controlledAsyncRule<string>();
    const known = controlledAsyncRule<string>();
    // Правило-«капча»: без сервера отвечает сразу, а синхронная ошибка у поля есть.
    const instant = async (value: string) => (value ? null : null);
    const rules = defineValidation<Signup>(({ model }) => {
      validateAsync(model.$.username, [free.rule]);
      validateAsync(model.$.name, [known.rule]);
      validate(model.$.phone, [required()]);
      validateAsync(model.$.phone, [instant]);
    });
    const bundle = createForm<Signup>({ initial: initial(), validation: { rules } });
    const { form } = bundle;

    const first = bundle.validate();
    // Только микротаски, без таймера: в браузере ошибки на экране до следующего кадра.
    await flushMicrotasks(20);

    // «Капча» ответила сразу: её синхронная ошибка видна, пока сервер думает о других полях.
    expect(issueCodes(form.phone)).toEqual(['required']);
    expect(form.phone.pending.value).toBe(false);
    expect([form.username.pending.value, form.name.pending.value]).toEqual([true, true]);

    free.answers[0].resolve({ code: 'taken' });
    await flushMicrotasks(20);
    expect(issueCodes(form.username)).toEqual(['taken']);
    expect([form.username.pending.value, form.name.pending.value]).toEqual([false, true]);

    known.answers[0].resolve(null);
    expect((await first).status).toBe('invalid');
    expect([form.username.pending.value, form.name.pending.value]).toEqual([false, false]);

    // Ожидание снимается один раз: следующий прогон снова держит поле в pending.
    const second = bundle.validate();
    await flushMicrotasks(20);
    expect(form.username.pending.value).toBe(true);
    free.answers[1].resolve(null);
    known.answers[1].resolve(null);
    await second;
    expect(form.username.pending.value).toBe(false);
  });

  it('без async-правил в прогоне разнос один — итоговый', async () => {
    const rules = defineValidation<Signup>(({ model }) => {
      validate(model.$.name, [required()]);
    });
    const model = createModel<Signup>(initial());
    const bundle = createForm<Signup>({ model });
    const writes: unknown[] = [];
    const stop = bundle.form.name.issues.subscribe((issues) => writes.push(issues));

    await runAndApply(model, rules);
    stop();

    // Первая запись — начальное значение подписки, вторая — единственный разнос.
    expect(writes).toHaveLength(2);
    expect(issueCodes(bundle.form.name)).toEqual(['required']);
  });
});
