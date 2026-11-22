import { translate } from '@docusaurus/Translate';
import { Arrow, Box, Diagram } from './Diagram';

/**
 * Архитектура M1: четыре слоя описания формы сходятся в одном вызове `createForm`.
 *
 * Слои — по разделу «Философия» введения: модель (`createModel`), схема (дерево узлов),
 * валидация (`defineValidation`), поведение (`defineFormBehavior`). Сборка выделена: это то,
 * что получает приложение.
 */
export function ArchitectureM1() {
  const w = 170;
  const h = 80;
  const top = 16;
  const bottom = 160;
  const columns = [16, 202, 388, 574];
  const center = (x: number) => x + w / 2;

  return (
    <Diagram
      viewBox="0 0 760 240"
      title={translate({
        id: 'diagram.m1.title',
        message: 'Архитектура M1: четыре слоя формы',
      })}
      caption={translate({
        id: 'diagram.m1.caption',
        message:
          'Каждый слой описывается отдельно и сходится в createForm. Модель и схема — какие данные собираем, валидация — правильны ли они, поведение — как они реагируют.',
      })}
    >
      <Box
        x={columns[0]}
        y={top}
        width={w}
        height={h}
        title={translate({ id: 'diagram.m1.model', message: 'Модель' })}
        subtitle={[
          'createModel',
          translate({ id: 'diagram.m1.modelHint', message: 'значения формы' }),
        ]}
        to="/docs/core-concepts/model"
      />
      <Box
        x={columns[1]}
        y={top}
        width={w}
        height={h}
        title={translate({ id: 'diagram.m1.schema', message: 'Схема' })}
        subtitle={[
          translate({ id: 'diagram.m1.schemaHint1', message: 'дерево узлов:' }),
          translate({ id: 'diagram.m1.schemaHint2', message: 'поле ↔ компонент' }),
        ]}
        to="/docs/core-concepts/schemas/form-schema"
      />
      <Box
        x={columns[2]}
        y={top}
        width={w}
        height={h}
        title={translate({ id: 'diagram.m1.validation', message: 'Валидация' })}
        subtitle={[
          'defineValidation',
          translate({ id: 'diagram.m1.validationHint', message: 'правила' }),
        ]}
        to="/docs/core-concepts/schemas/validation-schema"
      />
      <Box
        x={columns[3]}
        y={top}
        width={w}
        height={h}
        title={translate({ id: 'diagram.m1.behavior', message: 'Поведение' })}
        subtitle={[
          'defineFormBehavior',
          translate({ id: 'diagram.m1.behaviorHint', message: 'реакции на изменения' }),
        ]}
        to="/docs/core-concepts/schemas/behavior-schema"
      />

      <Box
        x={columns[0]}
        y={bottom}
        width={columns[3] + w - columns[0]}
        height={64}
        variant="accent"
        title="createForm"
        subtitle={translate({
          id: 'diagram.m1.form',
          message: 'форма: ноды полей поверх сигналов модели',
        })}
        to="/docs/core-concepts/nodes"
      />

      {columns.map((x) => (
        <Arrow key={x} from={[center(x), top + h]} to={[center(x), bottom - 2]} />
      ))}
    </Diagram>
  );
}
