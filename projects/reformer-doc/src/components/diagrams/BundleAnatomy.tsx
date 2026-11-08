import { translate } from '@docusaurus/Translate';
import { Arrow, Box, Diagram } from './Diagram';
import styles from './diagram.module.css';

/** Подпись над горизонтальной стрелкой: у `Arrow` подпись ложится на саму линию. */
function OverLabel({ x, y, text }: { x: number; y: number; text: string }) {
  return (
    <text x={x} y={y} textAnchor="middle" className={styles.arrowLabel}>
      {text}
    </text>
  );
}

/**
 * Анатомия сборки формы: части объекта, который возвращает `createForm` (`FormBundle`), и какая
 * часть какой пользуется.
 *
 * Состав — по интерфейсу `FormBundle` (`packages/reformer/src/form/form-bundle.ts`) и уровню формы
 * `FormLevel` (`form-level.ts`): `model`, `form`, `render`, `validate()` / `validateStep(id)`,
 * `flow`, `submission`. Служебные `validating`, `validation` и `dispose()` на схеме не показаны —
 * они не меняют картину связей. `flow` нарисован пунктиром: без `flow` в конфиге его нет.
 */
export function BundleAnatomy() {
  const h = 64;
  const top = 16;
  const middle = 152;
  const bottom = 288;

  const render = { x: 24, width: 220 };
  const flow = { x: 270, width: 220 };
  const submission = { x: 516, width: 220 };
  const form = { x: 24, width: 300 };
  const check = { x: 436, width: 300 };

  return (
    <Diagram
      viewBox="0 0 760 368"
      title={translate({
        id: 'diagram.bundle.title',
        message: 'Из чего состоит сборка формы',
      })}
      caption={translate({
        id: 'diagram.bundle.caption',
        message:
          'Части объекта, который возвращает createForm. Стрелка ведёт к части, которой пользуется другая. Пунктир — часть есть, только если её описали в конфиге.',
      })}
    >
      <Box
        {...render}
        y={top}
        height={h}
        title="render"
        subtitle={translate({
          id: 'diagram.bundle.render',
          message: 'дерево схемы для рендерера',
        })}
        to="/docs/packages/renderer-react"
      />
      <Box
        {...flow}
        y={top}
        height={h}
        variant="ghost"
        title="flow"
        subtitle={translate({
          id: 'diagram.bundle.flow',
          message: 'шаги: next(), goTo()',
        })}
        to="/docs/cdk/form-wizard"
      />
      <Box
        {...submission}
        y={top}
        height={h}
        title="submission"
        subtitle={translate({
          id: 'diagram.bundle.submission',
          message: 'submit(handler), submitting',
        })}
        to="/docs/patterns/submit-and-reset"
      />

      <Box
        {...form}
        y={middle}
        height={h}
        title="form"
        subtitle={translate({
          id: 'diagram.bundle.form',
          message: 'ноды: касание, замечания, доступность',
        })}
        to="/docs/core-concepts/nodes"
      />
      <Box
        {...check}
        y={middle}
        height={h}
        title="validate()"
        subtitle={translate({
          id: 'diagram.bundle.validate',
          message: 'проверка формы и шага по правилам',
        })}
        to="/docs/validation/overview"
      />

      <Box
        x={24}
        y={bottom}
        width={712}
        height={h}
        variant="accent"
        title="model"
        subtitle={translate({
          id: 'diagram.bundle.model',
          message: 'значения формы и сигналы полей model.$.x',
        })}
        to="/docs/core-concepts/model"
      />

      {/* Верхний ряд пользуется средним. */}
      <Arrow
        from={[134, top + h]}
        to={[134, middle - 2]}
        label={translate({ id: 'diagram.bundle.arrowDraws', message: 'рисует поля' })}
      />
      <Arrow
        from={[463, top + h]}
        to={[463, middle - 2]}
        label={translate({ id: 'diagram.bundle.arrowStepRules', message: 'правила шага' })}
      />
      <Arrow
        from={[626, top + h]}
        to={[626, middle - 2]}
        label={translate({ id: 'diagram.bundle.arrowCheckFirst', message: 'сначала проверка' })}
      />

      {/* Проверка разносит замечания по нодам. */}
      <Arrow from={[check.x, middle + h / 2]} to={[form.x + form.width + 2, middle + h / 2]} />
      <OverLabel
        x={(check.x + form.x + form.width) / 2}
        y={middle + h / 2 - 8}
        text={translate({ id: 'diagram.bundle.arrowIssues', message: 'ставит замечания' })}
      />

      {/* Всё держится на модели. */}
      <Arrow
        from={[174, middle + h]}
        to={[174, bottom - 2]}
        label={translate({ id: 'diagram.bundle.arrowValues', message: 'читает и пишет значения' })}
      />
      <Arrow
        from={[586, middle + h]}
        to={[586, bottom - 2]}
        label={translate({ id: 'diagram.bundle.arrowReads', message: 'читает значения' })}
      />
    </Diagram>
  );
}
