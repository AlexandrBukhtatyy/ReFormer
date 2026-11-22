/**
 * Фоновая нагрузка на машине во время прогона (BENCH-CONTRACT §6): что ещё работало, пока шёл замер.
 *
 * Калибровка (lib/calibration.ts) ловит частоту и тепловой режим CPU, но не соседей: инференс LLM,
 * чужие браузеры и сборки конкурируют за GPU, пропускную способность памяти и композитор — это
 * бьёт по DOM, layout и отрисовке, а не по JS в кэше процессора. Поэтому в начале и в конце каждого
 * прогона (в точках калибровки, вне окон замера) снимается список процессов `ps`: доля CPU процесса
 * за прогон — приращение накопленного CPU-времени, делённое на время прогона. Это точное среднее за
 * окно, в отличие от `%cpu` у ps (затухающее среднее). Собственное дерево процессов бенча (раннер
 * Playwright, воркеры, запущенные ими браузеры, webServer) исключается. На macOS добавляется
 * загрузка GPU из IOAccelerator (`ioreg`, без root) — моментальное значение в точке замера.
 *
 * Модуль самодостаточен (только `node:`-импорты и стираемый синтаксис TypeScript): его же
 * импортирует scripts/idle-check.mjs напрямую через Node.
 */
import { execFileSync } from 'node:child_process';

/**
 * Пороги классификатора, % одного ядра в среднем за окно замера.
 *
 * - Ollama и чужие автоматизированные браузеры — от 5 %: их нагрузка в основном на GPU и
 *   композиторе, CPU-доля её занижает; 5 % за весь прогон — уже не простой процесс, а работа
 *   (простаивающий runner Ollama и закрытый браузер дают ~0 %).
 * - Инструменты на Node (vitest, tsc, vite/esbuild, eslint, jest, playwright), десктопные браузеры,
 *   Docker/VM — от 10 %: в покое редактор, браузер с вкладками и демон Docker держатся в пределах
 *   нескольких процентов ядра, 10 % — непрерывная работа.
 * - Остальные процессы — каждый от 20 %: обычный фон рабочего стола (WindowServer, рендерер
 *   редактора, агенты) — 1–10 % ядра, 20 % и выше — заметный пожиратель CPU.
 * - GPU — от 30 % загрузки устройства: композитинг рабочего стола в покое — единицы процентов.
 * - Чужая нагрузка в сумме — от 1 ядра: бенч сам занимает ~1–2 ядра (main thread рендерера, GPU- и
 *   браузерный процессы, раннер), у Apple M1 четыре производительных ядра; ещё целое ядро соседей —
 *   и планировщик начинает уводить потоки бенча на энергоэффективные ядра.
 */
export const BACKGROUND_THRESHOLDS = {
  ollamaPct: 5,
  automationPct: 5,
  toolingPct: 10,
  desktopBrowserPct: 10,
  vmPct: 10,
  otherPct: 20,
  gpuPct: 30,
  foreignCores: 1,
} as const;

export type NeighbourKind =
  | 'ollama'
  | 'automation-browser'
  | 'node-tooling'
  | 'desktop-browser'
  | 'vm'
  | 'gpu'
  | 'other';

export interface Neighbour {
  kind: NeighbourKind;
  label: string;
  /** % одного ядра за окно (сумма по процессам группы); у `gpu` — null. */
  cpuPct: number | null;
  /** Процессов в группе. */
  procs: number;
  /** Выше порога своего вида. Ollama runner попадает в список и простаивая — с `busy: false`. */
  busy: boolean;
  /** Загрузка GPU, % (только у `gpu`). */
  gpuPct?: number;
}

export interface BackgroundSample {
  /** Длительность окна, с. */
  wallSec: number;
  /** Чужая нагрузка: сумма CPU процессов вне дерева бенча, ядер. */
  foreignCores: number;
  /** Своя нагрузка (дерево бенча), ядер — нижняя оценка: завершившиеся процессы не видны. */
  ownCores: number;
  /** Загрузка GPU, % — среднее моментальных замеров (macOS); null — недоступно. */
  gpuPct: number | null;
  /** Пять самых нагруженных чужих процессов. */
  top: Array<{ name: string; cpuPct: number }>;
  /** Тяжёлые соседи по классификатору. */
  neighbours: Neighbour[];
  /** Прогон «грязный»: есть занятый сосед или чужая нагрузка ≥ порога. */
  dirty: boolean;
  /** Почему грязный — для консоли и отчёта. */
  reasons: string[];
}

interface Proc {
  pid: number;
  ppid: number;
  cpuSec: number;
  comm: string;
  args: string;
}

export interface ProcSnapshot {
  atMs: number;
  procs: Map<number, Proc>;
  gpuPct: number | null;
}

const round1 = (v: number) => Math.round(v * 10) / 10;
const round2 = (v: number) => Math.round(v * 100) / 100;

/** `ps` TIME: `[дд-][чч:]мм:сс[.сс]` (macOS — минуты могут быть > 59). */
export function parseCpuTime(text: string): number {
  const [daysPart, rest] = text.includes('-') ? text.split('-') : ['0', text];
  const parts = rest.split(':').map(Number);
  let sec = 0;
  for (const p of parts) sec = sec * 60 + p;
  return Number(daysPart) * 86400 + sec;
}

function run(cmd: string, args: string[]): string | null {
  try {
    return execFileSync(cmd, args, {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
}

/** Загрузка GPU (Apple Silicon, IOAccelerator → «Device Utilization %»); null — недоступно. */
export function readGpuPct(): number | null {
  if (process.platform !== 'darwin') return null;
  const out = run('ioreg', ['-r', '-d', '1', '-w', '0', '-c', 'IOAccelerator']);
  const values = [...(out ?? '').matchAll(/"Device Utilization %"\s*=\s*(\d+)/g)].map((m) =>
    Number(m[1])
  );
  return values.length ? Math.max(...values) : null;
}

/** Снимок процессов: pid, ppid, накопленное CPU-время, исполняемый файл, командная строка. */
export function takeSnapshot(withGpu = true): ProcSnapshot | null {
  if (process.platform === 'win32') return null;
  const atMs = performance.now();
  const base = run('ps', ['-A', '-o', 'pid=,ppid=,time=,comm=']);
  const full = run('ps', ['-A', '-ww', '-o', 'pid=,args=']);
  if (!base) return null;
  const args = new Map<number, string>();
  for (const line of (full ?? '').split('\n')) {
    const m = /^\s*(\d+)\s+(.*)$/.exec(line);
    if (m) args.set(Number(m[1]), m[2]);
  }
  const procs = new Map<number, Proc>();
  for (const line of base.split('\n')) {
    const m = /^\s*(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/.exec(line);
    if (!m) continue;
    const pid = Number(m[1]);
    procs.set(pid, {
      pid,
      ppid: Number(m[2]),
      cpuSec: parseCpuTime(m[3]),
      comm: m[4].trim(),
      args: args.get(pid) ?? m[4].trim(),
    });
  }
  return { atMs, procs, gpuPct: withGpu ? readGpuPct() : null };
}

/**
 * Корень дерева бенча: в воркере Playwright Test — раннер (родитель воркера), иначе — сам процесс.
 * Потомки корня — воркеры, браузеры, которые они запустили, и webServer.
 */
export function benchRootPid(snap: ProcSnapshot): number {
  const parent = snap.procs.get(process.ppid);
  return parent && /playwright/i.test(parent.args) ? process.ppid : process.pid;
}

function descendants(snap: ProcSnapshot, root: number): Set<number> {
  const children = new Map<number, number[]>();
  for (const p of snap.procs.values()) {
    const list = children.get(p.ppid);
    if (list) list.push(p.pid);
    else children.set(p.ppid, [p.pid]);
  }
  const out = new Set<number>([root]);
  const queue = [root];
  while (queue.length) {
    for (const c of children.get(queue.pop()!) ?? []) {
      if (!out.has(c)) {
        out.add(c);
        queue.push(c);
      }
    }
  }
  return out;
}

const basename = (p: string) => p.split(/[\\/]/).pop() ?? p;

const TOOL = /\b(vitest|jest|eslint|tsserver|tsc|tsgo|vite|esbuild|rollup|webpack|playwright)\b/;
const DESKTOP_BROWSERS: Array<[RegExp, string]> = [
  [/Google Chrome/, 'Google Chrome'],
  [/\/Safari\.app\/|com\.apple\.WebKit\.|com\.apple\.Safari/, 'Safari / WebKit'],
  [/Firefox\.app|\/firefox$/i, 'Firefox'],
  [/Microsoft Edge/, 'Microsoft Edge'],
  [/Brave Browser/, 'Brave'],
  [/\/Arc\.app\//, 'Arc'],
  [/Yandex\.app/, 'Яндекс Браузер'],
  [/(^|\/)(google-chrome|chrome|chromium)$/, 'Chrome / Chromium'],
];

/** Вид соседа по исполняемому файлу и командной строке; null — неизвестный процесс. */
export function classify(p: { comm: string; args: string }): {
  kind: NeighbourKind;
  label: string;
} | null {
  const text = `${p.comm} ${p.args}`;
  const name = basename(p.comm);
  if (/(^|\/)ollama(_llama_server)?$/i.test(p.comm) || /\/Ollama\.app\//.test(p.comm)) {
    const runner = /\srunner(\s|$)/.test(p.args) || /ollama_llama_server/.test(p.comm);
    const model = /--model\s+(\S+)/.exec(p.args)?.[1];
    return runner
      ? { kind: 'ollama', label: `Ollama runner${model ? ` (${model})` : ''}` }
      : { kind: 'ollama', label: 'Ollama' };
  }
  if (/ms-playwright|[\\/]puppeteer[\\/]|Chrome for Testing|headless[_-]shell/i.test(text)) {
    const engine = /firefox/i.test(text)
      ? 'firefox'
      : /webkit|WebContent|Playwright\.app/i.test(text)
        ? 'webkit'
        : 'chromium';
    return { kind: 'automation-browser', label: `чужой Playwright/автоматизация: ${engine}` };
  }
  if (/^(node|bun|deno)(\.exe)?$/i.test(name) || /Code Helper \(Plugin\)/.test(p.comm)) {
    const tool = TOOL.exec(p.args)?.[1];
    if (tool)
      return { kind: 'node-tooling', label: tool === 'tsserver' ? 'tsserver (редактор)' : tool };
  }
  if (/^(esbuild|tsgo|rolldown)$/.test(name)) return { kind: 'node-tooling', label: name };
  if (/docker|qemu|vfkit|colima|limactl|OrbStack|com\.apple\.Virtualization/i.test(p.comm)) {
    return { kind: 'vm', label: 'Docker / виртуальная машина' };
  }
  for (const [re, label] of DESKTOP_BROWSERS) {
    if (re.test(p.comm)) return { kind: 'desktop-browser', label };
  }
  return null;
}

const KIND_THRESHOLD: Record<NeighbourKind, number> = {
  ollama: BACKGROUND_THRESHOLDS.ollamaPct,
  'automation-browser': BACKGROUND_THRESHOLDS.automationPct,
  'node-tooling': BACKGROUND_THRESHOLDS.toolingPct,
  'desktop-browser': BACKGROUND_THRESHOLDS.desktopBrowserPct,
  vm: BACKGROUND_THRESHOLDS.vmPct,
  gpu: BACKGROUND_THRESHOLDS.gpuPct,
  other: BACKGROUND_THRESHOLDS.otherPct,
};

/** Имя процесса для топа: исполняемый файл, у Node — с инструментом или скриптом. */
function displayName(p: Proc): string {
  const name = basename(p.comm);
  if (/^(node|bun|deno)(\.exe)?$/i.test(name)) {
    const tool = TOOL.exec(p.args)?.[1];
    const script = p.args.split(/\s+/).find((a, i) => i > 0 && !a.startsWith('-'));
    return `${name} (${tool ?? (script ? basename(script) : '?')})`;
  }
  return name;
}

/**
 * Выборка за окно между двумя снимками. Доля CPU процесса — приращение CPU-времени к длительности
 * окна; процесс, появившийся за окно (или pid переиспользован), считается с нуля. Процессы, которые
 * завершились до второго снимка, не видны.
 */
export function sampleBetween(
  a: ProcSnapshot,
  b: ProcSnapshot,
  rootPid: number,
  gpuReadings: number[] = []
): BackgroundSample {
  const wallSec = Math.max(1e-3, (b.atMs - a.atMs) / 1000);
  const own = descendants(b, rootPid);
  for (const pid of descendants(a, rootPid)) own.add(pid);
  let ownSec = 0;
  const foreign: Array<Proc & { pct: number }> = [];
  for (const p of b.procs.values()) {
    const prev = a.procs.get(p.pid);
    const start = prev && prev.comm === p.comm ? prev.cpuSec : 0;
    const used = Math.max(0, p.cpuSec - start);
    if (own.has(p.pid)) ownSec += used;
    else if (used > 0) foreign.push({ ...p, pct: (used / wallSec) * 100 });
  }
  const foreignCores = foreign.reduce((s, p) => s + p.pct, 0) / 100;

  const groups = new Map<string, Neighbour>();
  for (const p of foreign) {
    const c = classify(p) ?? { kind: 'other' as const, label: displayName(p) };
    const key = c.kind === 'other' ? `other:${p.pid}` : `${c.kind}:${c.label}`;
    const g = groups.get(key) ?? { kind: c.kind, label: c.label, cpuPct: 0, procs: 0, busy: false };
    g.cpuPct = (g.cpuPct ?? 0) + p.pct;
    g.procs += 1;
    groups.set(key, g);
  }
  // Runner Ollama виден и без нагрузки за окно: модель загружена и держит память.
  for (const p of b.procs.values()) {
    if (own.has(p.pid)) continue;
    const c = classify(p);
    if (
      c?.kind === 'ollama' &&
      c.label.startsWith('Ollama runner') &&
      !groups.has(`ollama:${c.label}`)
    )
      groups.set(`ollama:${c.label}`, {
        kind: 'ollama',
        label: c.label,
        cpuPct: 0,
        procs: 1,
        busy: false,
      });
  }
  const neighbours: Neighbour[] = [];
  for (const g of groups.values()) {
    g.busy = (g.cpuPct ?? 0) >= KIND_THRESHOLD[g.kind];
    const keep = g.busy || (g.kind === 'ollama' && g.label.startsWith('Ollama runner'));
    if (keep) neighbours.push({ ...g, cpuPct: round1(g.cpuPct ?? 0) });
  }
  const gpuValues = [a.gpuPct, ...gpuReadings, b.gpuPct].filter(
    (v): v is number => v !== null && Number.isFinite(v)
  );
  const gpuPct = gpuValues.length
    ? round1(gpuValues.reduce((s, v) => s + v, 0) / gpuValues.length)
    : null;
  if (gpuPct !== null && gpuPct >= BACKGROUND_THRESHOLDS.gpuPct) {
    neighbours.push({
      kind: 'gpu',
      label: 'GPU',
      cpuPct: null,
      procs: 0,
      busy: true,
      gpuPct,
    });
  }
  neighbours.sort((x, y) => (y.cpuPct ?? 0) - (x.cpuPct ?? 0));

  const reasons: string[] = [];
  for (const n of neighbours.filter((x) => x.busy)) {
    reasons.push(
      n.kind === 'gpu' ? `GPU загружен на ${n.gpuPct} %` : `${n.label}: ${n.cpuPct} % ядра`
    );
  }
  if (foreignCores >= BACKGROUND_THRESHOLDS.foreignCores) {
    reasons.push(
      `чужая нагрузка ${round2(foreignCores)} ядра (порог ${BACKGROUND_THRESHOLDS.foreignCores})`
    );
  }
  return {
    wallSec: round2(wallSec),
    foreignCores: round2(foreignCores),
    ownCores: round2(ownSec / wallSec),
    gpuPct,
    top: foreign
      .sort((x, y) => y.pct - x.pct)
      .slice(0, 5)
      .map((p) => ({ name: displayName(p), cpuPct: round1(p.pct) })),
    neighbours,
    dirty: reasons.length > 0,
    reasons,
  };
}

/** Выборка прогона: снимок сейчас, `finish()` — снимок в конце и сводка. null — нет `ps`. */
export function startBackgroundSample(): { finish(): BackgroundSample | null } {
  const a = takeSnapshot();
  return {
    finish() {
      if (!a) return null;
      const b = takeSnapshot();
      return b ? sampleBetween(a, b, benchRootPid(b)) : null;
    },
  };
}

/** Короткая выборка (пред-проверка, idle-check): два снимка через `ms`, GPU — несколько раз. */
export async function sampleFor(ms: number, rootPid?: number): Promise<BackgroundSample | null> {
  const a = takeSnapshot();
  if (!a) return null;
  const gpu: number[] = [];
  const step = Math.max(100, Math.floor(ms / 4));
  for (let t = step; t < ms; t += step) {
    await new Promise((r) => setTimeout(r, step));
    const v = readGpuPct();
    if (v !== null) gpu.push(v);
  }
  await new Promise((r) => setTimeout(r, Math.max(0, ms - (performance.now() - a.atMs))));
  const b = takeSnapshot();
  return b ? sampleBetween(a, b, rootPid ?? benchRootPid(b), gpu) : null;
}

/** Строки для консоли: вердикт, соседи, топ процессов. */
export function describeSample(s: BackgroundSample | null): string[] {
  if (!s) return ['фоновая нагрузка: недоступно (нет ps на этой платформе)'];
  const lines = [
    `${s.dirty ? 'ЗАНЯТА' : 'свободна'}: чужая нагрузка ${s.foreignCores} ядра за ${s.wallSec} с` +
      (s.gpuPct !== null ? `, GPU ${s.gpuPct} %` : '') +
      `, бенч/сам ${s.ownCores} ядра`,
  ];
  if (s.reasons.length) lines.push(`  почему: ${s.reasons.join('; ')}`);
  for (const n of s.neighbours) {
    lines.push(
      n.kind === 'gpu'
        ? `  сосед: GPU — ${n.gpuPct} %`
        : `  сосед: ${n.label} — ${n.cpuPct} % ядра, процессов ${n.procs}${n.busy ? '' : ' (простаивает)'}`
    );
  }
  if (s.top.length)
    lines.push(`  топ чужих: ${s.top.map((p) => `${p.name} ${p.cpuPct} %`).join(', ')}`);
  return lines;
}

/**
 * Пред-проверка перед тестом бенча: ~2 с выборки, предупреждение в консоль, если машина занята.
 * Падать или нет (BENCH_REQUIRE_IDLE) решает вызывающий.
 */
export async function preflight(ms = 2000): Promise<BackgroundSample | null> {
  const s = await sampleFor(ms);
  const lines = describeSample(s);
  if (s?.dirty) {
    console.warn(
      [
        '⚠️  Фоновая нагрузка перед прогоном — числа будут шумными и несравнимыми с тихой машиной:',
        ...lines,
      ].join('\n')
    );
  } else {
    console.log(`фоновая нагрузка перед прогоном: ${lines[0]}`);
  }
  return s;
}
