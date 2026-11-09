import { translate } from '@docusaurus/Translate';
import { Arrow, Box, Diagram, Group } from './Diagram';

/**
 * Уровни над моделью: внизу — сигналы, над ними — уровень модели (дерево и два прокси), сверху —
 * уровни, которые читают модель через её прокси: форма, приложение, свой уровень. Стрелка —
 * «опирается на», как на карте пакетов.
 *
 * Уровни сходятся в шину, а она расходится к обоим прокси: любой уровень берёт и сигналы, и
 * значения. Даже форма: её ноды стоят над сигналами полей, а условия поведения и правила читают
 * значения (`model.name`).
 */
export function ModelLevels() {
  const top = { y: 16, h: 80 };
  const levels = [16, 264, 512];
  const levelW = 232;
  const proxies = { y: 172, h: 64, left: 32, right: 388, w: 340 };
  const tree = { y: 276, h: 64 };
  const runtime = { y: 400, h: 56 };
  const levelCenter = (i: number) => levels[i] + levelW / 2;
  /** Горизонталь шины — между уровнями и рамкой уровня модели. */
  const bus = 116;

  return (
    <Diagram
      viewBox="0 0 760 472"
      title={translate({ id: 'diagram.levels.title', message: 'Уровни над моделью' })}
      caption={translate({
        id: 'diagram.levels.caption',
        message:
          'Значения хранит только дерево модели. Любой уровень выше читает её через оба прокси и добавляет своё состояние; новый уровень добавляется без изменений модели.',
      })}
    >
      <Box
        x={levels[0]}
        y={top.y}
        width={levelW}
        height={top.h}
        title={translate({ id: 'diagram.levels.form', message: 'Уровень формы' })}
        subtitle={translate({
          id: 'diagram.levels.formHint',
          message: 'ноды и прокси form.x,\nпроверка, шаги, рендер',
        })}
        to="/docs/core-concepts/nodes"
      />
      <Box
        x={levels[1]}
        y={top.y}
        width={levelW}
        height={top.h}
        title={translate({ id: 'diagram.levels.app', message: 'Приложение' })}
        subtitle={translate({
          id: 'diagram.levels.appHint',
          message: 'компоненты и вычисления:\nuseSignalSnapshot, computed',
        })}
      />
      <Box
        x={levels[2]}
        y={top.y}
        width={levelW}
        height={top.h}
        variant="ghost"
        title={translate({ id: 'diagram.levels.custom', message: 'Свой уровень' })}
        subtitle={translate({
          id: 'diagram.levels.customHint',
          message: 'автосохранение, адресная\nстрока, аналитика',
        })}
      />

      <Group
        x={16}
        y={136}
        width={728}
        height={224}
        title={translate({ id: 'diagram.levels.model', message: 'Уровень модели' })}
      />
      <Box
        x={proxies.left}
        y={proxies.y}
        width={proxies.w}
        height={proxies.h}
        title={translate({ id: 'diagram.levels.signals', message: 'Прокси сигналов' })}
        subtitle="model.$.user.name"
        to="/docs/core-concepts/model"
      />
      <Box
        x={proxies.right}
        y={proxies.y}
        width={proxies.w}
        height={proxies.h}
        title={translate({ id: 'diagram.levels.values', message: 'Прокси значений' })}
        subtitle="model.user.name · model.get()"
        to="/docs/core-concepts/model"
      />
      <Box
        x={32}
        y={tree.y}
        width={696}
        height={tree.h}
        variant="accent"
        title={translate({ id: 'diagram.levels.tree', message: 'Дерево модели' })}
        subtitle={translate({
          id: 'diagram.levels.treeHint',
          message: 'сигнал под каждым полем и точка отсчёта — значения хранятся только здесь',
        })}
      />
      <Box
        x={16}
        y={runtime.y}
        width={728}
        height={runtime.h}
        title={translate({ id: 'diagram.levels.runtime', message: 'Сигналы' })}
        subtitle="signal · computed · effect — @reformer/core/signals"
        to="/docs/core-concepts/reactive-state"
      />

      {/* Шина: уровни сходятся в неё, она расходится к обоим прокси. */}
      <Arrow
        from={[levelCenter(0), top.y + top.h]}
        via={[
          [levelCenter(0), bus],
          [levelCenter(2), bus],
        ]}
        to={[levelCenter(2), top.y + top.h]}
        head={false}
      />
      <Arrow from={[levelCenter(1), top.y + top.h]} to={[levelCenter(1), bus]} head={false} />
      <Arrow
        from={[proxies.left + proxies.w / 2, bus]}
        to={[proxies.left + proxies.w / 2, proxies.y - 2]}
      />
      <Arrow
        from={[proxies.right + proxies.w / 2, bus]}
        to={[proxies.right + proxies.w / 2, proxies.y - 2]}
      />
      <Arrow
        from={[proxies.left + proxies.w / 2, proxies.y + proxies.h]}
        to={[proxies.left + proxies.w / 2, tree.y - 2]}
      />
      <Arrow
        from={[proxies.right + proxies.w / 2, proxies.y + proxies.h]}
        to={[proxies.right + proxies.w / 2, tree.y - 2]}
      />
      <Arrow from={[380, tree.y + tree.h]} to={[380, runtime.y - 2]} />
    </Diagram>
  );
}

/**
 * Пересечения прокси со значениями модели: один прокси указывает на несколько значений, к одному
 * значению ведут несколько прокси. Пример страницы: модель приложения `app`, шапка с `computed`,
 * форма профиля.
 */
export function ProxyOverlap() {
  const w = 164;
  const xs = [16, 204, 392, 580];
  const values = { y: 248, h: 56, xs: [32, 208, 384, 560], w: 160 };
  const bottom = 16 + 64;
  const end = values.y - 2;

  return (
    <Diagram
      viewBox="0 0 760 352"
      title={translate({
        id: 'diagram.overlap.title',
        message: 'Прокси и значения модели пересекаются',
      })}
      caption={translate({
        id: 'diagram.overlap.caption',
        message:
          'Один прокси указывает на несколько значений, к одному значению ведут несколько прокси. Запись через любой видна всем.',
      })}
    >
      <Box
        x={xs[0]}
        y={16}
        width={w}
        height={64}
        title="headerTitle"
        subtitle={translate({ id: 'diagram.overlap.computed', message: 'свой computed' })}
      />
      <Box
        x={xs[1]}
        y={16}
        width={w}
        height={64}
        title="model.$.user"
        subtitle={translate({ id: 'diagram.overlap.group', message: 'сигнал группы' })}
      />
      <Box
        x={xs[2]}
        y={16}
        width={w}
        height={64}
        title="form.email"
        subtitle={translate({ id: 'diagram.overlap.node', message: 'нода формы' })}
      />
      <Box
        x={xs[3]}
        y={16}
        width={w}
        height={64}
        title="model.theme"
        subtitle={translate({ id: 'diagram.overlap.value', message: 'прокси значения' })}
      />

      <Group
        x={16}
        y={232}
        width={728}
        height={104}
        title={translate({ id: 'diagram.overlap.model', message: 'Модель app — значения' })}
        titleAt="bottom"
      />
      {['cart.items', 'user.name', 'user.email', 'theme'].map((title, i) => (
        <Box
          key={title}
          x={values.xs[i]}
          y={values.y}
          width={values.w}
          height={values.h}
          title={title}
        />
      ))}

      <Arrow from={[78, bottom]} to={[112, end]} />
      <Arrow from={[118, bottom]} to={[268, end]} />
      <Arrow from={[266, bottom]} to={[298, end]} />
      <Arrow from={[306, bottom]} to={[444, end]} />
      <Arrow from={[474, bottom]} to={[474, end]} />
      <Arrow from={[662, bottom]} to={[640, end]} />
    </Diagram>
  );
}
