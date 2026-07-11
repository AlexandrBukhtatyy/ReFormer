/**
 * Стресс-тест контракта на «реальных» сложных паттернах форм, собранных из публичных источников
 * (React Hook Form, Angular Reactive/Signal Forms, статьи о wizard/async-валидации). Цель — нащупать
 * НЕДОСТАТКИ подхода для развития концепции. Найденные ограничения помечены тегами F1..F8 (см. низ файла).
 *
 * Источники: react-hook-form.com/advanced-usage, angular.dev/guide/forms/reactive-forms,
 * timjames.dev (dependent fields + zod), thoughtbot «Structuring Conditionals in a Wizard».
 */

import { describe, it, expect } from 'vitest';
import { createModel } from '../../src/state/index';
import { createForm } from '../../src/form/create-form';
import {
  defineFormBehavior,
  compute,
  onChange,
  effect,
  defer,
  applyEach,
} from '../../src/form/behaviors';
import { convertBetween, onChangeThrottled } from './custom-operators';
import type { FormProxy } from '../../src/form/types/index';

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const fieldErrors = (n: unknown) => (n as { errors: { value: { code: string }[] } }).errors.value;

// ============================================================================
// W1 — Cross-field equality (RHF: confirm password === password)
// ============================================================================
describe('W1 · cross-field equality (confirm password)', () => {
  it('ставит/снимает ошибку на confirm при несовпадении', async () => {
    interface F {
      password: string;
      confirm: string;
    }
    const model = createModel<F>({ password: '', confirm: '' });
    const behavior = defineFormBehavior<F>(({ model: m, form }) => {
      // Крайний случай (F1, по дизайну): в общем случае cross-field валидация живёт в слое валидации.
      // Здесь — пользовательский оператор-валидатор поверх effect + setErrors (контракт это позволяет).
      effect(() => {
        const ok = m.password === m.confirm;
        defer(() =>
          form.confirm.setErrors(ok ? [] : [{ code: 'mismatch', message: 'Не совпадает' }])
        );
      });
    });
    const form = createForm<F>({ model, behavior }) as FormProxy<F>;

    model.password = 'secret';
    model.confirm = 'sicret';
    await tick();
    expect(fieldErrors(form.confirm)).toHaveLength(1);
    model.confirm = 'secret';
    await tick();
    expect(fieldErrors(form.confirm)).toHaveLength(0);
  });
});

// ============================================================================
// W2 — Async uniqueness (debounced) + staleness probe
// ============================================================================
describe('W2 · async uniqueness validation', () => {
  it('debounced проверка занятости имени ставит ошибку', async () => {
    interface F {
      username: string;
    }
    const model = createModel<F>({ username: '' });
    const isTaken = (u: string) => Promise.resolve(u === 'admin');
    const behavior = defineFormBehavior<F>(({ model: m, form }) => {
      onChange(
        m.$.username,
        async (u) => {
          if (!u) return form.username.setErrors([]);
          const taken = await isTaken(u);
          form.username.setErrors(taken ? [{ code: 'taken', message: 'Занято' }] : []);
        },
        { debounce: 20 }
      );
    });
    const form = createForm<F>({ model, behavior }) as FormProxy<F>;

    model.username = 'ad';
    model.username = 'admin'; // быстрые смены → debounce оставит последнюю
    await tick(40);
    expect(fieldErrors(form.username)).toEqual([{ code: 'taken', message: 'Занято' }]);
    model.username = 'free';
    await tick(40);
    expect(fieldErrors(form.username)).toHaveLength(0);
  });

  it('F2 РЕШЕНО (onChange signal): устаревший ответ отбрасывается через signal.aborted', async () => {
    interface F {
      username: string;
    }
    const model = createModel<F>({ username: '' });
    const gate: Record<string, (v: boolean) => void> = {};
    const check = (u: string) => new Promise<boolean>((res) => (gate[u] = res));
    const behavior = defineFormBehavior<F>(({ model: m, form }) => {
      onChange(m.$.username, async (u, { signal }) => {
        const taken = await check(u);
        if (signal.aborted) return; // ← стейл-ответ отбрасываем
        form.username.setErrors(taken ? [{ code: 'taken', message: 'x' }] : []);
      });
    });
    const form = createForm<F>({ model, behavior }) as FormProxy<F>;

    model.username = 'old'; // старый запрос (вернёт taken=true) — будет аннулирован
    await tick();
    model.username = 'new'; // новый запрос (вернёт taken=false)
    await tick();
    gate['new'](false); // свежий ответ пришёл первым → ошибок нет
    await tick();
    expect(fieldErrors(form.username)).toHaveLength(0);
    gate['old'](true); // устаревший ответ пришёл позже, но signal аннулирован → ИГНОРИРУЕТСЯ
    await tick();
    expect(fieldErrors(form.username)).toHaveLength(0); // ✓ стейл больше не перезатирает
  });
});

// ============================================================================
// W3 — Conditional required (RHF: required if other field === X)
// ============================================================================
describe('W3 · conditional required', () => {
  it('email обязателен только при contactMethod === email', async () => {
    interface F {
      contactMethod: string;
      email: string;
    }
    const model = createModel<F>({ contactMethod: 'phone', email: '' });
    const behavior = defineFormBehavior<F>(({ model: m, form }) => {
      // Крайний случай (F1, по дизайну): «conditional required» в общем случае — в слое валидации.
      // Здесь — пользовательский оператор поверх effect + setErrors как исключение.
      effect(() => {
        const need = m.contactMethod === 'email' && !m.email;
        defer(() =>
          form.email.setErrors(need ? [{ code: 'required', message: 'Нужен email' }] : [])
        );
      });
    });
    const form = createForm<F>({ model, behavior }) as FormProxy<F>;

    await tick();
    expect(fieldErrors(form.email)).toHaveLength(0); // method=phone
    model.contactMethod = 'email';
    await tick();
    expect(fieldErrors(form.email)).toHaveLength(1); // email пуст
    model.email = 'a@b.c';
    await tick();
    expect(fieldErrors(form.email)).toHaveLength(0);
  });
});

// ============================================================================
// W4 — Allocation: проценты строк суммируются в 100 (field array constraint)
// ============================================================================
describe('W4 · allocation sum-to-100', () => {
  it('remaining = 100 - Σ; флаг валидности', () => {
    interface Row {
      percent: number;
    }
    interface F {
      rows: Row[];
      remaining: number;
      valid: boolean;
    }
    const model = createModel<F>({ rows: [], remaining: 100, valid: false });
    const behavior = defineFormBehavior<F>(({ model: m }) => {
      compute(
        m.$.remaining,
        () => 100 - m.rows.map((r) => r.percent as number).reduce((a, b) => a + b, 0)
      );
      compute(m.$.valid, () => m.remaining === 0);
    });
    createForm<F>({ model, behavior });

    model.rows.push({ percent: 30 });
    model.rows.push({ percent: 70 });
    expect(model.remaining).toBe(0);
    expect(model.valid).toBe(true);
    model.rows.at(1).percent = 50;
    expect(model.remaining).toBe(20);
    expect(model.valid).toBe(false);
  });
});

// ============================================================================
// W5 — Auto-distribute remainder в последнюю строку (cross-row write)
// ============================================================================
describe('W5 · auto-distribute remainder', () => {
  it('последняя строка = 100 - Σ(остальные)', async () => {
    interface Row {
      percent: number;
    }
    interface F {
      rows: Row[];
    }
    const model = createModel<F>({ rows: [] });
    const behavior = defineFormBehavior<F>(({ model: m }) => {
      // F8: кросс-строчная запись выражается через effect+defer (нет first-class оператора).
      effect(() => {
        const n = m.rows.length;
        if (n === 0) return;
        const others = m.rows
          .map((r) => r.percent as number)
          .slice(0, n - 1)
          .reduce((a, b) => a + b, 0);
        const last = 100 - others;
        defer(() => {
          if (m.rows.at(n - 1).percent !== last) m.rows.at(n - 1).percent = last;
        });
      });
    });
    createForm<F>({ model, behavior });

    // F8: инкрементальный push строк запускает авто-распределение на промежуточных состояниях
    // (каскад затирает) — надёжно только при АТОМАРНОЙ установке набора строк (set).
    model.set({ rows: [{ percent: 0 }, { percent: 30 }, { percent: 0 }] });
    await tick();
    expect(model.rows.at(2).percent).toBe(70); // 100 - (0+30)
    model.rows.at(0).percent = 40;
    await tick();
    expect(model.rows.at(2).percent).toBe(30); // 100 - (40+30)
  });
});

// ============================================================================
// W6 — Insert/Edit mode (Angular insert/edit guide): load + captureInitial + dirty
// ============================================================================
describe('W6 · insert/edit mode', () => {
  it('F9 РЕШЕНО: bulk-load с производным полем не затирает его (model.set и form.patchValue)', () => {
    interface F {
      price: number;
      qty: number;
      total: number;
    }
    const model = createModel<F>({ price: 0, qty: 0, total: 0 });
    const behavior = defineFormBehavior<F>(({ model: m }) => {
      compute(m.$.total, () => m.price * m.qty);
    });
    const form = createForm<F>({ model, behavior }) as FormProxy<F>;

    // payload с сервера СОДЕРЖИТ производное total:0 — оно игнорируется, total = price*qty
    model.set({ price: 10, qty: 3, total: 0 });
    model.captureInitial();
    expect(model.total).toBe(30); // ✓ не затёрто нулём из payload
    expect(model.isDirty()).toBe(false);

    model.qty = 5;
    expect(model.total).toBe(50);
    expect(model.isDirty()).toBe(true);

    // тот же эффект через node-путь загрузки (form.patchValue)
    (form as unknown as { patchValue(v: Partial<F>): void }).patchValue({
      price: 2,
      qty: 4,
      total: 999,
    });
    expect(model.total).toBe(8); // ✓ 2*4, а не 999 из payload
  });
});

// ============================================================================
// W7 — Зависимый select: локально вычисленные опции + сброс (без async)
// ============================================================================
describe('W7 · dependent select (local options)', () => {
  it('опции региона зависят от страны; регион сбрасывается', async () => {
    interface F {
      country: string;
      region: string;
    }
    const REGIONS: Record<string, string[]> = { US: ['CA', 'NY'], RU: ['MOW', 'SPB'] };
    const model = createModel<F>({ country: '', region: '' });
    const optionsLog: string[][] = [];
    const behavior = defineFormBehavior<F>(({ model: m, form }) => {
      onChange(m.$.country, (c) => {
        m.region = '';
        const opts = REGIONS[c] ?? [];
        optionsLog.push(opts);
        form.region.updateComponentProps({ options: opts });
      });
    });
    createForm<F>({ model, behavior });

    model.region = 'STALE';
    model.country = 'US';
    await tick();
    expect(model.region).toBe('');
    expect(optionsLog.at(-1)).toEqual(['CA', 'NY']);
  });
});

// ============================================================================
// W8 — Двусторонняя конвертация (last-edited-wins) — как пользовательский оператор
// ============================================================================
describe('W8 · bidirectional convert (meters ↔ cm)', () => {
  it('правка любого поля пересчитывает другое (last-edited-wins) — оператор convertBetween', async () => {
    interface F {
      meters: number;
      cm: number;
    }
    // F4 (по дизайну — пользовательский оператор): см. tests/behaviors/custom-operators.ts.
    const model = createModel<F>({ meters: 0, cm: 0 });
    const behavior = defineFormBehavior<F>(({ model: m }) => {
      convertBetween(
        m.$.meters,
        m.$.cm,
        (me) => me * 100,
        (c) => c / 100
      );
    });
    createForm<F>({ model, behavior });

    model.meters = 2;
    await tick();
    expect(model.cm).toBe(200);
    model.cm = 150;
    await tick();
    expect(model.meters).toBe(1.5);
  });
});

// ============================================================================
// W9 — Каскадная очистка глубины 3 (country→region→city→district)
// ============================================================================
describe('W9 · cascade clear depth 3', () => {
  it('смена верхнего уровня очищает все нижестоящие', async () => {
    interface F {
      country: string;
      region: string;
      city: string;
      district: string;
    }
    const model = createModel<F>({ country: '', region: '', city: '', district: '' });
    const behavior = defineFormBehavior<F>(({ model: m }) => {
      onChange(m.$.country, () => {
        m.region = '';
        m.city = '';
        m.district = '';
      });
      onChange(m.$.region, () => {
        m.city = '';
        m.district = '';
      });
      onChange(m.$.city, () => {
        m.district = '';
      });
    });
    createForm<F>({ model, behavior });

    model.region = 'r';
    model.city = 'c';
    model.district = 'd';
    model.country = 'X';
    await tick();
    expect([model.region, model.city, model.district]).toEqual(['', '', '']);
  });
});

// ============================================================================
// W10 — Взаимный compute: сходящийся (ок) vs логический цикл (F7)
// ============================================================================
describe('W10 · mutual compute', () => {
  it('сходящийся взаимный compute стабилизируется', () => {
    interface F {
      a: number;
      b: number;
    }
    const model = createModel<F>({ a: 1, b: 1 });
    const behavior = defineFormBehavior<F>(({ model: m }) => {
      // a = max(b, 5); b = max(a, 3) → сходится к a=5, b=5 (peek-guard останавливает)
      compute(m.$.a, () => Math.max(m.b, 5));
      compute(m.$.b, () => Math.max(m.a, 3));
    });
    createForm<F>({ model, behavior });
    expect(model.a).toBe(5);
    expect(model.b).toBe(5);
    // F7: НЕсходящийся цикл (a=b+1; b=a+1) контрактом не детектируется — это ответственность автора.
  });
});

// ============================================================================
// W11 — «At least one of» (multi-field required)
// ============================================================================
describe('W11 · at-least-one-of', () => {
  it('хотя бы один из phone/email заполнен', () => {
    interface F {
      phone: string;
      email: string;
      hasContact: boolean;
    }
    const model = createModel<F>({ phone: '', email: '', hasContact: false });
    const behavior = defineFormBehavior<F>(({ model: m }) => {
      compute(m.$.hasContact, () => Boolean(m.phone) || Boolean(m.email));
    });
    createForm<F>({ model, behavior });
    expect(model.hasContact).toBe(false);
    model.email = 'a@b.c';
    expect(model.hasContact).toBe(true);
    model.email = '';
    model.phone = '+7';
    expect(model.hasContact).toBe(true);
  });
});

// ============================================================================
// W12 — Throttle как пользовательский оператор (F3: нет встроенного throttle)
// ============================================================================
describe('W12 · throttle (custom operator)', () => {
  it('throttle (leading-edge) ограничивает частоту по времени — оператор onChangeThrottled', async () => {
    interface F {
      term: string;
    }
    const calls: string[] = [];
    let clock = 0;
    // F3 (по дизайну — пользовательский оператор): см. tests/behaviors/custom-operators.ts.
    // clock инъектируется для детерминизма (в проде по умолчанию Date.now).
    const model = createModel<F>({ term: '' });
    const behavior = defineFormBehavior<F>(({ model: m }) => {
      onChangeThrottled(
        m.$.term,
        (v) => calls.push(v),
        100,
        () => clock
      );
    });
    createForm<F>({ model, behavior });

    model.term = 'a';
    await tick(); // t=0 → срабатывает 'a'
    clock = 50;
    model.term = 'b';
    await tick(); // 50-0 < 100 → подавлено
    clock = 130;
    model.term = 'c';
    await tick(); // 130-0 ≥ 100 → срабатывает 'c'
    expect(calls).toEqual(['a', 'c']);
  });
});

// ============================================================================
// W13 — Per-row валидация в динамическом массиве (applyEach + setErrors)
// ============================================================================
describe('W13 · per-row validation', () => {
  it('каждая строка валидирует своё поле (qty > 0) через applyEach', () => {
    // F6: per-row доступ к НОДЕ строки требует материализованного массива в форме; per-row флаг
    // на уровне МОДЕЛИ работает всегда — валидность строки как вычисляемое поле строки.
    interface Row {
      qty: number;
      ok: boolean;
    }
    interface F {
      rows: Row[];
    }
    const model = createModel<F>({ rows: [] });
    const behavior = defineFormBehavior<F>(({ model: m }) => {
      applyEach(
        m.$.rows,
        defineFormBehavior<Row>(({ model: row }) => {
          compute(row.$.ok, () => row.qty > 0);
        })
      );
    });
    createForm<F>({ model, behavior });

    model.rows.push({ qty: 0, ok: false });
    model.rows.push({ qty: 5, ok: false });
    expect(model.rows.at(0).ok).toBe(false);
    expect(model.rows.at(1).ok).toBe(true);
    model.rows.at(0).qty = 2;
    expect(model.rows.at(0).ok).toBe(true);
  });
});

/**
 * НАЙДЕННЫЕ ОГРАНИЧЕНИЯ (для развития концепции):
 * F1 — ПО ДИЗАЙНУ (не недостаток): схема поведения НЕ управляет валидацией — это отдельный слой
 *      (validateFormModel + схема валидации), он владеет errors. Крайние случаи behavior-driven
 *      валидации (cross-field, async-uniqueness) пишутся пользовательским оператором поверх
 *      effect/onChange + node.setErrors (см. W1/W3) — контракт это позволяет, но это исключение.
 * F2 — РЕШЕНО примитивом: onChange отдаёт AbortSignal (аннулируется при следующей смене значения).
 *      Колбэк передаёт signal в fetch или проверяет signal.aborted перед применением → гонки
 *      устаревших ответов устранены. Async-ВАЛИДАЦИЯ намеренно НЕ в behavior (это слой валидации,
 *      F1): behavior даёт только реактивный примитив, «владение валидностью» остаётся за слоем
 *      валидации (async-валидаторы — будущая фича validateFormModel с тем же staleness).
 * F3 — Нет throttle (только debounce) — пишется кастомным оператором.
 * F4 — Нет двусторонней конвертации (syncFields = зеркало/однонаправленный transform).
 * F6 — Per-row операции с НОДОЙ строки требуют материализованного массива в форме (applyEach даёт
 *      model-scope; node-операции на строку ограничены).
 * F7 — Логические циклы compute не детектируются (несходящийся цикл = ответственность автора).
 * F8 — Кросс-строчные записи (auto-distribute, single-primary) — через effect+defer/замыкание на
 *      родителя; нет first-class оператора. Хрупки при инкрементальном построении массива (push):
 *      авто-распределение срабатывает на промежуточных состояниях. Надёжно при атомарном set.
 * F9 — РЕШЕНО: compute/computeFrom помечают цель производной (derived-registry); пути bulk-load
 *      (model.set/patch, GroupNode.patchValue/setValue) пропускают производные поля. Payload может
 *      содержать производные — они игнорируются и вычисляются из источников. compute пишет цель
 *      напрямую (raw signal), прямое присваивание/reset не затронуты.
 * Дополнительно: видимость (show/hide) намеренно вне behavior (render-слой) — повторяющееся трение.
 */
