/**
 * Демо форм бенчмарка «ReFormer в React, Vue и Angular»: слева код формы и живые значения модели с
 * состоянием, справа сама форма — prod-сборка страницы стека, та же, что идёт в замеры
 * (`projects/forms-benchmark/scripts/build-frameworks.mjs`), в `iframe`.
 *
 * Значения и состояние страница формы присылает сама (`?demo`, мост
 * `projects/forms-benchmark/src/shared/harness/demo-bridge.ts`): `postMessage` с
 * `source: 'reformer-demo'` — `state` после изменений и `height` при смене высоты; на `hello`
 * присылает их заново. Страницы форм — на Pages рядом с сайтом (`/benchmark-apps/`, deploy-docs.yml),
 * на разработке — демо-сборка в `dist/demo/` (`npm run demo:build -w forms-benchmark`) на сервере
 * forms-benchmark (`npm run serve -w forms-benchmark`, порт 4180). Страницы для замеров моста не
 * содержат: он есть только в сборке с `--demo`.
 */
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Translate, { translate } from '@docusaurus/Translate';
import useBaseUrl from '@docusaurus/useBaseUrl';
import CodeBlock from '@theme/CodeBlock';
import IconExternalLink from '@theme/Icon/ExternalLink';
import {
  type DemoFormId,
  type DemoStackId,
  type SharedTab,
  type SourceFile,
  SHARED,
  STACK,
} from './sources';

import styles from './FrameworksDemo.module.css';

const SOURCE = 'reformer-demo';
const REPO_BLOB = 'https://github.com/AlexandrBukhtatyy/ReFormer/blob/develop/';
/** Высота `iframe`, пока страница формы не прислала свою. */
const DEFAULT_HEIGHT = 900;
/** Сколько ждать первого сообщения страницы формы, прежде чем показать подсказку. */
const CONNECT_TIMEOUT_MS = 10_000;

interface DemoIssue {
  path: string;
  code: string;
  severity: 'error' | 'warning';
}

interface DemoFormState {
  valid: boolean;
  invalid: boolean;
  pending: boolean;
  validating: boolean;
  dirty: boolean;
  touched: boolean;
  submitting: boolean;
  step: { id: string; index: number; total: number; completed: string[] } | null;
}

interface DemoSnapshot {
  values: unknown;
  state: DemoFormState;
  issues: DemoIssue[];
}

const FORMS: DemoFormId[] = ['registration', 'credit'];
const STACKS: DemoStackId[] = ['react', 'vue', 'angular'];

const STACK_LABEL: Record<DemoStackId, { name: string; kit: string }> = {
  react: { name: 'React', kit: '@reformer/ui-kit' },
  vue: { name: 'Vue', kit: 'Vuetify' },
  angular: { name: 'Angular', kit: 'Taiga UI' },
};

/** Предзаполнение — параметры страниц форм: по приглашению и сохранённая заявка. */
const PREFILL_QUERY: Record<DemoFormId, string> = {
  registration: 'invite=welcome',
  credit: 'application=1',
};

function formTitle(form: DemoFormId): string {
  return form === 'registration'
    ? translate({ id: 'benchmark.demo.form.registration', message: 'Регистрация' })
    : translate({ id: 'benchmark.demo.form.credit', message: 'Кредитная заявка' });
}

function sharedTabTitle(id: SharedTab['id']): string {
  switch (id) {
    case 'document':
      return translate({ id: 'benchmark.demo.tab.document', message: 'Документ формы' });
    case 'assembly':
      return translate({ id: 'benchmark.demo.tab.assembly', message: 'Сборка формы' });
    case 'rules':
      return translate({ id: 'benchmark.demo.tab.rules', message: 'Правила' });
    case 'behavior':
      return translate({ id: 'benchmark.demo.tab.behavior', message: 'Поведение' });
  }
}

/** Адрес страниц форм: на разработке — сервер forms-benchmark, в сборке — рядом с сайтом. */
function useAppsBase(): string {
  const published = useBaseUrl('/benchmark-apps/');
  return process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:4180/demo/' : published;
}

/** Смена адреса страницы своим `replaceState` — событие для подписчиков на него. */
const SEARCH_EVENT = 'frameworks-demo:search';

function subscribeSearch(onChange: () => void): () => void {
  window.addEventListener('popstate', onChange);
  window.addEventListener(SEARCH_EVENT, onChange);
  return () => {
    window.removeEventListener('popstate', onChange);
    window.removeEventListener(SEARCH_EVENT, onChange);
  };
}

const pick = <T extends string>(value: string | null, allowed: readonly T[], fallback: T): T =>
  value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;

/**
 * Выбор формы и стека — в адресе страницы, чтобы ссылкой можно было поделиться. На сервере адреса
 * нет: страница собирается с выбором по умолчанию, и после гидрации React перечитывает адрес.
 */
function useSelection(): {
  form: DemoFormId;
  stack: DemoStackId;
  select: (next: { form?: DemoFormId; stack?: DemoStackId }) => void;
} {
  const search = useSyncExternalStore(
    subscribeSearch,
    () => window.location.search,
    () => ''
  );
  const params = new URLSearchParams(search);
  const form = pick(params.get('form'), FORMS, 'registration');
  const stack = pick(params.get('stack'), STACKS, 'react');
  const select = useCallback((next: { form?: DemoFormId; stack?: DemoStackId }) => {
    const updated = new URLSearchParams(window.location.search);
    if (next.form) updated.set('form', next.form);
    if (next.stack) updated.set('stack', next.stack);
    window.history.replaceState(null, '', `${window.location.pathname}?${updated.toString()}`);
    window.dispatchEvent(new Event(SEARCH_EVENT));
  }, []);
  return { form, stack, select };
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: ReactNode }>;
  onChange: (value: T) => void;
}): ReactNode {
  // Группа кнопок Infima: выбранная — `button--active`, контраст текста тема держит сама.
  return (
    <div className={styles.segmented}>
      <span className={styles.segmentedLabel} aria-hidden="true">
        {label}
      </span>
      <div className={clsx('button-group', styles.group)} role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            className={clsx(
              'button button--sm button--outline button--primary',
              styles.segment,
              o.value === value && 'button--active'
            )}
            aria-pressed={o.value === value}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function FileBlock({ file }: { file: SourceFile }): ReactNode {
  return (
    <div className={styles.file}>
      <div className={styles.fileHead}>
        <code className={styles.filePath}>{file.path}</code>
        <Link href={REPO_BLOB + file.path} className={styles.fileLink}>
          GitHub
          <IconExternalLink />
        </Link>
      </div>
      <CodeBlock language={file.language} className={styles.code}>
        {file.code.trimEnd()}
      </CodeBlock>
    </div>
  );
}

/**
 * Панель слева: первая вкладка — живые модель и состояние формы, дальше — её код: общий у трёх
 * стеков и обвязка выбранного стека.
 */
function SidePanel({
  form,
  stack,
  snapshot,
}: {
  form: DemoFormId;
  stack: DemoStackId;
  snapshot: DemoSnapshot | null;
}): ReactNode {
  const shared = SHARED[form];
  const [tab, setTab] = useState<string>('model');
  // У регистрации нет вкладки «Поведение»: при смене формы выбранная вкладка может пропасть.
  const active =
    tab === 'model' || tab === 'stack' || shared.some((t) => t.id === tab) ? tab : 'model';
  const tabs = [
    {
      id: 'model',
      title: translate({ id: 'benchmark.demo.model.title', message: 'Модель и состояние' }),
    },
    ...shared.map((t) => ({ id: t.id as string, title: sharedTabTitle(t.id) })),
    {
      id: 'stack',
      title: translate(
        { id: 'benchmark.demo.tab.stack', message: 'Обвязка: {stack}' },
        { stack: STACK_LABEL[stack].name }
      ),
    },
  ];
  const sharedTab = shared.find((t) => t.id === active);
  return (
    <section className={clsx(styles.panel, styles.sidePanel)}>
      <div
        className={styles.tabs}
        role="tablist"
        aria-label={translate({ id: 'benchmark.demo.code.label', message: 'Модель и код формы' })}
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={t.id === active}
            className={clsx(styles.tab, t.id === active && styles.tabActive)}
            onClick={() => setTab(t.id)}
          >
            {t.title}
          </button>
        ))}
      </div>
      {active !== 'model' && (
        <p className={styles.panelNote}>
          {active === 'stack' ? (
            <Translate id="benchmark.demo.code.stackNote">
              Своё у стека: реестр компонентов кита под именами каталога и вход страницы — оболочка,
              кнопки, монтирование. Документ, сборка и правила формы — общие для трёх стеков.
            </Translate>
          ) : (
            <Translate id="benchmark.demo.code.sharedNote">
              Общее у React, Vue и Angular: этот код не меняется при переключении стека.
            </Translate>
          )}
        </p>
      )}
      <div className={styles.tabScroll} role="tabpanel">
        {active === 'model' ? (
          <ModelView snapshot={snapshot} />
        ) : sharedTab ? (
          <FileBlock file={sharedTab.file} />
        ) : (
          <>
            <FileBlock file={STACK[stack][form]} />
            <FileBlock file={STACK[stack].registry} />
          </>
        )}
      </div>
    </section>
  );
}

function Chip({
  on,
  tone,
  children,
}: {
  on: boolean;
  tone?: 'ok' | 'bad' | 'busy';
  children: ReactNode;
}): ReactNode {
  return (
    <span className={clsx(styles.chip, on && styles.chipOn, on && tone && styles[`chip_${tone}`])}>
      {children}
    </span>
  );
}

/** Вкладка «Модель и состояние»: сигналы формы, замечания правил и значения модели. */
function ModelView({ snapshot }: { snapshot: DemoSnapshot | null }): ReactNode {
  if (!snapshot) {
    return (
      <p className={styles.panelNote}>
        <Translate id="benchmark.demo.model.waiting">Ждём форму…</Translate>
      </p>
    );
  }
  const { state, issues, values } = snapshot;
  // Сигналы как есть: имена — те, что у формы в коде. Тон — только у флагов, где значение
  // само по себе говорит «хорошо/плохо».
  const flags: Array<{ name: string; value: boolean; tone?: 'ok' | 'bad' | 'busy' }> = [
    { name: 'valid', value: state.valid, tone: state.valid ? 'ok' : undefined },
    { name: 'invalid', value: state.invalid, tone: state.invalid ? 'bad' : undefined },
    { name: 'pending', value: state.pending, tone: state.pending ? 'busy' : undefined },
    { name: 'validating', value: state.validating, tone: state.validating ? 'busy' : undefined },
    { name: 'dirty', value: state.dirty },
    { name: 'touched', value: state.touched },
    { name: 'submitting', value: state.submitting, tone: state.submitting ? 'busy' : undefined },
  ];
  return (
    <>
      <h3 className={styles.subTitle}>
        <Translate id="benchmark.demo.state.title">Состояние формы</Translate>
      </h3>
      <div className={styles.chips}>
        {flags.map((f) => (
          <Chip key={f.name} on={f.value} tone={f.tone}>
            <code className={styles.flagName}>{f.name}</code> {String(f.value)}
          </Chip>
        ))}
        {state.step && (
          <Chip on>
            <code className={styles.flagName}>flow.current</code> {state.step.id} ·{' '}
            {state.step.index + 1}/{state.step.total}
          </Chip>
        )}
      </div>
      <p className={styles.panelNote}>
        <Translate id="benchmark.demo.state.note">
          Сигналы формы. Правила молчат до первой попытки отправки (стратегия afterFirstSubmit),
          поэтому valid = true и у пустой формы; после отправки проверка живая.
        </Translate>
      </p>
      <h3 className={styles.subTitle}>
        <Translate id="benchmark.demo.issues.title" values={{ n: issues.length }}>
          {'Замечания правил: {n}'}
        </Translate>
      </h3>
      {issues.length ? (
        <ul className={styles.issues}>
          {issues.map((i, k) => (
            <li
              key={`${i.path}:${i.code}:${k}`}
              className={clsx(i.severity === 'warning' && styles.issueWarning)}
            >
              <code>{i.path}</code> — <code>{i.code}</code>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.panelNote}>
          <Translate id="benchmark.demo.issues.none">Замечаний нет.</Translate>
        </p>
      )}
      <h3 className={styles.subTitle}>
        <Translate id="benchmark.demo.values.title">Значения модели</Translate>
      </h3>
      <CodeBlock language="json" className={styles.code}>
        {JSON.stringify(values, null, 2)}
      </CodeBlock>
    </>
  );
}

export default function FrameworksDemo(): ReactNode {
  const { form, stack, select } = useSelection();
  const [prefill, setPrefill] = useState(false);
  const [reload, setReload] = useState(0);
  const frame = useRef<HTMLIFrameElement>(null);
  const appsBase = useAppsBase();

  const page = `${appsBase}${stack}/${form}/`;
  const src = `${page}?demo${prefill ? `&${PREFILL_QUERY[form]}` : ''}`;
  const pageAlone = prefill ? `${page}?${PREFILL_QUERY[form]}` : page;
  // Ключ показанной страницы формы: всё, что она прислала, привязано к нему. Новая страница —
  // новый ключ, и прежние значения, высота и таймаут к ней просто не относятся.
  const frameKey = `${src}#${reload}`;
  const keyRef = useRef(frameKey);
  useEffect(() => {
    keyRef.current = frameKey;
  }, [frameKey]);

  const [received, setReceived] = useState<{
    key: string;
    snapshot?: DemoSnapshot;
    height?: number;
  } | null>(null);
  const [timedOut, setTimedOut] = useState<string | null>(null);
  const current = received?.key === frameKey ? received : null;
  const snapshot = current?.snapshot ?? null;
  const height = current?.height ?? DEFAULT_HEIGHT;
  const status = snapshot ? 'connected' : timedOut === frameKey ? 'timeout' : 'loading';

  // Страница формы молчит дольше таймаута — показать подсказку.
  useEffect(() => {
    const timer = window.setTimeout(() => setTimedOut(frameKey), CONNECT_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [frameKey]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return;
      const data = event.data as { source?: string; type?: string } | null;
      if (data?.source !== SOURCE) return;
      const key = keyRef.current;
      const merge = (patch: { snapshot?: DemoSnapshot; height?: number }) =>
        setReceived((prev) => ({ ...(prev?.key === key ? prev : {}), key, ...patch }));
      if (data.type === 'state') {
        const { values, state, issues } = data as unknown as DemoSnapshot;
        merge({ snapshot: { values, state, issues } });
      } else if (data.type === 'height') {
        const h = Number((data as { height?: number }).height);
        if (Number.isFinite(h) && h > 0) merge({ height: Math.ceil(h) });
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Страница формы могла прислать первое состояние раньше, чем мы его ждали, — просим заново.
  const onLoad = useCallback(() => {
    frame.current?.contentWindow?.postMessage({ source: SOURCE, type: 'hello' }, '*');
  }, []);

  const formOptions = useMemo(() => FORMS.map((f) => ({ value: f, label: formTitle(f) })), []);
  const stackOptions = STACKS.map((s) => ({
    value: s,
    label: (
      <>
        {STACK_LABEL[s].name}
        <span className={styles.segmentHint}>{STACK_LABEL[s].kit}</span>
      </>
    ),
  }));

  return (
    <div className={styles.demo}>
      <div className={styles.toolbar}>
        <Segmented
          label={translate({ id: 'benchmark.demo.formLabel', message: 'Форма' })}
          value={form}
          options={formOptions}
          onChange={(f) => select({ form: f })}
        />
        <Segmented
          label={translate({ id: 'benchmark.demo.stackLabel', message: 'Стек' })}
          value={stack}
          options={stackOptions}
          onChange={(s) => select({ stack: s })}
        />
        <Segmented
          label={translate({ id: 'benchmark.demo.dataLabel', message: 'Данные' })}
          value={prefill ? 'filled' : 'empty'}
          options={[
            {
              value: 'empty',
              label: translate({ id: 'benchmark.demo.data.empty', message: 'Пустая форма' }),
            },
            {
              value: 'filled',
              label: translate({ id: 'benchmark.demo.data.filled', message: 'Заполнить данными' }),
            },
          ]}
          onChange={(v) => setPrefill(v === 'filled')}
        />
      </div>
      <p className={styles.prefillNote}>
        {form === 'registration' ? (
          <Translate id="benchmark.demo.prefill.registration">
            «Заполнить данными» у регистрации — вход по ссылке-приглашению: email и имя приходят с
            «сервера».
          </Translate>
        ) : (
          <Translate id="benchmark.demo.prefill.credit">
            «Заполнить данными» у кредита — сохранённая заявка: все шаги заполнены, можно пройти
            «Далее» до отправки.
          </Translate>
        )}
      </p>

      <div className={styles.layout}>
        <div className={styles.side}>
          <SidePanel form={form} stack={stack} snapshot={snapshot} />
        </div>
        <div className={styles.formColumn}>
          {/* Действия над самой формой — над ней. */}
          <div className={styles.formActions}>
            <button
              type="button"
              className={clsx('button button--sm button--outline button--secondary', styles.action)}
              onClick={() => setReload((n) => n + 1)}
            >
              <Translate id="benchmark.demo.reload">Перезагрузить форму</Translate>
            </button>
            {/* Не Link: страницы форм — не маршруты сайта, проверка ссылок сборки их не знает. */}
            <a
              className={clsx('button button--sm button--outline button--secondary', styles.action)}
              href={pageAlone}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Translate id="benchmark.demo.openAlone">Открыть отдельно</Translate>
              <IconExternalLink />
            </a>
          </div>
          {status === 'timeout' && (
            <div className={clsx('alert alert--warning', styles.alert)} role="status">
              {process.env.NODE_ENV === 'development' ? (
                <Translate id="benchmark.demo.timeout.dev">
                  Страница формы не отвечает. Локально её отдаёт сервер forms-benchmark: соберите
                  демо-страницы (npm run demo:build -w forms-benchmark) и запустите npm run serve -w
                  forms-benchmark (порт 4180).
                </Translate>
              ) : (
                <Translate id="benchmark.demo.timeout">
                  Страница формы не отвечает — попробуйте перезагрузить форму.
                </Translate>
              )}
            </div>
          )}
          {/* Рамка — у обёртки: у самого iframe она отняла бы высоту у формы и дала прокрутку. */}
          <div className={styles.frameBox}>
            <iframe
              key={frameKey}
              ref={frame}
              src={src}
              title={translate(
                { id: 'benchmark.demo.frameTitle', message: '{form} — {stack}' },
                {
                  form: formTitle(form),
                  stack: `${STACK_LABEL[stack].name} + ${STACK_LABEL[stack].kit}`,
                }
              )}
              className={styles.frame}
              style={{ height }}
              onLoad={onLoad}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
