import { translate } from '@docusaurus/Translate';
import { Arrow, Box, Diagram } from './Diagram';
import { SequenceDiagram } from './SequenceDiagram';

/**
 * Ход ИИ-ассистента билдера: просьба уходит модели, модель за несколько шагов вызывает
 * инструменты стека формы, правки ложатся в рабочую копию одной записью.
 */
export function AssistantTurn() {
  return (
    <SequenceDiagram
      title={translate({ id: 'diagram.assistant.title', message: 'Как проходит ход ассистента' })}
      caption={translate({
        id: 'diagram.assistant.caption',
        message:
          'За ход модель может сделать несколько шагов. Правки ложатся в рабочую копию, а не на диск. Пунктир — ответ.',
      })}
      participants={[
        { id: 'human', title: translate({ id: 'diagram.assistant.human', message: 'Человек' }) },
        {
          id: 'panel',
          title: translate({ id: 'diagram.assistant.panel', message: 'Панель' }),
          subtitle: translate({ id: 'diagram.assistant.panelHint', message: '«Ассистент»' }),
        },
        { id: 'model', title: translate({ id: 'diagram.assistant.model', message: 'Модель' }) },
        {
          id: 'stack',
          title: translate({ id: 'diagram.assistant.stack', message: 'Стек формы' }),
          subtitle: 'ReFormer',
        },
        {
          id: 'copy',
          title: translate({ id: 'diagram.assistant.copy', message: 'Рабочая копия' }),
        },
      ]}
      steps={[
        {
          from: 'human',
          to: 'panel',
          label: translate({
            id: 'diagram.assistant.ask',
            message: '«добавь поле\n"Телефон"»',
          }),
        },
        {
          from: 'panel',
          to: 'model',
          label: translate({
            id: 'diagram.assistant.request',
            message: 'просьба, форма,\nсписок инструментов',
          }),
        },
        {
          loop: translate({ id: 'diagram.assistant.loop', message: 'шаги хода' }),
          steps: [
            {
              from: 'model',
              to: 'stack',
              label: translate({
                id: 'diagram.assistant.call',
                message: 'вызов инструмента —\nвставить узел,\nзадать свойство',
              }),
            },
            {
              from: 'stack',
              to: 'model',
              reply: true,
              label: translate({
                id: 'diagram.assistant.result',
                message: 'результат\nили ошибка',
              }),
            },
          ],
        },
        {
          from: 'model',
          to: 'panel',
          reply: true,
          label: translate({ id: 'diagram.assistant.answer', message: 'ответ текстом' }),
        },
        {
          from: 'stack',
          to: 'copy',
          label: translate({
            id: 'diagram.assistant.edits',
            message: 'правки одной записью\nи обновлённый\nкод модуля',
          }),
        },
        {
          from: 'panel',
          to: 'human',
          reply: true,
          label: translate({
            id: 'diagram.assistant.reply',
            message: 'ответ,\nстроки вызовов,\n«Восстановить»',
          }),
        },
      ]}
    />
  );
}

/** Экспорт формы: что читает генерация и куда кладёт модуль. */
export function CodegenFlow() {
  const [c0, c1, c2] = [
    { x: 16, width: 220 },
    { x: 290, width: 200 },
    { x: 544, width: 200 },
  ];
  const sourceH = 64;
  const [docY, rulesY] = [16, 128];
  const midY = 64;
  const midH = 80;
  const outY = 208;
  const outH = 56;
  const midCy = midY + midH / 2;
  const outCy = outY + outH / 2;
  const right = c0.x + c0.width;

  return (
    <Diagram
      viewBox="0 0 760 280"
      title={translate({ id: 'diagram.codegen.title', message: 'Как печатается модуль формы' })}
      caption={translate({
        id: 'diagram.codegen.caption',
        message:
          'Генерация читает документ формы и правила модуля и кладёт файлы модуля в рабочую копию; на диск они попадают записью.',
      })}
    >
      <Box
        {...c0}
        y={docY}
        height={sourceH}
        title={translate({ id: 'diagram.codegen.document', message: 'Документ формы' })}
        subtitle="schema/form.schema.json"
      />
      <Box
        {...c0}
        y={rulesY}
        height={sourceH}
        title={translate({ id: 'diagram.codegen.rules', message: 'Правила в коде модуля' })}
        subtitle="validation/, behavior/"
      />
      <Box
        {...c1}
        y={midY}
        height={midH}
        variant="accent"
        title={translate({ id: 'diagram.codegen.stack', message: 'Стек ReFormer' })}
        subtitle={translate({
          id: 'diagram.codegen.stackHint',
          message: 'что такое форма\nи её модуль',
        })}
      />
      <Box
        {...c2}
        y={midY}
        height={midH}
        title={translate({ id: 'diagram.codegen.targets', message: 'Цели генерации' })}
        subtitle={translate({
          id: 'diagram.codegen.targetsHint',
          message: 'встроенные и из\n.ui_builder/codegen',
        })}
      />
      <Box
        {...c2}
        y={outY}
        height={outH}
        title={translate({ id: 'diagram.codegen.copy', message: 'Рабочая копия' })}
      />
      <Box
        {...c1}
        y={outY}
        height={outH}
        title={translate({ id: 'diagram.codegen.disk', message: 'Диск' })}
      />

      <Arrow from={[right, docY + sourceH / 2]} to={[c1.x - 2, midCy - 12]} />
      <Arrow from={[right, rulesY + sourceH / 2]} to={[c1.x - 2, midCy + 12]} />
      <Arrow from={[c1.x + c1.width, midCy]} to={[c2.x - 2, midCy]} />
      <Arrow
        from={[c2.x + c2.width / 2, midY + midH]}
        to={[c2.x + c2.width / 2, outY - 2]}
        label={translate({ id: 'diagram.codegen.files', message: 'файлы модуля' })}
      />
      <Arrow
        from={[c2.x, outCy]}
        to={[c1.x + c1.width + 2, outCy]}
        label={translate({ id: 'diagram.codegen.write', message: 'запись' })}
      />
    </Diagram>
  );
}

/** Конвейер `reformer-plugin`: от исходников до каталога сборки, проекта и архива для npm. */
export function PluginBuildPipeline() {
  const w = 158;
  const columns = [16, 206, 396, 586];
  const center = (i: number) => columns[i] + w / 2;
  const [stageY, stageH] = [16, 96];
  const [outY, outH] = [152, 80];
  const [packY, packH] = [272, 64];
  const stageCy = stageY + stageH / 2;
  const outCy = outY + outH / 2;

  return (
    <Diagram
      viewBox="0 0 760 352"
      title={translate({ id: 'diagram.pluginBuild.title', message: 'Конвейер сборки плагина' })}
      caption={translate({
        id: 'diagram.pluginBuild.caption',
        message:
          'build проверяет сборку теми же правилами, что и билдер. Каталог сборки билдер грузит как есть, pack упаковывает его для npm.',
      })}
    >
      <Box
        x={columns[0]}
        y={stageY}
        width={w}
        height={stageH}
        title={translate({ id: 'diagram.pluginBuild.sources', message: 'Исходники' })}
        subtitle={['manifest.json, src/,', 'locales/, styles.css']}
      />
      <Box
        x={columns[1]}
        y={stageY}
        width={w}
        height={stageH}
        title="validate"
        subtitle={translate({
          id: 'diagram.pluginBuild.validate',
          message: 'манифест и файлы',
        })}
      />
      <Box
        x={columns[2]}
        y={stageY}
        width={w}
        height={stageH}
        title="build"
        subtitle={translate({
          id: 'diagram.pluginBuild.build',
          message: 'код, отложенные\nмодули, стили',
        })}
      />
      <Box
        x={columns[3]}
        y={stageY}
        width={w}
        height={stageH}
        title={translate({ id: 'diagram.pluginBuild.checks', message: 'Проверки' })}
        subtitle={translate({
          id: 'diagram.pluginBuild.checksHint',
          message: 'манифест,\nчисло файлов,\nпробная активация',
        })}
      />
      <Box
        x={columns[3]}
        y={outY}
        width={w}
        height={outH}
        variant="accent"
        title={translate({ id: 'diagram.pluginBuild.out', message: 'Каталог сборки' })}
        subtitle={['manifest.json,', 'main.js, chunks/']}
      />
      <Box
        x={columns[2]}
        y={outY}
        width={w}
        height={outH}
        title={translate({ id: 'diagram.pluginBuild.project', message: 'Проект' })}
        subtitle=".ui_builder/plugins/"
      />
      <Box
        x={columns[3]}
        y={packY}
        width={w}
        height={packH}
        title="pack"
        subtitle={translate({ id: 'diagram.pluginBuild.pack', message: 'архив для npm' })}
      />

      {[0, 1, 2].map((i) => (
        <Arrow key={i} from={[columns[i] + w, stageCy]} to={[columns[i + 1] - 2, stageCy]} />
      ))}
      <Arrow from={[center(3), stageY + stageH]} to={[center(3), outY - 2]} />
      <Arrow from={[columns[3], outCy]} to={[columns[2] + w + 2, outCy]} />
      <Arrow from={[center(3), outY + outH]} to={[center(3), packY - 2]} />
    </Diagram>
  );
}

/** Откуда берутся плагины билдера: слои по порядку загрузки и отдельно — установленные из npm. */
export function PluginLayers() {
  const chain = { x: 16, width: 460 };
  const h = 64;
  const rows = [16, 136, 256];
  const axis = chain.x + chain.width / 2;

  return (
    <Diagram
      viewBox="0 0 760 344"
      title={translate({ id: 'diagram.pluginLayers.title', message: 'Откуда берутся плагины' })}
      caption={translate({
        id: 'diagram.pluginLayers.caption',
        message:
          'Слои подключаются по очереди: встроенные — при запуске, за ними плагины приложения, плагины проекта — после открытия папки. Плагины из npm включает человек.',
      })}
    >
      <Box
        {...chain}
        y={rows[0]}
        height={h}
        title={translate({ id: 'diagram.pluginLayers.builtin', message: 'Встроенные' })}
        subtitle={translate({
          id: 'diagram.pluginLayers.builtinHint',
          message: 'собраны в оболочку: проект, управление плагинами, профиль',
        })}
      />
      <Box
        {...chain}
        y={rows[1]}
        height={h}
        title={translate({ id: 'diagram.pluginLayers.app', message: 'Плагины приложения' })}
        subtitle={translate({
          id: 'diagram.pluginLayers.appHint',
          message: 'едут вместе с билдером',
        })}
      />
      <Box
        {...chain}
        y={rows[2]}
        height={h}
        title={translate({ id: 'diagram.pluginLayers.project', message: 'Плагины проекта' })}
        subtitle={translate({
          id: 'diagram.pluginLayers.projectHint',
          message: '.ui_builder/plugins/ открытой папки',
        })}
      />
      <Box
        x={524}
        y={248}
        width={220}
        height={80}
        variant="ghost"
        title={translate({ id: 'diagram.pluginLayers.npm', message: 'Установленные из npm' })}
        subtitle={translate({
          id: 'diagram.pluginLayers.npmHint',
          message: 'скачаны в этот браузер,\nработают после включения',
        })}
      />

      <Arrow
        from={[axis, rows[0] + h]}
        to={[axis, rows[1] - 2]}
        label={translate({
          id: 'diagram.pluginLayers.atStart',
          message: 'при запуске, сразу за ними',
        })}
      />
      <Arrow
        from={[axis, rows[1] + h]}
        to={[axis, rows[2] - 2]}
        label={translate({
          id: 'diagram.pluginLayers.afterOpen',
          message: 'после открытия папки',
        })}
      />
    </Diagram>
  );
}
