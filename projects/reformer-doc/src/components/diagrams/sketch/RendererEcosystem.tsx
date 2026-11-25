import { translate } from '@docusaurus/Translate';
import {
  DocIcon,
  SketchArrow,
  SketchBox,
  SketchCanvas,
  SketchRegion,
  SketchText,
  UserFigure,
  type Point,
} from './Sketch';

/**
 * Карта экосистемы для обзора рендереров — по эскизу автора, в его рукописном стиле.
 *
 * ReFormer (заштрихован) — ядро и рендереры. Полосы фреймворков: React — рендерер, Renderer-JSON,
 * headless CDK и UI-Kit; Vue и Angular — свой рендерер и кит над библиотекой компонентов. Киты
 * стоят вне ReFormer: их можно заменить своими. Справа — инструменты вокруг: MCP-сервер, ИИ-
 * ассистент, билдер и пользователь.
 *
 * Renderer-JSON стоит в полосе React, как на эскизе: документ рисует Renderer-React, а вход
 * `/neutral` собирает тот же документ для Vue и Angular — это сказано подписью блока и легендой.
 * Стрелки от него в нижние полосы пересекли бы связи китов.
 *
 * Значок документа — то, что читает ИИ: llms.txt пакетов, каталог кита, спецификация формы.
 */

/** Колонки и строки раскладки. */
const COL = { core: 52, renderer: 272, json: 490, right: 800 } as const;
// Колонка рендереров шире: в неё входит «Renderer-Angular».
const W = { core: 128, renderer: 184, json: 146, tool: 140 } as const;
const H = 66;
const LANE = { x: 236, width: 464 } as const;
const ROW = { react: 166, cdk: 266, uiKit: 386, vue: 531, angular: 671 } as const;
const mid = (top: number) => top + H / 2;
const rendererRight = COL.renderer + W.renderer;
const jsonRight = COL.json + W.json;

export function RendererEcosystem() {
  const experimental = translate({
    id: 'diagram.rendererEcosystem.experimental',
    message: 'экспериментальный',
  });
  const lanes: Array<{ title: string; tone: 'react' | 'vue' | 'angular'; y: number; h: number }> = [
    { title: 'React', tone: 'react', y: 104, h: 376 },
    { title: 'Vue', tone: 'vue', y: 508, h: 112 },
    { title: 'Angular', tone: 'angular', y: 648, h: 112 },
  ];
  const lane = (y: number, h: number): Point[] => [
    [LANE.x, y],
    [LANE.x + LANE.width, y],
    [LANE.x + LANE.width, y + h],
    [LANE.x, y + h],
  ];
  // ReFormer — «Г»: Core и колонка рендереров на все полосы, сверху ещё Renderer-JSON и CDK.
  const reformer: Point[] = [
    [28, 138],
    [jsonRight + 16, 138],
    [jsonRight + 16, 352],
    [rendererRight + 16, 352],
    [rendererRight + 16, 742],
    [28, 742],
  ];
  const legendX = 772;
  const legend = (y: number) => ({ sample: [legendX, y] as Point, text: legendX + 78 });

  return (
    <SketchCanvas
      viewBox="0 0 1240 800"
      // Вмещается в колонку документа на десктопе; уже — прокрутка, а не мелкий текст.
      minWidth={760}
      title={translate({
        id: 'diagram.rendererEcosystem.title',
        message: 'Экосистема ReFormer: рендереры React, Vue и Angular и инструменты вокруг',
      })}
      caption={translate({
        id: 'diagram.rendererEcosystem.caption',
        message:
          'Ядро и рендереры ReFormer, полосы фреймворков с китами и инструменты вокруг — MCP-сервер, ИИ-ассистент и билдер. Renderer-JSON рисует документ через Renderer-React, а вход /neutral собирает тот же документ для Vue и Angular. Блоки ведут на страницы пакетов.',
      })}
    >
      <SketchRegion
        kind="dotted"
        tone="ink"
        seed="frame"
        points={[
          [10, 10],
          [1230, 10],
          [1230, 790],
          [10, 790],
        ]}
      />

      {/* Полосы фреймворков и ReFormer поверх них. */}
      {lanes.map(({ title, tone, y, h }) => (
        <SketchRegion
          key={title}
          kind="dashed"
          tone={tone}
          points={lane(y, h)}
          title={title}
          // Над кромкой справа: слева под ней штриховка ReFormer, внутри — блоки китов.
          titleAt={[LANE.x + LANE.width - 6, y - 8]}
          titleAnchor="end"
        />
      ))}
      <SketchRegion
        kind="hatch"
        tone="reformer"
        points={reformer}
        title="ReFormer"
        titleAt={[38, 128]}
      />

      {/* Стрелки — под блоками: концы прячутся под контур. */}
      {/* Рендереры и CDK опираются на Core. */}
      <SketchArrow
        points={[
          [COL.renderer, mid(ROW.react)],
          [COL.core + W.core + 2, mid(ROW.react) + 4],
        ]}
      />
      <SketchArrow
        points={[
          [COL.renderer, ROW.cdk + 26],
          [COL.core + W.core + 4, ROW.react + 62],
        ]}
      />
      <SketchArrow
        points={[
          [COL.renderer, ROW.vue + 25],
          [132, ROW.vue + 25],
          [132, ROW.react + H + 12],
        ]}
      />
      <SketchArrow
        points={[
          [COL.renderer, ROW.angular + 41],
          [82, ROW.angular + 41],
          [82, ROW.react + H + 12],
        ]}
      />
      {/* Renderer-JSON рисует через Renderer-React; киты — над своими рендерерами. */}
      <SketchArrow
        points={[
          [COL.json, mid(ROW.react)],
          [rendererRight + 2, mid(ROW.react)],
        ]}
      />
      <SketchArrow
        points={[
          [COL.json + W.json / 2, ROW.uiKit],
          [COL.json + W.json / 2, ROW.cdk + 46],
          [rendererRight + 2, ROW.cdk + 46],
        ]}
      />
      <SketchArrow
        points={[
          [COL.json, mid(ROW.vue)],
          [rendererRight + 2, mid(ROW.vue)],
        ]}
      />
      <SketchArrow
        points={[
          [COL.json, mid(ROW.angular)],
          [rendererRight + 2, mid(ROW.angular)],
        ]}
      />

      {/* MCP-сервер печатает код на Core — дуга поверх всего. */}
      <SketchArrow
        points={[
          [COL.right + W.tool / 2, ROW.react],
          [COL.right + W.tool / 2, 66],
          [150, 66],
          [150, ROW.react + 4],
        ]}
      />
      {/* Читают и пишут: MCP — каталог кита, билдер — JSON-документ и кит. */}
      <SketchArrow
        line="dashed"
        points={[
          [jsonRight, ROW.uiKit + 14],
          [760, ROW.uiKit + 14],
          [760, ROW.react + 44],
          [COL.right - 2, ROW.react + 44],
        ]}
      />
      <SketchArrow
        line="dashed"
        points={[
          [COL.right, 446],
          [736, 446],
          [736, ROW.react + 48],
          [jsonRight + 2, ROW.react + 48],
        ]}
      />
      <SketchArrow
        line="dashed"
        heads="both"
        points={[
          [jsonRight + 2, ROW.uiKit + 50],
          [716, ROW.uiKit + 50],
          [716, 482],
          [COL.right - 2, 482],
        ]}
      />
      <SketchArrow
        line="dashed"
        points={[
          [COL.right + W.tool, 201],
          [1015, 201],
          [1015, 274],
        ]}
      />
      <SketchArrow
        line="dashed"
        heads="both"
        points={[
          [1015, 348],
          [1015, 456],
          [COL.right + W.tool + 2, 456],
        ]}
      />
      {/* Пользователь работает с ассистентом и билдером. */}
      <SketchArrow
        line="dotted"
        points={[
          [1128, 230],
          [1128, 318],
          [1092, 318],
        ]}
      />
      <SketchArrow
        line="dotted"
        points={[
          [1172, 230],
          [1172, 488],
          [COL.right + W.tool + 2, 488],
        ]}
      />

      {/* Блоки. */}
      <SketchBox
        x={COL.core}
        y={172}
        width={W.core}
        height={70}
        title="Core"
        tone="reformer"
        to="/docs/core-concepts/model"
      />
      <SketchBox
        x={COL.renderer}
        y={ROW.react}
        width={W.renderer}
        height={H}
        title="Renderer-React"
        tone="react"
        to="/docs/packages/renderer-react"
      />
      <SketchBox
        x={COL.json}
        y={ROW.react}
        width={W.json}
        height={H}
        title="Renderer-JSON"
        subtitle="+ /neutral"
        tone="react"
        to="/docs/packages/renderer-json"
      />
      <SketchBox
        x={COL.renderer}
        y={ROW.cdk}
        width={W.renderer}
        height={H}
        title="CDK"
        subtitle="headless"
        tone="react"
        to="/docs/cdk/overview"
      />
      <SketchBox
        x={COL.json}
        y={ROW.uiKit}
        width={W.json}
        height={H}
        title="UI-Kit"
        subtitle="kit1 / kit2"
        tone="react"
        dashed
        stack={2}
        to="/docs/ui-kit/overview"
      />
      <SketchBox
        x={COL.renderer}
        y={ROW.vue}
        width={W.renderer}
        height={H}
        title="Renderer-Vue"
        subtitle={experimental}
        tone="vue"
        to="/docs/packages/renderer-vue"
      />
      <SketchBox
        x={COL.json}
        y={ROW.vue}
        width={W.json}
        height={H}
        title="Kit-Vuetify"
        subtitle="Vuetify"
        tone="vue"
        dashed
        to="/docs/packages/renderer-vue"
      />
      <SketchBox
        x={COL.renderer}
        y={ROW.angular}
        width={W.renderer}
        height={H}
        title="Renderer-Angular"
        subtitle={experimental}
        tone="angular"
        to="/docs/packages/renderer-angular"
      />
      <SketchBox
        x={COL.json}
        y={ROW.angular}
        width={W.json}
        height={H}
        title="Kit-Taiga"
        subtitle="Taiga UI"
        tone="angular"
        dashed
        to="/docs/packages/renderer-angular"
      />
      <SketchBox
        x={COL.right}
        y={ROW.react}
        width={W.tool}
        height={70}
        title="MCP-server"
        subtitle="CLI / Web"
        tone="mcp"
        to="/docs/mcp/overview"
      />
      <SketchBox
        x={940}
        y={276}
        width={150}
        height={70}
        title="AI-assistant"
        subtitle="Cross app"
        tone="ai"
      />
      <SketchBox
        x={COL.right}
        y={426}
        width={W.tool}
        height={70}
        title="UI Builder"
        subtitle="pwa"
        tone="builder"
        to="/docs/builder/overview"
      />
      <UserFigure cx={1150} top={96} label="User" />

      {/* Документы, которые читает ИИ, и сноска к киту. */}
      <DocIcon x={62} y={146} seed="doc:core" />
      <DocIcon x={jsonRight + 8} y={ROW.uiKit - 18} seed="doc:kit1" />
      <DocIcon x={jsonRight + 8} y={ROW.uiKit + 58} seed="doc:kit2" />
      <DocIcon x={COL.right - 12} y={502} seed="doc:builder" />
      <DocIcon x={1098} y={232} seed="doc:user" />
      <SketchText x={COL.json - 12} y={ROW.uiKit + H + 36} size={30} tone="angular">
        *
      </SketchText>

      {/* Легенда. */}
      <SketchArrow seed="legend:solid" points={[legend(590).sample, [legendX + 58, 590]]} />
      <SketchText x={legend(590).text} y={596} size={17}>
        {translate({ id: 'diagram.rendererEcosystem.legendDepends', message: 'опирается на' })}
      </SketchText>
      <SketchArrow
        seed="legend:dashed"
        line="dashed"
        points={[legend(626).sample, [legendX + 58, 626]]}
      />
      <SketchText x={legend(626).text} y={632} size={17}>
        {translate({
          id: 'diagram.rendererEcosystem.legendReads',
          message: 'читает и пишет: документы, каталог кита',
        })}
      </SketchText>
      <SketchArrow
        seed="legend:dotted"
        line="dotted"
        points={[legend(662).sample, [legendX + 58, 662]]}
      />
      <SketchText x={legend(662).text} y={668} size={17}>
        {translate({ id: 'diagram.rendererEcosystem.legendWorks', message: 'работает с' })}
      </SketchText>
      <DocIcon x={legendX + 20} y={688} seed="legend:doc" />
      <SketchText x={legend(700).text} y={704} size={17}>
        {translate({
          id: 'diagram.rendererEcosystem.legendDocs',
          message: 'документы для ИИ: llms.txt, каталог кита,',
        })}
      </SketchText>
      <SketchText x={legend(700).text} y={724} size={17}>
        {translate({
          id: 'diagram.rendererEcosystem.legendDocs2',
          message: 'спецификация формы',
        })}
      </SketchText>
      <SketchText x={legendX + 22} y={764} size={30} tone="angular">
        *
      </SketchText>
      <SketchText x={legend(760).text} y={758} size={17}>
        {translate({
          id: 'diagram.rendererEcosystem.legendKit',
          message: 'кит заменяемый: свой — под любую',
        })}
      </SketchText>
      <SketchText x={legend(760).text} y={778} size={17}>
        {translate({
          id: 'diagram.rendererEcosystem.legendKit2',
          message: 'библиотеку компонентов',
        })}
      </SketchText>
    </SketchCanvas>
  );
}
