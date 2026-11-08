import type { CSSProperties } from 'react';
import { translate } from '@docusaurus/Translate';
import { Diagram } from './Diagram';

/**
 * Раскладка оболочки билдера: рейлы, панели, редактор, нижняя панель и строка состояния.
 *
 * Карта, а не снимок экрана: показывает, ГДЕ что лежит, и подписывает каждую область именами,
 * которые человек видит в интерфейсе. Имена панелей — из словарей плагинов билдера
 * (`locales/ru.json`). Цвета — только переменные темы Infima, поэтому схема верна в обеих темах.
 */

const SURFACE: CSSProperties = {
  fill: 'var(--ifm-background-surface-color)',
  stroke: 'var(--ifm-color-emphasis-400)',
  strokeWidth: 1.5,
};

const ACCENT: CSSProperties = {
  fill: 'color-mix(in srgb, var(--ifm-color-primary) 12%, var(--ifm-background-surface-color))',
  stroke: 'var(--ifm-color-primary)',
  strokeWidth: 1.5,
};

const TITLE: CSSProperties = {
  fill: 'var(--ifm-font-color-base)',
  fontSize: 14,
  fontWeight: 600,
};

const LINE: CSSProperties = {
  fill: 'var(--ifm-color-emphasis-700)',
  fontSize: 12,
};

const ICON: CSSProperties = {
  fill: 'none',
  stroke: 'var(--ifm-color-emphasis-600)',
  strokeWidth: 1.25,
};

interface RegionProps {
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  /** Строки под заголовком — по одной на элемент области. */
  lines?: readonly string[];
  accent?: boolean;
}

/** Область раскладки: рамка, заголовок и список того, что в ней бывает. */
function Region({ x, y, width, height, title, lines = [], accent = false }: RegionProps) {
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={6} style={accent ? ACCENT : SURFACE} />
      <text x={x + 12} y={y + 22} style={TITLE}>
        {title}
      </text>
      {lines.map((line, index) => (
        <text key={line} x={x + 12} y={y + 44 + index * 18} style={LINE}>
          {line}
        </text>
      ))}
    </g>
  );
}

interface RailProps {
  x: number;
  y: number;
  height: number;
  /** Сколько значков рисовать сверху и снизу рейла. */
  top: number;
  bottom: number;
  label: string;
}

/** Рейл: узкая колонка значков-кнопок панелей и подпись вдоль неё. */
function Rail({ x, y, height, top, bottom, label }: RailProps) {
  const width = 40;
  const icon = 18;
  const cx = x + (width - icon) / 2;
  const tops = Array.from({ length: top }, (_, index) => y + 12 + index * 30);
  const bottoms = Array.from({ length: bottom }, (_, index) => y + height - 30 - index * 30);
  const midX = x + width / 2;
  const midY = y + height / 2;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={6} style={SURFACE} />
      {[...tops, ...bottoms].map((iconY) => (
        <rect key={iconY} x={cx} y={iconY} width={icon} height={icon} rx={4} style={ICON} />
      ))}
      <text
        x={midX}
        y={midY}
        textAnchor="middle"
        transform={`rotate(-90 ${midX} ${midY})`}
        style={LINE}
      >
        {label}
      </text>
    </g>
  );
}

export function BuilderShellLayout() {
  const rail = translate({ id: 'diagram.builder.shell.rail', message: 'рейл: кнопки панелей' });
  return (
    <Diagram
      viewBox="0 0 960 600"
      minWidth={680}
      title={translate({
        id: 'diagram.builder.shell.title',
        message: 'Раскладка окна билдера',
      })}
      caption={translate({
        id: 'diagram.builder.shell.caption',
        message:
          'Рейлы открывают панели слева и справа. Какие панели есть, решают плагины: у формы ReFormer появляются «Компоненты» и «Свойства», у markdown-файла их нет.',
      })}
    >
      <Region
        x={0}
        y={0}
        width={960}
        height={44}
        title={translate({
          id: 'diagram.builder.shell.toolbar',
          message: 'Панель инструментов: заголовок приложения, меню «Файл» и «Справка»',
        })}
      />

      <Rail x={0} y={52} height={472} top={3} bottom={0} label={rail} />
      <Region
        x={48}
        y={52}
        width={196}
        height={472}
        title={translate({ id: 'diagram.builder.shell.left', message: 'Левая панель' })}
        lines={[
          translate({
            id: 'diagram.builder.shell.left.project',
            message: '«Проект» — дерево файлов',
          }),
          translate({
            id: 'diagram.builder.shell.left.components',
            message: '«Компоненты» — палитра',
          }),
          translate({
            id: 'diagram.builder.shell.left.templates',
            message: '«Шаблоны форм»',
          }),
        ]}
      />

      <Region
        x={252}
        y={52}
        width={456}
        height={40}
        title={translate({
          id: 'diagram.builder.shell.tabs',
          message: 'Вкладки документов и кнопки видов',
        })}
      />
      <Region
        x={252}
        y={100}
        width={456}
        height={264}
        accent
        title={translate({ id: 'diagram.builder.shell.editor', message: 'Редактор' })}
        lines={[
          translate({
            id: 'diagram.builder.shell.editor.line1',
            message: 'открытый документ в выбранном виде:',
          }),
          translate({
            id: 'diagram.builder.shell.editor.line2',
            message: '«Дерево» — узлы формы списком',
          }),
          translate({
            id: 'diagram.builder.shell.editor.line3',
            message: '«Схема» — раскладка блоками',
          }),
          translate({
            id: 'diagram.builder.shell.editor.line4',
            message: '«Форма» — живая форма',
          }),
          translate({
            id: 'diagram.builder.shell.editor.line5',
            message: '«Исходный код» — текст файла',
          }),
        ]}
      />
      <Region
        x={252}
        y={372}
        width={456}
        height={152}
        title={translate({ id: 'diagram.builder.shell.bottom', message: 'Нижняя панель' })}
        lines={[
          translate({
            id: 'diagram.builder.shell.bottom.journal',
            message: '«Журнал» — виды «Проблемы» и «События»',
          }),
          translate({
            id: 'diagram.builder.shell.bottom.model',
            message: '«Модель» — значения живой формы',
          }),
        ]}
      />

      <Region
        x={716}
        y={52}
        width={196}
        height={472}
        title={translate({ id: 'diagram.builder.shell.right', message: 'Правая панель' })}
        lines={[
          translate({ id: 'diagram.builder.shell.right.inspector', message: '«Свойства» узла' }),
          translate({ id: 'diagram.builder.shell.right.codegen', message: '«Экспорт формы»' }),
          translate({ id: 'diagram.builder.shell.right.assistant', message: '«Ассистент»' }),
          translate({ id: 'diagram.builder.shell.right.mcp', message: '«MCP-серверы»' }),
          translate({
            id: 'diagram.builder.shell.right.preview',
            message: '«Превью» (в приложении)',
          }),
        ]}
      />
      <Rail x={920} y={52} height={472} top={2} bottom={2} label={rail} />

      <Region
        x={0}
        y={532}
        width={960}
        height={68}
        title={translate({ id: 'diagram.builder.shell.status', message: 'Строка состояния' })}
        lines={[
          translate({
            id: 'diagram.builder.shell.status.line',
            message:
              'слева: «Всё сохранено» или число несохранённых файлов, язык · справа: профиль и кит',
          }),
        ]}
      />
    </Diagram>
  );
}
