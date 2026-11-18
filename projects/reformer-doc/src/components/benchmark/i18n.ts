/**
 * Подписи из данных бенчмарка на английском. Заголовки фаз, подписи метрик и пояснения в данных —
 * русские (их пишет отчёт, metrics.mjs); для локали en здесь словарь по id фазы и метрики. Чего в
 * словаре нет (новая фаза или метрика), показывается по-русски — лучше, чем пусто или чужая подпись.
 */
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import type { BenchForm, FormId, PhaseKind } from './types';

/** Заголовки фаз: `<форма>/<id фазы>`, затем общий `<id фазы>`. */
const PHASES_EN: Record<string, string> = {
  load: 'Cold load',
  remount: 'Form remount',
  'registration/load-invite': 'Load by invitation (hydration with a prefill)',
  'registration/typing-pristine': 'Typing before the first submit (username, email)',
  'registration/submit-invalid': 'Submit with errors → errors on screen',
  'registration/typing-live': 'Typing after submit — live validation (password, name, phone)',
  'registration/async-taken': 'Taken username: typing → server error',
  'registration/async-fix': 'Fixing the username: typing → error cleared',
  'registration/captcha-refresh': 'Captcha refresh',
  'registration/captcha-type': 'Typing the captcha with a server check',
  'registration/terms': 'Terms checkbox',
  'registration/submit-valid': 'Successful submit',
  'credit/load-application': 'Loading a saved application (hydration with data)',
  'credit/next-invalid': '“Next” on an empty step 1 → errors',
  'credit/loan-type': 'Loan type → mortgage: conditional fields and rate',
  'credit/step1-typing': 'Step 1: amount, term, purpose, price (live validation, computed fields)',
  'credit/next-1': 'Go to step 2',
  'credit/step2-typing': 'Step 2: full name, passport, tax ID (masks)',
  'credit/next-2': 'Go to step 3',
  'credit/step3-typing': 'Step 3: phone, email, address',
  'credit/next-3': 'Go to step 4',
  'credit/employment-switch': 'Employment status → sole proprietor: sections swap',
  'credit/step4-typing': 'Step 4: work experience and income (cross-field rules, payment ratio)',
  'credit/next-4': 'Go to step 5',
  'credit/array-toggle-on': 'Property array: switch on (first row)',
  'credit/array-add': 'Property array: add rows up to N',
  'credit/array-type-last': 'Property array: typing in the last row',
  'credit/array-remove': 'Property array: remove the last row',
  'credit/array-toggle-off': 'Property array: switch off (clear)',
  'credit/next-5': 'Go to step 6',
  'credit/sms-type': 'SMS code with a server check',
  'credit/submit-valid': 'Submitting the application',
};

/** Подписи метрик: `<тип фазы>/<id метрики>` (одна метрика в разных типах фаз меряет разное). */
const METRICS_EN: Record<string, string> = {
  'load/ready': 'Form ready (from navigation start)',
  'load/fcp': 'First Contentful Paint',
  'load/hydrate': 'Hydration: prefill response → ready',
  'load/script': 'JS execution (CDP ScriptDuration)',
  'load/tbt': 'Total Blocking Time',
  'load/heap': 'JS heap after GC',
  'load/nodes': 'DOM nodes',
  'typing/keyProc': 'Key → end of processing (median)',
  'typing/keyProcP95': 'Key → end of processing (p95 of a run)',
  'typing/keyFrame': 'Key → end of frame (median)',
  'typing/scriptPerKey': 'JS per key (CDP)',
  'typing/layoutPerKey': 'Layout + style per key',
  'typing/slowEvents': 'Events ≥ 16 ms (Event Timing)',
  'typing/tbt': 'Total Blocking Time',
  'click/clickFrame': 'Click → end of frame',
  'click/settle': 'Click → UI settled',
  'click/script': 'JS execution (CDP)',
  'click/layout': 'Layout + style',
  'async/settle': 'Typing → UI settled (incl. 300 ms debounce and 20 ms network)',
  'async/keyProc': 'Key → end of processing (median)',
  'async/script': 'JS execution over the phase (CDP)',
  'remount/mountSync': 'Mount: render + commit + effects',
  'remount/mountReady': 'Mount: until the frame with the ready form',
  'remount/scriptPerCycle': 'JS per mount + unmount cycle (CDP)',
  'remount/retainedPerCycle': 'Objects retained after unmount',
  'remount/heapGrowth': 'Heap growth per remount after warm-up (incl. JIT code)',
  'remount/nodesSlope': 'DOM node growth per remount',
};

/** Пояснения под фазами — по точному русскому тексту: изменённый текст покажется как есть. */
const NOTES_EN: Record<string, string> = {
  'Перед замером — перемонтирования прогрева без записи: в первые десятки циклов кучу растит код движка (байт-код, векторы обратной связи, оптимизированный код) у всех участников, даже у пустой страницы. «Удержание объектов» — прирост живых объектов страницы между снимками кучи до и после серии, без кода JIT: утечка — когда он больше нуля. «Рост heap» — наклон кучи после прогрева вместе с кодом JIT: движок оптимизирует код и дальше, это не утечка.':
    'Before measuring, the form is remounted for warm-up without recording: in the first few dozen cycles the heap grows with engine code (bytecode, feedback vectors, optimized code) for every participant, even the empty page. “Objects retained” is the growth of live page objects between heap snapshots before and after the series, without JIT code: a leak is when it is above zero. “Heap growth” is the heap slope after warm-up together with JIT code: the engine keeps optimizing code, which is not a leak.',
  '«UI затих» — последнее изменение DOM. Formik и RHF прогоняют синхронные правила вместе с серверной проверкой и снимают ошибку только по её ответу; RJSF и ReFormer снимают синхронную ошибку сразу. Если по ответу сервера DOM не меняется, фаза затихает раньше.':
    '“UI settled” is the last DOM change. Formik and RHF run the synchronous rules together with the server check and clear the error only on its response; RJSF and ReFormer clear the synchronous error at once. If the DOM does not change on the server response, the phase settles earlier.',
  'Formik валидирует с первой клавиши, включая серверные проверки (submitCount скрывает только показ ошибок, см. README Formik), поэтому проверяет код ещё до первой отправки; остальные — при отправке.':
    'Formik validates from the first keystroke, server checks included (submitCount only hides the errors, see the Formik README), so it checks the code before the first submit; the others check it on submit.',
};

const UNITS_EN: Record<string, string> = { мс: 'ms', КБ: 'KB', 'КБ/цикл': 'KB/cycle', шт: '' };

const FORMS_EN: Record<FormId, string> = {
  registration: 'registration with a captcha',
  credit: 'credit application',
};

export interface BenchText {
  isEn: boolean;
  formTitle: (form: { id: FormId; title?: string }) => string;
  phaseTitle: (form: BenchForm | FormId, phase: string, fallback: string) => string;
  metricLabel: (form: BenchForm, kind: PhaseKind, metric: string) => string;
  /** Единица метрики для подписи (пустая строка — без единицы). */
  unit: (unit: string) => string;
  note: (text: string) => string;
}

export function useBenchText(): BenchText {
  const { i18n } = useDocusaurusContext();
  const isEn = i18n.currentLocale === 'en';
  return {
    isEn,
    formTitle: (form) => (isEn ? FORMS_EN[form.id] : (form.title ?? form.id)),
    phaseTitle: (form, phase, fallback) => {
      if (!isEn) return fallback;
      const id = typeof form === 'string' ? form : form.id;
      return PHASES_EN[`${id}/${phase}`] ?? PHASES_EN[phase] ?? fallback;
    },
    metricLabel: (form, kind, metric) => {
      const ru = form.metrics[`${kind}/${metric}`]?.label ?? metric;
      return isEn ? (METRICS_EN[`${kind}/${metric}`] ?? ru) : ru;
    },
    unit: (unit) => (unit === 'шт' ? (isEn ? '' : 'шт') : isEn ? (UNITS_EN[unit] ?? unit) : unit),
    note: (text) => (isEn ? (NOTES_EN[text] ?? text) : text),
  };
}
