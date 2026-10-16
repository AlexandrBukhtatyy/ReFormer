// @vitest-environment happy-dom
/**
 * Заявка на кредит в React: ядро, собранное оболочкой фикстуры (`fixtures/loan-application/react.tsx`).
 *
 * Хуки по отдельности проверены в `tests/hooks/` и `tests/i18n/*.dom.test.tsx`; здесь — то, что
 * видно, когда они работают вместе на настоящей форме с поведением, правилами и потоком шагов:
 * - сборка: фабрика бандла зовётся один раз на монтирование, компоненты получают бандл из
 *   `FormBundleContext`, в StrictMode оболочка работает на одной сборке;
 * - точечные ререндеры (счётчики рендеров оболочки): правка поля рисует его компонент и только
 *   тех, кто зависит от значения; новая строка массива рисует список, а не прежние строки;
 * - поток: «Далее» проверяет шаг, ждёт async-правило и рисует следующий шаг; все семь шагов
 *   рисуются; отказ ставит фокус на первое поле с ошибкой — через ref узла схемы
 *   (`render.controller.scopeOf(…).node(…).getRef()`) и `useFieldHandleRef`;
 * - живая проверка: своя проверка шага (`useFormValidation`) и стратегия самой сборки, которую
 *   армирует `useFormBundle`;
 * - управление узлами: `setHidden`, `resetProps`, область над хранилищем строки
 *   (`createSchemaScope`) перерисовывают только свой узел;
 * - язык: смена локали и загрузка языка провайдером переводят показанные замечания без повторной
 *   проверки; словарь формы в оболочке; замечание-предупреждение;
 * - размонтирование снимает подписки компонентов. Поведение формы при этом остаётся живым — это
 *   известный дефект ReFormer-8el5, он закреплён в `tests/hooks/use-form-bundle.test.tsx`.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import {
  createSchemaScope,
  type CompiledArrayNode,
  type CompiledSchema,
  type FormBundle,
  type SchemaNodeId,
} from '../../src/index';
import type { ValidationDefinition } from '../../src/form/validation/index';
import {
  createLocaleLoader,
  fetchMessages,
  msg,
  type FormLocale,
  type IssueMessages,
  type LocaleLoad,
} from '../../src/i18n';
import { loadCoreLocale } from '../../src/locale/index';
import { useFormBundleContext, useFormValidation, type FieldHandle } from '../../src/react';
import { settle } from '../test-utils/async';
import { disposeForm } from '../test-utils/dispose-form';
import { liveEffects } from '../test-utils/effect-tracker';
import { issueCodes } from '../test-utils/issues';
import { StrictWrapper, act, cleanup, fireEvent, render, screen } from '../test-utils/react';
import {
  VALID_INN,
  addCoBorrower,
  fillApplicantStep,
  fillEmploymentStep,
  fillLoanStep,
  passWizardTo,
} from './fixtures/loan-application/actions';
import { createLoanServer } from './fixtures/loan-application/api';
import { annuityPayment } from './fixtures/loan-application/behavior';
import {
  createLoanForm,
  type LoanForm,
  type LoanFormOptions,
} from './fixtures/loan-application/create-loan-form';
import { LOAN_STEP_IDS } from './fixtures/loan-application/flow';
import { createLocaleServer } from './fixtures/loan-application/locale-server';
import { loanIssueMessages, loanLocales } from './fixtures/loan-application/messages';
import type { LoanApplication } from './fixtures/loan-application/model';
import { LoanApp, type LoanAppProps } from './fixtures/loan-application/react';
import { createLoanRules } from './fixtures/loan-application/validation';

vi.mock('@preact/signals-core', async (importOriginal) =>
  (await import('../test-utils/effect-tracker')).trackEffects(await importOriginal())
);

// ─── Монтирование и уборка ─────────────────────────────────────────────────────────────────

/** Сборки текущего теста: поведение формы хук не освобождает — его снимает уборка. */
const assembled: LoanForm[] = [];

afterEach(() => {
  cleanup();
  for (const { bundle } of assembled.splice(0)) {
    disposeForm(bundle.form);
    bundle.validation?.controller.dispose();
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Язык оболочки: готовая локаль либо язык и загрузчик. */
type Language = { locale: FormLocale } | { lang: string; load: LocaleLoad };

interface MountOptions {
  readonly loan?: LoanFormOptions;
  readonly strict?: boolean;
  readonly language?: Language;
  readonly issueMessages?: IssueMessages;
  readonly children?: ReactNode;
}

/**
 * Смонтировать заявку: фабрика собирает её внутри `useFormBundle`, счётчик копит рендеры
 * компонентов оболочки по ключам (`field:loan.amount`, `list:coBorrowers`, …).
 */
function mountLoan(options: MountOptions = {}) {
  const built: LoanForm[] = [];
  const factory = vi.fn((): FormBundle<LoanApplication> => {
    const loan = createLoanForm(options.loan);
    built.push(loan);
    assembled.push(loan);
    return loan.bundle;
  });
  const counts = new Map<string, number>();
  const onRender = (key: string): void => void counts.set(key, (counts.get(key) ?? 0) + 1);
  let language: Language = options.language ?? { locale: loanLocales.ru };
  let children = options.children;
  const shell = (props: Partial<LoanAppProps> = {}): ReactNode => (
    <LoanApp
      factory={factory}
      onRender={onRender}
      issueMessages={options.issueMessages}
      {...language}
      {...props}
    >
      {children}
    </LoanApp>
  );
  const view = render(shell(), options.strict === true ? { wrapper: StrictWrapper } : {});
  const [loan] = built;
  return {
    ...loan,
    built,
    factory,
    view,
    /** Сколько раз отрисован каждый компонент с последнего `resetRenders`. */
    renders: (): Record<string, number> => Object.fromEntries(counts),
    resetRenders: (): void => counts.clear(),
    /** Перерисовать оболочку с другим языком, содержимым или пропсами. */
    update(next: { language?: Language; children?: ReactNode; props?: Partial<LoanAppProps> }) {
      if (next.language !== undefined) language = next.language;
      if ('children' in next) children = next.children;
      view.rerender(shell(next.props));
    },
  };
}

/**
 * Действие пользователя или сценария и всё, что оно разбудило: отложенные записи поведения,
 * проверка шага, ререндеры.
 */
async function perform(action: () => unknown): Promise<void> {
  await act(async () => {
    await action();
    await settle();
  });
}

const input = (path: string): HTMLInputElement => screen.getByTestId<HTMLInputElement>(path);
const button = (name: string): HTMLButtonElement =>
  screen.getByRole<HTMLButtonElement>('button', { name });
const type = (path: string, value: string): boolean =>
  fireEvent.change(input(path), { target: { value } });
const currentStep = (): string | undefined => screen.getByTestId('loan-wizard').dataset.step;
const alerts = (): Array<string | null> =>
  screen.queryAllByRole('alert').map((alert) => alert.textContent);
const textOf = (testId: string): string | null => screen.getByTestId(testId).textContent;

/** Узел массива созаёмщиков в скомпилированной схеме заявки. */
const coBorrowersNode = (bundle: FormBundle<LoanApplication>): CompiledArrayNode =>
  (bundle.render.tree as CompiledSchema).nodes.get(
    'co-borrowers-list' as SchemaNodeId
  ) as CompiledArrayNode;

// ─── Сборка ────────────────────────────────────────────────────────────────────────────────

/** Бандлы, которые компонент под оболочкой получил из контекста сборки, — по рендерам. */
const seenInContext: Array<FormBundle<LoanApplication> | null> = [];

function ContextProbe(): ReactNode {
  seenInContext.push(useFormBundleContext<LoanApplication>());
  return null;
}

describe('оболочка заявки — сборка бандла', () => {
  afterEach(() => {
    seenInContext.length = 0;
  });

  it('RA-01: фабрика зовётся один раз — ререндеры и новая фабрика сборку не повторяют', async () => {
    const app = mountLoan({ children: <ContextProbe /> });
    const otherFactory = vi.fn(() => createLoanForm().bundle);

    await perform(() => type('loan.purpose', 'Ремонт кухни'));
    app.update({ language: { locale: loanLocales.en } });
    app.update({ props: { factory: otherFactory } });

    expect(app.factory).toHaveBeenCalledTimes(1);
    expect(otherFactory).not.toHaveBeenCalled();
    // Компоненты под оболочкой видят ту же сборку, а введённое пережило ререндеры.
    expect(seenInContext.length).toBeGreaterThan(0);
    expect(seenInContext.every((seen) => seen === app.bundle)).toBe(true);
    expect(app.bundle.model.loan.purpose).toBe('Ремонт кухни');
    expect(input('loan.purpose').value).toBe('Ремонт кухни');
  });

  it('RA-02: StrictMode — оболочка работает на первой сборке и не пересобирает её', async () => {
    const app = mountLoan({ strict: true, children: <ContextProbe /> });
    // Ограничение StrictMode, описанное в JSDoc useFormBundle [ReFormer-0f7y]: React зовёт
    // ленивый инициализатор `useState` дважды, поэтому фабрика на монтирование вызвана два раза.
    // Вторую сборку React выбрасывает: до пользователя она не доходит, но её поведение живо.
    expect(app.factory).toHaveBeenCalledTimes(2);
    const [kept, discarded] = app.built;

    await perform(() => type('loan.purpose', 'Ремонт кухни'));
    app.update({ language: { locale: loanLocales.en } });

    expect(app.factory).toHaveBeenCalledTimes(2);
    expect(seenInContext.length).toBeGreaterThan(0);
    expect(seenInContext.every((seen) => seen === kept.bundle)).toBe(true);
    expect(kept.bundle.model.loan.purpose).toBe('Ремонт кухни');
    expect(discarded.bundle.model.loan.purpose).toBe('');
    expect(input('loan.purpose').value).toBe('Ремонт кухни');
  });
});

// ─── Точечные ререндеры ────────────────────────────────────────────────────────────────────

describe('оболочка заявки — точечные ререндеры', () => {
  it('RA-03: правка поля рисует его компонент и только тех, кто зависит от значения', async () => {
    const app = mountLoan();
    await perform(() => fillLoanStep(app.bundle.model));
    app.resetRenders();

    await perform(() => type('loan.purpose', 'Ремонт кухни'));
    expect(app.renders()).toEqual({ 'field:loan.purpose': 1 });

    app.resetRenders();
    await perform(() => type('loan.amount', '600000'));
    // От суммы зависят платёж (производное поле в шапке) и текст сводки шага.
    expect(app.renders()).toEqual({
      'field:loan.amount': 1,
      payment: 1,
      'text:loan-estimate': 1,
    });
    const payment = annuityPayment(600_000, 36, 15.9);
    expect(app.bundle.model.loan.amount).toBe(600_000);
    expect(textOf('payment')).toBe(String(payment));
    expect(textOf('text:loan-estimate')).toBe(
      `Ставка 15.9% годовых, платёж ${payment.toLocaleString('ru-RU')} ₽ в месяц`
    );
  });

  it('RA-04: useArrayLength — новая строка рисует список, а не прежние строки', async () => {
    const app = mountLoan();
    const rows = app.bundle.form.coBorrowers;
    await perform(() => passWizardTo(app.bundle, 'co-borrowers'));
    // Без отметки «Есть созаёмщики» список скрыт поведением.
    expect(screen.queryByTestId('list:coBorrowers')).toBeNull();
    await perform(() => fireEvent.click(input('hasCoBorrowers')));
    await perform(() => fireEvent.click(button('+ Созаёмщик')));
    const firstRow = rows.keyAt(0);
    app.resetRenders();

    await perform(() => fireEvent.click(button('+ Созаёмщик')));

    const afterRow = app.renders();
    expect(rows.length).toBe(2);
    expect(afterRow['list:coBorrowers']).toBe(1);
    expect(afterRow[`row:${rows.keyAt(1)}`]).toBe(1);
    // Прежняя строка и её поля не тронуты; шапка, навигация и сам визард — тоже.
    expect(afterRow[`row:${firstRow}`]).toBeUndefined();
    expect(Object.keys(afterRow).filter((key) => key.includes('coBorrowers.0.'))).toEqual([]);
    expect(Object.keys(afterRow).filter((key) => key.includes('wizard'))).toEqual([]);

    // Вложенный массив: телефон первой строки рисует только её список телефонов.
    app.resetRenders();
    await perform(() => fireEvent.click(screen.getAllByRole('button', { name: '+ Телефон' })[0]));
    const phones = rows.at(0)!.phones;
    expect(Object.keys(app.renders()).sort()).toEqual(
      [
        'field:coBorrowers.0.phones.0.number',
        'list:coBorrowers.0.phones',
        `row:${phones.keyAt(0)}`,
      ].sort()
    );

    // Отметку сняли: поведение очищает массив и прячет список.
    await perform(() => fireEvent.click(input('hasCoBorrowers')));
    expect(rows.length).toBe(0);
    expect(screen.queryByTestId('list:coBorrowers')).toBeNull();
  });

  it('RA-05: повторная проверка без правок — поля без замечаний не тронуты, с замечаниями рисуются заново', async () => {
    const app = mountLoan();
    await perform(() => fireEvent.click(button('Далее')));
    expect(alerts()).toHaveLength(4);
    app.resetRenders();

    await perform(() => fireEvent.click(button('Далее')));

    const fields = Object.fromEntries(
      Object.entries(app.renders()).filter(([key]) => /^(field|issue):/.test(key))
    );
    // поведение под вопросом: каждая проверка создаёт новые объекты замечаний, поэтому поэлементное
    // сравнение `issues` в `useFormControl` спасает от ререндера только поля без замечаний (вид
    // кредита, промокод). Поля с прежними замечаниями и их тексты рисуются заново, хотя на
    // экране ничего не изменилось; при живой проверке так происходит на каждую правку любого поля.
    expect(fields).toEqual({
      'field:loan.amount': 1,
      'issue:loan.amount': 1,
      'field:loan.term': 1,
      'issue:loan.term': 1,
      'field:loan.purpose': 1,
      'issue:loan.purpose': 1,
      'field:loan.firstPaymentDate': 1,
      'issue:loan.firstPaymentDate': 1,
    });
  });
});

// ─── Поток шагов ───────────────────────────────────────────────────────────────────────────

describe('оболочка заявки — поток шагов', () => {
  it('RA-06: useFormFlow — «Далее» проверяет шаг, ждёт async-правило и рисует следующий шаг', async () => {
    const server = createLoanServer({ manual: ['checkInn'] });
    const app = mountLoan({ loan: { server } });
    await perform(() => fillLoanStep(app.bundle.model));

    await perform(() => fireEvent.click(button('Далее')));
    expect(currentStep()).toBe('applicant');
    expect(screen.queryByTestId('loan.amount')).toBeNull();
    expect(button('Назад').disabled).toBe(false);

    await perform(() => fillApplicantStep(app.bundle.model));
    await perform(() => fireEvent.click(button('Далее')));
    // Сервер ещё не ответил про ИНН: шаг прежний, повторный переход заблокирован.
    expect(currentStep()).toBe('applicant');
    expect(button('Далее').disabled).toBe(true);
    expect(server.last('checkInn').args[0]).toBe(VALID_INN);

    await perform(() => server.last('checkInn').resolve({ status: 'found' }));
    expect(currentStep()).toBe('contacts');
    expect(button('Далее').disabled).toBe(false);

    await perform(() => fireEvent.click(button('Назад')));
    expect(currentStep()).toBe('applicant');
    expect(input('applicant.lastName').value).toBe('Иванов');
  });

  it('RA-07: проход визарда — оболочка рисует каждый шаг, на шаге проверки — данные заявки', async () => {
    const warn = vi.spyOn(console, 'warn');
    const error = vi.spyOn(console, 'error');
    const app = mountLoan();
    const drawn: Array<string | undefined> = [currentStep()];

    for (const step of LOAN_STEP_IDS.slice(1)) {
      await perform(() => passWizardTo(app.bundle, step));
      drawn.push(currentStep());
    }

    expect(drawn).toEqual(LOAN_STEP_IDS);
    // Шаг проверки: текст из сигналов модели и литералов, поле, выключенное схемой, край потока.
    expect(textOf('text:review-summary')).toBe('Иванов Иван Иванович: 500000 ₽ на 36 мес.');
    expect(screen.getByText('Решение — в течение 3 рабочих дней')).toBeDefined();
    expect(input('applicationNumber').disabled).toBe(true);
    expect(button('Далее').disabled).toBe(true);

    await perform(() => fireEvent.click(button('Назад')));
    // Документы: поля-массивы целиком, строка массива с шаблоном из схемы, флажки.
    expect([textOf('documents'), textOf('interests')]).toEqual(['2', '1']);
    expect(input('references.0.name').value).toBe('Петров Пётр');
    expect(input('consent.personalData').checked).toBe(true);
    // Телефон для кода подписи синхронизирован поведением с контактным.
    expect(input('consent.smsPhone').value).toBe('+79001234567');
    expect([warn.mock.calls, error.mock.calls]).toEqual([[], []]);
  });

  it('RA-08: неудачная проверка шага — фокус на первом поле с ошибкой в порядке схемы', async () => {
    const app = mountLoan();

    await perform(() => fireEvent.click(button('Далее')));
    expect(currentStep()).toBe('loan');
    expect(document.activeElement).toBe(input('loan.amount'));
    expect(textOf('issue:loan.amount')).toBe('Укажите сумму кредита');

    // Сумма исправлена — фокус уходит на следующее по схеме поле с ошибкой.
    await perform(() => {
      type('loan.amount', '500000');
      type('loan.purpose', 'Ремонт квартиры');
    });
    await perform(() => fireEvent.click(button('Далее')));
    expect(document.activeElement).toBe(input('loan.term'));
    expect(app.bundle.flow?.current.value).toBe('loan');
  });

  it('RA-09: ошибка в строке массива — handle поля живёт в области строки и переживает сдвиг строк', async () => {
    const app = mountLoan();
    const { model, render: schema } = app.bundle;
    await perform(async () => {
      await passWizardTo(app.bundle, 'co-borrowers');
      addCoBorrower(model);
      addCoBorrower(model, { fullName: '' });
    });
    const row = model.coBorrowers.at(1);
    const fullName = input('coBorrowers.1.fullName');
    // Узел поля в схеме строки — по ручке модели; его handle — в области этой строки.
    const field = coBorrowersNode(app.bundle).row(row).fields.get(row.$.fullName);
    const handle = schema.controller.scopeOf(row).node(String(field?.id)).getRef<FieldHandle>();
    expect(handle.current?.getElement()).toBe(fullName);

    await perform(() => fireEvent.click(button('Далее')));
    expect(currentStep()).toBe('co-borrowers');
    expect(document.activeElement).toBe(fullName);
    expect(textOf('issue:coBorrowers.1.fullName')).toBe('Укажите ФИО созаёмщика');

    // Первую строку удалили: путь поля стал `coBorrowers.0.fullName`, а handle остался на месте.
    fullName.blur();
    await perform(() => app.bundle.form.coBorrowers.removeAt(0));
    expect(row.$.fullName.__path).toBe('coBorrowers.0.fullName');
    await perform(() => fireEvent.click(button('Далее')));
    expect(document.activeElement).toBe(fullName);
    expect(handle.current?.getElement()).toBe(fullName);
  });
});

// ─── Живая проверка ────────────────────────────────────────────────────────────────────────

/** Панель сценария: своя проверка шага поверх сборки — `useFormValidation` с живой стратегией. */
function LiveStepCheck({ rules }: { rules: ValidationDefinition<LoanApplication> }): ReactNode {
  const bundle = useFormBundleContext<LoanApplication>();
  if (bundle === null) throw new Error('панель проверки стоит вне оболочки');
  const { submit, isValidating } = useFormValidation({
    model: bundle.model,
    schema: rules,
    strategy: 'change',
  });
  return (
    <p>
      <output data-testid="live-check">{isValidating ? 'проверяем' : 'готово'}</output>
      <button type="button" onClick={() => void submit()}>
        Проверить шаг
      </button>
    </p>
  );
}

describe('оболочка заявки — живая проверка', () => {
  it('RA-10: живая проверка шага — правка запускает правила, ответ сервера виден текстом', async () => {
    const server = createLoanServer({ manual: ['checkInn'] });
    // Свои правила шага над тем же сервером: ссылка стабильна — правила собраны один раз.
    const rules = createLoanRules(server.api).applicant;
    const app = mountLoan({ loan: { server }, children: <LiveStepCheck rules={rules} /> });
    await perform(() => passWizardTo(app.bundle, 'applicant'));
    expect([textOf('live-check'), server.callsOf('checkInn')]).toEqual(['готово', []]);

    await perform(() => type('applicant.inn', VALID_INN));
    expect(textOf('live-check')).toBe('проверяем');
    expect(server.callsOf('checkInn')).toHaveLength(1);

    await perform(() => server.last('checkInn').resolve({ status: 'not-found' }));
    expect(textOf('live-check')).toBe('готово');
    // Живая проверка поля не раскрывает: замечание видно только у изменённого ИНН.
    expect(alerts()).toEqual([`ИНН ${VALID_INN} не найден в реестре налоговой`]);

    // Проверка по кнопке раскрывает замечания всех полей шага.
    await perform(() => fireEvent.click(button('Проверить шаг')));
    await perform(() => server.last('checkInn').resolve({ status: 'found' }));
    expect(alerts()).toEqual([
      'Обязательное поле',
      'Обязательное поле',
      'Укажите дату рождения',
      'Обязательное поле',
      'Обязательное поле',
      'Обязательное поле',
      'Обязательное поле',
    ]);

    // Панель размонтирована — её стратегия снята: правки больше ничего не проверяют.
    app.update({ children: null });
    const checks = server.callsOf('checkInn').length;
    await perform(() => type('applicant.inn', '500100732260'));
    expect(server.callsOf('checkInn')).toHaveLength(checks);
  });

  it('RA-11: стратегию самой сборки армирует useFormBundle — правка проверяется сразу, размонтирование её снимает', async () => {
    const app = mountLoan({ loan: { strategy: 'change' } });
    const amount = app.bundle.form.loan.amount;

    await perform(() => type('loan.amount', '20000'));
    // Живой прогон полей не раскрывает: из всех замечаний формы видно одно — у изменённого поля.
    expect(alerts()).toEqual(['Сумма — не меньше 30000 ₽']);
    expect(app.bundle.form.valid.value).toBe(false);

    await perform(() => type('loan.amount', '500000'));
    expect(alerts()).toEqual([]);

    app.view.unmount();
    await perform(() => void (app.bundle.model.loan.amount = 1_000));
    // Стратегия снята вместе с оболочкой: запись в модель больше ничего не проверяет.
    expect(issueCodes(amount)).toEqual([]);
  });
});

// ─── Управление узлами схемы ───────────────────────────────────────────────────────────────

describe('оболочка заявки — управление узлами схемы', () => {
  it('RA-12: render.node — setHidden главнее hideWhen и рисует только свой узел', async () => {
    const app = mountLoan();
    await perform(() => {});
    // Потребительский кредит: секцию залога прячет поведение.
    expect(screen.queryByTestId('node:mortgage')).toBeNull();
    app.resetRenders();

    act(() => void app.bundle.render.node('mortgage').setHidden(false));
    expect(screen.getByTestId('node:mortgage')).toBeDefined();
    // Видимость — узла, доступность — поля: залог вне ипотеки выключен поведением.
    expect(input('loan.propertyValue').disabled).toBe(true);
    expect(app.renders()).toEqual({
      'node:#/mortgage': 1,
      'field:loan.propertyValue': 1,
      'field:loan.initialPayment': 1,
    });

    act(() => void app.bundle.render.node('mortgage').resetHidden());
    expect(screen.queryByTestId('node:mortgage')).toBeNull();

    // Ипотека: условие поведения открывает секцию, а принудительное скрытие всё равно главнее.
    await perform(() => void (app.bundle.model.loan.type = 'mortgage'));
    expect(input('loan.propertyValue').disabled).toBe(false);
    act(() => void app.bundle.render.node('mortgage').setHidden(true));
    expect(screen.queryByTestId('node:mortgage')).toBeNull();
  });

  it('RA-13: поведение под вопросом [ReFormer-5jew]: принудительно скрытая секция остаётся в проверке шага — отказ без замечаний на экране', async () => {
    const app = mountLoan();
    await perform(() => fillLoanStep(app.bundle.model, { type: 'mortgage' }));
    act(() => void app.bundle.render.node('mortgage').setHidden(true));

    await perform(() => fireEvent.click(button('Далее')));

    // поведение под вопросом: `setHidden` прячет узел, но поля его не выключает — правила шага их
    // проверяют. Пользователь получает отказ перехода, а замечаний на экране нет и фокусу идти
    // некуда: видимость и доступность автор обязан менять вместе (`hideWhen` + `enableWhen`).
    expect(currentStep()).toBe('loan');
    expect(issueCodes(app.bundle.form.loan.propertyValue)).toEqual(['loan.propertyValue.required']);
    expect(alerts()).toEqual([]);
    expect(document.activeElement).toBe(document.body);

    // Секцию вернули — замечания её полей уже раскрыты той проверкой.
    act(() => void app.bundle.render.node('mortgage').resetHidden());
    expect(alerts()).toEqual(['Укажите стоимость недвижимости', 'Укажите первоначальный взнос']);
  });

  it('RA-14: render.node — resetProps снимает подмешанное; живое поведение подмешивает снова', async () => {
    const app = mountLoan();
    await perform(() => {});
    expect([textOf('wizard-title'), textOf('wizard-progress')]).toEqual(['Новая заявка', '0 %']);
    app.resetRenders();

    act(() => void app.bundle.render.node('wizard').resetProps());
    expect([textOf('wizard-title'), textOf('wizard-progress')]).toEqual(['', '']);
    expect(app.renders()).toEqual({ 'wizard-header': 1 });

    // Заполненность считает пользовательский оператор — он подмешивает её при следующей правке;
    // заголовок ставил `onInit` один раз, при сборке, и сам он не вернётся.
    await perform(() => fillLoanStep(app.bundle.model));
    expect([textOf('wizard-title'), textOf('wizard-progress')]).toEqual(['', '30 %']);
  });

  it('RA-15: createSchemaScope над хранилищем области строки управляет только этой строкой', async () => {
    const app = mountLoan();
    await perform(async () => {
      await passWizardTo(app.bundle, 'co-borrowers');
      addCoBorrower(app.bundle.model, { livesWithApplicant: false });
      addCoBorrower(app.bundle.model, { livesWithApplicant: false });
    });
    const secondRow = app.bundle.model.coBorrowers.at(1);
    const street = (index: number): HTMLElement | null =>
      screen.queryByTestId(`coBorrowers.${index}.address.street`);
    expect([street(0), street(1)]).not.toContain(null);
    app.resetRenders();

    const stored = app.bundle.render.controller.scopeOf(secondRow).__overrideMaps;
    act(() => void createSchemaScope(stored).node('co-borrower-address').setHidden(true));

    expect(street(0)).not.toBeNull();
    expect(street(1)).toBeNull();
    const rowScope = coBorrowersNode(app.bundle).row(secondRow).scope;
    expect(app.renders()).toEqual({ [`node:${rowScope}/co-borrower-address`]: 1 });

    // Область со своим хранилищем со сборкой не связана: рендер её записей не видит.
    act(() => void createSchemaScope().node('co-borrower-address').setHidden(true));
    expect(street(0)).not.toBeNull();
  });
});

// ─── Язык ──────────────────────────────────────────────────────────────────────────────────

describe('оболочка заявки — язык', () => {
  const RUSSIAN = ['Укажите сумму кредита', 'Укажите срок кредита', 'Обязательное поле'];
  const ENGLISH = ['Enter the loan amount', 'Enter the loan term', 'This field is required'];
  /** Замечания незаполненного шага «Кредит»: сумма, срок, цель и дата первого платежа. */
  const shownIssues = (texts: string[]): string[] => [...texts, texts[2]];

  it('RA-16: смена локали I18nProvider переводит показанные замечания — без повторной проверки', async () => {
    const app = mountLoan();
    await perform(() => fireEvent.click(button('Далее')));
    act(
      () => void app.bundle.render.node('wizard').patchProps({ title: msg('loan.wizard.title') })
    );
    expect(alerts()).toEqual(shownIssues(RUSSIAN));
    expect(textOf('wizard-title')).toBe('Заявка на кредит');
    const issues = app.bundle.form.loan.amount.issues.value;
    app.resetRenders();

    app.update({ language: { locale: loanLocales.en } });

    expect(alerts()).toEqual(shownIssues(ENGLISH));
    expect(textOf('wizard-title')).toBe('Loan application');
    expect(button('Next')).toBeDefined();
    // Перерисованы только потребители языка: тексты замечаний, заголовок и кнопки. Поля — нет.
    expect(Object.keys(app.renders()).sort()).toEqual([
      'issue:loan.amount',
      'issue:loan.firstPaymentDate',
      'issue:loan.purpose',
      'issue:loan.term',
      'wizard-header',
      'wizard-navigation',
    ]);
    expect(app.bundle.form.loan.amount.issues.value).toBe(issues);
  });

  it('RA-17: язык грузит провайдер — до ответа сервера на экране прежний язык', async () => {
    const server = createLocaleServer({ manual: true });
    vi.stubGlobal('fetch', server.fetch);
    const load = createLocaleLoader([
      loadCoreLocale,
      fetchMessages((code) => `/locales/${code}.json`),
    ]);
    const preloaded = load.preload('ru');
    server.answer('ru');
    await preloaded;
    const app = mountLoan({ language: { lang: 'ru', load } });
    await perform(() => fireEvent.click(button('Далее')));
    expect(alerts()).toEqual(shownIssues(RUSSIAN));

    app.update({ language: { lang: 'en', load } });
    expect(server.requested).toEqual(['/locales/ru.json', '/locales/en.json']);
    expect(alerts()).toEqual(shownIssues(RUSSIAN));
    expect(button('Далее')).toBeDefined();

    await act(async () => {
      server.answer('en');
      await load('en');
    });
    expect(alerts()).toEqual(shownIssues(ENGLISH));
    expect(button('Next')).toBeDefined();
    expect(app.factory).toHaveBeenCalledTimes(1);
  });

  it('RA-18: словарь формы в оболочке — текст поля из словаря, разряды числа по языку провайдера', async () => {
    const app = mountLoan({ issueMessages: loanIssueMessages });
    await perform(() => fillLoanStep(app.bundle.model, { amount: 20_000 }));
    await perform(() => fireEvent.click(button('Далее')));
    const minimum = (code: string): string =>
      `Минимальная сумма — ${new Intl.NumberFormat(code).format(30_000)} ₽`;
    expect(alerts()).toEqual([minimum('ru')]);

    app.update({ language: { locale: loanLocales.en } });

    // Словарь формы важнее локали: анкета осталась русской, а число отформатировано по-английски.
    expect(alerts()).toEqual([minimum('en')]);
  });
});

// ─── Предупреждение ────────────────────────────────────────────────────────────────────────

describe('оболочка заявки — предупреждение правила', () => {
  /** Заявка с высокой, но допустимой нагрузкой: полная проверка кладёт предупреждение на сумму. */
  async function mountWithDebtWarning() {
    const app = mountLoan();
    await perform(() => {
      fillLoanStep(app.bundle.model);
      fillEmploymentStep(app.bundle.model, { monthlyIncome: 40_000 });
    });
    await perform(() => app.bundle.validate());
    return app;
  }

  it('RA-19: предупреждение доходит до ноды поля — поле остаётся валидным и раскрытым', async () => {
    const { bundle } = await mountWithDebtWarning();
    const amount = bundle.form.loan.amount;

    expect(amount.issues.value).toEqual([
      { code: 'loan.highDebtLoad', severity: 'warning', params: { ratio: 44 } },
    ]);
    expect([amount.valid.value, amount.touched.value]).toEqual([true, true]);
    // Шаг «Кредит» на экране, его поля заполнены верно — ошибок рядом с предупреждением нет.
    expect(input('loan.amount').value).toBe('500000');
    expect(bundle.form.loan.valid.value).toBe(true);
  });

  // Документация обещает: «`severity: 'warning'` показывается, но отправку не блокирует».
  // Было: показ замечания решал `shouldShowError`, а он истинен только у невалидного поля —
  // предупреждение без ошибки рядом пользователь не видел. Тексты показывает `shouldShowIssues`.
  it('RA-20: предупреждение на поле без ошибок видно пользователю [ReFormer-dp34]', async () => {
    await mountWithDebtWarning();

    expect(alerts()).toEqual(['Платёж — 44 % дохода: нагрузка высокая']);
    // Состояния ошибки при этом нет: поле валидно.
    expect(input('loan.amount').getAttribute('aria-invalid')).toBe('false');
  });
});

// ─── Размонтирование ───────────────────────────────────────────────────────────────────────

describe('оболочка заявки — размонтирование', () => {
  it('RA-21: подписки компонентов и сама сборка сняты — правки и проверка никого не перерисовывают', async () => {
    // Счёт — от состояния до сборки: `useFormBundle` владеет сборкой из своей фабрики и снимает
    // её при размонтировании вместе с effect'ами поведения (ReFormer-8el5).
    const empty = liveEffects();
    const loan = createLoanForm();
    assembled.push(loan);
    await settle();
    const base = liveEffects();
    let renders = 0;
    const view = render(
      <LoanApp
        factory={() => loan.bundle}
        locale={loanLocales.ru}
        onRender={() => void renders++}
      />
    );
    await perform(() => fireEvent.click(button('Далее')));
    const { model, render: schema } = loan.bundle;
    const amount = (schema.tree as CompiledSchema).fields.get(model.$.loan.amount);
    const handle = schema.node(String(amount?.id)).getRef<FieldHandle>();
    expect(liveEffects()).toBeGreaterThan(base);
    expect(alerts()).toHaveLength(4);
    expect(handle.current?.getElement()).toBe(document.activeElement);

    view.unmount();
    const rendersAtUnmount = renders;
    await act(async () => {
      fillLoanStep(model);
      schema.node('mortgage').setHidden(false);
      await loan.bundle.validate();
      await settle();
    });

    expect(liveEffects()).toBe(empty);
    expect(renders).toBe(rendersAtUnmount);
    expect(handle.current).toBeNull();
  });

  it('RA-22: размонтирование во время проверки шага — проверка отменена, ответ сервера никого не будит', async () => {
    const error = vi.spyOn(console, 'error');
    const server = createLoanServer({ manual: ['checkInn'] });
    const app = mountLoan({ loan: { server } });
    await perform(async () => {
      await passWizardTo(app.bundle, 'applicant');
      fillApplicantStep(app.bundle.model);
    });
    await perform(() => fireEvent.click(button('Далее')));
    expect(app.bundle.flow?.validating.value).toBe(true);

    app.view.unmount();
    app.resetRenders();
    await perform(() => server.last('checkInn').resolve({ status: 'not-found' }));

    // Размонтирование сняло сборку, а снятие отменяет идущую проверку шага (`cancelled`): шаг
    // прежний, проверка не идёт, и запоздалый ответ сервера на ноды ничего не кладёт.
    expect(app.bundle.flow?.current.value).toBe('applicant');
    expect(app.bundle.flow?.validating.value).toBe(false);
    expect(issueCodes(app.bundle.form.applicant.inn)).toEqual([]);
    expect(app.renders()).toEqual({});
    expect(error).not.toHaveBeenCalled();
  });
});
