/**
 * Живые формы страницы «Замеры: с MCP и без»: что собрал агент с MCP.
 *
 * На каждую форму замера — по снимку прошедшего прогона на каждом стеке (каталог `_generated/`,
 * пишет стенд замеров MCP, `mcp-examples-docs.mjs`). Снимок грузится отдельным
 * чанком, когда форму открывают. Вкладка «Код» — сначала промпт прогона и спецификация, на которую
 * он ссылается (оба — markdown, показаны документом), затем вызовы агента к серверу (код `execute`/`search` и итог ответа), затем файлы
 * модуля, которые собрал сервер, байт в байт.
 *
 * Язык формы — русский на обеих страницах сайта: её собрали по русскому заданию, подписи и
 * сообщения правил — часть модуля, и встроенные тексты кита идут за ними, а не за страницей.
 */
import { useEffect, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import ErrorBoundary from '@docusaurus/ErrorBoundary';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ApiPreview, type CodeFlavor } from '../demo/ApiPreview';
import { DemoLocale } from '../demo/DemoLocale';
import { MCP_EXAMPLES } from './_generated';
import type { McpExampleModule, McpExampleRun, McpExampleStep } from './example-types';
import { Choice, fmtMinutes, fmtUsd, plural, useLang, type Lang } from './McpBenchmark';
import { MODELS } from './models';
import styles from './mcp-benchmark.module.css';

/** Порядок стеков — как в таблицах страницы; открыт сначала renderer-react. */
const STACK_ORDER = ['core', 'renderer-react', 'renderer-json'];
const DEFAULT_STACK = 'renderer-react';
/** Схема заказа — около 340 строк: длинный файл прокручивается внутри карточки. */
const CODE_MAX_HEIGHT = 560;

const percent = (score: number) => `${Math.round(score * 1000) / 10}%`;

const TEXT = {
  ru: {
    stack: 'Стек',
    repeat: (run: McpExampleRun) => `прогон ${run.repeat} из ${run.repeats}`,
    verdict: (run: McpExampleRun) =>
      !run.pass
        ? `не пройден, счёт ${percent(run.score)}`
        : run.score === 1
          ? 'все проверки пройдены'
          : `пройден, счёт ${percent(run.score)}`,
    calls: (n: number) => `${n} ${plural(n, 'вызов', 'вызова', 'вызовов')} MCP`,
    prompt: 'Промпт агента',
    spec: 'spec.md — спецификация из промпта',
    agentCalls: 'Вызовы агента',
    loading: 'Загружаю форму…',
    loadFailed: 'Не удалось загрузить форму',
    renderFailed: 'Форма упала при отрисовке',
    caption:
      'Модуль прогона без правок. Кнопка отправки проверяет форму; отправка — заглушка из api.ts, которую сервер оставляет под ваш запрос: значения формы уходят в консоль браузера.',
  },
  en: {
    stack: 'Stack',
    repeat: (run: McpExampleRun) => `run ${run.repeat} of ${run.repeats}`,
    verdict: (run: McpExampleRun) =>
      !run.pass
        ? `failed, score ${percent(run.score)}`
        : run.score === 1
          ? 'all checks passed'
          : `passed, score ${percent(run.score)}`,
    calls: (n: number) => `${n} MCP ${n === 1 ? 'call' : 'calls'}`,
    prompt: 'Agent prompt',
    spec: 'spec.md — the spec the prompt names',
    agentCalls: 'Agent calls',
    loading: 'Loading the form…',
    loadFailed: 'Could not load the form',
    renderFailed: 'The form crashed while rendering',
    caption:
      'The module of the run, unedited. The submit button validates the form; sending is the api.ts stub the server leaves for your request: the form values go to the browser console.',
  },
} as const;

/** Вызовы агента одним блоком: номер и инструмент над кодом, итог ответа сервера — под ним. */
function agentScript(steps: McpExampleStep[]): string {
  return steps
    .map((step, index) => {
      const head = `// ── ${index + 1} · ${step.tool}${step.error ? ' · error' : ''}`;
      const answer = step.answer ? `\n// ← ${step.answer}` : '';
      return `${head}\n${step.code.trim()}${answer}`;
    })
    .join('\n\n');
}

/**
 * Markdown-файл прогона документом, а не исходником: заголовки, списки, таблицы спецификации (GFM).
 * Класс `markdown` — типографика темы сайта; широкая таблица прокручивается внутри своего блока.
 */
function markdownFlavor(id: string, label: string, source: string): CodeFlavor {
  const code = source.trimEnd();
  return {
    id,
    label,
    language: 'markdown',
    code,
    content: (
      <div className={clsx('markdown', styles.exampleMarkdown)}>
        <Markdown remarkPlugins={[remarkGfm]}>{code}</Markdown>
      </div>
    ),
  };
}

function runLine(run: McpExampleRun, lang: Lang): string {
  const t = TEXT[lang];
  const model = MODELS.find((entry) => entry.id === run.model)?.label ?? run.model;
  return [
    model,
    t.repeat(run),
    t.verdict(run),
    fmtMinutes(run.minutes, lang),
    ...(run.cost === null ? [] : [fmtUsd(run.cost)]),
    t.calls(run.calls),
  ].join(' · ');
}

type Loaded = { stack: string; module: McpExampleModule } | { stack: string; error: true };

/**
 * Живая форма замера с переключателем стека и кодом.
 *
 * @example
 * ```mdx
 * <McpFormExample form="registration" />
 * ```
 */
export function McpFormExample({
  form,
  notes,
}: {
  form: string;
  /**
   * Пометка над формой по стеку — что в модуле прогона расходится с заданием, если это видно только
   * в браузере. Текст — со страницы, на её языке.
   */
  notes?: Partial<Record<string, ReactNode>>;
}): ReactNode {
  const lang = useLang();
  const t = TEXT[lang];
  const example = MCP_EXAMPLES[form];
  if (!example) throw new Error(`Нет формы ${form} в mcp-benchmark/_generated`);
  const stacks = STACK_ORDER.filter((stack) => stack in example.stacks);
  const [stack, setStack] = useState(stacks.includes(DEFAULT_STACK) ? DEFAULT_STACK : stacks[0]);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const entry = example.stacks[stack];

  useEffect(() => {
    let alive = true;
    entry.load().then(
      (module) => alive && setLoaded({ stack, module }),
      () => alive && setLoaded({ stack, error: true })
    );
    return () => {
      alive = false;
    };
  }, [entry, stack]);

  const current = loaded?.stack === stack ? loaded : null;
  const module = current && 'module' in current ? current.module : null;
  const codeFlavors: CodeFlavor[] = module
    ? [
        markdownFlavor('prompt', t.prompt, module.prompt),
        ...(module.spec === null ? [] : [markdownFlavor('spec', t.spec, module.spec)]),
        { id: 'agent', label: t.agentCalls, language: 'js', code: agentScript(module.steps) },
        ...module.files.map((file) => ({
          id: file.name,
          label: file.name,
          language: file.language,
          code: file.code.trimEnd(),
        })),
      ]
    : [];

  let preview: ReactNode = <span className={styles.scopeNote}>{t.loading}</span>;
  if (current && 'error' in current) {
    preview = <span className={styles.scopeNote}>{t.loadFailed}</span>;
  } else if (module) {
    const { Form } = module;
    preview = (
      <ErrorBoundary
        key={stack}
        fallback={({ error }) => (
          <span className={styles.scopeNote}>
            {t.renderFailed}: {error.message}
          </span>
        )}
      >
        <DemoLocale lang="ru">
          <Form />
        </DemoLocale>
      </ErrorBoundary>
    );
  }

  return (
    <figure className={styles.root}>
      <div className={styles.picker}>
        <Choice
          label={t.stack}
          value={stack}
          options={stacks.map((id) => ({ id, label: id }))}
          onChange={setStack}
        />
        <span className={styles.scopeNote}>{runLine(entry.run, lang)}</span>
      </div>
      {notes?.[stack] && <p className={styles.exampleNote}>{notes[stack]}</p>}
      <ApiPreview showFooter={false} codeFlavors={codeFlavors} codeMaxHeight={CODE_MAX_HEIGHT}>
        {preview}
      </ApiPreview>
      <figcaption className={styles.exampleCaption}>{t.caption}</figcaption>
    </figure>
  );
}
