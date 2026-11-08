import { translate } from '@docusaurus/Translate';
import { Arrow, Box, Diagram } from './Diagram';

/**
 * Карта пакетов `@reformer/*`: кто на кого опирается.
 *
 * Стрелки — peer-зависимости из `package.json` пакетов, показана только ближайшая: ui-kit опирается
 * и на core, но через cdk, и вторая стрелка лишь зашумила бы схему. MCP стоит сбоку пунктиром:
 * в рантайм формы он не входит, а читает документацию и типы остальных пакетов.
 */
export function PackageMap() {
  const left = { x: 24, width: 320 };
  const right = { x: 416, width: 320 };
  const h = 64;
  const rows = [16, 128, 240, 352];
  const lx = left.x + left.width / 2;
  const rx = right.x + right.width / 2;

  return (
    <Diagram
      viewBox="0 0 760 430"
      title={translate({
        id: 'diagram.packages.title',
        message: 'Пакеты ReFormer и их зависимости',
      })}
      caption={translate({
        id: 'diagram.packages.caption',
        message:
          'Стрелка — «опирается на». Для формы хватает @reformer/core, остальное подключается по необходимости.',
      })}
    >
      <Box
        {...left}
        y={rows[0]}
        height={h}
        variant="ghost"
        title="@reformer/mcp"
        subtitle={translate({
          id: 'diagram.packages.mcp',
          message: 'справка и генерация форм для ИИ',
        })}
        to="/docs/mcp/overview"
      />
      <Box
        {...right}
        y={rows[0]}
        height={h}
        title="@reformer/form-registry"
        subtitle={translate({
          id: 'diagram.packages.formRegistry',
          message: 'формы между микрофронтендами',
        })}
        to="/docs/packages/form-registry"
      />

      <Box
        {...left}
        y={rows[1]}
        height={h}
        title="@reformer/ui-kit"
        subtitle={translate({
          id: 'diagram.packages.uiKit',
          message: 'готовые стилизованные поля',
        })}
        to="/docs/ui-kit/overview"
      />
      <Box
        {...right}
        y={rows[1]}
        height={h}
        title="@reformer/renderer-json"
        subtitle={translate({
          id: 'diagram.packages.rendererJson',
          message: 'форма из JSON-документа',
        })}
        to="/docs/packages/renderer-json"
      />

      <Box
        {...left}
        y={rows[2]}
        height={h}
        title="@reformer/cdk"
        subtitle={translate({
          id: 'diagram.packages.cdk',
          message: 'headless-компоненты: поле, массив, мастер',
        })}
        to="/docs/cdk/overview"
      />
      <Box
        {...right}
        y={rows[2]}
        height={h}
        title="@reformer/renderer-react"
        subtitle={translate({
          id: 'diagram.packages.rendererReact',
          message: 'рисует форму по дереву схемы',
        })}
        to="/docs/packages/renderer-react"
      />

      <Box
        x={left.x}
        y={rows[3]}
        width={right.x + right.width - left.x}
        height={h}
        variant="accent"
        title="@reformer/core"
        subtitle={translate({
          id: 'diagram.packages.core',
          message: 'модель, форма, валидация, поведение, хуки React',
        })}
        to="/docs/core-concepts/model"
      />

      <Arrow from={[rx, rows[0] + h]} to={[rx, rows[1] - 2]} />
      <Arrow from={[lx, rows[1] + h]} to={[lx, rows[2] - 2]} />
      <Arrow from={[rx, rows[1] + h]} to={[rx, rows[2] - 2]} />
      <Arrow from={[lx, rows[2] + h]} to={[lx, rows[3] - 2]} />
      <Arrow from={[rx, rows[2] + h]} to={[rx, rows[3] - 2]} />
    </Diagram>
  );
}
