/**
 * Профилирование кредитной заявки: один e2e-тест, внутри — пользовательский сценарий по фазам
 * (BENCH-CONTRACT §6, план docs/plans/reformer-crispy-gem.md §3). Ипотека, самозанятый, все три
 * массива — самый «тяжёлый» путь спеки.
 *
 * Измеряемые фазы — сырой ввод (клик по координатам, клавиши; поле ввода фокусируется
 * `locator.focus()` — одинаковая для всех короткая команда, зато не зависит от сдвигов вёрстки).
 * Даты, select и радио, которые в фазах не меряются, заполняет POM вне окна замера. Мастер, массивы
 * и списки участник ведёт своей разметкой и драйвером (lib/kit.ts): у страниц библиотек — разметка
 * бенчмарка и нативный `<select>`, у стеков набора `frameworks` — киты. После каждой
 * фазы — проверочные ворота; сбой прогона пишется в runs.ndjson и не останавливает остальные. В
 * начале и в конце прогона — калибровочная нагрузка (lib/calibration.ts) вне фаз.
 */
import { test, type Browser, type Locator } from '@playwright/test';
import { benchConfig, createShuffler } from '../../lib/config';
import { participants, type Participant } from '../../lib/participants';
import { ResultsWriter } from '../../lib/results';
import { BenchSession, type Mode } from '../../lib/session';
import { calibrationRecord, type CalibrationSample } from '../../lib/calibration';
import { preflight, startBackgroundSample } from '../../lib/background';
import { driverOf, markupOf } from '../../lib/kit';
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
  const markup = markupOf(s.info.lib);
  const current = await markup.currentStep(s.page).getAttribute(markup.stepNumberAttribute);
  if (current !== String(step)) throw new Error(`ожидался шаг ${step}, на экране ${current}`);
};

/** Строк массива на экране — по разметке участника (у китов единственная строка без «Удалить»). */
const rowsGate = (s: BenchSession, array: string, n: number) =>
  countGate(s, markupOf(s.info.lib).rows(s.page, array), n, `строк массива ${array}`);

const countGate =
  (s: BenchSession, target: string | Locator, n: number, what: string) => async () => {
    const count = await (typeof target === 'string' ? s.page.locator(target) : target).count();
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
  const markup = markupOf(s.info.lib);
  const driver = driverOf(s.info.lib);
  const pom = new CreditPage(s.page, lib, driver, markup);
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
      // Нативный `<select>` — один выбор; список кита — открыть панель и выбрать пункт.
      await driver.select(
        { page: s.page, id: 'loanType', input: s.page.getByTestId('input-loanType') },
        'mortgage'
      );
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
    rowsGate(s, 'properties', 1)
  );
  const add = await s.centerOf(markup.addButton(s.page, 'properties'));
  await s.phase(
    'array-add',
    async () => {
      // Кнопка «Добавить» под строками и съезжает: первый раз — клик, дальше Enter на ней же.
      await s.click(add);
      for (let i = 2; i < ROWS; i++) await s.press('Enter', benchConfig.cadenceMs);
    },
    rowsGate(s, 'properties', ROWS)
  );
  await s.phase('array-type-last', async () => {
    await typeInto(s, `properties.${ROWS - 1}.description`, 'Garage');
  });
  const remove = await s.centerOf(markup.removeButton(s.page, 'properties', ROWS - 1));
  await s.phase('array-remove', () => s.click(remove), rowsGate(s, 'properties', ROWS - 1));
  at = await s.centers(['input-hasProperty']);
  await s.phase(
    'array-toggle-off',
    () => s.click(at['input-hasProperty']),
    rowsGate(s, 'properties', 0)
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
  // Калибровка скорости машины: до первой фазы и после последней, вне трассы (lib/calibration.ts).
  let calStart: CalibrationSample | null = null;
  let calEnd: CalibrationSample | null = null;
  // Фоновая нагрузка за прогон: снимки процессов в точках калибровки (lib/background.ts).
  let sampler: ReturnType<typeof startBackgroundSample> | null = null;
  try {
    session = await BenchSession.open(browser, info, writer, baseURL);
    sampler = startBackgroundSample();
    calStart = await session.calibrate('start');
    if (mode === 'trace') {
      await browser.startTracing(session.page, { path: writer.tracePath(`${lib.id}-${FORM}`) });
      tracing = true;
    }
    await creditFlow(session);
    if (tracing) {
      await browser.stopTracing();
      tracing = false;
    }
    if (lib.role !== 'baseline') {
      // Загрузка с данными — в новом context; конец калибровки — в нём, после последней фазы.
      await session.close();
      session = await BenchSession.open(browser, info, writer, baseURL);
      await applicationFlow(session);
    }
    calEnd = await session.calibrate('end');
    const background = sampler.finish();
    await session.close();
    session = null;
    const calibration = calibrationRecord(calStart, calEnd);
    const ms = Date.now() - started;
    writer.run({ ...info, lib: lib.id, ok: true, ms, calibration, background });
  } catch (error) {
    const calibration = calibrationRecord(calStart, calEnd);
    const background = sampler?.finish() ?? null;
    const ms = Date.now() - started;
    writer.run({
      ...info,
      lib: lib.id,
      ok: false,
      error: String(error),
      ms,
      calibration,
      background,
    });
    console.error(`✗ ${lib.id} ${mode} cpu${cpu} #${iteration}: ${String(error)}`);
  } finally {
    if (tracing) await browser.stopTracing().catch(() => {});
    await session?.close().catch(() => {});
  }
}

test('кредитная заявка: профилирование всех участников', async ({ browser, baseURL }) => {
  const libs = participants(FORM);
  if (libs.length === 0) test.skip(true, 'нет собранных страниц кредитной заявки');
  // Пред-проверка фоновой нагрузки: предупреждение, а с BENCH_REQUIRE_IDLE=1 — отказ до замеров.
  const idle = await preflight();
  if (benchConfig.requireIdle && idle?.dirty) {
    throw new Error(`BENCH_REQUIRE_IDLE=1: машина занята — ${idle.reasons.join('; ')}`);
  }
  const writer = ResultsWriter.create(FORM);
  await writer.writeEnv(browser, benchConfig, FORM, idle);
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
    // Счётчик рендеров — только у участников, где он есть (хук React DevTools).
    for (const lib of libs.filter((l) => l.renders !== false)) {
      await runOnce(browser, url, writer, lib, 1, 'renders', 0, false);
    }
  }
  if (benchConfig.trace) {
    for (const lib of libs) {
      await runOnce(browser, url, writer, lib, benchConfig.cpuRates[0] ?? 1, 'trace', 0, false);
    }
  }
  writer.finish();
  test.info().annotations.push({ type: 'results', description: writer.dir });
});
