import { translate } from '@docusaurus/Translate';
import { Arrow, Box, Diagram, type Point } from './Diagram';

/**
 * Итоги отправки: `submission.submit(handler)` сначала проверяет правила, обработчик зовёт только
 * без блокирующих замечаний. Каждый исход — статус `SubmitResult`; условие исхода — подпись блока.
 */
export function SubmitOutcomes() {
  const w = 170;
  const columns = [16, 202, 388, 574];
  const center = (i: number) => columns[i] + w / 2;
  const outcomesY = 200;
  const outcomesH = 80;
  const resultsY = 328;
  const checkBottom = 144;
  const bus = 172;

  return (
    <Diagram
      viewBox="0 0 760 408"
      title={translate({ id: 'diagram.submit.title', message: 'Итоги отправки формы' })}
      caption={translate({
        id: 'diagram.submit.caption',
        message:
          'Каждый исход — объект SubmitResult со статусом. Обработчик вызывается, только если блокирующих замечаний нет.',
      })}
    >
      <Box
        x={245}
        y={16}
        width={270}
        height={48}
        variant="accent"
        title="submission.submit(handler)"
      />
      <Box
        x={285}
        y={96}
        width={190}
        height={48}
        title={translate({ id: 'diagram.submit.check', message: 'проверка правил' })}
        to="/docs/validation/overview"
      />

      <Box
        x={columns[0]}
        y={outcomesY}
        width={w}
        height={outcomesH}
        title="invalid"
        subtitle={translate({
          id: 'diagram.submit.invalid',
          message: 'есть блокирующие\nзамечания',
        })}
      />
      <Box
        x={columns[1]}
        y={outcomesY}
        width={w}
        height={outcomesH}
        title="error"
        subtitle={translate({ id: 'diagram.submit.error', message: 'правило не ответило' })}
      />
      <Box
        x={columns[2]}
        y={outcomesY}
        width={w}
        height={outcomesH}
        title="cancelled"
        subtitle={translate({
          id: 'diagram.submit.cancelled',
          message: 'проверку сменила новая\nили модель изменилась',
        })}
      />
      <Box
        x={columns[3]}
        y={outcomesY}
        width={w}
        height={outcomesH}
        title="handler(values)"
        subtitle={translate({ id: 'diagram.submit.handler', message: 'замечаний нет' })}
      />

      <Box
        x={columns[2]}
        y={resultsY}
        width={w}
        height={64}
        title="submitted"
        subtitle={translate({ id: 'diagram.submit.submitted', message: 'вернул результат' })}
      />
      <Box
        x={columns[3]}
        y={resultsY}
        width={w}
        height={64}
        title="failed"
        subtitle={translate({ id: 'diagram.submit.failed', message: 'бросил исключение' })}
      />

      <Arrow from={[380, 64]} to={[380, 94]} />
      {columns.map((_, i) => {
        const via: Point[] = [
          [380, bus],
          [center(i), bus],
        ];
        return (
          <Arrow key={i} from={[380, checkBottom]} via={via} to={[center(i), outcomesY - 2]} />
        );
      })}

      <Arrow from={[center(3), outcomesY + outcomesH]} to={[center(3), resultsY - 2]} />
      <Arrow
        from={[center(3), outcomesY + outcomesH]}
        via={[
          [center(3), 304],
          [center(2), 304],
        ]}
        to={[center(2), resultsY - 2]}
      />
    </Diagram>
  );
}

/**
 * Сброс формы: точка отсчёта одна — значения при создании модели или зафиксированные
 * `captureInitial()`. Что именно возвращает каждый вызов — подпись блока.
 */
export function ResetPoint() {
  const left = { x: 16, width: 250 };
  const mid = { x: 328, width: 140 };
  const right = { x: 530, width: 214 };
  const h = 80;
  const [top, bottom] = [16, 128];
  const midY = 72;
  const [in1, in2] = [midY + 28, midY + 52];

  return (
    <Diagram
      viewBox="0 0 760 224"
      title={translate({ id: 'diagram.reset.title', message: 'Точка отсчёта для сброса' })}
      caption={translate({
        id: 'diagram.reset.caption',
        message:
          'form.reset() возвращает к точке отсчёта и значения, и состояние нод; model.reset() — только значения.',
      })}
    >
      <Box
        {...left}
        y={top}
        height={h}
        title="createForm"
        subtitle={translate({ id: 'diagram.reset.initial', message: 'начальные значения' })}
      />
      <Box
        {...left}
        y={bottom}
        height={h}
        title={translate({ id: 'diagram.reset.patch', message: 'model.patch(загруженное)' })}
        subtitle="model.captureInitial()"
      />
      <Box
        {...mid}
        y={midY}
        height={h}
        variant="accent"
        title={translate({ id: 'diagram.reset.point', message: 'точка отсчёта' })}
      />
      <Box
        {...right}
        y={top}
        height={h}
        title="form.reset()"
        subtitle={translate({
          id: 'diagram.reset.form',
          message: 'значения вернулись,\nзамечания и касание сняты',
        })}
      />
      <Box
        {...right}
        y={bottom}
        height={h}
        title="model.reset()"
        subtitle={translate({
          id: 'diagram.reset.model',
          message: 'вернулись только значения,\nноды не тронуты',
        })}
      />

      <Arrow from={[left.x + left.width, top + h / 2]} to={[mid.x - 2, in1]} />
      <Arrow from={[left.x + left.width, bottom + h / 2]} to={[mid.x - 2, in2]} />
      <Arrow from={[mid.x + mid.width, in1]} to={[right.x - 2, top + h / 2]} />
      <Arrow from={[mid.x + mid.width, in2]} to={[right.x - 2, bottom + h / 2]} />
    </Diagram>
  );
}
