/**
 * Рейлы доков в настоящем Chromium.
 *
 * Обычный прогон про это не говорит ничего: доки — раскладка, а раскладка живёт в вычисленных
 * стилях и в том, что реально оказалось на экране. Отсюда сюда же перенесена и проверка
 * «панель одна»: в окружении `node` она означала бы «в дереве React один узел», а надо —
 * «человек видит одну».
 *
 * @module shell/platform/ui/Shell.browser.test
 */

import { describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createElement, type ReactElement } from 'react';
import { createExtensionRegistry } from '@/shell/platform/primitives/extension-point';
import { createCommandRegistry } from '@/shell/platform/primitives/command';
import { createWhenContextStore } from '@/shell/platform/ui/state/when-context-store';
import { createI18nService } from '@/shell/platform/services/i18n/i18n';
import {
  createInMemorySettingsBackend,
  createSettingsService,
} from '@/shell/platform/services/settings';
import { PanelPoint } from '@reformer/builder-plugin-api/internal';
import type { SlotId } from '@reformer/builder-plugin-api/internal';
import { Shell } from './Shell';
import { renderReact } from '@/testing/render';

/**
 * Снимок строки состояния — ЗАМОРОЖЕННАЯ ссылка, а не новый объект на вызов.
 *
 * `useSyncExternalStore` сравнивает снимки по ссылке: двойник, отдающий новый объект
 * каждый раз, даёт бесконечную перерисовку, и React говорит об этом ровно теми словами —
 * «результат getSnapshot должен кэшироваться». Ту же ошибку в этом проекте уже ловил
 * двойник контекста превью, и тоже не кодом, а падением.
 */
const STATUS = {
  get: () => SNAPSHOT,
  subscribe: () => ({ dispose() {} }),
} as never;
const SNAPSHOT = Object.freeze({ hasWorkspace: false });

/**
 * Тело панели помечено ОТДЕЛЬНЫМ текстом, а не своим заголовком.
 *
 * Совпади они — «видно ли панель» стало бы неотличимо от «видно ли кнопку рейла»,
 * и тест проходил бы, даже если тело не отрисовалось вовсе.
 */
const Body = (text: string) => (): ReactElement => createElement('p', null, `тело ${text}`);

/** Тело панели, которая занимает область дока целиком: корень растягивается сам. */
const FillBody = (text: string) => (): ReactElement =>
  createElement('p', { style: { flex: '1 1 0', minHeight: 0, margin: 0 } }, `тело ${text}`);

/**
 * Заголовок панели — КЛЮЧ словаря плагина, а не литерал. В тесте словарь подставляется
 * прямо здесь: иначе на экране были бы маркеры промаха, и проверка «видно ли панель»
 * проверяла бы их, а не панель.
 */
const KEY = (id: string): string => `panel.${id}.title`;

async function shell(
  panels: readonly {
    id: string;
    slot: SlotId;
    title: string;
    railPlacement?: 'top' | 'bottom';
    badge?: string;
    /** Подпись кнопки в шапке дока: панель отдаёт свои действия оболочке. */
    action?: string;
    /** Панель занимает область дока целиком и прокручивает себя сама. */
    fill?: boolean;
  }[],
  /** Сохранённая высота нижней панели: как если бы человек уже двигал разделитель. */
  bottomSize?: number
): Promise<ReturnType<typeof createCommandRegistry>> {
  const extensions = createExtensionRegistry();
  for (const p of panels) {
    extensions.forPlugin('test').contribute(
      PanelPoint,
      {
        id: p.id,
        slot: p.slot,
        titleKey: KEY(p.id),
        Body: p.fill === true ? FillBody(p.title) : Body(p.title),
        fill: p.fill,
        railPlacement: p.railPlacement,
        Badge:
          p.badge === undefined
            ? undefined
            : (): ReactElement => createElement('span', null, p.badge),
        Actions:
          p.action === undefined
            ? undefined
            : (): ReactElement => createElement('button', { type: 'button' }, p.action),
      },
      { id: p.id }
    );
  }
  const i18n = createI18nService();
  // Словарь Host грузится установкой локали — иначе ярлыки кнопок оболочки были бы
  // маркерами промаха, и проверка «кнопки нет» проходила бы, даже когда кнопка есть.
  await i18n.setLocale('ru');

  const view = i18n.forPlugin('test');
  for (const p of panels) {
    view.contribute('ru', { [KEY(p.id)]: p.title });
    view.contribute('en', { [KEY(p.id)]: p.title });
  }
  const commands = createCommandRegistry();
  const settings = createSettingsService(
    createInMemorySettingsBackend(
      bottomSize === undefined
        ? {}
        : {
            user: {
              'host.shell.layout.center': { editor: 600, bottom: bottomSize },
            },
          }
    )
  );
  await settings.hydrate();

  renderReact(
    createElement(Shell, {
      host: {
        extensions,
        whenContext: createWhenContextStore(),
        settings,
        commands,
        i18n,
        status: STATUS,
      } as never,
    })
  );

  return commands;
}

describe('рейлы доков: одна панель в зоне, как в первой версии', () => {
  it('правый рейл появляется и переключает панель', async () => {
    // Правого рейла не было вовсе: правый док складывал панели стопкой, и три панели
    // делили высоту колонки на три.
    await shell([
      { id: 'inspector', slot: 'panel.right', title: 'Свойства' },
      { id: 'chat', slot: 'panel.right', title: 'Ассистент' },
    ]);

    await expect.element(page.getByText('тело Свойства')).toBeVisible();
    expect(page.getByText('тело Ассистент').elements()).toHaveLength(0);

    await userEvent.click(page.getByRole('button', { name: 'Ассистент' }));

    await expect.element(page.getByText('тело Ассистент')).toBeVisible();
    expect(page.getByText('тело Свойства').elements()).toHaveLength(0);
  });

  it('повторный щелчок по активной вкладке сворачивает док', async () => {
    await shell([{ id: 'inspector', slot: 'panel.right', title: 'Свойства' }]);
    const tab = page.getByRole('button', { name: 'Свойства' });

    await userEvent.click(tab);

    expect(page.getByText('тело Свойства').elements()).toHaveLength(0);

    await userEvent.click(tab);

    await expect.element(page.getByText('тело Свойства')).toBeVisible();
  });

  it('доки независимы: свернув правый, левый не трогаем', async () => {
    // Один общий признак «свёрнут» означал бы, что закрыв инспектор, человек теряет дерево.
    await shell([
      { id: 'files', slot: 'panel.left', title: 'Файлы' },
      { id: 'inspector', slot: 'panel.right', title: 'Свойства' },
    ]);

    await userEvent.click(page.getByRole('button', { name: 'Свойства' }));

    expect(page.getByText('тело Свойства').elements()).toHaveLength(0);
    await expect.element(page.getByText('тело Файлы')).toBeVisible();
  });

  it('рейлы стоят по разным краям', async () => {
    // Сторона — единственное, чем рейлы отличаются, и перепутать её ничего, кроме экрана,
    // не мешает. Проверяется вычисленная геометрия, а не класс.
    await shell([
      { id: 'files', slot: 'panel.left', title: 'Файлы' },
      { id: 'inspector', slot: 'panel.right', title: 'Свойства' },
    ]);

    // Ждём отрисовки прежде, чем мерить: `element()` не ждёт, а монтаж React асинхронен —
    // без ожидания тест мерил бы пустую страницу и падал бы на поиске, а не на геометрии.
    await expect.element(page.getByRole('button', { name: 'Файлы' })).toBeVisible();

    const l = page.getByRole('button', { name: 'Файлы' }).element().getBoundingClientRect();
    const r = page.getByRole('button', { name: 'Свойства' }).element().getBoundingClientRect();

    expect(l.left).toBeLessThan(r.left);
    expect(r.left).toBeGreaterThan(window.innerWidth / 2);
  });

  it('рамка рейла рисуется со стороны центра, а не края окна', async () => {
    // Единственное, чем `side` управляет, — это рамка. Позицию задаёт место в разметке,
    // поэтому проверка позиции сторону НЕ проверяет: мутация «убрать side» её проходит.
    // Проверяется вычисленный стиль — ровно то, ради чего заведён браузерный прогон.
    await shell([
      { id: 'files', slot: 'panel.left', title: 'Файлы' },
      { id: 'inspector', slot: 'panel.right', title: 'Свойства' },
    ]);
    await expect.element(page.getByRole('button', { name: 'Свойства' })).toBeVisible();

    const rails = page.getByRole('navigation').elements();
    expect(rails).toHaveLength(2);
    const [leftRail, rightRail] = rails;

    // Рейл отделяет себя от ЦЕНТРА: левый рисует правую рамку, правый — левую.
    expect(getComputedStyle(leftRail).borderRightWidth).not.toBe('0px');
    expect(getComputedStyle(leftRail).borderLeftWidth).toBe('0px');
    expect(getComputedStyle(rightRail).borderLeftWidth).not.toBe('0px');
    expect(getComputedStyle(rightRail).borderRightWidth).toBe('0px');
  });

  it('вкладка с местом «внизу» прижата к нижнему краю рейла', async () => {
    // Ассистента ЗОВУТ, а не просматривают, и место у края даёт ему постоянный адрес.
    // Проверяется вычисленная геометрия: большим порядком это не выражается, а значит
    // и проверить порядком нельзя.
    await shell([
      { id: 'inspector', slot: 'panel.right', title: 'Свойства' },
      { id: 'chat', slot: 'panel.right', title: 'Ассистент', railPlacement: 'bottom' },
    ]);
    await expect.element(page.getByRole('button', { name: 'Ассистент' })).toBeVisible();

    const rail = page.getByRole('navigation').elements()[1]!.getBoundingClientRect();
    const first = page.getByRole('button', { name: 'Свойства' }).element().getBoundingClientRect();
    const last = page.getByRole('button', { name: 'Ассистент' }).element().getBoundingClientRect();

    // Ниже первой вкладки — и ближе к низу рейла, чем к верху.
    expect(last.top).toBeGreaterThan(first.top);
    expect(rail.bottom - last.bottom).toBeLessThan(last.top - rail.top);
  });

  it('без объявленного места вкладка остаётся в основной группе', async () => {
    // Умолчание не должно тянуть вниз: иначе каждая новая панель прижималась бы к краю,
    // и «постоянное место» перестало бы быть постоянным.
    await shell([
      { id: 'inspector', slot: 'panel.right', title: 'Свойства' },
      { id: 'export', slot: 'panel.right', title: 'Экспорт' },
    ]);
    await expect.element(page.getByRole('button', { name: 'Экспорт' })).toBeVisible();

    const rail = page.getByRole('navigation').elements()[1]!.getBoundingClientRect();
    const last = page.getByRole('button', { name: 'Экспорт' }).element().getBoundingClientRect();

    expect(last.top - rail.top).toBeLessThan(rail.bottom - last.bottom);
  });

  it('нижний док переключается вкладками', async () => {
    // Переключателя у нижнего дока не было ВОВСЕ: активная панель вычислялась, но сменить
    // её было нечем — рейлы стоят по бокам и управляют только своими доками.
    await shell([
      { id: 'problems', slot: 'panel.bottom', title: 'Проблемы' },
      { id: 'preview', slot: 'panel.bottom', title: 'Превью' },
    ]);

    await expect.element(page.getByText('тело Проблемы')).toBeVisible();
    expect(page.getByText('тело Превью').elements()).toHaveLength(0);

    await userEvent.click(page.getByRole('button', { name: 'Превью' }));

    await expect.element(page.getByText('тело Превью')).toBeVisible();
    expect(page.getByText('тело Проблемы').elements()).toHaveLength(0);
  });

  it('свёрнутый нижний док оставляет полосу вкладок: развернуть его есть чем', async () => {
    // Исчезни полоса вместе с телом — док закрывался бы навсегда, и это худший исход
    // из возможных: человек теряет панель и не понимает, куда она делась.
    await shell([{ id: 'problems', slot: 'panel.bottom', title: 'Проблемы' }]);
    const tab = page.getByRole('button', { name: 'Проблемы' });

    await userEvent.click(tab);
    expect(page.getByText('тело Проблемы').elements()).toHaveLength(0);

    // Вкладка на месте — значит есть чем вернуть.
    await expect.element(tab).toBeVisible();
    await userEvent.click(tab);

    await expect.element(page.getByText('тело Проблемы')).toBeVisible();
  });

  it('вкладки низа идут полосой, а не столбцом', async () => {
    // Вертикальная полоса у горизонтального дока отнимала бы ширину у всего, что под ней.
    await shell([
      { id: 'problems', slot: 'panel.bottom', title: 'Проблемы' },
      { id: 'preview', slot: 'panel.bottom', title: 'Превью' },
    ]);
    await expect.element(page.getByRole('button', { name: 'Превью' })).toBeVisible();

    const a = page.getByRole('button', { name: 'Проблемы' }).element().getBoundingClientRect();
    const b = page.getByRole('button', { name: 'Превью' }).element().getBoundingClientRect();

    expect(b.left).toBeGreaterThan(a.left);
    expect(Math.abs(b.top - a.top)).toBeLessThan(2);
  });

  it('крестик убирает нижний док целиком, вместе с полосой', async () => {
    await shell([{ id: 'problems', slot: 'panel.bottom', title: 'Проблемы' }]);
    await expect.element(page.getByText('тело Проблемы')).toBeVisible();

    await userEvent.click(page.getByRole('button', { name: 'Закрыть нижнюю панель' }));

    expect(page.getByText('тело Проблемы').elements()).toHaveLength(0);
    expect(page.getByRole('button', { name: 'Проблемы' }).elements()).toHaveLength(0);
  });

  it('действия панели стоят в шапке дока, справа от её заголовка', async () => {
    // Место действия — свойство ПАНЕЛИ, а не её содержимого: в теле кнопка уезжала бы
    // с прокруткой и отнимала высоту у списка. Проверяется геометрией, потому что
    // «нарисовано в шапке» и «нарисовано первым в теле» неразличимы по разметке.
    await shell([{ id: 'files', slot: 'panel.left', title: 'Файлы', action: 'Обновить' }]);
    await expect.element(page.getByRole('button', { name: 'Обновить' })).toBeVisible();

    const action = page.getByRole('button', { name: 'Обновить' }).element();
    const heading = page.getByRole('heading', { name: 'Файлы' }).element();
    const body = page.getByText('тело Файлы').element();

    const actionBox = action.getBoundingClientRect();
    expect(actionBox.left).toBeGreaterThan(heading.getBoundingClientRect().right);
    expect(actionBox.bottom).toBeLessThanOrEqual(body.getBoundingClientRect().top);
  });

  it('панель без действий не заводит в шапке пустого места под них', async () => {
    await shell([{ id: 'files', slot: 'panel.left', title: 'Файлы' }]);
    await expect.element(page.getByText('тело Файлы')).toBeVisible();

    expect(page.getByRole('button', { name: 'Обновить' }).elements()).toHaveLength(0);
  });

  it('сворачивание оставляет полосу со значком: ошибку видно, не разворачивая', async () => {
    // Ради этого свёрнутый вид и заведён. Полоса из одних имён ничего не сообщала бы.
    await shell([{ id: 'problems', slot: 'panel.bottom', title: 'Проблемы', badge: '7' }]);
    await expect.element(page.getByText('тело Проблемы')).toBeVisible();

    await userEvent.click(page.getByRole('button', { name: 'Свернуть до полосы вкладок' }));

    expect(page.getByText('тело Проблемы').elements()).toHaveLength(0);
    await expect.element(page.getByText('7')).toBeVisible();
  });

  it('свёрнутая полоса сохраняет кнопку разворота: обратный ход на том же месте', async () => {
    // Отказ был ровно здесь: в полосе кнопка сворачивания исчезала, и её место занимал
    // крестик — повторное нажатие в ту же точку закрывало панель вместо разворота.
    await shell([{ id: 'problems', slot: 'panel.bottom', title: 'Проблемы' }]);
    await userEvent.click(page.getByRole('button', { name: 'Свернуть до полосы вкладок' }));
    await expect.element(page.getByText('тело Проблемы')).not.toBeInTheDocument();

    await userEvent.click(page.getByRole('button', { name: 'Развернуть нижнюю панель' }));

    await expect.element(page.getByText('тело Проблемы')).toBeVisible();
  });

  it('свёрнутая полоса не заводит своей полосы прокрутки', async () => {
    // `react-resizable-panels` кладёт содержимому панели `overflow: auto` ИНЛАЙНОМ, а высота
    // панели — доля группы: свёрнутый док выходит то 22.01 пикселя, то 21.6, и на второй доле
    // Chromium ставил рядом с крестиком настоящую полосу в 15 пикселей. Классом это не
    // снимается, поэтому проверяем вычисленное значение, а не наличие класса.
    await shell([{ id: 'problems', slot: 'panel.bottom', title: 'Проблемы' }]);
    await userEvent.click(page.getByRole('button', { name: 'Свернуть до полосы вкладок' }));

    const strip = page.getByRole('region', { name: 'Нижняя панель' }).element();
    const content = strip.parentElement!;
    expect(getComputedStyle(content).overflow).toBe('hidden');

    // И сам признак: на заведомо дробной высоте полосы прокрутки нет.
    (content.parentElement as HTMLElement).style.flex = '0 0 21.6px';
    expect(content.offsetWidth - content.clientWidth).toBe(0);
  });

  it('сочетание клавиш водит между полным видом и полосой', async () => {
    // Три состояния в одну клавишу не уложить: сочетание переключает состояния РАБОТЫ,
    // закрытие — действие другой силы, и у него своя кнопка.
    const commands = await shell([{ id: 'problems', slot: 'panel.bottom', title: 'Проблемы' }]);
    await expect.element(page.getByText('тело Проблемы')).toBeVisible();

    await commands.execute('shell.dock.bottom.toggle');
    expect(page.getByText('тело Проблемы').elements()).toHaveLength(0);

    await commands.execute('shell.dock.bottom.toggle');
    await expect.element(page.getByText('тело Проблемы')).toBeVisible();
  });

  it('сочетание возвращает закрытую панель: крестик не ловушка', async () => {
    const commands = await shell([{ id: 'problems', slot: 'panel.bottom', title: 'Проблемы' }]);
    await userEvent.click(page.getByRole('button', { name: 'Закрыть нижнюю панель' }));
    expect(page.getByRole('button', { name: 'Проблемы' }).elements()).toHaveLength(0);

    await commands.execute('shell.dock.bottom.toggle');

    await expect.element(page.getByText('тело Проблемы')).toBeVisible();
  });

  it('свёрнутый док ОТДАЁТ место, а не только прячет содержимое', async () => {
    // Скрыть содержимое мало: `defaultSize` читается один раз при монтировании, поэтому
    // без императивного схлопывания под полосой оставалась бы пустая площадь прежней
    // высоты — панель «свёрнута», а места занимает столько же.
    await shell([{ id: 'problems', slot: 'panel.bottom', title: 'Проблемы' }]);
    await expect.element(page.getByText('тело Проблемы')).toBeVisible();

    const panel = document.querySelector('[data-slot="resizable-panel"][data-panel-id]');
    const full = page
      .getByRole('button', { name: 'Проблемы' })
      .element()
      .closest('div')!
      .parentElement!.getBoundingClientRect().height;

    await userEvent.click(page.getByRole('button', { name: 'Свернуть до полосы вкладок' }));
    await expect.element(page.getByText('тело Проблемы')).not.toBeInTheDocument();

    const collapsed = page
      .getByRole('button', { name: 'Проблемы' })
      .element()
      .closest('div')!
      .parentElement!.getBoundingClientRect().height;

    void panel;
    expect(collapsed).toBeLessThan(full);
    // Полоса на месте: свернули, а не закрыли.
    expect(collapsed).toBeGreaterThan(0);
  });

  it('полоса в свёрнутом виде НИЖЕ, чем в полном', async () => {
    // Свёрнутый вид обязан быть мельче: он существует, чтобы отдать место, а полоса
    // прежней высоты отдала бы его не полностью.
    await shell([{ id: 'problems', slot: 'panel.bottom', title: 'Проблемы' }]);
    const strip = () =>
      page
        .getByRole('button', { name: 'Проблемы' })
        .element()
        .closest('div')!
        .getBoundingClientRect().height;

    await expect.element(page.getByText('тело Проблемы')).toBeVisible();
    const full = strip();

    await userEvent.click(page.getByRole('button', { name: 'Свернуть до полосы вкладок' }));
    await expect.element(page.getByText('тело Проблемы')).not.toBeInTheDocument();

    expect(strip()).toBeLessThan(full);
  });

  it('повторное нажатие возвращает панели прежнюю высоту, а не полосу', async () => {
    // Отказ был ровно здесь: из свёрнутого состояния панель НЕ схлопнута, а уменьшена
    // прямым размером, и «развернуть» у не-схлопнутой по правилу библиотеки не делает
    // ничего. Содержимое возвращалось, а высота оставалась в полосу.
    // Высота задана НЕ умолчанием: иначе «вернул прежнюю» и «вернул умолчание» дают
    // одно и то же число, и проверка не различала бы их — мутация «забыть рабочую
    // высоту» проходила бы незамеченной.
    const commands = await shell(
      [{ id: 'problems', slot: 'panel.bottom', title: 'Проблемы' }],
      120
    );
    await expect.element(page.getByText('тело Проблемы')).toBeVisible();

    const height = (): number =>
      page
        .getByRole('button', { name: 'Проблемы' })
        .element()
        .closest('div')!
        .parentElement!.getBoundingClientRect().height;
    const full = height();
    // Убеждаемся, что засеянная высота действительно применилась, иначе проверка
    // ниже сравнивала бы умолчание с умолчанием.
    expect(Math.abs(full - 200)).toBeGreaterThan(20);

    await commands.execute('shell.dock.bottom.toggle');
    await expect.element(page.getByText('тело Проблемы')).not.toBeInTheDocument();
    expect(height()).toBeLessThan(full);

    await commands.execute('shell.dock.bottom.toggle');
    await expect.element(page.getByText('тело Проблемы')).toBeVisible();

    // Та же высота, что была: разворачиваем в рабочую, а не в полосу и не в минимум.
    expect(Math.abs(height() - full)).toBeLessThan(2);
  });

  it('нижняя панель, внесённая ПОСЛЕ монтирования оболочки, встаёт без отказа раскладки', async () => {
    // Плагин приложения или проекта поднимается позже оболочки, и его панель «Проблемы» —
    // первая в нижнем доке. Док при этом монтируется в уже живую группу раскладки, а её
    // ограничения для новой панели выводятся кадром позже: императивный вызов до этого —
    // отказ библиотеки («Panel constraints not found»), который раньше ронял раскладку.
    const errors: unknown[] = [];
    const onError = (event: ErrorEvent): void => void errors.push(event.error ?? event.message);
    window.addEventListener('error', onError);
    const consoleError = vi.spyOn(console, 'error').mockImplementation((...args) => {
      errors.push(args[0]);
    });
    try {
      const extensions = createExtensionRegistry();
      const i18n = createI18nService();
      await i18n.setLocale('ru');
      i18n.forPlugin('late').contribute('ru', { 'panel.problems.title': 'Проблемы' });
      const settings = createSettingsService(createInMemorySettingsBackend({}));
      await settings.hydrate();

      renderReact(
        createElement(Shell, {
          host: {
            extensions,
            whenContext: createWhenContextStore(),
            settings,
            commands: createCommandRegistry(),
            i18n,
            status: STATUS,
          } as never,
        })
      );
      await expect.element(page.getByRole('banner')).toBeVisible();

      extensions.forPlugin('late').contribute(
        PanelPoint,
        {
          id: 'problems',
          slot: 'panel.bottom',
          titleKey: 'panel.problems.title',
          Body: Body('Проблемы'),
        },
        { id: 'problems' }
      );

      await expect.element(page.getByText('тело Проблемы')).toBeVisible();
      // Отказ библиотеки приходит не сразу — на кадре, когда док сверяет размер с режимом.
      await new Promise((resolve) => setTimeout(resolve, 300));
      // Только отказы раскладки: стенд без команд оболочки сам пишет о непоказанных пунктах меню.
      expect(errors.map(String).filter((text) => /constraints|нижний док/.test(text))).toEqual([]);
      // И док действительно развёрнут, а не остался полосой нулевой высоты.
      const body = page.getByText('тело Проблемы').element();
      expect(body.getBoundingClientRect().height).toBeGreaterThan(0);
    } finally {
      window.removeEventListener('error', onError);
      consoleError.mockRestore();
    }
  });

  it('без правых панелей правого рейла нет вовсе', async () => {
    // Пустая полоса у края отнимала бы место у центра и ничего не обещала.
    await shell([{ id: 'files', slot: 'panel.left', title: 'Файлы' }]);

    await expect.element(page.getByRole('button', { name: 'Файлы' })).toBeVisible();

    // Ровно один рейл: правого нет вовсе, а не «есть, но пустой».
    expect(page.getByRole('navigation').elements()).toHaveLength(1);
  });

  it('панель, занимающая область целиком, получает всю высоту дока', async () => {
    // Рамке с чужим документом высоту взять неоткуда: тело обычной панели лежит
    // в прокручиваемой области, где высоту задаёт содержимое, и «растянуться» там не на что.
    await shell([{ id: 'preview', slot: 'panel.right', title: 'Превью', fill: true }]);
    await expect.element(page.getByText('тело Превью')).toBeVisible();

    const body = page.getByText('тело Превью').element().getBoundingClientRect();
    const dock = page
      .getByRole('complementary', { name: 'Правая панель' })
      .element()
      .getBoundingClientRect();

    // До нижнего края дока, а не на высоту строки текста.
    expect(Math.round(body.bottom)).toBe(Math.round(dock.bottom));
    expect(body.height).toBeGreaterThan(200);
    expect(Math.round(body.width)).toBe(Math.round(dock.width));
  });

  it('обычной панели высоту задаёт содержимое: растягивать её оболочка не берётся', async () => {
    await shell([{ id: 'inspector', slot: 'panel.right', title: 'Свойства' }]);
    await expect.element(page.getByText('тело Свойства')).toBeVisible();

    const body = page.getByText('тело Свойства').element().getBoundingClientRect();
    expect(body.height).toBeLessThan(60);
  });
});
