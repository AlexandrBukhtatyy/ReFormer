/**
 * Калибровка счётчика рендеров: дерево с заранее известным числом рендеров на каждое действие.
 * e2e (`tests/bench/calibration.spec.ts`) сверяет показания счётчика с этими числами.
 *
 * Монтирование: CalibrationRoot, Parent, ChildA, ChildB, ChildC, MemoChild, Leaf — 7 компонентов.
 * «bump» (state Parent): Parent + ChildA/B/C = 4; MemoChild не рендерится (пропсы те же).
 * «leaf» (state Leaf): 1.
 */
import { memo, useState } from 'react';
import { mountBench } from '../shared/harness/mount';

function ChildA({ n }: { n: number }) {
  return <span>A{n}</span>;
}
function ChildB({ n }: { n: number }) {
  return <span>B{n}</span>;
}
function ChildC() {
  return <span>C</span>;
}
const MemoChild = memo(function MemoChild({ label }: { label: string }) {
  return <span>{label}</span>;
});

function Leaf() {
  const [n, setN] = useState(0);
  return (
    <button type="button" data-testid="calib-leaf" onClick={() => setN(n + 1)}>
      leaf {n}
    </button>
  );
}

function Parent() {
  const [n, setN] = useState(0);
  return (
    <div>
      <button type="button" data-testid="calib-bump" onClick={() => setN(n + 1)}>
        bump {n}
      </button>
      <ChildA n={n} />
      <ChildB n={n} />
      <ChildC />
      <MemoChild label="memo" />
    </div>
  );
}

function CalibrationRoot() {
  return (
    <div data-testid="calibration-root">
      <Parent />
      <Leaf />
    </div>
  );
}

mountBench('calibration', CalibrationRoot);
