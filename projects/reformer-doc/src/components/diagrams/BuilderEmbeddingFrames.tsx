import type { CSSProperties } from 'react';
import { translate } from '@docusaurus/Translate';
import { Arrow, Diagram } from './Diagram';

/**
 * Билдер внутри приложения: какие документы вложены друг в друга и кто их отдаёт.
 *
 * Страница приложения → рамка оболочки билдера → рамки превью, в которых форму рисует само
 * приложение. Справа — dev-сервер Vite с плагином `reformerBuilder()` и папка проекта на диске.
 * Цвета — только переменные темы Infima, поэтому схема верна в обеих темах.
 */

const SURFACE: CSSProperties = {
  fill: 'var(--ifm-background-surface-color)',
  stroke: 'var(--ifm-color-emphasis-400)',
  strokeWidth: 1.5,
};

const ACCENT: CSSProperties = {
  fill: 'color-mix(in srgb, var(--ifm-color-primary) 10%, var(--ifm-background-surface-color))',
  stroke: 'var(--ifm-color-primary)',
  strokeWidth: 1.5,
};

const GHOST: CSSProperties = {
  fill: 'none',
  stroke: 'var(--ifm-color-emphasis-500)',
  strokeWidth: 1.5,
  strokeDasharray: '6 4',
};

const TITLE: CSSProperties = {
  fill: 'var(--ifm-font-color-base)',
  fontSize: 14,
  fontWeight: 600,
};

const CODE: CSSProperties = {
  fill: 'var(--ifm-font-color-base)',
  fontFamily: 'var(--ifm-font-family-monospace)',
  fontSize: 12,
};

const LINE: CSSProperties = {
  fill: 'var(--ifm-color-emphasis-700)',
  fontSize: 12,
};

interface FrameProps {
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  /** Адрес или имя в коде — моноширинной строкой под заголовком. */
  code?: string;
  lines?: readonly string[];
  variant?: 'default' | 'accent' | 'ghost';
}

/** Документ или блок: заголовок слева сверху, вложенное рисуется поверх. */
function Frame({ x, y, width, height, title, code, lines = [], variant = 'default' }: FrameProps) {
  const style = variant === 'accent' ? ACCENT : variant === 'ghost' ? GHOST : SURFACE;
  const first = code === undefined ? y + 42 : y + 60;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={8} style={style} />
      <text x={x + 12} y={y + 22} style={TITLE}>
        {title}
      </text>
      {code !== undefined && (
        <text x={x + 12} y={y + 40} style={CODE}>
          {code}
        </text>
      )}
      {lines.map((line, index) => (
        <text key={line} x={x + 12} y={first + index * 17} style={LINE}>
          {line}
        </text>
      ))}
    </g>
  );
}

export function BuilderEmbeddingFrames() {
  return (
    <Diagram
      viewBox="0 0 960 470"
      minWidth={680}
      title={translate({
        id: 'diagram.builder.embedding.title',
        message: 'Билдер внутри приложения: вложенные документы',
      })}
      caption={translate({
        id: 'diagram.builder.embedding.caption',
        message:
          'Билдер — отдельный документ в рамке поверх страницы. Форму в превью рисует само приложение, файлы проекта билдер пишет прямо на диск.',
      })}
    >
      <Frame
        x={10}
        y={10}
        width={600}
        height={450}
        variant="ghost"
        title={translate({
          id: 'diagram.builder.embedding.page',
          message: 'Страница приложения в браузере',
        })}
        code="http://localhost:5175/contact"
      />
      <Frame
        x={30}
        y={70}
        width={270}
        height={64}
        title={translate({ id: 'diagram.builder.embedding.app', message: 'Приложение' })}
        lines={[
          translate({
            id: 'diagram.builder.embedding.app.line',
            message: 'ваши страницы, провайдеры, API',
          }),
        ]}
      />
      <Frame
        x={316}
        y={70}
        width={274}
        height={64}
        title={translate({
          id: 'diagram.builder.embedding.button',
          message: 'Кнопка «Билдер»',
        })}
        code="<ReformerBuilder>"
      />

      <Frame
        x={30}
        y={150}
        width={560}
        height={290}
        variant="accent"
        title={translate({
          id: 'diagram.builder.embedding.shell',
          message: 'Рамка оболочки — сам билдер',
        })}
        code="/__reformer-builder/"
      />
      <Frame
        x={46}
        y={222}
        width={262}
        height={198}
        title={translate({
          id: 'diagram.builder.embedding.formView',
          message: 'Вид «Форма» вкладки',
        })}
      />
      <Frame
        x={60}
        y={262}
        width={234}
        height={142}
        variant="ghost"
        title={translate({
          id: 'diagram.builder.embedding.stand',
          message: 'Рамка превью: стенд',
        })}
        lines={[
          translate({
            id: 'diagram.builder.embedding.stand.line1',
            message: 'одна форма — компонент',
          }),
          translate({
            id: 'diagram.builder.embedding.stand.line2',
            message: 'по умолчанию из index.ts',
          }),
          translate({
            id: 'diagram.builder.embedding.stand.line3',
            message: 'её модуля; рисует приложение',
          }),
        ]}
      />
      <Frame
        x={322}
        y={222}
        width={254}
        height={198}
        title={translate({
          id: 'diagram.builder.embedding.panel',
          message: 'Панель «Превью»',
        })}
      />
      <Frame
        x={336}
        y={262}
        width={226}
        height={142}
        variant="ghost"
        title={translate({
          id: 'diagram.builder.embedding.pageFrame',
          message: 'Рамка превью: страница',
        })}
        lines={[
          translate({
            id: 'diagram.builder.embedding.pageFrame.line1',
            message: 'приложение целиком,',
          }),
          translate({
            id: 'diagram.builder.embedding.pageFrame.line2',
            message: 'с адресной строкой;',
          }),
          translate({
            id: 'diagram.builder.embedding.pageFrame.line3',
            message: '↗ — в отдельной вкладке',
          }),
        ]}
      />

      <Frame
        x={700}
        y={40}
        width={250}
        height={170}
        title={translate({
          id: 'diagram.builder.embedding.server',
          message: 'Dev-сервер Vite',
        })}
        code="reformerBuilder()"
        lines={[
          translate({
            id: 'diagram.builder.embedding.server.line1',
            message: 'отдаёт интерфейс билдера,',
          }),
          translate({
            id: 'diagram.builder.embedding.server.line2',
            message: 'конфиг запуска и плагины',
          }),
          translate({
            id: 'diagram.builder.embedding.server.line3',
            message: 'по адресу /__reformer-builder/',
          }),
        ]}
      />
      <Frame
        x={700}
        y={300}
        width={250}
        height={120}
        title={translate({
          id: 'diagram.builder.embedding.disk',
          message: 'Папка проекта на диске',
        })}
        lines={[
          translate({
            id: 'diagram.builder.embedding.disk.line1',
            message: 'исходники приложения и форм,',
          }),
          translate({
            id: 'diagram.builder.embedding.disk.line2',
            message: 'каталог .ui_builder/',
          }),
        ]}
      />

      <Arrow from={[700, 150]} to={[594, 190]} />
      <text x={612} y={150} style={LINE}>
        {translate({ id: 'diagram.builder.embedding.serves', message: 'отдаёт' })}
      </text>
      <Arrow from={[592, 360]} to={[698, 360]} />
      <text x={612} y={352} style={LINE}>
        {translate({ id: 'diagram.builder.embedding.writes', message: 'Ctrl+S' })}
      </text>
      <Arrow from={[825, 300]} to={[825, 212]} />
      <text x={833} y={260} style={LINE}>
        {translate({ id: 'diagram.builder.embedding.reloads', message: 'видит правку' })}
      </text>
    </Diagram>
  );
}
