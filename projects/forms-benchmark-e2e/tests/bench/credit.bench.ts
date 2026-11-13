/**
 * Профилирование кредитной заявки: один e2e-тест, внутри — пользовательский сценарий по фазам
 * (BENCH-CONTRACT §6, план docs/plans/reformer-crispy-gem.md §3). Ипотека, самозанятый, все три
 * массива — самый «тяжёлый» путь спеки.
 *
 * Измеряемые фазы — сырой ввод (клик по координатам, клавиши; поле ввода фокусируется
 * `locator.focus()` — одинаковая для всех короткая команда, зато не зависит от сдвигов вёрстки).
 * Даты, select и радио, которые в фазах не меряются, заполняет POM вне окна замера. После каждой
 * фазы — проверочные ворота; сбой прогона пишется в runs.ndjson и не останавливает остальные.
 */
import { test, type Browser } from '@playwright/test';
import { benchConfig, createShuffler } from '../../lib/config';
import { participants, type Participant } from '../../lib/participants';
import { ResultsWriter } from '../../lib/results';
import { BenchSession, type Mode } from '../../lib/session';
import { CreditPage, MORTGAGE, SMS_VALID_CODE, maskDigits } from '../../pom/credit';
import { toDomPath } from '../../../forms-benchmark/src/shared/domain/credit';

const FORM = 'credit' as const;
const V = MORTGAGE;
/** Строк в фазе масштабирования массива (BENCH_ROWS). */
const ROWS = Number(process.env.BENCH_ROWS ?? 10) || 10;

async function shownErrors(s: BenchSession): Promise<string[]> {
  return s.page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-testid^="error-"]')].map((el) =>
      el.dataset.testid!.slice(6)
    )
  );
}

const errorsGate = (s: BenchSession, phase: string, expected: string[]) => async () => {
  const got = (await shownErrors(s)).sort().join(',');
  const want = expected.map(toDomPath).sort().join(',');
  if (got !== want) throw new Error(`${phase}: ошибки [${got}], ожидались [${want}]`);
};

const stepGate = (s: BenchSession, step: number) => async () => {
  const current = await s.page.getAttribute('[data-testid="step-current"]', 'data-step');
  if (current !== String(step)) throw new Error(`ожидался шаг ${step}, на экране ${current}`);
};

const countGate = (s: BenchSession, selector: string, n: number, what: string) => async () => {
  const count = await s.page.locator(selector).count();
  if (count !== n) throw new Error(`${what}: ${count}, ожидалось ${n}`);
};

/** Фокус на поле и посимвольный ввод; `clear` — выделить всё перед вводом. */
async function typeInto(s: BenchSession, path: string, text: string, clear = false): Promise<void> {
  await s.page.getByTestId(`input-${toDomPath(path)}`).focus();
  if (clear) await s.press('ControlOrMeta+A', benchConfig.cadenceMs);
  await s.type(text, benchConfig.cadenceMs);
}

async function next(s: BenchSession, name: string, toStep: number): Promise<void> {
  const at = await s.centers(['btn-next']);
  await s.phase(name, () => s.click(at['btn-next']), stepGate(s, toStep));
}

async function creditFlow(s: BenchSession): Promise<void> {
  const lib = s.info.lib.id;
  const pom = new CreditPage(s.page, lib);
  await s.load('load', `/${lib}/${FORM}/`);

  if (s.info.lib.role === 'baseline') {
    // Нижняя граница: набор в неуправляемые поля той же разметки и перемонтирование.
    await s.phase('step1-typing', async () => {
      await typeInto(s, 'loanAmount', String(V.loanAmount));
      await typeInto(s, 'loanPurpose', V.loanPurpose);
    });
    await s.remount('remount', benchConfig.remounts);
    return;
  }

  // ── Шаг 1 ──
  let at = await s.centers(['btn-next']);
  await s.phase(
    'next-invalid',
    () => s.click(at['btn-next']),
    errorsGate(s, 'next-invalid', ['loanAmount', 'loanPurpose'])
  );
  await s.phase(
    'loan-type',
    async () => {
      await s.page.selectOption('[data-testid="input-loanType"]', 'mortgage');
    },
    countGate(s, '[data-testid="field-propertyValue"]', 1, 'поле стоимости недвижимости')
  );
  await s.phase(
    'step1-typing',
    async () => {
      await typeInto(s, 'loanAmount', String(V.loanAmount));
      await typeInto(s, 'loanTerm', String(V.loanTerm), true);
      await typeInto(s, 'loanPurpose', V.loanPurpose);
      await typeInto(s, 'propertyValue', String(V.propertyValue));
    },
    errorsGate(s, 'step1-typing', [])
  );
  await next(s, 'next-1', 2);

  // ── Шаг 2 ──
  await s.phase('step2-typing', async () => {
    await typeInto(s, 'personalData.lastName', V.personalData.lastName);
    await typeInto(s, 'personalData.firstName', V.personalData.firstName);
    await typeInto(s, 'personalData.middleName', V.personalData.middleName);
    await typeInto(s, 'passportData.series', maskDigits(V.passportData.series, '99 99'));
    await typeInto(s, 'passportData.number', V.passportData.number);
    await typeInto(s, 'inn', V.inn);
  });
  await pom.fillStep(2, V);
  await next(s, 'next-2', 3);

  // ── Шаг 3 ──
  await s.phase('step3-typing', async () => {
    await typeInto(s, 'phoneMain', maskDigits(V.phoneMain, '+7 (999) 999-99-99'));
    await typeInto(s, 'email', V.email);
    await typeInto(s, 'registrationAddress.street', V.registrationAddress.street);
    await typeInto(s, 'registrationAddress.postalCode', V.registrationAddress.postalCode);
  });
  await pom.fillStep(3, V);
  await next(s, 'next-3', 4);

  // ── Шаг 4 ──
  at = await s.centers(['input-employmentStatus-selfEmployed']);
  await s.phase(
    'employment-switch',
    () => s.click(at['input-employmentStatus-selfEmployed']),
    countGate(s, '[data-testid="field-businessType"]', 1, 'поле типа бизнеса')
  );
  await s.phase('step4-typing', async () => {
    await typeInto(s, 'workExperienceTotal', String(V.workExperienceTotal));
    await typeInto(s, 'workExperienceCurrent', String(V.workExperienceCurrent));
    await typeInto(s, 'monthlyIncome', String(V.monthlyIncome));
    await typeInto(s, 'additionalIncome', String(V.additionalIncome));
  });
  await pom.fillStep(4, V);
  await next(s, 'next-4', 5);

  // ── Шаг 5: масштаб массива ──
  at = await s.centers(['input-hasProperty']);
  await s.phase(
    'array-toggle-on',
    () => s.click(at['input-hasProperty']),
    countGate(s, '[data-testid^="btn-remove-properties-"]', 1, 'строк имущества')
  );
  at = await s.centers(['btn-add-properties']);
  await s.phase(
    'array-add',
    async () => {
      // Кнопка «Добавить» под строками и съезжает: первый раз — клик, дальше Enter на ней же.
      await s.click(at['btn-add-properties']);
      for (let i = 2; i < ROWS; i++) await s.press('Enter', benchConfig.cadenceMs);
    },
    countGate(s, '[data-testid^="btn-remove-properties-"]', ROWS, 'строк имущества')
  );
  await s.phase('array-type-last', async () => {
    await typeInto(s, `properties.${ROWS - 1}.description`, 'Garage');
  });
  at = await s.centers([`btn-remove-properties-${ROWS - 1}`]);
  await s.phase(
    'array-remove',
    () => s.click(at[`btn-remove-properties-${ROWS - 1}`]),
    countGate(s, '[data-testid^="btn-remove-properties-"]', ROWS - 1, 'строк имущества')
  );
  at = await s.centers(['input-hasProperty']);
  await s.phase(
    'array-toggle-off',
    () => s.click(at['input-hasProperty']),
    countGate(s, '[data-testid^="btn-remove-properties-"]', 0, 'строк имущества')
  );
  await pom.fillStep(5, V);
  await next(s, 'next-5', 6);

  // ── Шаг 6 ──
  await pom.fillStep(6, { ...V, electronicSignature: '' });
  await s.phase(
    'sms-type',
    async () => {
      await typeInto(s, 'electronicSignature', SMS_VALID_CODE);
    },
    errorsGate(s, 'sms-type', [])
  );
  at = await s.centers(['btn-submit']);
  await s.phase(
    'submit-valid',
    () => s.click(at['btn-submit']),
    async () => {
      const n = await s.page.evaluate(
        () =>
          (window as unknown as { __bench: { submissions: unknown[] } }).__bench.submissions.length
      );
      if (n !== 1) throw new Error(`submit-valid: заявок ${n}`);
      await countGate(s, '[data-testid="submit-result"]', 1, 'подтверждение')();
    }
  );

  await s.remount('remount', benchConfig.remounts);
}

/** Загрузка сохранённой заявки — отдельный context: гидратация формы данными. */
async function applicationFlow(s: BenchSession): Promise<void> {
  await s.load('load-application', `/${s.info.lib.id}/${FORM}/?application=1`);
}

async function runOnce(
  browser: Browser,
  baseURL: string,
  writer: ResultsWriter,
  lib: Participant,
  cpu: number,
  mode: Mode,
  iteration: number,
  warmup: boolean
): Promise<void> {
  const info = { lib, form: FORM, cpu, mode, iteration, warmup };
  const started = Date.now();
  let session: BenchSession | null = null;
  let tracing = false;
  try {
    session = await BenchSession.open(browser, info, writer, baseURL);
    if (mode === 'trace') {
      await browser.startTracing(session.page, { path: writer.tracePath(`${lib.id}-${FORM}`) });
      tracing = true;
    }
    await creditFlow(session);
    if (tracing) {
      await browser.stopTracing();
      tracing = false;
    }
    await session.close();
    session = null;
    if (lib.role !== 'baseline') {
      session = await BenchSession.open(browser, info, writer, baseURL);
      await applicationFlow(session);
    }
    writer.run({ ...info, lib: lib.id, ok: true, ms: Date.now() - started });
  } catch (error) {
    writer.run({ ...info, lib: lib.id, ok: false, error: String(error), ms: Date.now() - started });
    console.error(`✗ ${lib.id} ${mode} cpu${cpu} #${iteration}: ${String(error)}`);
  } finally {
    if (tracing) await browser.stopTracing().catch(() => {});
    await session?.close().catch(() => {});
  }
}

test('кредитная заявка: профилирование всех участников', async ({ browser, baseURL }) => {
  const libs = participants(FORM);
  if (libs.length === 0) test.skip(true, 'нет собранных страниц кредитной заявки');
  const writer = ResultsWriter.create(FORM);
  await writer.writeEnv(browser, benchConfig, FORM);
  const shuffle = createShuffler(benchConfig.seed);
  const url = baseURL!;
  const total = benchConfig.warmup + benchConfig.iterations;
  console.log(
    `results → ${writer.dir}; участники: ${libs.map((l) => l.id).join(', ')}; строк: ${ROWS}`
  );

  for (const cpu of benchConfig.cpuRates) {
    for (let i = 0; i < total; i++) {
      const warmup = i < benchConfig.warmup;
      for (const lib of shuffle(libs))
        await runOnce(browser, url, writer, lib, cpu, 'timing', i, warmup);
      console.log(`cpu ${cpu}x: прогон ${i + 1}/${total}${warmup ? ' (прогрев)' : ''}`);
    }
  }
  if (benchConfig.renders) {
    for (const lib of libs) await runOnce(browser, url, writer, lib, 1, 'renders', 0, false);
  }
  if (benchConfig.trace) {
    for (const lib of libs) {
      await runOnce(browser, url, writer, lib, benchConfig.cpuRates[0] ?? 1, 'trace', 0, false);
    }
  }
  test.info().annotations.push({ type: 'results', description: writer.dir });
});
