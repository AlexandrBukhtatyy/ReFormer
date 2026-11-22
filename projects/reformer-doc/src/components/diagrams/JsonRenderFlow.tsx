import { translate } from '@docusaurus/Translate';
import { Arrow, Box, Diagram } from './Diagram';

/**
 * Путь формы из JSON до страницы: документ и реестр сходятся в сборке `createForm`, сборку рисует
 * `FormRenderer`. Код формы (модель, правила, поведение) стоит пунктиром: он входит в ту же
 * сборку, но в JSON-документ не попадает.
 */
export function JsonRenderFlow() {
  const left = { x: 16, width: 230 };
  const mid = { x: 300, width: 190 };
  const right = { x: 544, width: 200 };
  const h = 64;
  const rows = [16, 120, 224];
  const midY = rows[1] + h / 2;
  const leftEdge = left.x + left.width;
  const rightCx = right.x + right.width / 2;

  return (
    <Diagram
      viewBox="0 0 760 304"
      title={translate({
        id: 'diagram.jsonRender.title',
        message: 'Как форма из JSON попадает на страницу',
      })}
      caption={translate({
        id: 'diagram.jsonRender.caption',
        message:
          'Документ — данные, реестр связывает имена из документа с кодом. Собирает форму createForm, рисует FormRenderer — те же, что для схемы на TypeScript.',
      })}
    >
      <Box
        {...left}
        y={rows[0]}
        height={h}
        title={translate({ id: 'diagram.jsonRender.document', message: 'JSON-документ' })}
        subtitle="$model · $component · $html"
        to="/docs/packages/renderer-json/document-format"
      />
      <Box
        {...left}
        y={rows[1]}
        height={h}
        title={translate({ id: 'diagram.jsonRender.registry', message: 'Реестр' })}
        subtitle={translate({
          id: 'diagram.jsonRender.registryHint',
          message: 'имена → компоненты и данные',
        })}
        to="/docs/packages/renderer-json/registry"
      />
      <Box
        {...left}
        y={rows[2]}
        height={h}
        variant="ghost"
        title={translate({ id: 'diagram.jsonRender.code', message: 'Код формы' })}
        subtitle={translate({
          id: 'diagram.jsonRender.codeHint',
          message: 'модель, правила, поведение',
        })}
      />

      <Box
        {...mid}
        y={rows[1]}
        height={h}
        variant="accent"
        title="createForm"
        subtitle={translate({
          id: 'diagram.jsonRender.createFormHint',
          message: 'строит дерево и ноды',
        })}
      />

      <Box
        {...right}
        y={rows[1]}
        height={h}
        title="FormRenderer"
        subtitle={translate({
          id: 'diagram.jsonRender.rendererHint',
          message: 'рисует сборку формы',
        })}
        to="/docs/packages/renderer-react"
      />
      <Box
        {...right}
        y={rows[2]}
        height={h}
        title={translate({ id: 'diagram.jsonRender.page', message: 'Форма на странице' })}
        subtitle={translate({
          id: 'diagram.jsonRender.pageHint',
          message: 'поля, замечания, шаги',
        })}
      />

      <Arrow from={[leftEdge, rows[0] + h / 2]} to={[mid.x - 2, midY - 16]} />
      <Arrow from={[leftEdge, midY]} to={[mid.x - 2, midY]} />
      <Arrow from={[leftEdge, rows[2] + h / 2]} to={[mid.x - 2, midY + 16]} dashed />
      <Arrow from={[mid.x + mid.width, midY]} to={[right.x - 2, midY]} />
      <Arrow from={[rightCx, rows[1] + h]} to={[rightCx, rows[2] - 2]} />
    </Diagram>
  );
}
