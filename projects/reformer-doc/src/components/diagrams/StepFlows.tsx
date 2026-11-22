import { translate } from '@docusaurus/Translate';
import { Arrow, Box, Diagram, Label, Terminal } from './Diagram';

/**
 * Машина шагов потока: вперёд — только `next()` через проверку правил шага, назад — всегда.
 * Исход проверки (`moved` / `stayed`) — подписи стрелок, как в `FlowNavResult`.
 */
export function StepMachine() {
  const h = 56;
  const [top, bottom] = [24, 184];
  const step = { x: 150, width: 180 };
  const check = { x: 480, width: 240 };
  const mid = top + h / 2;
  const [forward, back] = [mid - 10, mid + 10];
  const [down, up] = [210, 270];

  return (
    <Diagram
      viewBox="0 0 760 256"
      title={translate({ id: 'diagram.steps.title', message: 'Машина шагов' })}
      caption={translate({
        id: 'diagram.steps.caption',
        message: 'Вперёд — только через проверку правил шага; назад — всегда, без проверки.',
      })}
    >
      <Terminal x={40} y={mid} kind="start" />
      <Box
        {...step}
        y={top}
        height={h}
        variant="accent"
        title={translate({ id: 'diagram.steps.current', message: 'Шаг N' })}
      />
      <Box
        {...check}
        y={top}
        height={h}
        title={translate({ id: 'diagram.steps.check', message: 'Проверка правил шага N' })}
      />
      <Box
        {...check}
        y={bottom}
        height={h}
        title={translate({ id: 'diagram.steps.next', message: 'Шаг N+1' })}
      />
      <Box
        x={130}
        y={bottom}
        width={220}
        height={h}
        title={translate({ id: 'diagram.steps.earlier', message: 'Пройденный шаг' })}
        subtitle={translate({ id: 'diagram.steps.earlierHint', message: 'раньше N' })}
      />

      <Arrow
        from={[47, mid]}
        to={[step.x - 2, mid]}
        label={translate({ id: 'diagram.steps.first', message: 'первый шаг' })}
      />
      <Arrow from={[step.x + step.width, forward]} to={[check.x - 2, forward]} label="next()" />
      <Arrow
        from={[check.x, back]}
        to={[step.x + step.width + 2, back]}
        label={translate({ id: 'diagram.steps.stayed', message: 'замечания или сбой —\nstayed' })}
        labelAt={[(step.x + step.width + check.x) / 2, back + 18]}
        labelAnchor="middle"
      />
      <Arrow
        from={[check.x + check.width / 2, top + h]}
        to={[check.x + check.width / 2, bottom - 2]}
        label={translate({ id: 'diagram.steps.moved', message: 'замечаний нет —\nmoved' })}
        labelAt={[check.x + check.width / 2 + 8, 126]}
      />
      <Arrow
        from={[down, top + h]}
        to={[down, bottom - 2]}
        label={translate({ id: 'diagram.steps.back', message: 'previous()\nили goTo(id)' })}
        labelAt={[down - 8, 126]}
        labelAnchor="end"
      />
      <Arrow
        from={[up, bottom]}
        to={[up, top + h + 2]}
        label={translate({ id: 'diagram.steps.forwardAgain', message: 'next()\nпо шагам' })}
        labelAt={[up + 8, 126]}
      />
    </Diagram>
  );
}

/**
 * Переходы визарда из примера страницы `FormWizard`: шаги `loan` → `contacts` → `confirm`.
 * Вперёд — `next()` с проверкой шага, назад — `previous()`, с последнего — отправка.
 */
export function WizardSteps() {
  const w = 120;
  const h = 48;
  const y = 72;
  const xs = [60, 300, 540];
  const [forward, back] = [y + 14, y + 34];
  const passed = () => translate({ id: 'diagram.wizard.passed', message: 'next()\nшаг прошёл' });
  const exit = xs[2] + w / 2;

  return (
    <Diagram
      viewBox="0 0 760 208"
      title={translate({ id: 'diagram.wizard.title', message: 'Переходы между шагами визарда' })}
      caption={translate({
        id: 'diagram.wizard.caption',
        message:
          'Вперёд — next(): шаг с замечаниями не пропускает дальше. Назад — previous() в любой момент.',
      })}
    >
      <Terminal x={28} y={y + h / 2} kind="start" />
      <Box x={xs[0]} y={y} width={w} height={h} title="loan" />
      <Box x={xs[1]} y={y} width={w} height={h} title="contacts" />
      <Box x={xs[2]} y={y} width={w} height={h} title="confirm" />
      <Terminal x={exit} y={184} kind="end" />

      <Arrow from={[35, y + h / 2]} to={[xs[0] - 2, y + h / 2]} />
      <Arrow
        from={[xs[0] + 40, y]}
        via={[
          [xs[0] + 40, 40],
          [xs[0] + 80, 40],
        ]}
        to={[xs[0] + 80, y - 2]}
      />
      <Label
        x={xs[0] + w / 2}
        y={30}
        anchor="middle"
        text={translate({ id: 'diagram.wizard.blocked', message: 'next() — есть замечания' })}
      />
      {[0, 1].map((i) => {
        const from = xs[i] + w;
        const to = xs[i + 1];
        return (
          <g key={i}>
            <Arrow from={[from, forward]} to={[to - 2, forward]} label={passed()} />
            <Arrow
              from={[to, back]}
              to={[from + 2, back]}
              label="previous()"
              labelAt={[(from + to) / 2, back + 18]}
              labelAnchor="middle"
            />
          </g>
        );
      })}
      <Arrow from={[exit, y + h]} to={[exit, 172]} label="submission.submit()" />
    </Diagram>
  );
}
