/**
 * Профилирование формы регистрации: один e2e-тест, внутри — пользовательский сценарий по фазам
 * (BENCH-CONTRACT §6, план docs/plans/reformer-crispy-gem.md §3).
 *
 * Порядок: итерации × участники (перемешаны сидом на каждой итерации) × профили CPU; затем проход
 * подсчёта рендеров (CPU 1x) и трассируемый прогон на участника. Каждый прогон — новый browser
 * context; в начале и в конце прогона — калибровочная нагрузка (lib/calibration.ts) вне фаз. После
 * каждой фазы — проверочные ворота вне окна замера: сломанная реализация не может «выглядеть
 * быстрой». Сбой прогона записывается в runs.ndjson и не останавливает остальные.
 */
import { test, type Browser } from '@playwright/test';
import { benchConfig, createShuffler } from '../../lib/config';
import { participants, type Participant } from '../../lib/participants';
import { ResultsWriter } from '../../lib/results';
import { BenchSession, type Mode } from '../../lib/session';
import { calibrationRecord, type CalibrationSample } from '../../lib/calibration';
import { preflight, startBackgroundSample } from '../../lib/background';
import { VALID } from '../../pom/registration';

const FORM = 'registration' as const;

interface Globals {
  __bench: {
    submissions: unknown[];
    api: { peekCaptcha(): string; calls: Record<string, number> };
  };
}

async function shownErrors(s: BenchSession): Promise<Record<string, string>> {
  return s.page.evaluate(() => {
    const out: Record<string, string> = {};
    for (const el of document.querySelectorAll<HTMLElement>('[data-testid^="error-"]')) {
      out[el.dataset.testid!.slice(6)] = el.textContent ?? '';
    }
    return out;
  });
}

function expectKeys(phase: string, actual: Record<string, string>, expected: string[]): void {
  const got = Object.keys(actual).sort().join(',');
  const want = [...expected].sort().join(',');
  if (got !== want) throw new Error(`${phase}: ошибки [${got}], ожидались [${want}]`);
}

const errorsGate = (s: BenchSession, phase: string, expected: string[]) => async () =>
  expectKeys(phase, await shownErrors(s), expected);

async function registrationFlow(s: BenchSession): Promise<void> {
  const { cadenceMs: cadence, remounts } = benchConfig;
  const baseline = s.info.lib.role === 'baseline';
  const lib = s.info.lib.id;

  await s.load('load', `/${lib}/${FORM}/`);

  // Набор до первой отправки: тихая фаза.
  let at = await s.centers(['input-username']);
  await s.phase(
    'typing-pristine',
    async () => {
      await s.click(at['input-username']);
      await s.type(VALID.username, cadence);
      await s.press('Tab', cadence);
      await s.type(VALID.email, cadence);
    },
    baseline ? undefined : errorsGate(s, 'typing-pristine', [])
  );

  if (!baseline) {
    at = await s.centers(['btn-submit']);
    await s.phase(
      'submit-invalid',
      () => s.click(at['btn-submit']),
      errorsGate(s, 'submit-invalid', [
        'password',
        'confirmPassword',
        'fullName',
        'phone',
        'captcha',
        'acceptTerms',
      ])
    );
  }

  // Набор в живой фазе: каждое изменение перепроверяет форму.
  at = await s.centers(['input-password']);
  await s.phase(
    'typing-live',
    async () => {
      await s.click(at['input-password']);
      await s.type(VALID.password, cadence);
      await s.press('Tab', cadence);
      await s.type(VALID.confirmPassword, cadence);
      await s.press('Tab', cadence);
      await s.type(VALID.fullName, cadence);
      await s.press('Tab', cadence);
      await s.type(VALID.phoneDigits, cadence);
    },
    baseline ? undefined : errorsGate(s, 'typing-live', ['captcha', 'acceptTerms'])
  );

  if (!baseline) {
    at = await s.centers(['input-username']);
    await s.phase(
      'async-taken',
      async () => {
        await s.click(at['input-username']);
        await s.press('ControlOrMeta+A', cadence);
        await s.type('johndoe', cadence);
      },
      async () => {
        const errors = await shownErrors(s);
        if (errors.username !== 'Имя уже занято') {
          throw new Error(`async-taken: username="${errors.username ?? ''}"`);
        }
      }
    );

    await s.phase(
      'async-fix',
      async () => {
        await s.click(at['input-username']);
        await s.press('ControlOrMeta+A', cadence);
        await s.type(VALID.username, cadence);
      },
      errorsGate(s, 'async-fix', ['captcha', 'acceptTerms'])
    );

    at = await s.centers(['captcha-refresh']);
    await s.phase('captcha-refresh', () => s.click(at['captcha-refresh']));

    const answer = await s.page.evaluate(() =>
      (window as unknown as Globals).__bench.api.peekCaptcha()
    );
    at = await s.centers(['input-captcha']);
    await s.phase(
      'captcha-type',
      async () => {
        await s.click(at['input-captcha']);
        await s.type(answer, cadence);
      },
      errorsGate(s, 'captcha-type', ['acceptTerms'])
    );

    at = await s.centers(['input-acceptTerms']);
    await s.phase('terms', () => s.click(at['input-acceptTerms']), errorsGate(s, 'terms', []));

    at = await s.centers(['btn-submit']);
    await s.phase(
      'submit-valid',
      () => s.click(at['btn-submit']),
      async () => {
        const submitted = await s.page.evaluate(() => [
          ...(window as unknown as Globals).__bench.submissions,
        ]);
        const expected = {
          username: VALID.username,
          email: VALID.email,
          password: VALID.password,
          fullName: VALID.fullName,
          phone: VALID.phone,
          captcha: answer,
          acceptTerms: true,
        };
        if (JSON.stringify(submitted) !== JSON.stringify([expected])) {
          throw new Error(`submit-valid: payload ${JSON.stringify(submitted)}`);
        }
        if (!(await s.page.getByTestId('submit-result').count())) {
          throw new Error('submit-valid: нет submit-result');
        }
      }
    );
  }

  await s.remount('remount', remounts);
}

/** Загрузка по приглашению — отдельный context: гидратация формы данными. */
async function inviteFlow(s: BenchSession): Promise<void> {
  await s.load('load-invite', `/${s.info.lib.id}/${FORM}/?invite=welcome`);
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
    await registrationFlow(session);
    if (tracing) {
      await browser.stopTracing();
      tracing = false;
    }
    if (lib.role !== 'baseline') {
      // Загрузка с данными — в новом context; конец калибровки — в нём, после последней фазы.
      await session.close();
      session = await BenchSession.open(browser, info, writer, baseURL);
      await inviteFlow(session);
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

test('регистрация: профилирование всех участников', async ({ browser, baseURL }) => {
  const libs = participants(FORM);
  if (libs.length === 0) test.skip(true, 'нет собранных страниц регистрации');
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
  console.log(`results → ${writer.dir}; участники: ${libs.map((l) => l.id).join(', ')}`);

  for (const cpu of benchConfig.cpuRates) {
    for (let i = 0; i < total; i++) {
      const warmup = i < benchConfig.warmup;
      for (const lib of shuffle(libs)) {
        await runOnce(browser, url, writer, lib, cpu, 'timing', i, warmup);
      }
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
  writer.finish();
  test.info().annotations.push({ type: 'results', description: writer.dir });
});
