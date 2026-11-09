import type { ReactNode } from 'react';
import { Arrow, Box, Diagram, Group, splitLines } from './Diagram';
import styles from './diagram.module.css';

/**
 * Диаграмма последовательности на примитивах схем: участники сверху, их линии жизни и сообщения
 * сверху вниз. Раскладку считает сама — ширину столбцов подбирает по длине заголовков и подписей,
 * поэтому схема задаёт только участников и шаги.
 *
 * Ширина текста оценивается по числу символов, а не измеряется: страница рендерится на сервере,
 * где измерить нечем. Оценка с запасом; длинную подпись разбивайте на строки массивом.
 */

export interface SequenceParticipant {
  id: string;
  /** Имя участника (моноширинное). */
  title: string;
  /** Пояснение строкой ниже. */
  subtitle?: string;
  /** Внутренняя ссылка сайта: блок участника становится кликабельным. */
  to?: string;
}

export interface SequenceMessage {
  from: string;
  to: string;
  /** Подпись над стрелкой; строки разделяет `\n`. */
  label: string | readonly string[];
  /** Ответ — пунктирная стрелка. */
  reply?: boolean;
}

export interface SequenceLoop {
  /** Название повтора — в углу рамки. */
  loop: string;
  steps: readonly SequenceMessage[];
}

export type SequenceStep = SequenceMessage | SequenceLoop;

export interface SequenceDiagramProps {
  title: string;
  caption?: ReactNode;
  participants: readonly SequenceParticipant[];
  steps: readonly SequenceStep[];
}

/** Ширина холста, как у остальных схем сайта; шире становится, только если подписи не влезли. */
const WIDTH = 760;
const MARGIN = 16;
const LABEL_LINE = 15;
/** Ширина символа: заголовок блока — моноширинный 15px, пояснение — 13px, подпись — 12px. */
const MONO_CHAR = 9.2;
const SUBTITLE_CHAR = 7.4;
const LABEL_CHAR = 6.7;

const lines = splitLines;
const labelWidth = (text: string | readonly string[]) =>
  Math.max(...lines(text).map((line) => line.length * LABEL_CHAR));

const isLoop = (step: SequenceStep): step is SequenceLoop => 'loop' in step;

/** Последовательность сообщений между участниками. */
export function SequenceDiagram({ title, caption, participants, steps }: SequenceDiagramProps) {
  const index = new Map(participants.map((p, i) => [p.id, i]));
  const messages = steps.flatMap((step) => (isLoop(step) ? step.steps : [step]));

  // Ширина блоков — по тексту; промежутки между осями — чтобы не налезли ни блоки, ни подписи.
  const boxWidths = participants.map((p) =>
    Math.max(96, p.title.length * MONO_CHAR + 28, (p.subtitle?.length ?? 0) * SUBTITLE_CHAR + 28)
  );
  const gaps = participants.slice(1).map((_, i) => (boxWidths[i] + boxWidths[i + 1]) / 2 + 16);
  // Подпись сообщения через несколько столбцов делит место между ними: сначала короткие пролёты.
  const spans = messages
    .map((m) => {
      const a = index.get(m.from)!;
      const b = index.get(m.to)!;
      return { lo: Math.min(a, b), hi: Math.max(a, b), need: labelWidth(m.label) + 20 };
    })
    .sort((p, q) => p.hi - p.lo - (q.hi - q.lo));
  for (const { lo, hi, need } of spans) {
    const have = gaps.slice(lo, hi).reduce((sum, gap) => sum + gap, 0);
    if (have < need) {
      for (let i = lo; i < hi; i++) gaps[i] += (need - have) / (hi - lo);
    }
  }
  // Узкую схему растягиваем до ширины соседних: холст уже — и текст на странице крупнее, чем у них.
  const natural = MARGIN * 2 + (boxWidths[0] + boxWidths[boxWidths.length - 1]) / 2;
  const spare = WIDTH - natural - gaps.reduce((sum, gap) => sum + gap, 0);
  if (spare > 0) gaps.forEach((_, i) => (gaps[i] += spare / gaps.length));
  const axes = [MARGIN + boxWidths[0] / 2];
  gaps.forEach((gap, i) => axes.push(axes[i] + gap));
  const width = Math.ceil(axes[axes.length - 1] + boxWidths[boxWidths.length - 1] / 2 + MARGIN);

  const headerTop = MARGIN;
  const headerHeight = participants.some((p) => p.subtitle) ? 60 : 44;
  const headerBottom = headerTop + headerHeight;

  // Раскладка шагов сверху вниз: стрелка ниже своей подписи.
  type Placed = { message: SequenceMessage; y: number };
  type PlacedLoop = { title: string; top: number; bottom: number; lo: number; hi: number };
  const placed: Placed[] = [];
  const loops: PlacedLoop[] = [];
  let y = headerBottom + 14;
  const place = (message: SequenceMessage) => {
    const arrowY = y + 20 + (lines(message.label).length - 1) * LABEL_LINE;
    placed.push({ message, y: arrowY });
    y = arrowY + 14;
  };
  for (const step of steps) {
    if (!isLoop(step)) {
      place(step);
      continue;
    }
    const top = y + 4;
    y = top + 26;
    step.steps.forEach(place);
    const ids = step.steps.flatMap((m) => [index.get(m.from)!, index.get(m.to)!]);
    loops.push({
      title: step.loop,
      top,
      bottom: y + 4,
      lo: Math.min(...ids),
      hi: Math.max(...ids),
    });
    y += 18;
  }
  const height = Math.ceil(y + 6);

  return (
    <Diagram title={title} caption={caption} viewBox={`0 0 ${width} ${height}`}>
      {loops.map((loop) => {
        const left = axes[loop.lo] - Math.min(boxWidths[loop.lo] / 2, 70);
        const right = axes[loop.hi] + Math.min(boxWidths[loop.hi] / 2, 70);
        return (
          <Group
            key={loop.top}
            x={left}
            y={loop.top}
            width={right - left}
            height={loop.bottom - loop.top}
            title={loop.title}
          />
        );
      })}
      {axes.map((x, i) => (
        <line key={i} x1={x} y1={headerBottom} x2={x} y2={height - 4} className={styles.lifeline} />
      ))}
      {participants.map((p, i) => (
        <Box
          key={p.id}
          x={axes[i] - boxWidths[i] / 2}
          y={headerTop}
          width={boxWidths[i]}
          height={headerHeight}
          title={p.title}
          subtitle={p.subtitle}
          to={p.to}
        />
      ))}
      {placed.map(({ message, y: arrowY }, i) => {
        const x1 = axes[index.get(message.from)!];
        const x2 = axes[index.get(message.to)!];
        const end = x2 > x1 ? x2 - 2 : x2 + 2;
        return (
          <Arrow
            key={i}
            from={[x1, arrowY]}
            to={[end, arrowY]}
            label={message.label}
            dashed={message.reply}
          />
        );
      })}
    </Diagram>
  );
}
