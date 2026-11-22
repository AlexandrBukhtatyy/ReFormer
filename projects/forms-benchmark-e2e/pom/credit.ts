/**
 * POM кредитной заявки на нейтральном DOM-контракте (BENCH-CONTRACT §4) — один на все реализации.
 *
 * Пути полей — как в `domain/credit` (`personalData.lastName`, `properties.0.type`; дефисная форма
 * тоже принимается), testid выводится `toDomPath`. Контрол поля (как вводить значение) берётся из
 * `CREDIT_FIELDS`, поэтому заполнение шага — по данным (`fillStep`), а не по списку локаторов.
 *
 * Методы с `fill`/`click` — для conformance; бенч вводит «сырым» вводом.
 */
import { expect, type Locator, type Page } from '@playwright/test';
import {
  CREDIT_ARRAYS,
  CREDIT_INITIAL_INPUT,
  CREDIT_STEPS,
  CREDIT_VISIBILITY,
  fieldMeta,
  toDomPath,
  type CreditArrayKey,
  type CreditInput,
} from '../../forms-benchmark/src/shared/domain/credit';

export { SMS_VALID_CODE } from '../../forms-benchmark/src/shared/api/credit-fixtures';

// ── Канонические валидные данные (ASCII там, где вводится с клавиатуры) ─────────
/** Потребительский кредит, работа по найму, адреса совпадают, без массивов. */
export const CONSUMER: CreditInput = {
  ...structuredClone(CREDIT_INITIAL_INPUT),
  loanType: 'consumer',
  loanAmount: 500000,
  loanTerm: 24,
  loanPurpose: 'Home renovation',
  personalData: {
    lastName: 'Ivanov',
    firstName: 'Ivan',
    middleName: 'Petrovich',
    birthDate: '1990-05-15',
    gender: 'male',
    birthPlace: 'Moscow',
  },
  passportData: {
    series: '45 12',
    number: '123456',
    issueDate: '2010-06-01',
    issuedBy: 'Moscow police department',
    departmentCode: '770-025',
  },
  inn: '771234567890',
  snils: '123-456-789 00',
  phoneMain: '+7 (916) 123-45-67',
  email: 'ivan.ivanov@example.com',
  registrationAddress: {
    region: 'spb',
    city: 'spb',
    street: 'Nevsky prospekt',
    house: '10',
    apartment: '5',
    postalCode: '191025',
  },
  employmentStatus: 'employed',
  companyName: 'Romashka LLC',
  companyInn: '7712345678',
  companyPhone: '+7 (495) 123-45-67',
  companyAddress: 'Moscow, Tverskaya 1',
  position: 'Engineer',
  workExperienceTotal: 60,
  workExperienceCurrent: 24,
  monthlyIncome: 150000,
  agreePersonalData: true,
  agreeCreditHistory: true,
  agreeTerms: true,
  confirmAccuracy: true,
  electronicSignature: '123456',
};

/**
 * Ипотека в Москве: ИП, разные адреса, копия email, доп. доход, все три массива (созаёмщиков два).
 * Покрывает все условные секции, кроме автокредита и работы по найму.
 */
export const MORTGAGE: CreditInput = {
  ...structuredClone(CREDIT_INITIAL_INPUT),
  loanType: 'mortgage',
  loanAmount: 4000000,
  loanTerm: 240,
  loanPurpose: 'Apartment purchase',
  propertyValue: 6000000,
  personalData: {
    lastName: 'Smirnova',
    firstName: 'Anna',
    middleName: 'Sergeevna',
    birthDate: '1988-11-20',
    gender: 'female',
    birthPlace: 'Kazan',
  },
  passportData: {
    series: '92 07',
    number: '654321',
    issueDate: '2008-12-01',
    issuedBy: 'Kazan police department',
    departmentCode: '160-004',
  },
  inn: '165012345678',
  snils: '987-654-321 00',
  phoneMain: '+7 (917) 555-12-34',
  phoneAdditional: '+7 (843) 222-33-44',
  email: 'anna.smirnova@example.com',
  sameEmail: true,
  emailAdditional: 'anna.smirnova@example.com',
  registrationAddress: {
    region: 'moscow',
    city: 'moscow',
    street: 'Tverskaya street',
    house: '7',
    apartment: '12',
    postalCode: '125009',
  },
  sameAsRegistration: false,
  residenceAddress: {
    region: 'kazan',
    city: 'kazan',
    street: 'Baumana street',
    house: '3',
    apartment: '',
    postalCode: '420111',
  },
  employmentStatus: 'selfEmployed',
  businessType: 'IP',
  businessInn: '165098765432',
  businessActivity: 'Software development',
  workExperienceTotal: 120,
  workExperienceCurrent: 48,
  monthlyIncome: 200000,
  additionalIncome: 20000,
  additionalIncomeSource: 'Apartment rent',
  maritalStatus: 'married',
  dependents: 1,
  education: 'postgraduate',
  hasProperty: true,
  properties: [
    { type: 'house', description: 'Country house', estimatedValue: 3000000, hasEncumbrance: true },
  ],
  hasExistingLoans: true,
  existingLoans: [
    {
      bank: 'Sberbank',
      type: 'Consumer',
      amount: 300000,
      remainingAmount: 100000,
      monthlyPayment: 15000,
      maturityDate: '2028-12-31',
    },
  ],
  hasCoBorrower: true,
  coBorrowers: [
    {
      personalData: {
        lastName: 'Smirnov',
        firstName: 'Igor',
        middleName: 'Petrovich',
        birthDate: '1986-02-14',
      },
      phone: '+7 (916) 765-43-21',
      email: 'igor.smirnov@example.com',
      relationship: 'Spouse',
      monthlyIncome: 80000,
    },
    {
      personalData: {
        lastName: 'Smirnova',
        firstName: 'Olga',
        middleName: 'Ivanovna',
        birthDate: '1960-07-01',
      },
      phone: '+7 (903) 111-22-33',
      email: 'olga.smirnova@example.com',
      relationship: 'Mother',
      monthlyIncome: 45000,
    },
  ],
  agreePersonalData: true,
  agreeCreditHistory: true,
  agreeMarketing: true,
  agreeTerms: true,
  confirmAccuracy: true,
  electronicSignature: '123456',
};

// ── Пути и значения ──────────────────────────────────────────────────────────
const topKey = (path: string): string => path.split(/[.[-]/)[0];

function getIn(obj: unknown, path: string): unknown {
  let value = obj;
  for (const seg of path.split('.')) value = (value as Record<string, unknown> | undefined)?.[seg];
  return value;
}

/** Поле видно при значениях `v` (условные секции и массивы — `CREDIT_VISIBILITY`). */
export function isVisible(path: string, v: CreditInput): boolean {
  const top = topKey(path);
  const rule = CREDIT_VISIBILITY.find((r) => (r.fields as readonly string[]).includes(top));
  return rule ? rule.visible(v) : true;
}

/** Цифры для ввода в маску: без цифр-литералов префикса (`+7` телефона). */
export function maskDigits(value: string, mask: string): string {
  const first = mask.indexOf('9');
  const prefixDigits = (first === -1 ? mask : mask.slice(0, first)).replace(/\D/g, '');
  const digits = value.replace(/\D/g, '');
  return prefixDigits && digits.startsWith(prefixDigits)
    ? digits.slice(prefixDigits.length)
    : digits;
}

interface BenchWindow {
  __bench: {
    ready: Promise<number>;
    idle(opts?: { network?: boolean }): Promise<number>;
    api: { calls: Record<string, number>; flush(): number; resetCalls(): void };
    submissions: unknown[];
  };
}

export class CreditPage {
  constructor(
    readonly page: Page,
    readonly lib: string
  ) {}

  // ── Локаторы ──
  input(path: string): Locator {
    return this.page.getByTestId(`input-${toDomPath(path)}`);
  }

  /** Радиокнопка опции `value` группы `path`. */
  radio(path: string, value: string): Locator {
    return this.page.getByTestId(`input-${toDomPath(path)}-${value}`);
  }

  error(path: string): Locator {
    return this.page.getByTestId(`error-${toDomPath(path)}`);
  }

  computed(path: string): Locator {
    return this.page.getByTestId(`computed-${toDomPath(path)}`);
  }

  field(path: string): Locator {
    return this.page.getByTestId(`field-${toDomPath(path)}`);
  }

  get stepIndicator(): Locator {
    return this.page.getByTestId('step-current');
  }

  get nextButton(): Locator {
    return this.page.getByTestId('btn-next');
  }

  get prevButton(): Locator {
    return this.page.getByTestId('btn-prev');
  }

  get submitButton(): Locator {
    return this.page.getByTestId('btn-submit');
  }

  get result(): Locator {
    return this.page.getByTestId('submit-result');
  }

  addButton(array: CreditArrayKey): Locator {
    return this.page.getByTestId(`btn-add-${array}`);
  }

  removeButton(array: CreditArrayKey, index: number): Locator {
    return this.page.getByTestId(`btn-remove-${array}-${index}`);
  }

  /** Строки массива на экране — по кнопкам «Удалить». */
  rows(array: CreditArrayKey): Locator {
    return this.page.locator(`[data-testid^="btn-remove-${array}-"]`);
  }

  // ── Страница и __bench ──
  url(params: Record<string, string> = {}): string {
    const q = new URLSearchParams(params).toString();
    return `/${this.lib}/credit/${q ? `?${q}` : ''}`;
  }

  async goto(params: Record<string, string> = {}): Promise<void> {
    await this.page.goto(this.url(params));
    await this.page.evaluate(() => (window as unknown as BenchWindow).__bench.ready);
    await this.idle();
  }

  idle(): Promise<number> {
    return this.page.evaluate(() => (window as unknown as BenchWindow).__bench.idle());
  }

  calls(): Promise<Record<string, number>> {
    return this.page.evaluate(() => ({ ...(window as unknown as BenchWindow).__bench.api.calls }));
  }

  submissions(): Promise<unknown[]> {
    return this.page.evaluate(() => [...(window as unknown as BenchWindow).__bench.submissions]);
  }

  /** Все показанные ошибки: путь DOM-контракта → текст. */
  async errors(): Promise<Record<string, string>> {
    return this.page.evaluate(() => {
      const out: Record<string, string> = {};
      for (const el of document.querySelectorAll<HTMLElement>('[data-testid^="error-"]')) {
        out[el.dataset.testid!.slice('error-'.length)] = el.textContent ?? '';
      }
      return out;
    });
  }

  /** Номер текущего шага (`data-step`). */
  async step(): Promise<number> {
    return Number(await this.stepIndicator.getAttribute('data-step'));
  }

  /** Значения опций Select (включая пустую `''`). */
  options(path: string): Promise<string[]> {
    return this.input(path)
      .locator('option')
      .evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
  }

  // ── Навигация ──
  async next(): Promise<void> {
    await this.nextButton.click();
    await this.idle();
  }

  async prev(): Promise<void> {
    await this.prevButton.click();
    await this.idle();
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
    await this.idle();
  }

  async blur(): Promise<void> {
    await this.page.getByRole('heading', { level: 1 }).click();
  }

  async add(array: CreditArrayKey): Promise<void> {
    await this.addButton(array).click();
    await this.idle();
  }

  async remove(array: CreditArrayKey, index: number): Promise<void> {
    await this.removeButton(array, index).click();
    await this.idle();
  }

  // ── Ввод ──
  /** Посимвольный ввод: настоящие keydown/input, как у пользователя. */
  async type(path: string, text: string, opts: { clear?: boolean } = {}): Promise<void> {
    const input = this.input(path);
    await input.click();
    if (opts.clear) {
      await input.press('ControlOrMeta+a');
      await input.press('Backspace');
    }
    if (text) await input.pressSequentially(text, { delay: 20 });
  }

  /** Записать значение поля так, как это сделал бы пользователь (контрол — из `CREDIT_FIELDS`). */
  async set(path: string, value: unknown): Promise<void> {
    const meta = fieldMeta(path);
    const text = value == null ? '' : String(value);
    switch (meta.control) {
      case 'text':
      case 'email':
      case 'textarea':
      case 'number':
        return this.type(path, text, { clear: true });
      case 'masked':
        return this.type(path, maskDigits(text, meta.mask ?? ''), { clear: true });
      case 'date':
        return this.input(path).fill(text);
      case 'select':
        // Опции городов и моделей приходят из API после смены региона/марки.
        if (meta.optionsFrom === 'cities' || meta.optionsFrom === 'carModels') await this.idle();
        await this.input(path).selectOption(text);
        return;
      case 'radio':
        return this.radio(path, text).check();
      case 'checkbox':
        return this.input(path).setChecked(value === true);
    }
  }

  /**
   * Заполнить шаг `n` значениями `v` на свежей форме: видимые поля, чьё значение отличается от
   * начального, в порядке экрана (управляющие раньше зависимых); строки массивов — «Добавить».
   */
  async fillStep(n: number, v: CreditInput): Promise<void> {
    const arrays = new Set<string>();
    for (const path of CREDIT_STEPS[n - 1].fields) {
      if (!isVisible(path, v)) continue;
      if (path === 'emailAdditional' && v.sameEmail) continue; // копия email, только чтение
      if (path.includes('[]')) {
        const array = topKey(path) as CreditArrayKey;
        if (!arrays.has(array)) await this.fillArray(array, v);
        arrays.add(array);
        continue;
      }
      const value = getIn(v, path);
      if (value === getIn(CREDIT_INITIAL_INPUT, path)) continue;
      await this.set(path, value);
    }
    await this.idle();
  }

  /** Строки массива: первая появляется от флага (он раньше в порядке шага), остальные — «Добавить». */
  async fillArray(array: CreditArrayKey, v: CreditInput): Promise<void> {
    const rows = v[array] as unknown[];
    const empty = CREDIT_ARRAYS[array].empty();
    const rowFields = CREDIT_STEPS[4].fields
      .filter((f) => f.startsWith(`${array}[]`))
      .map((f) => f.slice(`${array}[].`.length));
    for (let i = 0; i < rows.length; i++) {
      if (i > 0) await this.add(array);
      for (const rest of rowFields) {
        const value = getIn(rows[i], rest);
        if (value !== getIn(empty, rest)) await this.set(`${array}.${i}.${rest}`, value);
      }
    }
  }

  // ── Проверка значений ──
  /** Значение поля на экране по его контролу (радио — отмеченная опция, чекбокс — `checked`). */
  async expectValue(path: string, value: unknown): Promise<void> {
    const meta = fieldMeta(path);
    if (meta.control === 'radio') await expect(this.radio(path, String(value))).toBeChecked();
    else if (meta.control === 'checkbox') {
      if (value === true) await expect(this.input(path)).toBeChecked();
      else await expect(this.input(path)).not.toBeChecked();
    } else await expect(this.input(path)).toHaveValue(value == null ? '' : String(value));
  }

  /**
   * Форма на шаге `n` и показывает значения `v`: видимые поля равны, скрытых нет в DOM, у массивов
   * столько строк, сколько в `v`. Скопированный `emailAdditional` — равен `email`.
   */
  async expectStep(n: number, v: CreditInput): Promise<void> {
    await expect(this.stepIndicator).toHaveAttribute('data-step', String(n));
    const arrays = new Set<CreditArrayKey>();
    for (const path of CREDIT_STEPS[n - 1].fields) {
      if (path.includes('[]')) {
        arrays.add(topKey(path) as CreditArrayKey);
        continue;
      }
      if (!isVisible(path, v)) await expect(this.field(path)).toHaveCount(0);
      else
        await this.expectValue(
          path,
          path === 'emailAdditional' && v.sameEmail ? v.email : getIn(v, path)
        );
    }
    for (const array of arrays) {
      const rows = isVisible(array, v) ? (v[array] as unknown[]) : [];
      await expect(this.rows(array)).toHaveCount(rows.length);
      const rowFields = CREDIT_STEPS[4].fields
        .filter((f) => f.startsWith(`${array}[]`))
        .map((f) => f.slice(`${array}[].`.length));
      for (let i = 0; i < rows.length; i++) {
        for (const rest of rowFields)
          await this.expectValue(`${array}.${i}.${rest}`, getIn(rows[i], rest));
      }
    }
  }

  /** Заполнить шаги 1…n−1 и пройти «Далее» на каждом: форма на шаге `n`. */
  async goToStep(n: number, v: CreditInput): Promise<void> {
    for (let s = 1; s < n; s++) {
      await this.fillStep(s, v);
      await this.next();
      const now = await this.step();
      if (now !== s + 1) {
        throw new Error(
          `шаг ${s}: «Далее» не сработал, ошибки ${JSON.stringify(await this.errors())}`
        );
      }
    }
  }
}
