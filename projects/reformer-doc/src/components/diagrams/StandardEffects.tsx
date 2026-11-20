import { translate } from '@docusaurus/Translate';
import { Arrow, Box, Diagram, Group } from './Diagram';

/**
 * «Один стандарт — много следствий» для страницы «Какие задачи решает ReFormer».
 *
 * Сверху — кто пишет форму: человек, MCP-сервер и билдер. Все трое сходятся в один стандарт
 * (модель, схема, правила, поведение), а из него — группа следствий. Следствия нарисованы
 * группой, а не цепочкой: каждое вытекает из стандарта, а не из соседнего блока.
 */
export function StandardEffects() {
  const authorY = 16;
  const authorH = 60;
  const authors = [
    { x: 30, title: 'human' },
    { x: 280, title: 'mcp' },
    { x: 530, title: 'builder' },
  ] as const;
  const authorW = 200;

  const root = { x: 180, y: 128, width: 400, height: 72 };
  const rootCx = root.x + root.width / 2;

  const group = { x: 16, y: 244, width: 728, height: 196 };
  const effectW = 208;
  const effectH = 64;
  const cols = [36, 276, 516];
  const rows = [280, 360];

  const effects = [
    {
      title: translate({ id: 'diagram.standardEffects.readability', message: 'Читаемость' }),
      subtitle: translate({
        id: 'diagram.standardEffects.readability.sub',
        message: 'один файл — один вопрос',
      }),
    },
    {
      title: translate({ id: 'diagram.standardEffects.load', message: 'Меньше нагрузки' }),
      subtitle: translate({
        id: 'diagram.standardEffects.load.sub',
        message: 'не держать всё в голове',
      }),
    },
    {
      title: translate({ id: 'diagram.standardEffects.review', message: 'Ревью без проблем' }),
      subtitle: translate({
        id: 'diagram.standardEffects.review.sub',
        message: 'правка — дифф одного файла',
      }),
    },
    {
      title: translate({ id: 'diagram.standardEffects.maintenance', message: 'Сопровождение' }),
      subtitle: translate({
        id: 'diagram.standardEffects.maintenance.sub',
        message: 'разметка и правила порознь',
      }),
    },
    {
      title: translate({ id: 'diagram.standardEffects.onboarding', message: 'Онбординг' }),
      subtitle: translate({
        id: 'diagram.standardEffects.onboarding.sub',
        message: 'файл находится по имени',
      }),
    },
    {
      title: translate({ id: 'diagram.standardEffects.aiCode', message: 'Код от ИИ — обычный' }),
      subtitle: translate({
        id: 'diagram.standardEffects.aiCode.sub',
        message: 'его правит и человек',
      }),
    },
  ];

  const authorText = {
    human: {
      title: translate({ id: 'diagram.standardEffects.human', message: 'Человек' }),
      subtitle: translate({ id: 'diagram.standardEffects.human.sub', message: 'пишет руками' }),
      to: undefined,
    },
    mcp: {
      title: 'MCP',
      subtitle: translate({ id: 'diagram.standardEffects.mcp.sub', message: 'ИИ-ассистент' }),
      to: '/docs/mcp/overview',
    },
    builder: {
      title: translate({ id: 'diagram.standardEffects.builder', message: 'Билдер' }),
      subtitle: translate({
        id: 'diagram.standardEffects.builder.sub',
        message: 'визуальный редактор',
      }),
      to: '/docs/builder/overview',
    },
  } as const;

  const authorBottom = authorY + authorH;
  const busY = authorBottom + 26;

  return (
    <Diagram
      viewBox="0 0 760 456"
      title={translate({
        id: 'diagram.standardEffects.title',
        message: 'Один стандарт формы и его следствия',
      })}
      caption={translate({
        id: 'diagram.standardEffects.caption',
        message:
          'Человек, MCP и билдер пишут форму одинаково, поэтому следствия стандарта есть у любого кода формы — кто бы его ни написал.',
      })}
    >
      {authors.map(({ x, title }) => (
        <Box
          key={title}
          x={x}
          y={authorY}
          width={authorW}
          height={authorH}
          variant="ghost"
          title={authorText[title].title}
          subtitle={authorText[title].subtitle}
          to={authorText[title].to}
        />
      ))}

      <Arrow
        from={[authors[0].x + authorW / 2, authorBottom]}
        via={[
          [authors[0].x + authorW / 2, busY],
          [root.x + 40, busY],
        ]}
        to={[root.x + 40, root.y]}
      />
      <Arrow
        from={[rootCx, authorBottom]}
        to={[rootCx, root.y]}
        label={translate({
          id: 'diagram.standardEffects.writes',
          message: 'пишут по стандарту',
        })}
        labelAt={[rootCx + 10, root.y - 8]}
      />
      <Arrow
        from={[authors[2].x + authorW / 2, authorBottom]}
        via={[
          [authors[2].x + authorW / 2, busY],
          [root.x + root.width - 40, busY],
        ]}
        to={[root.x + root.width - 40, root.y]}
      />

      <Box
        {...root}
        variant="accent"
        title={translate({
          id: 'diagram.standardEffects.root',
          message: 'Один стандарт формы',
        })}
        subtitle={translate({
          id: 'diagram.standardEffects.root.sub',
          message: 'модель · схема · правила · поведение',
        })}
      />

      <Arrow from={[rootCx, root.y + root.height]} to={[rootCx, group.y]} />

      <Group
        {...group}
        title={translate({ id: 'diagram.standardEffects.effects', message: 'Следствия' })}
      />
      {effects.map((effect, index) => (
        <Box
          key={effect.title}
          x={cols[index % 3]}
          y={rows[Math.floor(index / 3)]}
          width={effectW}
          height={effectH}
          title={effect.title}
          subtitle={effect.subtitle}
        />
      ))}
    </Diagram>
  );
}
