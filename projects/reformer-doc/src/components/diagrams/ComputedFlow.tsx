import { translate } from '@docusaurus/Translate';
import { Arrow, Box, Diagram } from './Diagram';

const reads = () => translate({ id: 'diagram.computed.reads', message: 'читает' });
const writes = () => translate({ id: 'diagram.computed.writes', message: 'пишет' });

/**
 * Какие поля читает и какое пишет оператор: пример страницы `compute` — итог из цены и
 * количества, доступность промокода от итога. Операторы поведения выделены, поля модели — нет.
 */
export function ComputeDependencies() {
  const w = 170;
  const h = 48;
  const [c0, c1, c2] = [16, 295, 574];
  const center = (x: number) => x + w / 2;

  return (
    <Diagram
      viewBox="0 0 760 248"
      title={translate({
        id: 'diagram.computed.deps.title',
        message: 'Какие поля читает и какое пишет оператор',
      })}
      caption={translate({
        id: 'diagram.computed.deps.caption',
        message:
          'Оператор подписан на поля, которые читает, и пишет только в свою цель. Выделены операторы поведения.',
      })}
    >
      <Box x={c0} y={16} width={w} height={h} title="model.price" />
      <Box x={c0} y={112} width={w} height={h} title="model.quantity" />
      <Box x={c1} y={64} width={w} height={h} variant="accent" title="compute" />
      <Box x={c2} y={64} width={w} height={h} title="model.total" />
      <Box x={c2} y={184} width={w} height={h} variant="accent" title="enableWhen" />
      <Box
        x={c1}
        y={184}
        width={w}
        height={h}
        title={translate({ id: 'diagram.computed.promoCode', message: 'поле promoCode' })}
      />

      <Arrow
        from={[c0 + w, 40]}
        via={[
          [240, 40],
          [240, 80],
        ]}
        to={[c1 - 2, 80]}
        label={reads()}
        labelAt={[213, 32]}
        labelAnchor="middle"
      />
      <Arrow
        from={[c0 + w, 136]}
        via={[
          [240, 136],
          [240, 96],
        ]}
        to={[c1 - 2, 96]}
        label={reads()}
        labelAt={[213, 128]}
        labelAnchor="middle"
      />
      <Arrow from={[c1 + w, 88]} to={[c2 - 2, 88]} label={writes()} />
      <Arrow from={[center(c2), 64 + h]} to={[center(c2), 182]} label={reads()} />
      <Arrow
        from={[c2, 208]}
        to={[c1 + w + 2, 208]}
        label={translate({
          id: 'diagram.computed.toggles',
          message: 'включает\nи выключает',
        })}
      />
    </Diagram>
  );
}

/** Цикл вычислений: два `compute` читают цели друг друга. */
export function ComputeCycle() {
  const w = 200;
  const h = 48;
  const [left, right] = [110, 450];
  const [top, bottom] = [16, 136];

  return (
    <Diagram
      viewBox="0 0 760 200"
      title={translate({ id: 'diagram.computed.cycle.title', message: 'Цикл вычислений' })}
      caption={translate({
        id: 'diagram.computed.cycle.caption',
        message:
          'Каждое вычисление читает цель другого. Цикл сходится, если очередной пересчёт не меняет значения.',
      })}
    >
      <Box x={left} y={top} width={w} height={h} title="model.a" />
      <Box
        x={right}
        y={top}
        width={w}
        height={h}
        variant="accent"
        title={translate({ id: 'diagram.computed.cycle.computeB', message: 'compute для b' })}
      />
      <Box x={right} y={bottom} width={w} height={h} title="model.b" />
      <Box
        x={left}
        y={bottom}
        width={w}
        height={h}
        variant="accent"
        title={translate({ id: 'diagram.computed.cycle.computeA', message: 'compute для a' })}
      />

      <Arrow from={[left + w, top + h / 2]} to={[right - 2, top + h / 2]} label={reads()} />
      <Arrow from={[right + w / 2, top + h]} to={[right + w / 2, bottom - 2]} label={writes()} />
      <Arrow from={[right, bottom + h / 2]} to={[left + w + 2, bottom + h / 2]} label={reads()} />
      <Arrow from={[left + w / 2, bottom]} to={[left + w / 2, top + h + 2]} label={writes()} />
    </Diagram>
  );
}
