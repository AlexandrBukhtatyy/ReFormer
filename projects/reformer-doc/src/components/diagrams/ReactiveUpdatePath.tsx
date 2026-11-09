import { translate } from '@docusaurus/Translate';
import { Arrow, Box, Diagram } from './Diagram';

/**
 * Как изменение доходит до экрана: запись → сигнал поля → состояние ноды → хук React →
 * перерисовка одного поля. Пять шагов не помещаются в строку, поэтому цепочка переносится на
 * вторую строку, как текст.
 */
export function ReactiveUpdatePath() {
  const w = 220;
  const [c0, c1, c2] = [16, 270, 524];
  const top = 16;
  const topH = 80;
  const bottom = 160;
  const bottomH = 64;
  const topMid = top + topH / 2;
  const bottomMid = bottom + bottomH / 2;

  return (
    <Diagram
      viewBox="0 0 760 240"
      title={translate({
        id: 'diagram.reactive.title',
        message: 'Как изменение доходит до экрана',
      })}
      caption={translate({
        id: 'diagram.reactive.caption',
        message:
          'Новое значение доходит только до хука, который читает эту ноду, — перерисовывается одно поле.',
      })}
    >
      <Box
        x={c0}
        y={top}
        width={w}
        height={topH}
        title={translate({ id: 'diagram.reactive.write', message: 'Ввод в поле' })}
        subtitle={translate({ id: 'diagram.reactive.writeHint', message: 'или запись в модель' })}
      />
      <Box
        x={c1}
        y={top}
        width={w}
        height={topH}
        variant="accent"
        title={translate({ id: 'diagram.reactive.signal', message: 'Сигнал поля' })}
        subtitle="model.$.email"
        to="/docs/core-concepts/model"
      />
      <Box
        x={c2}
        y={top}
        width={w}
        height={topH}
        title={translate({ id: 'diagram.reactive.node', message: 'Состояние ноды' })}
        subtitle={['form.email:', 'value, dirty, issues']}
        to="/docs/core-concepts/nodes"
      />
      <Box
        x={c0}
        y={bottom}
        width={w}
        height={bottomH}
        title={translate({ id: 'diagram.reactive.hook', message: 'Хук React' })}
        subtitle="useFormControl"
        to="/docs/react/hooks"
      />
      <Box
        x={c1}
        y={bottom}
        width={w}
        height={bottomH}
        title={translate({ id: 'diagram.reactive.render', message: 'Перерисовка' })}
        subtitle={translate({ id: 'diagram.reactive.renderHint', message: 'только этого поля' })}
      />

      <Arrow from={[c0 + w, topMid]} to={[c1 - 2, topMid]} />
      <Arrow from={[c1 + w, topMid]} to={[c2 - 2, topMid]} />
      <Arrow
        from={[c2 + w / 2, top + topH]}
        via={[
          [c2 + w / 2, 128],
          [c0 + w / 2, 128],
        ]}
        to={[c0 + w / 2, bottom - 2]}
      />
      <Arrow from={[c0 + w, bottomMid]} to={[c1 - 2, bottomMid]} />
    </Diagram>
  );
}
