import { translate } from '@docusaurus/Translate';
import { Arrow, Box, Diagram } from './Diagram';

/**
 * Откуда берётся текст замечания: словарь формы → словарь языка → встроенный английский →
 * сам код. Цепочка переносится на вторую строку, как текст.
 */
export function IssueMessageLookup() {
  const w = 200;
  const [c0, c1, c2] = [16, 280, 544];
  const h = 64;
  const [top, bottom] = [16, 168];
  const [topMid, bottomMid] = [top + h / 2, bottom + h / 2];
  const noKey = () => translate({ id: 'diagram.issueText.noKey', message: 'нет ключа' });

  return (
    <Diagram
      viewBox="0 0 760 248"
      title={translate({
        id: 'diagram.issueText.title',
        message: 'Откуда берётся текст замечания',
      })}
      caption={translate({
        id: 'diagram.issueText.caption',
        message:
          'Текст ищется по цепочке словарей в момент показа. Не нашёлся нигде — показывается сам код.',
      })}
    >
      <Box
        x={c0}
        y={top}
        width={w}
        height={h}
        variant="accent"
        title={translate({ id: 'diagram.issueText.issue', message: 'замечание' })}
        subtitle={translate({ id: 'diagram.issueText.issueHint', message: 'код и параметры' })}
      />
      <Box
        x={c1}
        y={top}
        width={w}
        height={h}
        title={translate({ id: 'diagram.issueText.form', message: 'словарь формы' })}
        subtitle="defineIssueMessages"
      />
      <Box
        x={c2}
        y={top}
        width={w}
        height={h}
        title={translate({ id: 'diagram.issueText.locale', message: 'словарь языка' })}
        subtitle={translate({ id: 'diagram.issueText.localeHint', message: 'ключ validation.*' })}
      />
      <Box
        x={c0}
        y={bottom}
        width={w}
        height={h}
        title={translate({ id: 'diagram.issueText.builtIn', message: 'встроенный' })}
        subtitle={translate({ id: 'diagram.issueText.builtInHint', message: 'английский' })}
      />
      <Box
        x={c1}
        y={bottom}
        width={w}
        height={h}
        title={translate({ id: 'diagram.issueText.code', message: 'сам код' })}
      />

      <Arrow from={[c0 + w, topMid]} to={[c1 - 2, topMid]} />
      <Arrow
        from={[c1 + w, topMid]}
        to={[c2 - 2, topMid]}
        label={translate({ id: 'diagram.issueText.noCode', message: 'нет кода' })}
      />
      <Arrow
        from={[c2 + w / 2, top + h]}
        via={[
          [c2 + w / 2, 124],
          [c0 + w / 2, 124],
        ]}
        to={[c0 + w / 2, bottom - 2]}
        label={noKey()}
        labelAt={[c2 + w / 2 + 8, 106]}
      />
      <Arrow from={[c0 + w, bottomMid]} to={[c1 - 2, bottomMid]} label={noKey()} />
    </Diagram>
  );
}
