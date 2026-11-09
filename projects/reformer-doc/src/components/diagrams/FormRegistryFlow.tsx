import { translate } from '@docusaurus/Translate';
import { Arrow, Box, Diagram, Group } from './Diagram';

/**
 * Как устроен `@reformer/form-registry`: поставщик регистрирует запись в общем реестре, хозяин
 * находит её местом монтирования, загрузчик собирает части формы. Схема с сервера (`kind: 'http'`)
 * — пунктиром: она есть, только если запись так описана.
 */
export function FormRegistryFlow() {
  const left = { x: 28, width: 200 };
  const host = { x: 452, width: 280 };
  const h = 56;
  const rows = [48, 148, 248, 348];
  const mid = (row: number) => rows[row] + h / 2;
  const hostAxis = host.x + host.width / 2;
  const leftAxis = left.x + left.width / 2;

  return (
    <Diagram
      viewBox="0 0 760 432"
      title={translate({ id: 'diagram.formRegistry.title', message: 'Как устроен реестр форм' })}
      caption={translate({
        id: 'diagram.formRegistry.caption',
        message:
          'Поставщик регистрирует форму, хозяин находит её по id, слоту или маршруту, загрузчик собирает и проверяет части. Пунктир — схема с сервера.',
      })}
    >
      <Group
        x={16}
        y={16}
        width={224}
        height={100}
        title={translate({
          id: 'diagram.formRegistry.provider',
          message: 'Микрофронтенд-поставщик',
        })}
      />
      <Group
        x={440}
        y={16}
        width={304}
        height={400}
        title={translate({ id: 'diagram.formRegistry.host', message: 'Приложение-хозяин' })}
      />

      <Box
        {...left}
        y={rows[0]}
        height={h}
        title="FormEntry"
        subtitle={translate({
          id: 'diagram.formRegistry.entry',
          message: 'схема + код формы',
        })}
        to="/docs/packages/form-registry/form-entry"
      />
      <Box
        {...left}
        y={rows[1]}
        height={h}
        variant="accent"
        title={translate({ id: 'diagram.formRegistry.registry', message: 'Реестр форм' })}
        subtitle="getFormRegistry()"
      />
      <Box
        {...left}
        y={rows[2]}
        height={h}
        variant="ghost"
        title={translate({ id: 'diagram.formRegistry.server', message: 'Сервер' })}
        subtitle={translate({ id: 'diagram.formRegistry.serverHint', message: 'JSON-схема' })}
        to="/docs/packages/form-registry/network-and-cache"
      />

      <Box
        {...host}
        y={rows[0]}
        height={h}
        title="FormRegistryProvider"
        subtitle={translate({
          id: 'diagram.formRegistry.providerHint',
          message: 'права, флаги, базовый реестр',
        })}
      />
      <Box
        {...host}
        y={rows[1]}
        height={h}
        title="FormOutlet"
        subtitle={translate({
          id: 'diagram.formRegistry.outletHint',
          message: 'или FormSlot, FormRoute',
        })}
        to="/docs/packages/form-registry/mounting"
      />
      <Box
        {...host}
        y={rows[2]}
        height={h}
        title="loadForm"
        subtitle={translate({
          id: 'diagram.formRegistry.loadHint',
          message: 'загрузка и проверки',
        })}
        to="/docs/packages/form-registry/checks"
      />
      <Box {...host} y={rows[3]} height={h} title="createForm + FormRenderer" />

      <Arrow from={[leftAxis, rows[0] + h]} to={[leftAxis, rows[1] - 2]} label="register" />
      <Arrow from={[hostAxis, rows[0] + h]} to={[hostAxis, rows[1] - 2]} />
      <Arrow
        from={[host.x, mid(1)]}
        to={[left.x + left.width + 2, mid(1)]}
        label={translate({
          id: 'diagram.formRegistry.lookup',
          message: 'id, слот, маршрут',
        })}
      />
      <Arrow from={[hostAxis, rows[1] + h]} to={[hostAxis, rows[2] - 2]} />
      <Arrow
        from={[left.x + left.width, mid(2)]}
        to={[host.x - 2, mid(2)]}
        label="kind: 'http'"
        dashed
      />
      <Arrow from={[hostAxis, rows[2] + h]} to={[hostAxis, rows[3] - 2]} />
    </Diagram>
  );
}
